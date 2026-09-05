import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  calculateScoreProjection,
  type ScoreProjectionDimension,
  type ScoreProjectionInput,
} from "@scoutops/contracts";
import {
  ScoringServiceError,
  type ScoreRule,
  type ScoreRuleAction,
  type ScoreRulePreview,
  type ScoreWriteContext,
  type ScoringRepository,
} from "./scoring-service.js";
const parse = <T>(value: unknown): T =>
    typeof value === "string" ? (JSON.parse(value) as T) : (value as T),
  iso = (value: unknown) =>
    value == null
      ? null
      : value instanceof Date
        ? value.toISOString()
        : new Date(String(value)).toISOString();
const dto = (row: RowDataPacket): ScoreRule => ({
  id: String(row.id),
  version_code: String(row.version_code),
  name: String(row.name),
  status: row.status,
  dimensions: parse(row.dimensions_json),
  thresholds: parse(row.thresholds_json),
  revision: Number(row.revision),
  submitted_at: iso(row.submitted_at),
  approved_at: iso(row.approved_at),
  activated_at: iso(row.activated_at),
  updated_at: iso(row.updated_at)!,
});
export class MySqlScoringRepository implements ScoringRepository {
  constructor(private readonly pool: Pool) {}
  async list(input: { organizationId: string; workspaceId: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM score_rules WHERE organization_id=? AND workspace_id=? ORDER BY updated_at DESC,id DESC",
      [input.organizationId, input.workspaceId],
    );
    return rows.map(dto);
  }
  async preview(input: {
    organizationId: string;
    workspaceId: string;
    ruleId: string;
    page: number;
    pageSize: number;
  }): Promise<ScoreRulePreview> {
    const [rules] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,version_code,status,dimensions_json,thresholds_json FROM score_rules " +
        "WHERE id=? AND organization_id=? AND workspace_id=?",
      [input.ruleId, input.organizationId, input.workspaceId],
    );
    const rule = rules[0];
    if (!rule) throw new ScoringServiceError("score_rule_not_found", 404, "刷新规则列表。");
    if (!["draft", "pending_approval", "approved"].includes(String(rule.status)))
      throw new ScoringServiceError(
        "score_rule_preview_status_invalid",
        409,
        "仅草稿、待审批或已批准但未启用的规则可做发布前预览。",
      );
    const [counts] = await this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total FROM opportunities WHERE organization_id=? AND workspace_id=?",
        [input.organizationId, input.workspaceId],
      ),
      total = Number(counts[0]?.total ?? 0),
      [opportunities] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,name,lifecycle_status,overall_score,recommendation_status,score_rule_version " +
          "FROM opportunities WHERE organization_id=? AND workspace_id=? " +
          "ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?",
        [
          input.organizationId,
          input.workspaceId,
          input.pageSize,
          (input.page - 1) * input.pageSize,
        ],
      );
    const opportunityIds = opportunities.map((item) => String(item.id));
    let inputRows: RowDataPacket[] = [];
    if (opportunityIds.length) {
      const placeholders = opportunityIds.map(() => "?").join(",");
      [inputRows] = await this.pool.query<RowDataPacket[]>(
        `SELECT opportunity_id,id,input_version,dimension_code,evidence_group,score_value,evidence_ids_json,missing_fields_json FROM opportunity_score_inputs WHERE organization_id=? AND workspace_id=? AND is_current=1 AND opportunity_id IN (${placeholders})`,
        [input.organizationId, input.workspaceId, ...opportunityIds],
      );
    }
    const inputsByOpportunity = new Map<string, ScoreProjectionInput[]>();
    for (const row of inputRows) {
      const opportunityId = String(row.opportunity_id),
        values = inputsByOpportunity.get(opportunityId) ?? [];
      values.push({
        id: String(row.id),
        input_version: Number(row.input_version),
        dimension_code: String(row.dimension_code),
        evidence_group: row.evidence_group,
        score_value: row.score_value == null ? null : Number(row.score_value),
        evidence_ids: parse<string[]>(row.evidence_ids_json),
        missing_fields: parse<string[]>(row.missing_fields_json),
      });
      inputsByOpportunity.set(opportunityId, values);
    }
    const dimensions = parse<ScoreProjectionDimension[]>(rule.dimensions_json),
      thresholds = parse<{ recommend_min: number; observe_min: number }>(rule.thresholds_json),
      items = opportunities.map((opportunity) => {
        const opportunityId = String(opportunity.id),
          projection = calculateScoreProjection(
            dimensions,
            thresholds,
            inputsByOpportunity.get(opportunityId) ?? [],
          ),
          currentScore =
            opportunity.overall_score == null ? null : Number(opportunity.overall_score),
          scoreDelta =
            currentScore == null || projection.overall_score == null
              ? null
              : Math.round((projection.overall_score - currentScore) * 100) / 100;
        return {
          opportunity_id: opportunityId,
          opportunity_name: String(opportunity.name),
          lifecycle_status: String(opportunity.lifecycle_status),
          current_score: currentScore,
          current_recommendation_status: String(opportunity.recommendation_status),
          current_rule_version:
            opportunity.score_rule_version == null ? null : String(opportunity.score_rule_version),
          projected_score: projection.overall_score,
          projected_recommendation_status: projection.recommendation_status,
          projected_coverage_percent: projection.coverage_percent,
          score_delta: scoreDelta,
          recommendation_changed:
            String(opportunity.recommendation_status) !== projection.recommendation_status,
          missing_fields: projection.missing_fields,
        };
      }),
      pageSummary = {
        increased: items.filter((item) => item.score_delta != null && item.score_delta > 0).length,
        decreased: items.filter((item) => item.score_delta != null && item.score_delta < 0).length,
        unchanged: items.filter((item) => item.score_delta === 0).length,
        newly_calculable: items.filter(
          (item) => item.current_score == null && item.projected_score != null,
        ).length,
        insufficient_data: items.filter((item) => item.projected_score == null).length,
        recommendation_changed: items.filter((item) => item.recommendation_changed).length,
      };
    return {
      rule_id: String(rule.id),
      rule_version_code: String(rule.version_code),
      rule_status: rule.status,
      page: input.page,
      page_size: input.pageSize,
      total,
      items,
      page_summary: pageSummary,
      read_only: true,
    };
  }
  async create(input: ScoreWriteContext & { id: string; value: any; route: string }) {
    const previous = await this.operation<ScoreRule>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      await c.query(
        "INSERT INTO score_rules (id,organization_id,workspace_id,version_code,name," +
          "status,dimensions_json,thresholds_json,revision,created_by,created_at,updated_at) VALUES " +
          "(?,?,?,?,?,'draft',?,?,1,?,?,?)",
        [
          input.id,
          input.organizationId,
          input.workspaceId,
          input.value.version_code,
          input.value.name,
          JSON.stringify(input.value.dimensions),
          JSON.stringify(input.value.thresholds),
          input.actorId,
          now,
          now,
        ],
      );
      const result = (await this.get(c, input.id, input.organizationId, input.workspaceId))!;
      await this.record(
        c,
        input,
        "score_rule.created",
        input.id,
        { version_code: result.version_code, status: result.status },
        now,
      );
      await this.saveOperation(c, input, input.id, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ScoringServiceError(
          "score_rule_version_conflict",
          409,
          "使用新的 version_code，或刷新规则列表。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async action(
    input: ScoreWriteContext & {
      ruleId: string;
      action: ScoreRuleAction;
      reason: string;
      expectedRevision: number;
      targetRuleId?: string;
      route: string;
    },
  ) {
    const previous = await this.operation<ScoreRule>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM score_rules WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [input.ruleId, input.organizationId, input.workspaceId],
      );
      const row = rows[0];
      if (!row) throw new ScoringServiceError("score_rule_not_found", 404, "刷新规则列表。");
      if (Number(row.revision) !== input.expectedRevision)
        throw new ScoringServiceError(
          "score_rule_revision_conflict",
          409,
          "刷新规则并使用最新 revision 重试。",
        );
      const allowed: Record<ScoreRuleAction, string[]> = {
        submit: ["draft"],
        approve: ["pending_approval"],
        reject: ["pending_approval"],
        activate: ["approved"],
        rollback: ["active"],
      };
      if (!allowed[input.action].includes(row.status))
        throw new ScoringServiceError(
          "score_rule_transition_invalid",
          409,
          `当前 ${row.status} 状态不能执行 ${input.action}。`,
        );
      let resultId = input.ruleId,
        resulting: string = {
          submit: "pending_approval",
          approve: "approved",
          reject: "rejected",
          activate: "active",
          rollback: "rolled_back",
        }[input.action]!;
      if (input.action === "submit")
        await c.query(
          "UPDATE score_rules SET status='pending_approval',submitted_by=?,submitted_at=?," +
            "revision=revision+1,updated_at=? WHERE id=?",
          [input.actorId, now, now, input.ruleId],
        );
      if (input.action === "approve")
        await c.query(
          "UPDATE score_rules SET status='approved',approved_by=?,approved_at=?,revision=revision+1,updated_at=? WHERE id=?",
          [input.actorId, now, now, input.ruleId],
        );
      if (input.action === "reject")
        await c.query(
          "UPDATE score_rules SET status='rejected',revision=revision+1,updated_at=? WHERE id=?",
          [now, input.ruleId],
        );
      if (input.action === "activate") {
        await c.query(
          "UPDATE score_rules SET status='retired',revision=revision+1,updated_at=? WHERE organization_id=? " +
            "AND workspace_id=? AND status='active'",
          [now, input.organizationId, input.workspaceId],
        );
        await c.query(
          "UPDATE score_rules SET status='active',activated_at=?,revision=revision+1,updated_at=? WHERE id=?",
          [now, now, input.ruleId],
        );
        await this.queueAll(c, input, input.ruleId, now);
      }
      if (input.action === "rollback") {
        const [target] = await c.query<RowDataPacket[]>(
          "SELECT id FROM score_rules WHERE id=? AND organization_id=? AND workspace_id=? AND status " +
            "IN ('approved','retired') FOR UPDATE",
          [input.targetRuleId, input.organizationId, input.workspaceId],
        );
        if (!target[0])
          throw new ScoringServiceError(
            "score_rule_rollback_target_invalid",
            409,
            "目标规则必须是当前工作区已批准或已停用版本。",
          );
        await c.query(
          "UPDATE score_rules SET status='rolled_back',rollback_target_id=?,rolled_back_at=?," +
            "revision=revision+1,updated_at=? WHERE id=?",
          [input.targetRuleId, now, now, input.ruleId],
        );
        await c.query(
          "UPDATE score_rules SET status='active',activated_at=?,revision=revision+1,updated_at=? WHERE id=?",
          [now, now, input.targetRuleId],
        );
        await this.queueAll(c, input, input.targetRuleId!, now);
        resultId = input.targetRuleId!;
        resulting = "active";
      }
      await c.query(
        "INSERT INTO score_rule_actions (id,organization_id,workspace_id,score_rule_id," +
          "action,reason,previous_status,resulting_status,actor_id,request_id,trace_id," +
          "created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.organizationId,
          input.workspaceId,
          input.ruleId,
          input.action,
          input.reason,
          row.status,
          resulting,
          input.actorId,
          input.requestId,
          input.traceId,
          now,
        ],
      );
      const result = (await this.get(c, resultId, input.organizationId, input.workspaceId))!;
      await this.record(
        c,
        input,
        `score_rule.${input.action}`,
        input.ruleId,
        {
          reason: input.reason,
          previous_status: row.status,
          resulting_status: resulting,
          target_rule_id: input.targetRuleId ?? null,
        },
        now,
      );
      await this.saveOperation(c, input, input.ruleId, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async recordInput(
    input: ScoreWriteContext & { opportunityId: string; value: any; route: string },
  ) {
    const previous = await this.operation<any>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = new Date(),
      inputId = randomUUID();
    try {
      await c.beginTransaction();
      const [opportunities] = await c.query<RowDataPacket[]>(
        "SELECT version FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [input.opportunityId, input.organizationId, input.workspaceId],
      );
      const opportunity = opportunities[0];
      if (!opportunity)
        throw new ScoringServiceError("opportunity_not_found", 404, "刷新机会列表。");
      if (Number(opportunity.version) !== input.value.expected_version)
        throw new ScoringServiceError(
          "opportunity_version_conflict",
          409,
          "刷新机会详情并使用最新 version 重试。",
        );
      const [versions] = await c.query<RowDataPacket[]>(
          "SELECT COALESCE(MAX(input_version),0)+1 next_version FROM opportunity_score_inputs WHERE " +
            "opportunity_id=? AND dimension_code=?",
          [input.opportunityId, input.value.dimension_code],
        ),
        inputVersion = Number(versions[0]?.next_version ?? 1);
      await c.query(
        "UPDATE opportunity_score_inputs SET is_current=0 WHERE opportunity_id=? AND dimension_code=? AND is_current=1",
        [input.opportunityId, input.value.dimension_code],
      );
      await c.query(
        "INSERT INTO opportunity_score_inputs (id,organization_id,workspace_id,opportunity_id," +
          "dimension_code,evidence_group,score_value,source_type,source_ref_id,evidence_ids_json," +
          "missing_fields_json,observed_at,input_version,is_current,created_by,request_id," +
          "trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
        [
          inputId,
          input.organizationId,
          input.workspaceId,
          input.opportunityId,
          input.value.dimension_code,
          input.value.evidence_group,
          input.value.score_value,
          input.value.source_type,
          input.value.source_ref_id,
          JSON.stringify(input.value.evidence_ids),
          JSON.stringify(input.value.missing_fields),
          input.value.observed_at,
          inputVersion,
          input.actorId,
          input.requestId,
          input.traceId,
          now,
        ],
      );
      const [active] = await c.query<RowDataPacket[]>(
        "SELECT id FROM score_rules WHERE organization_id=? AND workspace_id=? AND status='active' LIMIT 1",
        [input.organizationId, input.workspaceId],
      );
      let jobStatus: "queued" | "waiting_for_active_rule" = "waiting_for_active_rule";
      if (active[0]) {
        await this.queueOne(c, input, input.opportunityId, String(active[0].id), now);
        jobStatus = "queued";
      }
      const version = Number(opportunity.version) + 1;
      await c.query("UPDATE opportunities SET version=?,updated_at=? WHERE id=?", [
        version,
        now,
        input.opportunityId,
      ]);
      const result = {
        input_id: inputId,
        opportunity_id: input.opportunityId,
        version,
        job_status: jobStatus,
      };
      await this.record(
        c,
        input,
        "opportunity.score_input.recorded",
        input.opportunityId,
        {
          dimension_code: input.value.dimension_code,
          evidence_group: input.value.evidence_group,
          input_version: inputVersion,
          job_status: jobStatus,
        },
        now,
      );
      await this.saveOperation(c, input, inputId, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async queue(
    input: ScoreWriteContext & { opportunityId: string; expectedVersion: number; route: string },
  ) {
    const previous = await this.operation<any>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [opportunities] = await c.query<RowDataPacket[]>(
        "SELECT version FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [input.opportunityId, input.organizationId, input.workspaceId],
      );
      if (!opportunities[0])
        throw new ScoringServiceError("opportunity_not_found", 404, "刷新机会列表。");
      if (Number(opportunities[0].version) !== input.expectedVersion)
        throw new ScoringServiceError(
          "opportunity_version_conflict",
          409,
          "刷新机会详情并使用最新 version 重试。",
        );
      const [rules] = await c.query<RowDataPacket[]>(
        "SELECT id FROM score_rules WHERE organization_id=? AND workspace_id=? AND status='active' LIMIT 1",
        [input.organizationId, input.workspaceId],
      );
      if (!rules[0])
        throw new ScoringServiceError(
          "active_score_rule_missing",
          409,
          "先批准并启用一个评分规则版本。",
        );
      const jobId = await this.queueOne(c, input, input.opportunityId, String(rules[0].id), now),
        version = Number(opportunities[0].version) + 1;
      await c.query(
        'UPDATE opportunities SET version=?,lifecycle_status=IF(lifecycle_status="candidate",' +
          '"validating",lifecycle_status),updated_at=? WHERE id=?',
        [version, now, input.opportunityId],
      );
      const result = { job_id: jobId, opportunity_id: input.opportunityId, version };
      await this.record(
        c,
        input,
        "opportunity.score.queued",
        input.opportunityId,
        { job_id: jobId, score_rule_id: String(rules[0].id) },
        now,
      );
      await this.saveOperation(c, input, jobId, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  private async get(c: PoolConnection, id: string, organizationId: string, workspaceId: string) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT * FROM score_rules WHERE id=? AND organization_id=? AND workspace_id=?",
      [id, organizationId, workspaceId],
    );
    return rows[0] ? dto(rows[0]) : null;
  }
  private async queueOne(
    c: PoolConnection,
    input: { organizationId: string; workspaceId: string; requestId: string; traceId: string },
    opportunityId: string,
    ruleId: string,
    now: Date,
  ) {
    const id = randomUUID();
    await c.query(
      "INSERT INTO opportunity_score_jobs (id,organization_id,workspace_id,opportunity_id," +
        "score_rule_id,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at) VALUES (?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        id,
        input.organizationId,
        input.workspaceId,
        opportunityId,
        ruleId,
        now,
        input.requestId,
        input.traceId,
        now,
        now,
      ],
    );
    return id;
  }
  private async queueAll(c: PoolConnection, input: ScoreWriteContext, ruleId: string, now: Date) {
    const [items] = await c.query<RowDataPacket[]>(
      "SELECT id FROM opportunities WHERE organization_id=? AND workspace_id=?",
      [input.organizationId, input.workspaceId],
    );
    for (const item of items) await this.queueOne(c, input, String(item.id), ruleId, now);
    await c.query(
      "INSERT INTO automatic_selection_evaluations " +
        "(opportunity_id,organization_id,workspace_id,status,attempt_count,available_at,created_at,updated_at) " +
        "SELECT o.id,o.organization_id,o.workspace_id,'queued',0,?,?,? FROM opportunities o WHERE " +
        "o.organization_id=? AND o.workspace_id=? AND o.decision_status='pending' ON DUPLICATE KEY UPDATE " +
        "status=IF(status='leased',status,'queued'),available_at=IF(status='leased',available_at,VALUES(available_at))," +
        "last_error_code=IF(status='leased',last_error_code,NULL),updated_at=VALUES(updated_at)",
      [now, now, now, input.organizationId, input.workspaceId],
    );
  }
  private async operation<T>(input: ScoreWriteContext & { route: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM score_rule_operations WHERE actor_id=? AND route=? AND idempotency_key=?",
      [input.actorId, input.route, input.idempotencyKey],
    );
    return rows[0] ? parse<T>(rows[0].result_json) : null;
  }
  private async saveOperation(
    c: PoolConnection,
    input: ScoreWriteContext & { route: string },
    resourceId: string,
    result: unknown,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO score_rule_operations (id,actor_id,route,idempotency_key,resource_id," +
        "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [
        randomUUID(),
        input.actorId,
        input.route,
        input.idempotencyKey,
        resourceId,
        JSON.stringify(result),
        now,
      ],
    );
  }
  private async record(
    c: PoolConnection,
    input: ScoreWriteContext,
    eventType: string,
    resourceId: string,
    payload: unknown,
    now: Date,
  ) {
    const eventId = randomUUID();
    await c.query(
      "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type," +
        "resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json," +
        "occurred_at) VALUES (?,?,?,?,?,?,'user',?,?,?,?,?)",
      [
        eventId,
        input.organizationId,
        input.workspaceId,
        eventType,
        eventType.startsWith("score_rule.") ? "score_rule" : "opportunity",
        resourceId,
        input.actorId,
        input.requestId,
        input.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO opportunity_outbox (id,organization_id,workspace_id,event_type," +
        "resource_type,resource_id,payload_json,status,attempt_count,available_at," +
        "request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued'," +
        "0,?,?,?,?,?)",
      [
        eventId,
        input.organizationId,
        input.workspaceId,
        eventType,
        eventType.startsWith("score_rule.") ? "score_rule" : "opportunity",
        resourceId,
        JSON.stringify(payload),
        now,
        input.requestId,
        input.traceId,
        now,
        now,
      ],
    );
  }
}
