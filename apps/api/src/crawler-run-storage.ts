import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export function readCrawlerRunCoordinates(row: RowDataPacket) {
  const legacy = Object.hasOwn(row, "organization_id") || Object.hasOwn(row, "workspace_id");
  if (legacy && Object.hasOwn(row, "historical_context")) throw new Error("crawler_run_scope_partial");
  const scope = legacy ? row : typeof row.historical_context === "string"
    ? JSON.parse(row.historical_context) : row.historical_context;
  const organizationId = scope?.organization_id;
  const workspaceId = scope?.workspace_id;
  if (typeof organizationId !== "string" || typeof workspaceId !== "string" || !organizationId || !workspaceId)
    throw new Error("crawler_run_coordinates_invalid");
  return { organizationId, workspaceId };
}

export function readCrawlerRunAccount(row: RowDataPacket): string | null {
  const context = typeof row.historical_context === "string"
    ? JSON.parse(row.historical_context) : row.historical_context;
  if (!context || !Object.hasOwn(context, "account_id")) return null;
  if (Object.hasOwn(row, "organization_id") || Object.hasOwn(row, "workspace_id") ||
    Object.hasOwn(context, "organization_id") || Object.hasOwn(context, "workspace_id") ||
    typeof context.account_id !== "string" || !context.account_id)
    throw new Error("crawler_run_account_context_invalid");
  return context.account_id;
}

export async function insertCrawlerRun(c: Pick<PoolConnection, "query">, i: {
  id: string; providerId: string; profileId: string;
  actorId: string; requestId: string; traceId: string; now: Date;
} & ({ accountId: string } | { organizationId: string; workspaceId: string })) {
  const [columns] = await c.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM crawler_browser_runs WHERE Field IN ('organization_id','workspace_id','historical_context')",
  );
  const shape = columns.map(({ Field }) => Field).sort().join(",");
  const legacy = shape === "organization_id,workspace_id";
  if (!legacy && shape !== "historical_context") throw new Error("crawler_run_scope_partial");
  if ("accountId" in i && (legacy || !i.accountId))
    throw new Error("crawler_run_account_schema_required");
  const scope = "accountId" in i ? [JSON.stringify({ account_id: i.accountId })]
    : legacy ? [i.organizationId, i.workspaceId]
    : [JSON.stringify({ organization_id: i.organizationId, workspace_id: i.workspaceId })];
  await c.query(
    `INSERT INTO crawler_browser_runs (id,${legacy ? "organization_id,workspace_id" : "historical_context"},` +
    "provider_id,crawler_profile_id,requested_by,status,page_count,item_count,detail_count,duration_ms,error_code," +
    `request_id,trace_id,started_at,finished_at) VALUES (?,${legacy ? "?,?" : "?"},?,?,?,'running',0,0,0,NULL,NULL,?,?,?,NULL)`,
    [i.id, ...scope,
      i.providerId, i.profileId, i.actorId, i.requestId, i.traceId, i.now],
  );
}
