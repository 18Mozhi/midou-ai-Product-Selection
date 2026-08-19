import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  ProviderAdapterFailure,
  type ProviderRawRecord,
  type ProviderRuntimeDefinition,
} from "@scoutops/provider-adapters";
import {
  create1688BrowserExecutionRequest,
  parse1688BrowserRunResult,
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
}

const requestFor = (provider: ProviderRuntimeDefinition, target: Record<string, unknown>) => {
  if (provider.code === "1688_search") return create1688BrowserExecutionRequest(target);
  throw new ProviderAdapterFailure("adapter_not_registered", false);
};

const recordsFor = (
  provider: ProviderRuntimeDefinition,
  result: Record<string, unknown>,
): ProviderRawRecord[] => {
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
  ) {}

  async collect(
    input: BrowserJobInput,
    heartbeat: () => Promise<void>,
  ): Promise<ProviderRawRecord[]> {
    const executionRequest = requestFor(input.provider, input.target),
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
    while (Date.now() <= deadline) {
      await heartbeat();
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT status,result_json,error_code FROM browser_collection_jobs WHERE collection_subquery_id=? LIMIT 1",
        [input.subqueryId],
      );
      const row = rows[0];
      if (!row) throw new ProviderAdapterFailure("dependency_unavailable", true);
      if (row.status === "succeeded") {
        const result =
          typeof row.result_json === "string" ? JSON.parse(row.result_json) : row.result_json;
        return recordsFor(input.provider, result as Record<string, unknown>);
      }
      if (["blocked", "failed", "timed_out", "cancelled"].includes(String(row.status))) {
        const errorCode = String(
          row.error_code ?? (row.status === "timed_out" ? "timeout" : "dependency_unavailable"),
        );
        throw new ProviderAdapterFailure(
          errorCode,
          ["failed", "timed_out"].includes(String(row.status)),
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
