import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  ProviderAdapterFailure,
  type ProviderRawRecord,
  type ProviderRuntimeDefinition,
} from "@scoutops/provider-adapters";
import {
  create1688BrowserExecutionRequest,
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
}

export interface AuthenticatedBrowserCollection {
  browserJobId: string;
  records: ProviderRawRecord[];
  artifacts: BrowserEvidenceArtifactContract[];
  parseError: ProviderAdapterFailure | null;
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
    signal?: AbortSignal,
  ): Promise<AuthenticatedBrowserCollection> {
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
          artifacts = parseBrowserEvidenceArtifacts((result as Record<string, unknown>).artifacts);
        let records: ProviderRawRecord[] = [],
          parseError: ProviderAdapterFailure | null = null;
        try {
          records = recordsFor(input.provider, result as Record<string, unknown>);
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
