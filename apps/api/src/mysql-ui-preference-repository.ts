import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  PreferenceAudit,
  PreferenceOperation,
  PreferenceScope,
  ThemeId,
  UiPreference,
  UiPreferenceRepository,
} from "@scoutops/preferences";

const columns = "id,user_id,organization_id,workspace_id,theme,version,created_at,updated_at";
const map = (row: RowDataPacket): UiPreference => ({
  id: String(row.id),
  user_id: String(row.user_id),
  organization_id: String(row.organization_id),
  workspace_id: String(row.workspace_id),
  theme: String(row.theme) as ThemeId,
  version: Number(row.version),
  created_at: new Date(row.created_at),
  updated_at: new Date(row.updated_at),
});
export class MySqlUiPreferenceRepository implements UiPreferenceRepository {
  constructor(private readonly pool: Pool) {}
  async resolveScope(sessionId: string, userId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT c.user_id,c.organization_id,c.workspace_id FROM user_session_contexts c JOIN " +
        "memberships m ON m.user_id=c.user_id AND m.organization_id=c.organization_id AND m.status='active' " +
        "JOIN organizations o ON o.id=c.organization_id AND o.status='active' JOIN workspaces " +
        "w ON w.id=c.workspace_id AND w.organization_id=c.organization_id AND w.status='active' " +
        "WHERE c.session_id=? AND c.user_id=? LIMIT 1",
      [sessionId, userId],
    );
    return rows[0]
      ? {
          userId: String(rows[0].user_id),
          organizationId: String(rows[0].organization_id),
          workspaceId: String(rows[0].workspace_id),
        }
      : null;
  }
  async find(scope: PreferenceScope) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ${columns} FROM user_ui_preferences WHERE user_id=? AND organization_id=? AND workspace_id=? LIMIT 1`,
      [scope.userId, scope.organizationId, scope.workspaceId],
    );
    return rows[0] ? map(rows[0]) : null;
  }
  async findOperation(scope: PreferenceScope, keyHash: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT o.request_hash,${columns
        .split(",")
        .map((value) => `p.${value}`)
        .join(",")}
         FROM user_ui_preference_operations o
         JOIN user_ui_preferences p ON p.id=o.preference_id
         WHERE o.user_id=? AND o.organization_id=? AND o.workspace_id=?
          AND o.key_hash=? LIMIT 1`,
      [scope.userId, scope.organizationId, scope.workspaceId, keyHash],
    );
    return rows[0]
      ? { request_hash: String(rows[0].request_hash), preference: map(rows[0]) }
      : null;
  }
  async commit(
    preference: UiPreference,
    expectedVersion: number | null,
    audit: PreferenceAudit,
    operation: PreferenceOperation,
  ) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      let changed = true;
      if (expectedVersion === null) {
        try {
          await connection.query(
            "INSERT INTO user_ui_preferences (id,user_id,organization_id,workspace_id," +
              "theme,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
            [
              preference.id,
              preference.user_id,
              preference.organization_id,
              preference.workspace_id,
              preference.theme,
              preference.version,
              preference.created_at,
              preference.updated_at,
            ],
          );
        } catch (error) {
          if (
            typeof error === "object" &&
            error &&
            "code" in error &&
            error.code === "ER_DUP_ENTRY"
          )
            changed = false;
          else throw error;
        }
      } else {
        const [result] = await connection.query<ResultSetHeader>(
          "UPDATE user_ui_preferences SET theme=?,version=?,updated_at=? WHERE id=? AND user_id=? " +
            "AND organization_id=? AND workspace_id=? AND version=?",
          [
            preference.theme,
            preference.version,
            preference.updated_at,
            preference.id,
            preference.user_id,
            preference.organization_id,
            preference.workspace_id,
            expectedVersion,
          ],
        );
        changed = result.affectedRows === 1;
      }
      if (!changed) {
        await connection.rollback();
        return false;
      }
      await this.insertAudit(connection, audit);
      await connection.query(
        "INSERT INTO user_ui_preference_operations (id,user_id,organization_id,workspace_id," +
          "key_hash,request_hash,preference_id,preference_version,created_at) VALUES (?," +
          "?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          operation.user_id,
          operation.organization_id,
          operation.workspace_id,
          operation.key_hash,
          operation.request_hash,
          operation.preference_id,
          operation.preference_version,
          operation.created_at,
        ],
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  private insertAudit(connection: PoolConnection, event: PreferenceAudit) {
    return connection.query(
      "INSERT INTO user_ui_preference_audit_events (id,preference_id,user_id,organization_id," +
        "workspace_id,action,previous_theme,theme,request_id,trace_id,occurred_at," +
        "schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        event.id,
        event.preference_id,
        event.user_id,
        event.organization_id,
        event.workspace_id,
        event.action,
        event.previous_theme,
        event.theme,
        event.request_id,
        event.trace_id,
        event.occurred_at,
        event.schema_version,
      ],
    );
  }
}
