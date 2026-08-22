import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  AdapterRuntimeHealthWindow,
  AdapterRuntimeCircuit,
  ProviderAdapterRepository,
  StoredAdapterHealth,
} from "./provider-adapter-service.js";
import type { ProviderPageCompatibilityObservation } from "@scoutops/contracts";
import { ProviderAdapterServiceError, toRuntimeProvider } from "./provider-adapter-service.js";

const providerColumns =
  "id,code,name,access_mode,target_url,parser_version,timeout_ms,fields_json,status,circuit_failure_threshold";
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
        consecutiveFailures: Number(row.health_consecutive_failures ?? row.consecutive_failures),
        version: Number(row.health_version ?? row.version),
        updatedAt: new Date(row.health_updated_at ?? row.updated_at).toISOString(),
      };

const runtimeCircuit = (row: Record<string, unknown>): AdapterRuntimeCircuit => ({
  state: row.runtime_circuit_state === "open" ? "open" : "closed",
  consecutiveFailures: Number(row.runtime_consecutive_failures ?? 0),
  lastErrorCode: row.runtime_last_error_code == null ? null : String(row.runtime_last_error_code),
  openedAt:
    row.runtime_circuit_opened_at == null
      ? null
      : new Date(String(row.runtime_circuit_opened_at)).toISOString(),
  recoveredAt:
    row.runtime_last_recovered_at == null
      ? null
      : new Date(String(row.runtime_last_recovered_at)).toISOString(),
  updatedAt:
    row.runtime_circuit_updated_at == null
      ? null
      : new Date(String(row.runtime_circuit_updated_at)).toISOString(),
});

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

const compatibilityStatus = (
  succeeded: number,
  parserFailures: number,
): ProviderPageCompatibilityObservation["status"] =>
  succeeded && parserFailures
    ? "mixed"
    : succeeded
      ? "compatible"
      : parserFailures
        ? "incompatible"
        : "unverified";

const compatibilityRows = (rows: RowDataPacket[]) => {
  const byProvider = new Map<string, ProviderPageCompatibilityObservation[]>();
  for (const row of rows) {
    const providerId = String(row.provider_id),
      succeeded = Number(row.succeeded_count),
      parserFailures = Number(row.parser_failure_count),
      observation: ProviderPageCompatibilityObservation = {
        parser_version: String(row.parser_version),
        page_version_sha256: String(row.content_sha256),
        status: compatibilityStatus(succeeded, parserFailures),
        observation_count: Number(row.observation_count),
        succeeded_count: succeeded,
        parser_failure_count: parserFailures,
        last_observed_at: new Date(row.last_observed_at).toISOString(),
      };
    const current = byProvider.get(providerId) ?? [];
    if (current.length < 8) current.push(observation);
    byProvider.set(providerId, current);
  }
  return byProvider;
};

const compatibilitySql = (filterProvider: boolean) =>
  [
    "SELECT evidence.provider_id,evidence.parser_version,evidence.content_sha256,",
    "COUNT(*) observation_count,MAX(evidence.captured_at) last_observed_at,",
    "SUM(CASE WHEN subquery.status IN ('succeeded','succeeded_empty') THEN 1 ELSE 0 END) succeeded_count,",
    "SUM(CASE WHEN subquery.error_code IN ('source_changed','parse_failed','validation_failed',",
    "'invalid_payload','response_too_large') THEN 1 ELSE 0 END) parser_failure_count FROM (",
    "SELECT provider_id,parser_version,content_sha256,captured_at,collection_subquery_id ",
    "FROM browser_evidence_artifacts WHERE kind='dom_fragment' AND status='active' ",
    "AND retention_until>UTC_TIMESTAMP(3)",
    filterProvider ? " AND provider_id=?" : "",
    " UNION ALL SELECT provider_id,parser_version,content_sha256,captured_at,collection_subquery_id ",
    "FROM raw_evidence WHERE status='active' AND retention_until>UTC_TIMESTAMP(3) ",
    "AND content_type LIKE 'text/html%'",
    filterProvider ? " AND provider_id=?" : "",
    ") evidence JOIN collection_subqueries subquery ON subquery.id=evidence.collection_subquery_id ",
    "GROUP BY evidence.provider_id,evidence.parser_version,evidence.content_sha256 ",
    "ORDER BY last_observed_at DESC LIMIT 5000",
  ].join("");

export class MySqlProviderAdapterRepository implements ProviderAdapterRepository {
  constructor(private readonly pool: Pool) {}

  async list() {
    const [[rows], [samples], [compatibility]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT p.*,h.adapter_version,h.health_status,h.last_checked_at,h.last_latency_ms," +
          "h.last_error_code,h.consecutive_failures health_consecutive_failures," +
          "h.version health_version,h.updated_at health_updated_at,c.state runtime_circuit_state," +
          "c.consecutive_failures runtime_consecutive_failures,c.last_error_code runtime_last_error_code," +
          "c.opened_at runtime_circuit_opened_at,c.recovered_at runtime_last_recovered_at," +
          "c.updated_at runtime_circuit_updated_at FROM providers p " +
          "LEFT JOIN provider_adapter_health h ON h.provider_id=p.id " +
          "LEFT JOIN provider_runtime_circuits c ON c.provider_id=p.id ORDER BY " +
          "p.status='enabled' DESC,p.name,p.id",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT provider_id,status,error_code,finished_at," +
          "TIMESTAMPDIFF(MICROSECOND,started_at,finished_at)/1000 duration_ms " +
          "FROM collection_subqueries WHERE finished_at>=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 24 HOUR) " +
          "ORDER BY provider_id,finished_at DESC LIMIT 5000",
      ),
      this.pool.query<RowDataPacket[]>(compatibilitySql(false)),
    ]);
    const byProvider = new Map<string, RowDataPacket[]>();
    for (const sample of samples) {
      const key = String(sample.provider_id);
      byProvider.set(key, [...(byProvider.get(key) ?? []), sample]);
    }
    const compatibilityByProvider = compatibilityRows(compatibility);
    return rows.map((row) => ({
      provider: toRuntimeProvider(row),
      health: health(row, String(row.id)),
      runtime: runtimeWindow(byProvider.get(String(row.id)) ?? []),
      circuit: runtimeCircuit(row),
      compatibility: compatibilityByProvider.get(String(row.id)) ?? [],
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

  async runtimeCircuit(providerId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT p.circuit_failure_threshold,c.state runtime_circuit_state," +
        "c.consecutive_failures runtime_consecutive_failures,c.last_error_code runtime_last_error_code," +
        "c.opened_at runtime_circuit_opened_at,c.recovered_at runtime_last_recovered_at," +
        "c.updated_at runtime_circuit_updated_at FROM providers p " +
        "LEFT JOIN provider_runtime_circuits c ON c.provider_id=p.id WHERE p.id=? LIMIT 1",
      [providerId],
    );
    return rows[0] ? runtimeCircuit(rows[0]) : runtimeCircuit({});
  }

  async compatibilityMatrix(providerId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(compatibilitySql(true), [
      providerId,
      providerId,
    ]);
    return compatibilityRows(rows).get(providerId) ?? [];
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
