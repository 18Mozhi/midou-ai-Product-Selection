export async function fileAssetScopeRelation(db) {
  const [rows] = await db.query(
    "SHOW COLUMNS FROM file_assets WHERE Field IN ('account_id','historical_context','organization_id','workspace_id')",
  );
  const shape = rows.map(row => row.Field).sort().join(",");
  if (shape === "organization_id,workspace_id") return "file_assets";
  if (shape !== "account_id,historical_context") throw new Error("file_asset_scope_schema_invalid");
  const coordinate = key => `CAST(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${key}')) AS CHAR CHARACTER SET ascii) COLLATE ascii_general_ci AS ${key}`;
  return `(SELECT file_assets.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM file_assets)`;
}
