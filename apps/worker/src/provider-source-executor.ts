import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  classifyProviderAdapterFailure,
  ProviderAdapterFailure,
  type ProviderAdapterRegistry,
  type ProviderRuntimeDefinition,
} from "@scoutops/provider-adapters";
import {
  assertPublicCollectionPolicy,
  publicCollectionPolicyDecision,
  sourceEvidencePayload,
  type RobotsPolicyDecision,
} from "@scoutops/provider-sources";
import type {
  CollectionErrorCode,
  CollectionResultKind,
  SubqueryOutcome,
} from "@scoutops/collection-tasks";
import {
  CollectionExecutionError,
  type ClaimedCollectionTask,
  type CollectionTaskExecutor,
} from "./collection-task-worker.js";
import { EvidencePersistenceError, MySqlEvidencePersistence } from "./evidence-persistence.js";
import type { MySqlAuthenticatedBrowserJobClient } from "./authenticated-browser-job-client.js";
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const VERSIONED_PRODUCT_SOURCES = new Set([
  "amazon_product",
  "dhgate_supplier_search",
  "made_in_china_search",
  "ec21_supplier_search",
]);
const codes = new Set<CollectionErrorCode>([
  "network_error",
  "timeout",
  "dns_error",
  "login_required",
  "session_expired",
  "captcha",
  "rate_limited",
  "robots_disallowed",
  "source_changed",
  "parse_failed",
  "validation_failed",
  "empty_result",
  "permission_denied",
  "source_circuit_open",
]);
const code = (value: string): CollectionErrorCode =>
  codes.has(value as CollectionErrorCode)
    ? (value as CollectionErrorCode)
    : value.includes("parse") || value.includes("payload")
      ? "parse_failed"
      : "validation_failed";
type PersistedSubqueryOutcome = SubqueryOutcome & {
  id: string;
  resultKind?: CollectionResultKind;
  freshResultCount?: number;
  deduplicatedResultCount?: number;
  robotsDecision?: RobotsPolicyDecision;
};
class ProviderCollectionExecutionError extends CollectionExecutionError {
  constructor(
    code: CollectionErrorCode,
    rateLimitResetAt?: Date,
    readonly robotsDecision?: RobotsPolicyDecision,
  ) {
    super(code, rateLimitResetAt);
  }
}
export class ProviderSourceExecutor implements CollectionTaskExecutor {
  constructor(
    private readonly pool: Pool,
    private readonly registry: ProviderAdapterRegistry,
    private readonly evidence: MySqlEvidencePersistence,
    private readonly workerId: string,
    private readonly browserJobs?: MySqlAuthenticatedBrowserJobClient,
    private readonly publicPolicyFetch?: typeof fetch,
  ) {}
  async execute(task: ClaimedCollectionTask, heartbeat: () => Promise<void>, signal?: AbortSignal) {
    await this.pool.query(
      "UPDATE provider_source_replay_runs SET status='running',updated_at=NOW(3) WHERE task_id=? AND status='scheduled'",
      [task.id],
    );
    const outcomes: PersistedSubqueryOutcome[] = [];
    const taskFailures: CollectionExecutionError[] = [];
    for (const query of task.subqueries) {
      signal?.throwIfAborted();
      await heartbeat();
      let outcome: PersistedSubqueryOutcome;
      try {
        outcome = await this.collect(task, query, heartbeat, signal);
      } catch (error) {
        const failure =
          error instanceof CollectionExecutionError
            ? error
            : new CollectionExecutionError("network_error");
        taskFailures.push(failure);
        outcome = {
          id: query.id,
          required: query.required,
          status: [
            "login_required",
            "session_expired",
            "captcha",
            "robots_disallowed",
            "permission_denied",
          ].includes(failure.code)
            ? "blocked"
            : "failed",
          availableResultCount: 0,
          missingFields: [],
          errorCode: failure.code,
          ...(failure.code === "parse_failed" ? { resultKind: "parse_failed" as const } : {}),
          ...(failure instanceof ProviderCollectionExecutionError && failure.robotsDecision
            ? { robotsDecision: failure.robotsDecision }
            : {}),
        };
      }
      outcomes.push(outcome);
      await this.persistSubqueryOutcome(task, query.providerId, outcome);
    }
    const available = outcomes.reduce((sum, item) => sum + item.availableResultCount, 0),
      failed = outcomes.find((item) => item.status === "failed" || item.status === "blocked"),
      status = failed
        ? available
          ? "completed_with_warnings"
          : failed.status === "blocked"
            ? "blocked"
            : "failed"
        : available
          ? "succeeded"
          : "succeeded_empty";
    await this.pool.query(
      "UPDATE provider_source_replay_runs SET status=?,item_count=?,error_code=?,updated_at=NOW(3) WHERE task_id=?",
      [status, available, failed?.errorCode ?? null, task.id],
    );
    const requiredOutcomeFailure = outcomes.find(
      (outcome) => outcome.required && ["failed", "blocked"].includes(outcome.status),
    );
    if (taskFailures.length || requiredOutcomeFailure) {
      const rateLimit = taskFailures.find((failure) => failure.code === "rate_limited");
      throw (
        rateLimit ??
        taskFailures[0] ??
        new CollectionExecutionError(code(requiredOutcomeFailure?.errorCode ?? "validation_failed"))
      );
    }
    return outcomes;
  }

  private async persistSubqueryOutcome(
    task: ClaimedCollectionTask,
    providerId: string,
    outcome: PersistedSubqueryOutcome,
  ) {
    const connection = await this.pool.getConnection(),
      now = new Date();
    try {
      await connection.beginTransaction();
      await connection.query(
        [
          "UPDATE collection_subqueries SET status=?,available_result_count=?,missing_fields_json=?,",
          "error_code=?,retryable=0,started_at=COALESCE(started_at,?),finished_at=?,version=version+1,",
          "updated_at=? WHERE id=? AND task_id=?",
        ].join(""),
        [
          outcome.status,
          outcome.availableResultCount,
          JSON.stringify(outcome.missingFields),
          outcome.errorCode,
          now,
          now,
          now,
          outcome.id,
          task.id,
        ],
      );
      await connection.query(
        [
          "INSERT INTO collection_task_events(id,task_id,organization_id,workspace_id,event_type,from_status,",
          "to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES(?,?,?,?,",
          "'collection.subquery.completed','running',?,'worker',?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          task.id,
          task.organizationId,
          task.workspaceId,
          outcome.status,
          this.workerId,
          task.requestId,
          task.traceId,
          JSON.stringify({
            subquery_id: outcome.id,
            provider_id: providerId,
            required: outcome.required,
            available_result_count: outcome.availableResultCount,
            error_code: outcome.errorCode,
            result_kind: outcome.resultKind,
            fresh_result_count: outcome.freshResultCount,
            deduplicated_result_count: outcome.deduplicatedResultCount,
            robots_policy_decision: outcome.robotsDecision,
          }),
          now,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  private async collect(
    task: ClaimedCollectionTask,
    query: ClaimedCollectionTask["subqueries"][number],
    heartbeat: () => Promise<void>,
    signal?: AbortSignal,
  ): Promise<PersistedSubqueryOutcome> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
        [
          "SELECT p.id,p.code,p.access_mode,p.target_url,p.parser_version,p.timeout_ms,p.fields_json,p.status",
          ",p.circuit_failure_threshold,c.state runtime_circuit_state",
          ",p.terms_review_status,p.terms_reference_url,p.terms_version,p.terms_expires_at,t",
          ".created_by FROM providers p JOIN collection_tasks t ON t.id=? LEFT JOIN provider_runtime_circuits c ON c.provider_id=p.id WHERE p.id=? LIMIT 1",
        ].join(""),
        [task.id, query.providerId],
      ),
      row = rows[0];
    const acceptanceRun = row?.code === "1688_search" && query.target.acceptance_run === true;
    if (!row || (row.status !== "enabled" && !acceptanceRun)) {
      if (query.required) throw new CollectionExecutionError("permission_denied");
      return {
        id: query.id,
        required: query.required,
        status: "blocked",
        availableResultCount: 0,
        missingFields: [],
        errorCode: "permission_denied",
      };
    }
    const provider: ProviderRuntimeDefinition = {
      id: String(row.id),
      code: String(row.code),
      accessMode: row.access_mode,
      targetUrl: String(row.target_url),
      parserVersion: String(row.parser_version),
      timeoutMs: Number(row.timeout_ms),
      fields: typeof row.fields_json === "string" ? JSON.parse(row.fields_json) : row.fields_json,
    };
    if (row.runtime_circuit_state === "open" && !acceptanceRun)
      return {
        id: query.id,
        required: query.required,
        status: "blocked",
        availableResultCount: 0,
        missingFields: provider.fields,
        errorCode: "source_circuit_open",
      };
    let robotsDecision: RobotsPolicyDecision | undefined;
    try {
      if (["public_page", "public_rss"].includes(provider.accessMode)) {
        if (
          row.terms_review_status !== "approved" ||
          !row.terms_reference_url ||
          !row.terms_version ||
          !row.terms_expires_at ||
          new Date(row.terms_expires_at) <= new Date()
        )
          throw new ProviderAdapterFailure("permission_denied", false);
        if (this.publicPolicyFetch)
          robotsDecision = await assertPublicCollectionPolicy({
            providerTargetUrl: provider.targetUrl,
            target: query.target,
            fetcher: this.publicPolicyFetch,
            timeoutMs: provider.timeoutMs,
          });
      }
      const context = {
          requestId: task.requestId,
          traceId: task.traceId,
          organizationId: task.organizationId,
          workspaceId: task.workspaceId,
          provider,
        },
        browserCollection =
          provider.accessMode === "authenticated_browser"
            ? await this.browserJobs!.collect(
                {
                  organizationId: task.organizationId,
                  workspaceId: task.workspaceId,
                  taskId: task.id,
                  subqueryId: query.id,
                  provider,
                  target: query.target,
                  requestId: task.requestId,
                  traceId: task.traceId,
                },
                heartbeat,
                signal,
              )
            : null,
        batch = browserCollection
          ? { records: browserCollection.records, nextCursor: null }
          : await this.registry.collect({ ...context, target: query.target, limit: 20 });
      if (browserCollection)
        for (const artifact of browserCollection.artifacts)
          await this.evidence.persistBrowserArtifact({
            organizationId: task.organizationId,
            workspaceId: task.workspaceId,
            taskId: task.id,
            subqueryId: query.id,
            providerId: provider.id,
            browserJobId: browserCollection.browserJobId,
            kind: artifact.kind,
            sourceUrl: artifact.source_url,
            contentType: artifact.content_type,
            content: artifact.content,
            contentHash: artifact.content_sha256,
            capturedAt: artifact.captured_at,
            parserVersion: artifact.parser_version,
            requestId: task.requestId,
            traceId: task.traceId,
            actorId: String(row.created_by),
          });
      if (browserCollection?.parseError) throw browserCollection.parseError;
      let available = 0,
        fresh = 0,
        deduplicated = 0,
        hasDedupeConflict = false;
      for (const raw of batch.records) {
        const normalized = this.registry.normalize(provider.code, raw, context),
          source = sourceEvidencePayload(raw),
          provenance = Object.entries(source.source_paths).map(([fieldPath, sourcePath]) => ({
            fieldPath,
            sourcePath,
            transformVersion: provider.parserVersion,
            sourceValueHash: sha(source.fields[fieldPath] ?? null),
          }));
        try {
          const persisted = await this.evidence.persist({
            organizationId: task.organizationId,
            workspaceId: task.workspaceId,
            taskId: task.id,
            subqueryId: query.id,
            providerId: provider.id,
            sourceUrl: source.canonical_url,
            canonicalUrl: normalized.canonical_url ?? source.canonical_url,
            dedupeKey: VERSIONED_PRODUCT_SOURCES.has(provider.code)
              ? sha({ task_id: task.id, external_id: normalized.external_id })
              : normalized.external_id,
            contentType: source.content_type,
            content: Buffer.from(source.raw_content),
            capturedAt: new Date(normalized.observed_at),
            parserVersion: provider.parserVersion,
            adapterVersion: normalized.provenance.adapter_version,
            recordKey: normalized.external_id,
            recordSchemaVersion: "provider-source-v1",
            normalizedPayload: {
              ...normalized.fields,
              canonical_url: normalized.canonical_url,
              observed_at: normalized.observed_at,
              evidence_ref: normalized.evidence_ref,
              worker_id: this.workerId,
            },
            provenance,
            requestId: task.requestId,
            traceId: task.traceId,
            actorId: String(row.created_by),
          });
          available += 1;
          if (persisted.deduplicated) deduplicated += 1;
          else fresh += 1;
        } catch (error) {
          if (
            error instanceof EvidencePersistenceError &&
            error.code === "evidence_dedupe_conflict"
          ) {
            hasDedupeConflict = true;
            continue;
          }
          throw error;
        }
      }
      if (hasDedupeConflict && query.required) {
        await this.recordProviderRuntimeResult(
          provider.id,
          Number(row.circuit_failure_threshold),
          "validation_failed",
        );
        return {
          id: query.id,
          required: true,
          status: "failed",
          availableResultCount: available,
          missingFields: [],
          errorCode: "validation_failed",
          ...(robotsDecision ? { robotsDecision } : {}),
        };
      }
      await this.recordProviderRuntimeResult(
        provider.id,
        Number(row.circuit_failure_threshold),
        null,
      );
      const noNewRssContent = provider.accessMode === "public_rss" && available > 0 && fresh === 0,
        emptyRssSuccess = provider.accessMode === "public_rss" && batch.records.length === 0,
        countForTask = noNewRssContent && !query.required ? 0 : available;
      return {
        id: query.id,
        required: query.required,
        status: countForTask ? "succeeded" : "succeeded_empty",
        availableResultCount: countForTask,
        missingFields: [],
        errorCode: null,
        ...(noNewRssContent
          ? { resultKind: "no_new_content" as const }
          : emptyRssSuccess
            ? { resultKind: "empty_success" as const }
            : {}),
        freshResultCount: fresh,
        deduplicatedResultCount: deduplicated,
        ...(robotsDecision ? { robotsDecision } : {}),
      };
    } catch (error) {
      const failure = classifyProviderAdapterFailure(error),
        mapped = code(failure.code),
        policyDecision = robotsDecision ?? publicCollectionPolicyDecision(error) ?? undefined,
        blocked = [
          "login_required",
          "session_expired",
          "captcha",
          "robots_disallowed",
          "permission_denied",
        ].includes(mapped);
      if (provider.accessMode === "public_rss" && mapped === "empty_result") {
        await this.recordProviderRuntimeResult(
          provider.id,
          Number(row.circuit_failure_threshold),
          null,
        );
        return {
          id: query.id,
          required: query.required,
          status: "succeeded_empty",
          availableResultCount: 0,
          missingFields: [],
          errorCode: null,
          resultKind: "empty_success",
          freshResultCount: 0,
          deduplicatedResultCount: 0,
          ...(policyDecision ? { robotsDecision: policyDecision } : {}),
        };
      }
      await this.recordProviderRuntimeResult(
        provider.id,
        Number(row.circuit_failure_threshold),
        mapped,
      );
      if (mapped === "source_changed")
        await this.pauseProviderForParserDrift(task, provider, String(row.created_by), failure);
      if (query.required) {
        if (mapped === "rate_limited")
          throw new ProviderCollectionExecutionError(
            mapped,
            new Date(Date.now() + 300000),
            policyDecision,
          );
        throw new ProviderCollectionExecutionError(mapped, undefined, policyDecision);
      }
      return {
        id: query.id,
        required: query.required,
        status: blocked ? "blocked" : "failed",
        availableResultCount: 0,
        missingFields: provider.fields,
        errorCode: mapped,
        ...(mapped === "parse_failed" ? { resultKind: "parse_failed" as const } : {}),
        ...(policyDecision ? { robotsDecision: policyDecision } : {}),
      };
    }
  }

  private async recordProviderRuntimeResult(
    providerId: string,
    failureThreshold: number,
    errorCode: CollectionErrorCode | null,
  ) {
    const connection = await this.pool.getConnection(),
      now = new Date();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT state,consecutive_failures,opened_at,recovered_at FROM provider_runtime_circuits WHERE provider_id=? FOR UPDATE",
          [providerId],
        ),
        previous = rows[0],
        failures = errorCode ? Number(previous?.consecutive_failures ?? 0) + 1 : 0,
        state = errorCode && failures >= failureThreshold ? "open" : "closed",
        openedAt = state === "open" ? (previous?.opened_at ?? now) : null,
        recoveredAt =
          !errorCode && previous?.state === "open" ? now : (previous?.recovered_at ?? null);
      await connection.query(
        [
          "INSERT INTO provider_runtime_circuits(provider_id,state,consecutive_failures,failure_threshold,",
          "last_error_code,opened_at,recovered_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ",
          "ON DUPLICATE KEY UPDATE state=VALUES(state),consecutive_failures=VALUES(consecutive_failures),",
          "failure_threshold=VALUES(failure_threshold),last_error_code=VALUES(last_error_code),",
          "opened_at=VALUES(opened_at),recovered_at=VALUES(recovered_at),",
          "updated_at=VALUES(updated_at)",
        ].join(""),
        [providerId, state, failures, failureThreshold, errorCode, openedAt, recoveredAt, now],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async pauseProviderForParserDrift(
    task: ClaimedCollectionTask,
    provider: ProviderRuntimeDefinition,
    actorId: string,
    failure: { code: string; retryable: boolean },
  ) {
    const connection = await this.pool.getConnection(),
      now = new Date();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM providers WHERE id=? FOR UPDATE",
          [provider.id],
        ),
        current = rows[0];
      if (!current || current.status !== "enabled") {
        await connection.commit();
        return;
      }
      const nextVersion = Number(current.version) + 1,
        snapshot = {
          ...current,
          status: "disabled",
          version: nextVersion,
          updated_by: actorId,
          updated_at: now.toISOString(),
        };
      await connection.query(
        "UPDATE providers SET status='disabled',version=?,updated_by=?,updated_at=? WHERE id=? AND status='enabled'",
        [nextVersion, actorId, now, provider.id],
      );
      await this.recordProviderPause(
        connection,
        task,
        provider,
        actorId,
        nextVersion,
        snapshot,
        failure,
        now,
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async recordProviderPause(
    connection: PoolConnection,
    task: ClaimedCollectionTask,
    provider: ProviderRuntimeDefinition,
    actorId: string,
    version: number,
    snapshot: Record<string, unknown>,
    failure: { code: string; retryable: boolean },
    now: Date,
  ) {
    await connection.query(
      "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id,action,request_id,trace_id,created_at) VALUES (?,?,?,?,?,'updated',?,?,?)",
      [
        randomUUID(),
        provider.id,
        version,
        JSON.stringify(snapshot),
        actorId,
        task.requestId,
        task.traceId,
        now,
      ],
    );
    await connection.query(
      [
        "INSERT INTO platform_audit_events (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,",
        "outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES ",
        "(?,?,?,?,'provider.parser_drift.auto_paused','provider',?,'succeeded',?,?,?,?,1)",
      ].join(""),
      [
        randomUUID(),
        task.organizationId,
        task.workspaceId,
        actorId,
        provider.id,
        task.requestId,
        task.traceId,
        JSON.stringify({
          provider_code: provider.code,
          parser_version: provider.parserVersion,
          error_code: failure.code,
          retryable: failure.retryable,
        }),
        now,
      ],
    );
  }
}
