import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

type Db = Pick<PoolConnection, "query">;
export type CollectionTaskScope = "legacy" | "account";

export async function collectionTaskScope(db: Db): Promise<CollectionTaskScope> {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM collection_tasks WHERE Field IN ('organization_id','workspace_id','account_id')",
  );
  const fields = columns
    .map((column) => column.Field)
    .sort()
    .join(",");
  if (fields === "organization_id,workspace_id") return "legacy";
  if (fields === "account_id") return "account";
  throw new Error("invalid_collection_task_scope_schema");
}

type NewScheduledCollectionTask = {
  id: string;
  actorId: string;
  requestId: string;
  traceId: string;
  now: Date;
  scope:
    | { kind: "legacy"; organizationId: string; workspaceId: string }
    | { kind: "account"; accountId: string };
};

/** The caller owns the transaction and registers task, subqueries and event together. */
export async function insertScheduledHighCollectionTask(db: Db, task: NewScheduledCollectionTask) {
  const scope = task.scope;
  const legacy = scope.kind === "legacy";
  const coordinates = legacy ? [scope.organizationId, scope.workspaceId] : [scope.accountId];
  if (coordinates.some((value) => typeof value !== "string" || !value))
    throw new Error("collection_task_scope_missing");
  const [result] = await db.query<ResultSetHeader>(
    "INSERT INTO collection_tasks (id," +
      (legacy ? "organization_id,workspace_id" : "account_id") +
      ",status,coverage_status,priority,scheduled_at,available_at,attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json,request_id,trace_id,version,created_by,created_at,updated_at) " +
      "VALUES(" +
      (legacy ? "?,?,?" : "?,?") +
      ",'scheduled',NULL,'high',?,?,0,0,0,0,0,'[]',?,?,1,?,?,?)",
    [
      task.id,
      ...coordinates,
      task.now,
      task.now,
      task.requestId,
      task.traceId,
      task.actorId,
      task.now,
      task.now,
    ],
  );
  if (result.affectedRows !== 1) throw new Error("collection_task_not_inserted");
}
