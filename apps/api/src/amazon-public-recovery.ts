import type { Pool, RowDataPacket } from "mysql2/promise";
import type { ProviderProbeContext } from "./provider-adapter-service.js";
import type { PublicSourceRecoveryTarget } from "./public-rss-recovery.js";

/** Only the configured system actor's actual pending Amazon work supplies probe scope. */
export const amazonPublicRecoveryCandidatesSql =
  "SELECT p.id,p.version,c.opened_at,t.id collection_task_id FROM providers p " +
  "JOIN users recovery_actor ON recovery_actor.id=? AND recovery_actor.status='active' " +
  "JOIN provider_runtime_circuits c ON c.provider_id=p.id AND c.state='open' " +
  "LEFT JOIN provider_adapter_health h ON h.provider_id=p.id " +
  "JOIN collection_subqueries q ON q.provider_id=p.id " +
  "JOIN collection_tasks t ON t.id=q.task_id AND t.organization_id=q.organization_id " +
  "AND t.workspace_id=q.workspace_id AND t.created_by=recovery_actor.id " +
  "JOIN organizations o ON o.id=t.organization_id AND o.status='active' " +
  "JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=t.organization_id AND w.status='active' " +
  "WHERE p.code='amazon_product' AND p.access_mode='public_page' AND p.status='enabled' " +
  "AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0 " +
  "AND (p.terms_permanent=1 OR p.terms_expires_at>?) " +
  "AND t.status IN ('scheduled','queued','retry_scheduled','rate_limited') " +
  "AND c.last_error_code IN ('network_error','timeout','rate_limited') AND c.opened_at<=? " +
  "AND (h.last_checked_at IS NULL OR h.last_checked_at<=?) " +
  "AND COALESCE(h.health_status='blocked' AND h.last_checked_at>=c.opened_at,0)=0 " +
  "ORDER BY t.created_at,t.id LIMIT 1";

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
