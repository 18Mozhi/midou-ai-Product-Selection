import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function fileAssetAccountStorage(db: Pick<PoolConnection, "query">) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM file_assets WHERE Field IN ('account_id','historical_context','organization_id','workspace_id')",
  );
  const shape = rows
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "account_id,historical_context") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new Error("file_asset_scope_schema_invalid");
}
