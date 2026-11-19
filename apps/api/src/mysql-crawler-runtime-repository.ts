import {
  registerReplayOwnership,
  resolveCollectionReplayOwner,
} from "./collection-replay-ownership.js";
import {
  insertCrawlerRun,
  readCrawlerRunAccount,
  readCrawlerRunCoordinates,
} from "./crawler-run-storage.js";
import {
  appendCrawlerSchedulerLease,
  collectionTaskScope,
  crawlerSchedulerLeaseHasLegacyScope,
} from "@scoutops/database";
import { nativeBusinessTaskScope } from "./business-task-storage.js";
import { accountAmazonRecoveryScopeSql } from "./pending-source-recovery-policy.js";
import { anonymousAmazonFingerprint } from "@scoutops/provider-sources";
import { appendCrawlerLeaseEvent } from "@scoutops/database";
import { withCollectionClaimFence } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  CrawlerRuntimeRepository,
  CrawlerRunSummary,
  BrowserCollectionAssignment,
} from "./crawler-runtime-service.js";
import { CrawlerRuntimeError } from "./crawler-runtime-service.js";

async function hasSealedCrawlerOwnership(c: PoolConnection) {
  try {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT contract_version FROM account_ownership_cutover WHERE slot='current' LOCK IN SHARE MODE",
    );
    if (!rows.length) return false;
    if (Number(rows[0]?.contract_version) === 25) return true;
    throw new CrawlerRuntimeError("crawler_runtime_conflict", 409, "采集账号归属版本不匹配。");
  } catch (error) {
    const mysql = error as { code?: string; sqlMessage?: string };
    if (
      mysql.code === "ER_NO_SUCH_TABLE" &&
      /\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "")
    )
      return false;
    throw error;
  }
}

const sealedCrawlerParentSql = (native: boolean) =>
  "EXISTS (SELECT 1 FROM account_owned_records own " +
  "JOIN users u ON u.id=own.account_id AND u.status='active' " +
  "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
  "WHERE own.source_table='collection_tasks' AND own.source_id=j.collection_task_id " +
  "AND (own.reason='exclusive_owner' OR (own.reason IN ('shared','unassigned') AND own.account_id=cut.primary_account_id)) " +
  (native
    ? "AND own.account_id=job_task.account_id AND EXISTS (SELECT 1 FROM account_owned_records query_owner " +
      "WHERE query_owner.source_table='collection_subqueries' AND query_owner.source_id=q.id " +
      "AND query_owner.account_id=own.account_id AND (query_owner.reason='exclusive_owner' OR " +
      "(query_owner.reason IN ('shared','unassigned') AND query_owner.account_id=cut.primary_account_id)) LOCK IN SHARE MODE) "
    : "") +
  "LOCK IN SHARE MODE) ";

const pausedBrowserParentSql =
  "EXISTS (SELECT 1 FROM collection_tasks drain_task JOIN crawler_scheduler_leases drain_lease " +
  "ON drain_lease.task_id=drain_task.id AND drain_lease.slot_type='worker' " +
  "AND drain_lease.lease_owner=drain_task.lease_owner AND drain_lease.lease_token_hash=drain_task.lease_token_hash " +
  "WHERE drain_task.id=j.collection_task_id AND drain_task.status='running' " +
  "AND drain_task.lease_expires_at>NOW(3) AND drain_lease.expires_at>NOW(3) LOCK IN SHARE MODE) ";

class RolledBackCrawlerLeaseDeadlock extends Error {
  constructor(readonly original: unknown) {
    super("crawler_lease_transaction_deadlock");
  }
}

const run = (row: RowDataPacket): CrawlerRunSummary => {
  const accountId = readCrawlerRunAccount(row);
  const scope = accountId ? null : readCrawlerRunCoordinates(row);
  return {
    id: String(row.id),
    ...(scope
      ? { organization_id: scope.organizationId, workspace_id: scope.workspaceId }
      : { account_id: accountId! }),
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
  };
};
export class MySqlCrawlerRuntimeRepository implements CrawlerRuntimeRepository {
  constructor(
    private readonly pool: Pool,
    private readonly amazonPublicProfileId = "",
    private readonly amazonHealthProfileId = "",
    private readonly claimPausePath?: string,
    private readonly accountAmazonHealth?: { actorId: string; profileId: string; manual?: true },
  ) {}
  private async claimConnection<T>(
    work: (connection: PoolConnection, paused: boolean) => Promise<T>,
  ) {
    const c = await this.pool.getConnection();
    try {
      return this.claimPausePath
        ? await withCollectionClaimFence(c, this.claimPausePath, (paused) => work(c, paused))
        : await work(c, false);
    } finally {
      c.release();
    }
  }
  async list(input: Parameters<CrawlerRuntimeRepository["list"]>[0]) {
    const conditions: string[] = [],
      parameters: unknown[] = [];
    if (input.status) {
      conditions.push("status=?");
      parameters.push(input.status);
    }
    if (input.query) {
      conditions.push(
        "(INSTR(LOWER(id),?)>0 OR INSTR(LOWER(COALESCE(error_code,'')),?)>0 OR INSTR(LOWER(request_id),?)>0 OR INSTR(LOWER(trace_id),?)>0)",
      );
      const normalized = input.query.toLowerCase();
      parameters.push(normalized, normalized, normalized, normalized);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "",
      [[profiles], [countRows], [metricRows]] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
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
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) total FROM crawler_browser_runs${where}`,
          parameters,
        ),
        this.pool.query<RowDataPacket[]>(
          [
            "SELECT COUNT(*) total,",
            "SUM(status IN ('blocked','failed','timed_out')) abnormal,",
            "SUM(error_code='lease_expired') duplicate_risk FROM crawler_browser_runs",
          ].join(""),
        ),
      ]),
      total = Number(countRows[0]?.total ?? 0),
      totalPages = total === 0 ? 0 : Math.ceil(total / input.pageSize),
      page = totalPages === 0 ? 1 : Math.min(input.page, totalPages),
      offset = (page - 1) * input.pageSize;
    const [runs] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM crawler_browser_runs${where} ORDER BY started_at DESC,id DESC LIMIT ? OFFSET ?`,
      [...parameters, input.pageSize, offset],
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
      run_metrics: {
        total: Number(metricRows[0]?.total ?? 0),
        abnormal: Number(metricRows[0]?.abnormal ?? 0),
        duplicate_risk: Number(metricRows[0]?.duplicate_risk ?? 0),
      },
      pagination: {
        page,
        page_size: input.pageSize,
        total,
        total_pages: totalPages,
      },
    };
  }
  async acquire(input: Parameters<CrawlerRuntimeRepository["acquire"]>[0]) {
    if (input.accountId !== undefined && (
      input.leaseOwner !== "amazon-public-health" ||
      this.accountAmazonHealth?.actorId !== input.actorId ||
      this.accountAmazonHealth.profileId !== input.profileId ||
      (input.automaticTaskId === undefined
        ? !this.accountAmazonHealth.manual || input.accountId !== input.actorId
        : Boolean(this.accountAmazonHealth.manual))
    )) throw new CrawlerRuntimeError("automatic_recovery_scope_unavailable", 409, "来源探针的系统身份或档案不可用。");
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.claimConnection((c, paused) =>
          this.acquireOnce(input, c, paused),
        );
        if (result.replayed) return result;
        const [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT * FROM crawler_browser_runs WHERE id=?",
          [input.runId],
        );
        return { run: run(rows[0]!), replayed: false };
      } catch (error) {
        if (!(error instanceof RolledBackCrawlerLeaseDeadlock)) throw error;
        if (attempt === 2) throw error.original;
        await delay(25 * (attempt + 1));
      }
    }
  }
  private async acquireOnce(
    input: Parameters<CrawlerRuntimeRepository["acquire"]>[0],
    c: PoolConnection,
    paused: boolean,
  ) {
    const accountHealth = input.accountId !== undefined;
    const route = !accountHealth ? "/internal/crawler-runtime/acquire"
      : input.automaticTaskId ? "/internal/crawler-runtime/account-amazon-health"
        : "/internal/crawler-runtime/account-amazon-manual-health";
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
        return { run: run(replays[0]), replayed: true as const };
      }
      if (paused)
        throw new CrawlerRuntimeError(
          "crawler_claims_paused",
          409,
          "采集领取处于维护暂停；已有作业可以继续心跳和回写。",
        );
      if (input.accountId !== undefined) {
        const [work] = await c.query<RowDataPacket[]>(
          input.automaticTaskId
            ? accountAmazonRecoveryScopeSql + " AND t.account_id=? LIMIT 1 LOCK IN SHARE MODE"
            : "SELECT u.id FROM users u JOIN account_ownership_cutover cut " +
              "ON cut.slot='current' AND cut.contract_version=25 WHERE u.id=? AND u.status='active' LIMIT 1 LOCK IN SHARE MODE",
          input.automaticTaskId ? [input.automaticTaskId, input.actorId, input.accountId] : [input.actorId],
        );
        if (!work[0]) throw new CrawlerRuntimeError("automatic_recovery_scope_unavailable", 409, "待采集任务的账号归属已变化。");
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
      const publicHealth =
        Boolean(this.amazonHealthProfileId) &&
        input.profileId === this.amazonHealthProfileId &&
        input.leaseOwner === "amazon-public-health";
      const [scope] = await c.query<RowDataPacket[]>(
        accountHealth
          ? "SELECT p.provider_id,p.updated_by,a.expires_at FROM crawler_profiles p JOIN credential_assets a ON " +
            "a.id=p.credential_asset_id JOIN providers v ON v.id=p.provider_id WHERE p.id=? AND p.status='active' " +
            "AND a.status='active' AND a.kind='browser_profile' AND a.fingerprint=? AND v.code='amazon_product' " +
            "AND v.access_mode='public_page' AND (v.status='enabled'" +
            (this.accountAmazonHealth?.manual && input.automaticTaskId === undefined
              ? " OR v.status='disabled'" : "") +
            ") AND v.terms_review_status='approved' " +
            "AND CHAR_LENGTH(v.terms_version)>0 AND (v.terms_permanent=1 OR v.terms_expires_at>?) LIMIT 1 FOR UPDATE"
          :
        [
          "SELECT p.provider_id,p.updated_by,a.expires_at FROM crawler_profiles p JOIN credential_assets a ON ",
          "a.id=p.credential_asset_id JOIN providers v ON v.id=p.provider_id JOIN workspaces w ON w.id=? AND ",
          "w.organization_id=? AND w.status='active' WHERE p.id=? AND p.status='active' AND a.status='active' ",
          "AND a.kind IN ('browser_profile','cookie_bundle') AND (v.status='enabled'",
          publicHealth
            ? " OR (v.status='disabled' AND v.code='amazon_product' AND v.access_mode='public_page' AND p.id=? AND a.kind='browser_profile' AND a.fingerprint=? AND v.terms_review_status='approved' AND CHAR_LENGTH(v.terms_version)>0 AND (v.terms_permanent=1 OR v.terms_expires_at>?))"
            : "",
          ") LIMIT 1 FOR UPDATE",
        ].join(""),
        accountHealth ? [input.profileId, anonymousAmazonFingerprint(), input.now] : [
          input.workspaceId,
          input.organizationId,
          input.profileId,
          ...(publicHealth
            ? [this.amazonHealthProfileId, anonymousAmazonFingerprint(), input.now]
            : []),
        ],
      );
      if (!scope[0])
        throw new CrawlerRuntimeError(
          "crawler_profile_unavailable",
          409,
          "确认工作区、Provider、凭证与档案均为启用状态。",
        );
      if (scope[0].expires_at != null && new Date(scope[0].expires_at) <= input.now) {
        if (input.accountId === undefined) {
          await this.renewalTask(c, {
            ...input,
            assigneeId: String(scope[0].updated_by),
            reason: "credential_expired",
          });
          await c.commit();
          committed = true;
        }
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
      await insertCrawlerRun(c, {
        id: input.runId,
        ...(input.accountId !== undefined ? { accountId: input.accountId }
          : { organizationId: input.organizationId, workspaceId: input.workspaceId }),
        providerId: String(scope[0].provider_id),
        profileId: input.profileId,
        actorId: input.actorId,
        requestId: input.requestId,
        traceId: input.traceId,
        now: input.now,
      });
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
      const legacySchedulerLease = await crawlerSchedulerLeaseHasLegacyScope(c);
      await appendCrawlerSchedulerLease(c, legacySchedulerLease, input.accountId !== undefined ? null : input, {
        slotType: "crawler",
        slotKey: "single-host",
        taskId: null,
        runId: input.runId,
        owner: input.leaseOwner,
        tokenHash: input.leaseTokenHash,
        now: input.now,
        expiresAt: input.expiresAt,
        requestId: input.requestId,
        traceId: input.traceId,
      });
      await this.event(c, input, "acquired", input.runId);
      await c.query(
        "INSERT INTO crawler_browser_run_operations (id,actor_id,route,idempotency_key,run_id,created_at) VALUES (?,?,?,?,?,?)",
        [randomUUID(), input.actorId, route, input.idempotencyKey, input.runId, input.now],
      );
      await c.commit();
      committed = true;
      return { replayed: false as const };
    } catch (error) {
      if (!committed) {
        await c.rollback();
        if ((error as { code?: string }).code === "ER_LOCK_DEADLOCK")
          throw new RolledBackCrawlerLeaseDeadlock(error);
      }
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new CrawlerRuntimeError("crawler_runtime_conflict", 409, "刷新采集运行状态后重试。");
      throw error;
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
          "SELECT r.*,p.updated_by FROM crawler_profile_leases l JOIN ",
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
        readCrawlerRunAccount(lease[0]) === null &&
        ["blocked_login", "session_expired", "login_required"].includes(input.errorCode ?? "")
      )
        await this.renewalTask(c, {
          ...input,
          organizationId: readCrawlerRunCoordinates(lease[0]).organizationId,
          workspaceId: readCrawlerRunCoordinates(lease[0]).workspaceId,
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
          "SELECT l.crawler_profile_id,l.run_id FROM crawler_profile_leases l ",
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
    return this.claimConnection((c, paused) => this.acquireJobOnce(input, c, paused));
  }
  private async acquireJobOnce(
    input: Parameters<CrawlerRuntimeRepository["acquireJob"]>[0],
    c: PoolConnection,
    paused: boolean,
  ) {
    const parentFilter = paused ? " AND " + pausedBrowserParentSql : "";
    try {
      await c.beginTransaction();
      await c.query(
        [
          "INSERT INTO crawler_completion_spool_status(crawler_id,pending_count,pending_bytes,",
          "quarantined_count,quarantined_bytes,oldest_pending_at,retention_days,max_bytes,",
          "minimum_free_disk_mb,free_disk_mb,request_id,trace_id,observed_at) ",
          "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE ",
          "pending_count=VALUES(pending_count),pending_bytes=VALUES(pending_bytes),",
          "quarantined_count=VALUES(quarantined_count),",
          "quarantined_bytes=VALUES(quarantined_bytes),oldest_pending_at=VALUES(oldest_pending_at),",
          "retention_days=VALUES(retention_days),max_bytes=VALUES(max_bytes),",
          "minimum_free_disk_mb=VALUES(minimum_free_disk_mb),free_disk_mb=VALUES(free_disk_mb),",
          "request_id=VALUES(request_id),trace_id=VALUES(trace_id),observed_at=VALUES(observed_at)",
        ].join(""),
        [
          input.leaseOwner,
          input.completionSpool.pendingCount,
          input.completionSpool.pendingBytes,
          input.completionSpool.quarantinedCount,
          input.completionSpool.quarantinedBytes,
          input.completionSpool.oldestPendingAt,
          input.completionSpool.retentionDays,
          input.completionSpool.maxBytes,
          input.completionSpool.minimumFreeDiskMb,
          input.completionSpool.freeDiskMb,
          input.requestId,
          input.traceId,
          input.now,
        ],
      );
      await c.query(
        [
          "UPDATE crawler_browser_runs r JOIN browser_collection_jobs j ON j.crawler_run_id=r.id SET ",
          "r.status='timed_out',r.error_code='lease_expired',r.finished_at=? WHERE j.status='leased' AND ",
          "j.lease_expires_at<=? AND r.status='running'" + parentFilter,
        ].join(""),
        [input.now, input.now],
      );
      await c.query(
        [
          `UPDATE browser_collection_jobs${paused ? " j" : ""} SET status='queued',crawler_profile_id=NULL,crawler_run_id=NULL,lease`,
          "_owner=NULL,lease_token_hash=NULL,leased_at=NULL,heartbeat_at=NULL,lease_expires_at=NULL,error_code=",
          "'lease_expired',updated_at=? WHERE status='leased' AND lease_expires_at<=?" +
            parentFilter,
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
      const sealed = await hasSealedCrawlerOwnership(c);
      const nativeTask = sealed && (await collectionTaskScope(c)) === "account";
      const [rows] = await c.query<RowDataPacket[]>(
        [
          "SELECT j.*," +
            (sealed
              ? "sealed_owner.account_id,"
              : "job_task.organization_id AS organization_id,job_task.workspace_id AS workspace_id,") +
            "v.code provider_code,p.id profile_id,p.locale,p.timezone,p.updated_by,a.id ",
          "asset_id,a.version asset_version,a.kind,a.key_version,a.payload_ciphertext,a.payload_nonce,a.payload",
          "_auth_tag,a.expires_at FROM browser_collection_jobs j JOIN collection_tasks job_task ON job_task.id=j.collection_task_id " +
            "JOIN collection_subqueries q ON q.id=j.collection_subquery_id AND q.task_id=job_task.id AND q.provider_id=j.provider_id " +
            (sealed
              ? "JOIN account_owned_records sealed_owner ON sealed_owner.source_table='collection_tasks' AND sealed_owner.source_id=job_task.id "
              : "") +
            "JOIN providers v ON v.id=j.provider_id AND ",
          (this.amazonPublicProfileId
            ? "(v.access_mode='authenticated_browser' OR (v.code='amazon_product' AND v.access_mode='public_page')) "
            : "v.access_mode='authenticated_browser' ") +
            "AND (v.status='enabled' OR (v.code='1688_search' AND ",
          "JSON_UNQUOTE(JSON_EXTRACT(j.execution_request_json,'$.purpose'))='acceptance')) JOIN crawler_profiles p ON ",
          "p.provider_id=j.provider_id AND p.status='active' JOIN credential_assets a ON ",
          "a.id=p.credential_asset_id AND a.status='active' AND a.kind IN ('browser_profile','cookie_bundle') ",
          "WHERE j.status='queued' " +
            (sealed
              ? "AND job_task.status='running' AND job_task.lease_expires_at>? AND " +
                sealedCrawlerParentSql(nativeTask)
              : "") +
            parentFilter +
            (this.amazonPublicProfileId
              ? "AND (v.access_mode='authenticated_browser' OR (v.code='amazon_product' AND p.id=? AND a.kind='browser_profile' AND a.fingerprint=? AND JSON_UNQUOTE(JSON_EXTRACT(j.execution_request_json,'$.purpose'))='amazon_public')) "
              : "") +
            "ORDER BY (a.expires_at IS NULL OR a.expires_at>?) DESC,j.created_at,j.id ",
          "LIMIT 1 FOR UPDATE",
        ].join(""),
        this.amazonPublicProfileId
          ? [
              ...(sealed ? [input.now] : []),
              this.amazonPublicProfileId,
              anonymousAmazonFingerprint(),
              input.now,
            ]
          : sealed
            ? [input.now, input.now]
            : [input.now],
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
        const coordinates = sealed
          ? {}
          : { organizationId: String(row.organization_id), workspaceId: String(row.workspace_id) };
        await this.renewalTask(
          c,
          {
            ...coordinates,
            profileId: String(row.profile_id),
            actorId: input.actorId,
            assigneeId: String(row.updated_by),
            requestId: String(row.request_id),
            traceId: String(row.trace_id),
            now: input.now,
            reason: "credential_expired",
            collectionTaskId: String(row.collection_task_id),
          },
          sealed,
        );
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
      const legacyScope = sealed
        ? null
        : { organizationId: String(row.organization_id), workspaceId: String(row.workspace_id) };
      if (sealed && (typeof row.account_id !== "string" || !row.account_id))
        throw new CrawlerRuntimeError("crawler_runtime_conflict", 409, "采集任务缺少封存账号。");
      await insertCrawlerRun(c, {
        id: input.runId,
        ...(legacyScope ?? { accountId: row.account_id }),
        providerId: String(row.provider_id),
        profileId: String(row.profile_id),
        actorId: input.actorId,
        requestId: String(row.request_id),
        traceId: String(row.trace_id),
        now: input.now,
      });
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
      const legacySchedulerLease = await crawlerSchedulerLeaseHasLegacyScope(c);
      await appendCrawlerSchedulerLease(c, legacySchedulerLease, legacyScope, {
        slotType: "crawler",
        slotKey: "single-host",
        taskId: String(row.collection_task_id),
        runId: input.runId,
        owner: input.leaseOwner,
        tokenHash: input.leaseTokenHash,
        now: input.now,
        expiresAt: input.expiresAt,
        requestId: String(row.request_id),
        traceId: String(row.trace_id),
      });
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
          ...(legacyScope
            ? { organization_id: legacyScope.organizationId, workspace_id: legacyScope.workspaceId }
            : { account_id: row.account_id }),
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
      await this.event(c, input, "heartbeat", input.runId);
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
      const sealed = await hasSealedCrawlerOwnership(c);
      const nativeTask = sealed && (await collectionTaskScope(c)) === "account";
      const [rows] = await c.query<RowDataPacket[]>(
        [
          "SELECT j.collection_task_id,j.status,p.updated_by FROM ",
          "browser_collection_jobs j JOIN collection_subqueries q ON q.id=j.collection_subquery_id AND q.task_id=j.collection_task_id AND q.provider_id=j.provider_id LEFT JOIN crawler_profile_leases l ON l.run_id=j.crawler_run_id AND ",
          "l.crawler_profile_id=j.crawler_profile_id JOIN crawler_profiles p ON p.id=j.crawler_profile_id ",
          nativeTask ? "JOIN collection_tasks job_task ON job_task.id=j.collection_task_id " : "",
          "WHERE ",
          "j.id=? AND j.crawler_run_id=? AND j.crawler_profile_id=? AND ",
          "j.lease_token_hash=UNHEX(?) AND (j.status<>'leased' OR l.lease_token_hash=UNHEX(?)) ",
          sealed ? "AND " + sealedCrawlerParentSql(nativeTask) : "",
          "FOR UPDATE",
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
      ) {
        await this.renewalTask(
          c,
          {
            profileId: input.profileId,
            actorId: input.actorId,
            assigneeId: String(row.updated_by),
            requestId: input.requestId,
            traceId: input.traceId,
            now: input.now,
            reason: input.errorCode ?? "blocked_login",
            collectionTaskId: String(row.collection_task_id),
          },
          await hasSealedCrawlerOwnership(c),
        );
      }
      await this.event(c, input, "released", input.runId);
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
    input: { profileId: string; actorId: string; requestId: string; traceId: string; now: Date },
    action: "acquired" | "heartbeat" | "released" | "recovered",
    runId: string,
  ) {
    await appendCrawlerLeaseEvent(c, {
      id: randomUUID(),
      runId,
      profileId: input.profileId,
      action,
      actorId: input.actorId,
      requestId: input.requestId,
      traceId: input.traceId,
      now: input.now,
    });
  }
  private async legacyRenewalCoordinates(
    c: PoolConnection,
    taskId: string,
    nativeCollection: boolean,
  ) {
    const [parent] = await c.query<RowDataPacket[]>(
      nativeCollection
        ? "SELECT r.legacy_org_id organization_id,r.legacy_workspace_id workspace_id FROM collection_tasks t " +
            "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
            "JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='collection_tasks' AND r.source_id=t.id " +
            "JOIN workspaces w ON w.id=r.legacy_workspace_id AND w.organization_id=r.legacy_org_id WHERE t.id=? FOR UPDATE"
        : "SELECT organization_id,workspace_id FROM collection_tasks WHERE id=? FOR UPDATE",
      [taskId],
    );
    if (!parent[0])
      throw new CrawlerRuntimeError("crawler_lease_invalid", 409, "找不到续期作业的原采集任务。");
    return {
      organizationId: String(parent[0].organization_id),
      workspaceId: String(parent[0].workspace_id),
    };
  }

  private async renewalTask(
    c: PoolConnection,
    input: {
      organizationId?: string;
      workspaceId?: string;
      profileId: string;
      actorId: string;
      assigneeId: string;
      requestId: string;
      traceId: string;
      now: Date;
      reason: string;
      collectionTaskId?: string;
    },
    sealed = false,
  ) {
    const mismatch = () =>
      new CrawlerRuntimeError("crawler_runtime_conflict", 409, "凭证续期任务的账号归属不匹配。");
    const owner = input.collectionTaskId
      ? await resolveCollectionReplayOwner(c, input.collectionTaskId, mismatch)
      : null;
    const nativeTask = sealed && (await nativeBusinessTaskScope(c));
    const nativeCollection = sealed && (await collectionTaskScope(c)) === "account";
    if (nativeTask && !nativeCollection) throw mismatch();
    if (nativeCollection) {
      const [[task]] = await c.query<RowDataPacket[]>(
        "SELECT account_id FROM collection_tasks WHERE id=? FOR UPDATE",
        [input.collectionTaskId],
      );
      if (!task || !owner || task.account_id !== owner.account_id) throw mismatch();
    }
    let scope: string[];
    if (nativeTask) {
      if (!owner) throw mismatch();
      scope = [owner.account_id];
    } else {
      const coordinates =
        input.organizationId && input.workspaceId
          ? input
          : await this.legacyRenewalCoordinates(c, input.collectionTaskId!, nativeCollection);
      scope = [coordinates.organizationId!, coordinates.workspaceId!];
    }
    // The legacy source uniqueness key still requires this location for new rows.
    // A task in that slot can only be reused if the sealed parent owns it.
    const [existing] = await c.query<RowDataPacket[]>(
      [
        "SELECT id,status FROM tasks WHERE " +
          (nativeTask ? "account_id=? AND " : "organization_id=? AND workspace_id=? AND "),
        "source_type='collection_followup' AND source_ref_id=? LIMIT 1 FOR UPDATE",
      ].join(""),
      [...scope, input.profileId],
    );
    const taskId = existing[0] ? String(existing[0].id) : randomUUID();
    if (owner && existing[0]) {
      const existingOwner = await resolveCollectionReplayOwner(c, taskId, mismatch, "tasks");
      if (existingOwner?.account_id !== owner.account_id) throw mismatch();
    }
    if (!existing[0])
      await c.query(
        [
          `INSERT INTO tasks (id,${nativeTask ? "account_id" : "organization_id,workspace_id"},title,description,status,priority,assignee_id,sou`,
          "rce_type,source_ref_id,collection_task_id,due_at,completed_at,created_by,version,created_at,updated_",
          `at) VALUES (${nativeTask ? "?,?,?,?" : "?,?,?,?,?"},'todo','critical',?,'collection_followup',?,?,?,NULL,?,1,?,?)`,
        ].join(""),
        [
          taskId,
          ...scope,
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
    const eventId = randomUUID();
    await c.query(
      [
        "INSERT INTO task_events (id,task_id,event_type,actor_id,payload_json,re",
        "quest_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?)",
      ].join(""),
      [
        eventId,
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
    await registerReplayOwnership(c, owner, [
      ...(existing[0] ? [] : [["tasks", taskId] as [string, string]]),
      ["task_events", eventId],
    ]);
  }
}
