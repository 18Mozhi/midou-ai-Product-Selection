import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  CrawlerRuntimeRepository,
  CrawlerRunSummary,
  BrowserCollectionAssignment,
} from "./crawler-runtime-service.js";
import { CrawlerRuntimeError } from "./crawler-runtime-service.js";

const run = (row: RowDataPacket): CrawlerRunSummary => ({
  id: String(row.id),
  organization_id: String(row.organization_id),
  workspace_id: String(row.workspace_id),
  provider_id: String(row.provider_id),
  crawler_profile_id: String(row.crawler_profile_id),
  status: row.status,
  page_count: Number(row.page_count),
  item_count: Number(row.item_count),
  detail_count: Number(row.detail_count),
  duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
  error_code: row.error_code == null ? null : String(row.error_code),
  request_id: String(row.request_id),
  trace_id: String(row.trace_id),
  started_at: new Date(row.started_at).toISOString(),
  finished_at: row.finished_at == null ? null : new Date(row.finished_at).toISOString(),
});
export class MySqlCrawlerRuntimeRepository implements CrawlerRuntimeRepository {
  constructor(private readonly pool: Pool) {}
  async list() {
    const [profiles] = await this.pool.query<RowDataPacket[]>(
      [
        "SELECT p.id,p.code,p.name,p.provider_id,p.status,v.name provider_name,v.target_url,a.expires_at ",
        "credential_expires_at,l.run_id,l.lease_owner,l.leased_at,l.heartbeat_at,l.expires_at,",
        "f.status failure_status,f.error_code failure_error_code,f.finished_at failure_at FROM ",
        "crawler_profiles p JOIN providers v ON v.id=p.provider_id JOIN credential_assets a ON ",
        "a.id=p.credential_asset_id LEFT JOIN crawler_profile_leases l ON l.crawler_profile_id=p.id LEFT JOIN ",
        "crawler_browser_runs f ON f.id=(SELECT f2.id FROM crawler_browser_runs f2 WHERE ",
        "f2.crawler_profile_id=p.id AND f2.status IN ('blocked','failed','timed_out','cancelled') ORDER BY ",
        "f2.started_at DESC,f2.id DESC LIMIT 1) ORDER BY ",
        "p.status='active' DESC,p.name,p.id",
      ].join(""),
    );
    const [runs] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM crawler_browser_runs ORDER BY started_at DESC,id DESC LIMIT 100",
    );
    return {
      profiles: profiles.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        provider_id: String(row.provider_id),
        provider_name: String(row.provider_name),
        status: String(row.status),
        target_domain: (() => {
          try {
            return new URL(String(row.target_url)).hostname;
          } catch {
            return "来源网址待修复";
          }
        })(),
        credential_expires_at:
          row.credential_expires_at == null
            ? null
            : new Date(row.credential_expires_at).toISOString(),
        login_status:
          row.credential_expires_at == null
            ? ("unknown" as const)
            : new Date(row.credential_expires_at) <= new Date()
              ? ("expired" as const)
              : ("valid" as const),
        last_failure:
          row.failure_status == null
            ? null
            : {
                status: String(row.failure_status),
                error_code: row.failure_error_code == null ? null : String(row.failure_error_code),
                occurred_at: new Date(row.failure_at).toISOString(),
              },
        lease:
          row.run_id == null
            ? null
            : {
                run_id: String(row.run_id),
                lease_owner: String(row.lease_owner),
                leased_at: new Date(row.leased_at).toISOString(),
                heartbeat_at: new Date(row.heartbeat_at).toISOString(),
                expires_at: new Date(row.expires_at).toISOString(),
              },
      })),
      runs: runs.map(run),
    };
  }
  async acquire(input: Parameters<CrawlerRuntimeRepository["acquire"]>[0]) {
    const c = await this.pool.getConnection(),
      route = "/internal/crawler-runtime/acquire";
    let committed = false;
    try {
      await c.beginTransaction();
      const [replays] = await c.query<RowDataPacket[]>(
        [
          "SELECT r.* FROM crawler_browser_run_operations o JOIN crawler_browser_runs r ON r.id=o.run_id WHERE ",
          "o.actor_id=? AND o.route=? AND o.idempotency_key=? LIMIT 1",
        ].join(""),
        [input.actorId, route, input.idempotencyKey],
      );
      if (replays[0]) {
        await c.commit();
        return { run: run(replays[0]), replayed: true };
      }
      await c.query(
        "DELETE FROM crawler_scheduler_leases WHERE slot_type='crawler' AND expires_at<=?",
        [input.now],
      );
      const [globalSlots] = await c.query<RowDataPacket[]>(
        "SELECT slot_key FROM crawler_scheduler_leases WHERE slot_type='crawler' FOR UPDATE",
      );
      if (globalSlots[0])
        throw new CrawlerRuntimeError(
          "crawler_global_lease_conflict",
          409,
          "当前惠州单机已有 Crawler 运行，请等待全局租约释放。",
        );
      const [scope] = await c.query<RowDataPacket[]>(
        [
          "SELECT p.provider_id,p.updated_by,a.expires_at FROM crawler_profiles p JOIN credential_assets a ON ",
          "a.id=p.credential_asset_id JOIN providers v ON v.id=p.provider_id JOIN workspaces w ON w.id=? AND ",
          "w.organization_id=? AND w.status='active' WHERE p.id=? AND p.status='active' AND a.status='active' ",
          "AND a.kind IN ('browser_profile','cookie_bundle') AND v.status='enabled' LIMIT 1 FOR UPDATE",
        ].join(""),
        [input.workspaceId, input.organizationId, input.profileId],
      );
      if (!scope[0])
        throw new CrawlerRuntimeError(
          "crawler_profile_unavailable",
          409,
          "确认工作区、Provider、凭证与档案均为启用状态。",
        );
      if (scope[0].expires_at != null && new Date(scope[0].expires_at) <= input.now) {
        await this.renewalTask(c, {
          ...input,
          assigneeId: String(scope[0].updated_by),
          reason: "credential_expired",
        });
        await c.commit();
        committed = true;
        throw new CrawlerRuntimeError(
          "crawler_profile_login_expired",
          409,
          "登录档案已到期；任务中心已创建续期任务，更新凭证后再继续采集。",
        );
      }
      const [leases] = await c.query<RowDataPacket[]>(
        "SELECT run_id,expires_at FROM crawler_profile_leases WHERE crawler_profile_id=? FOR UPDATE",
        [input.profileId],
      );
      if (leases[0] && new Date(leases[0].expires_at) > input.now)
        throw new CrawlerRuntimeError(
          "crawler_profile_lease_conflict",
          409,
          "该浏览器档案正在使用，请等待租约释放。",
        );
      if (leases[0]) {
        await c.query(
          [
            "UPDATE crawler_browser_runs SET status='timed_out',error_code='lease_expired',finished_at=? WHERE ",
            "id=? AND status='running'",
          ].join(""),
          [input.now, leases[0].run_id],
        );
        await this.event(
          c,
          {
            actorId: input.actorId,
            requestId: input.requestId,
            traceId: input.traceId,
            now: input.now,
            profileId: input.profileId,
          },
          "recovered",
          String(leases[0].run_id),
        );
        await c.query("DELETE FROM crawler_profile_leases WHERE crawler_profile_id=?", [
          input.profileId,
        ]);
      }
      await c.query(
        [
          "INSERT INTO crawler_browser_runs (id,organization_id,workspace_id,provider_id,crawler_profile_id,req",
          "uested_by,status,page_count,item_count,detail_count,duration_ms,error_code,request_id,trace_id,start",
          "ed_at,finished_at) VALUES (?,?,?,?,?,?,'running',0,0,0,NULL,NULL,?,?,?,NULL)",
        ].join(""),
        [
          input.runId,
          input.organizationId,
          input.workspaceId,
          scope[0].provider_id,
          input.profileId,
          input.actorId,
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO crawler_profile_leases (crawler_profile_id,run_id,lease_id,lease_owner,lease_token_hash,",
          "leased_at,heartbeat_at,expires_at,request_id,trace_id) VALUES (?,?,?,?,UNHEX(?),?,?,?,?,?)",
        ].join(""),
        [
          input.profileId,
          input.runId,
          input.leaseId,
          input.leaseOwner,
          input.leaseTokenHash,
          input.now,
          input.now,
          input.expiresAt,
          input.requestId,
          input.traceId,
        ],
      );
      await c.query(
        [
          "INSERT INTO crawler_scheduler_leases(slot_type,slot_key,slot_no,organization_id,workspace_id,task_id",
          ",run_id,lease_owner,lease_token_hash,leased_at,heartbeat_at,expires_at,request_id,trace_id) ",
          "VALUES('crawler','single-host',1,?,?,NULL,?,?,UNHEX(?),?,?,?,?,?)",
        ].join(""),
        [
          input.organizationId,
          input.workspaceId,
          input.runId,
          input.leaseOwner,
          input.leaseTokenHash,
          input.now,
          input.now,
          input.expiresAt,
          input.requestId,
          input.traceId,
        ],
      );
      await this.event(c, input, "acquired", input.runId);
      await c.query(
        "INSERT INTO crawler_browser_run_operations (id,actor_id,route,idempotency_key,run_id,created_at) VALUES (?,?,?,?,?,?)",
        [randomUUID(), input.actorId, route, input.idempotencyKey, input.runId, input.now],
      );
      await c.commit();
      committed = true;
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT * FROM crawler_browser_runs WHERE id=?",
        [input.runId],
      );
      return { run: run(rows[0]!), replayed: false };
    } catch (error) {
      if (!committed) await c.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new CrawlerRuntimeError("crawler_runtime_conflict", 409, "刷新采集运行状态后重试。");
      throw error;
    } finally {
      c.release();
    }
  }
  async heartbeat(input: Parameters<CrawlerRuntimeRepository["heartbeat"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [result] = await c.query<any>(
        [
          "UPDATE crawler_profile_leases SET heartbeat_at=?,expires_at=?,request_id=?,trace_id=? WHERE ",
          "crawler_profile_id=? AND run_id=? AND lease_token_hash=UNHEX(?)",
        ].join(""),
        [
          input.now,
          input.expiresAt,
          input.requestId,
          input.traceId,
          input.profileId,
          input.runId,
          input.leaseTokenHash,
        ],
      );
      if (result.affectedRows !== 1)
        throw new CrawlerRuntimeError(
          "crawler_lease_invalid",
          409,
          "租约已失效，停止该浏览器运行。",
        );
      const [scheduler] = await c.query<any>(
        [
          "UPDATE crawler_scheduler_leases SET heartbeat_at=?,expires_at=?,request_id=?,trace_id=? WHERE ",
          "slot_type='crawler' AND slot_key='single-host' AND run_id=? AND lease_token_hash=UNHEX(?)",
        ].join(""),
        [
          input.now,
          input.expiresAt,
          input.requestId,
          input.traceId,
          input.runId,
          input.leaseTokenHash,
        ],
      );
      if (scheduler.affectedRows !== 1)
        throw new CrawlerRuntimeError(
          "crawler_global_lease_invalid",
          409,
          "单机全局租约已失效，停止该浏览器运行。",
        );
      await this.event(c, input, "heartbeat", input.runId);
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async finish(input: Parameters<CrawlerRuntimeRepository["finish"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [lease] = await c.query<RowDataPacket[]>(
        [
          "SELECT l.run_id,r.organization_id,r.workspace_id,p.updated_by FROM crawler_profile_leases l JOIN ",
          "crawler_browser_runs r ON r.id=l.run_id JOIN crawler_profiles p ON p.id=l.crawler_profile_id WHERE ",
          "l.crawler_profile_id=? AND l.run_id=? AND l.lease_token_hash=UNHEX(?) FOR UPDATE",
        ].join(""),
        [input.profileId, input.runId, input.leaseTokenHash],
      );
      if (!lease[0])
        throw new CrawlerRuntimeError(
          "crawler_lease_invalid",
          409,
          "租约已失效，不能写入完成结果。",
        );
      await c.query(
        [
          "UPDATE crawler_browser_runs SET status=?,page_count=?,item_count=?,detail_count=?,duration_ms=?,erro",
          "r_code=?,finished_at=? WHERE id=? AND status='running'",
        ].join(""),
        [
          input.status,
          input.pageCount,
          input.itemCount,
          input.detailCount,
          input.durationMs,
          input.errorCode,
          input.now,
          input.runId,
        ],
      );
      await this.event(c, input, "released", input.runId);
      if (
        input.status === "blocked" &&
        ["blocked_login", "session_expired", "login_required"].includes(input.errorCode ?? "")
      )
        await this.renewalTask(c, {
          ...input,
          organizationId: String(lease[0].organization_id),
          workspaceId: String(lease[0].workspace_id),
          assigneeId: String(lease[0].updated_by),
          reason: input.errorCode ?? "blocked_login",
        });
      await c.query("DELETE FROM crawler_profile_leases WHERE crawler_profile_id=? AND run_id=?", [
        input.profileId,
        input.runId,
      ]);
      await c.query("DELETE FROM crawler_scheduler_leases WHERE slot_type='crawler' AND run_id=?", [
        input.runId,
      ]);
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async recoverExpired(input: Parameters<CrawlerRuntimeRepository["recoverExpired"]>[0]) {
    const c = await this.pool.getConnection(),
      route = "/platform/crawler-runtime/recover-expired";
    try {
      await c.beginTransaction();
      const [replays] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM crawler_runtime_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
        [input.actorId, route, input.idempotencyKey],
      );
      if (replays[0]) {
        await c.commit();
        const value =
          typeof replays[0].result_json === "string"
            ? JSON.parse(replays[0].result_json)
            : replays[0].result_json;
        return { recovered: Number(value.recovered) };
      }
      const [leases] = await c.query<RowDataPacket[]>(
        [
          "SELECT l.crawler_profile_id,l.run_id,r.organization_id,r.workspace_id FROM crawler_profile_leases l ",
          "JOIN crawler_browser_runs r ON r.id=l.run_id WHERE l.expires_at<=? FOR UPDATE",
        ].join(""),
        [input.now],
      );
      for (const lease of leases) {
        await c.query(
          [
            "UPDATE crawler_browser_runs SET status='timed_out',error_code='lease_expired',finished_at=? WHERE ",
            "id=? AND status='running'",
          ].join(""),
          [input.now, lease.run_id],
        );
        await this.event(
          c,
          {
            ...input,
            profileId: String(lease.crawler_profile_id),
            organizationId: String(lease.organization_id),
            workspaceId: String(lease.workspace_id),
          },
          "recovered",
          String(lease.run_id),
        );
      }
      if (leases.length)
        await c.query("DELETE FROM crawler_profile_leases WHERE expires_at<=?", [input.now]);
      await c.query(
        "DELETE FROM crawler_scheduler_leases WHERE slot_type='crawler' AND expires_at<=?",
        [input.now],
      );
      const result = { recovered: leases.length };
      await c.query(
        [
          "INSERT INTO crawler_runtime_operations (id,actor_id,route,idempotency_key,result_json,request_id,tra",
          "ce_id,created_at) VALUES (?,?,?,?,?,?,?,?)",
        ].join(""),
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
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new CrawlerRuntimeError("crawler_runtime_conflict", 409, "刷新采集运行状态后重试。");
      throw error;
    } finally {
      c.release();
    }
  }
  async acquireJob(input: Parameters<CrawlerRuntimeRepository["acquireJob"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      await c.query(
        [
          "UPDATE crawler_browser_runs r JOIN browser_collection_jobs j ON j.crawler_run_id=r.id SET ",
          "r.status='timed_out',r.error_code='lease_expired',r.finished_at=? WHERE j.status='leased' AND ",
          "j.lease_expires_at<=? AND r.status='running'",
        ].join(""),
        [input.now, input.now],
      );
      await c.query(
        [
          "UPDATE browser_collection_jobs SET status='queued',crawler_profile_id=NULL,crawler_run_id=NULL,lease",
          "_owner=NULL,lease_token_hash=NULL,leased_at=NULL,heartbeat_at=NULL,lease_expires_at=NULL,error_code=",
          "'lease_expired',updated_at=? WHERE status='leased' AND lease_expires_at<=?",
        ].join(""),
        [input.now, input.now],
      );
      await c.query("DELETE FROM crawler_profile_leases WHERE expires_at<=?", [input.now]);
      await c.query(
        "DELETE FROM crawler_scheduler_leases WHERE slot_type='crawler' AND expires_at<=?",
        [input.now],
      );
      const [globalSlots] = await c.query<RowDataPacket[]>(
        "SELECT slot_key FROM crawler_scheduler_leases WHERE slot_type='crawler' FOR UPDATE",
      );
      if (globalSlots[0]) {
        await c.commit();
        return null;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        [
          "SELECT j.*,v.code provider_code,p.id profile_id,p.locale,p.timezone,p.updated_by,a.id ",
          "asset_id,a.version asset_version,a.kind,a.key_version,a.payload_ciphertext,a.payload_nonce,a.payload",
          "_auth_tag,a.expires_at FROM browser_collection_jobs j JOIN providers v ON v.id=j.provider_id AND ",
          "v.status='enabled' AND v.access_mode='authenticated_browser' JOIN crawler_profiles p ON ",
          "p.provider_id=j.provider_id AND p.status='active' JOIN credential_assets a ON ",
          "a.id=p.credential_asset_id AND a.status='active' AND a.kind IN ('browser_profile','cookie_bundle') ",
          "WHERE j.status='queued' ORDER BY (a.expires_at IS NULL OR a.expires_at>?) DESC,j.created_at,j.id ",
          "LIMIT 1 FOR UPDATE",
        ].join(""),
        [input.now],
      );
      const row = rows[0];
      if (!row) {
        await c.commit();
        return null;
      }
      if (row.expires_at != null && new Date(row.expires_at) <= input.now) {
        await c.query(
          [
            "UPDATE browser_collection_jobs SET status='blocked',crawler_profile_id=?,error_code='credential_expired',",
            "finished_at=?,updated_at=? WHERE id=?",
          ].join(""),
          [row.profile_id, input.now, input.now, row.id],
        );
        await this.renewalTask(c, {
          organizationId: String(row.organization_id),
          workspaceId: String(row.workspace_id),
          profileId: String(row.profile_id),
          actorId: input.actorId,
          assigneeId: String(row.updated_by),
          requestId: String(row.request_id),
          traceId: String(row.trace_id),
          now: input.now,
          reason: "credential_expired",
          collectionTaskId: String(row.collection_task_id),
        });
        await c.commit();
        return null;
      }
      const [profileLease] = await c.query<RowDataPacket[]>(
        "SELECT run_id FROM crawler_profile_leases WHERE crawler_profile_id=? FOR UPDATE",
        [row.profile_id],
      );
      if (profileLease[0]) {
        await c.commit();
        return null;
      }
      await c.query(
        [
          "INSERT INTO crawler_browser_runs (id,organization_id,workspace_id,provider_id,crawler_profile_id,req",
          "uested_by,status,page_count,item_count,detail_count,duration_ms,error_code,request_id,trace_id,start",
          "ed_at,finished_at) VALUES (?,?,?,?,?,?,'running',0,0,0,NULL,NULL,?,?,?,NULL)",
        ].join(""),
        [
          input.runId,
          row.organization_id,
          row.workspace_id,
          row.provider_id,
          row.profile_id,
          input.actorId,
          row.request_id,
          row.trace_id,
          input.now,
        ],
      );
      await c.query(
        [
          "INSERT INTO crawler_profile_leases (crawler_profile_id,run_id,lease_id,lease_owner,lease_token_hash,",
          "leased_at,heartbeat_at,expires_at,request_id,trace_id) VALUES (?,?,?,?,UNHEX(?),?,?,?,?,?)",
        ].join(""),
        [
          row.profile_id,
          input.runId,
          input.leaseId,
          input.leaseOwner,
          input.leaseTokenHash,
          input.now,
          input.now,
          input.expiresAt,
          row.request_id,
          row.trace_id,
        ],
      );
      await c.query(
        [
          "INSERT INTO crawler_scheduler_leases(slot_type,slot_key,slot_no,organization_id,workspace_id,task_id",
          ",run_id,lease_owner,lease_token_hash,leased_at,heartbeat_at,expires_at,request_id,trace_id) ",
          "VALUES('crawler','single-host',1,?,?,?,?,?,UNHEX(?),?,?,?,?,?)",
        ].join(""),
        [
          row.organization_id,
          row.workspace_id,
          row.collection_task_id,
          input.runId,
          input.leaseOwner,
          input.leaseTokenHash,
          input.now,
          input.now,
          input.expiresAt,
          row.request_id,
          row.trace_id,
        ],
      );
      await c.query(
        [
          "UPDATE browser_collection_jobs SET status='leased',crawler_profile_id=?,crawler_run_id=?,lease_owner",
          "=?,lease_token_hash=UNHEX(?),leased_at=?,heartbeat_at=?,lease_expires_at=?,error_code=NULL,updated_a",
          "t=? WHERE id=? AND status='queued'",
        ].join(""),
        [
          row.profile_id,
          input.runId,
          input.leaseOwner,
          input.leaseTokenHash,
          input.now,
          input.now,
          input.expiresAt,
          input.now,
          row.id,
        ],
      );
      await this.event(
        c,
        {
          ...input,
          organizationId: String(row.organization_id),
          workspaceId: String(row.workspace_id),
          profileId: String(row.profile_id),
          requestId: String(row.request_id),
          traceId: String(row.trace_id),
        },
        "acquired",
        input.runId,
      );
      await c.commit();
      const executionRequest =
        typeof row.execution_request_json === "string"
          ? JSON.parse(row.execution_request_json)
          : row.execution_request_json;
      const assignment: BrowserCollectionAssignment = {
        job: {
          id: String(row.id),
          collection_task_id: String(row.collection_task_id),
          collection_subquery_id: String(row.collection_subquery_id),
          provider_id: String(row.provider_id),
          provider_code: String(row.provider_code),
          execution_request: executionRequest,
        },
        run: {
          id: input.runId,
          organization_id: String(row.organization_id),
          workspace_id: String(row.workspace_id),
          provider_id: String(row.provider_id),
          crawler_profile_id: String(row.profile_id),
          status: "running",
          page_count: 0,
          item_count: 0,
          detail_count: 0,
          duration_ms: null,
          error_code: null,
          request_id: String(row.request_id),
          trace_id: String(row.trace_id),
          started_at: input.now.toISOString(),
          finished_at: null,
        },
        profile: {
          id: String(row.profile_id),
          locale: String(row.locale),
          timezone: String(row.timezone),
        },
        credential: {
          asset_id: String(row.asset_id),
          asset_version: Number(row.asset_version),
          kind: row.kind as "browser_profile" | "cookie_bundle",
          key_version: String(row.key_version),
          ciphertext_base64: Buffer.from(row.payload_ciphertext).toString("base64"),
          nonce_base64: Buffer.from(row.payload_nonce).toString("base64"),
          auth_tag_base64: Buffer.from(row.payload_auth_tag).toString("base64"),
        },
      };
      return assignment;
    } catch (error) {
      await c.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") return null;
      throw error;
    } finally {
      c.release();
    }
  }
  async heartbeatJob(input: Parameters<CrawlerRuntimeRepository["heartbeatJob"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [result] = await c.query<any>(
        [
          "UPDATE browser_collection_jobs SET heartbeat_at=?,lease_expires_at=?,updated_at=? WHERE id=? AND ",
          "crawler_run_id=? AND crawler_profile_id=? AND status='leased' AND lease_token_hash=UNHEX(?)",
        ].join(""),
        [
          input.now,
          input.expiresAt,
          input.now,
          input.jobId,
          input.runId,
          input.profileId,
          input.leaseTokenHash,
        ],
      );
      if (result.affectedRows !== 1)
        throw new CrawlerRuntimeError(
          "crawler_lease_invalid",
          409,
          "浏览器作业租约已失效，停止执行。",
        );
      const [profile] = await c.query<any>(
        [
          "UPDATE crawler_profile_leases SET heartbeat_at=?,expires_at=?,request_id=?,trace_id=? WHERE ",
          "crawler_profile_id=? AND run_id=? AND lease_token_hash=UNHEX(?)",
        ].join(""),
        [
          input.now,
          input.expiresAt,
          input.requestId,
          input.traceId,
          input.profileId,
          input.runId,
          input.leaseTokenHash,
        ],
      );
      const [scheduler] = await c.query<any>(
        [
          "UPDATE crawler_scheduler_leases SET heartbeat_at=?,expires_at=?,request_id=?,trace_id=? WHERE ",
          "slot_type='crawler' AND run_id=? AND task_id=(SELECT collection_task_id FROM browser_collection_jobs ",
          "WHERE id=?) AND lease_token_hash=UNHEX(?)",
        ].join(""),
        [
          input.now,
          input.expiresAt,
          input.requestId,
          input.traceId,
          input.runId,
          input.jobId,
          input.leaseTokenHash,
        ],
      );
      if (profile.affectedRows !== 1 || scheduler.affectedRows !== 1)
        throw new CrawlerRuntimeError(
          "crawler_global_lease_invalid",
          409,
          "浏览器档案或调度租约已失效，停止执行。",
        );
      await this.event(
        c,
        { ...input, organizationId: undefined, workspaceId: undefined },
        "heartbeat",
        input.runId,
      );
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async finishJob(input: Parameters<CrawlerRuntimeRepository["finishJob"]>[0]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        [
          "SELECT j.organization_id,j.workspace_id,j.collection_task_id,j.status,p.updated_by FROM ",
          "browser_collection_jobs j LEFT JOIN crawler_profile_leases l ON l.run_id=j.crawler_run_id AND ",
          "l.crawler_profile_id=j.crawler_profile_id JOIN crawler_profiles p ON p.id=j.crawler_profile_id WHERE ",
          "j.id=? AND j.crawler_run_id=? AND j.crawler_profile_id=? AND ",
          "j.lease_token_hash=UNHEX(?) AND (j.status<>'leased' OR l.lease_token_hash=UNHEX(?)) FOR UPDATE",
        ].join(""),
        [input.jobId, input.runId, input.profileId, input.leaseTokenHash, input.leaseTokenHash],
      );
      const row = rows[0];
      if (!row)
        throw new CrawlerRuntimeError(
          "crawler_lease_invalid",
          409,
          "浏览器作业租约已失效，不能回写结果。",
        );
      if (row.status !== "leased") {
        await c.commit();
        return;
      }
      const jobStatus = input.status === "timed_out" ? "timed_out" : input.status;
      await c.query(
        [
          "UPDATE crawler_browser_runs SET status=?,page_count=?,item_count=?,detail_count=?,duration_ms=?,erro",
          "r_code=?,finished_at=? WHERE id=? AND status='running'",
        ].join(""),
        [
          input.status,
          input.pageCount,
          input.itemCount,
          input.detailCount,
          input.durationMs,
          input.errorCode,
          input.now,
          input.runId,
        ],
      );
      await c.query(
        [
          "UPDATE browser_collection_jobs SET status=?,result_json=?,error_code=?,lease_owner=NULL,lease_expires_",
          "at=NULL,finished_at=?,updated_at=? WHERE id=?",
        ].join(""),
        [
          jobStatus,
          JSON.stringify(input.result),
          input.errorCode,
          input.now,
          input.now,
          input.jobId,
        ],
      );
      if (
        input.status === "blocked" &&
        ["blocked_login", "session_expired", "login_required"].includes(input.errorCode ?? "")
      )
        await this.renewalTask(c, {
          organizationId: String(row.organization_id),
          workspaceId: String(row.workspace_id),
          profileId: input.profileId,
          actorId: input.actorId,
          assigneeId: String(row.updated_by),
          requestId: input.requestId,
          traceId: input.traceId,
          now: input.now,
          reason: input.errorCode ?? "blocked_login",
          collectionTaskId: String(row.collection_task_id),
        });
      await this.event(
        c,
        {
          ...input,
          organizationId: String(row.organization_id),
          workspaceId: String(row.workspace_id),
        },
        "released",
        input.runId,
      );
      await c.query("DELETE FROM crawler_profile_leases WHERE crawler_profile_id=? AND run_id=?", [
        input.profileId,
        input.runId,
      ]);
      await c.query(
        "DELETE FROM crawler_scheduler_leases WHERE slot_type='crawler' AND run_id=? AND task_id=?",
        [input.runId, row.collection_task_id],
      );
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  private async event(
    c: PoolConnection,
    input: any,
    action: "acquired" | "heartbeat" | "released" | "recovered",
    runId: string,
  ) {
    let organizationId = input.organizationId,
      workspaceId = input.workspaceId;
    if (!organizationId) {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT organization_id,workspace_id FROM crawler_browser_runs WHERE id=?",
        [runId],
      );
      organizationId = rows[0]?.organization_id;
      workspaceId = rows[0]?.workspace_id;
    }
    await c.query(
      [
        "INSERT INTO crawler_profile_lease_events ",
        "(id,crawler_profile_id,run_id,organization_id,workspace_id,action,actor_id,request_id,trace_id,occur",
        "red_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ].join(""),
      [
        randomUUID(),
        input.profileId,
        runId,
        organizationId,
        workspaceId,
        action,
        input.actorId,
        input.requestId,
        input.traceId,
        input.now,
      ],
    );
  }
  private async renewalTask(
    c: PoolConnection,
    input: {
      organizationId: string;
      workspaceId: string;
      profileId: string;
      actorId: string;
      assigneeId: string;
      requestId: string;
      traceId: string;
      now: Date;
      reason: string;
      collectionTaskId?: string;
    },
  ) {
    const [existing] = await c.query<RowDataPacket[]>(
      [
        "SELECT id,status FROM tasks WHERE organization_id=? AND workspace_id=? AND ",
        "source_type='collection_followup' AND source_ref_id=? LIMIT 1 FOR UPDATE",
      ].join(""),
      [input.organizationId, input.workspaceId, input.profileId],
    );
    const taskId = existing[0] ? String(existing[0].id) : randomUUID();
    if (!existing[0])
      await c.query(
        [
          "INSERT INTO tasks (id,organization_id,workspace_id,title,description,status,priority,assignee_id,sou",
          "rce_type,source_ref_id,collection_task_id,due_at,completed_at,created_by,version,created_at,updated_",
          "at) VALUES (?,?,?,?,?,'todo','critical',?,'collection_followup',?,?,?,NULL,?,1,?,?)",
        ].join(""),
        [
          taskId,
          input.organizationId,
          input.workspaceId,
          "续期网页登录档案",
          `浏览器档案 ${input.profileId} 登录无效（${input.reason}）；更新凭证并验证目标站点登录状态。`,
          input.assigneeId,
          input.profileId,
          input.collectionTaskId ?? null,
          new Date(input.now.getTime() + 24 * 60 * 60 * 1000),
          input.actorId,
          input.now,
          input.now,
        ],
      );
    else if (["completed", "cancelled"].includes(String(existing[0].status)))
      await c.query(
        [
          "UPDATE tasks SET status='todo',priority='critical',assignee_id=?,collection_task_id=COALESCE(?,",
          "collection_task_id),completed_at=NULL,due_at=?,version=version+1,updated_at=? WHERE id=?",
        ].join(""),
        [
          input.assigneeId,
          input.collectionTaskId ?? null,
          new Date(input.now.getTime() + 24 * 60 * 60 * 1000),
          input.now,
          taskId,
        ],
      );
    else if (input.collectionTaskId)
      await c.query(
        "UPDATE tasks SET collection_task_id=?,version=version+1,updated_at=? WHERE id=?",
        [input.collectionTaskId, input.now, taskId],
      );
    await c.query(
      [
        "INSERT INTO task_events (id,organization_id,workspace_id,task_id,event_type,actor_id,payload_json,re",
        "quest_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ].join(""),
      [
        randomUUID(),
        input.organizationId,
        input.workspaceId,
        taskId,
        "task.credential_renewal_required",
        input.actorId,
        JSON.stringify({
          crawler_profile_id: input.profileId,
          collection_task_id: input.collectionTaskId ?? null,
          reason: input.reason,
        }),
        input.requestId,
        input.traceId,
        input.now,
      ],
    );
  }
}
