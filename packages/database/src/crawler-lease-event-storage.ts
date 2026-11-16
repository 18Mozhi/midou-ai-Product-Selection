import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export async function appendCrawlerLeaseEvent(
  db: Pick<PoolConnection, "query">,
  i: {
    id: string;
    runId: string;
    profileId: string;
    actorId: string;
    requestId: string;
    traceId: string;
    now: Date;
    action: "acquired" | "heartbeat" | "released" | "recovered";
  },
) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM crawler_profile_lease_events WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length !== 0 && columns.length !== 2)
    throw new Error("partial_inherited_scope_schema:crawler_profile_lease_events");
  const legacy = columns.length === 2;
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO crawler_profile_lease_events (id,crawler_profile_id,run_id,${legacy ? "organization_id,workspace_id," : ""}action,actor_id,request_id,trace_id,occurred_at) ` +
      `SELECT ?,r.crawler_profile_id,r.id,${legacy ? "r.organization_id,r.workspace_id," : ""}?,?,?,?,? FROM crawler_browser_runs r WHERE r.id=? AND r.crawler_profile_id=?`,
    [i.id, i.action, i.actorId, i.requestId, i.traceId, i.now, i.runId, i.profileId],
  );
  if (result.affectedRows !== 1) throw new Error("crawler_lease_event_parent_mismatch");
}
