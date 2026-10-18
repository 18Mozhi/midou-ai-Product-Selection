import type { Pool, RowDataPacket } from "mysql2/promise";
import type { ProviderProbeContext } from "./provider-adapter-service.js";
import { pendingTaskRecoveryCandidatesSql } from "./pending-source-recovery-policy.js";
import type { PublicSourceRecoveryTarget } from "./public-rss-recovery.js";

/** Only the configured system actor's actual pending Amazon work supplies probe scope. */
export const amazonPublicRecoveryCandidatesSql = pendingTaskRecoveryCandidatesSql("amazon_product");

export const amazonPublicRecoveryTarget: PublicSourceRecoveryTarget = {
  candidatesSql: amazonPublicRecoveryCandidatesSql,
  parameters: (actorId, now, cooledAt) => [actorId, now, cooledAt, cooledAt],
  taskContext: true,
  idempotencyPrefix: "amazon-public-recovery",
};

/** Recheck before creating any health lease; no user login or tenant guess is needed. */
export const amazonPublicRecoveryScopeSql =
  "SELECT t.organization_id,t.workspace_id FROM collection_tasks t " +
  "JOIN users u ON u.id=t.created_by AND u.status='active' " +
  "JOIN organizations o ON o.id=t.organization_id AND o.status='active' " +
  "JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=t.organization_id AND w.status='active' " +
  "JOIN collection_subqueries q ON q.task_id=t.id AND q.organization_id=t.organization_id AND q.workspace_id=t.workspace_id " +
  "JOIN providers p ON p.id=q.provider_id AND p.code='amazon_product' AND p.access_mode='public_page' AND p.status='enabled' " +
  "WHERE t.id=? AND t.created_by=? AND t.status IN ('scheduled','queued','retry_scheduled','rate_limited') LIMIT 1";

export async function resolveAmazonPublicRecoveryScope(
  pool: Pool,
  systemActorId: string,
  context: ProviderProbeContext,
) {
  if (
    !systemActorId ||
    context.actorId !== systemActorId ||
    !/^[0-9a-f-]{36}$/i.test(context.automaticCollectionTaskId ?? "")
  )
    throw new Error("selected_scope_required");
  const [rows] = await pool.query<RowDataPacket[]>(amazonPublicRecoveryScopeSql, [
    context.automaticCollectionTaskId,
    systemActorId,
  ]);
  if (!rows[0]) throw new Error("automatic_recovery_scope_unavailable");
  return {
    organizationId: String(rows[0].organization_id),
    workspaceId: String(rows[0].workspace_id),
  };
}
