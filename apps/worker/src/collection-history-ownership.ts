import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function inheritCollectionHistoryOwner(
  c: PoolConnection,
  table: "collection_task_events" | "collection_task_outbox",
  historyId: string,
  taskId: string,
  nativeAccountId?: string,
) {
  let rows: RowDataPacket[];
  try {
    [rows] = await c.query<RowDataPacket[]>(
      "SELECT cut.primary_account_id,o.account_id,o.reason FROM account_ownership_cutover cut " +
        "LEFT JOIN account_owned_records o ON o.source_table='collection_tasks' AND o.source_id=? " +
        "WHERE cut.slot='current' AND cut.contract_version=25 LOCK IN SHARE MODE",
      [taskId],
    );
  } catch (error) {
    // Older schemas have neither ownership table. A missing ledger on a cutover schema is an error.
    const mysql = error as { code?: string; sqlMessage?: string };
    if (
      mysql.code === "ER_NO_SUCH_TABLE" &&
      /\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "") &&
      nativeAccountId === undefined
    )
      return;
    throw error;
  }
  const owner = rows[0];
  if (nativeAccountId !== undefined && (!nativeAccountId || owner?.account_id !== nativeAccountId))
    throw new Error("collection_history_owner_mismatch");
  if (!owner?.account_id) return; // Do not guess an owner for a legacy task.
  if (
    owner.reason !== "exclusive_owner" &&
    ((owner.reason !== "shared" && owner.reason !== "unassigned") ||
      owner.account_id !== owner.primary_account_id)
  )
    throw new Error("collection_history_owner_mismatch");
  await c.query(
    "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES (?,?,?,?)",
    [table, historyId, owner.account_id, owner.reason],
  );
}
