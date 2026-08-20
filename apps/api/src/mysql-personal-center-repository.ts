import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { PersonalCenterRepository } from "./personal-center-service.js";
import { PersonalCenterError } from "./personal-center-service.js";

const iso = (value: unknown) => (value ? new Date(value as string | Date).toISOString() : null);

export class MySqlPersonalCenterRepository implements PersonalCenterRepository {
  constructor(private readonly pool: Pool) {}

  async profile(input: { userId: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT u.id,u.email,u.email_verified_at,u.status,p.display_name,p.avatar_url," +
        "p.phone,p.phone_verified_at,p.locale,p.timezone,COALESCE(p.version,0) version," +
        "COALESCE(p.updated_at,u.updated_at) updated_at FROM users u LEFT JOIN user_profiles " +
        "p ON p.user_id=u.id WHERE u.id=?",
      [input.userId],
    );
    const row = rows[0];
    if (!row) throw new PersonalCenterError("user_not_found", 404, "重新登录后重试。 ");
    return {
      ...row,
      display_name: row.display_name ?? String(row.email).split("@")[0],
      locale: row.locale ?? "zh-CN",
      timezone: row.timezone ?? "Asia/Shanghai",
      version: Number(row.version),
      email_verified_at: iso(row.email_verified_at),
      phone_verified_at: iso(row.phone_verified_at),
      updated_at: iso(row.updated_at),
    };
  }

  async updateProfile(input: Parameters<PersonalCenterRepository["updateProfile"]>[0]) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [operations] = await connection.query<RowDataPacket[]>(
        "SELECT result_json FROM personal_profile_operations WHERE user_id=? AND idempotency_key=?",
        [input.userId, input.idempotencyKey],
      );
      if (operations[0]) {
        await connection.commit();
        const value = operations[0].result_json;
        return typeof value === "string" ? JSON.parse(value) : value;
      }
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT version,phone FROM user_profiles WHERE user_id=? FOR UPDATE",
        [input.userId],
      );
      const current = rows[0];
      if (Number(current?.version ?? 0) !== input.expectedVersion)
        throw new PersonalCenterError(
          "profile_version_conflict",
          409,
          "个人资料已变化，刷新后重试。 ",
        );
      const version = input.expectedVersion + 1;
      if (current) {
        await connection.query(
          "UPDATE user_profiles SET display_name=?,avatar_url=?,phone=?,phone_verified_at=IF(phone<=>?," +
            "phone_verified_at,NULL),locale=?,timezone=?,version=?,updated_at=? WHERE user_id=?",
          [
            input.displayName,
            input.avatarUrl,
            input.phone,
            input.phone,
            input.locale,
            input.timezone,
            version,
            input.now,
            input.userId,
          ],
        );
      } else {
        await connection.query(
          "INSERT INTO user_profiles(user_id,display_name,avatar_url,phone,phone_verified_at," +
            "locale,timezone,version,created_at,updated_at) VALUES(?,?,?,?,NULL,?,?,1," +
            "?,?)",
          [
            input.userId,
            input.displayName,
            input.avatarUrl,
            input.phone,
            input.locale,
            input.timezone,
            input.now,
            input.now,
          ],
        );
      }
      const result = {
        id: input.userId,
        display_name: input.displayName,
        avatar_url: input.avatarUrl,
        phone: input.phone,
        phone_verified: false,
        locale: input.locale,
        timezone: input.timezone,
        version,
        updated_at: input.now.toISOString(),
      };
      await connection.query(
        "INSERT INTO audit_logs(id,organization_id,workspace_id,actor_id,action,resource_type," +
          "resource_id,request_id,trace_id,metadata_json,occurred_at,schema_version) VALUES(?," +
          "?,?,?, 'user.profile.updated','user_profile',?,?,?,?,?, ?,1)",
        [
          randomUUID(),
          input.organizationId,
          input.workspaceId,
          input.userId,
          input.userId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            fields: ["display_name", "avatar_url", "phone", "locale", "timezone"],
            phone_verification_reset: current?.phone !== input.phone,
            reason: input.reason,
          }),
          input.now,
        ],
      );
      await connection.query(
        "INSERT INTO personal_profile_operations(id,user_id,idempotency_key,result_json,created_at) VALUES(?,?,?,?,?)",
        [randomUUID(), input.userId, input.idempotencyKey, JSON.stringify(result), input.now],
      );
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async assets(input: { userId: string; organizationId: string; workspaceId: string }) {
    const [followed, decisions, tasks] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT t.id,t.title,t.market,t.category,t.status,f.created_at FROM trend_topic_follows " +
          "f JOIN trend_topics t ON t.id=f.topic_id WHERE f.user_id=? AND f.organization_id=? AND " +
          "f.workspace_id=? ORDER BY f.created_at DESC LIMIT 20",
        [input.userId, input.organizationId, input.workspaceId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT d.id,d.action,d.reason,d.resulting_status,d.created_at,o.id opportunity_id," +
          "o.name opportunity_name FROM opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id " +
          "WHERE d.actor_id=? AND d.organization_id=? AND d.workspace_id=? ORDER BY d.created_at " +
          "DESC LIMIT 20",
        [input.userId, input.organizationId, input.workspaceId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,title,status,priority,due_at,updated_at FROM tasks WHERE assignee_id=? AND " +
          "organization_id=? AND workspace_id=? AND deleted_at IS NULL ORDER BY updated_at DESC " +
          "LIMIT 20",
        [input.userId, input.organizationId, input.workspaceId],
      ),
    ]);
    return {
      followed_trends: followed[0].map((row) => ({
        ...row,
        created_at: iso(row.created_at),
      })),
      decisions: decisions[0].map((row) => ({
        ...row,
        created_at: iso(row.created_at),
      })),
      tasks: tasks[0].map((row) => ({
        ...row,
        due_at: iso(row.due_at),
        updated_at: iso(row.updated_at),
      })),
    };
  }
}
