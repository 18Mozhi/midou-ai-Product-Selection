import type { PoolConnection, RowDataPacket } from "mysql2/promise";

/** Account-mode producers can write before or after both redundant columns are removed. */
export async function sourcingSearchHasLegacyScope(db: Pick<PoolConnection, "query">) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM sourcing_searches WHERE Field IN ('organization_id','workspace_id')",
  );
  const shape = columns
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id") return true;
  if (shape === "") return false;
  throw new Error("partial_inherited_scope_schema:sourcing_searches");
}
