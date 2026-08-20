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
        "SELECT p.id,p.code,p.concurrency_limit configured_concurrency,\n          LEAST(p.concurrency_limit," +
          "1) effective_concurrency,\n          COALESCE(l.active_leases,0) active_leases," +
          "\n          COALESCE(w.queued_tasks,0) queued_tasks,\n          COALESCE(w.longest_queue_wait_seconds," +
          "0) longest_queue_wait_seconds\n         FROM providers p\n         LEFT JOIN (\n       " +
          "    SELECT slot_key provider_id,COUNT(*) active_leases\n           FROM crawler_scheduler_leases\n" +
          "           WHERE slot_type='provider' AND expires_at>?\n           GROUP BY slot_key\n" +
          "         ) l ON l.provider_id=p.id\n         LEFT JOIN (\n           SELECT q.provider_id," +
          "COUNT(DISTINCT t.id) queued_tasks,\n             MAX(TIMESTAMPDIFF(SECOND," +
          "t.available_at,?)) longest_queue_wait_seconds\n           FROM collection_subqueries " +
          "q\n           JOIN collection_tasks t ON t.id=q.task_id\n           WHERE t.status IN " +
          "('scheduled','queued','retry_scheduled','rate_limited')\n             AND t.available_at<=?\n" +
          "           GROUP BY q.provider_id\n         ) w ON w.provider_id=p.id\n         WHERE " +
          "p.status='enabled'\n         ORDER BY p.code",
        [now, now, now],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT p.id,COUNT(l.crawler_profile_id) active_leases\n         FROM crawler_profiles " +
          "p\n         LEFT JOIN crawler_profile_leases l\n           ON l.crawler_profile_id=p.id " +
          "AND l.expires_at>?\n         WHERE p.status='active'\n         GROUP BY p.id\n         " +
          "ORDER BY p.id",
        [now],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total\n         FROM (\n           SELECT slot_type,slot_key," +
          "COUNT(*) c\n           FROM crawler_scheduler_leases\n           WHERE expires_at>?\n  " +
          "         GROUP BY slot_type,slot_key\n           HAVING c>1\n         ) duplicated",
        [now],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT l.slot_type,l.task_id,l.run_id,l.lease_owner,l.heartbeat_at,l.expires_at," +
          "\n          t.status task_status,p.name provider_name\n         FROM crawler_scheduler_leases " +
          "l\n         LEFT JOIN collection_tasks t ON t.id=l.task_id\n         LEFT JOIN providers " +
          "p\n           ON p.id=CASE WHEN l.slot_type='provider' THEN l.slot_key ELSE NULL END\n" +
          "         WHERE l.expires_at>?\n         ORDER BY FIELD(l.slot_type,'worker'," +
          "'provider','crawler'),l.leased_at,l.slot_key\n         LIMIT 100",
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
        queued_tasks: n(row.queued_tasks),
        longest_queue_wait_seconds: n(row.longest_queue_wait_seconds),
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
        "INSERT INTO crawler_scheduler_observations(\n          id,source,state,worker_instances," +
          "crawler_instances,active_worker_leases,\n          active_crawler_leases," +
          "duplicate_lease_count,load_basis_points,available_memory_mb,\n          free_disk_mb," +
          "provider_count,profile_count,finding_codes_json,request_id,trace_id,observed_at\n    " +
          "    ) VALUES(?,'api_full',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
        "INSERT INTO platform_audit_events(\n          id,organization_id,workspace_id," +
          "actor_id,action,resource_type,resource_id,\n          outcome,request_id," +
          "trace_id,metadata,occurred_at,schema_version\n        ) VALUES(?,NULL,NULL," +
          "?,'platform.crawler_scheduler.read','crawler_scheduler',?,'succeeded',?," +
          "?,?,?,1)",
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
        "INSERT INTO crawler_scheduler_operations(\n          id,actor_id,route,idempotency_key," +
          "result_json,request_id,trace_id,created_at\n        ) VALUES(?,?,?,?,?,?," +
          "?,?)",
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
        "INSERT INTO platform_audit_events(\n          id,organization_id,workspace_id," +
          "actor_id,action,resource_type,resource_id,\n          outcome,request_id," +
          "trace_id,metadata,occurred_at,schema_version\n        ) VALUES(\n          ?," +
          "NULL,NULL,?,'platform.crawler_scheduler.recover_expired',\n          'crawler_scheduler'," +
          "NULL,'succeeded',?,?,?,?,1\n        )",
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
