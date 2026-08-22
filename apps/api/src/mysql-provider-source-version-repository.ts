import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  ProviderConfigurationHistory,
  ProviderSourceRepository,
  ProvisionedSource,
} from "./provider-source-service.js";
import { ProviderSourceServiceError } from "./provider-source-service.js";
import { iso, providerSourceByOperation } from "./mysql-provider-source-repository-shared.js";

const json = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value);
const configuration = (snapshot: unknown) => {
  const value = json(snapshot) as Record<string, unknown>;
  return {
    schedule_minutes: Number(value.schedule_minutes),
    timeout_ms: Number(value.timeout_ms),
    retry_limit: Number(value.retry_limit),
    status: String(value.status),
  };
};
const configurationChanges = (
  before: ReturnType<typeof configuration> | null,
  after: ReturnType<typeof configuration>,
) =>
  (Object.keys(after) as Array<keyof typeof after>)
    .filter((field) => before?.[field] !== after[field])
    .map((field) => ({ field, before: before?.[field] ?? null, after: after[field] }));
const requireCurrentPublicSmokeTest = async (
  connection: PoolConnection,
  current: RowDataPacket,
  timeoutMs: number,
) => {
  const [health] = await connection.query<RowDataPacket[]>(
      "SELECT health_status,last_checked_at FROM provider_adapter_health WHERE provider_id=? LIMIT 1",
      [current.id],
    ),
    checkedAt = new Date(health[0]?.last_checked_at).getTime(),
    configuredAt = new Date(current.updated_at).getTime();
  if (
    timeoutMs !== Number(current.timeout_ms) ||
    health[0]?.health_status !== "ready" ||
    !Number.isFinite(checkedAt) ||
    !Number.isFinite(configuredAt) ||
    checkedAt < configuredAt
  )
    throw new ProviderSourceServiceError(
      "provider_source_smoke_test_required",
      409,
      "先以停用状态保存当前超时配置，再执行真实页面烟测；测试通过后才能启用。",
    );
};

export class MySqlProviderSourceVersionRepository {
  constructor(private readonly pool: Pool) {}
  async configurationVersions(providerId: string): Promise<ProviderConfigurationHistory> {
    const [[provider], [versions]] = await Promise.all([
      this.pool.query<RowDataPacket[]>("SELECT id,version FROM providers WHERE id=? LIMIT 1", [
        providerId,
      ]),
      this.pool.query<RowDataPacket[]>(
        "SELECT version,snapshot_json,action,created_at FROM provider_versions WHERE provider_id=? " +
          "ORDER BY version DESC LIMIT 101",
        [providerId],
      ),
    ]);
    if (!provider[0])
      throw new ProviderSourceServiceError("provider_not_found", 404, "刷新来源目录后重试。");
    const source = provider[0];
    let previous: ReturnType<typeof configuration> | null = null;
    const history = versions.reverse().map((row) => {
      const current = configuration(row.snapshot_json),
        result = {
          version: Number(row.version),
          action: String(row.action),
          created_at: iso(row.created_at),
          current: Number(row.version) === Number(source.version),
          rollback_available: Number(row.version) < Number(source.version),
          changes: configurationChanges(previous, current),
        };
      previous = current;
      return result;
    });
    if (history.length > 100) history.shift();
    return {
      provider_id: String(source.id),
      current_version: Number(source.version),
      versions: history.reverse(),
    };
  }
  async updateConfiguration(input: Parameters<ProviderSourceRepository["updateConfiguration"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const replayed = await providerSourceByOperation(
        c,
        input.actorId,
        input.route,
        input.idempotencyKey,
      );
      if (replayed) {
        await c.commit();
        return replayed;
      }
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT * FROM providers WHERE id=? FOR UPDATE",
          [input.providerId],
        ),
        current = rows[0];
      if (!current)
        throw new ProviderSourceServiceError("provider_not_found", 404, "刷新来源目录后重试。");
      if (String(current.code) === "1688_search" && input.status === "enabled") {
        const [acceptance] = await c.query<RowDataPacket[]>(
          [
            "SELECT COUNT(*) count FROM provider_parser_samples s WHERE s.provider_id=? AND ",
            "s.status='active' AND s.review_status='approved' AND s.last_replay_status='passed' AND EXISTS (SELECT 1 FROM ",
            "provider_parser_sample_replay_runs r WHERE r.sample_id=s.id AND r.parser_version=? AND ",
            "r.status='passed' AND r.created_at=s.last_replay_at) AND EXISTS (SELECT 1 FROM crawler_profiles cp ",
            "JOIN credential_assets ca ON ca.id=cp.credential_asset_id AND ca.provider_id=cp.provider_id ",
            "JOIN crawler_browser_runs br ON br.crawler_profile_id=cp.id AND br.provider_id=cp.provider_id ",
            "WHERE cp.provider_id=s.provider_id AND cp.status='active' AND ca.status='active' AND ",
            "(ca.expires_at IS NULL OR ca.expires_at>NOW(3)) AND br.status IN ('succeeded','succeeded_empty') AND ",
            "br.finished_at>=GREATEST(cp.updated_at,ca.updated_at))",
          ].join(""),
          [input.providerId, current.parser_version],
        );
        if (Number(acceptance[0]?.count ?? 0) < 1)
          throw new ProviderSourceServiceError(
            "provider_source_setup_required",
            409,
            "先在 1688 验收页通过登录态、验证码与当前解析器固定样本验收；当前来源只能保持停用。",
          );
      }
      if (
        input.status === "enabled" &&
        ["public_page", "public_rss"].includes(String(current.access_mode)) &&
        (current.terms_review_status !== "approved" ||
          !current.terms_reference_url ||
          !current.terms_version ||
          !current.terms_expires_at ||
          new Date(current.terms_expires_at) <= input.now)
      )
        throw new ProviderSourceServiceError(
          "provider_source_compliance_required",
          409,
          "先在来源定义页批准平台条款，并登记 HTTPS 参考地址、版本和未来到期时间。",
        );
      if (
        input.status === "enabled" &&
        current.status !== "enabled" &&
        ["public_page", "public_rss"].includes(String(current.access_mode))
      )
        await requireCurrentPublicSmokeTest(c, current, input.timeoutMs);
      if (Number(current.version) !== input.expectedVersion)
        throw new ProviderSourceServiceError(
          "provider_version_conflict",
          409,
          "来源已被其他管理员修改，刷新后重试。",
        );
      const nextVersion = Number(current.version) + 1;
      await c.query(
        [
          "UPDATE providers SET schedule_minutes=?,timeout_ms=?,retry_limit=?,status=?,version=?,updated_by=?,u",
          "pdated_at=? WHERE id=?",
        ].join(""),
        [
          input.scheduleMinutes,
          input.timeoutMs,
          input.retryLimit,
          input.status,
          nextVersion,
          input.actorId,
          input.now,
          input.providerId,
        ],
      );
      const snapshot = {
        ...current,
        schedule_minutes: input.scheduleMinutes,
        timeout_ms: input.timeoutMs,
        retry_limit: input.retryLimit,
        status: input.status,
        version: nextVersion,
        updated_by: input.actorId,
        updated_at: input.now,
      };
      await c.query(
        [
          "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id,action,request_id,trace",
          "_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.providerId,
          nextVersion,
          JSON.stringify(snapshot),
          input.actorId,
          "configuration_updated",
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO provider_source_operations (id,actor_id,route,idempotency_key,provider_id,replay_run_id,",
          "created_at) VALUES (?,?,?,?,?,NULL,?)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.providerId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,reso",
          "urce_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) ",
          "VALUES(?,NULL,NULL,?,'provider.configuration.updated','provider',?,'succeeded',?,?,?,?,1)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.providerId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            reason: input.reason,
            from_version: input.expectedVersion,
            to_version: nextVersion,
            schedule_minutes: input.scheduleMinutes,
            timeout_ms: input.timeoutMs,
            retry_limit: input.retryLimit,
            status: input.status,
          }),
          input.now,
        ],
      );
      await c.commit();
      return {
        id: String(current.id),
        code: String(current.code),
        status: input.status,
        version: nextVersion,
        schedule_minutes: input.scheduleMinutes,
        timeout_ms: input.timeoutMs,
        retry_limit: input.retryLimit,
        updated_at: input.now.toISOString(),
        last_success: null,
      };
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError(
          "provider_configuration_conflict",
          409,
          "刷新来源版本后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async rollbackConfiguration(
    input: Parameters<ProviderSourceRepository["rollbackConfiguration"]>[0],
  ) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const replayed = await providerSourceByOperation(
        c,
        input.actorId,
        input.route,
        input.idempotencyKey,
      );
      if (replayed) {
        await c.commit();
        return replayed;
      }
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT * FROM providers WHERE id=? FOR UPDATE",
          [input.providerId],
        ),
        current = rows[0];
      if (!current)
        throw new ProviderSourceServiceError("provider_not_found", 404, "刷新来源目录后重试。");
      if (Number(current.version) !== input.expectedVersion)
        throw new ProviderSourceServiceError(
          "provider_version_conflict",
          409,
          "来源已被其他管理员修改，刷新后重试。",
        );
      const [targets] = await c.query<RowDataPacket[]>(
          "SELECT snapshot_json FROM provider_versions WHERE provider_id=? AND version=? LIMIT 1",
          [input.providerId, input.targetVersion],
        ),
        target = targets[0] ? configuration(targets[0].snapshot_json) : null;
      if (!target)
        throw new ProviderSourceServiceError(
          "provider_target_version_not_found",
          404,
          "选择仍存在的历史版本。",
        );
      if (
        !Number.isInteger(target.schedule_minutes) ||
        target.schedule_minutes < 1 ||
        target.schedule_minutes > 10080 ||
        !Number.isInteger(target.timeout_ms) ||
        target.timeout_ms < 1000 ||
        target.timeout_ms > 120000 ||
        !Number.isInteger(target.retry_limit) ||
        target.retry_limit < 0 ||
        target.retry_limit > 10 ||
        !["draft", "disabled", "enabled"].includes(target.status)
      )
        throw new ProviderSourceServiceError(
          "provider_target_version_invalid",
          409,
          "历史版本的采集设置已不符合当前合同，不能回滚。",
        );
      if (target.status === "enabled" && String(current.code) === "1688_search") {
        const [acceptance] = await c.query<RowDataPacket[]>(
          [
            "SELECT COUNT(*) count FROM provider_parser_samples s WHERE s.provider_id=? AND ",
            "s.status='active' AND s.review_status='approved' AND s.last_replay_status='passed' AND EXISTS (SELECT 1 FROM ",
            "provider_parser_sample_replay_runs r WHERE r.sample_id=s.id AND r.parser_version=? AND ",
            "r.status='passed' AND r.created_at=s.last_replay_at) AND EXISTS (SELECT 1 FROM crawler_profiles cp ",
            "JOIN credential_assets ca ON ca.id=cp.credential_asset_id AND ca.provider_id=cp.provider_id ",
            "JOIN crawler_browser_runs br ON br.crawler_profile_id=cp.id AND br.provider_id=cp.provider_id ",
            "WHERE cp.provider_id=s.provider_id AND cp.status='active' AND ca.status='active' AND ",
            "(ca.expires_at IS NULL OR ca.expires_at>NOW(3)) AND br.status IN ('succeeded','succeeded_empty') AND ",
            "br.finished_at>=GREATEST(cp.updated_at,ca.updated_at))",
          ].join(""),
          [input.providerId, current.parser_version],
        );
        if (Number(acceptance[0]?.count ?? 0) < 1)
          throw new ProviderSourceServiceError(
            "provider_source_setup_required",
            409,
            "历史版本要求启用 1688，但当前登录态、验证码或解析验收未通过，不能回滚。",
          );
      }
      if (
        target.status === "enabled" &&
        ["public_page", "public_rss"].includes(String(current.access_mode)) &&
        (current.terms_review_status !== "approved" ||
          !current.terms_reference_url ||
          !current.terms_version ||
          !current.terms_expires_at ||
          new Date(current.terms_expires_at) <= input.now)
      )
        throw new ProviderSourceServiceError(
          "provider_source_compliance_required",
          409,
          "历史版本要求启用公开来源，但当前条款版本缺失、已到期或审查未通过，不能回滚。",
        );
      if (
        target.status === "enabled" &&
        current.status !== "enabled" &&
        ["public_page", "public_rss"].includes(String(current.access_mode))
      )
        await requireCurrentPublicSmokeTest(c, current, target.timeout_ms);
      const nextVersion = Number(current.version) + 1;
      await c.query(
        [
          "UPDATE providers SET schedule_minutes=?,timeout_ms=?,retry_limit=?,status=?,version=?,updated_by=?,u",
          "pdated_at=? WHERE id=?",
        ].join(""),
        [
          target.schedule_minutes,
          target.timeout_ms,
          target.retry_limit,
          target.status,
          nextVersion,
          input.actorId,
          input.now,
          input.providerId,
        ],
      );
      const snapshot = {
        ...current,
        ...target,
        version: nextVersion,
        updated_by: input.actorId,
        updated_at: input.now,
      };
      await c.query(
        [
          "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id,action,request_id,trace",
          "_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.providerId,
          nextVersion,
          JSON.stringify(snapshot),
          input.actorId,
          "configuration_rolled_back",
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO provider_source_operations (id,actor_id,route,idempotency_key,provider_id,replay_run_id,",
          "created_at) VALUES (?,?,?,?,?,NULL,?)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.providerId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,reso",
          "urce_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) ",
          "VALUES(?,NULL,NULL,?,'provider.configuration.rolled_back','provider',?,'succeeded',?,?,?,?,1)",
        ].join(""),
        [
          randomUUID(),
          input.actorId,
          input.providerId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            reason: input.reason,
            from_version: input.expectedVersion,
            target_version: input.targetVersion,
            to_version: nextVersion,
            changes: configurationChanges(configuration(current), target).map(({ field }) => field),
          }),
          input.now,
        ],
      );
      await c.commit();
      return {
        id: String(current.id),
        code: String(current.code),
        status: target.status as ProvisionedSource["status"],
        version: nextVersion,
        schedule_minutes: target.schedule_minutes,
        timeout_ms: target.timeout_ms,
        retry_limit: target.retry_limit,
        updated_at: input.now.toISOString(),
        last_success: null,
      };
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError(
          "provider_configuration_conflict",
          409,
          "刷新来源版本后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
}
