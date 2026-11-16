import { appendEvidenceDataEvent, appendEvidenceDataOutbox, dataQualityIssueScope, fileAssetAccountStorage } from "@scoutops/database";
import { createHash, randomUUID } from "node:crypto";
import { relative, resolve, sep } from "node:path";
import { rm } from "node:fs/promises";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { OrganizationId, WorkspaceId } from "@scoutops/contracts";
import { accountEvidenceRelativePath, writeAccountEvidenceFile, buildScopedFilePath, writeScopedFile } from "@scoutops/storage";
import {
  markEvidencePersistenceFailure,
  type EvidencePersistenceOperation,
} from "./collection-failure-diagnostic.js";
import {
  evaluateQualityMetric,
  validateEvidenceInput,
  type EvidencePersistInput,
  type QualityMetricCode,
} from "@scoutops/data-quality";

type EvidenceTaskFence = { accountId: string; leaseToken: string };
type ValidatedEvidence = ReturnType<typeof validateEvidenceInput> & { taskFence?: EvidenceTaskFence };
type ExistingEvidence = RowDataPacket & {
  evidence_id: string;
  file_asset_id: string;
  content_sha256: string;
  record_id: string;
  normalized_payload: unknown;
  canonical_url: string;
  parser_version: string;
  adapter_version: string;
  schema_version: string;
};
type ExistingRecord = RowDataPacket & {
  record_id: string;
  record_version: number;
};
type EvidenceOwner = { account_id: string; reason: "shared" | "unassigned" | "exclusive_owner" };
type OwnershipRef = readonly [string, string];
export interface BrowserEvidenceArtifactInput {
  taskFence?: EvidenceTaskFence;
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

  async persist(input: EvidencePersistInput & { taskFence?: EvidenceTaskFence }) {
    const value: ValidatedEvidence = { ...validateEvidenceInput(input, this.maxRawBytes),
      ...(input.taskFence ? { taskFence: input.taskFence } : {}) };
    const connection = await this.pool.getConnection();
    let target: string | null = null;
    let operation: EvidencePersistenceOperation = "transaction_begin";
    try {
      await connection.beginTransaction();
      operation = "scope_lock";
      const retentionDays = await this.validateScope(connection, value);
      const ownership = await this.taskOwnership(connection, value.taskId);
      const accountFiles = await fileAssetAccountStorage(connection);
      if (accountFiles && !ownership?.owner) throw new EvidencePersistenceError("evidence_task_owner_missing");
      const accountScope = accountFiles && await this.hasAccountEvidenceColumns(connection)
        ? ownership!.owner!.account_id : null;
      if (value.taskFence && accountScope !== value.taskFence.accountId)
        throw new EvidencePersistenceError("account_evidence_schema_or_owner_invalid");
      const scopeColumns = accountScope ? "account_id" : "organization_id,workspace_id";
      const scopeValues = accountScope ? [accountScope] : [value.organizationId, value.workspaceId];
      const scopePlaceholders = accountScope ? "?" : "?,?";
      operation = "dedupe_lock";
      const existing = await this.findExisting(connection, value, accountFiles, accountScope);
      if (existing) {
        operation = "dedupe_link";
        const result = await this.linkExisting(connection, value, existing, this.now(), ownership, accountFiles);
        operation = "transaction_commit";
        await connection.commit();
        return result;
      }

      const evidenceId = randomUUID();
      const fileAssetId = randomUUID();
      const recordId = randomUUID();
      operation = "record_version_lock";
      const previousRecord = await this.findExistingRecord(connection, value, accountFiles, accountScope);
      if (previousRecord)
        await this.verifyEvidenceOwners(connection, ownership, [["normalized_records", previousRecord.record_id]]);
      const owned: OwnershipRef[] = [
        ["file_assets", fileAssetId], ["raw_evidence", evidenceId], ["normalized_records", recordId],
      ];
      const fileInput = {
        organization_id: value.organizationId as OrganizationId,
        workspace_id: value.workspaceId as WorkspaceId,
        category: "evidence" as const,
        resource_id: evidenceId,
        filename: `${evidenceId}.bin`,
      };
      const accountPath = accountFiles ? accountEvidenceRelativePath({
        account_id: ownership!.owner!.account_id, asset_id: fileAssetId, evidence_id: evidenceId,
      }) : null;
      target = accountPath ? resolve(this.evidenceRoot, accountPath) : buildScopedFilePath(this.evidenceRoot, fileInput);
      operation = "file_write";
      if (accountPath) await writeAccountEvidenceFile(this.evidenceRoot, accountPath, value.content);
      else await writeScopedFile(this.evidenceRoot, fileInput, value.content);
      const now = this.now();
      const retentionUntil = new Date(value.capturedAt.getTime() + retentionDays * 86400000);
      const relativePath = relative(resolve(this.evidenceRoot), target).split(sep).join("/");
      operation = "file_asset_insert";
      await this.insertEvidenceFile(connection, value, fileAssetId, relativePath, now, accountFiles ? ownership!.owner : null);
      operation = "raw_evidence_insert";
      await connection.query(
        [
          `INSERT INTO raw_evidence (id,${scopeColumns},collection_task_id,collection_subquery_id,`,
          "provider_id,file_asset_id,source_url,canonical_url,dedupe_key,content_sha256,content_type,size_bytes,",
          "captured_at,parser_version,adapter_version,retention_until,status,request_id,trace_id,created_by,",
          `created_at) VALUES (?,${scopePlaceholders},?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?,?)`,
        ].join(""),
        [
          evidenceId,
          ...scopeValues,
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
      operation = "record_supersede";
      if (previousRecord)
        await connection.query(
          "UPDATE normalized_records SET status='superseded' WHERE id=? AND status='active'",
          [previousRecord.record_id],
        );
      operation = "normalized_record_insert";
      await connection.query(
        [
          `INSERT INTO normalized_records (id,${scopeColumns},provider_id,raw_evidence_id,`,
          "record_key,schema_version,record_version,payload_json,supersedes_record_id,correction_reason,status,",
          `request_id,trace_id,created_by,created_at) VALUES (?,${scopePlaceholders},?,?,?,?,?,?,?,NULL,'active',?,?,?,?)`,
        ].join(""),
        [
          recordId,
          ...scopeValues,
          value.providerId,
          evidenceId,
          value.recordKey,
          value.recordSchemaVersion,
          previousRecord ? Number(previousRecord.record_version) + 1 : 1,
          JSON.stringify(value.normalizedPayload),
          previousRecord?.record_id ?? null,
          value.requestId,
          value.traceId,
          value.actorId,
          now,
        ],
      );
      for (const item of value.provenance) {
        operation = "provenance_insert";
        const provenanceId = randomUUID();
        owned.push(["field_provenance", provenanceId]);
        await connection.query(
          [
            "INSERT INTO field_provenance (id,normalized_record_id,raw_evidence_id,",
            "field_path,source_path,transform_version,source_value_sha256,created_at) VALUES (?,?,?,?,?,?,?,?)",
          ].join(""),
          [
            provenanceId,
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
      operation = "evidence_link";
      await this.link(connection, value, evidenceId, recordId, "captured", now, ownership);
      operation = "event_insert";
      const eventId = await this.event(
        connection,
        value,
        "evidence.persisted",
        "raw_evidence",
        evidenceId,
        {
          normalized_record_id: recordId,
          content_sha256: value.contentHash,
          ...(previousRecord ? { supersedes_record_id: previousRecord.record_id } : {}),
        },
        now,
      );
      operation = "outbox_insert";
      const outboxId = await this.outbox(
        connection,
        value,
        "evidence.persisted",
        "raw_evidence",
        evidenceId,
        { evidence_id: evidenceId, normalized_record_id: recordId },
        now,
      );
      owned.push(["evidence_data_events", eventId], ["evidence_data_outbox", outboxId]);
      await this.registerEvidenceOwners(connection, ownership?.owner, owned);
      operation = "operation_insert";
      await connection.query(
        "INSERT INTO evidence_data_operations (id,actor_id,route,idempotency_key,resource_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          value.actorId,
          "worker:evidence.persist",
          value.taskFence ? "evidence-account-v1:" + createHash("sha256")
            .update(stableJson([value.taskFence.accountId, value.providerId, value.dedupeKey])).digest("hex")
            : evidenceOperationIdempotencyKey(value),
          evidenceId,
          JSON.stringify({ evidence_id: evidenceId, normalized_record_id: recordId }),
          now,
        ],
      );
      operation = "transaction_commit";
      await connection.commit();
      target = null;
      return { evidence_id: evidenceId, normalized_record_id: recordId, deduplicated: false };
    } catch (error) {
      markEvidencePersistenceFailure(error, operation);
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
      const accountFiles = await fileAssetAccountStorage(connection);
      const ownership = accountFiles ? await this.taskOwnership(connection, value.taskId) : null;
      if (accountFiles && !ownership?.owner) throw new EvidencePersistenceError("evidence_task_owner_missing");
      if (value.taskFence && ownership?.owner?.account_id !== value.taskFence.accountId)
        throw new EvidencePersistenceError("account_evidence_schema_or_owner_invalid");
      const [artifactScope] = await connection.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM browser_evidence_artifacts WHERE Field IN ('organization_id','workspace_id')",
      );
      if (artifactScope.length === 1)
        throw new EvidencePersistenceError("partial_inherited_scope_schema:browser_evidence_artifacts");
      const legacyArtifactScope = artifactScope.length === 2;
      if (legacyArtifactScope && value.taskFence)
        throw new EvidencePersistenceError("account_evidence_schema_or_owner_invalid");
      if (!legacyArtifactScope) {
        const [jobs] = await connection.query<RowDataPacket[]>(
          "SELECT j.id FROM browser_collection_jobs j JOIN collection_tasks t ON t.id=j.collection_task_id WHERE j.id=? AND j.collection_task_id=? " +
            "AND j.collection_subquery_id=? AND j.provider_id=? " +
            (value.taskFence ? "" : "AND t.organization_id=? AND t.workspace_id=? ") + "FOR UPDATE",
          [value.browserJobId, value.taskId, value.subqueryId, value.providerId,
            ...(value.taskFence ? [] : [value.organizationId, value.workspaceId])],
        );
        if (!jobs.length) throw new EvidencePersistenceError("browser_evidence_scope_mismatch");
      }
      const [existing] = await connection.query<RowDataPacket[]>(
        accountFiles
          ? "SELECT id,content_sha256,file_asset_id FROM browser_evidence_artifacts WHERE browser_job_id=? AND kind=? FOR UPDATE"
          : "SELECT id,content_sha256 FROM browser_evidence_artifacts WHERE browser_job_id=? AND kind=? FOR UPDATE",
        [value.browserJobId, value.kind],
      );
      if (existing[0]) {
        if (String(existing[0].content_sha256) !== value.contentHash)
          throw new EvidencePersistenceError("browser_evidence_conflict");
        if (accountFiles) await this.verifyEvidenceOwners(connection, ownership, [
          ["browser_evidence_artifacts", String(existing[0].id)],
          ["file_assets", String(existing[0].file_asset_id)],
        ]);
        if (accountFiles) await this.requireOwnedFileAsset(connection, ownership!.owner!.account_id, String(existing[0].file_asset_id));
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
      const accountPath = accountFiles ? accountEvidenceRelativePath({
        account_id: ownership!.owner!.account_id, asset_id: fileAssetId, evidence_id: artifactId,
      }) : null;
      target = accountPath ? resolve(this.evidenceRoot, accountPath) : buildScopedFilePath(this.evidenceRoot, fileInput);
      if (accountPath) await writeAccountEvidenceFile(this.evidenceRoot, accountPath, value.content);
      else await writeScopedFile(this.evidenceRoot, fileInput, value.content);
      const now = this.now(),
        retentionUntil = new Date(value.capturedAt.getTime() + retentionDays * 86400000),
        relativePath = relative(resolve(this.evidenceRoot), target).split(sep).join("/");
      await this.insertEvidenceFile(connection, value, fileAssetId, relativePath, now, ownership?.owner);
      await this.registerEvidenceOwners(connection, ownership?.owner, [
        ["file_assets",fileAssetId], ["browser_evidence_artifacts",artifactId],
      ]);
      await connection.query(
        [
          "INSERT INTO browser_evidence_artifacts (id,",
          legacyArtifactScope ? "organization_id,workspace_id," : "",
          "collection_task_id,",
          "collection_subquery_id,provider_id,browser_job_id,file_asset_id,kind,source_url,content_type,",
          "content_sha256,size_bytes,captured_at,parser_version,retention_until,status,request_id,trace_id,",
          "created_by,created_at) VALUES (?,",
          legacyArtifactScope ? "?,?," : "",
          "?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?,?)",
        ].join(""),
        [
          artifactId,
          ...(legacyArtifactScope ? [value.organizationId, value.workspaceId] : []),
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
      const owner = await this.reconciliationOwner(connection, input.organizationId, input.workspaceId);
      const [columns] = owner ? await connection.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM reconciliation_runs WHERE Field IN ('organization_id','workspace_id','historical_context')",
      ) : [[]];
      const shape = columns.map(row => row.Field).sort().join(",");
      if (owner && shape !== "historical_context" && shape !== "organization_id,workspace_id")
        throw new EvidencePersistenceError("reconciliation_scope_schema_incomplete");
      const historical = shape === "historical_context";
      const refs: OwnershipRef[] = [["reconciliation_runs", runId]];
      await connection.query(
        [
          "INSERT INTO reconciliation_runs (id," +
            (historical ? "historical_context," : "organization_id,workspace_id,") + "provider_id,parser_version,market,",
          "window_started_at,window_ended_at,sample_count,metrics_json,status,request_id,trace_id,created_by,",
          "created_at) VALUES (" + (historical ? "" : "?,") + "?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          runId,
          ...(historical ? [JSON.stringify({ organization_id: input.organizationId, workspace_id: input.workspaceId })] :
            [input.organizationId, input.workspaceId]),
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
      const issues = metrics.filter((item) => item.status !== "passed");
      const issueScope = issues.length ? await dataQualityIssueScope(connection, Boolean(owner)) : null;
      for (const metric of issues) {
        if (!issueScope) throw new Error("data_quality_issue_scope_missing");
        const issueId = randomUUID();
        await connection.query(
          [
            `INSERT INTO data_quality_issues (id,${issueScope.columns},provider_id,reconciliation_run_id,`,
            "raw_evidence_id,normalized_record_id,metric_code,field_path,severity,status,actual_value,",
            "threshold_value,details_json,resolved_by,resolution_reason,resolved_at,request_id,trace_id,version,",
            `created_at,updated_at) VALUES (?,${issueScope.placeholders},?,?,NULL,NULL,?,NULL,?,'open',?,?,?,NULL,NULL,NULL,?,?,1,?,?)`,
          ].join(""),
          [
            issueId,
            ...issueScope.values(input.organizationId, input.workspaceId),
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
        const eventId = await this.event(
          connection,
          input,
          "data_quality.issue.opened",
          "data_quality_issue",
          issueId,
          { metric_code: metric.code, status: metric.status },
          now,
        );
        const outboxId = await this.outbox(
          connection,
          input,
          "data_quality.issue.opened",
          "data_quality_issue",
          issueId,
          { issue_id: issueId, metric_code: metric.code },
          now,
        );
        refs.push(["data_quality_issues", issueId], ["evidence_data_events", eventId], ["evidence_data_outbox", outboxId]);
      }
      const runEventId = await this.event(
        connection,
        input,
        "data_quality.reconciled",
        "reconciliation_run",
        runId,
        { status, sample_count: sampleCount },
        now,
      );
      await this.registerEvidenceOwners(connection, owner, [...refs, ["evidence_data_events", runEventId]]);
      await connection.commit();
      return { id: runId, status, sample_count: sampleCount, metrics };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async reconciliationOwner(connection: PoolConnection, organizationId: string, workspaceId: string) {
    let rows: RowDataPacket[];
    try {
      [rows] = await connection.query<RowDataPacket[]>(
        "SELECT cut.primary_account_id,s.account_id,s.reason FROM account_ownership_cutover cut " +
          "LEFT JOIN account_retirement_scopes s ON s.run_id=cut.source_run_id " +
          "AND s.legacy_org_id=? AND s.legacy_workspace_id=? " +
          "WHERE cut.slot='current' AND cut.contract_version=25 LOCK IN SHARE MODE",
        [organizationId, workspaceId],
      );
    } catch (error) {
      const mysql = error as { code?: string; sqlMessage?: string };
      if (mysql.code === "ER_NO_SUCH_TABLE" &&
        /\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "")) return null;
      throw error;
    }
    const row = rows[0];
    if (!row) return null;
    if (!row.account_id || (row.reason !== "exclusive_owner" && (
      (row.reason !== "shared" && row.reason !== "unassigned") || row.account_id !== row.primary_account_id
    ))) throw new EvidencePersistenceError("reconciliation_owner_mismatch");
    return { account_id: row.account_id, reason: row.reason } as EvidenceOwner;
  }

  private async validateScope(
    connection: PoolConnection,
    value: {
      taskId: string;
      subqueryId: string;
      organizationId: string;
      workspaceId: string;
      providerId: string;
      taskFence?: EvidenceTaskFence;
    },
  ) {
    const fence = value.taskFence;
    if (fence && (!fence.accountId || !fence.leaseToken))
      throw new EvidencePersistenceError("evidence_scope_or_task_invalid");
    const [rows] = await connection.query<RowDataPacket[]>(
      [
        "SELECT p.retention_days FROM collection_tasks t JOIN collection_subqueries q ON q.task_id=t.id ",
        "JOIN providers p ON p.id=q.provider_id WHERE t.id=? AND q.id=? AND ",
        fence ? "EXISTS (SELECT 1 FROM account_owned_records eo JOIN users eu ON eu.id=eo.account_id AND eu.status='active' " +
          "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
          "JOIN account_owned_records qo ON qo.source_table='collection_subqueries' " +
          "AND qo.account_id=eo.account_id AND (qo.reason='exclusive_owner' OR qo.account_id=cut.primary_account_id) " +
          "WHERE qo.source_id=q.id AND eo.source_table='collection_tasks' AND eo.source_id=t.id AND eo.account_id=t.account_id AND t.account_id=? " +
          "AND (eo.reason='exclusive_owner' OR eo.account_id=cut.primary_account_id) LOCK IN SHARE MODE) " +
          "AND t.status='running' AND t.lease_token_hash=UNHEX(?) AND t.lease_expires_at>NOW(3) AND "
          : "t.organization_id=? AND t.workspace_id=? AND ",
        "q.provider_id=? FOR UPDATE",
      ].join(""),
      [
        value.taskId,
        value.subqueryId,
        ...(fence ? [fence.accountId, createHash("sha256").update("scoutops:collection-task-lease:v1\0")
          .update(fence.leaseToken).digest("hex")] : [value.organizationId, value.workspaceId]),
        value.providerId,
      ],
    );
    if (!rows[0]) throw new EvidencePersistenceError("evidence_scope_or_task_invalid");
    return Number(rows[0].retention_days);
  }

  private async hasAccountEvidenceColumns(connection: PoolConnection) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name FROM information_schema.COLUMNS " +
      "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('raw_evidence','normalized_records') " +
      "AND COLUMN_NAME IN ('account_id','organization_id','workspace_id')",
    );
    const shapes = ["raw_evidence", "normalized_records"].map(table =>
      rows.filter(row => row.table_name === table).map(row => row.column_name).sort().join(","));
    if (shapes.every(shape => shape === "account_id")) return true;
    if (shapes.every(shape => shape === "organization_id,workspace_id")) return false;
    throw new EvidencePersistenceError("evidence_scope_schema_invalid");
  }

  private async findExisting(connection: PoolConnection, value: ValidatedEvidence, accountFiles: boolean, accountScope: string | null) {
    const scope = accountFiles ? "t" : "e";
    const [rows] = await connection.query<ExistingEvidence[]>(
      [
        "SELECT e.id evidence_id,e.file_asset_id,e.content_sha256,e.canonical_url,e.parser_version,e.adapter_version,",
        "n.id record_id,n.schema_version,n.payload_json normalized_payload FROM raw_evidence e JOIN ",
        "normalized_records n ON n.raw_evidence_id=e.id AND n.status='active' ",
        ...(accountFiles && !accountScope ? ["JOIN collection_tasks t ON t.id=e.collection_task_id AND n.provider_id=e.provider_id "] : []),
        accountScope ? "WHERE e.account_id=? AND n.account_id=e.account_id AND n.provider_id=e.provider_id AND " :
          `WHERE ${scope}.organization_id=? AND ${scope}.workspace_id=? AND `,
        "e.provider_id=? AND e.dedupe_key=? ",
        "ORDER BY n.record_version DESC,n.created_at DESC,",
        "n.id DESC LIMIT 1 FOR UPDATE",
      ].join(""),
      [...(accountScope ? [accountScope] : [value.organizationId, value.workspaceId]), value.providerId, value.dedupeKey],
    );
    return rows[0] ?? null;
  }

  private async insertEvidenceFile(connection: PoolConnection, value: {
    organizationId: string; workspaceId: string; actorId: string; contentHash: string; content: Uint8Array;
  }, fileId: string, path: string, now: Date, owner?: EvidenceOwner | null) {
    const scope = owner ? "account_id" : "organization_id,workspace_id";
    await connection.query(
      `INSERT INTO file_assets (id,${scope},category,relative_path,content_sha256,size_bytes,status,created_by,created_at,updated_at) VALUES (?,${owner ? "?" : "?,?"},'evidence',?,?,?,'active',?,?,?)`,
      [fileId, ...(owner ? [owner.account_id] : [value.organizationId,value.workspaceId]), path,
        value.contentHash,value.content.byteLength,value.actorId,now,now],
    );
  }

  private async taskOwnership(connection: PoolConnection, taskId: string) {
    let rows: RowDataPacket[];
    try {
      [rows] = await connection.query<RowDataPacket[]>(
        "SELECT cut.primary_account_id,o.account_id,o.reason FROM account_ownership_cutover cut " +
          "LEFT JOIN account_owned_records o ON o.source_table='collection_tasks' AND o.source_id=? " +
          "WHERE cut.slot='current' AND cut.contract_version=25 LOCK IN SHARE MODE",
        [taskId],
      );
    } catch (error) {
      const mysql = error as { code?: string; sqlMessage?: string };
      if (mysql.code === "ER_NO_SUCH_TABLE" &&
        /\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "")) return null;
      throw error;
    }
    const row = rows[0];
    if (!row) return null;
    if (!row.account_id) return { owner: null };
    if (row.reason !== "exclusive_owner" && (
      (row.reason !== "shared" && row.reason !== "unassigned") || row.account_id !== row.primary_account_id
    )) throw new EvidencePersistenceError("evidence_task_owner_mismatch");
    return { owner: { account_id: row.account_id, reason: row.reason } as EvidenceOwner };
  }

  private async verifyEvidenceOwners(
    connection: PoolConnection,
    ownership: { owner: EvidenceOwner | null } | null,
    refs: OwnershipRef[],
  ) {
    if (!ownership) return;
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT source_table,source_id,account_id FROM account_owned_records WHERE (source_table,source_id) IN (?) LOCK IN SHARE MODE",
      [refs],
    );
    if (ownership.owner
      ? rows.length !== refs.length || rows.some((row) => row.account_id !== ownership.owner?.account_id)
      : rows.length > 0)
      throw new EvidencePersistenceError("evidence_reference_owner_mismatch");
  }

  private async registerEvidenceOwners(
    connection: PoolConnection,
    owner: EvidenceOwner | null | undefined,
    refs: OwnershipRef[],
  ) {
    if (!owner) return;
    await connection.query(
      "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ?",
      [refs.map(([table, id]) => [table, id, owner.account_id, owner.reason])],
    );
  }

  private async findExistingRecord(connection: PoolConnection, value: ValidatedEvidence, accountFiles: boolean, accountScope: string | null) {
    const [rows] = await connection.query<ExistingRecord[]>(
      accountScope ? [
        "SELECT n.id record_id,n.record_version FROM normalized_records n ",
        "JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id AND e.account_id=n.account_id ",
        "WHERE n.account_id=? AND n.provider_id=? AND n.record_key=? AND n.status='active' ",
        "ORDER BY n.record_version DESC,n.created_at DESC,n.id DESC LIMIT 1 FOR UPDATE",
      ].join("") : accountFiles ? [
        "SELECT n.id record_id,n.record_version FROM normalized_records n ",
        "JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id ",
        "JOIN collection_tasks t ON t.id=e.collection_task_id WHERE t.organization_id=? AND t.workspace_id=? ",
        "AND n.provider_id=? AND n.record_key=? AND n.status='active' ",
        "ORDER BY n.record_version DESC,n.created_at DESC,n.id DESC LIMIT 1 FOR UPDATE",
      ].join("") : [
        "SELECT id record_id,record_version FROM normalized_records WHERE organization_id=? AND workspace_id=? ",
        "AND provider_id=? AND record_key=? AND status='active' ORDER BY record_version DESC,created_at DESC,id DESC ",
        "LIMIT 1 FOR UPDATE",
      ].join(""),
      [...(accountScope ? [accountScope] : [value.organizationId, value.workspaceId]), value.providerId, value.recordKey],
    );
    return rows[0] ?? null;
  }

  private async linkExisting(
    connection: PoolConnection,
    value: ValidatedEvidence,
    existing: ExistingEvidence,
    now: Date,
    ownership: { owner: EvidenceOwner | null } | null,
    accountFiles: boolean,
  ) {
    await this.verifyEvidenceOwners(connection, ownership, [
      ["raw_evidence", existing.evidence_id], ["normalized_records", existing.record_id],
      ...(accountFiles ? [["file_assets", existing.file_asset_id] as const] : []),
    ]);
    if (accountFiles) await this.requireOwnedFileAsset(connection, ownership!.owner!.account_id, existing.file_asset_id);
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
      ownership,
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
      const ownership = await this.taskOwnership(connection, value.taskId);
      const accountFiles = await fileAssetAccountStorage(connection);
      if (accountFiles && !ownership?.owner) throw new EvidencePersistenceError("evidence_task_owner_missing");
      const accountScope = accountFiles && await this.hasAccountEvidenceColumns(connection)
        ? ownership!.owner!.account_id : null;
      if (value.taskFence && accountScope !== value.taskFence.accountId)
        throw new EvidencePersistenceError("account_evidence_schema_or_owner_invalid");
      const existing = await this.findExisting(connection, value, accountFiles, accountScope);
      if (!existing) throw originalError;
      const result = await this.linkExisting(connection, value, existing, this.now(), ownership, accountFiles);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async requireOwnedFileAsset(connection: PoolConnection, accountId: string, assetId: string) {
    if (!assetId) throw new EvidencePersistenceError("evidence_reference_owner_mismatch");
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM file_assets WHERE id=? AND account_id=? AND category='evidence' LOCK IN SHARE MODE",
      [assetId, accountId],
    );
    if (rows.length !== 1) throw new EvidencePersistenceError("evidence_reference_owner_mismatch");
  }

  private async link(
    connection: PoolConnection,
    value: ValidatedEvidence,
    evidenceId: string,
    recordId: string,
    linkType: "captured" | "deduplicated",
    now: Date,
    ownership: { owner: EvidenceOwner | null } | null,
    observation?: Record<string, unknown>,
  ) {
    const linkId = randomUUID();
    let newOwnedLink = false;
    if (ownership) {
      const [existing] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM collection_task_evidence_links WHERE collection_task_id=? AND raw_evidence_id=? FOR UPDATE",
        [value.taskId, evidenceId],
      );
      if (existing[0])
        await this.verifyEvidenceOwners(connection, ownership, [["collection_task_evidence_links", String(existing[0].id)]]);
      else
        newOwnedLink = !!ownership.owner;
    }
    const [result] = await connection.query<ResultSetHeader>(
      [
        "INSERT INTO collection_task_evidence_links (id,collection_task_id,",
        "collection_subquery_id,provider_id,raw_evidence_id,normalized_record_id,link_type,request_id,trace_id,",
        "created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        newOwnedLink ? "" : " ON DUPLICATE KEY UPDATE id=id",
      ].join(""),
      [
        linkId,
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
    if (newOwnedLink)
      await this.registerEvidenceOwners(connection, ownership?.owner, [["collection_task_evidence_links", linkId]]);
    if (linkType === "deduplicated" && result.affectedRows > 0) {
      const payload = {
        collection_task_id: value.taskId,
        collection_subquery_id: value.subqueryId,
        normalized_record_id: recordId,
        link_type: linkType,
        ...observation,
      };
      const eventId = await this.event(
        connection,
        value,
        "evidence.linked",
        "raw_evidence",
        evidenceId,
        payload,
        now,
      );
      const outboxId = await this.outbox(
        connection,
        value,
        "evidence.linked",
        "raw_evidence",
        evidenceId,
        payload,
        now,
      );
      await this.registerEvidenceOwners(connection, ownership?.owner, [
        ["evidence_data_events", eventId], ["evidence_data_outbox", outboxId],
      ]);
    }
  }

  private async event(
    connection: PoolConnection,
    input: {
      taskFence?: EvidenceTaskFence;
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
    const id = randomUUID();
    await appendEvidenceDataEvent(connection, {
      id,
      requireInheritedScope: Boolean(input.taskFence),
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actorType: "worker",
      eventType,
      resourceType,
      resourceId,
      actorId: input.actorId,
      requestId: input.requestId,
      traceId: input.traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
    return id;
  }

  private async outbox(
    connection: PoolConnection,
    input: { organizationId: string; workspaceId: string; requestId: string; traceId: string; taskFence?: EvidenceTaskFence },
    eventType: string,
    resourceType: string,
    resourceId: string,
    payload: unknown,
    now: Date,
  ) {
    const id = randomUUID();
    await appendEvidenceDataOutbox(connection, {
      id,
      requireInheritedScope: Boolean(input.taskFence),
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType, resourceType, resourceId,
      payloadJson: JSON.stringify(payload),
      requestId: input.requestId,
      traceId: input.traceId,
      createdAt: now,
    });
    return id;
  }
}
