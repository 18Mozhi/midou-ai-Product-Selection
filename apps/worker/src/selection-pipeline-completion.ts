import { opportunityEventReadRelation, trendTopicEventReadRelation } from "@scoutops/database";
import { appendOpportunityEvent } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import { calculationOwnersMatch, registerCalculationOwners, type CalculationOwnership } from "./opportunity-calculation-ownership.js";
import { readPrimarySourceContext, readPrimarySourceVerdict } from "./primary-source-support.js";
import type { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { MINIMUM_SELECTION_COMPETITORS } from "@scoutops/contracts";
import { automaticSupplyCompletionQuoteValid } from "./automatic-supply-completion-guard.js";
import {
  selectionPipelineCompletionProofSql,
  selectionCompletedCompetitorsSql,
  selectionCompletionSourceNotRejectedSql,
  selectionPrimaryAsinSql,
  accountCompetitorClassificationScopeProof,
} from "@scoutops/database";
import { hasNativeNormalizedAccountScope, readAutomaticPrimaryEvidence, primaryProductEvidence } from "./automatic-selection-evidence.js";
import { normalizedProductFields } from "./automatic-selection-evaluation.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";

export const PIPELINE_COMPLETION_EVENT = "opportunity.selection_pipeline_completed";
export const PIPELINE_COMPLETION_RESOURCE = "selection_pipeline";

export const accountSelectionPipelineCompletionProofSql = selectionPipelineCompletionProofSql.replace(
  "JOIN sourcing_searches ss ON ss.collection_task_id=sl.collection_task_id AND ss.organization_id=o.organization_id " +
    "AND ss.workspace_id=o.workspace_id AND ss.input_type='opportunity'",
  "JOIN sourcing_searches ss ON ss.collection_task_id=sl.collection_task_id AND ss.input_type='opportunity' " +
    "AND sl.provider_id=supply.provider_id " +
    "AND EXISTS (SELECT 1 FROM account_owned_records so WHERE so.source_table='sourcing_searches' AND so.source_id=ss.id AND so.account_id=?) " +
    "AND EXISTS (SELECT 1 FROM account_owned_records cto WHERE cto.source_table='collection_tasks' AND cto.source_id=t_supply.id AND cto.account_id=?) " +
    "AND EXISTS (SELECT 1 FROM collection_subqueries sq JOIN account_owned_records qo ON qo.source_table='collection_subqueries' " +
    "AND qo.source_id=sq.id AND qo.account_id=? WHERE sq.id=sl.collection_subquery_id AND sq.task_id=t_supply.id AND sq.provider_id=supply.provider_id) " +
    "AND EXISTS (SELECT 1 FROM account_owned_records lo WHERE lo.source_table='collection_task_evidence_links' AND lo.source_id=sl.id AND lo.account_id=?)",
);

const owns = (table: string, id: string, account: string) =>
  `EXISTS (SELECT 1 FROM account_owned_records a WHERE a.source_table='${table}' AND a.source_id=${id} AND a.account_id=${account})`;

export const nativeAccountSelectionPipelineCompletionProofSql = accountSelectionPipelineCompletionProofSql
  .replace(selectionPrimaryAsinSql, "CAST(? AS CHAR(10) CHARACTER SET ascii)")
  .replace("AND supply.organization_id=o.organization_id AND supply.workspace_id=o.workspace_id ",
    "AND supply.account_id=completion_owner.account_id ")
  .replace("AND news.organization_id=o.organization_id AND news.workspace_id=o.workspace_id ",
    "AND news.account_id=completion_owner.account_id ")
  .replace("FROM opportunities o JOIN opportunity_score_runs",
    "FROM opportunities o JOIN account_owned_records completion_owner ON completion_owner.source_table='opportunities' AND completion_owner.source_id=o.id JOIN opportunity_score_runs")
  .replace("WHERE o.id=? AND o.organization_id=? AND o.workspace_id=?",
    `WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? AND completion_owner.account_id=?
    AND ${owns("opportunity_evidence_links", "nl.id", "completion_owner.account_id")}
    AND ${owns("trend_events", "ie.id", "completion_owner.account_id")}
    AND ${owns("trend_topics", "ie.resource_id", "completion_owner.account_id")}
    AND EXISTS (SELECT 1 FROM raw_evidence er JOIN collection_tasks nt ON nt.id=er.collection_task_id
      WHERE er.id=news.raw_evidence_id AND er.provider_id=news.provider_id AND er.account_id=news.account_id
      AND nt.organization_id=o.organization_id AND nt.workspace_id=o.workspace_id
      AND ${owns("collection_tasks", "nt.id", "completion_owner.account_id")})
    AND EXISTS (SELECT 1 FROM raw_evidence er JOIN collection_tasks sr_origin ON sr_origin.id=er.collection_task_id
      WHERE er.id=supply.raw_evidence_id AND er.provider_id=supply.provider_id AND er.account_id=supply.account_id
      AND sr_origin.organization_id=o.organization_id AND sr_origin.workspace_id=o.workspace_id
      AND ${owns("collection_tasks", "sr_origin.id", "completion_owner.account_id")})`);

// Only the old event-coordinate projection is dropped. The source event, latest
// pointer, score run and original quote/evidence IDs remain exact.
export const accountOnlySelectionPipelineCompletionProofSql = nativeAccountSelectionPipelineCompletionProofSql
  .replaceAll(trendTopicEventReadRelation, "trend_events")
  .replace("AND t_supply.organization_id=o.organization_id AND t_supply.workspace_id=o.workspace_id",
    "AND t_supply.account_id=completion_owner.account_id")
  .replace("ie ON ie.organization_id=o.organization_id AND ie.workspace_id=o.workspace_id ",
    "ie ON ie.resource_id=o.source_ref_id ")
  .replace("WHERE newer_primary.organization_id=ie.organization_id AND newer_primary.workspace_id=ie.workspace_id AND",
    `WHERE ${owns("trend_events", "newer_primary.id", "completion_owner.account_id")} AND`)
  .replace("JOIN normalized_records news", "JOIN trend_topics topic ON topic.id=ie.resource_id AND topic.account_id=completion_owner.account_id " +
    "JOIN normalized_records news")
  .replace("o.id=? AND o.organization_id=? AND o.workspace_id=? AND completion_owner.account_id=?",
    `o.id=? AND o.account_id=completion_owner.account_id AND completion_owner.account_id=?
    AND ${owns("opportunity_score_runs", "sr.id", "completion_owner.account_id")}
    AND ${owns("opportunity_score_components", "cost_score.id", "completion_owner.account_id")}
    AND ${owns("opportunity_cost_inputs", "ci.id", "completion_owner.account_id")}`)
  .replace("nt.organization_id=o.organization_id AND nt.workspace_id=o.workspace_id",
    "nt.account_id=completion_owner.account_id")
  .replace("sr_origin.organization_id=o.organization_id AND sr_origin.workspace_id=o.workspace_id",
    "sr_origin.account_id=completion_owner.account_id");

const nativeAccountCompletedCompetitorsSql = selectionCompletedCompetitorsSql
  .replaceAll(selectionPrimaryAsinSql, "verified.primary_asin")
  .replace("FROM opportunities o,", "FROM opportunities o CROSS JOIN (SELECT CAST(? AS CHAR(10) CHARACTER SET ascii) primary_asin,CAST(? AS CHAR(36) CHARACTER SET ascii) account_id) verified CROSS JOIN ")
  .replaceAll("AND n_detail.organization_id=t_detail.organization_id AND n_detail.workspace_id=t_detail.workspace_id ", "")
  .replace("AND n_relation.organization_id=t_relation.organization_id AND n_relation.workspace_id=t_relation.workspace_id ", "")
  .replaceAll(/WHERE LEFT\(s(?:_sample)?\.source_ref_id,11\)='collection:'/g, match =>
    `WHERE ${nativeCompetitorEvidenceProof("detail")} AND ${match.slice(6)}`)
  .replace("WHERE e_relation.resource_id=o.id", `WHERE ${nativeCompetitorEvidenceProof("relation")} AND e_relation.resource_id=o.id`)
  .replace("AND o.id=? AND o.organization_id=? AND o.workspace_id=?", `AND o.id=? AND o.organization_id=? AND o.workspace_id=?
    AND ${owns("opportunities", "o.id", "verified.account_id")}
    AND ${owns("competitors", "c_sample.id", "verified.account_id")}
    AND ${owns("competitor_snapshots", "s_sample.id", "verified.account_id")}
    AND ${owns("raw_evidence", "s_sample.evidence_id", "verified.account_id")}`);

function nativeCompetitorEvidenceProof(kind: "detail" | "relation") {
  const n = `n_${kind}`, l = `l_${kind}`, t = `t_${kind}`;
  return `${n}.account_id=verified.account_id
    AND ${owns("normalized_records", `${n}.id`, "verified.account_id")}
    AND ${owns("collection_task_evidence_links", `${l}.id`, "verified.account_id")}
    AND ${owns("collection_tasks", `${t}.id`, "verified.account_id")}
    AND ${owns("collection_subqueries", `q_${kind}.id`, "verified.account_id")}
    AND ${owns("raw_evidence", `${l}.raw_evidence_id`, "verified.account_id")}
    AND EXISTS (SELECT 1 FROM raw_evidence er JOIN collection_tasks origin_t ON origin_t.id=er.collection_task_id
      WHERE er.id=${l}.raw_evidence_id AND er.provider_id=${n}.provider_id AND er.account_id=verified.account_id
        AND origin_t.organization_id=${t}.organization_id AND origin_t.workspace_id=${t}.workspace_id
        AND ${owns("collection_tasks", "origin_t.id", "verified.account_id")})`;
}

const accountOnlyCompletedCompetitorsSql = accountCompetitorClassificationScopeProof(nativeAccountCompletedCompetitorsSql
  // All binds precede URL regexes: mysql2's text formatter also matches
  // question marks inside string literals.
  .replace("account_id) verified CROSS JOIN ",
    "account_id,CAST(? AS CHAR(36) CHARACTER SET ascii) opportunity_id) verified " +
    "JOIN account_ownership_cutover proof_cut ON proof_cut.slot='current' AND proof_cut.contract_version=25 " +
    "LEFT JOIN account_retirement_records sealed ON sealed.run_id=proof_cut.source_run_id AND sealed.source_table='opportunities' " +
    "AND sealed.source_id=o.id CROSS JOIN ")
  .replace("AND o.id=? AND o.organization_id=? AND o.workspace_id=?",
    "AND o.id=verified.opportunity_id AND o.account_id=verified.account_id")
  .replace("c_sample.organization_id=o.organization_id AND c_sample.workspace_id=o.workspace_id",
    "c_sample.account_id=verified.account_id")
  .replaceAll("AND c_detail.organization_id=t_detail.organization_id AND c_detail.workspace_id=t_detail.workspace_id ",
    "AND l_detail.collection_subquery_id=q_detail.id AND n_detail.provider_id=l_detail.provider_id " +
    "AND l_detail.provider_id=q_detail.provider_id ")
  .replaceAll("WHERE n_detail.account_id=verified.account_id",
    `WHERE n_detail.account_id=verified.account_id AND c_detail.account_id=verified.account_id
    AND t_detail.account_id=verified.account_id AND ${owns("competitors", "c_detail.id", "verified.account_id")}`)
  .replace("WHERE n_relation.account_id=verified.account_id",
    `WHERE n_relation.account_id=verified.account_id AND t_relation.account_id=verified.account_id
    AND ${owns("opportunity_events", "e_relation.id", "verified.account_id")}`)
  .replaceAll(/origin_t\.organization_id=t_(detail|relation)\.organization_id AND origin_t\.workspace_id=t_(detail|relation)\.workspace_id/g,
    "origin_t.account_id=verified.account_id")
  .replaceAll(opportunityEventReadRelation, "opportunity_events")
  .replace("e_relation ON e_relation.organization_id=t_relation.organization_id AND e_relation.workspace_id=t_relation.workspace_id AND ",
    "e_relation ON ")
  .replace("t_relation.organization_id=o.organization_id AND t_relation.workspace_id=o.workspace_id",
    "q_relation.task_id=t_relation.id")
  .replace("latest_relation.organization_id=e_relation.organization_id AND latest_relation.workspace_id=e_relation.workspace_id",
    owns("opportunity_events", "latest_relation.id", "verified.account_id"))
  .replace("newer_relation.organization_id=e_relation.organization_id AND newer_relation.workspace_id=e_relation.workspace_id",
    owns("opportunity_events", "newer_relation.id", "verified.account_id")), {
  account:"verified.account_id", legacyOrg:"sealed.legacy_org_id", legacyWorkspace:"sealed.legacy_workspace_id",
  fresh:"sealed.source_id IS NULL AND o.created_at>proof_cut.created_at",
});

export function completedCompetitorRead(parameters: string[], native?: { account: string; asin: string; accountParent?: boolean }, reviews = false) {
  const sql = native?.accountParent ? accountOnlyCompletedCompetitorsSql :
    native ? nativeAccountCompletedCompetitorsSql : selectionCompletedCompetitorsSql;
  return {
    sql: reviews ? sql.replace("s_sample.id snapshot_id,s_sample.evidence_id FROM",
      "s_sample.id snapshot_id,s_sample.review_count,s_sample.evidence_id FROM") : sql,
    args: native ? [native.asin, native.account, ...(native.accountParent ? parameters.slice(0, 1) : parameters)] : parameters,
  };
}

export type CompletionScope = {
  opportunityId: string;
  organizationId: string;
  workspaceId: string;
  requestId: string;
  traceId: string;
};

/** Called while the parent worker holds its scoped opportunity lock and transaction. */
export async function recordSelectionPipelineCompletion(
  connection: PoolConnection,
  scope: CompletionScope,
  workerId: string,
  now: Date,
  ownership: CalculationOwnership = null,
) {
  const account = ownership?.owner?.account_id;
  if (ownership && !account) return false;
  const parameters = [scope.opportunityId, scope.organizationId, scope.workspaceId];
  let native: { account: string; asin: string; accountParent?: boolean } | undefined;
  let accountParent = false;
  if (account && await hasNativeNormalizedAccountScope(connection)) {
    const { linked } = await readAutomaticPrimaryEvidence(connection, { ...scope, accountId: account });
    try {
      const payload = typeof linked?.payload_json === "string" ? JSON.parse(linked.payload_json) : linked?.payload_json;
      const asin = String(normalizedProductFields(payload ?? {}).asin ?? "").toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(asin)) return false;
      native = { account, asin };
    } catch { return false; }
    accountParent = await nativeOpportunityStorage(connection);
    native.accountParent = accountParent;
  }
  const [proofs] = await connection.query<RowDataPacket[]>(
    accountParent ? accountOnlySelectionPipelineCompletionProofSql :
      native ? nativeAccountSelectionPipelineCompletionProofSql : account ? accountSelectionPipelineCompletionProofSql : selectionPipelineCompletionProofSql,
    native ? [native.asin, account,account,account,account,...(accountParent ? [scope.opportunityId] : parameters), account]
      : account ? [account,account,account,account,...parameters] : parameters,
  );
  const proof = proofs[0];
  if (!proof || !/^[A-Z0-9]{10}$/.test(String(proof.main_asin ?? ""))) return false;
  if (ownership && !(await calculationOwnersMatch(connection, ownership, [
    ["opportunity_score_runs",String(proof.score_run_id)],
    ["normalized_records",String(proof.intelligence_record_id)],
    ["raw_evidence",String(proof.intelligence_evidence_id)],
    ["opportunity_cost_inputs",String(proof.purchase_input_id)],
    ["normalized_records",String(proof.supply_record_id)],
    ["raw_evidence",String(proof.supply_evidence_id)],
  ]))) return false;
  const sourceScope = account ? { ...scope, accountId: account } : scope;
  const sourceContext = await readPrimarySourceContext(connection, sourceScope);
  if (
    !sourceContext ||
    sourceContext.primary_asin !== proof.main_asin ||
    sourceContext.intelligence_record_id !== proof.intelligence_record_id ||
    !(await readPrimarySourceVerdict(connection, sourceScope, sourceContext))?.supported
  )
    return false;
  if (!(await automaticSupplyCompletionQuoteValid(connection, parameters, proof, ownership))) return false;
  const [prior] = await connection.query<RowDataPacket[]>(
    (account
      ? "SELECT completion_prior.id FROM opportunity_events completion_prior JOIN account_owned_records a " +
        "ON a.source_table='opportunity_events' AND a.source_id=completion_prior.id WHERE a.account_id=? "
      : "SELECT id FROM " + opportunityEventReadRelation + " completion_prior WHERE organization_id=? AND workspace_id=? ") +
      "AND resource_type=? AND resource_id=? AND event_type=? " +
      "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.main_asin'))=BINARY ? AND " +
      selectionCompletionSourceNotRejectedSql("completion_prior", account ? "a.account_id" : undefined) +
      " LIMIT 1 FOR UPDATE",
    [
      ...(account ? [account] : [scope.organizationId, scope.workspaceId]),
      PIPELINE_COMPLETION_RESOURCE,
      scope.opportunityId,
      PIPELINE_COMPLETION_EVENT,
      proof.main_asin,
    ],
  );
  if (prior[0]) return false;
  const competition = completedCompetitorRead(parameters, native);
  const [rows] = await connection.query<RowDataPacket[]>(competition.sql, competition.args);
  const unique = new Map<
    string,
    { asin: string; competitor_id: string; snapshot_id: string; evidence_id: string }
  >();
  for (const row of rows) {
    const asin = String(row.asin ?? "").toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin) || asin === proof.main_asin || unique.has(asin)) continue;
    if (!row.competitor_id || !row.snapshot_id || !row.evidence_id) continue;
    unique.set(asin, {
      asin,
      competitor_id: String(row.competitor_id),
      snapshot_id: String(row.snapshot_id),
      evidence_id: String(row.evidence_id),
    });
    if (unique.size === 10) break;
  }
  if (unique.size < MINIMUM_SELECTION_COMPETITORS) return false;
  if (ownership && !(await calculationOwnersMatch(connection, ownership, [...unique.values()].flatMap(item => [
    ["competitors",item.competitor_id] as const, ["competitor_snapshots",item.snapshot_id] as const,
    ["raw_evidence",item.evidence_id] as const,
  ])))) return false;
  if (
    proof.overall_score == null ||
    [
      "score_run_id",
      "intelligence_record_id",
      "intelligence_evidence_id",
      "purchase_input_id",
      "supply_record_id",
      "supply_evidence_id",
      "supply_offer_id",
    ].some((field) => typeof proof[field] !== "string" || !proof[field].trim())
  )
    return false;
  const price = Number(proof.purchase_price);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(Number(proof.overall_score)))
    return false;
  const parseMissing = (value: unknown): string[] | null => {
    try {
      const result = typeof value === "string" ? JSON.parse(value) : value;
      return Array.isArray(result) && result.every((item) => typeof item === "string")
        ? result
        : null;
    } catch {
      return null;
    }
  };
  const profitState = String(proof.profit_state),
    missingFields = parseMissing(proof.score_missing_fields_json),
    profitMissingFields = parseMissing(proof.profit_missing_fields_json),
    coverage = Number(proof.score_coverage_percent);
  if (
    !["calculated", "unknown"].includes(profitState) ||
    !missingFields ||
    !profitMissingFields ||
    !Number.isFinite(coverage) ||
    coverage < 0 ||
    coverage > 100 ||
    (profitState === "unknown" &&
      (!profitMissingFields.length ||
        !profitMissingFields.every((item) => missingFields.includes(item)) ||
        coverage < 80 ||
        !["insufficient_data", "observe", "not_recommend"].includes(
          String(proof.recommendation_status),
        )))
  )
    return false;
  const payload = {
    contract: "selection-pipeline-v2",
    analysis_status: profitState === "unknown" ? "complete_with_unknown_profit" : "complete",
    profit_status: profitState,
    score_coverage_percent: coverage,
    score_missing_fields: missingFields,
    profit_missing_fields: profitMissingFields,
    main_asin: String(proof.main_asin),
    opportunity_id: scope.opportunityId,
    score_run_id: String(proof.score_run_id),
    overall_score: Number(proof.overall_score),
    recommendation_status: String(proof.recommendation_status),
    intelligence_record_id: String(proof.intelligence_record_id),
    intelligence_evidence_id: String(proof.intelligence_evidence_id),
    competitors: [...unique.values()],
    purchase_input_id: String(proof.purchase_input_id),
    purchase_price: price,
    purchase_currency: String(proof.purchase_currency),
    supply_record_id: String(proof.supply_record_id),
    supply_evidence_id: String(proof.supply_evidence_id),
    supply_offer_id: String(proof.supply_offer_id),
    completed_at: now.toISOString(),
  };
  const eventId = randomUUID();
  if (account) {
    const [result] = await connection.query<ResultSetHeader>(
      "INSERT INTO opportunity_events (id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) " +
      "SELECT ?,?,'selection_pipeline',o.id,'worker',?,?,?,?,? FROM opportunities o JOIN account_owned_records a " +
      "ON a.source_table='opportunities' AND a.source_id=o.id WHERE o.id=? AND a.account_id=?",
      [eventId, PIPELINE_COMPLETION_EVENT, workerId, scope.requestId, scope.traceId, JSON.stringify(payload), now, scope.opportunityId, account],
    );
    if (result.affectedRows !== 1) throw new Error("selection_pipeline_parent_owner_mismatch");
    await registerCalculationOwners(connection, ownership, [["opportunity_events", eventId]]);
    return true;
  }
  const [result] = await appendOpportunityEvent(connection, {
    id: eventId,
    organizationId: scope.organizationId,
    workspaceId: scope.workspaceId,
    eventType: PIPELINE_COMPLETION_EVENT,
    resourceType: PIPELINE_COMPLETION_RESOURCE,
    resourceId: scope.opportunityId,
    actorType: "worker",
    actorId: workerId,
    requestId: scope.requestId,
    traceId: scope.traceId,
    payloadJson: JSON.stringify(payload),
    occurredAt: now,
  });
  if (result.affectedRows === 1)
    await registerCalculationOwners(connection, ownership, [["opportunity_events",eventId]]);
  return result.affectedRows === 1;
}
