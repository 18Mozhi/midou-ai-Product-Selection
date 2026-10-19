import type { Pool, RowDataPacket } from "mysql2/promise";

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
  scope: { organizationId: string; workspaceId: string },
  opportunityIds: string[],
): Promise<Map<string, AutomaticPurchasePrice>> {
  const result = new Map<string, AutomaticPurchasePrice>();
  if (!opportunityIds.length) return result;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT ci.opportunity_id,ci.id,ci.amount_value,ci.currency,ci.observed_at," +
      "ci.evidence_id,ci.source_ref_id FROM opportunity_cost_inputs ci " +
      "WHERE ci.organization_id=? AND ci.workspace_id=? AND ci.platform='amazon' " +
      "AND ci.input_type='purchase_price' AND ci.is_current=1 " +
      "AND ci.confirmation_mode='automatic_evidence' AND ci.amount_value>0 AND ci.currency='CNY' " +
      `AND ci.opportunity_id IN (${opportunityIds.map(() => "?").join(",")}) ` +
      "AND EXISTS (SELECT 1 FROM normalized_records n JOIN providers p ON p.id=n.provider_id " +
      "AND p.code='1688_search' JOIN collection_task_evidence_links l ON l.normalized_record_id=n.id " +
      "AND l.raw_evidence_id=n.raw_evidence_id AND l.organization_id=n.organization_id " +
      "AND l.workspace_id=n.workspace_id JOIN sourcing_searches ss ON ss.collection_task_id=l.collection_task_id " +
      "AND ss.organization_id=n.organization_id AND ss.workspace_id=n.workspace_id " +
      "AND ss.input_type='opportunity' AND ss.deleted_at IS NULL " +
      "WHERE ss.input_ref=ci.opportunity_id AND n.raw_evidence_id=ci.evidence_id AND n.organization_id=ci.organization_id " +
      "AND n.workspace_id=ci.workspace_id AND n.status='active') " +
      "ORDER BY ci.input_version DESC,ci.created_at DESC,ci.id DESC",
    [scope.organizationId, scope.workspaceId, ...opportunityIds],
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
