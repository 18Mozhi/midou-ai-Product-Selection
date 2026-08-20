import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  SourcingServiceError,
  type SourcingContext,
  type SourcingRepository,
} from "./sourcing-service.js";
import { loadErpSourcingReference } from "./erp-sourcing-reference.js";
const parse = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : (v as T)),
  iso = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).toISOString();
export class MySqlSourcingRepository implements SourcingRepository {
  constructor(private readonly pool: Pool) {}
  async list(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT s.*,CASE WHEN s.input_type='opportunity' THEN COALESCE(o.name,s.input_ref) ELSE " +
        "s.input_ref END display_name FROM sourcing_searches s LEFT JOIN opportunities o ON s.input_type='opportunity' " +
        "AND s.input_ref=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_unicode_ci AND o.organization_id=s.organization_id " +
        "AND o.workspace_id=s.workspace_id AND o.lifecycle_status<>'deleted' WHERE s.organization_id=? " +
        "AND s.workspace_id=? AND s.deleted_at IS NULL ORDER BY s.created_at DESC," +
        "s.id DESC",
      [i.organizationId, i.workspaceId],
    );
    return rows.map((r) => this.search(r));
  }
  async detail(i: any) {
    const [searches] = await this.pool.query<RowDataPacket[]>(
      "SELECT s.*,CASE WHEN s.input_type='opportunity' THEN COALESCE(o.name,s.input_ref) ELSE " +
        "s.input_ref END display_name FROM sourcing_searches s LEFT JOIN opportunities o ON s.input_type='opportunity' " +
        "AND s.input_ref=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_unicode_ci AND o.organization_id=s.organization_id " +
        "AND o.workspace_id=s.workspace_id AND o.lifecycle_status<>'deleted' WHERE s.id=? AND " +
        "s.organization_id=? AND s.workspace_id=? AND s.deleted_at IS NULL",
      [i.searchId, i.organizationId, i.workspaceId],
    );
    if (!searches[0])
      throw new SourcingServiceError("sourcing_search_not_found", 404, "刷新找货列表。");
    const [candidates] = await this.pool.query<RowDataPacket[]>(
        "SELECT c.*,q.id quote_id,q.quote_version,q.specification quote_specification," +
          "q.lead_time_days quote_lead_time_days,q.location quote_location,q.confidence_value quote_confidence," +
          "q.stability_status,q.risk_level FROM sourcing_candidates c LEFT JOIN supplier_quotes " +
          "q ON q.candidate_id=c.id AND q.is_current=1 WHERE c.search_id=? ORDER BY c.created_at," +
          "c.id",
        [i.searchId],
      ),
      erpReference =
        searches[0].input_type === "opportunity"
          ? await loadErpSourcingReference(this.pool, {
              organizationId: i.organizationId,
              workspaceId: i.workspaceId,
              opportunityId: String(searches[0].input_ref),
            })
          : null;
    return {
      ...this.search(searches[0]),
      collection_task_id: String(searches[0].collection_task_id),
      candidates: candidates.map((r) => this.candidate(r)),
      erp_reference: erpReference,
    };
  }
  async listComparisons(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM sourcing_comparisons WHERE organization_id=? AND workspace_id=? ORDER BY created_at DESC",
      [i.organizationId, i.workspaceId],
    );
    const result = [];
    for (const row of rows) {
      const ids = parse<string[]>(row.quote_ids_json),
        [quotes] = await this.pool.query<RowDataPacket[]>(
          "SELECT * FROM supplier_quotes WHERE organization_id=? AND workspace_id=? AND id IN (?)",
          [i.organizationId, i.workspaceId, ids],
        );
      result.push({
        id: String(row.id),
        name: String(row.name),
        quotes: quotes.map((r) => this.quote(r)),
        created_at: iso(row.created_at),
      });
    }
    return result;
  }
  async createSearch(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      let taskId = i.value.collection_task_id as string | null,
        jobId: string | null = null,
        query = String(i.value.input_ref);
      if (taskId) {
        const [tasks] = await c.query<RowDataPacket[]>(
          "SELECT id,status FROM collection_tasks WHERE id=? AND organization_id=? AND workspace_id=? " +
            "AND status IN ('succeeded','succeeded_empty','completed_with_warnings') FOR UPDATE",
          [taskId, i.organizationId, i.workspaceId],
        );
        if (!tasks[0])
          throw new SourcingServiceError(
            "sourcing_collection_task_not_ready",
            409,
            "选择当前工作区已完成的供应链采集任务。",
          );
      } else {
        taskId = i.taskId;
        if (i.value.input_type === "opportunity") {
          const [opportunities] = await c.query<RowDataPacket[]>(
            "SELECT name FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=?",
            [i.value.input_ref, i.organizationId, i.workspaceId],
          );
          if (!opportunities[0])
            throw new SourcingServiceError("opportunity_not_found", 404, "选择当前工作区机会。");
          query = String(opportunities[0].name);
        }
        const [providers] = await c.query<RowDataPacket[]>(
          "SELECT id FROM providers WHERE code='made_in_china_search' AND status='enabled' AND " +
            "access_mode='public_page' LIMIT 1 FOR UPDATE",
        );
        if (!providers[0])
          throw new SourcingServiceError(
            "supplier_crawler_unavailable",
            409,
            "公开供应商爬虫尚未启用，请联系平台管理员检查来源状态。",
          );
        await this.enqueueCollection(
          c,
          i,
          String(providers[0].id),
          { query, projection_type: "sourcing_search", search_id: i.id },
          now,
        );
      }
      await c.query(
        "INSERT INTO sourcing_searches (id,organization_id,workspace_id,collection_task_id," +
          "input_type,input_ref,status,candidate_count,missing_fields_json,request_id," +
          "trace_id,created_by,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?," +
          "?,'queued',0,'[]',?,?,?,?,?,NULL)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          taskId,
          i.value.input_type,
          i.value.input_ref,
          i.requestId,
          i.traceId,
          i.actorId,
          now,
          now,
        ],
      );
      if (i.value.collection_task_id) {
        jobId = randomUUID();
        await c.query(
          "INSERT INTO sourcing_projection_jobs (id,organization_id,workspace_id,search_id," +
            "status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES " +
            "(?,?,?,?,'queued',0,?,?,?,?,?)",
          [jobId, i.organizationId, i.workspaceId, i.id, now, i.requestId, i.traceId, now, now],
        );
      }
      const result = { id: i.id, status: "queued", task_id: taskId, job_id: jobId };
      await this.record(c, i, "sourcing.search.queued", i.id, result, now);
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
  async confirmQuote(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM sourcing_candidates WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [i.value.candidate_id, i.organizationId, i.workspaceId],
      );
      const r = rows[0];
      if (!r) throw new SourcingServiceError("sourcing_candidate_not_found", 404, "刷新候选列表。");
      const [versions] = await c.query<RowDataPacket[]>(
          "SELECT COALESCE(MAX(quote_version),0)+1 version FROM supplier_quotes WHERE candidate_id=?",
          [r.id],
        ),
        version = Number(versions[0]?.version ?? 1);
      await c.query(
        "UPDATE supplier_quotes SET is_current=0 WHERE candidate_id=? AND is_current=1",
        [r.id],
      );
      await c.query(
        "INSERT INTO supplier_quotes (id,organization_id,workspace_id,candidate_id," +
          "quote_version,is_current,supplier_name,product_title,specification,moq,quoted_price," +
          "currency,lead_time_days,location,original_url,observed_at,evidence_id,confidence_value," +
          "stability_status,risk_level,confirmed_by,request_id,trace_id,created_at) VALUES (?," +
          "?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          r.id,
          version,
          r.supplier_name,
          r.product_title,
          i.value.specification,
          i.value.moq,
          r.quoted_price,
          r.currency,
          i.value.lead_time_days,
          i.value.location,
          r.original_url,
          i.value.observed_at,
          i.value.evidence_id,
          i.value.confidence_value,
          i.value.stability_status,
          i.value.risk_level,
          i.actorId,
          i.requestId,
          i.traceId,
          now,
        ],
      );
      await c.query(
        "UPDATE sourcing_candidates SET specification=?,moq=?,lead_time_days=?,location=?," +
          "confidence_value=?,status='ready',missing_fields_json='[]' WHERE id=?",
        [
          i.value.specification,
          i.value.moq,
          i.value.lead_time_days,
          i.value.location,
          i.value.confidence_value,
          r.id,
        ],
      );
      const result = {
        id: i.id,
        candidate_id: String(r.id),
        quote_version: version,
        status: "confirmed",
      };
      await this.record(c, i, "supplier_quote.confirmed", i.id, result, now);
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
  async createComparison(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id FROM supplier_quotes WHERE organization_id=? AND workspace_id=? AND is_current=1 AND id IN (?)",
        [i.organizationId, i.workspaceId, i.value.quote_ids],
      );
      if (rows.length !== i.value.quote_ids.length)
        throw new SourcingServiceError(
          "sourcing_quote_scope_invalid",
          409,
          "只比较当前工作区的现行报价。",
        );
      await c.query(
        "INSERT INTO sourcing_comparisons (id,organization_id,workspace_id,name,quote_ids_json," +
          "created_by,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.value.name,
          JSON.stringify(i.value.quote_ids),
          i.actorId,
          i.requestId,
          i.traceId,
          now,
        ],
      );
      const result = { id: i.id, name: i.value.name, quote_count: rows.length };
      await this.record(c, i, "sourcing.comparison.created", i.id, result, now);
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
  async createPurchaseTask(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT moq FROM supplier_quotes WHERE id=? AND organization_id=? AND workspace_id=? AND is_current=1",
        [i.quoteId, i.organizationId, i.workspaceId],
      );
      if (!rows[0])
        throw new SourcingServiceError("supplier_quote_not_found", 404, "刷新报价列表。");
      if (i.quantity < Number(rows[0].moq))
        throw new SourcingServiceError(
          "purchase_quantity_below_moq",
          409,
          "采购数量不得低于 MOQ。",
        );
      await c.query(
        "INSERT INTO sourcing_purchase_tasks (id,organization_id,workspace_id,quote_id," +
          "quantity,reason,status,created_by,request_id,trace_id,created_at,updated_at) VALUES " +
          "(?,?,?,?,?,?,'queued',?,?,?,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.quoteId,
          i.quantity,
          i.reason,
          i.actorId,
          i.requestId,
          i.traceId,
          now,
          now,
        ],
      );
      const result = { id: i.id, status: "queued", quote_id: i.quoteId, quantity: i.quantity };
      await this.record(c, i, "sourcing.purchase_task.queued", i.id, result, now);
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
  async refresh(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [searches] = await c.query<RowDataPacket[]>(
        "SELECT input_type,input_ref FROM sourcing_searches WHERE id=? AND organization_id=? " +
          "AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        [i.searchId, i.organizationId, i.workspaceId],
      );
      if (!searches[0])
        throw new SourcingServiceError("sourcing_search_not_found", 404, "刷新找货列表。");
      let query = String(searches[0].input_ref);
      if (searches[0].input_type === "opportunity") {
        const [opportunities] = await c.query<RowDataPacket[]>(
          "SELECT name FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=?",
          [query, i.organizationId, i.workspaceId],
        );
        if (opportunities[0]) query = String(opportunities[0].name);
      }
      const [providers] = await c.query<RowDataPacket[]>(
        "SELECT id FROM providers WHERE code='made_in_china_search' AND status='enabled' AND " +
          "access_mode='public_page' LIMIT 1 FOR UPDATE",
      );
      if (!providers[0])
        throw new SourcingServiceError(
          "supplier_crawler_unavailable",
          409,
          "公开供应商爬虫尚未启用。",
        );
      await this.enqueueCollection(
        c,
        i,
        String(providers[0].id),
        { query, projection_type: "sourcing_search", search_id: i.searchId },
        now,
      );
      await c.query(
        "UPDATE sourcing_searches SET collection_task_id=?,status='queued',updated_at=? WHERE id=?",
        [i.taskId, now, i.searchId],
      );
      const result = { id: i.searchId, task_id: i.taskId, status: "queued" };
      await this.record(c, i, "sourcing.search.refreshed", i.searchId, result, now);
      await this.save(c, i, i.searchId, result, now);
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
        "SELECT id FROM sourcing_searches WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        [i.searchId, i.organizationId, i.workspaceId],
      );
      if (!rows[0])
        throw new SourcingServiceError("sourcing_search_not_found", 404, "刷新找货列表。");
      await c.query("UPDATE sourcing_searches SET deleted_at=?,updated_at=? WHERE id=?", [
        now,
        now,
        i.searchId,
      ]);
      const result = { id: i.searchId, deleted: true };
      await this.record(
        c,
        i,
        "sourcing.search.deleted",
        i.searchId,
        { ...result, reason: i.reason },
        now,
      );
      await this.save(c, i, i.searchId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
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
    const [alternatives] = await c.query<RowDataPacket[]>(
        "SELECT id FROM providers WHERE code='ec21_supplier_search' AND status='enabled' AND access_mode='public_page' LIMIT 1",
      ),
      providerIds = [
        providerId,
        ...alternatives.map((row) => String(row.id)).filter((id) => id !== providerId),
      ];
    for (let index = 0; index < providerIds.length; index++)
      await c.query(
        "INSERT INTO collection_subqueries(id,task_id,organization_id,workspace_id," +
          "provider_id,ordinal,target_json,is_required,status,available_result_count," +
          "missing_fields_json,error_code,retryable,version,created_at,updated_at) VALUES(?," +
          "?,?,?,?,?,?,0,'pending',0,'[]',NULL,0,1,?,?)",
        [
          index === 0 ? i.subqueryId : randomUUID(),
          i.taskId,
          i.organizationId,
          i.workspaceId,
          providerIds[index],
          index + 1,
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
        "sourcing.collection.scheduled",
        i.actorId,
        i.requestId,
        i.traceId,
        JSON.stringify({ ...target, source_count: providerIds.length }),
        now,
      ],
    );
  }
  private search(r: RowDataPacket) {
    return {
      id: String(r.id),
      input_type: r.input_type,
      input_ref: String(r.input_ref),
      display_name: String(r.display_name ?? r.input_ref),
      status: r.status,
      candidate_count: Number(r.candidate_count),
      missing_fields: parse(r.missing_fields_json),
      created_at: iso(r.created_at),
      updated_at: iso(r.updated_at),
    };
  }
  private candidate(r: RowDataPacket) {
    return {
      id: String(r.id),
      supplier_name: String(r.supplier_name),
      product_title: String(r.product_title),
      specification: r.quote_specification ?? r.specification,
      moq: r.moq == null ? null : Number(r.moq),
      quoted_price: Number(r.quoted_price),
      currency: String(r.currency),
      lead_time_days: r.quote_lead_time_days == null ? null : Number(r.quote_lead_time_days),
      location: r.quote_location ?? r.location,
      original_url: String(r.original_url),
      observed_at: iso(r.observed_at),
      evidence_id: String(r.raw_evidence_id),
      confidence_value: r.quote_confidence == null ? null : Number(r.quote_confidence),
      status: r.status,
      missing_fields: parse(r.missing_fields_json),
      quote: r.quote_id
        ? {
            id: String(r.quote_id),
            version: Number(r.quote_version),
            stability_status: r.stability_status,
            risk_level: r.risk_level,
          }
        : null,
    };
  }
  private quote(r: RowDataPacket) {
    return {
      id: String(r.id),
      supplier_name: String(r.supplier_name),
      product_title: String(r.product_title),
      specification: String(r.specification),
      moq: Number(r.moq),
      quoted_price: Number(r.quoted_price),
      currency: String(r.currency),
      lead_time_days: Number(r.lead_time_days),
      location: String(r.location),
      confidence_value: Number(r.confidence_value),
      stability_status: r.stability_status,
      risk_level: r.risk_level,
      evidence_id: String(r.evidence_id),
    };
  }
  private async operation(i: SourcingContext & { route: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM sourcing_operations WHERE actor_id=? AND route=? AND idempotency_key=?",
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse(rows[0].result_json) : null;
  }
  private save(
    c: PoolConnection,
    i: SourcingContext & { route: string },
    id: string,
    result: unknown,
    now: Date,
  ) {
    return c.query(
      "INSERT INTO sourcing_operations (id,actor_id,route,idempotency_key,resource_id," +
        "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, id, JSON.stringify(result), now],
    );
  }
  private async record(
    c: PoolConnection,
    i: SourcingContext,
    type: string,
    id: string,
    payload: unknown,
    now: Date,
  ) {
    const event = randomUUID();
    await c.query(
      "INSERT INTO sourcing_events (id,organization_id,workspace_id,event_type," +
        "resource_id,actor_id,payload_json,request_id,trace_id,created_at) VALUES (?," +
        "?,?,?,?,?,?,?,?,?)",
      [
        event,
        i.organizationId,
        i.workspaceId,
        type,
        id,
        i.actorId,
        JSON.stringify(payload),
        i.requestId,
        i.traceId,
        now,
      ],
    );
    await c.query(
      "INSERT INTO sourcing_outbox (id,organization_id,workspace_id,event_type," +
        "resource_id,payload_json,status,available_at,created_at) VALUES (?,?,?,?," +
        "?,?,'queued',?,?)",
      [event, i.organizationId, i.workspaceId, type, id, JSON.stringify(payload), now, now],
    );
  }
}
