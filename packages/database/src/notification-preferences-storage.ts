import type { PoolConnection, RowDataPacket } from "mysql2/promise";
type Query = Pick<PoolConnection, "query">;

export async function notificationPreferencesAccountSchema(db: Query) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM notification_preferences WHERE Field IN ('organization_id','workspace_id','historical_context','user_id')",
  );
  if (
    columns
      .map((row) => row.Field)
      .sort()
      .join(",") !== "historical_context,user_id"
  )
    throw new Error("notification_preferences_account_schema_not_ready");
}

export async function readDeliveryNotificationPreferences(
  db: Query,
  organizationId: string,
  workspaceId: string,
  accountId: string,
) {
  try {
    return await db.query<RowDataPacket[]>(
      "SELECT * FROM notification_preferences WHERE organization_id=? AND workspace_id=? AND user_id=?",
      [organizationId, workspaceId, accountId],
    );
  } catch (error) {
    const mysql = error as { code?: string; sqlMessage?: string };
    if (
      mysql.code !== "ER_BAD_FIELD_ERROR" ||
      !/^Unknown column '(organization_id|workspace_id)' in 'where clause'$/.test(
        mysql.sqlMessage ?? "",
      )
    )
      throw error;
    await notificationPreferencesAccountSchema(db);
    return db.query<RowDataPacket[]>("SELECT * FROM notification_preferences WHERE user_id=?", [
      accountId,
    ]);
  }
}
