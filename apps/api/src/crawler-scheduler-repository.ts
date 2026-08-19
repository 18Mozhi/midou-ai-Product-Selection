import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { CrawlerSchedulerRepository as Contract } from "./crawler-scheduler-service.js";

const n = (value: unknown) => Number(value ?? 0);
const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();

export class CrawlerSchedulerRepository implements Contract {
  constructor(private readonly pool: Pool) {}
  async snapshot(now: Date) {
    const [[leases], [providers], [profiles], [duplicates], [activeLeases]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT slot_type,COUNT(*) total FROM crawler_scheduler_leases WHERE expires_at>? GROUP BY slot_type",
        [now],
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT p.id,p.code,p.concurrency_limit configured_concurrency,
          LEAST(p.concurrency_limit,1) effective_concurrency,COUNT(l.slot_key) active_leases
         FROM providers p
         LEFT JOIN crawler_scheduler_leases l
           ON l.slot_type='provider' AND l.slot_key=p.id AND l.expires_at>?
         WHERE p.status='enabled'
         GROUP BY p.id,p.code,p.concurrency_limit
         ORDER BY p.code`,
        [now],
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT p.id,COUNT(l.crawler_profile_id) active_leases
         FROM crawler_profiles p
         LEFT JOIN crawler_profile_leases l
           ON l.crawler_profile_id=p.id AND l.expires_at>?
         WHERE p.status='active'
         GROUP BY p.id
         ORDER BY p.id`,
        [now],
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total
         FROM (
           SELECT slot_type,slot_key,COUNT(*) c
           FROM crawler_scheduler_leases
           WHERE expires_at>?
           GROUP BY slot_type,slot_key
           HAVING c>1
         ) duplicated`,
        [now],
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT l.slot_type,l.task_id,l.run_id,l.lease_owner,l.heartbeat_at,l.expires_at,
          t.status task_status,p.name provider_name
         FROM crawler_scheduler_leases l
         LEFT JOIN collection_tasks t ON t.id=l.task_id
         LEFT JOIN providers p
           ON p.id=CASE WHEN l.slot_type='provider' THEN l.slot_key ELSE NULL END
         WHERE l.expires_at>?
         ORDER BY FIELD(l.slot_type,'worker','provider','crawler'),l.leased_at,l.slot_key
         LIMIT 100`,
        [now],
      ),
    ]);
    const count = (type: string) => n(leases.find((row) => row.slot_type === type)?.total);
    return {
      active_worker_leases: count("worker"),
      active_crawler_leases: count("crawler"),
      duplicate_lease_count: n(duplicates[0]?.total),
      active_leases: activeLeases.map((row) => ({
        slot_type: String(row.slot_type) as "worker" | "crawler" | "provider",
        provider_name: row.provider_name == null ? null : String(row.provider_name),
        task_id: row.task_id == null ? null : String(row.task_id),
        task_status: row.task_status == null ? null : String(row.task_status),
        run_id: row.run_id == null ? null : String(row.run_id),
        process_role:
          row.slot_type === "crawler" ? ("python_crawler" as const) : ("node_worker" as const),
        process_ref: String(row.lease_owner),
        heartbeat_at: iso(row.heartbeat_at),
        expires_at: iso(row.expires_at),
      })),
      providers: providers.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        configured_concurrency: n(row.configured_concurrency),
        effective_concurrency: n(row.effective_concurrency),
        active_leases: n(row.active_leases),
      })),
      profiles: profiles.map((row) => ({
        id: String(row.id),
        active_leases: n(row.active_leases),
      })),
    };
  }
  async record(input: Parameters<Contract["record"]>[0]) {
    const c = await this.pool.getConnection(),
      id = randomUUID();
    try {
      await c.beginTransaction();
      await c.query(
        `INSERT INTO crawler_scheduler_observations(
          id,source,state,worker_instances,crawler_instances,active_worker_leases,
          active_crawler_leases,duplicate_lease_count,load_basis_points,available_memory_mb,
          free_disk_mb,provider_count,profile_count,finding_codes_json,request_id,trace_id,observed_at
        ) VALUES(?,'api_full',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          input.evaluation.state,
          input.snapshot.worker_instances,
          input.snapshot.crawler_instances,
          input.snapshot.active_worker_leases,
          input.snapshot.active_crawler_leases,
          input.snapshot.duplicate_lease_count,
          input.snapshot.resource.load_basis_points,
          input.snapshot.resource.available_memory_mb,
          input.snapshot.resource.free_disk_mb,
          input.snapshot.providers.length,
          input.snapshot.profiles.length,
          JSON.stringify(input.evaluation.findings.map((item) => item.code)),
          input.requestId,
          input.traceId,
          input.observedAt,
        ],
      );
      await c.query(
        `INSERT INTO platform_audit_events(
          id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,
          outcome,request_id,trace_id,metadata,occurred_at,schema_version
        ) VALUES(?,NULL,NULL,?,'platform.crawler_scheduler.read','crawler_scheduler',?,'succeeded',?,?,?,?,1)`,
        [
          randomUUID(),
          input.actorId,
          id,
          input.requestId,
          input.traceId,
          JSON.stringify({
            state: input.evaluation.state,
            worker_instances: input.snapshot.worker_instances,
            crawler_instances: input.snapshot.crawler_instances,
            active_worker_leases: input.snapshot.active_worker_leases,
            active_crawler_leases: input.snapshot.active_crawler_leases,
            capacity_claim: "unverified",
          }),
          input.observedAt,
        ],
      );
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async recoverExpired(input: Parameters<Contract["recoverExpired"]>[0]) {
    const c = await this.pool.getConnection(),
      route = "/platform/operations/crawler-scheduler/recover-expired";
    try {
      await c.beginTransaction();
      const [replay] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM crawler_scheduler_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
        [input.actorId, route, input.idempotencyKey],
      );
      if (replay[0]) {
        await c.commit();
        const value =
          typeof replay[0].result_json === "string"
            ? JSON.parse(replay[0].result_json)
            : replay[0].result_json;
        return { recovered: n(value.recovered) };
      }
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT slot_type,slot_key,slot_no FROM crawler_scheduler_leases WHERE expires_at<=? FOR UPDATE",
        [input.now],
      );
      if (rows.length)
        await c.query("DELETE FROM crawler_scheduler_leases WHERE expires_at<=?", [input.now]);
      const result = { recovered: rows.length };
      await c.query(
        `INSERT INTO crawler_scheduler_operations(
          id,actor_id,route,idempotency_key,result_json,request_id,trace_id,created_at
        ) VALUES(?,?,?,?,?,?,?,?)`,
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          JSON.stringify(result),
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        `INSERT INTO platform_audit_events(
          id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,
          outcome,request_id,trace_id,metadata,occurred_at,schema_version
        ) VALUES(
          ?,NULL,NULL,?,'platform.crawler_scheduler.recover_expired',
          'crawler_scheduler',NULL,'succeeded',?,?,?,?,1
        )`,
        [
          randomUUID(),
          input.actorId,
          input.requestId,
          input.traceId,
          JSON.stringify(result),
          input.now,
        ],
      );
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
}
