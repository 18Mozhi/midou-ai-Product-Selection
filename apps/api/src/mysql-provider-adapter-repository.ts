import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  AdapterRuntimeHealthWindow,
  ProviderAdapterRepository,
  StoredAdapterHealth,
} from "./provider-adapter-service.js";
import { ProviderAdapterServiceError, toRuntimeProvider } from "./provider-adapter-service.js";

const providerColumns =
  "id,code,name,access_mode,target_url,parser_version,timeout_ms,fields_json,status";
const unknown = (providerId: string): StoredAdapterHealth => ({
  providerId,
  adapterVersion: null,
  healthStatus: "unknown",
  lastCheckedAt: null,
  lastLatencyMs: null,
  lastErrorCode: null,
  consecutiveFailures: 0,
  version: 0,
  updatedAt: new Date(0).toISOString(),
});
const health = (row: RowDataPacket, providerId = String(row.provider_id)): StoredAdapterHealth =>
  row.health_status == null
    ? unknown(providerId)
    : {
        providerId,
        adapterVersion: row.adapter_version == null ? null : String(row.adapter_version),
        healthStatus: row.health_status,
        lastCheckedAt: new Date(row.last_checked_at).toISOString(),
        lastLatencyMs: row.last_latency_ms == null ? null : Number(row.last_latency_ms),
        lastErrorCode: row.last_error_code == null ? null : String(row.last_error_code),
        consecutiveFailures: Number(row.consecutive_failures),
        version: Number(row.health_version ?? row.version),
        updatedAt: new Date(row.health_updated_at ?? row.updated_at).toISOString(),
      };

const percentile = (values: number[], ratio: number) =>
  values.length ? values[Math.ceil(values.length * ratio) - 1]! : null;
const runtimeCategory = (row: RowDataPacket): AdapterRuntimeHealthWindow["latestCategory"] => {
  const status = String(row.status ?? ""),
    code = String(row.error_code ?? "");
  if (status === "succeeded_empty" || code === "empty_result") return "empty";
  if (status === "succeeded") return "healthy";
  if (
    ["network_error", "timeout", "rate_limited", "dependency_unavailable", "dns_error"].includes(
      code,
    )
  )
    return "network";
  if (
    [
      "source_changed",
      "parse_failed",
      "validation_failed",
      "invalid_payload",
      "response_too_large",
    ].includes(code)
  )
    return "parser";
  if (
    [
      "login_required",
      "session_expired",
      "credential_expired",
      "blocked_login",
      "blocked_captcha",
      "captcha",
    ].includes(code)
  )
    return "login";
  return code ? "other" : "unknown";
};
const runtimeWindow = (rows: RowDataPacket[]): AdapterRuntimeHealthWindow => {
  const completed = rows.filter((row) => row.finished_at != null),
    categories = completed.map(runtimeCategory),
    durations = completed
      .map((row) => Number(row.duration_ms))
      .filter(Number.isFinite)
      .sort((a, b) => a - b),
    succeeded = completed.filter((row) =>
      ["succeeded", "succeeded_empty"].includes(String(row.status)),
    ).length;
  return {
    latestCategory: completed[0] ? runtimeCategory(completed[0]) : "unknown",
    sampleCount: completed.length,
    successRateBasisPoints: completed.length
      ? Math.round((succeeded / completed.length) * 10_000)
      : null,
    durationP95Ms: percentile(durations, 0.95),
    networkFailureCount: categories.filter((value) => value === "network").length,
    parserFailureCount: categories.filter((value) => value === "parser").length,
    loginFailureCount: categories.filter((value) => value === "login").length,
    emptySuccessCount: categories.filter((value) => value === "empty").length,
  };
};

export class MySqlProviderAdapterRepository implements ProviderAdapterRepository {
  constructor(private readonly pool: Pool) {}

  async list() {
    const [[rows], [samples]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT p.*,h.adapter_version,h.health_status,h.last_checked_at,h.last_latency_ms," +
          "h.last_error_code,h.consecutive_failures,h.version health_version,h.updated_at health_updated_at " +
          "FROM providers p LEFT JOIN provider_adapter_health h ON h.provider_id=p.id ORDER BY " +
          "p.status='enabled' DESC,p.name,p.id",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT provider_id,status,error_code,finished_at," +
          "TIMESTAMPDIFF(MICROSECOND,started_at,finished_at)/1000 duration_ms " +
          "FROM collection_subqueries WHERE finished_at>=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 24 HOUR) " +
          "ORDER BY provider_id,finished_at DESC LIMIT 5000",
      ),
    ]);
    const byProvider = new Map<string, RowDataPacket[]>();
    for (const sample of samples) {
      const key = String(sample.provider_id);
      byProvider.set(key, [...(byProvider.get(key) ?? []), sample]);
    }
    return rows.map((row) => ({
      provider: toRuntimeProvider(row),
      health: health(row, String(row.id)),
      runtime: runtimeWindow(byProvider.get(String(row.id)) ?? []),
    }));
  }

  async runtimeWindow(providerId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT provider_id,status,error_code,finished_at," +
        "TIMESTAMPDIFF(MICROSECOND,started_at,finished_at)/1000 duration_ms " +
        "FROM collection_subqueries WHERE provider_id=? " +
        "AND finished_at>=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 24 HOUR) " +
        "ORDER BY finished_at DESC LIMIT 5000",
      [providerId],
    );
    return runtimeWindow(rows);
  }

  async getProvider(id: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ${providerColumns} FROM providers WHERE id=? LIMIT 1`,
      [id],
    );
    return rows[0] ? toRuntimeProvider(rows[0]) : null;
  }

  async findReplay(input: Parameters<ProviderAdapterRepository["findReplay"]>[0]) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT v.snapshot_json FROM provider_adapter_operations o JOIN provider_adapter_health_versions " +
        "v ON v.provider_id=o.provider_id AND v.version=o.result_version WHERE o.provider_id=? " +
        "AND o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
      [input.providerId, input.actorId, input.route, input.idempotencyKey],
    );
    if (!rows[0]) return null;
    const value =
      typeof rows[0].snapshot_json === "string"
        ? JSON.parse(rows[0].snapshot_json)
        : rows[0].snapshot_json;
    return value as StoredAdapterHealth;
  }

  async recordHealth(input: Parameters<ProviderAdapterRepository["recordHealth"]>[0]) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const replay = await this.replay(connection, input);
      if (replay) {
        await connection.commit();
        return replay;
      }
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT version,consecutive_failures FROM provider_adapter_health WHERE provider_id=? FOR UPDATE",
        [input.provider.id],
      );
      const previous = rows[0];
      const version = previous ? Number(previous.version) + 1 : 1;
      const failures =
        input.signal.status === "ready" ? 0 : Number(previous?.consecutive_failures ?? 0) + 1;
      const result: StoredAdapterHealth = {
        providerId: input.provider.id,
        adapterVersion: input.adapterVersion,
        healthStatus: input.signal.status,
        lastCheckedAt: input.now.toISOString(),
        lastLatencyMs: input.signal.latencyMs,
        lastErrorCode: input.signal.errorCode,
        consecutiveFailures: failures,
        version,
        updatedAt: input.now.toISOString(),
      };
      await connection.query(
        "INSERT INTO provider_adapter_health (provider_id,adapter_version,health_status," +
          "last_checked_at,last_latency_ms,last_error_code,consecutive_failures,version," +
          "updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE adapter_version=VALUES(adapter_version)," +
          "health_status=VALUES(health_status),last_checked_at=VALUES(last_checked_at)," +
          "last_latency_ms=VALUES(last_latency_ms),last_error_code=VALUES(last_error_code)," +
          "consecutive_failures=VALUES(consecutive_failures),version=VALUES(version)," +
          "updated_at=VALUES(updated_at)",
        [
          input.provider.id,
          input.adapterVersion,
          input.signal.status,
          input.now,
          input.signal.latencyMs,
          input.signal.errorCode,
          failures,
          version,
          input.now,
        ],
      );
      await connection.query(
        "INSERT INTO provider_adapter_health_versions (id,provider_id,version,snapshot_json," +
          "actor_id,action,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?," +
          "?)",
        [
          randomUUID(),
          input.provider.id,
          version,
          JSON.stringify(result),
          input.actorId,
          "checked",
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await connection.query(
        "INSERT INTO provider_adapter_operations (id,actor_id,idempotency_key,route," +
          "provider_id,result_version,request_id,trace_id,created_at) VALUES (?,?,?," +
          "?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          input.idempotencyKey,
          input.route,
          input.provider.id,
          version,
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await connection.commit();
      return result;
    } catch (error: unknown) {
      await connection.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderAdapterServiceError(
          "provider_adapter_probe_conflict",
          409,
          "刷新适配器状态后重试。",
        );
      throw error;
    } finally {
      connection.release();
    }
  }

  private async replay(
    connection: PoolConnection,
    input: Parameters<ProviderAdapterRepository["recordHealth"]>[0],
  ) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT v.snapshot_json FROM provider_adapter_operations o JOIN provider_adapter_health_versions " +
        "v ON v.provider_id=o.provider_id AND v.version=o.result_version WHERE o.provider_id=? " +
        "AND o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
      [input.provider.id, input.actorId, input.route, input.idempotencyKey],
    );
    if (!rows[0]) return null;
    const value =
      typeof rows[0].snapshot_json === "string"
        ? JSON.parse(rows[0].snapshot_json)
        : rows[0].snapshot_json;
    return value as StoredAdapterHealth;
  }
}
