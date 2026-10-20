import type { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

type Scope = { opportunityId: string; organizationId: string; workspaceId: string };
/** Parent holds the scoped opportunity lock. Preserve facts/history and all human-confirmed costs. */
export async function retireUnmatchedAutomaticSupplyQuotes(
  connection: PoolConnection,
  scope: Scope,
) {
  const parameters = [scope.opportunityId, scope.organizationId, scope.workspaceId];
  const predicate =
    "opportunity_id=? AND organization_id=? AND workspace_id=? " +
    "AND platform='amazon' AND input_type='purchase_price' AND is_current=1 " +
    "AND source_type='automatic_crawler_evidence' AND confirmation_mode='automatic_evidence' " +
    "AND source_ref_id REGEXP '^1688:[0-9]{1,40}:p75:[0-9]+$'";
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,evidence_id,source_ref_id FROM opportunity_cost_inputs WHERE ${predicate} FOR UPDATE`,
    parameters,
  );
  if (!rows.length) return [];
  const [result] = await connection.query<ResultSetHeader>(
    `UPDATE opportunity_cost_inputs SET is_current=0 WHERE ${predicate}`,
    parameters,
  );
  if (result.affectedRows !== rows.length) throw new Error("automatic_supply_retirement_conflict");
  return rows.map((row) => ({
    input_id: String(row.id),
    evidence_id: String(row.evidence_id),
    source_ref_id: String(row.source_ref_id),
  }));
}
