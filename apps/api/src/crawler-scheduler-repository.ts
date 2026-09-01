import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  CrawlerSchedulerError,
  type CrawlerSchedulerRepository as Contract,
} from "./crawler-scheduler-service.js";

const n = (value: unknown) => Number(value ?? 0);
const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const percentile = (values: number[], ratio: number) =>
  values.length ? values[Math.ceil(values.length * ratio) - 1]! : 0;

export class CrawlerSchedulerRepository implements Contract {
  constructor(private readonly pool: Pool) {}
  async snapshot(now: Date, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const c = await this.pool.getConnection();
    try {
      await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await c.query("START TRANSACTION READ ONLY");
      const [
        [leases],
        [providers],
        [profiles],
        [duplicates],
        [expiredLeases],
        [activeLeases],
        [providerSamples],
        [trendRows],
        [receiptSpoolRows],
      ] = await Promise.all([
        c.query<RowDataPacket[]>(
          "SELECT slot_type,COUNT(*) total FROM crawler_scheduler_leases WHERE expires_at>? GROUP BY slot_type",
          [now],
        ),
        c.query<RowDataPacket[]>(
          "SELECT p.id,p.code,p.concurrency_limit configured_concurrency,p.circuit_failure_threshold," +
            "COALESCE(c.consecutive_failures,0) consecutive_failures,c.last_error_code,c.state runtime_circuit_state,\n          LEAST(p.concurrency_limit," +
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
            "           GROUP BY q.provider_id\n         ) w ON w.provider_id=p.id\n         LEFT JOIN " +
            "provider_runtime_circuits c ON c.provider_id=p.id WHERE p.status='enabled' ORDER BY p.code",
          [now, now, now],
        ),
        c.query<RowDataPacket[]>(
          "SELECT p.id,COUNT(l.crawler_profile_id) active_leases\n         FROM crawler_profiles " +
            "p\n         LEFT JOIN crawler_profile_leases l\n           ON l.crawler_profile_id=p.id " +
            "AND l.expires_at>?\n         WHERE p.status='active'\n         GROUP BY p.id\n         " +
            "ORDER BY p.id",
          [now],
        ),
        c.query<RowDataPacket[]>(
          "SELECT COUNT(*) total\n         FROM (\n           SELECT slot_type,slot_key," +
            "COUNT(*) c\n           FROM crawler_scheduler_leases\n           WHERE expires_at>?\n  " +
            "         GROUP BY slot_type,slot_key\n           HAVING c>1\n         ) duplicated",
          [now],
        ),
        c.query<RowDataPacket[]>(
          "SELECT COUNT(*) total,COUNT(DISTINCT task_id) task_count," +
            "SUM(slot_type='worker') worker,SUM(slot_type='crawler') crawler," +
            "SUM(slot_type='provider') provider,MIN(expires_at) oldest_expired_at " +
            "FROM crawler_scheduler_leases WHERE expires_at<=?",
          [now],
        ),
        c.query<RowDataPacket[]>(
          "SELECT l.slot_type,l.task_id,l.run_id,l.lease_owner,l.heartbeat_at,l.expires_at," +
            "\n          t.status task_status,p.name provider_name\n         FROM crawler_scheduler_leases " +
            "l\n         LEFT JOIN collection_tasks t ON t.id=l.task_id\n         LEFT JOIN providers " +
            "p\n           ON p.id=CASE WHEN l.slot_type='provider' THEN l.slot_key ELSE NULL END\n" +
            "         WHERE l.expires_at>?\n         ORDER BY FIELD(l.slot_type,'worker'," +
            "'provider','crawler'),l.leased_at,l.slot_key\n         LIMIT 100",
          [now],
        ),
        c.query<RowDataPacket[]>(
          "SELECT q.provider_id,q.status,TIMESTAMPDIFF(MICROSECOND,q.started_at,q.finished_at)/1000 duration_ms," +
            "CASE WHEN t.status IN ('scheduled','queued','retry_scheduled','rate_limited') THEN " +
            "GREATEST(0,TIMESTAMPDIFF(SECOND,t.available_at,?)) ELSE NULL END queue_wait_seconds " +
            "FROM collection_subqueries q " +
            "JOIN collection_tasks t ON t.id=q.task_id WHERE (q.finished_at>=DATE_SUB(?,INTERVAL 24 HOUR) " +
            "OR t.status IN ('scheduled','queued','retry_scheduled','rate_limited')) ORDER BY q.provider_id," +
            "q.finished_at DESC LIMIT 5000",
          [now, now],
        ),
        c.query<RowDataPacket[]>(
          "SELECT FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(started_at)/3600)*3600) bucket_at,COUNT(*) total," +
            "SUM(status IN ('succeeded','succeeded_empty')) succeeded,SUM(status IN ('blocked','failed','timed_out','cancelled')) failed " +
            "FROM crawler_browser_runs WHERE started_at>=DATE_SUB(?,INTERVAL 24 HOUR) GROUP BY bucket_at ORDER BY bucket_at",
          [now],
        ),
        c.query<RowDataPacket[]>(
          "SELECT pending_count,pending_bytes,quarantined_count,quarantined_bytes,oldest_pending_at,retention_days,max_bytes,minimum_free_disk_mb,free_disk_mb,observed_at FROM crawler_completion_spool_status ORDER BY observed_at DESC LIMIT 1",
        ),
      ]);
      signal?.throwIfAborted();
      await c.commit();
      const samplesByProvider = new Map<string, RowDataPacket[]>();
      for (const row of providerSamples) {
        const key = String(row.provider_id);
        samplesByProvider.set(key, [...(samplesByProvider.get(key) ?? []), row]);
      }
      const count = (type: string) => n(leases.find((row) => row.slot_type === type)?.total);
      return {
        active_worker_leases: count("worker"),
        active_crawler_leases: count("crawler"),
        duplicate_lease_count: n(duplicates[0]?.total),
        expired_leases: {
          total: n(expiredLeases[0]?.total),
          task_count: n(expiredLeases[0]?.task_count),
          worker: n(expiredLeases[0]?.worker),
          crawler: n(expiredLeases[0]?.crawler),
          provider: n(expiredLeases[0]?.provider),
          oldest_expired_at:
            expiredLeases[0]?.oldest_expired_at == null
              ? null
              : iso(expiredLeases[0].oldest_expired_at),
        },
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
        providers: providers.map((row) => {
          const samples = samplesByProvider.get(String(row.id)) ?? [],
            completed = samples.filter((item) => item.duration_ms != null),
            durations = completed.map((item) => n(item.duration_ms)).sort((a, b) => a - b),
            waits = samples
              .filter((item) => item.queue_wait_seconds != null)
              .map((item) => n(item.queue_wait_seconds))
              .sort((a, b) => a - b),
            succeeded = completed.filter((item) =>
              ["succeeded", "succeeded_empty"].includes(String(item.status)),
            ).length,
            threshold = n(row.circuit_failure_threshold),
            consecutive = n(row.consecutive_failures);
          return {
            id: String(row.id),
            code: String(row.code),
            configured_concurrency: n(row.configured_concurrency),
            effective_concurrency: n(row.effective_concurrency),
            active_leases: n(row.active_leases),
            queued_tasks: n(row.queued_tasks),
            longest_queue_wait_seconds: n(row.longest_queue_wait_seconds),
            queue_wait_p50_seconds: percentile(waits, 0.5),
            queue_wait_p95_seconds: percentile(waits, 0.95),
            sample_count_24h: completed.length,
            success_rate_basis_points_24h: completed.length
              ? Math.round((succeeded / completed.length) * 10_000)
              : null,
            duration_p95_ms_24h: durations.length ? percentile(durations, 0.95) : null,
            circuit_state:
              row.runtime_circuit_state === "open" && consecutive >= threshold
                ? ("open" as const)
                : ("closed" as const),
            circuit_failure_threshold: threshold,
            consecutive_failures: consecutive,
            last_error_code: row.last_error_code == null ? null : String(row.last_error_code),
          };
        }),
        profiles: profiles.map((row) => ({
          id: String(row.id),
          active_leases: n(row.active_leases),
        })),
        trend: trendRows.map((row) => {
          const total = n(row.total),
            failed = n(row.failed);
          return {
            bucket_at: iso(row.bucket_at),
            total,
            succeeded: n(row.succeeded),
            failed,
            failure_rate_basis_points: total ? Math.round((failed / total) * 10_000) : 0,
          };
        }),
        receipt_spool: receiptSpoolRows[0]
          ? {
              pending_count: n(receiptSpoolRows[0].pending_count),
              pending_bytes: n(receiptSpoolRows[0].pending_bytes),
              quarantined_count: n(receiptSpoolRows[0].quarantined_count),
              quarantined_bytes: n(receiptSpoolRows[0].quarantined_bytes),
              oldest_pending_at:
                receiptSpoolRows[0].oldest_pending_at == null
                  ? null
                  : iso(receiptSpoolRows[0].oldest_pending_at),
              retention_days: n(receiptSpoolRows[0].retention_days),
              max_bytes: n(receiptSpoolRows[0].max_bytes),
              minimum_free_disk_mb: n(receiptSpoolRows[0].minimum_free_disk_mb),
              free_disk_mb: n(receiptSpoolRows[0].free_disk_mb),
              observed_at: iso(receiptSpoolRows[0].observed_at),
            }
          : null,
      };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async record(input: Parameters<Contract["record"]>[0]) {
    const c = await this.pool.getConnection(),
      id = randomUUID();
    try {
      input.signal?.throwIfAborted();
      await c.beginTransaction();
      input.signal?.throwIfAborted();
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
      input.signal?.throwIfAborted();
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
      input.signal?.throwIfAborted();
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
  async recoverProvider(input: Parameters<Contract["recoverProvider"]>[0]) {
    const c = await this.pool.getConnection(),
      route = `/platform/operations/crawler-scheduler/providers/${input.providerId}/recover`;
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
        return { provider_id: String(value.provider_id), recovered: Boolean(value.recovered) };
      }
      const [providers] = await c.query<RowDataPacket[]>(
          "SELECT id,status FROM providers WHERE id=? FOR UPDATE",
          [input.providerId],
        ),
        provider = providers[0];
      if (!provider)
        throw new CrawlerSchedulerError("crawler_provider_not_found", 404, "刷新调度页面后重试。");
      if (provider.status !== "enabled")
        throw new CrawlerSchedulerError(
          "crawler_provider_not_enabled",
          409,
          "先在来源目录完成配置并启用来源。",
        );
      const [circuits] = await c.query<RowDataPacket[]>(
          "SELECT state,opened_at FROM provider_runtime_circuits WHERE provider_id=? FOR UPDATE",
          [input.providerId],
        ),
        circuit = circuits[0],
        result = { provider_id: input.providerId, recovered: circuit?.state === "open" };
      if (circuit?.state === "open") {
        const [healthRows] = await c.query<RowDataPacket[]>(
            "SELECT health_status,last_checked_at FROM provider_adapter_health WHERE provider_id=? LIMIT 1",
            [input.providerId],
          ),
          health = healthRows[0];
        if (
          health?.health_status !== "ready" ||
          !health.last_checked_at ||
          new Date(health.last_checked_at).getTime() <= new Date(circuit.opened_at).getTime()
        )
          throw new CrawlerSchedulerError(
            "crawler_provider_recovery_evidence_required",
            409,
            "先在来源健康页完成一次晚于熔断时间且结果为正常的健康检查。",
          );
        await c.query(
          "UPDATE provider_runtime_circuits SET state='closed',consecutive_failures=0,last_error_code=NULL,recovered_at=?,updated_at=? WHERE provider_id=?",
          [input.now, input.now, input.providerId],
        );
      }
      await c.query(
        "INSERT INTO crawler_scheduler_operations(id,actor_id,route,idempotency_key,result_json,request_id,trace_id,created_at) VALUES(?,?,?,?,?,?,?,?)",
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
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,'platform.crawler_scheduler.provider_recover','provider',?,'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          input.actorId,
          input.providerId,
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
