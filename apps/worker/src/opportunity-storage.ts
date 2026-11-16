import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function nativeOpportunityStorage(db: Pick<PoolConnection, "query">) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM opportunities WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = columns.map(column => column.Field).sort().join(",");
  if (shape === "account_id") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new Error("opportunity_scope_schema_invalid");
}
