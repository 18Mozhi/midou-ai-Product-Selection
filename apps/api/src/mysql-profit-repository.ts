import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  ProfitServiceError,
  type ApprovalRole,
  type CostRule,
  type CostRuleAction,
  type ProfitAnalysis,
  type ProfitRepository,
  type ProfitWriteContext,
} from "./profit-service.js";
const parse = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T)),
  iso = (v: unknown) =>
    v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString(),
  day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
export class MySqlProfitRepository implements ProfitRepository {
  constructor(private readonly pool: Pool) {}
  async listRules(input: { organizationId: string; workspaceId: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT r.*,GROUP_CONCAT(CASE WHEN a.decision='approved' THEN a.approval_role END) approvals " +
        "FROM cost_rules r LEFT JOIN cost_rule_approvals a ON a.cost_rule_id=r.id WHERE r.organization_id=? " +
        "AND r.workspace_id=? GROUP BY r.id ORDER BY r.updated_at DESC,r.id DESC",
      [input.organizationId, input.workspaceId],
    );
    return rows.map((row) => this.dto(row));
  }
  async getAnalysis(input: {
    organizationId: string;
    workspaceId: string;
    opportunityId: string;
  }): Promise<ProfitAnalysis> {
    const [opportunities] = await this.pool.query<RowDataPacket[]>(
      "SELECT id FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      [input.opportunityId, input.organizationId, input.workspaceId],
    );
    if (!opportunities[0])
      throw new ProfitServiceError("opportunity_not_found", 404, "刷新机会列表。");
    const [inputs] = await this.pool.query<RowDataPacket[]>(
      "SELECT input_type,amount_value,currency,source_type,source_ref_id,evidence_id," +
        "observed_at,input_version,platform FROM opportunity_cost_inputs WHERE opportunity_id=? " +
        "AND organization_id=? AND workspace_id=? AND is_current=1 ORDER BY platform," +
        "input_type",
      [input.opportunityId, input.organizationId, input.workspaceId],
    );
    const [runs] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM opportunity_profit_runs WHERE opportunity_id=? AND organization_id=? AND " +
        "workspace_id=? ORDER BY calculated_at DESC,id DESC LIMIT 1",
      [input.opportunityId, input.organizationId, input.workspaceId],
    );
    const run = runs[0];
    let components: RowDataPacket[] = [];
    if (run) {
      [components] = await this.pool.query<RowDataPacket[]>(
        "SELECT component_type,source_amount,source_currency,converted_amount,target_currency," +
          "source_ref_id,evidence_id,exchange_quote_id,missing_reason FROM opportunity_profit_components " +
          "WHERE profit_run_id=? ORDER BY FIELD(component_type,'sale_price','purchase_price'," +
          "'logistics','platform_fee','payment_fee','tax','fulfillment')",
        [run.id],
      );
    }
    const numeric = (value: unknown) => (value == null ? null : Number(value));
    return {
      latest_run: run
        ? {
            id: String(run.id),
            status: run.status,
            rule_version_code: String(run.rule_version_code),
            platform: String(run.platform),
            market: String(run.market),
            currency: run.currency == null ? null : String(run.currency),
            sale_price: numeric(run.sale_price),
            total_cost: numeric(run.total_cost),
            net_profit: numeric(run.net_profit),
            net_margin_percent: numeric(run.net_margin_percent),
            missing_fields: parse<string[]>(run.missing_fields_json),
            calculated_at: iso(run.calculated_at)!,
            components: components.map((item) => ({
              component_type: String(item.component_type),
              source_amount: numeric(item.source_amount),
              source_currency: item.source_currency == null ? null : String(item.source_currency),
              converted_amount: numeric(item.converted_amount),
              target_currency: item.target_currency == null ? null : String(item.target_currency),
              source_ref_id: item.source_ref_id == null ? null : String(item.source_ref_id),
              evidence_id: item.evidence_id == null ? null : String(item.evidence_id),
              exchange_quote_id:
                item.exchange_quote_id == null ? null : String(item.exchange_quote_id),
              missing_reason: item.missing_reason == null ? null : String(item.missing_reason),
            })),
          }
        : null,
      current_inputs: inputs.map((item) => ({
        input_type: item.input_type,
        amount_value: Number(item.amount_value),
        currency: String(item.currency),
        source_type: String(item.source_type),
        source_ref_id: String(item.source_ref_id),
        evidence_id: String(item.evidence_id),
        observed_at: iso(item.observed_at)!,
        input_version: Number(item.input_version),
        platform: String(item.platform),
      })),
    };
  }
  async createRule(input: ProfitWriteContext & { id: string; value: any; route: string }) {
    const previous = await this.operation<CostRule>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      await c.query(
        "INSERT INTO cost_rules (id,organization_id,workspace_id,market,platform," +
          "version_code,name,status,fee_lines_json,effective_from,revision,created_by," +
          "created_at,updated_at) VALUES (?,?,?,?,?,?,?,'draft',?,?,1,?,?,?)",
        [
          input.id,
          input.organizationId,
          input.workspaceId,
          input.value.market,
          input.value.platform,
          input.value.version_code,
          input.value.name,
          JSON.stringify(input.value.fee_lines),
          input.value.effective_from,
          input.actorId,
          now,
          now,
        ],
      );
      const result = (await this.get(c, input.id, input.organizationId, input.workspaceId))!;
      await this.record(
        c,
        input,
        "cost_rule.created",
        input.id,
        {
          market: result.market,
          platform: result.platform,
          version_code: result.version_code,
        },
        now,
      );
      await this.save(c, input, input.id, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProfitServiceError(
          "cost_rule_version_conflict",
          409,
          "更换市场、平台或版本代码。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async actRule(
    input: ProfitWriteContext & {
      ruleId: string;
      action: CostRuleAction;
      reason: string;
      expectedRevision: number;
      approvalRole?: ApprovalRole;
      targetRuleId?: string;
      route: string;
    },
  ) {
    const previous = await this.operation<CostRule>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM cost_rules WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [input.ruleId, input.organizationId, input.workspaceId],
      );
      const row = rows[0];
      if (!row) throw new ProfitServiceError("cost_rule_not_found", 404, "刷新费用规则。");
      if (Number(row.revision) !== input.expectedRevision)
        throw new ProfitServiceError(
          "cost_rule_revision_conflict",
          409,
          "刷新规则并使用最新 revision。",
        );
      let resultId = input.ruleId;
      if (input.action === "submit") {
        if (row.status !== "draft")
          throw new ProfitServiceError("cost_rule_transition_invalid", 409, "只有草稿可以提交。");
        await c.query(
          "UPDATE cost_rules SET status='pending_approval',submitted_by=?,submitted_at=?," +
            "revision=revision+1,updated_at=? WHERE id=?",
          [input.actorId, now, now, input.ruleId],
        );
      } else if (input.action === "approve") {
        if (row.status !== "pending_approval" || !input.approvalRole)
          throw new ProfitServiceError("cost_rule_transition_invalid", 409, "当前规则不能审批。");
        await c.query(
          "INSERT INTO cost_rule_approvals (id,organization_id,workspace_id,cost_rule_id," +
            "approval_role,decision,reason,actor_id,request_id,trace_id,created_at) VALUES (?," +
            "?,?,?,?,'approved',?,?,?,?,?)",
          [
            randomUUID(),
            input.organizationId,
            input.workspaceId,
            input.ruleId,
            input.approvalRole,
            input.reason,
            input.actorId,
            input.requestId,
            input.traceId,
            now,
          ],
        );
        const [count] = await c.query<RowDataPacket[]>(
          "SELECT COUNT(DISTINCT approval_role) count FROM cost_rule_approvals WHERE cost_rule_id=? AND decision='approved'",
          [input.ruleId],
        );
        await c.query(
          "UPDATE cost_rules SET status=?,revision=revision+1,updated_at=? WHERE id=?",
          [Number(count[0]?.count) === 2 ? "approved" : "pending_approval", now, input.ruleId],
        );
      } else if (input.action === "reject") {
        if (row.status !== "pending_approval" || !input.approvalRole)
          throw new ProfitServiceError(
            "cost_rule_transition_invalid",
            409,
            "拒绝必须指定真实审批角色。",
          );
        await c.query(
          "INSERT INTO cost_rule_approvals (id,organization_id,workspace_id,cost_rule_id," +
            "approval_role,decision,reason,actor_id,request_id,trace_id,created_at) VALUES (?," +
            "?,?,?,?,'rejected',?,?,?,?,?)",
          [
            randomUUID(),
            input.organizationId,
            input.workspaceId,
            input.ruleId,
            input.approvalRole,
            input.reason,
            input.actorId,
            input.requestId,
            input.traceId,
            now,
          ],
        );
        await c.query(
          "UPDATE cost_rules SET status='rejected',revision=revision+1,updated_at=? WHERE id=?",
          [now, input.ruleId],
        );
      } else if (input.action === "publish") {
        if (row.status !== "approved")
          throw new ProfitServiceError(
            "cost_rule_transition_invalid",
            409,
            "必须完成两类审批后才能发布。",
          );
        await c.query(
          "UPDATE cost_rules SET status='retired',revision=revision+1,updated_at=? WHERE organization_id=? " +
            "AND workspace_id=? AND market=? AND platform=? AND status='active'",
          [now, input.organizationId, input.workspaceId, row.market, row.platform],
        );
        await c.query(
          "UPDATE cost_rules SET status='active',published_by=?,published_at=?,revision=revision+1,updated_at=? WHERE id=?",
          [input.actorId, now, now, input.ruleId],
        );
        await this.queueAll(c, input, input.ruleId, row.market, row.platform, now);
      } else {
        if (row.status !== "active" || !input.targetRuleId)
          throw new ProfitServiceError(
            "cost_rule_transition_invalid",
            409,
            "只有活动规则可以回滚。",
          );
        const [target] = await c.query<RowDataPacket[]>(
          "SELECT id FROM cost_rules WHERE id=? AND organization_id=? AND workspace_id=? AND market=? " +
            "AND platform=? AND status IN ('approved','retired') FOR UPDATE",
          [input.targetRuleId, input.organizationId, input.workspaceId, row.market, row.platform],
        );
        if (!target[0])
          throw new ProfitServiceError(
            "cost_rule_rollback_target_invalid",
            409,
            "目标必须是同市场同平台的已批准或停用版本。",
          );
        await c.query(
          "UPDATE cost_rules SET status='rolled_back',rollback_target_id=?,rolled_back_at=?," +
            "revision=revision+1,updated_at=? WHERE id=?",
          [input.targetRuleId, now, now, input.ruleId],
        );
        await c.query(
          "UPDATE cost_rules SET status='active',published_by=?,published_at=?,revision=revision+1,updated_at=? WHERE id=?",
          [input.actorId, now, now, input.targetRuleId],
        );
        await this.queueAll(c, input, input.targetRuleId, row.market, row.platform, now);
        resultId = input.targetRuleId;
      }
      const result = (await this.get(c, resultId, input.organizationId, input.workspaceId))!;
      await this.record(
        c,
        input,
        `cost_rule.${input.action}`,
        input.ruleId,
        {
          reason: input.reason,
          approval_role: input.approvalRole ?? null,
          target_rule_id: input.targetRuleId ?? null,
          resulting_status: result.status,
        },
        now,
      );
      await this.save(c, input, input.ruleId, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ProfitServiceError(
          "cost_rule_approval_conflict",
          409,
          "该角色已审批此规则；刷新后继续。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async recordRate(input: ProfitWriteContext & { id: string; value: any; route: string }) {
    const previous = await this.operation<any>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [providers] = await c.query<RowDataPacket[]>(
        "SELECT id FROM providers WHERE id=? AND status='enabled' AND JSON_CONTAINS(fields_json,JSON_QUOTE('exchange_rate'))",
        [input.value.provider_id],
      );
      if (!providers[0])
        throw new ProfitServiceError(
          "exchange_provider_not_approved",
          409,
          "选择已启用且声明 exchange_rate 字段的 Provider。",
        );
      await c.query(
        "INSERT INTO exchange_rate_quotes (id,organization_id,workspace_id,provider_id," +
          "base_currency,quote_currency,rate_value,quote_date,observed_at,source_ref_id," +
          "evidence_id,created_by,request_id,trace_id,created_at) VALUES (?,?,?,?,?," +
          "?,?,?,?,?,?,?,?,?,?)",
        [
          input.id,
          input.organizationId,
          input.workspaceId,
          input.value.provider_id,
          input.value.base_currency,
          input.value.quote_currency,
          input.value.rate_value,
          input.value.quote_date,
          input.value.observed_at,
          input.value.source_ref_id,
          input.value.evidence_id,
          input.actorId,
          input.requestId,
          input.traceId,
          now,
        ],
      );
      const result = {
        id: input.id,
        provider_id: input.value.provider_id,
        pair: `${input.value.base_currency}/${input.value.quote_currency}`,
        quote_date: input.value.quote_date,
      };
      await this.record(c, input, "exchange_rate.recorded", input.id, result, now);
      await this.save(c, input, input.id, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async recordCost(
    input: ProfitWriteContext & {
      id: string;
      opportunityId: string;
      value: any;
      route: string;
    },
  ) {
    const previous = await this.operation<any>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [ops] = await c.query<RowDataPacket[]>(
        "SELECT market,version FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [input.opportunityId, input.organizationId, input.workspaceId],
      );
      const op = ops[0];
      if (!op) throw new ProfitServiceError("opportunity_not_found", 404, "刷新机会列表。");
      if (Number(op.version) !== input.value.expected_version)
        throw new ProfitServiceError(
          "opportunity_version_conflict",
          409,
          "刷新机会并使用最新 version。",
        );
      const [versions] = await c.query<RowDataPacket[]>(
          "SELECT COALESCE(MAX(input_version),0)+1 next_version FROM opportunity_cost_inputs WHERE " +
            "opportunity_id=? AND platform=? AND input_type=?",
          [input.opportunityId, input.value.platform, input.value.input_type],
        ),
        inputVersion = Number(versions[0]?.next_version ?? 1);
      await c.query(
        "UPDATE opportunity_cost_inputs SET is_current=0 WHERE opportunity_id=? AND platform=? AND input_type=? AND is_current=1",
        [input.opportunityId, input.value.platform, input.value.input_type],
      );
      await c.query(
        "INSERT INTO opportunity_cost_inputs (id,organization_id,workspace_id,opportunity_id," +
          "platform,input_type,amount_value,currency,source_type,source_ref_id,evidence_id," +
          "observed_at,input_version,is_current,confirmed_by,request_id,trace_id,created_at) VALUES " +
          "(?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
        [
          input.id,
          input.organizationId,
          input.workspaceId,
          input.opportunityId,
          input.value.platform,
          input.value.input_type,
          input.value.amount_value,
          input.value.currency,
          input.value.source_type,
          input.value.source_ref_id,
          input.value.evidence_id,
          input.value.observed_at,
          inputVersion,
          input.actorId,
          input.requestId,
          input.traceId,
          now,
        ],
      );
      const [rules] = await c.query<RowDataPacket[]>(
        "SELECT id FROM cost_rules WHERE organization_id=? AND workspace_id=? AND market=? AND " +
          "platform=? AND status='active' AND effective_from<=? ORDER BY effective_from DESC LIMIT " +
          "1",
        [input.organizationId, input.workspaceId, op.market, input.value.platform, now],
      );
      let jobStatus = "waiting_for_active_rule";
      if (rules[0]) {
        await this.queueOne(c, input, input.opportunityId, String(rules[0].id), now);
        jobStatus = "queued";
      }
      const version = Number(op.version) + 1;
      await c.query("UPDATE opportunities SET version=?,updated_at=? WHERE id=?", [
        version,
        now,
        input.opportunityId,
      ]);
      const result = {
        input_id: input.id,
        opportunity_id: input.opportunityId,
        version,
        job_status: jobStatus,
      };
      await this.record(
        c,
        input,
        "opportunity.cost_input.confirmed",
        input.opportunityId,
        {
          input_type: input.value.input_type,
          input_version: inputVersion,
          currency: input.value.currency,
          job_status: jobStatus,
        },
        now,
      );
      await this.save(c, input, input.id, result, now);
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
    input: ProfitWriteContext & {
      opportunityId: string;
      platform: string;
      expectedVersion: number;
      route: string;
    },
  ) {
    const previous = await this.operation<any>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [ops] = await c.query<RowDataPacket[]>(
        "SELECT market,version FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [input.opportunityId, input.organizationId, input.workspaceId],
      );
      if (!ops[0]) throw new ProfitServiceError("opportunity_not_found", 404, "刷新机会列表。");
      if (Number(ops[0].version) !== input.expectedVersion)
        throw new ProfitServiceError(
          "opportunity_version_conflict",
          409,
          "刷新机会并使用最新 version。",
        );
      const [rules] = await c.query<RowDataPacket[]>(
        "SELECT id FROM cost_rules WHERE organization_id=? AND workspace_id=? AND market=? AND " +
          "platform=? AND status='active' AND effective_from<=? ORDER BY effective_from DESC LIMIT " +
          "1",
        [input.organizationId, input.workspaceId, ops[0].market, input.platform, now],
      );
      if (!rules[0])
        throw new ProfitServiceError(
          "active_cost_rule_missing",
          409,
          "先完成费用规则双审批并发布。",
        );
      const id = await this.queueOne(c, input, input.opportunityId, String(rules[0].id), now),
        version = Number(ops[0].version) + 1;
      await c.query("UPDATE opportunities SET version=?,updated_at=? WHERE id=?", [
        version,
        now,
        input.opportunityId,
      ]);
      const result = {
        job_id: id,
        opportunity_id: input.opportunityId,
        version,
      };
      await this.record(
        c,
        input,
        "opportunity.profit.queued",
        input.opportunityId,
        {
          job_id: id,
          cost_rule_id: String(rules[0].id),
          platform: input.platform,
        },
        now,
      );
      await this.save(c, input, id, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  private dto(row: RowDataPacket): CostRule {
    return {
      id: String(row.id),
      market: String(row.market),
      platform: String(row.platform),
      version_code: String(row.version_code),
      name: String(row.name),
      status: row.status,
      fee_lines: parse(row.fee_lines_json),
      effective_from: day(row.effective_from),
      revision: Number(row.revision),
      approvals: row.approvals ? (String(row.approvals).split(",") as ApprovalRole[]) : [],
      published_at: iso(row.published_at),
      updated_at: iso(row.updated_at)!,
    };
  }
  private async get(c: PoolConnection, id: string, org: string, ws: string) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT r.*,GROUP_CONCAT(CASE WHEN a.decision='approved' THEN a.approval_role END) approvals " +
        "FROM cost_rules r LEFT JOIN cost_rule_approvals a ON a.cost_rule_id=r.id WHERE r.id=? " +
        "AND r.organization_id=? AND r.workspace_id=? GROUP BY r.id",
      [id, org, ws],
    );
    return rows[0] ? this.dto(rows[0]) : null;
  }
  private async queueOne(
    c: PoolConnection,
    input: {
      organizationId: string;
      workspaceId: string;
      requestId: string;
      traceId: string;
    },
    opportunityId: string,
    ruleId: string,
    now: Date,
  ) {
    const id = randomUUID();
    await c.query(
      "INSERT INTO opportunity_profit_jobs (id,organization_id,workspace_id,opportunity_id," +
        "cost_rule_id,status,attempt_count,available_at,request_id,trace_id,created_at," +
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
  private async queueAll(
    c: PoolConnection,
    input: ProfitWriteContext,
    ruleId: string,
    market: string,
    platform: string,
    now: Date,
  ) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT DISTINCT o.id FROM opportunities o JOIN opportunity_cost_inputs i ON i.opportunity_id=o.id " +
        "AND i.platform=? AND i.is_current=1 WHERE o.organization_id=? AND o.workspace_id=? AND " +
        "o.market=?",
      [platform, input.organizationId, input.workspaceId, market],
    );
    for (const row of rows) await this.queueOne(c, input, String(row.id), ruleId, now);
  }
  private async operation<T>(input: ProfitWriteContext & { route: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM cost_operations WHERE actor_id=? AND route=? AND idempotency_key=?",
      [input.actorId, input.route, input.idempotencyKey],
    );
    return rows[0] ? parse<T>(rows[0].result_json) : null;
  }
  private async save(
    c: PoolConnection,
    input: ProfitWriteContext & { route: string },
    resourceId: string,
    result: unknown,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO cost_operations (id,actor_id,route,idempotency_key,resource_id," +
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
    input: ProfitWriteContext,
    eventType: string,
    resourceId: string,
    payload: unknown,
    now: Date,
  ) {
    const id = randomUUID(),
      type = eventType.startsWith("cost_rule.")
        ? "cost_rule"
        : eventType.startsWith("exchange_rate.")
          ? "exchange_rate"
          : "opportunity";
    await c.query(
      "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type," +
        "resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json," +
        "occurred_at) VALUES (?,?,?,?,?,?,'user',?,?,?,?,?)",
      [
        id,
        input.organizationId,
        input.workspaceId,
        eventType,
        type,
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
        id,
        input.organizationId,
        input.workspaceId,
        eventType,
        type,
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
