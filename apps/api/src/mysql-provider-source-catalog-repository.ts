import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { ProviderSourceRepository, ProvisionedSource } from "./provider-source-service.js";
import { ProviderSourceServiceError } from "./provider-source-service.js";
import {
  providerSourceByOperation,
  provisioned,
} from "./mysql-provider-source-repository-shared.js";

export class MySqlProviderSourceCatalogRepository {
  constructor(private readonly pool: Pool) {}
  async listProvisioned(codes: string[]) {
    if (!codes.length) return [];
    const [rows] = await this.pool.query<RowDataPacket[]>(
      [
        "SELECT p.id,p.code,p.status,p.version,p.schedule_minutes,p.concurrency_limit,p.timeout_ms,",
        "p.retry_limit,p.updated_at,(SELECT COUNT(*) FROM collection_subqueries active WHERE ",
        "active.provider_id=p.id AND active.status IN ('pending','running')) active_subquery_count,",
        "last_success.task_id last_success_task_id,last_success.status last_success_status,",
        "last_success.available_result_count last_success_result_count,",
        "last_success.finished_at last_success_finished_at FROM providers p LEFT JOIN collection_subqueries ",
        "last_success ON last_success.id=(SELECT candidate.id FROM collection_subqueries candidate WHERE ",
        "candidate.provider_id=p.id AND candidate.status IN ('succeeded','succeeded_empty') AND ",
        "candidate.finished_at IS NOT NULL ORDER BY candidate.finished_at DESC,candidate.id DESC LIMIT 1) ",
        `WHERE p.code IN (${codes.map(() => "?").join(",")})`,
      ].join(""),
      codes,
    );
    return rows.map(provisioned);
  }
  async syncCatalog(input: Parameters<ProviderSourceRepository["syncCatalog"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [actors] = await c.query<RowDataPacket[]>(
          [
            "SELECT pra.user_id FROM platform_role_assignments pra JOIN users u ON u.id=pra.user_id WHERE ",
            "pra.role_code='platform_super_admin' AND u.status='active' ORDER BY pra.created_at LIMIT 1 FOR ",
            "UPDATE",
          ].join(""),
        ),
        actorId = actors[0]?.user_id ? String(actors[0].user_id) : null;
      if (!actorId) {
        await c.rollback();
        return {
          inserted: 0,
          updated: 0,
          automatic_enabled: 0,
          status: "waiting_for_platform_admin" as const,
        };
      }
      let inserted = 0,
        updated = 0,
        automatic = 0;
      for (const d of input.definitions) {
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT id,status,version FROM providers WHERE code=? FOR UPDATE",
          [d.code],
        );
        const current = rows[0];
        if (current) {
          await c.query(
            [
              "UPDATE providers SET name=?,target_url=?,access_mode=?,markets_json=?,languages_json=?,fields_json=?",
              ",dedupe_key=?,failure_rules_json=?,parser_version=?,healthcheck_url=?,owner_label=?,updated_at=? ",
              "WHERE id=?",
            ].join(""),
            [
              d.name,
              d.target_url,
              d.access_mode,
              JSON.stringify(d.markets),
              JSON.stringify(d.languages),
              JSON.stringify(d.fields),
              d.dedupe_key,
              JSON.stringify(d.failure_rules),
              d.parser_version,
              d.healthcheck_url,
              d.owner_label,
              input.now,
              current.id,
            ],
          );
          updated += 1;
          if (current.status === "enabled" && d.availability === "automatic") automatic += 1;
          continue;
        }
        const id = randomUUID(),
          status = d.status;
        await c.query(
          [
            "INSERT INTO providers (id,code,name,target_url,access_mode,markets_json,languages_json,fields_json,s",
            "chedule_minutes,concurrency_limit,timeout_ms,retry_limit,circuit_failure_threshold,dedupe_key,retent",
            "ion_days,failure_rules_json,parser_version,healthcheck_url,owner_label,status,version,created_by,upd",
            "ated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
          ].join(""),
          [
            id,
            d.code,
            d.name,
            d.target_url,
            d.access_mode,
            JSON.stringify(d.markets),
            JSON.stringify(d.languages),
            JSON.stringify(d.fields),
            d.schedule_minutes,
            d.concurrency_limit,
            d.timeout_ms,
            d.retry_limit,
            d.circuit_failure_threshold,
            d.dedupe_key,
            d.retention_days,
            JSON.stringify(d.failure_rules),
            d.parser_version,
            d.healthcheck_url,
            d.owner_label,
            status,
            actorId,
            actorId,
            input.now,
            input.now,
          ],
        );
        await c.query(
          [
            "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id,action,request_id,trace",
            "_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          ].join(""),
          [
            randomUUID(),
            id,
            1,
            JSON.stringify({ ...d, id, status, version: 1 }),
            actorId,
            "created",
            "automatic-source-catalog",
            "automatic-source-catalog",
            input.now,
          ],
        );
        inserted += 1;
        if (status === "enabled" && d.availability === "automatic") automatic += 1;
      }
      await c.commit();
      return { inserted, updated, automatic_enabled: automatic, status: "synced" as const };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async provision(input: Parameters<ProviderSourceRepository["provision"]>[0]) {
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
      const [existing] = await c.query<RowDataPacket[]>(
        "SELECT id,code,status,version,updated_at FROM providers WHERE code=? FOR UPDATE",
        [input.definition.code],
      );
      if (existing[0])
        throw new ProviderSourceServiceError(
          "provider_source_already_provisioned",
          409,
          "来源已经自动登记，请直接查看状态或手动刷新。",
        );
      const d = input.definition,
        status = d.status;
      await c.query(
        [
          "INSERT INTO providers (id,code,name,target_url,access_mode,markets_json,languages_json,fields_json,s",
          "chedule_minutes,concurrency_limit,timeout_ms,retry_limit,circuit_failure_threshold,dedupe_key,retent",
          "ion_days,failure_rules_json,parser_version,healthcheck_url,owner_label,status,version,created_by,upd",
          "ated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
        ].join(""),
        [
          input.providerId,
          d.code,
          d.name,
          d.target_url,
          d.access_mode,
          JSON.stringify(d.markets),
          JSON.stringify(d.languages),
          JSON.stringify(d.fields),
          d.schedule_minutes,
          d.concurrency_limit,
          d.timeout_ms,
          d.retry_limit,
          d.circuit_failure_threshold,
          d.dedupe_key,
          d.retention_days,
          JSON.stringify(d.failure_rules),
          d.parser_version,
          d.healthcheck_url,
          d.owner_label,
          status,
          input.actorId,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      const result: ProvisionedSource = {
        id: input.providerId,
        code: d.code,
        status,
        version: 1,
        schedule_minutes: d.schedule_minutes,
        timeout_ms: d.timeout_ms,
        retry_limit: d.retry_limit,
        updated_at: input.now.toISOString(),
        last_success: null,
      };
      await c.query(
        [
          "INSERT INTO provider_versions (id,provider_id,version,snapshot_json,actor_id,action,request_id,trace",
          "_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ].join(""),
        [
          randomUUID(),
          input.providerId,
          1,
          JSON.stringify({ ...d, id: input.providerId, status, version: 1 }),
          input.actorId,
          "created",
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
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      if (error instanceof ProviderSourceServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProviderSourceServiceError("provider_source_conflict", 409, "刷新目录后重试。");
      throw error;
    } finally {
      c.release();
    }
  }
}
