import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  AUTOMATIC_SELECTION_FORMULA_VERSION,
  calculateAutomaticScoreFacts,
  isPhoneCase,
  normalizedProductFields,
  selectConservativeSupplyMatch,
  type ProductFacts,
  type SupplyFacts,
} from "./automatic-selection-evaluation.js";

type EvaluationStatus =
  | "waiting_evidence"
  | "waiting_profit"
  | "succeeded"
  | "failed_terminal"
  | "scheduled"
  | "dead_letter";
type EvaluationJob = {
  opportunityId: string;
  organizationId: string;
  workspaceId: string;
  attemptCount: number;
};
type ScoreDimension = {
  code: string;
  weight: number;
  required: boolean;
  evidence_group: "market" | "competition" | "cost" | "other";
};
type FeeLine = { type: string; mode: string; value: number; currency: string | null };
type ConversionRate = {
  base_currency: string;
  quote_currency: string;
  rate_value: number;
  effective_on: string;
  source_url: string;
};

const parse = <T>(value: unknown, fallback: T): T => {
  try {
    return typeof value === "string" ? (JSON.parse(value) as T) : ((value ?? fallback) as T);
  } catch {
    return fallback;
  }
};
const date = (value: unknown) => (value instanceof Date ? value : new Date(String(value)));
const rounded = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const number = (value: unknown) => {
  const parsed = value == null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class AutomaticSelectionEvaluationError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "AutomaticSelectionEvaluationError";
  }
}

export async function queueAutomaticSelectionEvaluation(
  connection: PoolConnection,
  input: { organizationId: string; workspaceId: string; opportunityId: string; now: Date },
) {
  await connection.query(
    "INSERT INTO automatic_selection_evaluations " +
      "(opportunity_id,organization_id,workspace_id,status,attempt_count,available_at,created_at,updated_at) " +
      "VALUES (?,?,?,'queued',0,?,?,?) ON DUPLICATE KEY UPDATE " +
      "status=IF(status='leased',status,'queued'),attempt_count=IF(status='leased',attempt_count,0)," +
      "available_at=IF(status='leased',available_at,VALUES(available_at))," +
      "last_error_code=IF(status='leased',last_error_code,NULL),updated_at=VALUES(updated_at)",
    [input.opportunityId, input.organizationId, input.workspaceId, input.now, input.now, input.now],
  );
}

export class MySqlAutomaticSelectionEvaluationWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly systemActorId: string,
    private readonly leaseSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async processOnce() {
    const job = await this.claim();
    if (!job) return { status: "idle" as const };
    try {
      const result = await this.evaluate(job);
      return { status: result.status, opportunity_id: job.opportunityId, ...result.payload };
    } catch (error) {
      const wrapped =
          error instanceof AutomaticSelectionEvaluationError
            ? error
            : new AutomaticSelectionEvaluationError(
                `automatic_selection_${String((error as { code?: string }).code ?? "dependency_failed").toLowerCase()}`,
                true,
              ),
        status: EvaluationStatus = !wrapped.retryable
          ? "failed_terminal"
          : job.attemptCount >= 4
            ? "dead_letter"
            : "scheduled";
      await this.finishFailure(job, status, wrapped.code);
      return { status, opportunity_id: job.opportunityId, error_code: wrapped.code };
    }
  }

  private async claim(): Promise<EvaluationJob | null> {
    const connection = await this.pool.getConnection(),
      now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM automatic_selection_evaluations WHERE " +
          "((status IN ('queued','retry_scheduled') AND available_at<=?) OR " +
          "(status='leased' AND lease_expires_at<=?)) ORDER BY available_at,opportunity_id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      const row = rows[0];
      if (!row) {
        await connection.commit();
        return null;
      }
      await connection.query(
        "UPDATE automatic_selection_evaluations SET status='leased',attempt_count=attempt_count+1," +
          "lease_owner=?,lease_expires_at=?,updated_at=? WHERE opportunity_id=?",
        [this.workerId, expires, now, row.opportunity_id],
      );
      await connection.commit();
      return {
        opportunityId: String(row.opportunity_id),
        organizationId: String(row.organization_id),
        workspaceId: String(row.workspace_id),
        attemptCount: Number(row.attempt_count) + 1,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async evaluate(job: EvaluationJob) {
    const connection = await this.pool.getConnection(),
      now = this.now(),
      requestId = `automatic-selection:${randomUUID()}`,
      traceId = randomUUID();
    try {
      await connection.beginTransaction();
      const [opportunities] = await connection.query<RowDataPacket[]>(
        "SELECT o.* FROM opportunities o WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? " +
          "AND o.decision_status='pending' AND EXISTS (SELECT 1 FROM opportunity_rule_matches m " +
          "JOIN trend_monitoring_rules r ON r.id=m.monitoring_rule_id AND r.organization_id=m.organization_id " +
          "AND r.workspace_id=m.workspace_id WHERE m.opportunity_id=o.id AND " +
          "m.organization_id=o.organization_id AND m.workspace_id=o.workspace_id AND r.status='enabled' " +
          "AND o.source_count>=r.recommendation_min_source_count) FOR UPDATE",
        [job.opportunityId, job.organizationId, job.workspaceId],
      );
      const opportunity = opportunities[0];
      if (!opportunity) {
        await this.complete(
          connection,
          job,
          "succeeded",
          null,
          { skipped: "not_rule_candidate" },
          now,
        );
        await connection.commit();
        return { status: "succeeded" as const, payload: { skipped: "not_rule_candidate" } };
      }
      const [scoreRules] = await connection.query<RowDataPacket[]>(
          "SELECT id,version_code,dimensions_json FROM score_rules WHERE organization_id=? AND " +
            "workspace_id=? AND status='active' ORDER BY activated_at DESC,id DESC LIMIT 1",
          [job.organizationId, job.workspaceId],
        ),
        [costRules] = await connection.query<RowDataPacket[]>(
          "SELECT id,version_code,fee_lines_json,conversion_rates_json,automatic_scope_json FROM cost_rules WHERE " +
            "organization_id=? AND workspace_id=? AND market=? AND platform='amazon' AND status='active' " +
            "ORDER BY published_at DESC,id DESC LIMIT 1",
          [job.organizationId, job.workspaceId, opportunity.market],
        );
      if (!scoreRules[0] || !costRules[0])
        return await this.waiting(
          connection,
          job,
          "automatic_rules_not_active",
          { score_rule: Boolean(scoreRules[0]), cost_rule: Boolean(costRules[0]) },
          now,
        );

      const [amazonRows] = await connection.query<RowDataPacket[]>(
        "SELECT ts.raw_evidence_id,ts.observed_at,n.payload_json,p.status provider_status FROM " +
          "opportunity_evidence_links l JOIN trend_signals ts ON ts.id=l.evidence_id " +
          "JOIN normalized_records n ON n.id=ts.normalized_record_id AND n.status='active' " +
          "JOIN providers p ON p.id=ts.provider_id WHERE l.opportunity_id=? AND " +
          "l.organization_id=? AND l.workspace_id=? AND p.code='amazon_product' " +
          "ORDER BY ts.observed_at DESC,ts.id DESC LIMIT 1",
        [job.opportunityId, job.organizationId, job.workspaceId],
      );
      const amazon = amazonRows[0];
      if (!amazon)
        return await this.waiting(connection, job, "amazon_product_evidence_missing", {}, now);
      const fields = normalizedProductFields(parse(amazon.payload_json, {})),
        amazonPrice = number(fields.price),
        amazonCurrency = text(fields.currency).toUpperCase(),
        amazonTitle = text(fields.title);
      if (!amazonTitle || amazonPrice == null || amazonPrice <= 0 || !amazonCurrency)
        return await this.waiting(
          connection,
          job,
          "amazon_sale_facts_incomplete",
          {
            missing: [
              !amazonTitle && "title",
              amazonPrice == null && "price",
              !amazonCurrency && "currency",
            ].filter(Boolean),
          },
          now,
        );
      const automaticScope = parse<{ product_family?: string }>(
        costRules[0].automatic_scope_json,
        {},
      );
      if (automaticScope.product_family !== "phone_case" || !isPhoneCase(amazonTitle))
        return await this.waiting(
          connection,
          job,
          "automatic_cost_scope_mismatch",
          { configured_product_family: automaticScope.product_family ?? null },
          now,
        );

      const [competitors] = await connection.query<RowDataPacket[]>(
        "SELECT s.* FROM competitors c JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id " +
          "WHERE c.opportunity_id=? AND c.organization_id=? AND c.workspace_id=? AND c.status='active' " +
          "ORDER BY s.captured_at DESC,s.id DESC LIMIT 1",
        [job.opportunityId, job.organizationId, job.workspaceId],
      );
      const competitor = competitors[0];
      if (!competitor)
        return await this.waiting(connection, job, "amazon_competitor_snapshot_missing", {}, now);

      const [supplyRows] = await connection.query<RowDataPacket[]>(
        "SELECT n.raw_evidence_id,n.payload_json,n.created_at FROM normalized_records n JOIN " +
          "providers p ON p.id=n.provider_id WHERE n.organization_id=? AND n.workspace_id=? " +
          "AND n.status='active' AND p.code='1688_search' ORDER BY n.created_at DESC,n.id DESC LIMIT 500",
        [job.organizationId, job.workspaceId],
      );
      const supplies: SupplyFacts[] = supplyRows.flatMap((row) => {
          const item = normalizedProductFields(parse(row.payload_json, {})),
            price = number(item.price),
            title = text(item.title),
            currency = text(item.currency).toUpperCase(),
            evidenceId = String(row.raw_evidence_id),
            externalId = text(item.external_id);
          return title && price != null && currency && externalId
            ? [
                {
                  title,
                  price,
                  currency,
                  observedAt: date(item.observed_at ?? row.created_at),
                  evidenceId,
                  externalId,
                },
              ]
            : [];
        }),
        supplyMatch = selectConservativeSupplyMatch(amazonTitle, supplies);
      if (!supplyMatch)
        return await this.waiting(
          connection,
          job,
          "high_confidence_1688_match_missing",
          { evaluated_supply_records: supplies.length, minimum_samples: 3, minimum_confidence: 80 },
          now,
        );

      const feeLines = parse<FeeLine[]>(costRules[0].fee_lines_json, []),
        conversionRates = parse<ConversionRate[]>(costRules[0].conversion_rates_json, []),
        logisticsConfigured = feeLines.some((item) => item.type === "logistics"),
        conversionConfigured =
          supplyMatch.item.currency === amazonCurrency ||
          conversionRates.some(
            (item) =>
              item.base_currency === supplyMatch.item.currency &&
              item.quote_currency === amazonCurrency &&
              item.effective_on <= now.toISOString().slice(0, 10),
          );
      if (!logisticsConfigured || !conversionConfigured)
        return await this.waiting(
          connection,
          job,
          "automatic_cost_policy_incomplete",
          {
            logistics_configured: logisticsConfigured,
            conversion_configured: conversionConfigured,
          },
          now,
        );

      const saleChanged = await this.upsertCostInput(connection, {
          job,
          platform: "amazon",
          type: "sale_price",
          amount: amazonPrice,
          currency: amazonCurrency,
          sourceRef: `amazon:${String(amazon.raw_evidence_id)}`,
          evidenceId: String(amazon.raw_evidence_id),
          observedAt: date(amazon.observed_at),
          requestId,
          traceId,
          now,
        }),
        purchaseChanged = await this.upsertCostInput(connection, {
          job,
          platform: "amazon",
          type: "purchase_price",
          amount: supplyMatch.conservativePrice,
          currency: supplyMatch.item.currency,
          sourceRef: `1688:${supplyMatch.item.externalId}:p75:${supplyMatch.sampleCount}`,
          evidenceId: supplyMatch.item.evidenceId,
          observedAt: supplyMatch.item.observedAt,
          requestId,
          traceId,
          now,
        }),
        [currentCostRows] = await connection.query<RowDataPacket[]>(
          "SELECT id,input_type,evidence_id,input_version,confirmation_mode,created_at FROM " +
            "opportunity_cost_inputs WHERE opportunity_id=? AND organization_id=? AND workspace_id=? " +
            "AND platform='amazon' AND input_type IN ('sale_price','purchase_price') AND is_current=1",
          [job.opportunityId, job.organizationId, job.workspaceId],
        ),
        currentCosts = new Map(currentCostRows.map((row) => [String(row.input_type), row])),
        currentSale = currentCosts.get("sale_price"),
        currentPurchase = currentCosts.get("purchase_price");
      if (!currentSale || !currentPurchase)
        return await this.waiting(connection, job, "automatic_cost_inputs_missing", {}, now);
      const currentCostEvidenceIds = [currentSale.evidence_id, currentPurchase.evidence_id]
          .map((item) => text(item))
          .filter(Boolean),
        costFingerprint = fingerprint({
          formula: AUTOMATIC_SELECTION_FORMULA_VERSION,
          score_rule: scoreRules[0].id,
          cost_rule: costRules[0].id,
          current_cost_inputs: [currentSale, currentPurchase].map((item) => ({
            id: String(item.id),
            version: Number(item.input_version),
            confirmation_mode: String(item.confirmation_mode),
            evidence_id: text(item.evidence_id),
          })),
          supplier_samples: supplyMatch.sampleCount,
          competitor_evidence: competitor.evidence_id,
        }),
        newestCostInputAt = Math.max(
          date(currentSale.created_at).getTime(),
          date(currentPurchase.created_at).getTime(),
        ),
        [profitRuns] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM opportunity_profit_runs WHERE opportunity_id=? AND organization_id=? AND " +
            "workspace_id=? AND cost_rule_id=? ORDER BY calculated_at DESC,id DESC LIMIT 1",
          [job.opportunityId, job.organizationId, job.workspaceId, costRules[0].id],
        ),
        profitRun = profitRuns[0],
        inputsChanged = saleChanged || purchaseChanged;
      if (
        inputsChanged ||
        !profitRun ||
        date(profitRun.calculated_at).getTime() < newestCostInputAt
      ) {
        await this.queueProfit(connection, job, String(costRules[0].id), requestId, traceId, now);
        await this.complete(
          connection,
          job,
          "waiting_profit",
          costFingerprint,
          {
            formula_version: AUTOMATIC_SELECTION_FORMULA_VERSION,
            supply_match_confidence: supplyMatch.confidence,
            supply_sample_count: supplyMatch.sampleCount,
          },
          now,
        );
        await connection.commit();
        return {
          status: "waiting_profit" as const,
          payload: { supply_match_confidence: supplyMatch.confidence },
        };
      }
      if (profitRun.status !== "calculated")
        return await this.waiting(
          connection,
          job,
          "profit_calculation_incomplete",
          { missing_fields: parse(profitRun.missing_fields_json, []) },
          now,
        );

      const evidenceIds = [
          String(amazon.raw_evidence_id),
          ...currentCostEvidenceIds,
          String(competitor.evidence_id),
        ],
        qualityBlocked = await this.qualityBlocked(connection, job, evidenceIds),
        product: ProductFacts = {
          title: amazonTitle,
          price: amazonPrice,
          currency: amazonCurrency,
          reviewCount: number(fields.review_count ?? competitor.review_count),
          rating: number(fields.rating ?? competitor.rating_value),
          availability: competitor.availability,
          observedAt: date(amazon.observed_at),
          evidenceId: String(amazon.raw_evidence_id),
          providerHealthy:
            amazon.provider_status === "enabled" &&
            competitor.source_status === "healthy" &&
            competitor.freshness === "fresh",
          qualityBlocked,
        },
        facts = calculateAutomaticScoreFacts({
          product,
          netMarginPercent: number(profitRun.net_margin_percent),
          evidenceAgeHours: Math.max(0, (now.getTime() - product.observedAt.getTime()) / 3_600_000),
          requiredFieldsPresent: [
            amazonTitle,
            amazonPrice,
            product.reviewCount,
            product.rating,
            competitor.availability,
          ].filter((item) => item != null && item !== "").length,
          requiredFieldCount: 5,
        }),
        dimensions = parse<ScoreDimension[]>(scoreRules[0].dimensions_json, []),
        scoreEvidence: Record<string, string[]> = {
          market_demand: [String(amazon.raw_evidence_id)],
          competition: [String(competitor.evidence_id)],
          profit: currentCostEvidenceIds,
          risk: [String(amazon.raw_evidence_id), String(competitor.evidence_id)],
          data_quality: evidenceIds,
        },
        scoreValues = facts as unknown as Record<string, number | string | null>;
      let scoreInputsChanged = false;
      for (const dimension of dimensions) {
        const value =
            typeof scoreValues[dimension.code] === "number"
              ? Number(scoreValues[dimension.code])
              : null,
          supported = Object.hasOwn(scoreEvidence, dimension.code);
        scoreInputsChanged =
          (await this.upsertScoreInput(connection, {
            job,
            dimension,
            score: supported && !qualityBlocked ? value : null,
            evidenceIds: scoreEvidence[dimension.code] ?? evidenceIds,
            missingFields:
              supported && value != null && !qualityBlocked
                ? []
                : [
                    qualityBlocked
                      ? "automatic_evaluation.quality_blocked"
                      : `automatic_evaluation.${dimension.code}.unsupported`,
                  ],
            sourceRef: `automatic:${AUTOMATIC_SELECTION_FORMULA_VERSION}:${costFingerprint.slice(0, 16)}`,
            observedAt: now,
            requestId,
            traceId,
            now,
          })) || scoreInputsChanged;
      }
      if (scoreInputsChanged || !opportunity.score_rule_version)
        await this.queueScore(connection, job, String(scoreRules[0].id), requestId, traceId, now);
      await connection.query(
        "UPDATE opportunities SET risk_level=?,recommendation_status=IF(?,'insufficient_data'," +
          "recommendation_status),version=version+1,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
        [
          facts.riskLevel,
          qualityBlocked,
          now,
          job.opportunityId,
          job.organizationId,
          job.workspaceId,
        ],
      );
      await this.complete(
        connection,
        job,
        "succeeded",
        costFingerprint,
        {
          formula_version: AUTOMATIC_SELECTION_FORMULA_VERSION,
          supply_match_confidence: supplyMatch.confidence,
          supply_sample_count: supplyMatch.sampleCount,
          score_inputs_changed: scoreInputsChanged,
          quality_blocked: qualityBlocked,
        },
        now,
      );
      await this.event(
        connection,
        job,
        "opportunity.automatic_quality_evaluated",
        {
          formula_version: AUTOMATIC_SELECTION_FORMULA_VERSION,
          evidence_fingerprint: costFingerprint,
        },
        requestId,
        traceId,
        now,
      );
      await connection.commit();
      return {
        status: "succeeded" as const,
        payload: { score_inputs_changed: scoreInputsChanged },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async waiting(
    connection: PoolConnection,
    job: EvaluationJob,
    code: string,
    payload: Record<string, unknown>,
    now: Date,
  ) {
    await this.complete(
      connection,
      job,
      "waiting_evidence",
      null,
      { error_code: code, ...payload },
      now,
    );
    await connection.commit();
    return { status: "waiting_evidence" as const, payload: { error_code: code, ...payload } };
  }

  private async upsertCostInput(
    connection: PoolConnection,
    input: {
      job: EvaluationJob;
      platform: string;
      type: "sale_price" | "purchase_price";
      amount: number;
      currency: string;
      sourceRef: string;
      evidenceId: string;
      observedAt: Date;
      requestId: string;
      traceId: string;
      now: Date;
    },
  ) {
    const [currentRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM opportunity_cost_inputs WHERE opportunity_id=? AND organization_id=? AND " +
        "workspace_id=? AND platform=? AND input_type=? AND is_current=1 LIMIT 1 FOR UPDATE",
      [
        input.job.opportunityId,
        input.job.organizationId,
        input.job.workspaceId,
        input.platform,
        input.type,
      ],
    );
    const current = currentRows[0];
    if (current?.confirmation_mode === "human_review") return false;
    if (
      current &&
      Number(current.amount_value) === rounded(input.amount) &&
      String(current.currency) === input.currency &&
      String(current.evidence_id) === input.evidenceId &&
      String(current.source_ref_id) === input.sourceRef &&
      current.confirmation_mode === "automatic_evidence"
    )
      return false;
    const [versions] = await connection.query<RowDataPacket[]>(
        "SELECT COALESCE(MAX(input_version),0)+1 next_version FROM opportunity_cost_inputs WHERE " +
          "opportunity_id=? AND organization_id=? AND workspace_id=? AND platform=? AND input_type=?",
        [
          input.job.opportunityId,
          input.job.organizationId,
          input.job.workspaceId,
          input.platform,
          input.type,
        ],
      ),
      version = Number(versions[0]?.next_version ?? 1);
    await connection.query(
      "UPDATE opportunity_cost_inputs SET is_current=0 WHERE opportunity_id=? AND organization_id=? AND " +
        "workspace_id=? AND platform=? AND input_type=? AND is_current=1",
      [
        input.job.opportunityId,
        input.job.organizationId,
        input.job.workspaceId,
        input.platform,
        input.type,
      ],
    );
    await connection.query(
      "INSERT INTO opportunity_cost_inputs (id,organization_id,workspace_id,opportunity_id,platform," +
        "input_type,amount_value,currency,source_type,source_ref_id,evidence_id,observed_at,input_version," +
        "is_current,confirmation_mode,submitted_by,confirmed_by,request_id,trace_id,created_at) VALUES " +
        "(?,?,?,?,?,?,?,?,?,?,?,?,?,1,'automatic_evidence',?,NULL,?,?,?)",
      [
        randomUUID(),
        input.job.organizationId,
        input.job.workspaceId,
        input.job.opportunityId,
        input.platform,
        input.type,
        rounded(input.amount),
        input.currency,
        "automatic_crawler_evidence",
        input.sourceRef,
        input.evidenceId,
        input.observedAt,
        version,
        this.systemActorId,
        input.requestId,
        input.traceId,
        input.now,
      ],
    );
    return true;
  }

  private async upsertScoreInput(
    connection: PoolConnection,
    input: {
      job: EvaluationJob;
      dimension: ScoreDimension;
      score: number | null;
      evidenceIds: string[];
      missingFields: string[];
      sourceRef: string;
      observedAt: Date;
      requestId: string;
      traceId: string;
      now: Date;
    },
  ) {
    const evidenceJson = JSON.stringify([...new Set(input.evidenceIds)]),
      missingJson = JSON.stringify([...new Set(input.missingFields)]),
      [currentRows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM opportunity_score_inputs WHERE opportunity_id=? AND dimension_code=? AND is_current=1 LIMIT 1 FOR UPDATE",
        [input.job.opportunityId, input.dimension.code],
      ),
      current = currentRows[0];
    if (
      current &&
      (current.score_value == null
        ? input.score == null
        : Number(current.score_value) === input.score) &&
      JSON.stringify(parse(current.evidence_ids_json, [])) === evidenceJson &&
      JSON.stringify(parse(current.missing_fields_json, [])) === missingJson &&
      String(current.source_ref_id) === input.sourceRef
    )
      return false;
    const [versions] = await connection.query<RowDataPacket[]>(
        "SELECT COALESCE(MAX(input_version),0)+1 next_version FROM opportunity_score_inputs WHERE opportunity_id=? AND dimension_code=?",
        [input.job.opportunityId, input.dimension.code],
      ),
      version = Number(versions[0]?.next_version ?? 1);
    await connection.query(
      "UPDATE opportunity_score_inputs SET is_current=0 WHERE opportunity_id=? AND dimension_code=? AND is_current=1",
      [input.job.opportunityId, input.dimension.code],
    );
    await connection.query(
      "INSERT INTO opportunity_score_inputs (id,organization_id,workspace_id,opportunity_id," +
        "dimension_code,evidence_group,score_value,source_type,source_ref_id,evidence_ids_json," +
        "missing_fields_json,observed_at,input_version,is_current,created_by,request_id,trace_id,created_at) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
      [
        randomUUID(),
        input.job.organizationId,
        input.job.workspaceId,
        input.job.opportunityId,
        input.dimension.code,
        input.dimension.evidence_group,
        input.score,
        "automatic_crawler_evidence",
        input.sourceRef,
        evidenceJson,
        missingJson,
        input.observedAt,
        version,
        this.workerId,
        input.requestId,
        input.traceId,
        input.now,
      ],
    );
    return true;
  }

  private async queueProfit(
    connection: PoolConnection,
    job: EvaluationJob,
    ruleId: string,
    requestId: string,
    traceId: string,
    now: Date,
  ) {
    const [existing] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM opportunity_profit_jobs WHERE opportunity_id=? AND cost_rule_id=? AND " +
        "status IN ('queued','leased','retry_scheduled') LIMIT 1",
      [job.opportunityId, ruleId],
    );
    if (existing[0]) return;
    await connection.query(
      "INSERT INTO opportunity_profit_jobs (id,organization_id,workspace_id,opportunity_id,cost_rule_id," +
        "status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES " +
        "(?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        job.opportunityId,
        ruleId,
        now,
        requestId,
        traceId,
        now,
        now,
      ],
    );
  }

  private async queueScore(
    connection: PoolConnection,
    job: EvaluationJob,
    ruleId: string,
    requestId: string,
    traceId: string,
    now: Date,
  ) {
    const [existing] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM opportunity_score_jobs WHERE opportunity_id=? AND score_rule_id=? AND " +
        "status IN ('queued','leased','retry_scheduled') LIMIT 1",
      [job.opportunityId, ruleId],
    );
    if (existing[0]) return;
    await connection.query(
      "INSERT INTO opportunity_score_jobs (id,organization_id,workspace_id,opportunity_id,score_rule_id," +
        "status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES " +
        "(?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        job.opportunityId,
        ruleId,
        now,
        requestId,
        traceId,
        now,
        now,
      ],
    );
  }

  private async qualityBlocked(
    connection: PoolConnection,
    job: EvaluationJob,
    evidenceIds: string[],
  ) {
    const unique = [...new Set(evidenceIds)];
    if (!unique.length) return true;
    const placeholders = unique.map(() => "?").join(","),
      [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) blocked FROM raw_evidence e WHERE e.organization_id=? AND e.workspace_id=? ` +
          `AND e.id IN (${placeholders}) AND (e.status<>'active' OR EXISTS (SELECT 1 FROM ` +
          `data_quality_issues i WHERE i.raw_evidence_id=e.id AND i.organization_id=e.organization_id ` +
          `AND i.workspace_id=e.workspace_id AND i.status='open' AND i.severity='critical'))`,
        [job.organizationId, job.workspaceId, ...unique],
      );
    return Number(rows[0]?.blocked ?? 0) > 0;
  }

  private async complete(
    connection: PoolConnection,
    job: EvaluationJob,
    status: "waiting_evidence" | "waiting_profit" | "succeeded",
    evidenceFingerprint: string | null,
    result: Record<string, unknown>,
    now: Date,
  ) {
    await connection.query(
      "UPDATE automatic_selection_evaluations SET status=?,attempt_count=0,lease_owner=NULL," +
        "lease_expires_at=NULL,last_error_code=?,evidence_fingerprint=?,result_json=?,evaluated_at=?," +
        "updated_at=? WHERE opportunity_id=? AND lease_owner=?",
      [
        status,
        typeof result.error_code === "string" ? result.error_code : null,
        evidenceFingerprint,
        JSON.stringify(result),
        now,
        now,
        job.opportunityId,
        this.workerId,
      ],
    );
  }

  private async finishFailure(job: EvaluationJob, status: EvaluationStatus, code: string) {
    const now = this.now(),
      stored = status === "scheduled" ? "retry_scheduled" : status,
      delays = [60_000, 300_000, 900_000],
      available =
        status === "scheduled"
          ? new Date(now.getTime() + delays[Math.min(job.attemptCount - 1, 2)]!)
          : now;
    await this.pool.query(
      "UPDATE automatic_selection_evaluations SET status=?,available_at=?,lease_owner=NULL," +
        "lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE opportunity_id=? AND lease_owner=?",
      [stored, available, code, now, job.opportunityId, this.workerId],
    );
  }

  private async event(
    connection: PoolConnection,
    job: EvaluationJob,
    eventType: string,
    payload: Record<string, unknown>,
    requestId: string,
    traceId: string,
    now: Date,
  ) {
    const id = randomUUID();
    await connection.query(
      "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type,resource_type," +
        "resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES " +
        "(?,?,?,?,'opportunity',?,'worker',?,?,?,?,?)",
      [
        id,
        job.organizationId,
        job.workspaceId,
        eventType,
        job.opportunityId,
        this.workerId,
        requestId,
        traceId,
        JSON.stringify(payload),
        now,
      ],
    );
  }
}
