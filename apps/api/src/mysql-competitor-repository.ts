import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  CompetitorServiceError,
  type CompetitorRepository,
  type CompetitorWriteContext,
} from "./competitor-service.js";
const parse = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T)),
  iso = (v: unknown) =>
    v == null ? null : (v instanceof Date ? v : new Date(String(v))).toISOString();
export class MySqlCompetitorRepository implements CompetitorRepository {
  constructor(private readonly pool: Pool) {}
  async list(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT c.*,s.current_price,s.currency,s.rank_value,s.review_count,s.rating_value," +
        "s.availability,s.captured_at,s.freshness,s.source_status,s.source_ref_id," +
        "s.evidence_id,(SELECT COUNT(*) FROM competitor_snapshots history WHERE history.competitor_id=c.id) " +
        "snapshot_count FROM competitors c LEFT JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id " +
        "WHERE c.organization_id=? AND c.workspace_id=? AND c.deleted_at IS NULL ORDER BY c.updated_at " +
        "DESC,c.id DESC",
      [i.organizationId, i.workspaceId],
    );
    return rows.map((r) => this.dto(r));
  }
  async get(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT c.*,s.current_price,s.currency,s.rank_value,s.review_count,s.rating_value," +
        "s.availability,s.captured_at,s.freshness,s.source_status,s.source_ref_id," +
        "s.evidence_id,(SELECT COUNT(*) FROM competitor_snapshots history WHERE history.competitor_id=c.id) " +
        "snapshot_count FROM competitors c LEFT JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id " +
        "WHERE c.id=? AND c.organization_id=? AND c.workspace_id=? AND c.deleted_at IS NULL",
      [i.competitorId, i.organizationId, i.workspaceId],
    );
    if (!rows[0]) throw new CompetitorServiceError("competitor_not_found", 404, "刷新竞品列表。");
    const [snapshots] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM competitor_snapshots WHERE competitor_id=? ORDER BY captured_at DESC,id DESC LIMIT 100",
      [i.competitorId],
    );
    const [changes] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM competitor_changes WHERE competitor_id=? ORDER BY changed_at DESC,id DESC LIMIT 200",
      [i.competitorId],
    );
    const [alerts] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM competitor_alerts WHERE competitor_id=? ORDER BY created_at DESC,id DESC LIMIT 100",
      [i.competitorId],
    );
    return {
      ...this.dto(rows[0]),
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
  async listRules(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
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
  async createRule(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      if (i.value.competitor_id) {
        const [r] = await c.query<RowDataPacket[]>(
          "SELECT id FROM competitors WHERE id=? AND organization_id=? AND workspace_id=?",
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
  async setStatus(i: any) {
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
          "刷新后使用最新 revision。",
        );
      await c.query("UPDATE competitors SET status=?,revision=revision+1,updated_at=? WHERE id=?", [
        i.status,
        now,
        i.competitorId,
      ]);
      const result = { id: i.competitorId, status: i.status, revision: i.expectedRevision + 1 };
      await this.event(c, i, i.competitorId, `competitor.${i.status}`, result, now);
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
        "SELECT name FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
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
        "AND terms_review_status='approved' AND terms_reference_url IS NOT NULL AND terms_version IS NOT NULL " +
        "AND terms_expires_at>NOW(3) LIMIT 1 FOR UPDATE",
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
    await c.query(
      "INSERT INTO collection_subqueries(id,task_id,organization_id,workspace_id," +
        "provider_id,ordinal,target_json,is_required,status,available_result_count," +
        "missing_fields_json,error_code,retryable,version,created_at,updated_at) VALUES(?," +
        "?,?,?,?,1,?,1,'pending',0,'[]',NULL,0,1,?,?)",
      [
        i.subqueryId,
        i.taskId,
        i.organizationId,
        i.workspaceId,
        providerId,
        JSON.stringify(target),
        now,
        now,
      ],
    );
    await c.query(
      "INSERT INTO collection_task_events(id,task_id,organization_id,workspace_id," +
        "event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id," +
        "metadata_json,occurred_at) VALUES(?,?,?,?,?,NULL,'scheduled','user',?,?," +
        "?,?,?)",
      [
        randomUUID(),
        i.taskId,
        i.organizationId,
        i.workspaceId,
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
      "INSERT INTO competitor_snapshots (id,competitor_id,organization_id,workspace_id," +
        "provider_id,current_price,currency,rank_value,review_count,rating_value," +
        "availability,captured_at,freshness,source_status,source_ref_id,evidence_id," +
        "request_id,trace_id,created_at) SELECT ?,id,organization_id,workspace_id," +
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
      "INSERT INTO competitor_snapshot_jobs (id,organization_id,workspace_id,competitor_id," +
        "snapshot_id,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at) VALUES (?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        competitorId,
        id,
        now,
        i.requestId,
        i.traceId,
        now,
        now,
      ],
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
  private async operation(i: CompetitorWriteContext & { route: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM competitor_operations WHERE actor_id=? AND route=? AND idempotency_key=?",
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse(rows[0].result_json) : null;
  }
  private save(
    c: PoolConnection,
    i: CompetitorWriteContext & { route: string },
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
    i: CompetitorWriteContext,
    resourceId: string,
    eventType: string,
    payload: unknown,
    now: Date,
  ) {
    const id = randomUUID();
    await c.query(
      "INSERT INTO competitor_events (id,organization_id,workspace_id,competitor_id," +
        "event_type,actor_id,payload_json,request_id,trace_id,created_at) VALUES (?," +
        "?,?,?,?,?,?,?,?,?)",
      [
        id,
        i.organizationId,
        i.workspaceId,
        resourceId,
        eventType,
        i.actorId,
        JSON.stringify(payload),
        i.requestId,
        i.traceId,
        now,
      ],
    );
    await c.query(
      "INSERT INTO competitor_outbox (id,organization_id,workspace_id,aggregate_id," +
        "event_type,payload_json,status,available_at,created_at) VALUES (?,?,?,?," +
        "?,?,'pending',?,?)",
      [
        id,
        i.organizationId,
        i.workspaceId,
        resourceId,
        eventType,
        JSON.stringify(payload),
        now,
        now,
      ],
    );
  }
}
