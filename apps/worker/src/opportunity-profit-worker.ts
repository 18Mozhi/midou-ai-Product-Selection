import { appendOpportunityEvent } from "@scoutops/database";
import { appendOpportunityOutbox } from "@scoutops/database";
import { queueOwnedSelectionEvaluation } from "./account-evaluation-enqueue.js";
import { hasLegacyScoreRuleScope } from "./score-rule-scope.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { queueAutomaticSelectionEvaluation } from "./automatic-selection-evaluation-worker.js";
import {
  calculationOwnersMatch,
  readCalculationOpportunityForClaim,
  registerCalculationOwners,
  resolveCalculationOwnership,
  type CalculationOwnership,
  type CalculationOwnerRef,
} from "./opportunity-calculation-ownership.js";

export async function findProfitExchangeQuote(
  connection: Pick<PoolConnection, "query">,
  scope: { organizationId: string; workspaceId: string },
  source: string,
  target: string,
  today: string,
  ownershipReady: boolean,
  accountId?: string,
) {
  if (accountId === undefined && ownershipReady) {
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM exchange_rate_quotes WHERE Field IN ('organization_id','workspace_id')",
    );
    if (columns.length === 0) return undefined; // No legacy quote namespace after 0155.
    if (columns.length !== 2)
      throw new Error("partial_inherited_scope_schema:exchange_rate_quotes");
  }
  const [quotes] = await connection.query<RowDataPacket[]>(
    "SELECT q.* FROM exchange_rate_quotes q JOIN providers p ON p.id=q.provider_id AND p.status='enabled' WHERE " +
      (accountId === undefined ? "q.organization_id=? AND q.workspace_id=? AND " : "") +
      "q.base_currency=? AND q.quote_currency=? AND q.quote_date<=?" +
      (accountId !== undefined || ownershipReady
        ? " AND " +
          (accountId !== undefined ? "" : "NOT ") +
          "EXISTS (SELECT 1 FROM account_owned_records ao WHERE ao.source_table='exchange_rate_quotes' AND ao.source_id=q.id" +
          (accountId !== undefined
            ? " AND ao.account_id=? AND EXISTS (SELECT 1 FROM raw_evidence e JOIN account_owned_records eo" +
              " ON eo.source_table='raw_evidence' AND eo.source_id=e.id" +
              " WHERE eo.account_id=ao.account_id AND e.id=q.evidence_id AND e.provider_id=q.provider_id)"
            : "") +
          ")"
        : "") +
      " ORDER BY q.quote_date DESC,q.observed_at DESC LIMIT 1",
    [
      ...(accountId === undefined ? [scope.organizationId, scope.workspaceId] : []),
      source,
      target,
      today,
      ...(accountId !== undefined ? [accountId] : []),
    ],
  );
  return quotes[0];
}

type Job = {
  id: string;
  organizationId: string;
  workspaceId: string;
  opportunityId: string;
  ruleId: string;
  requestId: string;
  traceId: string;
  attemptCount: number;
};
type FeeLine = {
  type: "platform_fee" | "payment_fee" | "tax" | "fulfillment" | "logistics";
  mode: "percentage_of_sale" | "fixed_amount";
  value: number;
  currency: string | null;
};
type ConversionRate = {
  base_currency: string;
  quote_currency: string;
  rate_value: number;
  effective_on: string;
  source_url: string;
};
type Component = {
  type: string;
  sourceAmount: number | null;
  sourceCurrency: string | null;
  amount: number | null;
  targetCurrency: string | null;
  sourceRef: string | null;
  evidenceId: string | null;
  quoteId: string | null;
  missing: string | null;
  conversionRef?: string | null;
};
export type ProfitWorkerResult =
  | { status: "idle" }
  | {
      status:
        "succeeded" | "completed_with_warnings" | "failed_terminal" | "scheduled" | "dead_letter";
      job_id: string;
      opportunity_id?: string;
      profit_status?: "calculated" | "insufficient_data";
      error_code?: string;
    };

export class OpportunityProfitError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "OpportunityProfitError";
  }
}
const parse = <T>(value: unknown): T =>
  typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
const round = (value: number) => Math.round(value * 1e6) / 1e6;
const nullableString = (value: unknown) => (value == null ? null : String(value));

export class MySqlOpportunityProfitWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async processOnce(): Promise<ProfitWorkerResult> {
    const job = await this.claim();
    if (!job) return { status: "idle" };
    try {
      const { status } = await this.calculate(job);
      return {
        status: status === "calculated" ? "succeeded" : "completed_with_warnings",
        job_id: job.id,
        opportunity_id: job.opportunityId,
        profit_status: status,
      };
    } catch (error) {
      const wrapped =
        error instanceof OpportunityProfitError
          ? error
          : new OpportunityProfitError(
              `profit_${String((error as { code?: string }).code ?? "dependency_failed").toLowerCase()}`,
              true,
            );
      const status = !wrapped.retryable
        ? "failed_terminal"
        : job.attemptCount >= 4
          ? "dead_letter"
          : "scheduled";
      await this.finish(job, status, wrapped.code);
      return {
        status,
        job_id: job.id,
        opportunity_id: job.opportunityId,
        error_code: wrapped.code,
      };
    }
  }

  private async claim(): Promise<Job | null> {
    const connection = await this.pool.getConnection(),
      now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM opportunity_profit_jobs WHERE (status IN ('queued','retry_scheduled') AND available_at<=?) OR (status='leased' AND lease_expires_at<=?) ORDER BY available_at,id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      const row = rows[0];
      if (!row) {
        await connection.commit();
        return null;
      }
      const { organizationId, workspaceId } = await readCalculationOpportunityForClaim(
        connection,
        String(row.opportunity_id),
        "calculation_job_opportunity_missing",
      );
      await connection.query(
        "UPDATE opportunity_profit_jobs SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?",
        [this.workerId, expires, now, row.id],
      );
      await connection.commit();
      return {
        id: String(row.id),
        organizationId,
        workspaceId,
        opportunityId: String(row.opportunity_id),
        ruleId: String(row.cost_rule_id),
        requestId: String(row.request_id),
        traceId: String(row.trace_id),
        attemptCount: Number(row.attempt_count) + 1,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async calculate(job: Job): Promise<{ status: "calculated" | "insufficient_data" }> {
    const connection = await this.pool.getConnection(),
      now = this.now(),
      today = now.toISOString().slice(0, 10);
    try {
      await connection.beginTransaction();
      const ownership = await resolveCalculationOwnership(connection, job.opportunityId);
      const owner = ownership?.owner;
      const originalScope = [job.organizationId, job.workspaceId];
      const legacyRule = await hasLegacyScoreRuleScope(connection, "cost_rules");
      if (!owner && !legacyRule) throw new OpportunityProfitError("cost_rule_unavailable", false);
      const ruleScope = owner
        ? legacyRule
          ? ""
          : "AND account_id=? "
        : "AND organization_id=? AND workspace_id=? ";
      const ruleArgs = owner ? (legacyRule ? [] : [owner.account_id]) : originalScope;
      const nativeOpportunity = !!owner && (await nativeOpportunityStorage(connection));
      const [rules] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM cost_rules WHERE id=? " +
          ruleScope +
          "AND status IN ('active','retired','rolled_back') FOR UPDATE",
        [job.ruleId, ...ruleArgs],
      );
      const rule = rules[0];
      if (!rule) throw new OpportunityProfitError("cost_rule_unavailable", false);
      const [opportunities] = await connection.query<RowDataPacket[]>(
        "SELECT market FROM opportunities WHERE id=?" +
          (nativeOpportunity
            ? " AND account_id=?"
            : owner
              ? ""
              : " AND organization_id=? AND workspace_id=?") +
          " FOR UPDATE",
        [
          job.opportunityId,
          ...(nativeOpportunity ? [owner.account_id] : owner ? [] : originalScope),
        ],
      );
      if (!opportunities[0] || opportunities[0].market !== rule.market)
        throw new OpportunityProfitError("profit_scope_or_market_mismatch", false);
      if (ownership) {
        const [lease] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM opportunity_profit_jobs WHERE id=? AND opportunity_id=? AND cost_rule_id=? " +
            "AND status='leased' AND lease_owner=? AND attempt_count=? AND lease_expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
          [job.id, job.opportunityId, job.ruleId, this.workerId, job.attemptCount],
        );
        if (!lease[0]) throw new OpportunityProfitError("opportunity_profit_lease_lost", true);
        if (
          !(await calculationOwnersMatch(
            connection,
            ownership,
            [["opportunity_profit_jobs", job.id]],
            true,
          )) ||
          !(await calculationOwnersMatch(connection, ownership, [["cost_rules", job.ruleId]]))
        )
          throw new OpportunityProfitError("opportunity_profit_owner_mismatch", false);
      }
      const [inputs] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM opportunity_cost_inputs WHERE opportunity_id=? AND platform=? AND is_current=1",
        [job.opportunityId, rule.platform],
      );
      if (
        !(await calculationOwnersMatch(
          connection,
          ownership,
          inputs.flatMap((row) => [
            ["opportunity_cost_inputs", String(row.id)] as const,
            ...(row.evidence_id ? [["raw_evidence", String(row.evidence_id)] as const] : []),
          ]),
          true,
        ))
      )
        throw new OpportunityProfitError("opportunity_profit_input_owner_mismatch", false);
      const byType = new Map(inputs.map((row) => [String(row.input_type), row]));
      const sale = byType.get("sale_price"),
        target = sale ? String(sale.currency) : null,
        conversionRates = parse<ConversionRate[]>(rule.conversion_rates_json ?? "[]"),
        components: Component[] = [];
      const convert = async (type: string, row: RowDataPacket | undefined) => {
        if (!row || !target) {
          components.push({
            type,
            sourceAmount: row ? Number(row.amount_value) : null,
            sourceCurrency: row ? String(row.currency) : null,
            amount: null,
            targetCurrency: target,
            sourceRef: row ? String(row.source_ref_id) : null,
            evidenceId: row ? nullableString(row.evidence_id) : null,
            quoteId: null,
            missing: !row ? `${type}.input` : "sale_price.input",
          });
          return null;
        }
        const value = Number(row.amount_value),
          source = String(row.currency);
        if (source === target) {
          components.push({
            type,
            sourceAmount: value,
            sourceCurrency: source,
            amount: value,
            targetCurrency: target,
            sourceRef: String(row.source_ref_id),
            evidenceId: nullableString(row.evidence_id),
            quoteId: null,
            missing: null,
          });
          return value;
        }
        const quote = await findProfitExchangeQuote(
          connection,
          job,
          source,
          target,
          today,
          Boolean(ownership),
          owner?.account_id,
        );
        const policyRate = conversionRates
          .filter(
            (item) =>
              item.base_currency === source &&
              item.quote_currency === target &&
              item.effective_on <= today,
          )
          .sort((left, right) => right.effective_on.localeCompare(left.effective_on))[0];
        if (!quote && !policyRate) {
          components.push({
            type,
            sourceAmount: value,
            sourceCurrency: source,
            amount: null,
            targetCurrency: target,
            sourceRef: String(row.source_ref_id),
            evidenceId: nullableString(row.evidence_id),
            quoteId: null,
            missing: `exchange_rate.${source}_${target}`,
          });
          return null;
        }
        const converted = round(value * Number(quote?.rate_value ?? policyRate!.rate_value)),
          conversionRef = quote
            ? null
            : `cost_rule:${String(rule.version_code)}:fx:${source}_${target}:${policyRate!.effective_on}`;
        components.push({
          type,
          sourceAmount: value,
          sourceCurrency: source,
          amount: converted,
          targetCurrency: target,
          sourceRef: String(row.source_ref_id),
          evidenceId: nullableString(row.evidence_id),
          quoteId: quote ? String(quote.id) : null,
          missing: null,
          conversionRef,
        });
        return converted;
      };
      const fees = parse<FeeLine[]>(rule.fee_lines_json),
        saleValue = await convert("sale_price", sale),
        purchase = await convert("purchase_price", byType.get("purchase_price")),
        logistics = fees.some((fee) => fee.type === "logistics")
          ? null
          : await convert("logistics", byType.get("logistics"));
      void purchase;
      void logistics;
      for (const fee of fees) {
        if (fee.mode === "percentage_of_sale") {
          const value = saleValue == null ? null : round((saleValue * fee.value) / 100);
          components.push({
            type: fee.type,
            sourceAmount: fee.value,
            sourceCurrency: "PCT",
            amount: value,
            targetCurrency: target,
            sourceRef: `cost_rule:${rule.version_code}`,
            evidenceId: null,
            quoteId: null,
            missing: value == null ? "sale_price.input" : null,
          });
        } else {
          const pseudo = {
            amount_value: fee.value,
            currency: fee.currency,
            source_ref_id: `cost_rule:${rule.version_code}`,
            evidence_id: null,
          } as unknown as RowDataPacket;
          await convert(fee.type, pseudo);
        }
      }
      const missing = [
        ...new Set(components.filter((item) => item.missing).map((item) => item.missing!)),
      ];
      const status: "calculated" | "insufficient_data" = missing.length
        ? "insufficient_data"
        : "calculated";
      const costs = components
        .filter((item) => item.type !== "sale_price")
        .reduce((sum, item) => sum + (item.amount ?? 0), 0);
      const net = status === "calculated" ? round(saleValue! - costs) : null,
        margin = status === "calculated" ? round((net! / saleValue!) * 100) : null,
        runId = randomUUID();
      await connection.query(
        "INSERT INTO opportunity_profit_runs (id,opportunity_id,cost_rule_id,rule_version_code,platform,market,status,currency,sale_price,total_cost,net_profit,net_margin_percent,missing_fields_json,input_snapshot_json,exchange_snapshot_json,request_id,trace_id,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          runId,
          job.opportunityId,
          job.ruleId,
          rule.version_code,
          rule.platform,
          rule.market,
          status,
          target,
          saleValue,
          status === "calculated" ? round(costs) : null,
          net,
          margin,
          JSON.stringify(missing),
          JSON.stringify(
            inputs.map((row) => ({
              id: String(row.id),
              type: String(row.input_type),
              version: Number(row.input_version),
            })),
          ),
          JSON.stringify(
            components
              .flatMap((item) => [item.quoteId, item.conversionRef])
              .filter((item): item is string => Boolean(item)),
          ),
          job.requestId,
          job.traceId,
          now,
        ],
      );
      const owned: CalculationOwnerRef[] = [["opportunity_profit_runs", runId]];
      for (const item of components) {
        const id = randomUUID();
        await connection.query(
          "INSERT INTO opportunity_profit_components (id,profit_run_id,component_type,source_amount,source_currency,converted_amount,target_currency,source_ref_id,evidence_id,exchange_quote_id,missing_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          [
            id,
            runId,
            item.type,
            item.sourceAmount,
            item.sourceCurrency,
            item.amount,
            item.targetCurrency,
            item.sourceRef,
            item.evidenceId,
            item.quoteId,
            item.missing,
          ],
        );
        owned.push(["opportunity_profit_components", id]);
      }
      await registerCalculationOwners(connection, ownership, owned);
      await connection.query(
        "UPDATE opportunities SET profit_status=?,version=version+1,updated_at=? WHERE id=?" +
          (owner ? "" : " AND organization_id=? AND workspace_id=?"),
        [status, now, job.opportunityId, ...(owner ? [] : originalScope)],
      );
      if (owner) {
        await queueOwnedSelectionEvaluation(
          connection,
          job.opportunityId,
          owner.account_id,
          nativeOpportunity,
          now,
        );
      } else {
        await queueAutomaticSelectionEvaluation(connection, {
          organizationId: job.organizationId,
          workspaceId: job.workspaceId,
          opportunityId: job.opportunityId,
          now,
        });
      }
      await connection.query(
        "UPDATE opportunity_profit_jobs SET status=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? WHERE id=? AND lease_owner=?",
        [
          status === "calculated" ? "succeeded" : "completed_with_warnings",
          now,
          job.id,
          this.workerId,
        ],
      );
      await this.event(
        connection,
        job,
        "opportunity.profit.calculated",
        {
          profit_run_id: runId,
          rule_version_code: String(rule.version_code),
          status,
          currency: target,
          net_profit: net,
          net_margin_percent: margin,
          missing_fields: missing,
        },
        now,
        ownership,
      );
      await connection.commit();
      return { status };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async finish(
    job: Job,
    status: "failed_terminal" | "scheduled" | "dead_letter",
    code: string,
  ) {
    const now = this.now(),
      delays = [60000, 300000, 900000],
      stored = status === "scheduled" ? "retry_scheduled" : status,
      available =
        status === "scheduled"
          ? new Date(now.getTime() + delays[Math.min(job.attemptCount - 1, 2)]!)
          : now;
    await this.pool.query(
      "UPDATE opportunity_profit_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=? AND lease_owner=? " +
        "AND status='leased' AND attempt_count=? AND lease_expires_at>UTC_TIMESTAMP(3)",
      [stored, available, code, now, job.id, this.workerId, job.attemptCount],
    );
  }

  private async event(
    connection: PoolConnection,
    job: Job,
    eventType: string,
    payload: unknown,
    now: Date,
    ownership: CalculationOwnership,
  ) {
    const id = randomUUID();
    await appendOpportunityEvent(connection, {
      id,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType,
      resourceType: "opportunity",
      resourceId: job.opportunityId,
      actorType: "worker",
      actorId: this.workerId,
      requestId: job.requestId,
      traceId: job.traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
    await appendOpportunityOutbox(connection, {
      id,
      eventId: id,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType,
      resourceType: "opportunity",
      resourceId: job.opportunityId,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
      requestId: job.requestId,
      traceId: job.traceId,
    });
    await registerCalculationOwners(connection, ownership, [
      ["opportunity_events", id],
      ["opportunity_outbox", id],
    ]);
  }
}
