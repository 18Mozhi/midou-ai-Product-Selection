import type { PoolConnection, RowDataPacket } from "mysql2/promise";
type Query = Pick<PoolConnection, "query">;

export async function notificationsHaveLegacyScope(db: Query) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM notifications WHERE Field IN ('organization_id','workspace_id','source_event_id','recipient_id')",
  );
  const shape = columns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "organization_id,recipient_id,source_event_id,workspace_id") return true;
  if (shape === "recipient_id,source_event_id") return false;
  throw new Error("notifications_scope_shape_invalid");
}

export async function notificationScopeRelation(db: Query) {
  return (await notificationsHaveLegacyScope(db))
    ? "notifications"
    : "(SELECT child.*,parent.organization_id,parent.workspace_id FROM notifications child JOIN outbox_events parent ON parent.id=child.source_event_id)";
}

export async function appendScopedNotification(db: Query, sql: string, values: unknown[]) {
  const cols = /^(INSERT (?:IGNORE )?INTO notifications\s*\(id,)organization_id,workspace_id,/;
  const args = /(\bVALUES\s*\(\?,)\?,\?,/;
  if (!cols.test(sql) || !args.test(sql)) throw new Error("notification_insert_shape_invalid");
  try {
    return await db.query(sql, values);
  } catch (error) {
    const mysql = error as { code?: string; sqlMessage?: string };
    if (
      mysql.code !== "ER_BAD_FIELD_ERROR" ||
      !/^Unknown column '(organization_id|workspace_id)' in 'field list'$/.test(
        mysql.sqlMessage ?? "",
      ) ||
      (await notificationsHaveLegacyScope(db))
    )
      throw error;
  }
  // Reject detached/mismatched scope rather than silently changing lineage.
  const accountProjection = values[1] == null && values[2] == null;
  const [parent] = accountProjection
    ? await db.query<RowDataPacket[]>(
        "SELECT e.id FROM outbox_events e JOIN account_owned_records owner " +
          "ON owner.source_table='outbox_events' AND owner.source_id=e.id " +
          "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
          "AND (owner.reason='exclusive_owner' OR (owner.reason IN ('shared','unassigned') AND owner.account_id=cut.primary_account_id)) " +
          "WHERE e.id=?",
        [values[4]],
      )
    : await db.query<RowDataPacket[]>(
        "SELECT id FROM outbox_events WHERE id=? AND organization_id <=> ? AND workspace_id <=> ?",
        [values[4], values[1] ?? null, values[2] ?? null],
      );
  if (!parent[0]) throw new Error("notification_parent_scope_mismatch");
  return db.query(sql.replace(cols, "$1").replace(args, "$1"), [values[0], ...values.slice(3)]);
}
