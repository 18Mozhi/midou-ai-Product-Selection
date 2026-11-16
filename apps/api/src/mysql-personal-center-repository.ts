import { appendPlatformAudit } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { PersonalAssetsScope, PersonalCenterRepository } from "./personal-center-service.js";
import { PersonalCenterError } from "./personal-center-service.js";
import { requireAccountReadRehearsal } from "./account-read-rehearsal.js";

function ownsPersonalAsset(table: string, id: string, account: string) {
  return `EXISTS (SELECT 1 FROM account_owned_records own JOIN account_ownership_cutover cut
    ON cut.slot='current' AND cut.contract_version=25 WHERE own.source_table='${table}'
    AND own.source_id=${id} AND own.account_id=${account}
    AND (own.reason='exclusive_owner' OR (own.reason IN ('shared','unassigned') AND own.account_id=cut.primary_account_id)))`;
}

const iso = (value: unknown) => (value ? new Date(value as string | Date).toISOString() : null);

export class MySqlPersonalCenterRepository implements PersonalCenterRepository {
  constructor(private readonly pool: Pool) {}

  async profile(input: { userId: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT u.id,u.email,u.username,u.email_verified_at,u.status,p.display_name,p.avatar_url," +
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
      const [users] = await connection.query<RowDataPacket[]>(
        "SELECT username FROM users WHERE id=? FOR UPDATE",
        [input.userId],
      );
      if (!users[0]) throw new PersonalCenterError("user_not_found", 404, "重新登录后重试。 ");
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
      const usernameChanged =
        input.username !== undefined && (users[0].username ?? null) !== input.username;
      if (usernameChanged)
        await connection.query(
          "UPDATE users SET username=?,username_normalized=?,version=version+1,updated_at=? WHERE id=?",
          [input.username, input.usernameNormalized, input.now, input.userId],
        );
      const result = {
        id: input.userId,
        username: usernameChanged ? input.username : (users[0].username ?? null),
        display_name: input.displayName,
        avatar_url: input.avatarUrl,
        phone: input.phone,
        phone_verified: false,
        locale: input.locale,
        timezone: input.timezone,
        version,
        updated_at: input.now.toISOString(),
      };
      await appendPlatformAudit(connection,
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action," +
          "resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
          "schema_version) VALUES (?,NULL,NULL,?,'user.profile.updated','user_profile',?," +
          "'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          input.userId,
          input.userId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            fields: [
              "display_name",
              ...(usernameChanged ? ["username"] : []),
              "avatar_url",
              "phone",
              "locale",
              "timezone",
            ],
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
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "ER_DUP_ENTRY" &&
        String("message" in error ? error.message : "").includes("uq_users_username_normalized")
      )
        throw new PersonalCenterError(
          "username_already_registered",
          409,
          "该用户名已被使用，请更换后重试。",
        );
      throw error;
    } finally {
      connection.release();
    }
  }

  async assets(input: PersonalAssetsScope) {
    const scoped = "organizationId" in input;
    let nativeTrend = "", nativeOpportunity = "", nativeTask = "";
    if (!scoped) {
      await requireAccountReadRehearsal(this.pool);
      const [columns] = await this.pool.query<RowDataPacket[]>(
        "SELECT TABLE_NAME table_name,COLUMN_NAME column_name FROM information_schema.COLUMNS " +
          "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('trend_topics','opportunities','tasks') " +
          "AND COLUMN_NAME IN ('account_id','organization_id','workspace_id')",
      );
      const native = (table: string, alias: string, recipient: string) => {
        const shape = columns.filter(c => c.table_name === table).map(c => c.column_name).sort().join(",");
        if (shape === "account_id") return ` AND ${alias}.account_id=${recipient}`;
        if (shape === "organization_id,workspace_id") return "";
        throw new PersonalCenterError("personal_asset_scope_schema_invalid", 503, "账号资产尚未就绪。");
      };
      nativeTrend = native("trend_topics", "t", "f.account_id");
      nativeOpportunity = native("opportunities", "o", "d.actor_id");
      nativeTask = native("tasks", "t", "t.assignee_id");
    }
    const [followed, decisions, tasks] = await Promise.all(scoped ? [
      this.pool.query<RowDataPacket[]>(
        "SELECT t.id,t.title,t.market,t.category,t.status,f.created_at FROM account_trend_topic_follows " +
          "f JOIN trend_topics t ON t.id=f.topic_id WHERE f.account_id=? AND t.organization_id=? AND " +
          "t.workspace_id=? ORDER BY f.created_at DESC LIMIT 20",
        [input.userId, input.organizationId, input.workspaceId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT d.id,d.action,d.reason,d.resulting_status,d.created_at,o.id opportunity_id," +
          "o.name opportunity_name FROM opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id " +
          "WHERE d.actor_id=? AND o.organization_id=? AND o.workspace_id=? ORDER BY d.created_at " +
          "DESC LIMIT 20",
        [input.userId, input.organizationId, input.workspaceId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,title,status,priority,due_at,updated_at FROM tasks WHERE assignee_id=? AND " +
          "organization_id=? AND workspace_id=? AND deleted_at IS NULL ORDER BY updated_at DESC " +
          "LIMIT 20",
        [input.userId, input.organizationId, input.workspaceId],
      ),
    ] : [
      this.pool.query<RowDataPacket[]>(
        "SELECT t.id,t.title,t.market,t.category,t.status,f.created_at FROM account_trend_topic_follows " +
          "f JOIN trend_topics t ON t.id=f.topic_id WHERE f.account_id=? AND " +
          ownsPersonalAsset("trend_topics", "t.id", "f.account_id") + nativeTrend +
          " ORDER BY f.created_at DESC LIMIT 20",
        [input.userId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT d.id,d.action,d.reason,d.resulting_status,d.created_at,o.id opportunity_id," +
          "o.name opportunity_name FROM opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id " +
          "WHERE d.actor_id=? AND " + ownsPersonalAsset("opportunities", "o.id", "d.actor_id") +
          " AND " + ownsPersonalAsset("opportunity_decisions", "d.id", "d.actor_id") + nativeOpportunity +
          " ORDER BY d.created_at DESC LIMIT 20",
        [input.userId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,title,status,priority,due_at,updated_at FROM tasks t WHERE t.assignee_id=? AND " +
          ownsPersonalAsset("tasks", "t.id", "t.assignee_id") + nativeTask +
          " AND t.deleted_at IS NULL ORDER BY t.updated_at DESC LIMIT 20",
        [input.userId],
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
