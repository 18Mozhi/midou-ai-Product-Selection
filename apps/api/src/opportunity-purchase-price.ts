import type { Pool, RowDataPacket } from "mysql2/promise";
import { rehearsalOwns } from "./account-read-rehearsal.js";

const priceOwns = (table: string, id: string) => rehearsalOwns(table, id, "co.account_id");
const ownedPriceSourceSql =
  "(EXISTS (SELECT 1 FROM sourcing_searches ss WHERE ss.collection_task_id=link_task.id " +
  "AND ss.input_type='opportunity' AND ss.input_ref=ci.opportunity_id AND ss.deleted_at IS NULL " +
  `AND ${priceOwns("sourcing_searches", "ss.id")}) OR ` +
  // Historic rule discovery had no sourcing search; use the original subquery and
  // exact persisted rule match, never a similar title, price, or inferred search.
  "EXISTS (SELECT 1 FROM collection_subqueries sq JOIN opportunity_rule_matches rm " +
  "ON BINARY rm.monitoring_rule_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(sq.target_json,'$.monitoring_rule_id')) " +
  "WHERE sq.id=l.collection_subquery_id AND sq.task_id=link_task.id AND sq.provider_id=n.provider_id " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(sq.target_json,'$.projection_type'))='rule_product_discovery' " +
  "AND rm.opportunity_id=ci.opportunity_id " +
  `AND ${priceOwns("collection_subqueries", "sq.id")} AND ${priceOwns("opportunity_rule_matches", "rm.id")} AND ${priceOwns("trend_monitoring_rules", "rm.monitoring_rule_id")}))`;

export interface AutomaticPurchasePrice {
  id: string;
  amount_value: number;
  currency: "CNY";
  observed_at: string;
  evidence_id: string;
  source_ref_id: string;
}

/** Only already selected current automatic 1688 inputs; candidate prices are never inferred. */
export async function readOpportunityPurchasePrices(
  pool: Pool,
  scope: { organizationId: string; workspaceId: string } | { accountId: string },
  opportunityIds: string[],
): Promise<Map<string, AutomaticPurchasePrice>> {
  const result = new Map<string, AutomaticPurchasePrice>();
  if (!opportunityIds.length) return result;
  const account = "accountId" in scope;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT ci.opportunity_id,ci.id,ci.amount_value,ci.currency,ci.observed_at," +
      "ci.evidence_id,ci.source_ref_id FROM opportunity_cost_inputs ci JOIN opportunities op ON op.id=ci.opportunity_id " +
      (account
        ? "JOIN account_owned_records co ON co.source_table='opportunity_cost_inputs' AND co.source_id=ci.id "
        : "") +
      "WHERE ci.platform='amazon' " +
      (account
        ? `AND co.account_id=? AND ${rehearsalOwns("opportunities", "ci.opportunity_id", "co.account_id")} AND ${rehearsalOwns("raw_evidence", "ci.evidence_id", "co.account_id")} `
        : "AND op.organization_id=? AND op.workspace_id=? ") +
      "AND ci.input_type='purchase_price' AND ci.is_current=1 " +
      "AND ci.confirmation_mode='automatic_evidence' AND ci.amount_value>0 AND ci.currency='CNY' " +
      `AND ci.opportunity_id IN (${opportunityIds.map(() => "?").join(",")}) ` +
      "AND EXISTS (SELECT 1 FROM normalized_records n JOIN providers p ON p.id=n.provider_id " +
      "AND p.code='1688_search' JOIN collection_task_evidence_links l ON l.normalized_record_id=n.id " +
      "AND l.raw_evidence_id=n.raw_evidence_id JOIN collection_tasks link_task ON link_task.id=l.collection_task_id " +
      (account ? "" : "AND link_task.organization_id=n.organization_id AND link_task.workspace_id=n.workspace_id ") +
      (account ? "" :
        "JOIN sourcing_searches ss ON ss.collection_task_id=l.collection_task_id " +
        "AND ss.organization_id=n.organization_id AND ss.workspace_id=n.workspace_id " +
        "AND ss.input_type='opportunity' AND ss.deleted_at IS NULL ") +
      "WHERE n.raw_evidence_id=ci.evidence_id AND n.status='active'" +
      (account
        ? ` AND ${priceOwns("normalized_records", "n.id")} AND ${priceOwns("collection_task_evidence_links", "l.id")} AND ${priceOwns("collection_tasks", "link_task.id")} AND ${ownedPriceSourceSql}`
        : " AND ss.input_ref=ci.opportunity_id AND n.organization_id=op.organization_id AND n.workspace_id=op.workspace_id") +
      ") " +
      "ORDER BY ci.input_version DESC,ci.created_at DESC,ci.id DESC",
    [
      ...(account ? [scope.accountId] : [scope.organizationId, scope.workspaceId]),
      ...opportunityIds,
    ],
  );
  for (const row of rows) {
    const id = String(row.opportunity_id),
      amount = Number(row.amount_value);
    if (result.has(id) || !opportunityIds.includes(id) || !Number.isFinite(amount) || amount <= 0)
      continue;
    result.set(id, {
      id: String(row.id),
      amount_value: amount,
      currency: "CNY",
      observed_at: new Date(row.observed_at).toISOString(),
      evidence_id: String(row.evidence_id),
      source_ref_id: String(row.source_ref_id),
    });
  }
  return result;
}
