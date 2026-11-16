import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function nativeBusinessTaskScope(db: Pick<PoolConnection, "query">) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM tasks WHERE Field IN ('organization_id','workspace_id','account_id')",
  );
  const shape = columns
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (shape === "account_id") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new Error("business_task_scope_schema_invalid");
}
