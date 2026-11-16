import { appendCollectionSubquery } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import {
  appendCompetitorEvent,
  appendCompetitorOutbox,
  hasLegacyCompetitorEventScope,
  hasLegacyCompetitorRuleScope,
} from "@scoutops/database";
import {
  amazonPublicSignalJoinSql,
  amazonPublicSignalSelectSql,
  amazonPublicSignalsWithReviewsSelectSql,
  readAmazonPublicSignals,
} from "./amazon-public-signals.js";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { requireAccountReadRehearsal } from "./account-read-rehearsal.js";
import {
  competitorDetailEvidenceSql,
  opportunityPrimaryAsinSql,
} from "./opportunity-selection-policy.js";
import {
  CompetitorServiceError,
  type CompetitorRepository,
  type CompetitorWriteContext,
} from "./competitor-service.js";
const parse = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T)),
  iso = (v: unknown) =>
    v == null ? null : (v instanceof Date ? v : new Date(String(v))).toISOString();
const owned = (table: string, idSql: string, accountSql = "?") =>
  `EXISTS (SELECT 1 FROM account_owned_records owner WHERE owner.source_table='${table}' AND owner.source_id=${idSql} AND owner.account_id=${accountSql})`;
const sameScope = (child: string, parent: string) =>
  `${child}.organization_id=${parent}.organization_id AND ${child}.workspace_id=${parent}.workspace_id`;
async function nativeCompetitorStorage(db: Pick<PoolConnection, "query">) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM competitors WHERE Field IN ('organization_id','workspace_id','account_id')",
  );
  const shape = columns
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (shape === "account_id") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new Error("competitor_scope_schema_invalid");
}
const sealedCompetitorOwner = (alias: "o" | "co") =>
  `AND (${alias}.reason='exclusive_owner' OR (${alias}.reason IN ('shared','unassigned') AND ${alias}.account_id=cut.primary_account_id)) `;
const nativeEvidenceOrigin = (record: "n_signal" | "n_detail", parent: "c" | "t_detail") =>
  `EXISTS (SELECT 1 FROM raw_evidence proof_e STRAIGHT_JOIN collection_tasks proof_t ON proof_t.id=proof_e.collection_task_id
    WHERE proof_e.id=${record}.raw_evidence_id AND proof_e.provider_id=${record}.provider_id
      AND proof_e.account_id=${record}.account_id AND ${sameScope("proof_t", parent)}
      AND ${owned("collection_tasks", "proof_t.id", `${record}.account_id`)})`;
const nativeSignalJoin = amazonPublicSignalJoinSql.replace(
  `AND ${sameScope("n_signal", "c")}`,
  `AND n_signal.account_id=co.account_id AND ${nativeEvidenceOrigin("n_signal", "c")}`,
);
const nativeDetailProof = competitorDetailEvidenceSql("s")
  .replace(`AND ${sameScope("n_detail", "t_detail")} `, "")
  .replace(
    "WHERE LEFT(s.source_ref_id,11)",
    `WHERE n_detail.account_id=co.account_id AND ${nativeEvidenceOrigin("n_detail", "t_detail")}
    AND ${owned("normalized_records", "n_detail.id", "co.account_id")}
    AND ${owned("collection_subqueries", "q_detail.id", "co.account_id")}
    AND ${owned("collection_task_evidence_links", "l_detail.id", "co.account_id")}
    AND LEFT(s.source_ref_id,11)`,
  );
const accountOrigin = (record: "n_signal" | "n_detail") =>
  `EXISTS (SELECT 1 FROM raw_evidence proof_e JOIN collection_tasks proof_t ON proof_t.id=proof_e.collection_task_id
    WHERE proof_e.id=${record}.raw_evidence_id AND proof_e.provider_id=${record}.provider_id
    AND proof_e.account_id=co.account_id AND proof_t.account_id=co.account_id
    AND ${owned("collection_tasks", "proof_t.id", "co.account_id")})`;
const accountSignalJoin = nativeSignalJoin.replace(
  nativeEvidenceOrigin("n_signal", "c"),
  accountOrigin("n_signal"),
);
const accountDetailProof = nativeDetailProof
  .replace(nativeEvidenceOrigin("n_detail", "t_detail"), accountOrigin("n_detail"))
  .replace(sameScope("c_detail", "t_detail"), "c_detail.account_id=t_detail.account_id")
  .replace(
    "WHERE n_detail.account_id=co.account_id",
    "WHERE t_detail.account_id=co.account_id AND n_detail.account_id=co.account_id",
  );
export class MySqlCompetitorRepository implements CompetitorRepository {
  constructor(private readonly pool: Pool) {}
  private async accountReadLayout() {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() " +
        "AND TABLE_NAME IN ('raw_evidence','normalized_records','competitors','collection_tasks') AND COLUMN_NAME IN ('account_id','organization_id','workspace_id')",
    );
    const shape = (table: string) =>
      rows
        .filter((r) => r.TABLE_NAME === table)
        .map((r) => r.COLUMN_NAME)
        .sort()
        .join(",");
    const records = shape("normalized_records"),
      evidence = shape("raw_evidence");
    if (records !== evidence || !["account_id", "organization_id,workspace_id"].includes(records))
      throw new Error("competitor_evidence_scope_schema_invalid");
    const competitor = shape("competitors"),
      task = shape("collection_tasks");
    if (
      ![competitor, task].every((value) =>
        ["account_id", "organization_id,workspace_id"].includes(value),
      ) ||
      (task === "account_id" && records !== "account_id") ||
      (competitor === "account_id" && task !== "account_id")
    )
      throw new Error("competitor_account_read_schema_invalid");
    return {
      nativeEvidence: records === "account_id",
      nativeCompetitor: competitor === "account_id",
      nativeTask: task === "account_id",
    };
  }
  private async readSummaries(
    i: Parameters<CompetitorRepository["list"]>[0] & { competitorId?: string },
  ) {
    const accountId = "accountId" in i ? i.accountId : null;
    if (accountId !== null) await requireAccountReadRehearsal(this.pool);
    const account = accountId !== null;
    const layout = account ? await this.accountReadLayout() : null;
    const native = layout?.nativeEvidence;
    const accountProof = Boolean(layout?.nativeCompetitor);
    const signalJoin = accountProof
      ? accountSignalJoin
      : layout?.nativeTask
        ? nativeSignalJoin.replace(nativeEvidenceOrigin("n_signal", "c"), accountOrigin("n_signal"))
        : nativeSignalJoin;
    const detailProof = accountProof
      ? accountDetailProof
      : layout?.nativeTask
        ? nativeDetailProof
            .replace(nativeEvidenceOrigin("n_detail", "t_detail"), accountOrigin("n_detail"))
            .replace(`AND ${sameScope("c_detail", "t_detail")} `, "")
            .replace(
              "WHERE n_detail.account_id=co.account_id",
              "WHERE t_detail.account_id=co.account_id AND n_detail.account_id=co.account_id",
            )
        : nativeDetailProof;
    const scopeParams = "organizationId" in i ? [i.organizationId, i.workspaceId] : [i.accountId];
    const snapshots = account
      ? ` AND ${owned("competitor_snapshots", "history.id", "co.account_id")}`
      : "";
    const latestSnapshot = account
      ? ` AND s.competitor_id=c.id AND ${owned("competitor_snapshots", "s.id", "co.account_id")}`
      : " AND s.competitor_id=c.id";
    const rawProof = account ? owned("raw_evidence", "s.evidence_id", "co.account_id") : "";
    const signal = account
      ? `AND ${owned("normalized_records", "n_signal.id", "co.account_id")} AND ${rawProof} `
      : "";
    const detail = account
      ? `(${native ? detailProof : competitorDetailEvidenceSql("s")} AND n_signal.id IS NOT NULL AND ${owned("collection_tasks", "CONVERT(SUBSTRING(s.source_ref_id,12,36) USING ascii)", "co.account_id")})`
      : competitorDetailEvidenceSql("s");
    const result = await this.pool.query<RowDataPacket[]>(
      "SELECT c.*,p_snapshot.status provider_status,s.current_price,s.currency,s.rank_value,s.review_count,s.rating_value," +
        (i.opportunityId || i.competitorId
          ? amazonPublicSignalsWithReviewsSelectSql
          : amazonPublicSignalSelectSql) +
        "s.availability,s.captured_at,s.freshness,s.source_status,s.source_ref_id," +
        `s.evidence_id,s.id visible_snapshot_id,${detail} detail_collected,(SELECT COUNT(*) FROM competitor_snapshots history WHERE history.competitor_id=c.id${snapshots}) ` +
        "snapshot_count FROM competitors c " +
        (account
          ? "JOIN account_owned_records co ON co.source_table='competitors' AND co.source_id=c.id " +
            "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 "
          : "") +
        `LEFT JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id${latestSnapshot} ` +
        "LEFT JOIN providers p_snapshot ON p_snapshot.id=c.provider_id " +
        (native ? signalJoin : amazonPublicSignalJoinSql) +
        signal +
        (i.competitorId ? "WHERE c.id=? AND " : "WHERE ") +
        (account
          ? `co.account_id=? ${sealedCompetitorOwner("co")}${accountProof ? "AND c.account_id=co.account_id " : ""}AND (c.opportunity_id IS NULL OR ${owned("opportunities", "c.opportunity_id", "co.account_id")}) `
          : "c.organization_id=? AND c.workspace_id=? ") +
        "AND c.deleted_at IS NULL " +
        (i.opportunityId ? "AND c.opportunity_id=? " : "") +
        "ORDER BY c.updated_at " +
        "DESC,c.id DESC",
      [
        ...(i.competitorId ? [i.competitorId] : []),
        ...scopeParams,
        ...(i.opportunityId ? [i.opportunityId] : []),
      ],
    );
    if (account) for (const row of result[0]) row.latest_snapshot_id = row.visible_snapshot_id;
    return { rows: result[0], layout };
  }
  async list(i: Parameters<CompetitorRepository["list"]>[0]) {
    const { rows } = await this.readSummaries(i);
    return rows.map((r) => this.dto(r));
  }
  async get(i: Parameters<CompetitorRepository["get"]>[0]) {
    const { rows, layout } = await this.readSummaries(i);
    if (!rows[0]) throw new CompetitorServiceError("competitor_not_found", 404, "刷新竞品列表。");
    const accountId = "accountId" in i ? i.accountId : null;
    const organizationId =
      "organizationId" in i ? i.organizationId : String(rows[0].organization_id);
    const workspaceId = "workspaceId" in i ? i.workspaceId : String(rows[0].workspace_id);
    const params = accountId !== null ? [i.competitorId, accountId] : [i.competitorId];
    const childFilter = (table: string) =>
      accountId !== null ? ` AND ${owned(table, `${table}.id`)}` : "";
    const [snapshots] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM competitor_snapshots WHERE competitor_id=?${childFilter("competitor_snapshots")} ORDER BY captured_at DESC,id DESC LIMIT 100`,
      params,
    );
    const [changes] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM competitor_changes WHERE competitor_id=?${childFilter("competitor_changes")} ORDER BY changed_at DESC,id DESC LIMIT 200`,
      params,
    );
    const [alerts] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM competitor_alerts WHERE competitor_id=?${childFilter("competitor_alerts")} ORDER BY created_at DESC,id DESC LIMIT 100`,
      params,
    );
    const legacyEventScope = await hasLegacyCompetitorEventScope(this.pool);
    const nativeTask = layout?.nativeTask;
    if (nativeTask && legacyEventScope) throw new Error("competitor_event_scope_schema_invalid");
    const eventScope = legacyEventScope ? "e" : "parent_competitor";
    const [collectionAttempts] = await this.pool.query<RowDataPacket[]>(
      "SELECT t.id,t.status,t.last_error_code,t.attempt_count,t.available_result_count,t.updated_at " +
        "FROM competitor_events e " +
        (legacyEventScope || nativeTask
          ? ""
          : "JOIN competitors parent_competitor ON parent_competitor.id=e.competitor_id ") +
        "JOIN collection_tasks t ON " +
        "t.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.task_id')) USING ascii) " +
        "WHERE e.competitor_id=? AND " +
        (nativeTask
          ? "t.account_id=? AND "
          : `${eventScope}.organization_id=? AND ${eventScope}.workspace_id=? AND `) +
        "e.event_type IN ('competitor.created','competitor.collection.scheduled') " +
        (accountId !== null
          ? `AND ${nativeTask ? "" : sameScope("t", eventScope) + " AND "}${owned("competitor_events", "e.id")} AND ${owned("collection_tasks", "t.id")} `
          : "") +
        "ORDER BY e.created_at DESC,e.id DESC LIMIT 1",
      [
        i.competitorId,
        ...(nativeTask ? [accountId] : [organizationId, workspaceId]),
        ...(accountId !== null ? [accountId, accountId] : []),
      ],
    );
    return {
      ...this.dto(rows[0]),
      latest_collection: collectionAttempts[0]
        ? {
            task_id: String(collectionAttempts[0].id),
            status: String(collectionAttempts[0].status),
            last_error_code: collectionAttempts[0].last_error_code
              ? String(collectionAttempts[0].last_error_code)
              : null,
            attempt_count: Number(collectionAttempts[0].attempt_count),
            available_result_count: Number(collectionAttempts[0].available_result_count),
            updated_at: iso(collectionAttempts[0].updated_at),
          }
        : null,
      snapshots: snapshots.map((r) => this.snapshot(r)),
      changes: changes.map((r) => ({
        id: String(r.id),
        field: String(r.field_name),
        previous: String(r.previous_value),
        current: String(r.current_value),
        changed_at: iso(r.changed_at),
        evidence_id: String(r.evidence_id),
        impact_explanation: String(r.impact_explanation),
      })),
      alerts: alerts.map((r) => ({
        id: String(r.id),
        change_id: String(r.change_id),
        rule_id: String(r.rule_id),
        notification_status: r.notification_status,
        task_status: r.task_status,
        payload: parse(r.payload_json),
        created_at: iso(r.created_at),
      })),
    };
  }
  async listRules(i: Parameters<CompetitorRepository["listRules"]>[0]) {
    if ("accountId" in i) await requireAccountReadRehearsal(this.pool);
    else if (!(await hasLegacyCompetitorRuleScope(this.pool)))
      throw new CompetitorServiceError(
        "competitor_account_scope_required",
        403,
        "请使用账号规则列表。",
      );
    const [rows] =
      "accountId" in i
        ? await this.pool.query<RowDataPacket[]>(
            `SELECT r.* FROM competitor_monitor_rules r JOIN account_owned_records co
        ON co.source_table='competitor_monitor_rules' AND co.source_id=r.id
        JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
        WHERE co.account_id=? ${sealedCompetitorOwner("co")}AND (r.competitor_id IS NULL OR ${owned("competitors", "r.competitor_id", "co.account_id")}) ORDER BY r.updated_at DESC,r.id DESC`,
            [i.accountId],
          )
        : await this.pool.query<RowDataPacket[]>(
            "SELECT * FROM competitor_monitor_rules WHERE organization_id=? AND workspace_id=? ORDER BY updated_at DESC,id DESC",
            [i.organizationId, i.workspaceId],
          );
    return rows.map((r) => ({
      id: String(r.id),
      competitor_id: r.competitor_id ? String(r.competitor_id) : null,
      metric: r.metric,
      direction: r.direction,
      threshold_value: r.threshold_value == null ? null : Number(r.threshold_value),
      status: r.status,
      revision: Number(r.revision),
      updated_at: iso(r.updated_at),
    }));
  }
  async create(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      if (!i.value.opportunity_id) {
        // MySQL treats NULLs as distinct in a unique key. Serialize all unbound
        // creates in this workspace, then use a current read (including tombstones).
        const [workspace] = await c.query<RowDataPacket[]>(
          "SELECT id FROM workspaces WHERE id=? AND organization_id=? FOR UPDATE",
          [i.workspaceId, i.organizationId],
        );
        if (!workspace[0])
          throw new CompetitorServiceError("workspace_not_found", 404, "选择当前工作区。");
        const [duplicate] = await c.query<RowDataPacket[]>(
          "SELECT id FROM competitors WHERE organization_id=? AND workspace_id=? AND market=? AND source_site=? AND external_id=? AND opportunity_id IS NULL LIMIT 1 FOR UPDATE",
          [
            i.organizationId,
            i.workspaceId,
            i.value.market,
            i.value.source_site,
            i.value.external_id,
          ],
        );
        if (duplicate[0])
          throw new CompetitorServiceError(
            "competitor_identity_conflict",
            409,
            "该竞品已经在监控列表中。",
          );
      }
      let providerId = i.value.provider_id as string | null;
      if (providerId) await this.provider(c, providerId);
      else {
        if (!/(^|\.)amazon\.com$/i.test(new URL(i.value.product_url).hostname))
          throw new CompetitorServiceError(
            "competitor_provider_required",
            400,
            "当前一键采集支持 Amazon 商品页；其他来源请选择已启用来源并提交证据快照。",
          );
        providerId = (await this.amazonProvider(c)).id;
      }
      if (i.value.opportunity_id) {
        const [o] = await c.query<RowDataPacket[]>(
          "SELECT id FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=?",
          [i.value.opportunity_id, i.organizationId, i.workspaceId],
        );
        if (!o[0])
          throw new CompetitorServiceError("opportunity_not_found", 404, "选择当前工作区机会。");
      }
      await c.query(
        "INSERT INTO competitors (id,organization_id,workspace_id,opportunity_id," +
          "provider_id,market,source_site,external_id,product_url,title,status,revision," +
          "created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,? ,'active'," +
          "1,?,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.value.opportunity_id,
          providerId,
          i.value.market,
          i.value.source_site,
          i.value.external_id,
          i.value.product_url,
          i.value.title,
          i.actorId,
          now,
          now,
        ],
      );
      let snapshotId: string | null = null,
        taskId: string | null = null;
      if (i.value.snapshot) {
        snapshotId = randomUUID();
        await this.insertSnapshot(c, i, snapshotId, i.id, i.value.snapshot, now);
        await c.query("UPDATE competitors SET latest_snapshot_id=? WHERE id=?", [snapshotId, i.id]);
      } else {
        taskId = i.taskId;
        await this.enqueueCollection(
          c,
          i,
          providerId,
          {
            page_url: i.value.product_url,
            projection_type: "competitor_snapshot",
            competitor_id: i.id,
          },
          now,
        );
      }
      const result = {
        id: i.id,
        status: "active",
        revision: 1,
        snapshot_id: snapshotId,
        task_id: taskId,
        job_status: "queued",
      };
      await this.event(c, i, i.id, "competitor.created", result, now);
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      if ((e as any).code === "ER_DUP_ENTRY")
        throw new CompetitorServiceError(
          "competitor_identity_conflict",
          409,
          "该竞品已经在监控列表中。",
        );
      throw e;
    } finally {
      c.release();
    }
  }
  async addSnapshot(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT provider_id,status FROM competitors WHERE id=? AND organization_id=? AND workspace_id=? " +
          "AND deleted_at IS NULL FOR UPDATE",
        [i.competitorId, i.organizationId, i.workspaceId],
      );
      if (!rows[0]) throw new CompetitorServiceError("competitor_not_found", 404, "刷新竞品列表。");
      if (rows[0].status !== "active")
        throw new CompetitorServiceError("competitor_paused", 409, "先恢复竞品监控。");
      await this.provider(c, String(rows[0].provider_id));
      await this.insertSnapshot(c, i, i.id, i.competitorId, i.value, now);
      const result = { snapshot_id: i.id, competitor_id: i.competitorId, job_status: "queued" };
      await this.event(c, i, i.competitorId, "competitor.snapshot.accepted", result, now);
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      if ((e as any).code === "ER_DUP_ENTRY")
        throw new CompetitorServiceError(
          "competitor_snapshot_conflict",
          409,
          "该来源快照已被接收。",
        );
      throw e;
    } finally {
      c.release();
    }
  }
  async createRule(i: Parameters<CompetitorRepository["createRule"]>[0]) {
    if ("accountOwnedRule" in i) return this.createAccountRule(i);
    if (!(await hasLegacyCompetitorRuleScope(this.pool)))
      throw new CompetitorServiceError(
        "competitor_account_scope_required",
        403,
        "旧工作区规则入口已停用。",
      );
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      if (i.value.competitor_id) {
        const [r] = await c.query<RowDataPacket[]>(
          "SELECT id FROM competitors WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL",
          [i.value.competitor_id, i.organizationId, i.workspaceId],
        );
        if (!r[0])
          throw new CompetitorServiceError("competitor_not_found", 404, "选择当前工作区竞品。");
      }
      await c.query(
        "INSERT INTO competitor_monitor_rules (id,organization_id,workspace_id,competitor_id," +
          "metric,direction,threshold_value,status,revision,created_by,created_at,updated_at) VALUES " +
          "(?,?,?,?,?,?,?,'enabled',1,?,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.value.competitor_id,
          i.value.metric,
          i.value.direction,
          i.value.threshold_value,
          i.actorId,
          now,
          now,
        ],
      );
      const result = { id: i.id, status: "enabled", revision: 1, ...i.value };
      await this.event(c, i, i.id, "competitor.rule.created", result, now);
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async createAccountRule(
    i: Extract<Parameters<CompetitorRepository["createRule"]>[0], { accountOwnedRule: true }>,
  ) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      await requireAccountReadRehearsal(c, { lockForTransaction: true });
      if (await hasLegacyCompetitorRuleScope(c))
        throw new CompetitorServiceError(
          "competitor_rule_migration_required",
          503,
          "先完成账号规则迁移。",
        );
      const target = i.value.competitor_id;
      if (target) {
        const native = await nativeCompetitorStorage(c);
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT x.id FROM competitors x JOIN account_owned_records o ON o.source_table='competitors' " +
            "AND o.source_id=x.id " +
            (native ? "AND x.account_id=o.account_id " : "") +
            "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
            "WHERE x.id=? AND o.account_id=? " +
            sealedCompetitorOwner("o") +
            "AND x.deleted_at IS NULL LOCK IN SHARE MODE",
          [target, i.actorId],
        );
        if (!rows[0])
          throw new CompetitorServiceError("competitor_not_found", 404, "选择本人竞品。");
      }
      const old = await this.operation(i, c);
      if (old) {
        const prior = old as Partial<typeof i.value> & { id?: unknown };
        if (
          typeof prior.id !== "string" ||
          !prior.id ||
          (prior.competitor_id ?? null) !== (target ?? null) ||
          prior.metric !== i.value.metric ||
          prior.direction !== i.value.direction ||
          prior.threshold_value !== i.value.threshold_value
        )
          throw new CompetitorServiceError(
            "competitor_rule_idempotency_conflict",
            409,
            "使用完全相同的规则重试，或为新规则使用新的幂等键。",
          );
        const [rule] = await c.query<RowDataPacket[]>(
          "SELECT r.id FROM competitor_monitor_rules r JOIN account_owned_records co " +
            "ON co.source_table='competitor_monitor_rules' AND co.source_id=r.id " +
            "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
            "WHERE r.id=? AND co.account_id=? AND r.competitor_id <=> ? " +
            sealedCompetitorOwner("co") +
            "LOCK IN SHARE MODE",
          [prior.id, i.actorId, target ?? null],
        );
        if (!rule[0])
          throw new CompetitorServiceError(
            "competitor_rule_idempotency_conflict",
            409,
            "原规则归属未能核对。",
          );
        await c.commit();
        return old;
      }
      const now = new Date(),
        eventId = randomUUID();
      const result = { id: i.id, status: "enabled", revision: 1, ...i.value };
      await c.query(
        "INSERT INTO competitor_monitor_rules (id,historical_context,competitor_id,metric,direction," +
          "threshold_value,status,revision,created_by,created_at,updated_at) VALUES (?,JSON_OBJECT(),?,?,?,?,'enabled',1,?,?,?)",
        [
          i.id,
          target,
          i.value.metric,
          i.value.direction,
          i.value.threshold_value,
          i.actorId,
          now,
          now,
        ],
      );
      const event = {
        id: eventId,
        parentId: i.id,
        eventType: "competitor.rule.created",
        actorId: i.actorId,
        payloadJson: JSON.stringify(result),
        requestId: i.requestId,
        traceId: i.traceId,
        createdAt: now,
      };
      await appendCompetitorEvent(c, event);
      await appendCompetitorOutbox(c, event);
      await c.query(
        "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) " +
          "VALUES ('competitor_monitor_rules',?,?,'exclusive_owner'),('competitor_events',?,?,'exclusive_owner'),('competitor_outbox',?,?,'exclusive_owner')",
        [i.id, i.actorId, eventId, i.actorId, eventId, i.actorId],
      );
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async setStatus(command: Parameters<CompetitorRepository["setStatus"]>[0]) {
    const accountMode = "accountOwnedStatus" in command;
    if (!accountMode) {
      const old = await this.operation(command);
      if (old) return old;
    }
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      if (accountMode) await requireAccountReadRehearsal(c, { lockForTransaction: true });
      const native = accountMode && (await nativeCompetitorStorage(c));
      const [rows] = await c.query<RowDataPacket[]>(
        accountMode
          ? "SELECT x.revision," +
              (native ? "" : "x.organization_id,x.workspace_id,") +
              "o.reason ownership_reason FROM competitors x " +
              "JOIN account_owned_records o ON o.source_table='competitors' AND o.source_id=x.id " +
              (native ? "AND x.account_id=o.account_id " : "") +
              "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
              "WHERE x.id=? AND o.account_id=? " +
              sealedCompetitorOwner("o") +
              "AND x.deleted_at IS NULL FOR UPDATE"
          : "SELECT revision FROM competitors WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        accountMode
          ? [command.competitorId, command.actorId]
          : [command.competitorId, command.organizationId, command.workspaceId],
      );
      const row = rows[0];
      if (!row) throw new CompetitorServiceError("competitor_not_found", 404, "刷新竞品列表。");
      const i =
        accountMode && !native
          ? {
              ...command,
              organizationId: String(row.organization_id),
              workspaceId: String(row.workspace_id),
            }
          : command;
      if (accountMode) {
        const old = await this.operation(i, c);
        if (old) {
          await c.commit();
          return old;
        }
      }
      if (Number(row.revision) !== i.expectedRevision)
        throw new CompetitorServiceError(
          "competitor_revision_conflict",
          409,
          "刷新后使用最新 revision。",
        );
      await c.query("UPDATE competitors SET status=?,revision=revision+1,updated_at=? WHERE id=?", [
        i.status,
        now,
        i.competitorId,
      ]);
      const result = { id: i.competitorId, status: i.status, revision: i.expectedRevision + 1 };
      const eventId = await this.event(c, i, i.competitorId, `competitor.${i.status}`, result, now);
      if (accountMode)
        await c.query(
          "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES " +
            "('competitor_events',?,?,?),('competitor_outbox',?,?,?)",
          [eventId, eventId].flatMap((id) => [id, i.actorId, row.ownership_reason]),
        );
      await this.save(c, i, i.competitorId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async collect(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT product_url,status FROM competitors WHERE id=? AND organization_id=? AND workspace_id=? " +
          "AND deleted_at IS NULL FOR UPDATE",
        [i.competitorId, i.organizationId, i.workspaceId],
      );
      if (!rows[0]) throw new CompetitorServiceError("competitor_not_found", 404, "刷新竞品列表。");
      if (rows[0].status !== "active")
        throw new CompetitorServiceError("competitor_paused", 409, "先恢复竞品监控。");
      const provider = await this.amazonProvider(c);
      await this.enqueueCollection(
        c,
        i,
        provider.id,
        {
          page_url: String(rows[0].product_url),
          projection_type: "competitor_snapshot",
          competitor_id: i.competitorId,
        },
        now,
      );
      const result = { task_id: i.taskId, competitor_id: i.competitorId, status: "scheduled" };
      await this.event(c, i, i.competitorId, "competitor.collection.scheduled", result, now);
      await this.save(c, i, i.competitorId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async discover(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT o.name,${opportunityPrimaryAsinSql} main_asin FROM opportunities o WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? FOR UPDATE`,
        [i.opportunityId, i.organizationId, i.workspaceId],
      );
      if (!rows[0])
        throw new CompetitorServiceError("opportunity_not_found", 404, "刷新机会详情。");
      const provider = await this.amazonProvider(c);
      await this.enqueueCollection(
        c,
        i,
        provider.id,
        {
          query: String(rows[0].name),
          projection_type: "opportunity_competitors",
          opportunity_id: i.opportunityId,
          ...(rows[0].main_asin ? { main_asin: String(rows[0].main_asin) } : {}),
        },
        now,
      );
      const result = { task_id: i.taskId, opportunity_id: i.opportunityId, status: "scheduled" };
      await this.save(c, i, i.opportunityId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async remove(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT revision FROM competitors WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        [i.competitorId, i.organizationId, i.workspaceId],
      );
      if (!rows[0]) throw new CompetitorServiceError("competitor_not_found", 404, "刷新竞品列表。");
      if (Number(rows[0].revision) !== i.expectedRevision)
        throw new CompetitorServiceError(
          "competitor_revision_conflict",
          409,
          "刷新详情后重试删除。",
        );
      await c.query(
        "UPDATE competitors SET deleted_at=?,status='paused',revision=revision+1,updated_at=? WHERE id=?",
        [now, now, i.competitorId],
      );
      const result = { id: i.competitorId, deleted: true, revision: i.expectedRevision + 1 };
      await this.event(
        c,
        i,
        i.competitorId,
        "competitor.deleted",
        { ...result, reason: i.reason },
        now,
      );
      await this.save(c, i, i.competitorId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async amazonProvider(c: PoolConnection) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id FROM providers WHERE code='amazon_product' AND status='enabled' AND access_mode='public_page' " +
        "AND terms_review_status='approved' AND terms_version IS NOT NULL " +
        "AND (terms_permanent=1 OR terms_expires_at>NOW(3)) LIMIT 1 FOR UPDATE",
    );
    if (!rows[0])
      throw new CompetitorServiceError(
        "amazon_crawler_unavailable",
        409,
        "Amazon 公开页面爬虫尚未启用或条款复核已失效，请联系平台管理员检查来源状态。",
      );
    return { id: String(rows[0].id) };
  }
  private async enqueueCollection(
    c: PoolConnection,
    i: any,
    providerId: string,
    target: Record<string, unknown>,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO collection_tasks(id,organization_id,workspace_id,status,coverage_status," +
        "priority,scheduled_at,available_at,attempt_count,successful_subquery_count," +
        "failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json," +
        "request_id,trace_id,version,created_by,created_at,updated_at) VALUES(?,?," +
        "?,'scheduled',NULL,'high',?,?,0,0,0,0,0,'[]',?,?,1,?,?,?)",
      [
        i.taskId,
        i.organizationId,
        i.workspaceId,
        now,
        now,
        i.requestId,
        i.traceId,
        i.actorId,
        now,
        now,
      ],
    );
    await appendCollectionSubquery(c, {
      id: i.subqueryId,
      taskId: i.taskId,
      providerId,
      ordinal: 1,
      targetJson: JSON.stringify(target),
      required: true,
      status: "pending",
      now,
    });
    await c.query(
      "INSERT INTO collection_task_events(id,task_id," +
        "event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id," +
        "metadata_json,occurred_at) VALUES(?,?,?,NULL,'scheduled','user',?,?," +
        "?,?,?)",
      [
        randomUUID(),
        i.taskId,
        "core.collection.scheduled",
        i.actorId,
        i.requestId,
        i.traceId,
        JSON.stringify(target),
        now,
      ],
    );
  }
  private async insertSnapshot(
    c: PoolConnection,
    i: any,
    id: string,
    competitorId: string,
    v: any,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO competitor_snapshots (id,competitor_id," +
        "provider_id,current_price,currency,rank_value,review_count,rating_value," +
        "availability,captured_at,freshness,source_status,source_ref_id,evidence_id," +
        "request_id,trace_id,created_at) SELECT ?,id," +
        "provider_id,?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM competitors WHERE id=?",
      [
        id,
        v.current_price,
        v.currency,
        v.rank_value,
        v.review_count,
        v.rating_value,
        v.availability,
        v.captured_at,
        v.freshness,
        v.source_status,
        v.source_ref_id,
        v.evidence_id,
        i.requestId,
        i.traceId,
        now,
        competitorId,
      ],
    );
    await c.query(
      "INSERT INTO competitor_snapshot_jobs (id,competitor_id," +
        "snapshot_id,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at) VALUES (?,?,?,'queued',0,?,?,?,?,?)",
      [randomUUID(), competitorId, id, now, i.requestId, i.traceId, now, now],
    );
  }
  private async provider(c: PoolConnection, id: string) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id FROM providers WHERE id=? AND status='enabled'",
      [id],
    );
    if (!rows[0])
      throw new CompetitorServiceError(
        "competitor_provider_not_approved",
        409,
        "选择已启用 Provider。",
      );
  }
  private dto(r: RowDataPacket) {
    return {
      id: String(r.id),
      opportunity_id: r.opportunity_id ? String(r.opportunity_id) : null,
      provider_id: String(r.provider_id),
      market: String(r.market),
      source_site: String(r.source_site),
      external_id: String(r.external_id),
      product_url: String(r.product_url),
      title: String(r.title),
      status: r.status,
      revision: Number(r.revision),
      snapshot_count: Number(r.snapshot_count ?? 0),
      latest_snapshot: r.latest_snapshot_id
        ? {
            detail_collected: Boolean(Number(r.detail_collected)),
            source_enabled: r.provider_status === "enabled",
            public_signals: readAmazonPublicSignals(r.public_signals_json),
            id: String(r.latest_snapshot_id),
            current_price: r.current_price == null ? null : Number(r.current_price),
            currency: r.currency == null ? null : String(r.currency),
            rank_value: r.rank_value == null ? null : Number(r.rank_value),
            review_count: r.review_count == null ? null : Number(r.review_count),
            rating_value: r.rating_value == null ? null : Number(r.rating_value),
            availability: r.availability,
            captured_at: iso(r.captured_at),
            freshness: r.freshness,
            source_status: r.source_status,
            source_ref_id: String(r.source_ref_id),
            evidence_id: String(r.evidence_id),
          }
        : null,
      updated_at: iso(r.updated_at),
    };
  }
  private snapshot(r: RowDataPacket) {
    return {
      id: String(r.id),
      current_price: r.current_price == null ? null : Number(r.current_price),
      currency: r.currency == null ? null : String(r.currency),
      rank_value: r.rank_value == null ? null : Number(r.rank_value),
      review_count: r.review_count == null ? null : Number(r.review_count),
      rating_value: r.rating_value == null ? null : Number(r.rating_value),
      availability: r.availability,
      captured_at: iso(r.captured_at),
      freshness: r.freshness,
      source_status: r.source_status,
      source_ref_id: String(r.source_ref_id),
      evidence_id: String(r.evidence_id),
    };
  }
  private async operation(
    i: Pick<CompetitorWriteContext, "actorId" | "idempotencyKey"> & { route: string },
    connection: Pick<Pool, "query"> = this.pool,
  ) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT result_json FROM competitor_operations WHERE actor_id=? AND route=? AND idempotency_key=?" +
        (connection === this.pool ? "" : " FOR UPDATE"),
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse(rows[0].result_json) : null;
  }
  private save(
    c: PoolConnection,
    i: Pick<CompetitorWriteContext, "actorId" | "idempotencyKey"> & { route: string },
    resourceId: string,
    result: unknown,
    now: Date,
  ) {
    return c.query(
      "INSERT INTO competitor_operations (id,actor_id,route,idempotency_key,resource_id," +
        "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, resourceId, JSON.stringify(result), now],
    );
  }
  private async event(
    c: PoolConnection,
    i: Pick<CompetitorWriteContext, "actorId" | "requestId" | "traceId"> &
      Partial<Pick<CompetitorWriteContext, "organizationId" | "workspaceId">>,
    resourceId: string,
    eventType: string,
    payload: unknown,
    now: Date,
  ) {
    const id = randomUUID();
    const scope = {
      ...(i.organizationId === undefined ? {} : { organizationId: i.organizationId }),
      ...(i.workspaceId === undefined ? {} : { workspaceId: i.workspaceId }),
    };
    await appendCompetitorEvent(c, {
      id,
      ...scope,
      parentId: resourceId,
      eventType,
      actorId: i.actorId,
      payloadJson: JSON.stringify(payload),
      requestId: i.requestId,
      traceId: i.traceId,
      createdAt: now,
    });
    await appendCompetitorOutbox(c, {
      id,
      ...scope,
      parentId: resourceId,
      eventType,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
    });
    return id;
  }
}
