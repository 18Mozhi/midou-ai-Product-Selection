import { collectionTaskScope, trendTopicEventReadRelation } from "@scoutops/database";
import { appendTrendEvent } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { activeCollectionScopeSql } from "./collection-source-scheduling-policy.js";
import { hasNativeNormalizedAccountScope } from "./automatic-selection-evidence.js";
import { registerTrendProjectionOwners } from "./trend-projection-ownership.js";
import { nativeTrendProjectionScopeSql } from "./trend-projection-account-queue.js";

/** One-time scoped correction of proven historical-version false negatives; no new collection. */
const legacyScope = "t.organization_id=? AND t.workspace_id=?";
const originalTaskScope =
  "AND original_task.organization_id=t.organization_id AND original_task.workspace_id=t.workspace_id ";
const historyCondition =
  "history.event_type='trend.intelligence.associated' AND history.actor_type='worker' AND BINARY history.resource_type='trend_topic' ";
const ownerJoin = (table: string, id: string, alias: string) =>
  `JOIN account_owned_records ${alias} ON ${alias}.source_table='${table}' AND ${alias}.source_id=${id} AND ${alias}.account_id=n.account_id `;
const nativeJobProof =
  ownerJoin("trend_projection_jobs", "trend_projection_jobs.id", "job_owner") +
  ownerJoin("normalized_records", "n.id", "normalized_owner") +
  ownerJoin("raw_evidence", "e.id", "evidence_owner") +
  "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
  "AND (job_owner.reason='exclusive_owner' OR (job_owner.reason IN ('shared','unassigned') AND cut.primary_account_id=n.account_id)) " +
  "JOIN users account ON account.id=n.account_id AND account.status='active' ";

const recoveryFromSql = (account: boolean, nativeTasks = false) =>
  " FROM trend_projection_jobs " +
  "JOIN normalized_records n ON n.id=trend_projection_jobs.normalized_record_id " +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
  "JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id " +
  (account ? "AND e.account_id=n.account_id " : "") +
  "JOIN collection_subqueries q ON q.id=e.collection_subquery_id AND q.task_id=e.collection_task_id AND q.provider_id=n.provider_id " +
  "JOIN collection_tasks t ON t.id=q.task_id " +
  (nativeTasks ? "AND t.account_id=n.account_id " : "") +
  "JOIN normalized_records original ON original.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.intelligence_source_record_id')) USING ascii) COLLATE ascii_general_ci " +
  "AND original.status='superseded' " +
  (account
    ? "AND original.account_id=n.account_id AND BINARY original.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.intelligence_source_record_id')) "
    : "") +
  "JOIN raw_evidence original_evidence ON original_evidence.id=original.raw_evidence_id AND original_evidence.provider_id=original.provider_id " +
  (account ? "AND original_evidence.account_id=n.account_id " : "") +
  "JOIN collection_tasks original_task ON original_task.id=original_evidence.collection_task_id " +
  (nativeTasks ? "AND original_task.account_id=n.account_id " : "") +
  (account
    ? "JOIN trend_signals source_signal ON source_signal.normalized_record_id=original.id AND source_signal.raw_evidence_id=original_evidence.id AND source_signal.provider_id=original.provider_id " +
      "JOIN trend_topics topic ON topic.id=source_signal.topic_id AND topic.account_id=n.account_id " +
      "JOIN trend_events history ON history.resource_id=topic.id AND "
    : originalTaskScope +
      "JOIN " +
      trendTopicEventReadRelation +
      " history ON history.organization_id=original_task.organization_id AND history.workspace_id=original_task.workspace_id AND ") +
  historyCondition +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(history.payload_json,'$.normalized_record_id'))=BINARY original.id " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(history.payload_json,'$.contract'))='intelligence-product-v1' " +
  "AND JSON_CONTAINS(JSON_EXTRACT(history.payload_json,'$.association.queries'),JSON_QUOTE(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query')))) " +
  (account
    ? nativeJobProof +
      [
        ["collection_subqueries", "q.id", "query_owner"],
        ["collection_tasks", "t.id", "task_owner"],
        ["collection_tasks", "original_task.id", "source_task_owner"],
        ["normalized_records", "original.id", "source_record_owner"],
        ["raw_evidence", "original_evidence.id", "source_evidence_owner"],
        ["trend_signals", "source_signal.id", "signal_owner"],
        ["trend_topics", "topic.id", "topic_owner"],
        ["trend_events", "history.id", "history_owner"],
      ]
        .map(([table, id, alias]) => ownerJoin(table!, id!, alias!))
        .join("")
    : "") +
  "WHERE " +
  (account ? "n.account_id=? " : legacyScope + " ") +
  "AND trend_projection_jobs.status='failed_terminal' AND trend_projection_jobs.last_error_code='intelligence_provenance_invalid' " +
  "AND n.status IN ('active','superseded') AND t.status IN ('succeeded','completed_with_warnings') " +
  "AND JSON_TYPE(JSON_EXTRACT(q.target_json,'$.query'))='STRING' AND JSON_TYPE(JSON_EXTRACT(q.target_json,'$.intelligence_source_record_id'))='STRING' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='intelligence_product_discovery' " +
  (account ? "" : `AND ${activeCollectionScopeSql("t")}`);
export const intelligenceProvenanceRecoveryFromSql = recoveryFromSql(false);

const originalRecordScopeSql = (account: boolean, nativeTasks: boolean) =>
  (nativeTasks ? nativeTrendProjectionScopeSql + " AND " : "") +
  "EXISTS (SELECT 1 FROM normalized_records n " +
  "JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id " +
  (account
    ? "AND e.account_id=n.account_id "
    : "JOIN collection_tasks t ON t.id=e.collection_task_id ") +
  "WHERE n.id=trend_projection_jobs.normalized_record_id AND " +
  (account
    ? "n.account_id=? AND EXISTS (SELECT 1 FROM account_owned_records jo JOIN account_ownership_cutover cut " +
      "ON cut.slot='current' AND cut.contract_version=25 WHERE jo.source_table='trend_projection_jobs' " +
      "AND jo.source_id=trend_projection_jobs.id AND jo.account_id=n.account_id " +
      "AND (jo.reason='exclusive_owner' OR (jo.reason IN ('shared','unassigned') AND jo.account_id=cut.primary_account_id)))"
    : legacyScope) +
  ")";

type RecoveryScope = { projectionJobIds: string[] } & (
  | { accountId: string; organizationId?: never; workspaceId?: never }
  | { accountId?: never; organizationId: string; workspaceId: string }
);

export async function recoverSupersededIntelligenceProjections(
  pool: Pool,
  scope: RecoveryScope,
  now = new Date(),
) {
  if (
    !Array.isArray(scope.projectionJobIds) ||
    !scope.projectionJobIds.length ||
    scope.projectionJobIds.length > 20 ||
    scope.projectionJobIds.some(
      (id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    )
  )
    throw new Error("intelligence_provenance_recovery_targets_invalid");
  const targets = [...new Set(scope.projectionJobIds)];
  const account = scope.accountId !== undefined;
  const nativeEvidence = await hasNativeNormalizedAccountScope(pool);
  if (
    account !== nativeEvidence ||
    (account &&
      (!scope.accountId?.trim() ||
        scope.organizationId !== undefined ||
        scope.workspaceId !== undefined))
  )
    throw new Error("intelligence_provenance_recovery_scope_invalid");
  if (account) {
    const [columns] = await pool.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM trend_topics WHERE Field IN ('account_id','organization_id','workspace_id')",
    );
    if (
      columns
        .map((row) => row.Field)
        .sort()
        .join(",") !== "account_id"
    )
      throw new Error("trend_topic_scope_schema_invalid");
  }
  const scopeValues = account ? [scope.accountId] : [scope.organizationId, scope.workspaceId];
  const nativeTasks = account && (await collectionTaskScope(pool)) === "account";
  const fromSql = account
    ? recoveryFromSql(true, nativeTasks)
    : intelligenceProvenanceRecoveryFromSql;
  const jobScope = originalRecordScopeSql(account, nativeTasks);
  const [candidates] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT trend_projection_jobs.id,trend_projection_jobs.updated_at" +
      fromSql +
      ` AND trend_projection_jobs.id IN (${targets.map(() => "?").join(",")}) ORDER BY trend_projection_jobs.updated_at,trend_projection_jobs.id LIMIT 20`,
    [...scopeValues, ...targets],
  );
  const recovered: string[] = [],
    requestId = randomUUID();
  for (const candidate of candidates) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [locked] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM trend_projection_jobs WHERE id=? AND ${jobScope} AND status='failed_terminal' AND last_error_code='intelligence_provenance_invalid' FOR UPDATE`,
        [candidate.id, ...scopeValues],
      );
      if (!locked[0]) {
        await connection.commit();
        continue;
      }
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT trend_projection_jobs.id,trend_projection_jobs.attempt_count,trend_projection_jobs.updated_at,history.resource_id topic_id,n.created_by actor_id,original.id source_record_id" +
          (account ? ",job_owner.reason owner_reason" : "") +
          fromSql +
          " AND trend_projection_jobs.id=?" +
          (account
            ? " ORDER BY history.occurred_at DESC,history.id DESC LIMIT 1 FOR UPDATE"
            : " LIMIT 1"),
        [...scopeValues, candidate.id],
      );
      const job = rows[0];
      if (!job) {
        await connection.commit();
        continue;
      }
      const [updated] = await connection.query<ResultSetHeader>(
        `UPDATE trend_projection_jobs SET status='scheduled',available_at=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND ${jobScope} AND status='failed_terminal' AND last_error_code='intelligence_provenance_invalid'`,
        [now, now, job.id, ...scopeValues],
      );
      if (updated.affectedRows !== 1) throw new Error("intelligence_provenance_recovery_race");
      const event = {
        id: randomUUID(),
        eventType: "trend.intelligence.provenance_requeued",
        resourceType: "trend_topic",
        resourceId: job.topic_id,
        actorType: "worker" as const,
        actorId: job.actor_id,
        requestId,
        traceId: requestId,
        payloadJson: JSON.stringify({
          contract: "intelligence-provenance-recovery-v1",
          projection_job_id: job.id,
          intelligence_source_record_id: job.source_record_id,
          previous_status: "failed_terminal",
          previous_error_code: "intelligence_provenance_invalid",
          previous_attempt_count: Number(job.attempt_count),
          previous_updated_at: job.updated_at,
          reason: "audited_source_version_superseded",
        }),
        occurredAt: now,
      };
      if (account) {
        const [audit] = await connection.query<ResultSetHeader>(
          "INSERT INTO trend_events (id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) " +
            "SELECT ?,?,'trend_topic',topic.id,'worker',?,?,?,?,? FROM trend_topics topic " +
            "JOIN account_owned_records owner ON owner.source_table='trend_topics' AND owner.source_id=topic.id AND owner.account_id=topic.account_id " +
            "WHERE topic.id=? AND topic.account_id=?",
          [
            event.id,
            event.eventType,
            event.actorId,
            event.requestId,
            event.traceId,
            event.payloadJson,
            event.occurredAt,
            event.resourceId,
            scope.accountId,
          ],
        );
        if (audit.affectedRows !== 1)
          throw new Error("intelligence_provenance_recovery_topic_owner_mismatch");
        await registerTrendProjectionOwners(
          connection,
          { owner: { account_id: scope.accountId!, reason: job.owner_reason } },
          [["trend_events", event.id]],
        );
      } else {
        await appendTrendEvent(connection, {
          ...event,
          organizationId: scope.organizationId!,
          workspaceId: scope.workspaceId!,
        });
      }
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
