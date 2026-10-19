import { createHash, randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
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
    await this.pool.query(
      [
        "INSERT INTO browser_collection_jobs (id,organization_id,workspace_id,collection_task_id,collection_s",
        "ubquery_id,provider_id,crawler_profile_id,crawler_run_id,status,execution_request_json,result_json,e",
        "rror_code,lease_owner,lease_token_hash,leased_at,heartbeat_at,lease_expires_at,request_id,trace_id,c",
        "reated_at,updated_at,finished_at) VALUES ",
        "(?,?,?,?,?,?,NULL,NULL,'queued',?,NULL,NULL,NULL,NULL,NULL,NULL,NULL,?,?,NOW(3),NOW(3),NULL) ON ",
        "DUPLICATE KEY UPDATE execution_request_json=IF(status='queued',VALUES(execution_request_json),execut",
        "ion_request_json),updated_at=updated_at",
      ].join(""),
      [
        jobId,
        input.organizationId,
        input.workspaceId,
        input.taskId,
        input.subqueryId,
        input.provider.id,
        JSON.stringify(executionRequest),
        input.requestId,
        input.traceId,
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
          "AND t.organization_id=j.organization_id AND t.workspace_id=j.workspace_id " +
          "JOIN collection_task_attempts a ON a.task_id=t.id AND a.attempt_number=t.attempt_count " +
          "JOIN collection_task_attempts previous ON previous.task_id=t.id " +
          "AND previous.attempt_number=t.attempt_count-1 " +
          "SET j.execution_request_json=?,j.status='queued',j.crawler_profile_id=NULL,j.crawler_run_id=NULL,j.result_json=NULL," +
          "j.error_code=NULL,j.lease_owner=NULL,j.lease_token_hash=NULL,j.leased_at=NULL," +
          "j.heartbeat_at=NULL,j.lease_expires_at=NULL,j.finished_at=NULL,j.updated_at=NOW(3) " +
          "WHERE j.organization_id=? AND j.workspace_id=? AND j.collection_task_id=? " +
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
          input.organizationId,
          input.workspaceId,
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
            "UPDATE browser_collection_jobs SET status='cancelled',",
            "error_code='worker_shutdown_cancelled',finished_at=NOW(3),updated_at=NOW(3) ",
            "WHERE collection_subquery_id=? AND status IN ('queued','leased','running')",
          ].join(""),
          [input.subqueryId],
        );
        throw new ProviderAdapterFailure("dependency_unavailable", true);
      }
      await heartbeat();
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,status,result_json,error_code FROM browser_collection_jobs WHERE collection_subquery_id=? LIMIT 1",
        [input.subqueryId],
      );
      const row = rows[0];
      if (!row) throw new ProviderAdapterFailure("dependency_unavailable", true);
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
        "UPDATE browser_collection_jobs SET status='timed_out',error_code='worker_wait_timeout',finished_at=N",
        "OW(3),updated_at=NOW(3) WHERE collection_subquery_id=? AND status='queued'",
      ].join(""),
      [input.subqueryId],
    );
    throw new ProviderAdapterFailure("timeout", true);
  }
}
