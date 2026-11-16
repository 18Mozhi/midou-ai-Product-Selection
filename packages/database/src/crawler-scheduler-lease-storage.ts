import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type Scope = { organizationId: string; workspaceId: string };
type Lease = {
  slotType: "worker" | "provider" | "crawler";
  slotKey: string;
  taskId: string | null;
  runId: string | null;
  owner: string;
  tokenHash: string;
  now: Date;
  expiresAt: Date;
  requestId: string;
  traceId: string;
};

export async function crawlerSchedulerLeaseHasLegacyScope(db: Pick<PoolConnection, "query">) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM crawler_scheduler_leases WHERE Field IN ('organization_id','workspace_id')",
  );
  if (rows.length !== 0 && rows.length !== 2)
    throw new Error("partial_inherited_scope_schema:crawler_scheduler_leases");
  return rows.length === 2;
}

// Scope is supplied only by a task or run already held by the caller's transaction.
export function appendCrawlerSchedulerLease(
  db: Pick<PoolConnection, "query">,
  legacy: boolean,
  scope: Scope | null,
  i: Lease,
) {
  if (legacy && !scope) throw new Error("crawler_scheduler_account_schema_required");
  return db.query(
    `INSERT INTO crawler_scheduler_leases (slot_type,slot_key,slot_no,${legacy ? "organization_id,workspace_id," : ""}task_id,run_id,lease_owner,lease_token_hash,leased_at,heartbeat_at,expires_at,request_id,trace_id) VALUES (?,?,1,${legacy ? "?,?," : ""}?,?,?,UNHEX(?),?,?,?,?,?)`,
    [
      i.slotType,
      i.slotKey,
      ...(legacy && scope ? [scope.organizationId, scope.workspaceId] : []),
      i.taskId,
      i.runId,
      i.owner,
      i.tokenHash,
      i.now,
      i.now,
      i.expiresAt,
      i.requestId,
      i.traceId,
    ],
  );
}
