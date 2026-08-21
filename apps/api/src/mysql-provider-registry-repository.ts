import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { ProviderDefinition } from "@scoutops/contracts";
import {
  ProviderRegistryError,
  type ProviderRegistryRepository,
} from "./provider-registry-service.js";
const parse = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value),
  fromRow = (r: RowDataPacket): ProviderDefinition => ({
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    target_url: String(r.target_url),
    access_mode: r.access_mode,
    markets: parse(r.markets_json),
    languages: parse(r.languages_json),
    fields: parse(r.fields_json),
    schedule_minutes: Number(r.schedule_minutes),
    concurrency_limit: Number(r.concurrency_limit),
    timeout_ms: Number(r.timeout_ms),
    retry_limit: Number(r.retry_limit),
    circuit_failure_threshold: Number(r.circuit_failure_threshold),
    dedupe_key: String(r.dedupe_key),
    retention_days: Number(r.retention_days),
    failure_rules: parse(r.failure_rules_json),
    parser_version: String(r.parser_version),
    healthcheck_url: r.healthcheck_url === null ? null : String(r.healthcheck_url),
    owner_label: String(r.owner_label),
    terms_review_status: r.terms_review_status,
    terms_reference_url: r.terms_reference_url === null ? null : String(r.terms_reference_url),
    terms_version: r.terms_version === null ? null : String(r.terms_version),
    terms_expires_at:
      r.terms_expires_at === null ? null : new Date(r.terms_expires_at).toISOString(),
    terms_reviewed_at:
      r.terms_reviewed_at === null ? null : new Date(r.terms_reviewed_at).toISOString(),
    status: r.status,
    version: Number(r.version),
    updated_at: new Date(r.updated_at).toISOString(),
  });
const columns = [
  "id,code,name,target_url,access_mode,markets_json,languages_json,fields_json",
  "schedule_minutes,concurrency_limit,timeout_ms,retry_limit,circuit_failure_threshold",
  "dedupe_key,retention_days,failure_rules_json,parser_version,healthcheck_url,owner_label",
  "terms_review_status,terms_reference_url,terms_version,terms_expires_at,terms_reviewed_at,status,version,updated_at",
].join(",");
export class MySqlProviderRegistryRepository implements ProviderRegistryRepository {
  constructor(private readonly pool: Pool) {}
  async list() {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ${columns} FROM providers ORDER BY status='enabled' DESC,name,id`,
    );
    return rows.map(fromRow);
  }
  private async replay(c: PoolConnection, actor: string, route: string, key: string) {
    const [rows] = await c.query<RowDataPacket[]>(
      [
        `SELECT ${columns.replaceAll(/\b(id|version)\b/g, (m) => `p.${m}`)}`,
        "FROM provider_operations o JOIN providers p ON p.id=o.provider_id",
        "WHERE o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
      ].join(" "),
      [actor, route, key],
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }
  async create(input: Parameters<ProviderRegistryRepository["create"]>[0]) {
    const c = await this.pool.getConnection(),
      route = "/platform/providers";
    try {
      await c.beginTransaction();
      const replay = await this.replay(c, input.actorId, route, input.idempotencyKey);
      if (replay) {
        await c.commit();
        return replay;
      }
      const v = input.value;
      await c.query(
        [
          "INSERT INTO providers",
          "(id,code,name,target_url,access_mode,markets_json,languages_json,fields_json",
          ",schedule_minutes,concurrency_limit,timeout_ms,retry_limit,circuit_failure_threshold",
          ",dedupe_key,retention_days,failure_rules_json,parser_version,healthcheck_url,owner_label",
          ",terms_review_status,terms_reference_url,terms_version,terms_expires_at,terms_reviewed_at,status,version",
          ",created_by,updated_by,created_at,updated_at)",
          "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
        ].join(""),
        [
          input.id,
          v.code,
          v.name,
          v.target_url,
          v.access_mode,
          JSON.stringify(v.markets),
          JSON.stringify(v.languages),
          JSON.stringify(v.fields),
          v.schedule_minutes,
          v.concurrency_limit,
          v.timeout_ms,
          v.retry_limit,
          v.circuit_failure_threshold,
          v.dedupe_key,
          v.retention_days,
          JSON.stringify(v.failure_rules),
          v.parser_version,
          v.healthcheck_url,
          v.owner_label,
          v.terms_review_status,
          v.terms_reference_url,
          v.terms_version,
          v.terms_expires_at ? new Date(v.terms_expires_at) : null,
          v.terms_reviewed_at ? new Date(v.terms_reviewed_at) : null,
          v.status,
          input.actorId,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      const result = { id: input.id, ...v, version: 1, updated_at: input.now.toISOString() };
      await c.query(
        "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id," +
          "action,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.id,
          1,
          JSON.stringify(result),
          input.actorId,
          "created",
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        "INSERT INTO provider_operations (id,actor_id,idempotency_key,route,provider_id," +
          "result_version,created_at) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), input.actorId, input.idempotencyKey, route, input.id, 1, input.now],
      );
      await c.commit();
      return result;
    } catch (error: any) {
      await c.rollback();
      if (error?.code === "ER_DUP_ENTRY")
        throw new ProviderRegistryError(
          "provider_conflict",
          409,
          "更换 code 或 Idempotency-Key 后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async update(input: Parameters<ProviderRegistryRepository["update"]>[0]) {
    const c = await this.pool.getConnection(),
      route = `/platform/providers/${input.id}`;
    try {
      await c.beginTransaction();
      const replay = await this.replay(c, input.actorId, route, input.idempotencyKey);
      if (replay) {
        await c.commit();
        return replay;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT version FROM providers WHERE id=? FOR UPDATE",
        [input.id],
      );
      if (!rows[0]) throw new ProviderRegistryError("provider_not_found", 404, "刷新来源列表。");
      if (Number(rows[0].version) !== input.expectedVersion)
        throw new ProviderRegistryError(
          "provider_version_conflict",
          409,
          "刷新最新版本后重新提交。",
        );
      const v = input.value,
        next = input.expectedVersion + 1;
      await c.query(
        [
          "UPDATE providers SET code=?,name=?,target_url=?,access_mode=?,markets_json=?",
          ",languages_json=?,fields_json=?,schedule_minutes=?,concurrency_limit=?,timeout_ms=?",
          ",retry_limit=?,circuit_failure_threshold=?,dedupe_key=?,retention_days=?",
          ",failure_rules_json=?,parser_version=?,healthcheck_url=?,owner_label=?",
          ",terms_review_status=?,terms_reference_url=?,terms_version=?,terms_expires_at=?,terms_reviewed_at=?,status=?",
          ",version=?,updated_by=?,updated_at=? WHERE id=?",
        ].join(""),
        [
          v.code,
          v.name,
          v.target_url,
          v.access_mode,
          JSON.stringify(v.markets),
          JSON.stringify(v.languages),
          JSON.stringify(v.fields),
          v.schedule_minutes,
          v.concurrency_limit,
          v.timeout_ms,
          v.retry_limit,
          v.circuit_failure_threshold,
          v.dedupe_key,
          v.retention_days,
          JSON.stringify(v.failure_rules),
          v.parser_version,
          v.healthcheck_url,
          v.owner_label,
          v.terms_review_status,
          v.terms_reference_url,
          v.terms_version,
          v.terms_expires_at ? new Date(v.terms_expires_at) : null,
          v.terms_reviewed_at ? new Date(v.terms_reviewed_at) : null,
          v.status,
          next,
          input.actorId,
          input.now,
          input.id,
        ],
      );
      const result = { id: input.id, ...v, version: next, updated_at: input.now.toISOString() };
      await c.query(
        "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id," +
          "action,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.id,
          next,
          JSON.stringify(result),
          input.actorId,
          "updated",
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        "INSERT INTO provider_operations (id,actor_id,idempotency_key,route,provider_id," +
          "result_version,created_at) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), input.actorId, input.idempotencyKey, route, input.id, next, input.now],
      );
      await c.commit();
      return result;
    } catch (error: any) {
      await c.rollback();
      if (error instanceof ProviderRegistryError) throw error;
      if (error?.code === "ER_DUP_ENTRY")
        throw new ProviderRegistryError(
          "provider_conflict",
          409,
          "更换 code 或 Idempotency-Key 后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
}
