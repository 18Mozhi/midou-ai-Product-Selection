import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { activeCollectionScopeSql } from "./collection-source-scheduling-policy.js";

/** One-time scoped correction of proven historical-version false negatives; no new collection. */
export const intelligenceProvenanceRecoveryFromSql =
  " FROM trend_projection_jobs " +
  "JOIN normalized_records n ON n.id=trend_projection_jobs.normalized_record_id " +
  "AND n.organization_id=trend_projection_jobs.organization_id AND n.workspace_id=trend_projection_jobs.workspace_id " +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
  "JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.organization_id=n.organization_id AND e.workspace_id=n.workspace_id " +
  "JOIN collection_subqueries q ON q.id=e.collection_subquery_id AND q.organization_id=n.organization_id AND q.workspace_id=n.workspace_id " +
  "JOIN collection_tasks t ON t.id=q.task_id AND t.organization_id=n.organization_id AND t.workspace_id=n.workspace_id " +
  "JOIN normalized_records original ON original.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.intelligence_source_record_id')) USING ascii) COLLATE ascii_general_ci " +
  "AND original.organization_id=n.organization_id AND original.workspace_id=n.workspace_id AND original.status='superseded' " +
  "JOIN trend_events history ON history.organization_id=original.organization_id AND history.workspace_id=original.workspace_id " +
  "AND history.event_type='trend.intelligence.associated' AND history.actor_type='worker' AND history.resource_type='trend_topic' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(history.payload_json,'$.normalized_record_id'))=BINARY original.id " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(history.payload_json,'$.contract'))='intelligence-product-v1' " +
  "AND JSON_CONTAINS(JSON_EXTRACT(history.payload_json,'$.association.queries'),JSON_QUOTE(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query')))) " +
  "WHERE trend_projection_jobs.organization_id=? AND trend_projection_jobs.workspace_id=? " +
  "AND trend_projection_jobs.status='failed_terminal' AND trend_projection_jobs.last_error_code='intelligence_provenance_invalid' " +
  "AND n.status IN ('active','superseded') AND t.status IN ('succeeded','completed_with_warnings') " +
  "AND JSON_TYPE(JSON_EXTRACT(q.target_json,'$.query'))='STRING' AND JSON_TYPE(JSON_EXTRACT(q.target_json,'$.intelligence_source_record_id'))='STRING' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='intelligence_product_discovery' " +
  `AND ${activeCollectionScopeSql("trend_projection_jobs")}`;

export async function recoverSupersededIntelligenceProjections(
  pool: Pool,
  scope: { organizationId: string; workspaceId: string; projectionJobIds: string[] },
  now = new Date(),
) {
  if (
    !Array.isArray(scope.projectionJobIds) ||
    !scope.projectionJobIds.length ||
    scope.projectionJobIds.length > 20 ||
    scope.projectionJobIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))
  )
    throw new Error("intelligence_provenance_recovery_targets_invalid");
  const targets = [...new Set(scope.projectionJobIds)];
  const [candidates] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT trend_projection_jobs.id,trend_projection_jobs.updated_at" +
      intelligenceProvenanceRecoveryFromSql +
      ` AND trend_projection_jobs.id IN (${targets.map(() => "?").join(",")}) ORDER BY trend_projection_jobs.updated_at,trend_projection_jobs.id LIMIT 20`,
    [scope.organizationId, scope.workspaceId, ...targets],
  );
  const recovered: string[] = [],
    requestId = randomUUID();
  for (const candidate of candidates) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT trend_projection_jobs.id,trend_projection_jobs.attempt_count,trend_projection_jobs.updated_at,history.resource_id topic_id,n.created_by actor_id,original.id source_record_id" +
          intelligenceProvenanceRecoveryFromSql +
          " AND trend_projection_jobs.id=? LIMIT 1 FOR UPDATE",
        [scope.organizationId, scope.workspaceId, candidate.id],
      );
      const job = rows[0];
      if (!job) {
        await connection.commit();
        continue;
      }
      const [updated] = await connection.query<ResultSetHeader>(
        "UPDATE trend_projection_jobs SET status='scheduled',available_at=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND status='failed_terminal' AND last_error_code='intelligence_provenance_invalid'",
        [now, now, job.id, scope.organizationId, scope.workspaceId],
      );
      if (updated.affectedRows !== 1) throw new Error("intelligence_provenance_recovery_race");
      await connection.query(
        "INSERT INTO trend_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,'trend.intelligence.provenance_requeued','trend_topic',?,'worker',?,?,?,?,?)",
        [
          randomUUID(),
          scope.organizationId,
          scope.workspaceId,
          job.topic_id,
          job.actor_id,
          requestId,
          requestId,
          JSON.stringify({
            contract: "intelligence-provenance-recovery-v1",
            projection_job_id: job.id,
            intelligence_source_record_id: job.source_record_id,
            previous_status: "failed_terminal",
            previous_error_code: "intelligence_provenance_invalid",
            previous_attempt_count: Number(job.attempt_count),
            previous_updated_at: job.updated_at,
            reason: "audited_source_version_superseded",
          }),
          now,
        ],
      );
      await connection.commit();
      recovered.push(String(job.id));
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  return { request_id: requestId, inspected: candidates.length, requeued: recovered };
}
