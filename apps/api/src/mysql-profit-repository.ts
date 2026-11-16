import { appendOpportunityEvent } from "@scoutops/database";
import { appendOpportunityOutbox } from "@scoutops/database";
import { createHash, randomUUID } from "node:crypto";
import { PRIMARY_COST_APPROVER_EMAIL } from "@scoutops/auth";
import { selectionCandidateSql, automaticEvaluationEnqueueUpdateSql } from "@scoutops/database";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { rehearsalOwns, requireAccountReadRehearsal } from "./account-read-rehearsal.js";
import {
  ProfitServiceError,
  type AccountCostDraftContext,
  type ApprovalRole,
  type CostRule,
  type ProfitAnalysis,
  type ProfitRepository,
  type ProfitWriteContext,
} from "./profit-service.js";
const parse = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T)),
  iso = (v: unknown) =>
    v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString(),
  pad = (value: number) => String(value).padStart(2, "0");
export const databaseDay = (v: unknown) =>
  v instanceof Date
    ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
    : String(v).slice(0, 10);
const sealedRuleOwner = (alias: "o" | "ro") =>
  "JOIN account_ownership_cutover ownership_receipt ON ownership_receipt.slot='current' " +
  "AND ownership_receipt.contract_version=25 " +
  `AND (${alias}.reason='exclusive_owner' OR (${alias}.reason IN ('shared','unassigned') ` +
  `AND ${alias}.account_id=ownership_receipt.primary_account_id)) `;
export class MySqlProfitRepository implements ProfitRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now: () => Date = () => new Date(),
    private readonly nativeAccountScope = false,
  ) {}
  async isAccountPrimaryApprover(accountId: string) {
    return this.matchesPrimaryApprovalAccount(this.pool, accountId);
  }
  private async matchesPrimaryApprovalAccount(
    db: Pick<Pool, "query">,
    accountId: string,
    lock: boolean | "exclusive" = false,
  ) {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT cut.primary_account_id FROM account_ownership_cutover cut " +
        "JOIN users u ON u.id=cut.primary_account_id " +
        "WHERE cut.slot='current' AND cut.contract_version=25 AND cut.primary_account_id=? " +
        "AND u.status='active' AND u.email_verified_at IS NOT NULL AND BINARY u.email_normalized=BINARY ? " +
        "LIMIT 1" +
        (lock === "exclusive" ? " FOR UPDATE" : lock ? " LOCK IN SHARE MODE" : ""),
      [accountId, PRIMARY_COST_APPROVER_EMAIL],
    );
    return rows.length === 1;
  }
  async listRules(input: Parameters<ProfitRepository["listRules"]>[0]) {
    if ("accountId" in input) {
      await requireAccountReadRehearsal(this.pool);
      let rows: RowDataPacket[];
      try {
        [rows] = await this.pool.query<RowDataPacket[]>(
          `SELECT r.*,GROUP_CONCAT(CASE WHEN a.decision='approved' THEN a.approval_role END) approvals,
           MAX(ro.account_id=?) owned_by_session, MAX(g.manager_id IS NOT NULL) can_decide_as_manager
         FROM cost_rules r JOIN account_owned_records ro ON ro.source_table='cost_rules' AND ro.source_id=r.id
         ${this.nativeAccountScope ? "AND ro.account_id=r.account_id" : ""}
         ${sealedRuleOwner("ro")}
         LEFT JOIN account_cost_rule_manager_grants g
           ON g.cost_rule_id=r.id AND g.manager_id=? AND g.can_read=1 AND r.status='pending_approval'
           AND EXISTS (SELECT 1 FROM users manager_user WHERE manager_user.id=g.manager_id AND manager_user.status='active')
           AND NOT EXISTS (SELECT 1 FROM cost_rule_approvals signed
             WHERE signed.cost_rule_id=r.id AND (signed.approval_role='selection_manager' OR signed.actor_id=g.manager_id))
         LEFT JOIN cost_rule_approvals a ON a.cost_rule_id=r.id
           AND EXISTS (SELECT 1 FROM account_owned_records ra WHERE ra.source_table='cost_rule_approvals'
             AND ra.source_id=a.id AND ra.account_id=ro.account_id AND ra.reason=ro.reason)
         WHERE ro.account_id=? OR g.manager_id IS NOT NULL GROUP BY r.id ORDER BY r.updated_at DESC,r.id DESC`,
          [input.accountId, input.accountId, input.accountId],
        );
      } catch (error) {
        if (
          ["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(
            (error as { code?: string }).code ?? "",
          )
        )
          throw new ProfitServiceError(
            "account_cost_rule_manager_list_not_ready",
            503,
            "先完成隔离库经理待办迁移。",
          );
        throw error;
      }
      return rows.map((row) => this.dto(row));
    }
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT r.*,GROUP_CONCAT(CASE WHEN a.decision='approved' THEN a.approval_role END) approvals " +
        "FROM cost_rules r LEFT JOIN cost_rule_approvals a ON a.cost_rule_id=r.id WHERE r.organization_id=? " +
        "AND r.workspace_id=? GROUP BY r.id ORDER BY r.updated_at DESC,r.id DESC",
      [input.organizationId, input.workspaceId],
    );
    return rows.map((row) => this.dto(row));
  }
  async getAnalysis(
    input: Parameters<ProfitRepository["getAnalysis"]>[0],
  ): Promise<ProfitAnalysis> {
    const accountId = "accountId" in input ? input.accountId : undefined;
    if (accountId !== undefined) await requireAccountReadRehearsal(this.pool);
    const sealedOwner = (alias: string) =>
      `JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 ` +
      `AND (${alias}.reason='exclusive_owner' OR (${alias}.reason IN ('shared','unassigned') ` +
      `AND ${alias}.account_id=cut.primary_account_id))`;
    const [opportunities] =
      "organizationId" in input
        ? await this.pool.query<RowDataPacket[]>(
            "SELECT id FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
            [input.opportunityId, input.organizationId, input.workspaceId],
          )
        : await this.pool.query<RowDataPacket[]>(
            `SELECT o.id FROM opportunities o
        JOIN account_owned_records ao ON ao.source_table='opportunities' AND ao.source_id=o.id
        ${sealedOwner("ao")}
        WHERE o.id=? AND ao.account_id=? LIMIT 1`,
            [input.opportunityId, accountId],
          );
    if (!opportunities[0])
      throw new ProfitServiceError("opportunity_not_found", 404, "刷新机会列表。");
    const owned = (table: string, id: string) =>
      accountId === undefined
        ? ""
        : ` AND EXISTS (SELECT 1 FROM account_owned_records ra ${sealedOwner("ra")} ` +
          `WHERE ra.source_table='${table}' AND ra.source_id=${id} AND ra.account_id=?)`;
    const legacyParentScope = (ref: string) =>
      "organizationId" in input
        ? ` AND EXISTS (SELECT 1 FROM opportunities p WHERE p.id=${ref} AND p.organization_id=? AND p.workspace_id=?)`
        : "";
    const scope =
      "organizationId" in input
        ? [input.opportunityId, input.organizationId, input.workspaceId]
        : [input.opportunityId, input.accountId];
    const [inputs] = await this.pool.query<RowDataPacket[]>(
      "SELECT input_type,amount_value,currency,source_type,source_ref_id,evidence_id," +
        "observed_at,input_version,platform,confirmation_mode FROM opportunity_cost_inputs WHERE opportunity_id=? " +
        `AND is_current=1${legacyParentScope("opportunity_cost_inputs.opportunity_id")}${owned("opportunity_cost_inputs", "opportunity_cost_inputs.id")} ORDER BY platform,` +
        "input_type",
      scope,
    );
    const [runs] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,status,rule_version_code,platform,market,currency,sale_price,total_cost,net_profit," +
        "net_margin_percent,missing_fields_json,calculated_at FROM opportunity_profit_runs WHERE opportunity_id=?" +
        `${legacyParentScope("opportunity_profit_runs.opportunity_id")}${owned("opportunity_profit_runs", "opportunity_profit_runs.id")} ORDER BY calculated_at DESC,id DESC LIMIT 1`,
      scope,
    );
    const [reviews] = await this.pool.query<RowDataPacket[]>(
      "SELECT r.id,r.cost_input_id,r.submitter_id,r.reviewer_id,r.status,r.due_at," +
        "r.decision_reason,r.reviewed_at,r.version,r.created_at,i.input_type,i.amount_value,i.currency,i.platform,i.source_type," +
        "i.source_ref_id,i.evidence_id,i.observed_at,i.input_version," +
        "submitter.email submitter_label,reviewer.email reviewer_label FROM " +
        "opportunity_cost_input_reviews r JOIN opportunity_cost_inputs i ON i.id=r.cost_input_id " +
        "AND i.opportunity_id=r.opportunity_id " +
        "JOIN users submitter ON submitter.id=r.submitter_id JOIN users reviewer ON " +
        "reviewer.id=r.reviewer_id WHERE r.opportunity_id=?" +
        `${legacyParentScope("r.opportunity_id")}${owned("opportunity_cost_input_reviews", "r.id")}${owned("opportunity_cost_inputs", "i.id")}` +
        " ORDER BY FIELD(r.status,'pending','rejected','approved'),r.created_at DESC LIMIT 50",
      [...scope, ...(accountId === undefined ? [] : [accountId])],
    );
    const run = runs[0];
    let components: RowDataPacket[] = [];
    if (run) {
      [components] = await this.pool.query<RowDataPacket[]>(
        "SELECT component_type,source_amount,source_currency,converted_amount,target_currency," +
          "source_ref_id,evidence_id,exchange_quote_id,missing_reason FROM opportunity_profit_components " +
          `WHERE profit_run_id=?${owned("opportunity_profit_components", "opportunity_profit_components.id")} ORDER BY FIELD(component_type,'sale_price','purchase_price',` +
          "'logistics','platform_fee','payment_fee','tax','fulfillment')",
        [run.id, ...(accountId === undefined ? [] : [accountId])],
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
        confirmation_mode: item.confirmation_mode,
      })),
      cost_input_reviews: reviews.map((item) => ({
        id: String(item.id),
        cost_input_id: String(item.cost_input_id),
        input_type: item.input_type,
        amount_value: Number(item.amount_value),
        currency: String(item.currency),
        platform: String(item.platform),
        source_type: String(item.source_type),
        source_ref_id: String(item.source_ref_id),
        evidence_id: String(item.evidence_id),
        observed_at: iso(item.observed_at)!,
        input_version: Number(item.input_version),
        submitter_id: String(item.submitter_id),
        submitter_label: String(item.submitter_label),
        reviewer_id: String(item.reviewer_id),
        reviewer_label: String(item.reviewer_label),
        status: item.status,
        due_at: iso(item.due_at)!,
        overdue: item.status === "pending" && new Date(item.due_at) <= this.now(),
        decision_reason: item.decision_reason == null ? null : String(item.decision_reason),
        reviewed_at: iso(item.reviewed_at),
        version: Number(item.version),
        created_at: iso(item.created_at)!,
        can_review:
          "actorId" in input &&
          item.status === "pending" &&
          String(item.reviewer_id) === input.actorId,
      })),
    };
  }
  async listCostReviewers(input: { organizationId: string; workspaceId: string; actorId: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT DISTINCT m.user_id id,u.email label FROM memberships m JOIN users u ON u.id=m.user_id " +
        "JOIN membership_data_scopes s ON s.membership_id=m.id JOIN membership_role_assignments " +
        "mra ON mra.membership_id=m.id JOIN role_capabilities rc ON rc.role_code=mra.role_code " +
        "AND rc.capability_code='cost:confirm' WHERE m.organization_id=? AND m.status='active' " +
        "AND u.status='active' AND m.user_id<>? AND (s.scope_type='organization' OR " +
        "(s.scope_type='workspace' AND s.workspace_id=?)) ORDER BY u.email,m.user_id",
      [input.organizationId, input.actorId, input.workspaceId],
    );
    return rows.map((row) => ({ id: String(row.id), label: String(row.label) }));
  }
  async createRule(input: ProfitWriteContext & { id: string; value: any; route: string }) {
    const previous = await this.operation<CostRule>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      await c.query(
        "INSERT INTO cost_rules (id,organization_id,workspace_id,market,platform," +
          "version_code,name,status,fee_lines_json,conversion_rates_json,automatic_scope_json,effective_from,revision,created_by," +
          "created_at,updated_at) VALUES (?,?,?,?,?,?,?,'draft',?,?,?,?,1,?,?,?)",
        [
          input.id,
          input.organizationId,
          input.workspaceId,
          input.value.market,
          input.value.platform,
          input.value.version_code,
          input.value.name,
          JSON.stringify(input.value.fee_lines),
          JSON.stringify(input.value.conversion_rates),
          input.value.automatic_scope ? JSON.stringify(input.value.automatic_scope) : null,
          input.value.effective_from,
          input.actorId,
          now,
          now,
        ],
      );
      const result = (await this.get(c, input.id, input))!;
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
  async createAccountRule(input: Parameters<ProfitRepository["createAccountRule"]>[0]) {
    const c = await this.pool.getConnection(),
      now = this.now();
    const command = { ...input, route: "POST:/api/v1/cost-rules:account" };
    const fingerprint = createHash("sha256").update(JSON.stringify(input.value)).digest("hex");
    try {
      await c.beginTransaction();
      if (!(await this.matchesPrimaryApprovalAccount(c, input.actorId, "exclusive")))
        throw new ProfitServiceError(
          "cost_rule_approval_role_forbidden",
          403,
          "仅主账号可创建费用规则。",
        );
      const previous = await this.operation<{ fingerprint: string; result: CostRule }>(command, c);
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ProfitServiceError(
            "cost_rule_approval_idempotency_conflict",
            409,
            "同一幂等键只能重放原草稿。",
          );
        const existing = await this.get(c, previous.result.id, {
          accountId: input.actorId,
          reason: "exclusive_owner",
        });
        if (!existing) throw new ProfitServiceError("cost_rule_not_found", 404, "刷新费用规则。");
        await c.commit();
        return previous.result;
      }
      const v = input.value;
      await c.query(
        "INSERT INTO cost_rules (id,account_id,market,platform,version_code,name,status,fee_lines_json,conversion_rates_json," +
          "automatic_scope_json,effective_from,revision,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'draft',?,?,?,?,1,?,?,?)",
        [
          input.id,
          input.actorId,
          v.market,
          v.platform,
          v.version_code,
          v.name,
          JSON.stringify(v.fee_lines),
          JSON.stringify(v.conversion_rates),
          v.automatic_scope ? JSON.stringify(v.automatic_scope) : null,
          v.effective_from,
          input.actorId,
          now,
          now,
        ],
      );
      await c.query(
        "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ('cost_rules',?,?,'exclusive_owner')",
        [input.id, input.actorId],
      );
      await this.recordAccountCostRule(
        c,
        input,
        "cost_rule.created",
        input.id,
        "exclusive_owner",
        { market: v.market, platform: v.platform, version_code: v.version_code },
        now,
      );
      const result = await this.get(c, input.id, {
        accountId: input.actorId,
        reason: "exclusive_owner",
      });
      if (!result) throw new Error("cost_rule_create_readback_missing");
      await this.save(c, command, input.id, { fingerprint, result }, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      if (
        (error as { code?: string }).code === "ER_DUP_ENTRY" &&
        (error as Error).message.includes("uq_cost_rule_account_version")
      )
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
  private async recordAccountCostRule(
    c: PoolConnection,
    input: AccountCostDraftContext,
    eventType: string,
    ruleId: string,
    reason: string,
    payload: unknown,
    now: Date,
  ) {
    const id = randomUUID(),
      json = JSON.stringify(payload);
    await c.query(
      "INSERT INTO opportunity_events (id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,'cost_rule',?,'user',?,?,?,?,?)",
      [id, eventType, ruleId, input.actorId, input.requestId, input.traceId, json, now],
    );
    await c.query(
      "INSERT INTO opportunity_outbox (id,event_id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,'cost_rule',?,?,'queued',0,?,?,?,?,?)",
      [id, id, eventType, ruleId, json, now, input.requestId, input.traceId, now, now],
    );
    await c.query(
      "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ?",
      [
        [
          ["opportunity_events", id, input.actorId, reason],
          ["opportunity_outbox", id, input.actorId, reason],
        ],
      ],
    );
  }
  async actRule(command: Parameters<ProfitRepository["actRule"]>[0]) {
    const accountOwned = "accountOwnedApproval" in command;
    const manager = accountOwned && command.accountOwnedApproval === "manager";
    const accountSwitch =
      accountOwned && (command.action === "publish" || command.action === "rollback");
    const accountSubmit = accountOwned && command.action === "submit";
    const accountLifecycle = accountSwitch || accountSubmit;
    if (command.selectionManagerId !== undefined && (!accountSubmit || manager))
      throw new ProfitServiceError(
        "cost_rule_approval_role_forbidden",
        403,
        "仅主账号送审时可以指定选品经理。",
      );
    if (
      accountLifecycle &&
      (manager || command.approvalRole || (command.action !== "rollback" && command.targetRuleId))
    )
      throw new ProfitServiceError(
        "cost_rule_approval_role_forbidden",
        403,
        "仅主账号可切换费用规则。",
      );
    if (!accountOwned) {
      const previous = await this.operation<CostRule>(command);
      if (previous) return this.normalizeReplayedCostRule(previous);
    }
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      if (accountOwned && !accountSwitch)
        await requireAccountReadRehearsal(c, { lockForTransaction: true });
      if (
        accountOwned &&
        !manager &&
        !(await this.matchesPrimaryApprovalAccount(
          c,
          command.actorId,
          accountSwitch ? "exclusive" : true,
        ))
      )
        throw new ProfitServiceError(
          "cost_rule_approval_role_forbidden",
          403,
          "当前账号与已确认的主账号归属不一致。",
        );
      let rows: RowDataPacket[];
      try {
        [rows] = await c.query<RowDataPacket[]>(
          manager
            ? "SELECT r.*, o.reason AS ownership_reason,o.account_id AS ownership_account_id " +
                "FROM cost_rules r JOIN account_owned_records o ON o.source_table='cost_rules' AND o.source_id=r.id " +
                sealedRuleOwner("o") +
                "JOIN account_cost_rule_manager_grants g ON g.cost_rule_id=r.id " +
                "JOIN users manager_user ON manager_user.id=g.manager_id AND manager_user.status='active' " +
                "WHERE r.id=? AND g.manager_id=? FOR UPDATE"
            : accountOwned
              ? "SELECT r.*, o.reason AS ownership_reason FROM cost_rules r JOIN account_owned_records o " +
                "ON o.source_table='cost_rules' AND o.source_id=r.id " +
                sealedRuleOwner("o") +
                "WHERE r.id=? AND o.account_id=? FOR UPDATE"
              : "SELECT * FROM cost_rules WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
          accountOwned
            ? [command.ruleId, command.actorId]
            : [command.ruleId, command.organizationId, command.workspaceId],
        );
      } catch (error) {
        if (manager && (error as { code?: string }).code === "ER_NO_SUCH_TABLE")
          throw new ProfitServiceError(
            "account_cost_rule_manager_grants_not_ready",
            503,
            "先完成隔离库审批权限迁移。",
          );
        throw error;
      }
      const row = rows[0];
      if (!row) throw new ProfitServiceError("cost_rule_not_found", 404, "刷新费用规则。");
      const input = command;
      const ruleOwner = manager ? String(row.ownership_account_id) : input.actorId;
      // 0183 makes the rule's native account authoritative as well as the sealed
      // ledger. Check the locked rule before consulting an approval or a receipt.
      if (
        (accountLifecycle || (accountOwned && this.nativeAccountScope)) &&
        row.account_id !== ruleOwner
      )
        throw new ProfitServiceError("cost_rule_not_found", 404, "刷新费用规则。");
      if (
        "accountOwnedApproval" in input &&
        !accountLifecycle &&
        input.action !== "approve" &&
        input.action !== "reject"
      )
        throw new ProfitServiceError(
          "cost_rule_approval_role_forbidden",
          403,
          "只允许提交审批或驳回。",
        );
      const requireSwitchSignatures = async (targetId: string) => {
        const [signatures] = await c.query<RowDataPacket[]>(
          "SELECT a.approval_role,a.actor_id FROM cost_rule_approvals a " +
            "JOIN account_owned_records ar ON ar.source_table='cost_rule_approvals' AND ar.source_id=a.id " +
            "JOIN account_owned_records rr ON rr.source_table='cost_rules' AND rr.source_id=a.cost_rule_id " +
            "AND rr.account_id=ar.account_id AND rr.reason=ar.reason " +
            "WHERE a.cost_rule_id=? AND ar.account_id=? AND a.decision='approved' LOCK IN SHARE MODE",
          [targetId, ruleOwner],
        );
        if (
          signatures.length !== 2 ||
          new Set(signatures.map((s) => s.actor_id)).size !== 2 ||
          !["selection_manager", "primary_account"].every((role) =>
            signatures.some((s) => s.approval_role === role),
          )
        )
          throw new ProfitServiceError(
            "cost_rule_approval_incomplete",
            409,
            "切换版本前须核对两位独立审批人的有效签署。",
          );
      };
      const approvalFingerprint = (role: string | undefined) =>
        createHash("sha256")
          .update(
            JSON.stringify([
              String(row.id),
              input.action,
              role,
              input.expectedRevision,
              input.reason,
              input.targetRuleId ?? null,
              ...(input.selectionManagerId ? [input.selectionManagerId] : []),
            ]),
          )
          .digest("hex");
      const fingerprint = accountOwned ? approvalFingerprint(input.approvalRole) : null;
      if (accountOwned) {
        const [unowned] = await c.query<RowDataPacket[]>(
          `SELECT a.id FROM cost_rule_approvals a LEFT JOIN account_owned_records ar
           ON ar.source_table='cost_rule_approvals' AND ar.source_id=a.id AND ar.account_id=? AND ar.reason=?
           WHERE a.cost_rule_id=? AND ar.source_id IS NULL
           LIMIT 1 FOR UPDATE`,
          [ruleOwner, row.ownership_reason, input.ruleId],
        );
        if (unowned.length)
          throw new ProfitServiceError(
            "cost_rule_approval_ownership_conflict",
            409,
            "先核对规则的历史审批归属。",
          );
        const previous = await this.operation<{ fingerprint?: string; result?: CostRule }>(
          input,
          c,
        );
        if (previous) {
          // Already-issued replay receipts used the old enum in the digest. Match every
          // original input before translating that cached response; never accept the old role on writes.
          const sameFingerprint =
            previous.fingerprint === fingerprint ||
            (input.approvalRole === "primary_account" &&
              previous.fingerprint === approvalFingerprint("organization_admin"));
          if (
            !sameFingerprint ||
            !previous.result ||
            previous.result.id !==
              (accountSwitch && input.action === "rollback" ? input.targetRuleId : String(row.id))
          )
            throw new ProfitServiceError(
              "cost_rule_approval_idempotency_conflict",
              409,
              "同一幂等键只能重放原审批。",
            );
          if (accountLifecycle) {
            if (input.action === "rollback") {
              const [ownedTarget] = await c.query<RowDataPacket[]>(
                "SELECT r.id FROM cost_rules r JOIN account_owned_records o ON o.source_table='cost_rules' AND o.source_id=r.id AND o.account_id=r.account_id " +
                  "WHERE r.id=? AND r.account_id=? AND r.market=? AND r.platform=? LOCK IN SHARE MODE",
                [input.targetRuleId, ruleOwner, row.market, row.platform],
              );
              if (!ownedTarget[0])
                throw new ProfitServiceError(
                  "cost_rule_rollback_target_invalid",
                  409,
                  "无法核对回滚目标归属。",
                );
            }
            if (accountSwitch) await requireSwitchSignatures(previous.result.id);
            await c.commit();
            return this.normalizeReplayedCostRule(previous.result);
          }
          const [signature] = await c.query<RowDataPacket[]>(
            "SELECT a.id FROM cost_rule_approvals a JOIN account_owned_records signature_owner " +
              "ON signature_owner.source_table='cost_rule_approvals' AND signature_owner.source_id=a.id " +
              "WHERE a.cost_rule_id=? AND a.approval_role=? AND a.actor_id=? AND a.decision=? " +
              "AND BINARY a.reason=BINARY ? AND signature_owner.account_id=? AND signature_owner.reason=? " +
              "LIMIT 1 LOCK IN SHARE MODE",
            [
              input.ruleId,
              input.approvalRole,
              input.actorId,
              input.action === "approve" ? "approved" : "rejected",
              input.reason,
              ruleOwner,
              row.ownership_reason,
            ],
          );
          if (!signature.length)
            throw new ProfitServiceError(
              "cost_rule_approval_idempotency_conflict",
              409,
              "原审批签名无法核对，请刷新费用规则。",
            );
          await c.commit();
          return this.normalizeReplayedCostRule(previous.result);
        }
      }
      if (Number(row.revision) !== input.expectedRevision)
        throw new ProfitServiceError(
          "cost_rule_revision_conflict",
          409,
          "刷新规则并使用最新 revision。",
        );
      if (accountOwned && !accountLifecycle && input.approvalRole) {
        const [sameSigner] = await c.query<RowDataPacket[]>(
          "SELECT id FROM cost_rule_approvals WHERE cost_rule_id=? AND actor_id=? AND approval_role<>? LIMIT 1 FOR UPDATE",
          [input.ruleId, input.actorId, input.approvalRole],
        );
        if (sameSigner.length)
          throw new ProfitServiceError(
            "cost_rule_distinct_approver_required",
            409,
            "同一账号不能占用同一费用规则的两个审批位。",
          );
      }
      let resultId = input.ruleId;
      let resultOwnerReason = String(row.ownership_reason);
      let approvalId: string | undefined;
      const mapApproval = async () => {
        if (accountOwned && approvalId)
          await c.query(
            "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ('cost_rule_approvals',?,?,?)",
            [approvalId, ruleOwner, row.ownership_reason],
          );
      };
      if (accountSwitch) {
        if (
          input.action === "publish"
            ? row.status !== "approved"
            : row.status !== "active" || !input.targetRuleId
        )
          throw new ProfitServiceError(
            "cost_rule_transition_invalid",
            409,
            "当前费用规则状态不允许切换。",
          );
        if (input.action === "rollback") {
          const [target] = await c.query<RowDataPacket[]>(
            "SELECT r.id,o.reason FROM cost_rules r JOIN account_owned_records o ON o.source_table='cost_rules' AND o.source_id=r.id AND o.account_id=r.account_id " +
              "WHERE r.id=? AND r.account_id=? AND r.market=? AND r.platform=? AND r.status IN ('approved','retired') FOR UPDATE",
            [input.targetRuleId, ruleOwner, row.market, row.platform],
          );
          if (!target[0])
            throw new ProfitServiceError(
              "cost_rule_rollback_target_invalid",
              409,
              "目标必须是本账号同市场同平台已批准或停用的版本。",
            );
          resultId = String(target[0].id);
          resultOwnerReason = String(target[0].reason);
        }
        await requireSwitchSignatures(resultId);
        if (input.action === "rollback") {
          await c.query(
            "UPDATE cost_rules SET status='rolled_back',rollback_target_id=?,rolled_back_at=?,revision=revision+1,updated_at=? WHERE id=? AND account_id=?",
            [resultId, now, now, input.ruleId, ruleOwner],
          );
        } else {
          await c.query(
            "UPDATE cost_rules SET status='retired',revision=revision+1,updated_at=? WHERE account_id=? AND market=? AND platform=? AND status='active'",
            [now, ruleOwner, row.market, row.platform],
          );
        }
        await c.query(
          "UPDATE cost_rules SET status='active',published_by=?,published_at=?,revision=revision+1,updated_at=? WHERE id=? AND account_id=?",
          [input.actorId, now, now, resultId, ruleOwner],
        );
        await this.queueAccountProfit(c, input, resultId, row.market, row.platform, now);
      } else if (input.action === "submit") {
        if (row.status !== "draft")
          throw new ProfitServiceError("cost_rule_transition_invalid", 409, "只有草稿可以提交。");
        if (accountSubmit) {
          if (input.selectionManagerId) {
            const [existing] = await c.query<RowDataPacket[]>(
              "SELECT manager_id FROM account_cost_rule_manager_grants WHERE cost_rule_id=? LIMIT 1 FOR UPDATE",
              [input.ruleId],
            );
            if (
              existing.length ||
              row.ownership_reason !== "exclusive_owner" ||
              row.historical_context != null
            )
              throw new ProfitServiceError(
                "cost_rule_manager_already_configured",
                409,
                "已有授权或属于迁入的规则，请保留原具名授权并直接送审。",
              );
            const [candidate] = await c.query<RowDataPacket[]>(
              "SELECT id FROM users WHERE id=? AND id<>? AND status='active' FOR UPDATE",
              [input.selectionManagerId, ruleOwner],
            );
            if (!candidate.length)
              throw new ProfitServiceError(
                "cost_rule_manager_invalid",
                409,
                "请输入另一位有效账号的 ID。",
              );
            await c.query(
              "INSERT INTO account_cost_rule_manager_grants (cost_rule_id,manager_id,can_read) VALUES (?,?,1)",
              [input.ruleId, input.selectionManagerId],
            );
          }
          const [eligible] = await c.query<RowDataPacket[]>(
            "SELECT g.manager_id FROM account_cost_rule_manager_grants g JOIN users u ON u.id=g.manager_id " +
              "WHERE g.cost_rule_id=? AND g.can_read=1 AND g.manager_id<>? AND u.status='active' LIMIT 1 FOR UPDATE",
            [input.ruleId, ruleOwner],
          );
          if (!eligible[0])
            throw new ProfitServiceError(
              "cost_rule_manager_required",
              409,
              "规则必须先有独立的具名选品经理授权，才能提交审批。",
            );
        }
        await c.query(
          "UPDATE cost_rules SET status='pending_approval',submitted_by=?,submitted_at=?," +
            "revision=revision+1,updated_at=? WHERE id=?",
          [input.actorId, now, now, input.ruleId],
        );
      } else if (input.action === "approve") {
        if (row.status !== "pending_approval" || !input.approvalRole)
          throw new ProfitServiceError("cost_rule_transition_invalid", 409, "当前规则不能审批。");
        await c.query(
          "INSERT INTO cost_rule_approvals (id,cost_rule_id," +
            "approval_role,decision,reason,actor_id,request_id,trace_id,created_at) VALUES (?,?,?,'approved',?,?,?,?,?)",
          [
            (approvalId = randomUUID()),
            input.ruleId,
            input.approvalRole,
            input.reason,
            input.actorId,
            input.requestId,
            input.traceId,
            now,
          ],
        );
        await mapApproval();
        const [count] = await c.query<RowDataPacket[]>(
          accountOwned
            ? `SELECT LEAST(COUNT(DISTINCT a.approval_role),COUNT(DISTINCT a.actor_id)) count FROM cost_rule_approvals a
               WHERE a.cost_rule_id=? AND a.decision='approved'
               AND EXISTS (SELECT 1 FROM account_owned_records ar WHERE ar.source_table='cost_rule_approvals'
                 AND ar.source_id=a.id AND ar.account_id=? AND ar.reason=?)`
            : "SELECT COUNT(DISTINCT approval_role) count FROM cost_rule_approvals WHERE cost_rule_id=? AND decision='approved'",
          accountOwned ? [input.ruleId, ruleOwner, row.ownership_reason] : [input.ruleId],
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
          "INSERT INTO cost_rule_approvals (id,cost_rule_id," +
            "approval_role,decision,reason,actor_id,request_id,trace_id,created_at) VALUES (?,?,?,'rejected',?,?,?,?,?)",
          [
            (approvalId = randomUUID()),
            input.ruleId,
            input.approvalRole,
            input.reason,
            input.actorId,
            input.requestId,
            input.traceId,
            now,
          ],
        );
        await mapApproval();
        await c.query(
          "UPDATE cost_rules SET status='rejected',revision=revision+1,updated_at=? WHERE id=?",
          [now, input.ruleId],
        );
      } else if (input.action === "publish") {
        if ("accountOwnedApproval" in input) throw new Error("unexpected_account_publish");
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
        if ("accountOwnedApproval" in input) throw new Error("unexpected_account_rollback");
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
      const result = (await this.get(
        c,
        resultId,
        "accountOwnedApproval" in input
          ? { accountId: ruleOwner, reason: resultOwnerReason }
          : input,
      ))!;
      const eventType = `cost_rule.${input.action}`;
      const payload = {
        reason: input.reason,
        approval_role: input.approvalRole ?? null,
        target_rule_id: input.targetRuleId ?? null,
        ...(input.selectionManagerId ? { selection_manager_id: input.selectionManagerId } : {}),
        resulting_status: result.status,
      };
      if (accountLifecycle) {
        await this.recordAccountCostRule(
          c,
          input,
          eventType,
          input.ruleId,
          String(row.ownership_reason),
          payload,
          now,
        );
      } else if ("accountOwnedApproval" in input) {
        if (!approvalId) throw new Error("missing_account_cost_approval");
        const eventId = randomUUID();
        await c.query(
          "INSERT INTO account_cost_approval_events (id,account_id,cost_rule_id,approval_id,event_type," +
            "ownership_reason,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [
            eventId,
            ruleOwner,
            input.ruleId,
            approvalId,
            eventType,
            row.ownership_reason,
            input.requestId,
            input.traceId,
            JSON.stringify(payload),
            now,
          ],
        );
        await c.query(
          "INSERT INTO account_cost_approval_outbox (id,status,attempt_count,available_at,created_at,updated_at) " +
            "VALUES (?,'queued',0,?,?,?)",
          [eventId, now, now, now],
        );
      } else await this.record(c, input, eventType, input.ruleId, payload, now);
      await this.save(c, input, input.ruleId, accountOwned ? { fingerprint, result } : result, now);
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
      now = this.now();
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
      const [reviewers] = await c.query<RowDataPacket[]>(
        "SELECT DISTINCT m.user_id FROM memberships m JOIN users u ON u.id=m.user_id JOIN " +
          "membership_data_scopes s ON s.membership_id=m.id JOIN membership_role_assignments mra " +
          "ON mra.membership_id=m.id JOIN role_capabilities rc ON rc.role_code=mra.role_code AND " +
          "rc.capability_code='cost:confirm' WHERE m.organization_id=? AND m.user_id=? AND " +
          "m.status='active' AND u.status='active' AND (s.scope_type='organization' OR " +
          "(s.scope_type='workspace' AND s.workspace_id=?)) LIMIT 1 FOR UPDATE",
        [input.organizationId, input.value.reviewer_id, input.workspaceId],
      );
      if (!reviewers[0] || input.value.reviewer_id === input.actorId)
        throw new ProfitServiceError(
          "cost_input_reviewer_ineligible",
          409,
          "选择另一名仍可访问当前工作区且具备成本确认权限的成员。",
        );
      const [versions] = await c.query<RowDataPacket[]>(
          "SELECT COALESCE(MAX(input_version),0)+1 next_version FROM opportunity_cost_inputs WHERE " +
            "opportunity_id=? AND platform=? AND input_type=?",
          [input.opportunityId, input.value.platform, input.value.input_type],
        ),
        inputVersion = Number(versions[0]?.next_version ?? 1);
      await c.query(
        "INSERT INTO opportunity_cost_inputs (id,opportunity_id," +
          "platform,input_type,amount_value,currency,source_type,source_ref_id,evidence_id," +
          "observed_at,input_version,is_current,submitted_by,confirmed_by,request_id,trace_id,created_at) VALUES " +
          "(?,?,?,?,?,?,?,?,?,?,?,0,?,NULL,?,?,?)",
        [
          input.id,
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
      const reviewId = randomUUID(),
        dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000),
        reminderAt = new Date(dueAt.getTime() - 4 * 60 * 60 * 1000);
      await c.query(
        "INSERT INTO opportunity_cost_input_reviews (id,opportunity_id," +
          "cost_input_id,submitter_id,reviewer_id,status,due_at,decision_reason,reviewed_at," +
          "request_id,trace_id,version,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?," +
          "NULL,NULL,?,?,1,?,?)",
        [
          reviewId,
          input.opportunityId,
          input.id,
          input.actorId,
          input.value.reviewer_id,
          dueAt,
          input.requestId,
          input.traceId,
          now,
          now,
        ],
      );
      for (const scheduled of [
        { eventType: "approval.cost_input.review_due_soon", availableAt: reminderAt },
        { eventType: "approval.cost_input.overdue", availableAt: dueAt },
      ])
        await c.query(
          "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version," +
            "payload_json,status,attempt_count,available_at,leased_at,lease_expires_at,published_at," +
            "request_id,trace_id,created_at,updated_at,version) VALUES (?,?,?,?,1,?,'pending',0,?," +
            "NULL,NULL,NULL,?,?,?,?,1)",
          [
            randomUUID(),
            input.organizationId,
            input.workspaceId,
            scheduled.eventType,
            JSON.stringify({
              review_id: reviewId,
              recipient_id: input.value.reviewer_id,
              resource_type: "opportunity",
              resource_id: input.opportunityId,
              opportunity_id: input.opportunityId,
            }),
            scheduled.availableAt,
            input.requestId.slice(0, 64),
            input.traceId.slice(0, 64),
            now,
            now,
          ],
        );
      const version = Number(op.version) + 1;
      await c.query("UPDATE opportunities SET version=?,updated_at=? WHERE id=?", [
        version,
        now,
        input.opportunityId,
      ]);
      const result = {
        input_id: input.id,
        review_id: reviewId,
        opportunity_id: input.opportunityId,
        version,
        review_status: "pending" as const,
        due_at: dueAt.toISOString(),
      };
      await this.record(
        c,
        input,
        "opportunity.cost_input.review_requested",
        input.opportunityId,
        {
          input_type: input.value.input_type,
          input_version: inputVersion,
          currency: input.value.currency,
          reviewer_id: input.value.reviewer_id,
          review_id: reviewId,
          due_at: dueAt.toISOString(),
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
  async reviewCost(input: Parameters<ProfitRepository["reviewCost"]>[0]) {
    const previous =
      await this.operation<Awaited<ReturnType<ProfitRepository["reviewCost"]>>>(input);
    if (previous) return previous;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT r.*,i.platform,i.input_type,i.input_version,o.market,o.version opportunity_version " +
            "FROM opportunity_cost_input_reviews r JOIN opportunity_cost_inputs i ON " +
            "i.id=r.cost_input_id AND i.opportunity_id=r.opportunity_id JOIN opportunities o " +
            "ON o.id=r.opportunity_id WHERE r.id=? AND r.opportunity_id=? " +
            "AND o.organization_id=? AND o.workspace_id=? FOR UPDATE",
          [input.reviewId, input.opportunityId, input.organizationId, input.workspaceId],
        ),
        review = rows[0];
      if (!review)
        throw new ProfitServiceError("cost_input_review_not_found", 404, "刷新成本复核队列。");
      if (String(review.reviewer_id) !== input.actorId)
        throw new ProfitServiceError(
          "cost_input_review_assignee_forbidden",
          403,
          "由该复核单指定的另一名成本确认人处理。",
        );
      if (String(review.submitter_id) === input.actorId)
        throw new ProfitServiceError(
          "cost_input_self_review_forbidden",
          403,
          "提交人与复核人必须是两个不同的活动用户。",
        );
      if (review.status !== "pending" || Number(review.version) !== input.expectedVersion)
        throw new ProfitServiceError(
          "cost_input_review_conflict",
          409,
          "该成本复核已处理或版本已变化，请刷新后重试。",
        );
      let jobStatus = "not_queued";
      if (input.decision === "approved") {
        await c.query(
          "UPDATE opportunity_cost_inputs SET is_current=0 WHERE opportunity_id=? AND platform=? " +
            "AND input_type=? AND is_current=1",
          [input.opportunityId, review.platform, review.input_type],
        );
        await c.query(
          "UPDATE opportunity_cost_inputs SET is_current=1,confirmed_by=? WHERE id=? AND opportunity_id=?",
          [input.actorId, review.cost_input_id, input.opportunityId],
        );
        const [rules] = await c.query<RowDataPacket[]>(
          "SELECT id FROM cost_rules WHERE organization_id=? AND workspace_id=? AND market=? AND " +
            "platform=? AND status='active' AND effective_from<=? ORDER BY effective_from DESC LIMIT 1",
          [input.organizationId, input.workspaceId, review.market, review.platform, now],
        );
        jobStatus = "waiting_for_active_rule";
        if (rules[0]) {
          await this.queueOne(c, input, input.opportunityId, String(rules[0].id), now);
          jobStatus = "queued";
        }
      }
      await c.query(
        "UPDATE opportunity_cost_input_reviews SET status=?,decision_reason=?,reviewed_at=?," +
          "version=version+1,updated_at=? WHERE id=?",
        [input.decision, input.reason, now, now, input.reviewId],
      );
      const version = Number(review.opportunity_version) + 1;
      await c.query(
        "UPDATE opportunities SET version=?,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
        [version, now, input.opportunityId, input.organizationId, input.workspaceId],
      );
      const result = {
        review_id: input.reviewId,
        input_id: String(review.cost_input_id),
        opportunity_id: input.opportunityId,
        review_status: input.decision,
        version,
        job_status: jobStatus,
      };
      await this.record(
        c,
        input,
        `opportunity.cost_input.${input.decision}`,
        input.opportunityId,
        {
          review_id: input.reviewId,
          input_id: String(review.cost_input_id),
          input_type: review.input_type,
          input_version: Number(review.input_version),
          job_status: jobStatus,
          reason: input.reason,
        },
        now,
      );
      await this.save(c, input, input.reviewId, result, now);
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
  private normalizeReplayedCostRule(rule: CostRule): CostRule {
    const approvals: readonly string[] = rule.approvals;
    return approvals.includes("organization_admin")
      ? {
          ...rule,
          approvals: approvals.map((role) =>
            role === "organization_admin" ? "primary_account" : (role as ApprovalRole),
          ),
        }
      : rule;
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
      conversion_rates: row.conversion_rates_json ? parse(row.conversion_rates_json) : [],
      automatic_scope: row.automatic_scope_json ? parse(row.automatic_scope_json) : null,
      effective_from: databaseDay(row.effective_from),
      revision: Number(row.revision),
      approvals: row.approvals ? (String(row.approvals).split(",") as ApprovalRole[]) : [],
      ...(row.owned_by_session === undefined
        ? {}
        : { owned_by_session: Number(row.owned_by_session) === 1 }),
      ...(row.can_decide_as_manager === undefined
        ? {}
        : { can_decide_as_manager: Number(row.can_decide_as_manager) === 1 }),
      published_at: iso(row.published_at),
      updated_at: iso(row.updated_at)!,
    };
  }
  private async get(
    c: PoolConnection,
    id: string,
    scope:
      | Pick<ProfitWriteContext, "organizationId" | "workspaceId">
      | { accountId: string; reason: string },
  ) {
    const accountOwned = "accountId" in scope;
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT r.*,GROUP_CONCAT(CASE WHEN a.decision='approved' THEN a.approval_role END) approvals " +
        "FROM cost_rules r LEFT JOIN cost_rule_approvals a ON a.cost_rule_id=r.id " +
        (accountOwned
          ? "AND EXISTS (SELECT 1 FROM account_owned_records ra WHERE ra.source_table='cost_rule_approvals' " +
            "AND ra.source_id=a.id AND ra.account_id=? AND ra.reason=?) "
          : "") +
        "WHERE r.id=? AND " +
        (accountOwned
          ? rehearsalOwns("cost_rules", "r.id", "?")
          : "r.organization_id=? AND r.workspace_id=?") +
        " GROUP BY r.id",
      accountOwned
        ? [scope.accountId, scope.reason, id, scope.accountId]
        : [id, scope.organizationId, scope.workspaceId],
    );
    return rows[0] ? this.dto(rows[0]) : null;
  }
  private async queueOne(
    c: PoolConnection,
    input: {
      requestId: string;
      traceId: string;
    },
    opportunityId: string,
    ruleId: string,
    now: Date,
  ) {
    const id = randomUUID();
    await c.query(
      "INSERT INTO opportunity_profit_jobs (id,opportunity_id," +
        "cost_rule_id,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at) VALUES (?,?,?,'queued',0,?,?,?,?,?)",
      [id, opportunityId, ruleId, now, input.requestId, input.traceId, now, now],
    );
    return id;
  }
  private async queueAccountProfit(
    c: PoolConnection,
    input: Pick<ProfitWriteContext, "actorId" | "requestId" | "traceId">,
    ruleId: string,
    market: string,
    platform: string,
    now: Date,
  ) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT o.id,ow.reason FROM opportunities o JOIN account_owned_records ow " +
        "ON ow.source_table='opportunities' AND ow.source_id=o.id AND ow.account_id=? " +
        "WHERE o.market=? AND o.lifecycle_status NOT IN ('archived','deleted') " +
        "AND EXISTS (SELECT 1 FROM opportunity_cost_inputs i WHERE i.opportunity_id=o.id AND i.platform=? AND i.is_current=1 AND " +
        rehearsalOwns("opportunity_cost_inputs", "i.id", "ow.account_id") +
        ") ORDER BY o.id",
      [input.actorId, market, platform],
    );
    for (const row of rows) {
      const jobId = await this.queueOne(c, input, String(row.id), ruleId, now);
      await c.query(
        "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ('opportunity_profit_jobs',?,?,?)",
        [jobId, input.actorId, row.reason],
      );
    }
    if (platform === "amazon")
      await c.query(
        "INSERT INTO automatic_selection_evaluations (opportunity_id,status,attempt_count,available_at,created_at,updated_at) " +
          "SELECT o.id,'queued',0,?,?,? FROM opportunities o WHERE " +
          rehearsalOwns("opportunities", "o.id", "?") +
          " AND o.market=? AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted') AND " +
          selectionCandidateSql +
          " " +
          automaticEvaluationEnqueueUpdateSql,
        [now, now, now, input.actorId, market],
      );
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
    await c.query(
      "INSERT INTO automatic_selection_evaluations " +
        "(opportunity_id,status,attempt_count,available_at,created_at,updated_at) " +
        "SELECT o.id,'queued',0,?,?,? FROM opportunities o WHERE " +
        "o.organization_id=? AND o.workspace_id=? AND o.market=? AND o.decision_status='pending' " +
        `AND ${selectionCandidateSql} ` +
        automaticEvaluationEnqueueUpdateSql,
      [now, now, now, input.organizationId, input.workspaceId, market],
    );
  }
  private async operation<T>(
    input: Pick<ProfitWriteContext, "actorId" | "idempotencyKey"> & { route: string },
    db: Pick<Pool, "query"> = this.pool,
  ) {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT result_json FROM cost_operations WHERE actor_id=? AND route=? AND idempotency_key=?" +
        (db === this.pool ? "" : " FOR UPDATE"),
      [input.actorId, input.route, input.idempotencyKey],
    );
    return rows[0] ? parse<T>(rows[0].result_json) : null;
  }
  private async save(
    c: PoolConnection,
    input: Pick<ProfitWriteContext, "actorId" | "idempotencyKey"> & { route: string },
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
    await appendOpportunityEvent(c, {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType,
      resourceType: type,
      resourceId,
      actorType: "user",
      actorId: input.actorId,
      requestId: input.requestId,
      traceId: input.traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
    await appendOpportunityOutbox(c, {
      id,
      eventId: id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType,
      resourceType: type,
      resourceId,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
      requestId: input.requestId,
      traceId: input.traceId,
    });
    return id;
  }
}
