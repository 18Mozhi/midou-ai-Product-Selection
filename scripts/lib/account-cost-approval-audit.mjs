import { createHash } from "node:crypto";

// 0080 renames a live slot and 0081 removes duplicate coordinates. Neither
// operation may change the original decision, signer, reason or trace.
export async function readAccountCostApprovalAudit(connection) {
  const [rows] = await connection.query(
    "SELECT id,cost_rule_id,approval_role,decision,reason,actor_id,request_id,trace_id,created_at " +
      "FROM cost_rule_approvals ORDER BY id",
  );
  const roles = rows.map(({ approval_role }) => approval_role).sort();
  const normalized = rows.map(({ approval_role, ...row }) => ({
    ...row,
    approval_role: approval_role === "organization_admin" ? "primary_account" : approval_role,
  }));
  return {
    count: rows.length,
    roles,
    sha256: createHash("sha256").update(JSON.stringify(normalized)).digest("hex"),
  };
}
