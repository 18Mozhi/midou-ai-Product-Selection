import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type ReplayOwner = { account_id: string; reason: "exclusive_owner" | "shared" | "unassigned" };

export function isNativeOwnedCollectionTask(row: RowDataPacket, owner: ReplayOwner | null, mismatch: () => Error) {
  if (!Object.hasOwn(row, "account_id")) return false;
  if (!owner || row.account_id !== owner.account_id ||
      Object.hasOwn(row, "organization_id") || Object.hasOwn(row, "workspace_id")) throw mismatch();
  return true;
}

export async function resolveCollectionReplayOwner(c: Pick<PoolConnection, "query">, id: string, mismatch: () => Error, table: 'collection_tasks' | 'tasks' = 'collection_tasks', lock = true): Promise<ReplayOwner | null> {
  let rows: RowDataPacket[];
  try {
    [rows] = await c.query<RowDataPacket[]>(
      "SELECT cut.contract_version,cut.primary_account_id,o.account_id,o.reason,u.id owner_user_id FROM account_ownership_cutover cut " +
      "LEFT JOIN account_owned_records o ON o.source_table=? AND o.source_id=? " +
      "LEFT JOIN users u ON u.id=o.account_id WHERE cut.slot='current'" + (lock ? " LOCK IN SHARE MODE" : ""),
      [table,id],
    );
  } catch (error) {
    const e = error as {code?:string;sqlMessage?:string};
    if (e.code === "ER_NO_SUCH_TABLE" && /\.account_ownership_cutover' doesn't exist$/i.test(e.sqlMessage ?? "")) return null;
    throw error;
  }
  const row = rows[0];
  if (!row) return null;
  if (Number(row.contract_version) !== 25 || !row.account_id || row.owner_user_id !== row.account_id ||
      (row.reason !== "exclusive_owner" && (!(row.reason === "shared" || row.reason === "unassigned") ||
        row.account_id !== row.primary_account_id))) throw mismatch();
  return {account_id:row.account_id,reason:row.reason};
}

export async function verifyOwnedReplayQueries(
  c: PoolConnection, owner: ReplayOwner, ids: string[], mismatch: () => Error,
) {
  if (!ids.length) throw mismatch();
  const [rows] = await c.query<RowDataPacket[]>(
    "SELECT source_id FROM account_owned_records WHERE source_table='collection_subqueries' AND source_id IN (?) AND account_id=? LOCK IN SHARE MODE",
    [ids, owner.account_id],
  );
  const owned = new Set(rows.map(row => row.source_id));
  if (ids.some(id => !owned.has(id))) throw mismatch();
}

export async function registerReplayOwnership(c: PoolConnection, owner: ReplayOwner | null, refs: [string,string][]) {
  if (!owner || !refs.length) return;
  await c.query(
    "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ?",
    [refs.map(([table,id]) => [table,id,owner.account_id,owner.reason])],
  );
}
