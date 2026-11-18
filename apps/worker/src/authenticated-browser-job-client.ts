import { createHash, randomUUID } from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  ProviderAdapterFailure,
  type ProviderRawRecord,
  type ProviderRuntimeDefinition,
} from "@scoutops/provider-adapters";
import {
  create1688BrowserExecutionRequest,
  createAmazonBrowserExecutionRequest,
  parseAmazonBrowserRunResult,
  parseAmazonBrowserEvidenceArtifacts,
  parseBrowserEvidenceArtifacts,
  parse1688BrowserRunResult,
  type BrowserEvidenceArtifactContract,
} from "@scoutops/provider-sources";

interface BrowserJobInput {
  accountId?: string;
  organizationId: string;
  workspaceId: string;
  taskId: string;
  subqueryId: string;
  provider: ProviderRuntimeDefinition;
  target: Record<string, unknown>;
  requestId: string;
  traceId: string;
  attemptCount?: number;
  leaseToken?: string;
  onHistoricalResult?: () => void;
}

export interface AuthenticatedBrowserCollection {
  browserJobId: string;
  records: ProviderRawRecord[];
  artifacts: BrowserEvidenceArtifactContract[];
  parseError: ProviderAdapterFailure | null;
}

const requestFor = (
  provider: ProviderRuntimeDefinition,
  target: Record<string, unknown>,
  deliveryPostalCode: string,
) => {
  if (provider.code === "1688_search") return create1688BrowserExecutionRequest(target);
  if (provider.code === "amazon_product")
    return createAmazonBrowserExecutionRequest(target, deliveryPostalCode);
  throw new ProviderAdapterFailure("adapter_not_registered", false);
};

const recordsFor = (
  provider: ProviderRuntimeDefinition,
  result: Record<string, unknown>,
  target: Record<string, unknown>,
): ProviderRawRecord[] => {
  if (provider.code === "amazon_product") return parseAmazonBrowserRunResult(result, target);
  if (provider.code === "1688_search")
    return parse1688BrowserRunResult(
      result as { status: string; error_code: string | null; snapshots?: unknown },
    );
  throw new ProviderAdapterFailure("adapter_not_registered", false);
};

/** A browser job inherits its live boundary from the exact collection task and subquery. */
function browserTaskScope(input: BrowserJobInput, alias: "t" | "parent") {
  if (input.accountId === undefined) {
    return {
      sql: `${alias}.organization_id=? AND ${alias}.workspace_id=?`,
      values: [input.organizationId, input.workspaceId],
    };
  }
  if (!input.leaseToken || !input.accountId.trim())
    throw new ProviderAdapterFailure("permission_denied", false);
  return {
    sql:
      "EXISTS (SELECT 1 FROM account_owned_records browser_owner " +
      "JOIN account_ownership_cutover browser_cut ON browser_cut.slot='current' AND browser_cut.contract_version=25 " +
      "JOIN users browser_account ON browser_account.id=browser_owner.account_id AND browser_account.status='active' " +
      "WHERE browser_owner.source_table='collection_tasks' " +
      `AND browser_owner.source_id=${alias}.id AND browser_owner.account_id=${alias}.account_id AND browser_owner.account_id=? ` +
      "AND (browser_owner.reason='exclusive_owner' OR browser_owner.account_id=browser_cut.primary_account_id)) " +
      `AND ${alias}.status='running' AND ${alias}.lease_token_hash=UNHEX(?) AND ${alias}.lease_expires_at>NOW(3)`,
    values: [
      input.accountId,
      createHash("sha256")
        .update("scoutops:collection-task-lease:v1\0")
        .update(input.leaseToken)
        .digest("hex"),
    ],
  };
}

export class MySqlAuthenticatedBrowserJobClient {
  constructor(
    private readonly pool: Pool,
    private readonly pollMs = 500,
    private readonly wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    private readonly runTimeoutMs = 180_000,
    private readonly deliveryPostalCode = "94404",
  ) {}

  async collect(
    input: BrowserJobInput,
    heartbeat: () => Promise<void>,
    signal?: AbortSignal,
  ): Promise<AuthenticatedBrowserCollection> {
    const executionRequest = requestFor(input.provider, input.target, this.deliveryPostalCode),
      jobId = randomUUID(),
      started = Date.now(),
      deadline =
        started + Math.max(1_000, input.provider.timeoutMs + 10_000, this.runTimeoutMs + 10_000);
    const [columns] = await this.pool.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM browser_collection_jobs WHERE Field IN ('organization_id','workspace_id')",
    );
    if (columns.length !== 0 && columns.length !== 2)
      throw new Error("partial_inherited_scope_schema:browser_collection_jobs");
    const legacy = columns.length === 2;
    const taskScope = browserTaskScope(input, "t"),
      parentScope = browserTaskScope(input, "parent");
    if (legacy && input.accountId !== undefined)
      throw new Error("account_browser_job_parent_schema_required");
    await this.pool.query<ResultSetHeader>(
      [
        `INSERT INTO browser_collection_jobs (id,${legacy ? "organization_id,workspace_id," : ""}collection_task_id,collection_s`,
        "ubquery_id,provider_id,crawler_profile_id,crawler_run_id,status,execution_request_json,result_json,e",
        "rror_code,lease_owner,lease_token_hash,leased_at,heartbeat_at,lease_expires_at,request_id,trace_id,c",
        "reated_at,updated_at,finished_at) ",
        `SELECT ?,${legacy ? "t.organization_id,t.workspace_id," : ""}t.id,s.id,s.provider_id,NULL,NULL,'queued',?,NULL,NULL,NULL,NULL,NULL,NULL,NULL,?,?,NOW(3),NOW(3),NULL `,
        "FROM collection_tasks t JOIN collection_subqueries s ON s.task_id=t.id ",
        `WHERE t.id=? AND s.id=? AND s.provider_id=? AND ${taskScope.sql} ON `,
        "DUPLICATE KEY UPDATE execution_request_json=IF(browser_collection_jobs.status='queued'",
        input.accountId === undefined
          ? ""
          : " AND browser_collection_jobs.collection_task_id=VALUES(collection_task_id) " +
            "AND browser_collection_jobs.provider_id=VALUES(provider_id)",
        ",VALUES(execution_request_json),browser_collection_jobs.execution_request_json)," +
          "updated_at=browser_collection_jobs.updated_at",
      ].join(""),
      [
        jobId,
        JSON.stringify(executionRequest),
        input.requestId,
        input.traceId,
        input.taskId,
        input.subqueryId,
        input.provider.id,
        ...taskScope.values,
      ],
    );
    if (
      input.provider.code === "amazon_product" &&
      input.leaseToken &&
      Number.isInteger(input.attemptCount) &&
      input.attemptCount! >= 2 &&
      input.attemptCount! <= 4
    ) {
      signal?.throwIfAborted();
      await heartbeat();
      // A retry is a new browser execution, not another read of the previous failure.
      // Fence it to the current parent lease and a failure completed before this attempt.
      await this.pool.query(
        "UPDATE browser_collection_jobs j JOIN collection_tasks t ON t.id=j.collection_task_id " +
          "JOIN collection_task_attempts a ON a.task_id=t.id AND a.attempt_number=t.attempt_count " +
          "JOIN collection_task_attempts previous ON previous.task_id=t.id " +
          "AND previous.attempt_number=t.attempt_count-1 " +
          "SET j.execution_request_json=?,j.status='queued',j.crawler_profile_id=NULL,j.crawler_run_id=NULL,j.result_json=NULL," +
          "j.error_code=NULL,j.lease_owner=NULL,j.lease_token_hash=NULL,j.leased_at=NULL," +
          "j.heartbeat_at=NULL,j.lease_expires_at=NULL,j.finished_at=NULL,j.updated_at=NOW(3) " +
          `WHERE ${taskScope.sql} AND j.collection_task_id=? ` +
          "AND j.collection_subquery_id=? AND j.provider_id=? " +
          "AND ((j.status IN ('failed','timed_out') " +
          "AND j.error_code IN ('timeout','network_error','rate_limited','dependency_unavailable','worker_wait_timeout')) " +
          "OR (j.status='cancelled' AND j.error_code='worker_shutdown_cancelled')) " +
          "AND t.status='running' AND t.lease_token_hash=UNHEX(?) AND t.lease_expires_at>NOW(3) " +
          "AND t.attempt_count=? AND a.status='running' AND a.started_at>j.finished_at " +
          "AND previous.status IN ('retry_scheduled','rate_limited') " +
          "AND previous.error_code IN ('timeout','network_error','rate_limited')",
        [
          JSON.stringify(executionRequest),
          ...taskScope.values,
          input.taskId,
          input.subqueryId,
          input.provider.id,
          createHash("sha256")
            .update("scoutops:collection-task-lease:v1\0")
            .update(input.leaseToken)
            .digest("hex"),
          input.attemptCount,
        ],
      );
    }
    while (Date.now() <= deadline) {
      if (signal?.aborted) {
        await this.pool.query(
          [
            "UPDATE browser_collection_jobs j JOIN collection_tasks t ON t.id=j.collection_task_id ",
            "LEFT JOIN crawler_browser_runs r ON r.id=j.crawler_run_id AND r.crawler_profile_id=j.crawler_profile_id ",
            "AND r.provider_id=j.provider_id AND r.status='running' ",
            "SET j.status='cancelled',j.error_code='worker_shutdown_cancelled',j.finished_at=NOW(3),j.updated_at=NOW(3),",
            "r.status='cancelled',r.error_code='worker_shutdown_cancelled',r.finished_at=NOW(3) ",
            "WHERE j.collection_subquery_id=? AND j.collection_task_id=? AND j.provider_id=? ",
            `AND ${taskScope.sql} AND j.status IN ('queued','leased','running')`,
          ].join(""),
          [input.subqueryId, input.taskId, input.provider.id, ...taskScope.values],
        );
        throw new ProviderAdapterFailure("dependency_unavailable", true);
      }
      await heartbeat();
      const inspectHistory =
        input.provider.code === "amazon_product" &&
        input.leaseToken &&
        Number.isInteger(input.attemptCount) &&
        input.onHistoricalResult;
      const [rows] = await this.pool.query<RowDataPacket[]>(
        inspectHistory
          ? [
              "SELECT j.id,j.status,j.result_json,j.error_code,EXISTS(SELECT 1 FROM collection_tasks t ",
              "JOIN collection_task_attempts a ON a.task_id=t.id AND a.attempt_number=t.attempt_count ",
              "WHERE t.id=j.collection_task_id AND t.status='running' ",
              "AND t.lease_token_hash=UNHEX(?) AND t.lease_expires_at>NOW(3) ",
              "AND t.attempt_count=? AND a.status='running' AND a.started_at>j.finished_at) historical_result ",
              "FROM browser_collection_jobs j JOIN collection_tasks parent ON parent.id=j.collection_task_id ",
              `WHERE j.collection_subquery_id=? AND ${parentScope.sql} `,
              "AND j.collection_task_id=? AND j.provider_id=? LIMIT 1",
            ].join("")
          : "SELECT j.id,j.status,j.result_json,j.error_code FROM browser_collection_jobs j " +
              "JOIN collection_tasks parent ON parent.id=j.collection_task_id WHERE j.collection_subquery_id=? " +
              `AND ${parentScope.sql} AND j.collection_task_id=? AND j.provider_id=? LIMIT 1`,
        inspectHistory
          ? [
              createHash("sha256")
                .update("scoutops:collection-task-lease:v1\0" + input.leaseToken)
                .digest("hex"),
              input.attemptCount,
              input.subqueryId,
              ...parentScope.values,
              input.taskId,
              input.provider.id,
            ]
          : [input.subqueryId, ...parentScope.values, input.taskId, input.provider.id],
      );
      const row = rows[0];
      if (!row) throw new ProviderAdapterFailure("dependency_unavailable", true);
      if (
        inspectHistory &&
        Number(row.historical_result) === 1 &&
        ["succeeded", "succeeded_empty", "blocked", "failed", "timed_out", "cancelled"].includes(
          String(row.status),
        )
      )
        input.onHistoricalResult!();
      if (["succeeded", "succeeded_empty"].includes(String(row.status))) {
        const result =
            typeof row.result_json === "string" ? JSON.parse(row.result_json) : row.result_json,
          artifacts =
            input.provider.code === "amazon_product"
              ? parseAmazonBrowserEvidenceArtifacts((result as Record<string, unknown>).artifacts)
              : parseBrowserEvidenceArtifacts((result as Record<string, unknown>).artifacts);
        let records: ProviderRawRecord[] = [],
          parseError: ProviderAdapterFailure | null = null;
        try {
          records = recordsFor(input.provider, result as Record<string, unknown>, input.target);
        } catch (error) {
          if (!(error instanceof ProviderAdapterFailure)) throw error;
          parseError = error;
        }
        return {
          browserJobId: String(row.id),
          records,
          artifacts,
          parseError,
        };
      }
      if (["blocked", "failed", "timed_out", "cancelled"].includes(String(row.status))) {
        const errorCode = String(
          row.error_code ?? (row.status === "timed_out" ? "timeout" : "dependency_unavailable"),
        );
        // Browser rows retain their raw crawler code; collection tasks use the canonical code.
        if (errorCode === "blocked_captcha") throw new ProviderAdapterFailure("captcha", false);
        if (input.provider.code === "amazon_product") {
          if (errorCode === "worker_wait_timeout")
            throw new ProviderAdapterFailure("timeout", true);
          if (errorCode === "worker_shutdown_cancelled")
            throw new ProviderAdapterFailure("dependency_unavailable", true);
        }
        throw new ProviderAdapterFailure(
          errorCode,
          input.provider.code === "amazon_product"
            ? ["timeout", "network_error", "rate_limited", "dependency_unavailable"].includes(
                errorCode,
              )
            : ["failed", "timed_out"].includes(String(row.status)),
        );
      }
      await this.wait(this.pollMs);
    }
    await this.pool.query(
      [
        "UPDATE browser_collection_jobs j JOIN collection_tasks t ON t.id=j.collection_task_id ",
        "SET j.status='timed_out',j.error_code='worker_wait_timeout',j.finished_at=NOW(3),j.updated_at=NOW(3) ",
        "WHERE j.collection_subquery_id=? AND j.collection_task_id=? AND j.provider_id=? ",
        `AND ${taskScope.sql} AND j.status='queued'`,
      ].join(""),
      [input.subqueryId, input.taskId, input.provider.id, ...taskScope.values],
    );
    throw new ProviderAdapterFailure("timeout", true);
  }
}
