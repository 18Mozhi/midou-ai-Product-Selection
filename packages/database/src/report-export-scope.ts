import type { Pool, RowDataPacket } from "mysql2/promise";

export async function reportExportAccountStorage(db: Pick<Pool, "query">) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM report_exports WHERE Field IN ('account_id','historical_context','organization_id','workspace_id')",
  );
  const shape = rows
    .map((r) => r.Field)
    .sort()
    .join(",");
  if (shape === "account_id,historical_context") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new Error("report_export_scope_schema_invalid");
}

export const historicalExportOrganization =
  "JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id'))";
