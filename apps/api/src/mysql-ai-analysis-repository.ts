import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { AiAnalysisServiceError, type AiAnalysisRepository } from "./ai-analysis-service.js";
const parse = (v: any) => (typeof v === "string" ? JSON.parse(v) : v),
  iso = (v: any) => new Date(v).toISOString();
export class MySqlAiAnalysisRepository implements AiAnalysisRepository {
  constructor(private readonly pool: Pool) {}
  async list(i: any) {
    const [o] = await this.pool.query<RowDataPacket[]>(
      "SELECT id FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=?",
      [i.opportunityId, i.organizationId, i.workspaceId],
    );
    if (!o[0]) throw new AiAnalysisServiceError("opportunity_not_found", 404, "刷新机会列表。");
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT q.id,q.status,q.attempt_count,q.last_error_code,q.input_sha256,q.prompt_contract_version," +
        "q.created_at,r.id result_id,r.result_json,r.ai_generated,r.model_name,r.provider_request_id," +
        "r.review_status,rv.outcome review_outcome,rv.notes review_notes,rv.reviewed_by," +
        "rv.created_at reviewed_at FROM ai_analysis_requests q LEFT JOIN ai_analysis_results " +
        "r ON r.request_id_fk=q.id LEFT JOIN ai_analysis_reviews rv ON rv.result_id=r.id WHERE " +
        "q.organization_id=? AND q.workspace_id=? AND q.opportunity_id=? ORDER BY q.created_at " +
        "DESC",
      [i.organizationId, i.workspaceId, i.opportunityId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      status: r.status,
      attempt_count: Number(r.attempt_count),
      last_error_code: r.last_error_code,
      input_sha256: String(r.input_sha256),
      prompt_contract_version: r.prompt_contract_version,
      created_at: iso(r.created_at),
      result: r.result_id
        ? {
            id: String(r.result_id),
            content: parse(r.result_json),
            ai_generated: Boolean(r.ai_generated),
            model_name: r.model_name,
            provider_request_id: r.provider_request_id,
            review_status: r.review_status,
            review: r.review_outcome
              ? {
                  outcome: r.review_outcome,
                  notes: r.review_notes,
                  reviewed_by: String(r.reviewed_by),
                  reviewed_at: iso(r.reviewed_at),
                }
              : null,
          }
        : null,
    }));
  }
  async queue(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [opps] = await c.query<RowDataPacket[]>(
        "SELECT id,name,market,category,lifecycle_status,recommendation_status,overall_score," +
          "trend_score,competition_score,profit_status,risk_level,confidence_status," +
          "confidence_score,coverage_status,decision_status,version,updated_at FROM opportunities " +
          "WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [i.opportunityId, i.organizationId, i.workspaceId],
      );
      const o = opps[0];
      if (!o) throw new AiAnalysisServiceError("opportunity_not_found", 404, "刷新机会列表。");
      if (Number(o.version) !== i.value.expected_version)
        throw new AiAnalysisServiceError("ai_analysis_version_conflict", 409, "刷新机会后重试。");
      const [evidence] = await c.query<RowDataPacket[]>(
        "SELECT evidence_type,evidence_id,raw_evidence_id,observed_at FROM opportunity_evidence_links " +
          "WHERE opportunity_id=? ORDER BY observed_at DESC LIMIT 100",
        [i.opportunityId],
      );
      const [scores] = await c.query<RowDataPacket[]>(
        "SELECT status,coverage_percent,confidence_score,recommendation_status,missing_fields_json," +
          "scored_at FROM opportunity_score_runs WHERE opportunity_id=? ORDER BY scored_at DESC," +
          "id DESC LIMIT 1",
        [i.opportunityId],
      );
      const [profits] = await c.query<RowDataPacket[]>(
        "SELECT status,currency,sale_price,total_cost,net_profit,net_margin_percent," +
          "missing_fields_json,calculated_at FROM opportunity_profit_runs WHERE opportunity_id=? " +
          "ORDER BY calculated_at DESC,id DESC LIMIT 1",
        [i.opportunityId],
      );
      const snapshot = {
        source_refs: [
          `opportunity:${i.opportunityId}`,
          ...evidence.map((x) => `evidence:${String(x.evidence_id)}`),
          ...(scores[0] ? ["score:latest"] : []),
          ...(profits[0] ? ["profit:latest"] : []),
        ],
        opportunity: {
          ...o,
          id: String(o.id),
          overall_score: o.overall_score == null ? null : Number(o.overall_score),
          trend_score: o.trend_score == null ? null : Number(o.trend_score),
          competition_score: o.competition_score == null ? null : Number(o.competition_score),
          confidence_score: o.confidence_score == null ? null : Number(o.confidence_score),
          version: Number(o.version),
          updated_at: iso(o.updated_at),
        },
        evidence: evidence.map((x) => ({
          evidence_type: x.evidence_type,
          evidence_id: String(x.evidence_id),
          raw_evidence_id: String(x.raw_evidence_id),
          observed_at: iso(x.observed_at),
        })),
        latest_score: scores[0]
          ? {
              ...scores[0],
              coverage_percent: Number(scores[0].coverage_percent),
              confidence_score:
                scores[0].confidence_score == null ? null : Number(scores[0].confidence_score),
              missing_fields: parse(scores[0].missing_fields_json),
              missing_fields_json: undefined,
              scored_at: iso(scores[0].scored_at),
            }
          : null,
        latest_profit: profits[0]
          ? {
              ...profits[0],
              sale_price: profits[0].sale_price == null ? null : Number(profits[0].sale_price),
              total_cost: profits[0].total_cost == null ? null : Number(profits[0].total_cost),
              net_profit: profits[0].net_profit == null ? null : Number(profits[0].net_profit),
              net_margin_percent:
                profits[0].net_margin_percent == null
                  ? null
                  : Number(profits[0].net_margin_percent),
              missing_fields: parse(profits[0].missing_fields_json),
              missing_fields_json: undefined,
              calculated_at: iso(profits[0].calculated_at),
            }
          : null,
      };
      const encoded = JSON.stringify(snapshot),
        sha = createHash("sha256").update(encoded).digest("hex");
      await c.query(
        "INSERT INTO ai_analysis_requests (id,organization_id,workspace_id,opportunity_id," +
          "opportunity_version,status,attempt_count,available_at,input_snapshot_json," +
          "input_sha256,prompt_contract_version,request_id,trace_id,created_by,created_at," +
          "updated_at) VALUES (?,?,?,?,?,'queued',0,?,?,?,'opportunity-assist-v1',?," +
          "?,?,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.opportunityId,
          o.version,
          now,
          encoded,
          sha,
          i.requestId,
          i.traceId,
          i.actorId,
          now,
          now,
        ],
      );
      const result = {
        id: i.id,
        opportunity_id: i.opportunityId,
        status: "queued",
        input_sha256: sha,
        prompt_contract_version: "opportunity-assist-v1",
      };
      await this.record(c, i, "ai.analysis.queued", i.id, result, now);
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
  async review(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id,review_status FROM ai_analysis_results WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [i.resultId, i.organizationId, i.workspaceId],
      );
      if (!rows[0])
        throw new AiAnalysisServiceError("ai_analysis_result_not_found", 404, "刷新 AI 分析记录。");
      if (rows[0].review_status !== "pending")
        throw new AiAnalysisServiceError("ai_analysis_review_conflict", 409, "该结果已经抽检。");
      await c.query(
        "INSERT INTO ai_analysis_reviews (id,organization_id,workspace_id,result_id," +
          "outcome,notes,reviewed_by,request_id,trace_id,created_at) VALUES (?,?,?," +
          "?,?,?,?,?,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.resultId,
          i.value.outcome,
          i.value.notes,
          i.actorId,
          i.requestId,
          i.traceId,
          now,
        ],
      );
      await c.query("UPDATE ai_analysis_results SET review_status=? WHERE id=?", [
        i.value.outcome,
        i.resultId,
      ]);
      const result = {
        id: i.id,
        result_id: i.resultId,
        outcome: i.value.outcome,
        notes: i.value.notes,
        reviewed_by: i.actorId,
        reviewed_at: now.toISOString(),
      };
      await this.record(c, i, "ai.analysis.reviewed", i.resultId, result, now);
      await this.save(c, i, i.resultId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async operation(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM ai_analysis_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?",
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse(rows[0].result_json) : null;
  }
  private async save(c: PoolConnection, i: any, resource: string, result: any, now: Date) {
    await c.query(
      "INSERT INTO ai_analysis_operations (id,actor_id,route_key,idempotency_key," +
        "resource_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, resource, JSON.stringify(result), now],
    );
  }
  private async record(
    c: PoolConnection,
    i: any,
    type: string,
    resource: string,
    payload: any,
    now: Date,
  ) {
    const id = randomUUID();
    await c.query(
      "INSERT INTO ai_analysis_events (id,organization_id,workspace_id,event_type," +
        "resource_id,actor_id,payload_json,request_id,trace_id,created_at) VALUES (?," +
        "?,?,?,?,?,?,?,?,?)",
      [
        id,
        i.organizationId,
        i.workspaceId,
        type,
        resource,
        i.actorId,
        JSON.stringify(payload),
        i.requestId,
        i.traceId,
        now,
      ],
    );
    await c.query(
      "INSERT INTO ai_analysis_outbox (id,organization_id,workspace_id,event_type," +
        "resource_id,payload_json,status,available_at,created_at) VALUES (?,?,?,?," +
        "?,?,'queued',?,?)",
      [id, i.organizationId, i.workspaceId, type, resource, JSON.stringify(payload), now, now],
    );
  }
}
