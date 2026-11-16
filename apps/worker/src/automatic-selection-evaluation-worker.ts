import { appendOpportunityEvent } from "@scoutops/database";
import { queueOwnedSelectionEvaluation } from "./account-evaluation-enqueue.js";
import { hasLegacyScoreRuleScope } from "./score-rule-scope.js";
import { calculationOwnersMatch, readCalculationOpportunityForClaim, registerCalculationOwners, resolveCalculationOwnership, type CalculationOwnership } from "./opportunity-calculation-ownership.js";
import { accountAutomaticEvaluationQueries, enqueueMissingSelectionEvaluations, nativeAutomaticEvaluationLockSql } from "./automatic-selection-evaluation-admission.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";
import {
  classifyPrimarySource,
  readPrimarySourceContext,
  readPrimarySourceVerdict,
  PRIMARY_SOURCE_SUPPORT_EVENT,
  PRIMARY_SOURCE_SUPPORT_REVISION,
  type PrimarySourceVerdict,
} from "./primary-source-support.js";
import type { IntelligenceProductClassifier } from "./intelligence-product-association.js";
import { recoverPrimarySourceEvaluations } from "./primary-source-support-recovery.js";
import { recoverSkippedSelectionEvaluations } from "./automatic-selection-skipped-recovery.js";
import {
  recoverDeviceFitEvaluations,
  SUPPLY_DEVICE_FIT_REVISION,
} from "./automatic-selection-device-fit-recovery.js";
import { retireUnmatchedAutomaticSupplyQuotes } from "./automatic-supply-quote-retirement.js";
import { completedCompetitorRead, recordSelectionPipelineCompletion } from "./selection-pipeline-completion.js";
import {
  recoverSupplyClassifierEvaluations,
  SUPPLY_TITLE_CLASSIFIER_REVISION,
} from "./automatic-selection-classifier-recovery.js";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { amazonAsin } from "./competitor-discovery-policy.js";
import {
  validateSupplyTitleClassifications,
  SupplyTitleCitationError,
  type SupplyTitleClassifier,
  type SupplyTitleContext,
} from "./supply-title-classification.js";
import { supplyFacts } from "./supply-facts-from-records.js";
import { LAN_1688_COLLECTION_LIMIT } from "./lan-1688-image-search.js";
import {
  supplyIdentityKey,
  supplySourceRef,
  supplyDetailText,
  supplyDetailEligible,
  supplySkuUseCompatible,
} from "./supply-detail-facts.js";
import {
  selectionCandidateSql,
  automaticEvaluationCompleteSql,
  automaticEvaluationFailureSql,
  automaticEvaluationEnqueueUpdateSql,
} from "@scoutops/database";
import {
  readAutomaticPrimaryEvidence,
  hasNativeNormalizedAccountScope,
  automaticPrimarySnapshotSql,
  accountAutomaticPrimarySnapshotSql,
  automaticSupplyEvidenceSql,
  accountAutomaticSupplyEvidenceSql,
  primaryProductEvidence as primaryEvidence,
} from "./automatic-selection-evidence.js";
import {
  AUTOMATIC_SELECTION_FORMULA_VERSION,
  calculateAutomaticScoreFacts,
  calculateCompetitorMedian,
  genericTitleFactsCompatible,
  isPhoneCase,
  normalizedProductFields,
  selectConservativeSupplyMatch,
  selectClassifiedSupplyQuote,
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
  executionOwnership?: CalculationOwnership;
  nativeParent?: boolean;
};
function evaluationOwnerPredicate(job: EvaluationJob, parent: string) {
  const owner = job.executionOwnership?.owner;
  return owner
    ? { sql: `EXISTS (SELECT 1 FROM account_owned_records a WHERE a.source_table='opportunities' AND a.source_id=${parent}.id AND a.account_id=?${job.nativeParent ? ` AND ${parent}.account_id=a.account_id` : ""})`,
        args: [owner.account_id] }
    : { sql: `${parent}.organization_id=? AND ${parent}.workspace_id=?`, args: [job.organizationId, job.workspaceId] };
}
type ScoreDimension = {
  code: string;
  weight: number;
  required: boolean;
  evidence_group: "market" | "competition" | "cost" | "other";
};

export async function readAutomaticCalculationRules(
  connection: PoolConnection,
  job: Pick<EvaluationJob, "opportunityId" | "organizationId" | "workspaceId">,
  market: string,
  ownership?: CalculationOwnership,
) {
  if (ownership === undefined) ownership = await resolveCalculationOwnership(connection, job.opportunityId);
  const account = ownership?.owner?.account_id;
  const ruleScope = (table: "score_rules" | "cost_rules", legacy: boolean) =>
    (account ? "" : "r.organization_id=? AND r.workspace_id=? AND ") +
    (ownership
      ? `${account ? "" : "NOT "}EXISTS (SELECT 1 FROM account_owned_records a WHERE a.source_table='${table}' AND a.source_id=r.id${account ? " AND a.account_id=?" : ""}${account && !legacy ? " AND r.account_id=a.account_id" : ""}) AND `
      : "");
  const args = account ? [account] : [job.organizationId, job.workspaceId];
  const legacyScore = await hasLegacyScoreRuleScope(connection);
  const legacyCost = await hasLegacyScoreRuleScope(connection, "cost_rules");
  const [scoreRules] = account || legacyScore ? await connection.query<RowDataPacket[]>(
    "SELECT id,version_code,dimensions_json FROM score_rules r WHERE " + ruleScope("score_rules", legacyScore) +
      "status='active' ORDER BY activated_at DESC,id DESC LIMIT 1 LOCK IN SHARE MODE",
    args,
  ) : [[]];
  const [costRules] = account || legacyCost ? await connection.query<RowDataPacket[]>(
    "SELECT id,version_code,fee_lines_json,conversion_rates_json,automatic_scope_json FROM cost_rules r WHERE " +
      ruleScope("cost_rules", legacyCost) + "market=? AND platform='amazon' AND status='active' ORDER BY published_at DESC,id DESC LIMIT 1 LOCK IN SHARE MODE",
    [...args, market],
  ) : [[]];
  return {scoreRules, costRules, ownership};
}
/** Called under the original opportunity lock and within the evaluation transaction. */
export async function queueAutomaticCalculationJob(
  connection: PoolConnection,
  kind: "score" | "profit",
  ownership: CalculationOwnership,
  opportunityId: string,
  ruleId: string,
  requestId: string,
  traceId: string,
  now: Date,
) {
  const [table, ruleColumn, ruleTable] = kind === "score"
    ? ["opportunity_score_jobs", "score_rule_id", "score_rules"] as const
    : ["opportunity_profit_jobs", "cost_rule_id", "cost_rules"] as const;
  if (!(await calculationOwnersMatch(connection, ownership, [[ruleTable, ruleId]])))
    throw new AutomaticSelectionEvaluationError("automatic_calculation_rule_owner_mismatch", false);
  if (ownership?.owner && !await hasLegacyScoreRuleScope(connection, ruleTable)) {
    const [[rule]] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM ${ruleTable} WHERE id=? AND account_id=? LOCK IN SHARE MODE`,
      [ruleId, ownership.owner.account_id],
    );
    if (!rule) throw new AutomaticSelectionEvaluationError("automatic_calculation_rule_owner_mismatch", false);
  }
  const [existing] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM " + table + " WHERE opportunity_id=? AND " + ruleColumn + "=? AND " +
      "status IN ('queued','leased','retry_scheduled') LIMIT 1",
    [opportunityId, ruleId],
  );
  if (existing[0]) {
    if (!(await calculationOwnersMatch(connection, ownership, [[table, String(existing[0].id)]], true)))
      throw new AutomaticSelectionEvaluationError("automatic_calculation_job_owner_mismatch", false);
    return;
  }
  const id = randomUUID();
  await connection.query(
    "INSERT INTO " + table + " (id,opportunity_id," + ruleColumn + "," +
      "status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,'queued',0,?,?,?,?,?)",
    [id, opportunityId, ruleId, now, requestId, traceId, now, now],
  );
  await registerCalculationOwners(connection, ownership, [[table, id]]);
}
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
  input: { opportunityId: string; now: Date } & ({ accountId: string } | { organizationId: string; workspaceId: string }),
) {
  if ("accountId" in input) {
    await queueOwnedSelectionEvaluation(connection, input.opportunityId, input.accountId,
      await nativeOpportunityStorage(connection), input.now);
    return;
  }
  await connection.query(
    "INSERT INTO automatic_selection_evaluations " +
      "(opportunity_id,status,attempt_count,available_at,created_at,updated_at) " +
      "SELECT o.id,'queued',0,?,?,? FROM opportunities o " +
      "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? " +
      automaticEvaluationEnqueueUpdateSql,
    [input.now, input.now, input.now, input.opportunityId, input.organizationId, input.workspaceId],
  );
}

export class MySqlAutomaticSelectionEvaluationWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly systemActorId: string,
    private readonly leaseSeconds: number,
    private readonly now: () => Date = () => new Date(),
    private readonly supplyClassifier?: SupplyTitleClassifier &
      Partial<Pick<IntelligenceProductClassifier, "selectPrimary">>,
  ) {}

  async processOnce() {
    await this.enqueueEligibleCandidates();
    const job = await this.claim();
    if (!job) return { status: "idle" as const };
    try {
      const sourceVerdict = await classifyPrimarySource(
        this.pool,
        job.executionOwnership?.owner ? { ...job, accountId: job.executionOwnership.owner.account_id } : job,
        this.supplyClassifier?.selectPrimary
          ? { selectPrimary: this.supplyClassifier.selectPrimary.bind(this.supplyClassifier) }
          : undefined,
      );
      await this.renewClassificationLease(job);
      let classification: SupplyTitleContext | undefined, classificationError: string | undefined;
      try {
        if (sourceVerdict?.supported) classification = await this.classifySupplyTitles(job);
      } catch (error) {
        const code = String((error as { code?: unknown }).code ?? "");
        classificationError = /^intelligence_[a-z_]{1,64}$/.test(code)
          ? code
          : "supply_title_classification_failed";
      }
      const result = await this.evaluate(job, classification, classificationError, sourceVerdict);
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

  private async enqueueEligibleCandidates() {
    const now = this.now();
    const native = await hasNativeNormalizedAccountScope(this.pool);
    const accountParent = native && await nativeOpportunityStorage(this.pool);
    if (this.supplyClassifier) await recoverSupplyClassifierEvaluations(this.pool, now, native, accountParent);
    await enqueueMissingSelectionEvaluations(this.pool, now, native, accountParent);
    await recoverSkippedSelectionEvaluations(this.pool, now, native, accountParent);
    await recoverDeviceFitEvaluations(this.pool, now, native, accountParent);
    if (this.supplyClassifier?.selectPrimary) await recoverPrimarySourceEvaluations(this.pool, now, native, accountParent);
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
      const parent = await readCalculationOpportunityForClaim(
        connection, String(row.opportunity_id), "automatic_selection_opportunity_missing",
      );
      const ownership = parent.ownership ?? await resolveCalculationOwnership(connection, String(row.opportunity_id));
      await connection.query(
        "UPDATE automatic_selection_evaluations SET status='leased',attempt_count=attempt_count+1," +
          "result_json=JSON_REMOVE(result_json,'$.requeue_requested')," +
          "lease_owner=?,lease_expires_at=?,updated_at=? WHERE opportunity_id=?",
        [this.workerId, expires, now, row.opportunity_id],
      );
      await connection.commit();
      return {
        opportunityId: String(row.opportunity_id),
        organizationId: parent.organizationId,
        workspaceId: parent.workspaceId,
        attemptCount: Number(row.attempt_count) + 1,
        ...(ownership ? { executionOwnership: ownership } : {}),
        ...(parent.ownership ? { nativeParent: true as const } : {}),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async classifySupplyTitles(job: EvaluationJob): Promise<SupplyTitleContext | undefined> {
    if (!this.supplyClassifier) return undefined;
    const params = [job.opportunityId, job.organizationId, job.workspaceId];
    const account = job.executionOwnership?.owner?.account_id;
    const { linked, detail } = await readAutomaticPrimaryEvidence(this.pool,
      account ? { ...job, accountId: account } : job);
    const primary = primaryEvidence(linked, detail);
    if (!primary) return undefined;
    const fields = normalizedProductFields(parse(primary.payload_json, {})),
      title = text(fields.title),
      price = number(fields.price);
    if (
      !title ||
      title.length > 1000 ||
      price == null ||
      price <= 0 ||
      !text(fields.currency) ||
      isPhoneCase(title)
    )
      return undefined;
    const [snapshots] = await this.pool.query<RowDataPacket[]>(
      account ? accountAutomaticPrimarySnapshotSql : automaticPrimarySnapshotSql, [
      ...(account ? [job.opportunityId, account] : params),
      amazonAsin(fields, text(fields.canonical_url ?? fields.source_url)) ?? "",
    ]);
    if (!snapshots[0]) return undefined;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      account ? accountAutomaticSupplyEvidenceSql : automaticSupplyEvidenceSql,
      account ? [job.opportunityId, account] : params),
      supplies = supplyFacts(rows);
    if (supplies.every((item) => !item.skuId) && selectConservativeSupplyMatch(title, supplies))
      return undefined;
    const latest = new Map<string, SupplyFacts>();
    for (const item of supplies) {
      if (!Number.isFinite(item.observedAt.getTime())) continue;
      const current = latest.get(supplyIdentityKey(item));
      if (!current || item.observedAt > current.observedAt)
        latest.set(supplyIdentityKey(item), item);
    }
    const candidates = [...latest.values()]
      .filter(
        (item) =>
          item.title &&
          item.title.length <= 1000 &&
          item.currency === "CNY" &&
          Number.isFinite(item.price) &&
          item.price > 0 &&
          item.evidenceId &&
          !item.priceDescription?.includes("新人价") &&
          !isPhoneCase(item.title) &&
          supplyDetailEligible(item) &&
          supplySkuUseCompatible(title, item) &&
          supplyDetailText(item).length <= 4000 &&
          genericTitleFactsCompatible(title, `${item.title} ${supplyDetailText(item)}`),
      )
      .slice(0, LAN_1688_COLLECTION_LIMIT)
      .map((item) => ({
        source_ref: supplySourceRef(item),
        title: item.title,
        ...(item.skuId ? { details: supplyDetailText(item) } : {}),
      }));
    if (!candidates.length) return undefined;
    const context: SupplyTitleContext = {
      input: {
        product_ref: `amazon:${String(primary.raw_evidence_id)}`,
        product_title: title,
        candidates: [],
      },
      classifications: [],
    };
    let citationFailure: SupplyTitleCitationError | undefined;
    for (let offset = 0; offset < candidates.length; offset += 10) {
      if (offset > 0) await this.renewClassificationLease(job);
      const input = { ...context.input, candidates: candidates.slice(offset, offset + 10) };
      let classifications;
      try {
        classifications = validateSupplyTitleClassifications(
          { classifications: await this.supplyClassifier.classifySupplies(input) },
          input,
        );
      } catch (error) {
        if (!(error instanceof SupplyTitleCitationError)) throw error;
        citationFailure = error;
        continue;
      }
      context.input.candidates.push(...input.candidates);
      context.classifications.push(...classifications);
      if (selectClassifiedSupplyQuote(context.input.product_ref, title, supplies, context)) break;
    }
    if (!context.classifications.length && citationFailure) throw citationFailure;
    return context;
  }

  private async renewClassificationLease(job: EvaluationJob) {
    const now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    const scope = evaluationOwnerPredicate(job, "p");
    const owned = Boolean(job.executionOwnership?.owner);
    const [result] = await this.pool.query<ResultSetHeader>(
      "UPDATE automatic_selection_evaluations SET lease_expires_at=?,updated_at=? " +
        "WHERE opportunity_id=? AND EXISTS (SELECT 1 FROM opportunities p " +
        `WHERE p.id=automatic_selection_evaluations.opportunity_id AND ${scope.sql}) AND status='leased' ` +
        "AND lease_owner=? AND lease_expires_at>?" + (owned ? " AND attempt_count=?" : ""),
      [expires, now, job.opportunityId, ...scope.args, this.workerId, now, ...(owned ? [job.attemptCount] : [])],
    );
    if (result.affectedRows !== 1)
      throw new AutomaticSelectionEvaluationError("automatic_selection_lease_expired", true);
  }

  private async evaluate(
    job: EvaluationJob,
    classification?: SupplyTitleContext,
    classificationError?: string,
    sourceVerdict?: PrimarySourceVerdict | null,
  ) {
    const connection = await this.pool.getConnection(),
      now = this.now(),
      requestId = `automatic-selection:${randomUUID()}`,
      traceId = randomUUID();
    try {
      await connection.beginTransaction();
      const nativeEvidence = await hasNativeNormalizedAccountScope(connection);
      const accountParent = nativeEvidence && await nativeOpportunityStorage(connection);
      const leasedAccount = job.executionOwnership?.owner?.account_id;
      if (accountParent && !leasedAccount)
        throw new AutomaticSelectionEvaluationError("automatic_selection_owner_changed", true);
      const [opportunities] = await connection.query<RowDataPacket[]>(
        accountParent ? accountAutomaticEvaluationQueries.lock : nativeEvidence ? nativeAutomaticEvaluationLockSql :
          "SELECT o.* FROM opportunities o WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? " +
          `AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted') AND ${selectionCandidateSql} FOR UPDATE`,
        accountParent ? [job.opportunityId, leasedAccount] : [job.opportunityId, job.organizationId, job.workspaceId],
      );
      const ownership = await resolveCalculationOwnership(connection, job.opportunityId);
      if (job.executionOwnership?.owner &&
          job.executionOwnership.owner.account_id !== ownership?.owner?.account_id)
        throw new AutomaticSelectionEvaluationError("automatic_selection_owner_changed", true);
      job = { ...job, executionOwnership: ownership, nativeParent: accountParent };
      const ownerCheck = evaluationOwnerPredicate(job, "p");
      const updateCheck = evaluationOwnerPredicate(job, "opportunities");
      if (ownership?.owner || classification || this.supplyClassifier || sourceVerdict) {
        const [leases] = await connection.query<RowDataPacket[]>(
          "SELECT opportunity_id FROM automatic_selection_evaluations WHERE opportunity_id=? AND EXISTS (SELECT 1 FROM opportunities p " +
            `WHERE p.id=automatic_selection_evaluations.opportunity_id AND ${ownerCheck.sql}) ` +
            "AND status='leased' AND lease_owner=? AND lease_expires_at>?" +
            (ownership?.owner ? " AND attempt_count=?" : "") + " FOR UPDATE",
          [job.opportunityId, ...ownerCheck.args, this.workerId, this.now(),
            ...(ownership?.owner ? [job.attemptCount] : [])],
        );
        if (!leases[0])
          throw new AutomaticSelectionEvaluationError("automatic_selection_lease_expired", true);
      }
      const opportunity = opportunities[0];
      if (!opportunity) {
        await this.complete(
          connection,
          job,
          "succeeded",
          null,
          { skipped: "primary_product_missing_or_not_pending" },
          now,
        );
        await connection.commit();
        return {
          status: "succeeded" as const,
          payload: { skipped: "primary_product_missing_or_not_pending" },
        };
      }
      const accountId = ownership?.owner?.account_id;
      const sourceScope = accountId ? { ...job, accountId } : job;
      const { linked, detail } = await readAutomaticPrimaryEvidence(connection, sourceScope);
      const amazon = primaryEvidence(linked, detail);
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
      const sourceContext = await readPrimarySourceContext(connection, sourceScope);
      let sourceSupportNew = false;
      if (sourceContext) {
        if (sourceVerdict && sourceVerdict.fingerprint !== sourceContext.fingerprint)
          throw new AutomaticSelectionEvaluationError("automatic_primary_source_changed", true);
        const cached = await readPrimarySourceVerdict(connection, sourceScope, sourceContext);
        if (!cached && sourceVerdict) {
          await this.event(
            connection,
            job,
            PRIMARY_SOURCE_SUPPORT_EVENT,
            sourceVerdict,
            requestId,
            traceId,
            now,
          );
          sourceSupportNew = sourceVerdict.supported;
        }
        if (!(cached ?? sourceVerdict)?.supported) {
          await connection.query(
            "UPDATE opportunities SET recommendation_status='insufficient_data',version=version+1,updated_at=? " +
              `WHERE id=? AND ${updateCheck.sql} AND decision_status='pending' ` +
              "AND recommendation_status<>'insufficient_data'",
            [now, job.opportunityId, ...updateCheck.args],
          );
          return await this.waiting(
            connection,
            job,
            (cached ?? sourceVerdict)
              ? "automatic_primary_source_unsupported"
              : "automatic_primary_source_unverified",
            {},
            now,
          );
        }
      }
      const {scoreRules, costRules} = await readAutomaticCalculationRules(connection, job, String(opportunity.market), ownership);
      const scoreRule = scoreRules[0];
      if (!scoreRule)
        return await this.waiting(
          connection,
          job,
          "automatic_rules_not_active",
          { score_rule: false, cost_rule: Boolean(costRules[0]), market: opportunity.market },
          now,
        );

      const [competitors] = await connection.query<RowDataPacket[]>(
        accountId ? accountAutomaticPrimarySnapshotSql : automaticPrimarySnapshotSql, [
        ...(accountId ? [job.opportunityId, accountId] : [job.opportunityId, job.organizationId, job.workspaceId]),
        amazonAsin(fields, text(fields.canonical_url ?? fields.source_url)) ?? "",
      ]);
      const competitor = competitors[0];
      if (!competitor)
        return await this.waiting(connection, job, "amazon_competitor_snapshot_missing", {}, now);

      const nativeCompetition = accountId && nativeEvidence;
      const competition = completedCompetitorRead(
        [job.opportunityId, job.organizationId, job.workspaceId],
        nativeCompetition ? { account: accountId, accountParent, asin: amazonAsin(fields, text(fields.canonical_url ?? fields.source_url)) ?? "" } : undefined,
        true,
      );
      const [competitionRows] = await connection.query<RowDataPacket[]>(competition.sql, competition.args);
      const competitionFacts = calculateCompetitorMedian(
        competitionRows.map((row) => ({
          asin: String(row.asin),
          reviewCount: number(row.review_count),
          evidenceId: String(row.evidence_id ?? ""),
        })),
      );

      // Evidence scoring is independent of category-specific cost eligibility.
      // Null profit is explicit missing data, never an assumed zero margin.
      const publishScores = async (
        netMarginPercent: number | null,
        currentCostEvidenceIds: string[],
        costFingerprint: string,
        missingProfitReason?: string,
      ) => {
        const evidenceIds = [
            String(amazon.raw_evidence_id),
            ...currentCostEvidenceIds,
            ...competitionFacts.evidenceIds,
            String(competitor.evidence_id),
          ],
          qualityBlocked = await this.qualityBlocked(connection, job, evidenceIds, Boolean(ownership?.owner)),
          product: ProductFacts = {
            title: amazonTitle,
            price: amazonPrice,
            currency: amazonCurrency,
            reviewCount: number(fields.review_count ?? competitor.review_count),
            rating: number(fields.rating_value ?? fields.rating ?? competitor.rating_value),
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
            competitorScore: competitionFacts.score,
            netMarginPercent,
            evidenceAgeHours: Math.max(
              0,
              (now.getTime() - product.observedAt.getTime()) / 3_600_000,
            ),
            requiredFieldsPresent: [
              amazonTitle,
              amazonPrice,
              product.reviewCount,
              product.rating,
              competitor.availability === "unknown" ? null : competitor.availability,
            ].filter((item) => item != null && item !== "").length,
            requiredFieldCount: 5,
          }),
          dimensions = parse<ScoreDimension[]>(scoreRule.dimensions_json, []),
          scoreEvidence: Record<string, string[]> = {
            market_demand: [String(amazon.raw_evidence_id)],
            competition: competitionFacts.evidenceIds,
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
              ownership,
              dimension,
              score: supported && !qualityBlocked ? value : null,
              evidenceIds: scoreEvidence[dimension.code] ?? evidenceIds,
              missingFields:
                supported && value != null && !qualityBlocked
                  ? []
                  : [
                      qualityBlocked
                        ? "automatic_evaluation.quality_blocked"
                        : dimension.code === "profit" && missingProfitReason
                          ? `automatic_evaluation.profit.${missingProfitReason}`
                          : `automatic_evaluation.${dimension.code}.unsupported`,
                    ],
              sourceRef: `automatic:${AUTOMATIC_SELECTION_FORMULA_VERSION}:${costFingerprint.slice(0, 16)}`,
              observedAt: now,
              requestId,
              traceId,
              now,
            })) || scoreInputsChanged;
        }
        const needsScore =
          scoreInputsChanged ||
          sourceSupportNew ||
          opportunity.score_rule_version !== scoreRule.version_code;
        if (needsScore)
          await queueAutomaticCalculationJob(connection, "score", ownership, job.opportunityId, String(scoreRule.id), requestId, traceId, now);
        await connection.query(
          "UPDATE opportunities SET risk_level=?,recommendation_status=IF(?,'insufficient_data'," +
            `recommendation_status),profit_status=IF(?,'insufficient_data',profit_status),version=version+1,updated_at=? WHERE id=? AND ${updateCheck.sql}`,
          [
            facts.riskLevel,
            qualityBlocked || Boolean(missingProfitReason),
            Boolean(missingProfitReason),
            now,
            job.opportunityId,
            ...updateCheck.args,
          ],
        );
        if (missingProfitReason && scoreInputsChanged)
          await this.event(
            connection,
            job,
            "opportunity.automatic_quality_evaluated",
            {
              formula_version: AUTOMATIC_SELECTION_FORMULA_VERSION,
              evidence_fingerprint: costFingerprint,
              missing_profit_reason: missingProfitReason,
              competition_analysis: {
                method: "review-barrier-median-v1",
                score: competitionFacts.score,
                evidence_ids: competitionFacts.evidenceIds,
                samples: competitionRows
                  .filter((row) => competitionFacts.evidenceIds.includes(String(row.evidence_id)))
                  .map((row) => ({
                    asin: row.asin,
                    snapshot_id: row.snapshot_id,
                    evidence_id: row.evidence_id,
                    review_count: row.review_count,
                  })),
              },
            },
            requestId,
            traceId,
            now,
          );
        return { scoreInputsChanged, qualityBlocked, needsScore };
      };
      const waitForCost = async (code: string, payload: Record<string, unknown>) => {
        const result = await publishScores(
          null,
          [],
          fingerprint({
            formula_version: AUTOMATIC_SELECTION_FORMULA_VERSION,
            amazon_evidence: amazon.raw_evidence_id,
            competitor_evidence: competitor.evidence_id,
            missing_profit: code,
          }),
          code,
        );
        if (!result.needsScore)
          await recordSelectionPipelineCompletion(
            connection,
            { ...job, requestId, traceId },
            this.workerId,
            now,
            ownership,
          );
        return this.waiting(
          connection,
          job,
          code,
          {
            ...payload,
            ...(classificationError
              ? { supply_title_classification_error: classificationError }
              : {}),
            score_inputs_changed: result.scoreInputsChanged,
          },
          now,
        );
      };
      const [supplyRows] = await connection.query<RowDataPacket[]>(
        accountId ? accountAutomaticSupplyEvidenceSql : automaticSupplyEvidenceSql,
        accountId ? [job.opportunityId, accountId] : [job.opportunityId, job.organizationId, job.workspaceId],
      );
      const supplies = supplyFacts(supplyRows),
        supplyMatch =
          selectClassifiedSupplyQuote(
            `amazon:${String(amazon.raw_evidence_id)}`,
            amazonTitle,
            supplies,
            classification,
          ) ?? selectConservativeSupplyMatch(amazonTitle, supplies);

      if (!supplyMatch && isPhoneCase(amazonTitle)) {
        const retired = await retireUnmatchedAutomaticSupplyQuotes(connection, sourceScope);
        if (retired.length)
          await this.event(
            connection,
            job,
            "opportunity.automatic_supply_quote_retired",
            {
              revision: SUPPLY_DEVICE_FIT_REVISION,
              reason: "high_confidence_1688_match_missing",
              retired_inputs: retired,
              primary_evidence_id: String(amazon.raw_evidence_id),
            },
            requestId,
            traceId,
            now,
          );
      }
      // Product prices are source facts; category-specific fees only gate profit calculation.
      const saleChanged = await this.upsertCostInput(connection, {
          job,
          ownership,
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
        purchaseChanged = supplyMatch
          ? await this.upsertCostInput(connection, {
              job,
              ownership,
              platform: "amazon",
              type: "purchase_price",
              amount: supplyMatch.conservativePrice,
              currency: supplyMatch.item.currency,
              sourceRef: supplyMatch.item.skuId
                ? `1688:${supplyMatch.item.externalId}:sku:${supplyMatch.item.skuId}:` +
                  (supplyMatch.classification
                    ? "classified-details:v1"
                    : `p75:${supplyMatch.sampleCount}`)
                : supplyMatch.classification
                  ? `1688:${supplyMatch.item.externalId}:classified-title:v1`
                  : `1688:${supplyMatch.item.externalId}:p75:${supplyMatch.sampleCount}`,
              evidenceId: supplyMatch.item.evidenceId,
              observedAt: supplyMatch.item.observedAt,
              requestId,
              traceId,
              now,
            })
          : false;

      if (purchaseChanged && supplyMatch?.classification)
        await this.event(
          connection,
          job,
          "opportunity.supply_title_classified",
          {
            contract: "supply-title-v1",
            ...supplyMatch.classification,
            purchase_evidence_id: supplyMatch.item.evidenceId,
            matching_method: "cross_language_title_attributes",
            similarity_percent: null,
          },
          requestId,
          traceId,
          now,
        );

      if (!costRules[0])
        return await waitForCost("automatic_rules_not_active", {
          score_rule: true,
          cost_rule: false,
          market: opportunity.market,
        });
      const automaticScope = parse<{ product_family?: string }>(
        costRules[0].automatic_scope_json,
        {},
      );
      if (automaticScope.product_family !== "phone_case" || !isPhoneCase(amazonTitle))
        return await waitForCost("automatic_cost_scope_mismatch", {
          configured_product_family: automaticScope.product_family ?? null,
          market: opportunity.market,
        });

      if (!supplyMatch)
        return await waitForCost("high_confidence_1688_match_missing", {
          evaluated_supply_records: supplies.length,
          minimum_samples: 3,
          minimum_confidence: 80,
        });

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
        return await waitForCost("automatic_cost_policy_incomplete", {
          logistics_configured: logisticsConfigured,
          conversion_configured: conversionConfigured,
        });

      const [currentCostRows] = await connection.query<RowDataPacket[]>(
          "SELECT id,input_type,evidence_id,input_version,confirmation_mode,created_at FROM " +
            "opportunity_cost_inputs WHERE opportunity_id=? " +
            "AND platform='amazon' AND input_type IN ('sale_price','purchase_price') AND is_current=1",
          [job.opportunityId],
        ),
        currentCosts = new Map(currentCostRows.map((row) => [String(row.input_type), row])),
        currentSale = currentCosts.get("sale_price"),
        currentPurchase = currentCosts.get("purchase_price");
      if (!currentSale || !currentPurchase)
        return await waitForCost("automatic_cost_inputs_missing", {});
      const currentCostEvidenceIds = [currentSale.evidence_id, currentPurchase.evidence_id]
          .map((item) => text(item))
          .filter(Boolean),
        costFingerprint = fingerprint({
          formula: AUTOMATIC_SELECTION_FORMULA_VERSION,
          score_rule: scoreRule.id,
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
          "SELECT * FROM opportunity_profit_runs WHERE opportunity_id=? " +
            "AND cost_rule_id=? ORDER BY calculated_at DESC,id DESC LIMIT 1",
          [job.opportunityId, costRules[0].id],
        ),
        profitRun = profitRuns[0],
        inputsChanged = saleChanged || purchaseChanged;
      if (
        inputsChanged ||
        !profitRun ||
        date(profitRun.calculated_at).getTime() < newestCostInputAt
      ) {
        await queueAutomaticCalculationJob(connection, "profit", ownership, job.opportunityId, String(costRules[0].id), requestId, traceId, now);
        await publishScores(null, [], costFingerprint, "profit_calculation_pending");
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
        return await waitForCost("profit_calculation_incomplete", {
          missing_fields: parse(profitRun.missing_fields_json, []),
        });

      const { scoreInputsChanged, qualityBlocked, needsScore } = await publishScores(
        number(profitRun.net_margin_percent),
        currentCostEvidenceIds,
        costFingerprint,
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
      if (!needsScore)
        await recordSelectionPipelineCompletion(
          connection,
          { ...job, requestId, traceId },
          this.workerId,
          now,
          ownership,
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
    const ownerCheck = evaluationOwnerPredicate(job, "o");
    if (code === "high_confidence_1688_match_missing")
      await connection.query(
        "UPDATE opportunities o SET o.recommendation_status='insufficient_data',o.version=o.version+1,o.updated_at=? " +
          `WHERE o.id=? AND ${ownerCheck.sql} AND o.decision_status='pending' ` +
          "AND o.recommendation_status='recommend' AND EXISTS (SELECT 1 FROM opportunity_cost_inputs ci " +
          "WHERE ci.opportunity_id=o.id " +
          "AND ci.platform='amazon' AND ci.input_type='purchase_price' AND ci.is_current=1 " +
          "AND ci.confirmation_mode='automatic_evidence')",
        [now, job.opportunityId, ...ownerCheck.args],
      );
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
      ownership: CalculationOwnership;
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
      "SELECT * FROM opportunity_cost_inputs WHERE opportunity_id=? " +
        "AND platform=? AND input_type=? AND is_current=1 FOR UPDATE",
      [
        input.job.opportunityId,
        input.platform,
        input.type,
      ],
    );
    const current = currentRows[0];
    if (input.ownership && !(await calculationOwnersMatch(connection, input.ownership,
      currentRows.map(row => ["opportunity_cost_inputs", String(row.id)]), true)))
      throw new AutomaticSelectionEvaluationError("automatic_cost_input_owner_mismatch", false);
    if (current?.confirmation_mode === "human_review") return false;
    if (!(await calculationOwnersMatch(connection, input.ownership, [["raw_evidence", input.evidenceId]])))
      throw new AutomaticSelectionEvaluationError("automatic_input_evidence_owner_mismatch", false);
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
          "opportunity_id=? AND platform=? AND input_type=?",
        [
          input.job.opportunityId,
          input.platform,
          input.type,
        ],
      ),
      version = Number(versions[0]?.next_version ?? 1);
    await connection.query(
      "UPDATE opportunity_cost_inputs SET is_current=0 WHERE opportunity_id=? " +
        "AND platform=? AND input_type=? AND is_current=1",
      [
        input.job.opportunityId,
        input.platform,
        input.type,
      ],
    );
    const id = randomUUID();
    await connection.query(
      "INSERT INTO opportunity_cost_inputs (id,opportunity_id,platform," +
        "input_type,amount_value,currency,source_type,source_ref_id,evidence_id,observed_at,input_version," +
        "is_current,confirmation_mode,submitted_by,confirmed_by,request_id,trace_id,created_at) VALUES " +
        "(?,?,?,?,?,?,?,?,?,?,?,1,'automatic_evidence',?,NULL,?,?,?)",
      [
        id,
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
    await registerCalculationOwners(connection, input.ownership, [["opportunity_cost_inputs", id]]);
    return true;
  }

  private async upsertScoreInput(
    connection: PoolConnection,
    input: {
      job: EvaluationJob;
      ownership: CalculationOwnership;
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
        "SELECT * FROM opportunity_score_inputs WHERE opportunity_id=? AND dimension_code=? AND is_current=1 FOR UPDATE",
        [input.job.opportunityId, input.dimension.code],
      ),
      current = currentRows[0];
    if (input.ownership && !(await calculationOwnersMatch(connection, input.ownership,
      currentRows.map(row => ["opportunity_score_inputs", String(row.id)]), true)))
      throw new AutomaticSelectionEvaluationError("automatic_score_input_owner_mismatch", false);
    if (!(await calculationOwnersMatch(connection, input.ownership, input.evidenceIds.map(id => ["raw_evidence", id]))))
      throw new AutomaticSelectionEvaluationError("automatic_input_evidence_owner_mismatch", false);
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
    const id = randomUUID();
    await connection.query(
      "INSERT INTO opportunity_score_inputs (id,opportunity_id," +
        "dimension_code,evidence_group,score_value,source_type,source_ref_id,evidence_ids_json," +
        "missing_fields_json,observed_at,input_version,is_current,created_by,request_id,trace_id,created_at) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
      [
        id,
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
    await registerCalculationOwners(connection, input.ownership, [["opportunity_score_inputs", id]]);
    return true;
  }

  private async qualityBlocked(
    connection: PoolConnection,
    job: EvaluationJob,
    evidenceIds: string[],
    accountMode: boolean,
  ) {
    const unique = [...new Set(evidenceIds)];
    if (!unique.length) return true;
    const account = accountMode ? job.executionOwnership?.owner?.account_id : null;
    if (accountMode && !account) return true;
    const placeholders = unique.map(() => "?").join(","),
      [rows] = await connection.query<RowDataPacket[]>(
        account ? `SELECT COUNT(*) matched,COALESCE(SUM(eo.source_id IS NULL OR eto.source_id IS NULL OR e.status<>'active' OR EXISTS (
            SELECT 1 FROM data_quality_issues i WHERE i.raw_evidence_id=e.id
            AND i.status='open' AND i.severity='critical')),0) blocked FROM raw_evidence e
          LEFT JOIN account_owned_records eo ON eo.source_table='raw_evidence' AND eo.source_id=e.id AND eo.account_id=?
          LEFT JOIN collection_tasks et ON et.id=e.collection_task_id
          LEFT JOIN account_owned_records eto ON eto.source_table='collection_tasks' AND eto.source_id=et.id AND eto.account_id=eo.account_id
          WHERE e.id IN (${placeholders})`
          : `SELECT COUNT(*) blocked FROM raw_evidence e WHERE e.organization_id=? AND e.workspace_id=? ` +
            `AND e.id IN (${placeholders}) AND (e.status<>'active' OR EXISTS (SELECT 1 FROM ` +
            "data_quality_issues i WHERE i.raw_evidence_id=e.id AND i.organization_id=e.organization_id " +
            "AND i.workspace_id=e.workspace_id AND i.status='open' AND i.severity='critical'))",
        account ? [account, ...unique] : [job.organizationId, job.workspaceId, ...unique],
      );
    return (Boolean(account) && Number(rows[0]?.matched ?? 0) !== unique.length) ||
      Number(rows[0]?.blocked ?? 0) > 0;
  }

  private async complete(
    connection: PoolConnection,
    job: EvaluationJob,
    status: "waiting_evidence" | "waiting_profit" | "succeeded",
    evidenceFingerprint: string | null,
    result: Record<string, unknown>,
    now: Date,
  ) {
    const owned = Boolean(job.executionOwnership?.owner);
    const [write] = await connection.query<ResultSetHeader>(automaticEvaluationCompleteSql +
      (owned ? " AND status='leased' AND attempt_count=? AND lease_expires_at>?" : ""), [
      status,
      now,
      typeof result.error_code === "string" ? result.error_code : null,
      evidenceFingerprint,
      JSON.stringify({
        ...result,
        primary_source_support_revision: PRIMARY_SOURCE_SUPPORT_REVISION,
        supply_device_fit_revision: SUPPLY_DEVICE_FIT_REVISION,
        ...(this.supplyClassifier
          ? { supply_title_classifier_revision: SUPPLY_TITLE_CLASSIFIER_REVISION }
          : {}),
      }),
      now,
      now,
      job.opportunityId,
      this.workerId,
      ...(owned ? [job.attemptCount, this.now()] : []),
    ]);
    if (owned && write.affectedRows !== 1)
      throw new AutomaticSelectionEvaluationError("automatic_selection_lease_expired", true);
  }

  private async finishFailure(job: EvaluationJob, status: EvaluationStatus, code: string) {
    const now = this.now(),
      stored = status === "scheduled" ? "retry_scheduled" : status,
      delays = [60_000, 300_000, 900_000],
      available =
        status === "scheduled"
          ? new Date(now.getTime() + delays[Math.min(job.attemptCount - 1, 2)]!)
          : now;
    await this.pool.query(automaticEvaluationFailureSql + " AND status='leased' AND attempt_count=? AND lease_expires_at>?", [
      stored,
      now,
      available,
      code,
      now,
      job.opportunityId,
      this.workerId,
      job.attemptCount,
      now,
    ]);
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
    const ownership = job.executionOwnership;
    if (ownership?.owner) {
      const [insert] = await connection.query<ResultSetHeader>(
        "INSERT INTO opportunity_events (id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) " +
          "SELECT ?,?,'opportunity',o.id,'worker',?,?,?,?,? FROM opportunities o JOIN account_owned_records a " +
          "ON a.source_table='opportunities' AND a.source_id=o.id WHERE o.id=? AND a.account_id=?",
        [id, eventType, this.workerId, requestId, traceId, JSON.stringify(payload), now, job.opportunityId, ownership.owner.account_id],
      );
      if (insert.affectedRows !== 1)
        throw new AutomaticSelectionEvaluationError("automatic_selection_event_owner_mismatch", false);
      await registerCalculationOwners(connection, ownership, [["opportunity_events", id]]);
      return;
    }
    await appendOpportunityEvent(connection, {
      id,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType,
      resourceType: "opportunity",
      resourceId: job.opportunityId,
      actorType: "worker",
      actorId: this.workerId,
      requestId,
      traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
  }
}
