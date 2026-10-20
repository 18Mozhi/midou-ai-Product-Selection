import { randomUUID } from "node:crypto";
import { readPrimarySourceContext, readPrimarySourceVerdict } from "./primary-source-support.js";
import type { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { MINIMUM_SELECTION_COMPETITORS } from "@scoutops/contracts";
import { automaticSupplyCompletionQuoteValid } from "./automatic-supply-completion-guard.js";
import {
  selectionPipelineCompletionProofSql,
  selectionCompletedCompetitorsSql,
  selectionCompletionSourceNotRejectedSql,
} from "@scoutops/database";

export const PIPELINE_COMPLETION_EVENT = "opportunity.selection_pipeline_completed";
export const PIPELINE_COMPLETION_RESOURCE = "selection_pipeline";

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
) {
  const parameters = [scope.opportunityId, scope.organizationId, scope.workspaceId];
  const [proofs] = await connection.query<RowDataPacket[]>(
    selectionPipelineCompletionProofSql,
    parameters,
  );
  const proof = proofs[0];
  if (!proof || !/^[A-Z0-9]{10}$/.test(String(proof.main_asin ?? ""))) return false;
  const sourceContext = await readPrimarySourceContext(connection, scope);
  if (
    !sourceContext ||
    sourceContext.primary_asin !== proof.main_asin ||
    sourceContext.intelligence_record_id !== proof.intelligence_record_id ||
    !(await readPrimarySourceVerdict(connection, scope, sourceContext))?.supported
  )
    return false;
  if (!(await automaticSupplyCompletionQuoteValid(connection, parameters, proof))) return false;
  const [prior] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM opportunity_events completion_prior WHERE organization_id=? AND workspace_id=? " +
      "AND resource_type=? AND resource_id=? AND event_type=? " +
      "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.main_asin'))=BINARY ? AND " +
      selectionCompletionSourceNotRejectedSql("completion_prior") +
      " LIMIT 1 FOR UPDATE",
    [
      scope.organizationId,
      scope.workspaceId,
      PIPELINE_COMPLETION_RESOURCE,
      scope.opportunityId,
      PIPELINE_COMPLETION_EVENT,
      proof.main_asin,
    ],
  );
  if (prior[0]) return false;
  const [rows] = await connection.query<RowDataPacket[]>(
    selectionCompletedCompetitorsSql,
    parameters,
  );
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
  const [result] = await connection.query<ResultSetHeader>(
    "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type,resource_type," +
      "resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) " +
      "VALUES (?,?,?,?,?,?,'worker',?,?,?,?,?)",
    [
      randomUUID(),
      scope.organizationId,
      scope.workspaceId,
      PIPELINE_COMPLETION_EVENT,
      PIPELINE_COMPLETION_RESOURCE,
      scope.opportunityId,
      workerId,
      scope.requestId,
      scope.traceId,
      JSON.stringify(payload),
      now,
    ],
  );
  return result.affectedRows === 1;
}
