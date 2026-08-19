import { createHash, randomUUID } from "node:crypto";
import { relative, resolve, sep } from "node:path";
import { rm } from "node:fs/promises";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { OrganizationId, WorkspaceId } from "@scoutops/contracts";
import { buildScopedFilePath, writeScopedFile } from "@scoutops/storage";
import {
  evaluateQualityMetric,
  validateEvidenceInput,
  type EvidencePersistInput,
  type QualityMetricCode,
} from "@scoutops/data-quality";

type ValidatedEvidence = ReturnType<typeof validateEvidenceInput>;
type ExistingEvidence = RowDataPacket & {
  evidence_id: string;
  content_sha256: string;
  record_id: string;
  normalized_payload: unknown;
  canonical_url: string;
  parser_version: string;
  adapter_version: string;
  schema_version: string;
};
export interface BrowserEvidenceArtifactInput {
  organizationId: string;
  workspaceId: string;
  taskId: string;
  subqueryId: string;
  providerId: string;
  browserJobId: string;
  kind: "dom_fragment" | "screenshot";
  sourceUrl: string;
  contentType: "text/html" | "image/jpeg";
  content: Uint8Array;
  contentHash: string;
  capturedAt: Date;
  parserVersion: string;
  requestId: string;
  traceId: string;
  actorId: string;
}

const jsonValue = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value);
const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
};

export const evidenceOperationIdempotencyKey = (value: {
  organizationId: string;
  workspaceId: string;
  providerId: string;
  dedupeKey: string;
}) =>
  `evidence-v2:${createHash("sha256")
    .update(
      stableJson({
        organization_id: value.organizationId,
        workspace_id: value.workspaceId,
        provider_id: value.providerId,
        dedupe_key: value.dedupeKey,
      }),
    )
    .digest("hex")}`;

export class EvidencePersistenceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "EvidencePersistenceError";
  }
}

export class MySqlEvidencePersistence {
  constructor(
    private readonly pool: Pool,
    private readonly evidenceRoot: string,
    private readonly maxRawBytes: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async persist(input: EvidencePersistInput) {
    const value = validateEvidenceInput(input, this.maxRawBytes);
    const connection = await this.pool.getConnection();
    let target: string | null = null;
    try {
      await connection.beginTransaction();
      const retentionDays = await this.validateScope(connection, value);
      const existing = await this.findExisting(connection, value);
      if (existing) {
        const result = await this.linkExisting(connection, value, existing, this.now());
        await connection.commit();
        return result;
      }

      const evidenceId = randomUUID();
      const fileAssetId = randomUUID();
      const recordId = randomUUID();
      const fileInput = {
        organization_id: value.organizationId as OrganizationId,
        workspace_id: value.workspaceId as WorkspaceId,
        category: "evidence" as const,
        resource_id: evidenceId,
        filename: `${evidenceId}.bin`,
      };
      target = buildScopedFilePath(this.evidenceRoot, fileInput);
      await writeScopedFile(this.evidenceRoot, fileInput, value.content);
      const now = this.now();
      const retentionUntil = new Date(value.capturedAt.getTime() + retentionDays * 86400000);
      const relativePath = relative(resolve(this.evidenceRoot), target).split(sep).join("/");
      await connection.query(
        [
          "INSERT INTO file_assets (id,organization_id,workspace_id,category,relative_path,content_sha256,",
          "size_bytes,status,created_by,created_at,updated_at) VALUES (?,?,?,'evidence',?,?,?,'active',?,?,?)",
        ].join(""),
        [
          fileAssetId,
          value.organizationId,
          value.workspaceId,
          relativePath,
          value.contentHash,
          value.content.byteLength,
          value.actorId,
          now,
          now,
        ],
      );
      await connection.query(
        [
          "INSERT INTO raw_evidence (id,organization_id,workspace_id,collection_task_id,collection_subquery_id,",
          "provider_id,file_asset_id,source_url,canonical_url,dedupe_key,content_sha256,content_type,size_bytes,",
          "captured_at,parser_version,adapter_version,retention_until,status,request_id,trace_id,created_by,",
          "created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?,?)",
        ].join(""),
        [
          evidenceId,
          value.organizationId,
          value.workspaceId,
          value.taskId,
          value.subqueryId,
          value.providerId,
          fileAssetId,
          value.sourceUrl,
          value.canonicalUrl,
          value.dedupeKey,
          value.contentHash,
          value.contentType,
          value.content.byteLength,
          value.capturedAt,
          value.parserVersion,
          value.adapterVersion,
          retentionUntil,
          value.requestId,
          value.traceId,
          value.actorId,
          now,
        ],
      );
      await connection.query(
        [
          "INSERT INTO normalized_records (id,organization_id,workspace_id,provider_id,raw_evidence_id,",
          "record_key,schema_version,record_version,payload_json,supersedes_record_id,correction_reason,status,",
          "request_id,trace_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,1,?,NULL,NULL,'active',?,?,?,?)",
        ].join(""),
        [
          recordId,
          value.organizationId,
          value.workspaceId,
          value.providerId,
          evidenceId,
          value.recordKey,
          value.recordSchemaVersion,
          JSON.stringify(value.normalizedPayload),
          value.requestId,
          value.traceId,
          value.actorId,
          now,
        ],
      );
      for (const item of value.provenance) {
        await connection.query(
          [
            "INSERT INTO field_provenance (id,organization_id,workspace_id,normalized_record_id,raw_evidence_id,",
            "field_path,source_path,transform_version,source_value_sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          ].join(""),
          [
            randomUUID(),
            value.organizationId,
            value.workspaceId,
            recordId,
            evidenceId,
            item.fieldPath,
            item.sourcePath,
            item.transformVersion,
            item.sourceValueHash,
            now,
          ],
        );
      }
      await this.link(connection, value, evidenceId, recordId, "captured", now);
      await this.event(
        connection,
        value,
        "evidence.persisted",
        "raw_evidence",
        evidenceId,
        { normalized_record_id: recordId, content_sha256: value.contentHash },
        now,
      );
      await this.outbox(
        connection,
        value,
        "evidence.persisted",
        "raw_evidence",
        evidenceId,
        { evidence_id: evidenceId, normalized_record_id: recordId },
        now,
      );
      await connection.query(
        "INSERT INTO evidence_data_operations (id,actor_id,route,idempotency_key,resource_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          value.actorId,
          "worker:evidence.persist",
          evidenceOperationIdempotencyKey(value),
          evidenceId,
          JSON.stringify({ evidence_id: evidenceId, normalized_record_id: recordId }),
          now,
        ],
      );
      await connection.commit();
      target = null;
      return { evidence_id: evidenceId, normalized_record_id: recordId, deduplicated: false };
    } catch (error) {
      await connection.rollback();
      if (target) await rm(target, { force: true });
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        return this.recoverDuplicate(value, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async persistBrowserArtifact(value: BrowserEvidenceArtifactInput) {
    if (
      !/^[A-Za-z0-9._:-]{1,200}$/.test(value.browserJobId) ||
      !/^[A-Za-z0-9._-]{1,200}$/.test(value.parserVersion) ||
      !/^[a-f0-9]{64}$/.test(value.contentHash) ||
      createHash("sha256").update(value.content).digest("hex") !== value.contentHash ||
      !value.content.byteLength ||
      value.content.byteLength > this.maxRawBytes ||
      (value.kind === "dom_fragment" && value.contentType !== "text/html") ||
      (value.kind === "screenshot" && value.contentType !== "image/jpeg") ||
      !Number.isFinite(value.capturedAt.getTime())
    )
      throw new EvidencePersistenceError("browser_evidence_invalid");
    const connection = await this.pool.getConnection();
    let target: string | null = null;
    try {
      await connection.beginTransaction();
      const retentionDays = await this.validateScope(connection, value);
      const [existing] = await connection.query<RowDataPacket[]>(
        "SELECT id,content_sha256 FROM browser_evidence_artifacts WHERE browser_job_id=? AND kind=? FOR UPDATE",
        [value.browserJobId, value.kind],
      );
      if (existing[0]) {
        if (String(existing[0].content_sha256) !== value.contentHash)
          throw new EvidencePersistenceError("browser_evidence_conflict");
        await connection.commit();
        return { artifact_id: String(existing[0].id), deduplicated: true };
      }
      const artifactId = randomUUID(),
        fileAssetId = randomUUID(),
        extension = value.kind === "screenshot" ? "jpg" : "html",
        fileInput = {
          organization_id: value.organizationId as OrganizationId,
          workspace_id: value.workspaceId as WorkspaceId,
          category: "evidence" as const,
          resource_id: artifactId,
          filename: `${artifactId}.${extension}`,
        };
      target = buildScopedFilePath(this.evidenceRoot, fileInput);
      await writeScopedFile(this.evidenceRoot, fileInput, value.content);
      const now = this.now(),
        retentionUntil = new Date(value.capturedAt.getTime() + retentionDays * 86400000),
        relativePath = relative(resolve(this.evidenceRoot), target).split(sep).join("/");
      await connection.query(
        [
          "INSERT INTO file_assets (id,organization_id,workspace_id,category,relative_path,content_sha256,",
          "size_bytes,status,created_by,created_at,updated_at) VALUES (?,?,?,'evidence',?,?,?,'active',?,?,?)",
        ].join(""),
        [
          fileAssetId,
          value.organizationId,
          value.workspaceId,
          relativePath,
          value.contentHash,
          value.content.byteLength,
          value.actorId,
          now,
          now,
        ],
      );
      await connection.query(
        [
          "INSERT INTO browser_evidence_artifacts (id,organization_id,workspace_id,collection_task_id,",
          "collection_subquery_id,provider_id,browser_job_id,file_asset_id,kind,source_url,content_type,",
          "content_sha256,size_bytes,captured_at,parser_version,retention_until,status,request_id,trace_id,",
          "created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?,?)",
        ].join(""),
        [
          artifactId,
          value.organizationId,
          value.workspaceId,
          value.taskId,
          value.subqueryId,
          value.providerId,
          value.browserJobId,
          fileAssetId,
          value.kind,
          value.sourceUrl,
          value.contentType,
          value.contentHash,
          value.content.byteLength,
          value.capturedAt,
          value.parserVersion,
          retentionUntil,
          value.requestId,
          value.traceId,
          value.actorId,
          now,
        ],
      );
      await this.event(
        connection,
        value,
        "browser_evidence.persisted",
        "browser_evidence_artifact",
        artifactId,
        {
          kind: value.kind,
          browser_job_id: value.browserJobId,
          content_sha256: value.contentHash,
          parser_version: value.parserVersion,
        },
        now,
      );
      await this.outbox(
        connection,
        value,
        "browser_evidence.persisted",
        "browser_evidence_artifact",
        artifactId,
        { artifact_id: artifactId, kind: value.kind, browser_job_id: value.browserJobId },
        now,
      );
      await connection.commit();
      target = null;
      return { artifact_id: artifactId, deduplicated: false };
    } catch (error) {
      await connection.rollback();
      if (target) await rm(target, { force: true });
      throw error;
    } finally {
      connection.release();
    }
  }

  async reconcile(input: {
    organizationId: string;
    workspaceId: string;
    providerId: string;
    parserVersion: string;
    market: string;
    windowStartedAt: Date;
    windowEndedAt: Date;
    metrics: Array<{ code: QualityMetricCode; numerator: number; denominator: number }>;
    actorId: string;
    requestId: string;
    traceId: string;
  }) {
    if (
      !/^[A-Za-z0-9._-]{1,40}$/.test(input.market) ||
      input.windowEndedAt <= input.windowStartedAt ||
      !input.metrics.length
    )
      throw new EvidencePersistenceError("reconciliation_input_invalid");
    const metrics = input.metrics.map((item) =>
      evaluateQualityMetric(item.code, item.numerator, item.denominator),
    );
    const status = metrics.some((item) => item.status === "failed")
      ? "failed"
      : metrics.some((item) => item.status === "insufficient_sample")
        ? "insufficient_sample"
        : "passed";
    const runId = randomUUID(),
      now = this.now(),
      sampleCount = Math.max(...metrics.map((item) => item.denominator)),
      connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        [
          "INSERT INTO reconciliation_runs (id,organization_id,workspace_id,provider_id,parser_version,market,",
          "window_started_at,window_ended_at,sample_count,metrics_json,status,request_id,trace_id,created_by,",
          "created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          runId,
          input.organizationId,
          input.workspaceId,
          input.providerId,
          input.parserVersion,
          input.market,
          input.windowStartedAt,
          input.windowEndedAt,
          sampleCount,
          JSON.stringify(metrics),
          status,
          input.requestId,
          input.traceId,
          input.actorId,
          now,
        ],
      );
      for (const metric of metrics.filter((item) => item.status !== "passed")) {
        const issueId = randomUUID();
        await connection.query(
          [
            "INSERT INTO data_quality_issues (id,organization_id,workspace_id,provider_id,reconciliation_run_id,",
            "raw_evidence_id,normalized_record_id,metric_code,field_path,severity,status,actual_value,",
            "threshold_value,details_json,resolved_by,resolution_reason,resolved_at,request_id,trace_id,version,",
            "created_at,updated_at) VALUES (?,?,?,?,?,NULL,NULL,?,NULL,?,'open',?,?,?,NULL,NULL,NULL,?,?,1,?,?)",
          ].join(""),
          [
            issueId,
            input.organizationId,
            input.workspaceId,
            input.providerId,
            runId,
            metric.code,
            metric.status === "failed" ? "critical" : "warning",
            metric.value,
            metric.threshold,
            JSON.stringify({
              direction: metric.direction,
              numerator: metric.numerator,
              denominator: metric.denominator,
              minimum_sample: metric.minimumSample,
            }),
            input.requestId,
            input.traceId,
            now,
            now,
          ],
        );
        await this.event(
          connection,
          input,
          "data_quality.issue.opened",
          "data_quality_issue",
          issueId,
          { metric_code: metric.code, status: metric.status },
          now,
        );
        await this.outbox(
          connection,
          input,
          "data_quality.issue.opened",
          "data_quality_issue",
          issueId,
          { issue_id: issueId, metric_code: metric.code },
          now,
        );
      }
      await this.event(
        connection,
        input,
        "data_quality.reconciled",
        "reconciliation_run",
        runId,
        { status, sample_count: sampleCount },
        now,
      );
      await connection.commit();
      return { id: runId, status, sample_count: sampleCount, metrics };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async validateScope(
    connection: PoolConnection,
    value: {
      taskId: string;
      subqueryId: string;
      organizationId: string;
      workspaceId: string;
      providerId: string;
    },
  ) {
    const [rows] = await connection.query<RowDataPacket[]>(
      [
        "SELECT p.retention_days FROM collection_tasks t JOIN collection_subqueries q ON q.task_id=t.id ",
        "JOIN providers p ON p.id=q.provider_id WHERE t.id=? AND q.id=? AND t.organization_id=? AND ",
        "t.workspace_id=? AND q.organization_id=? AND q.workspace_id=? AND q.provider_id=? FOR UPDATE",
      ].join(""),
      [
        value.taskId,
        value.subqueryId,
        value.organizationId,
        value.workspaceId,
        value.organizationId,
        value.workspaceId,
        value.providerId,
      ],
    );
    if (!rows[0]) throw new EvidencePersistenceError("evidence_scope_or_task_invalid");
    return Number(rows[0].retention_days);
  }

  private async findExisting(connection: PoolConnection, value: ValidatedEvidence) {
    const [rows] = await connection.query<ExistingEvidence[]>(
      [
        "SELECT e.id evidence_id,e.content_sha256,e.canonical_url,e.parser_version,e.adapter_version,",
        "n.id record_id,n.schema_version,n.payload_json normalized_payload FROM raw_evidence e JOIN ",
        "normalized_records n ON n.raw_evidence_id=e.id AND n.status='active' WHERE e.organization_id=? AND ",
        "e.workspace_id=? AND e.provider_id=? AND e.dedupe_key=? ORDER BY n.record_version DESC,n.created_at DESC,",
        "n.id DESC LIMIT 1 FOR UPDATE",
      ].join(""),
      [value.organizationId, value.workspaceId, value.providerId, value.dedupeKey],
    );
    return rows[0] ?? null;
  }

  private async linkExisting(
    connection: PoolConnection,
    value: ValidatedEvidence,
    existing: ExistingEvidence,
    now: Date,
  ) {
    const contentChanged = String(existing.content_sha256) !== value.contentHash;
    if (
      contentChanged &&
      (String(existing.canonical_url) !== value.canonicalUrl ||
        String(existing.parser_version) !== value.parserVersion ||
        String(existing.adapter_version) !== value.adapterVersion ||
        String(existing.schema_version) !== value.recordSchemaVersion ||
        stableJson(jsonValue(existing.normalized_payload)) !== stableJson(value.normalizedPayload))
    )
      throw new EvidencePersistenceError("evidence_dedupe_conflict");
    await this.link(
      connection,
      value,
      String(existing.evidence_id),
      String(existing.record_id),
      "deduplicated",
      now,
      contentChanged
        ? {
            content_changed: true,
            existing_content_sha256: String(existing.content_sha256),
            observed_content_sha256: value.contentHash,
          }
        : undefined,
    );
    return {
      evidence_id: String(existing.evidence_id),
      normalized_record_id: String(existing.record_id),
      deduplicated: true,
      content_changed: contentChanged,
    };
  }

  private async recoverDuplicate(value: ValidatedEvidence, originalError: unknown) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await this.validateScope(connection, value);
      const existing = await this.findExisting(connection, value);
      if (!existing) throw originalError;
      const result = await this.linkExisting(connection, value, existing, this.now());
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async link(
    connection: PoolConnection,
    value: ValidatedEvidence,
    evidenceId: string,
    recordId: string,
    linkType: "captured" | "deduplicated",
    now: Date,
    observation?: Record<string, unknown>,
  ) {
    const [result] = await connection.query<ResultSetHeader>(
      [
        "INSERT INTO collection_task_evidence_links (id,organization_id,workspace_id,collection_task_id,",
        "collection_subquery_id,provider_id,raw_evidence_id,normalized_record_id,link_type,request_id,trace_id,",
        "created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",
      ].join(""),
      [
        randomUUID(),
        value.organizationId,
        value.workspaceId,
        value.taskId,
        value.subqueryId,
        value.providerId,
        evidenceId,
        recordId,
        linkType,
        value.requestId,
        value.traceId,
        value.actorId,
        now,
      ],
    );
    if (linkType === "deduplicated" && result.affectedRows > 0) {
      const payload = {
        collection_task_id: value.taskId,
        collection_subquery_id: value.subqueryId,
        normalized_record_id: recordId,
        link_type: linkType,
        ...observation,
      };
      await this.event(
        connection,
        value,
        "evidence.linked",
        "raw_evidence",
        evidenceId,
        payload,
        now,
      );
      await this.outbox(
        connection,
        value,
        "evidence.linked",
        "raw_evidence",
        evidenceId,
        payload,
        now,
      );
    }
  }

  private event(
    connection: PoolConnection,
    input: {
      organizationId: string;
      workspaceId: string;
      actorId: string;
      requestId: string;
      traceId: string;
    },
    eventType: string,
    resourceType: string,
    resourceId: string,
    payload: unknown,
    now: Date,
  ) {
    return connection.query(
      [
        "INSERT INTO evidence_data_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,",
        "actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) ",
        "VALUES (?,?,?,?,?,?,'worker',?,?,?,?,?)",
      ].join(""),
      [
        randomUUID(),
        input.organizationId,
        input.workspaceId,
        eventType,
        resourceType,
        resourceId,
        input.actorId,
        input.requestId,
        input.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
  }

  private outbox(
    connection: PoolConnection,
    input: { organizationId: string; workspaceId: string; requestId: string; traceId: string },
    eventType: string,
    resourceType: string,
    resourceId: string,
    payload: unknown,
    now: Date,
  ) {
    return connection.query(
      [
        "INSERT INTO evidence_data_outbox (id,organization_id,workspace_id,event_type,resource_type,resource_id,",
        "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) ",
        "VALUES (?,?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
      ].join(""),
      [
        randomUUID(),
        input.organizationId,
        input.workspaceId,
        eventType,
        resourceType,
        resourceId,
        JSON.stringify(payload),
        now,
        input.requestId,
        input.traceId,
        now,
        now,
      ],
    );
  }
}
