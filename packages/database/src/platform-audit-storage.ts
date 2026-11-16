import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type Query = Pick<PoolConnection, "query">;

type AuditTable = "platform_audit_events" | "audit_logs";

async function auditHistorical(db: Query, table: AuditTable) {
  const [columns] = await db.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('organization_id','workspace_id','historical_context')`,
  );
  const shape = columns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "historical_context") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new Error(
    table === "audit_logs"
      ? "business_audit_scope_shape_invalid"
      : "platform_audit_scope_shape_invalid",
  );
}

export const platformAuditHistorical = (db: Query) => auditHistorical(db, "platform_audit_events");
export const businessAuditHistorical = (db: Query) => auditHistorical(db, "audit_logs");

export const platformAuditCoordinate = (column: "organization_id" | "workspace_id") =>
  `CASE WHEN JSON_TYPE(JSON_EXTRACT(historical_context,'$.${column}'))='STRING' ` +
  `THEN CONVERT(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${column}')) USING ascii) END`;

// Existing producers use a static INSERT with the ID and the two legacy
// coordinates first. Translate only that prefix; never rewrite event payloads.
async function appendAudit(db: Query, table: AuditTable, sql: string, values: unknown[]) {
  const columns = new RegExp(
    `^(INSERT INTO ${table}\\s*\\(\\s*id,\\s*)organization_id,\\s*workspace_id,`,
    "i",
  );
  const prefix = /(\bVALUES\s*\(\s*\?,)\s*(NULL|\?)\s*,\s*(NULL|\?)\s*,/i;
  const match = prefix.exec(sql);
  if (!columns.test(sql) || !match) throw new Error("platform_audit_insert_shape_invalid");
  try {
    return await db.query(sql, values);
  } catch (error) {
    const mysql = error as { code?: string; sqlMessage?: string };
    if (
      mysql.code !== "ER_BAD_FIELD_ERROR" ||
      !/^Unknown column '(organization_id|workspace_id)' in 'field list'$/.test(
        mysql.sqlMessage ?? "",
      ) ||
      !(await auditHistorical(db, table))
    )
      throw error;
  }
  let index = 1;
  const organization_id = match[2] === "?" ? (values[index++] ?? null) : null;
  const workspace_id = match[3] === "?" ? (values[index++] ?? null) : null;
  if (table === "audit_logs" && typeof organization_id !== "string")
    throw new Error("business_audit_context_invalid");
  const context =
    organization_id === null && workspace_id === null
      ? null
      : JSON.stringify({ organization_id, workspace_id });
  return db.query(sql.replace(columns, "$1historical_context,").replace(prefix, "$1?,"), [
    values[0],
    context,
    ...values.slice(index),
  ]);
}

export const appendPlatformAudit = (db: Query, sql: string, values: unknown[]) =>
  appendAudit(db, "platform_audit_events", sql, values);
export const appendBusinessAudit = (db: Query, sql: string, values: unknown[]) =>
  appendAudit(db, "audit_logs", sql, values);
