import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function appendProviderSourceReplayRun(
  db: Pick<PoolConnection, "query">,
  i: {
    runId: string;
    organizationId: string;
    workspaceId: string;
    providerId: string;
    sourceCode: string;
    taskId: string;
    inputSha256: string;
    requestId: string;
    traceId: string;
    actorId: string;
    now: Date;
  },
) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM provider_source_replay_runs WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length !== 0 && columns.length !== 2)
    throw new Error("partial_inherited_scope_schema:provider_source_replay_runs");
  const legacy = columns.length === 2;
  return db.query(
    `INSERT INTO provider_source_replay_runs (id,${legacy ? "organization_id,workspace_id," : ""}provider_id,source_code,task_id,input_sha256,status,item_count,error_code,request_id,trace_id,created_by,created_at,updated_at) VALUES (${legacy ? "?,?," : ""}?,?,?,?,?,'scheduled',0,NULL,?,?,?,?,?)`,
    [
      i.runId,
      ...(legacy ? [i.organizationId, i.workspaceId] : []),
      i.providerId,
      i.sourceCode,
      i.taskId,
      i.inputSha256,
      i.requestId,
      i.traceId,
      i.actorId,
      i.now,
      i.now,
    ],
  );
}
