import { appendCollectionSubquery, collectionTaskScope } from "@scoutops/database";
import { trendTopicEventReadRelation } from "@scoutops/database";
import { automaticIntakeBacklogLimit } from "./automatic-intake-capacity-policy.js";
import { randomUUID } from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { activeCollectionScopeSql, accountCollectionBacklogCountSql } from "./collection-source-scheduling-policy.js";
import { nativeCollectionBacklogCountSql } from "./collection-account-backlog.js";
import { hasNativeNormalizedAccountScope } from "./automatic-selection-evidence.js";
import { registerTrendProjectionOwners, type TrendProjectionOwnership } from "./trend-projection-ownership.js";

const activeStatuses =
  "('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited')";
const legacyProvenanceSource =
  "FROM normalized_records n JOIN raw_evidence re ON re.id=n.raw_evidence_id AND re.provider_id=n.provider_id " +
  "JOIN collection_tasks origin ON origin.id=re.collection_task_id " +
  "JOIN trend_signals tsig ON tsig.normalized_record_id=n.id AND tsig.raw_evidence_id=re.id AND tsig.provider_id=n.provider_id " +
  "JOIN trend_topics st ON st.id=tsig.topic_id AND st.organization_id=origin.organization_id AND st.workspace_id=origin.workspace_id " +
  "JOIN " + trendTopicEventReadRelation + " e ON e.resource_type='trend_topic' AND e.resource_id=tsig.topic_id AND e.organization_id=origin.organization_id " +
  "AND e.workspace_id=origin.workspace_id AND e.event_type='trend.intelligence.associated' ";
// 0190/0191 replace evidence/topic scope. Task provenance is checked against
// sealed ownership and either native task accounts or the still-legacy coordinates.
const nativeProvenanceSource = (nativeTopic: boolean, recheck = false) =>
  "FROM normalized_records n JOIN raw_evidence re ON re.id=n.raw_evidence_id AND re.provider_id=n.provider_id AND re.account_id=n.account_id " +
  (recheck ? "JOIN collection_tasks t ON t.id=? " : "") +
  "JOIN collection_tasks origin ON origin.id=re.collection_task_id " +
  "JOIN trend_signals tsig ON tsig.normalized_record_id=n.id AND tsig.raw_evidence_id=re.id AND tsig.provider_id=n.provider_id " +
  "JOIN trend_topics st ON st.id=tsig.topic_id AND " +
  (nativeTopic ? "st.account_id=n.account_id " : "st.organization_id=origin.organization_id AND st.workspace_id=origin.workspace_id ") +
  "JOIN trend_events e ON BINARY e.resource_type='trend_topic' AND e.resource_id=st.id AND e.event_type='trend.intelligence.associated' " +
  "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
  "JOIN users account ON account.id=n.account_id AND account.status='active' " +
  ([
    ["normalized_records", "n.id"], ["raw_evidence", "re.id"], ["collection_tasks", "origin.id"],
    ["trend_signals", "tsig.id"], ["trend_topics", "st.id"], ["trend_events", "e.id"],
  ].map(([table, id], i) =>
    `JOIN account_owned_records proof${i} ON proof${i}.source_table='${table}' AND proof${i}.source_id=${id} AND proof${i}.account_id=n.account_id `,
  )).join("") +
  "JOIN account_owned_records recovery_owner ON recovery_owner.source_table='collection_tasks' " +
  "AND recovery_owner.account_id=n.account_id AND (recovery_owner.reason='exclusive_owner' OR " +
  "(recovery_owner.reason IN ('shared','unassigned') AND recovery_owner.account_id=cut.primary_account_id)) ";

const accountTaskProof =
  "origin.account_id=n.account_id AND t.account_id=n.account_id ";
const provenance = (provenanceSource: string, accountOnly: boolean) =>
  "EXISTS (SELECT 1 " + provenanceSource +
  "WHERE " + (provenanceSource === legacyProvenanceSource ? "" : "recovery_owner.source_id=t.id AND ") +
  "n.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.intelligence_source_record_id')) USING ascii) " +
  "AND BINARY n.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.intelligence_source_record_id')) " +
  "AND " + (accountOnly ? accountTaskProof :
    "origin.organization_id=t.organization_id AND origin.workspace_id=t.workspace_id ") + "AND n.status='active' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.normalized_record_id'))=BINARY n.id " +
  "AND JSON_CONTAINS(JSON_EXTRACT(e.payload_json,'$.association.queries'),JSON_EXTRACT(s.target_json,'$.query')))";

const recoveryCandidatesSql = (provenanceSource: string, accountOnly = false) =>
  "SELECT t.id," + (accountOnly ? "t.account_id," : "t.organization_id,t.workspace_id,") + "recovery_disabled.version disabled_version," +
  "recovery_restored.version restored_version,recovery_disabled.created_at disabled_at,recovery_restored.created_at restored_at " +
  "FROM collection_subqueries s " +
  "JOIN collection_tasks t ON t.id=s.task_id " +
  (accountOnly
    ? "JOIN account_owned_records sub_owner ON sub_owner.source_table='collection_subqueries' AND sub_owner.source_id=s.id AND sub_owner.account_id=t.account_id "
    : "JOIN organizations o ON o.id=t.organization_id AND o.status='active' " +
      "JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=t.organization_id AND w.status='active' ") +
  "JOIN users u ON u.id=t.created_by AND u.status='active' " +
  "JOIN provider_versions recovery_disabled ON recovery_disabled.provider_id=s.provider_id " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(recovery_disabled.snapshot_json,'$.status'))='disabled' " +
  "JOIN provider_versions recovery_restored ON recovery_restored.provider_id=s.provider_id " +
  "AND recovery_restored.version=recovery_disabled.version+1 AND recovery_restored.action='configuration_updated' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(recovery_restored.snapshot_json,'$.status'))='enabled' " +
  "WHERE s.provider_id=? AND recovery_restored.version<=? AND s.status='blocked' AND s.error_code='permission_denied' AND s.is_required=1 " +
  "AND t.status='failed_terminal' AND t.last_error_code='permission_denied' AND t.available_result_count=0 " +
  "AND t.replay_of_task_id IS NULL AND t.finished_at>=recovery_disabled.created_at " +
  "AND t.finished_at<recovery_restored.created_at " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.projection_type'))='intelligence_product_discovery' " +
  "AND EXISTS (SELECT 1 FROM collection_task_events origin " +
  (accountOnly ? "JOIN account_owned_records event_owner ON event_owner.source_table='collection_task_events' AND event_owner.source_id=origin.id " : "") +
  "WHERE origin.task_id=t.id " + (accountOnly ?
    "AND event_owner.account_id=t.account_id AND BINARY origin.request_id=BINARY t.request_id AND BINARY origin.trace_id=BINARY t.trace_id " : "") +
  "AND origin.event_type='intelligence.product_search.auto_scheduled' AND origin.actor_type='worker') " +
  "AND NOT EXISTS (SELECT 1 FROM collection_tasks replay WHERE replay.replay_of_task_id=t.id) " +
  "AND NOT EXISTS (SELECT 1 FROM collection_subqueries other WHERE other.task_id=t.id AND other.id<>s.id) " +
  "AND " +
  provenance(provenanceSource, accountOnly) +
  " ORDER BY t.finished_at,t.id LIMIT ?";
export const intelligenceRecoveryCandidatesSql = recoveryCandidatesSql(legacyProvenanceSource);

/** Reissue proven source-outage searches once, without rewriting terminal history. */
export class IntelligenceSourceRecovery {
  private nextScanAt = 0;
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly now: () => Date,
    private readonly queueBacklogLimit: number,
  ) {}

  async processOnce(): Promise<number> {
    const now = this.now();
    if (now.getTime() < this.nextScanAt) return 0;
    this.nextScanAt = now.getTime() + 30_000;
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      // One provider identity and two unique version keys serialize competing recoveries.
      const [providers] = await c.query<RowDataPacket[]>(
        "SELECT p.id,p.version,disabled.version disabled_version,disabled.created_at disabled_at,restored.created_at restored_at " +
          "FROM providers p JOIN provider_versions restored ON restored.provider_id=p.id AND restored.version=p.version " +
          "AND restored.action='configuration_updated' AND JSON_UNQUOTE(JSON_EXTRACT(restored.snapshot_json,'$.status'))='enabled' " +
          "JOIN provider_versions disabled ON disabled.provider_id=p.id AND disabled.version=p.version-1 " +
          "AND JSON_UNQUOTE(JSON_EXTRACT(disabled.snapshot_json,'$.status'))='disabled' " +
          "JOIN provider_adapter_health h ON h.provider_id=p.id AND h.health_status='ready' AND h.last_checked_at>=disabled.created_at " +
          "LEFT JOIN provider_runtime_circuits circuit ON circuit.provider_id=p.id " +
          "WHERE p.code='amazon_product' AND p.access_mode='public_page' AND p.status='enabled' " +
          "AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0 " +
          "AND (p.terms_permanent=1 OR p.terms_expires_at>?) AND COALESCE(circuit.state,'closed')='closed' FOR UPDATE",
        [now],
      );
      const provider = providers[0];
      if (!provider) {
        await c.commit();
        return 0;
      }
      const nativeEvidence = await hasNativeNormalizedAccountScope(c);
      const accountOnly = nativeEvidence && await collectionTaskScope(c) === "account";
      const [backlog] = await c.query<RowDataPacket[]>(
        nativeEvidence ? "SELECT " + (accountOnly ? nativeCollectionBacklogCountSql : accountCollectionBacklogCountSql) + " count" :
          `SELECT COUNT(*) count FROM collection_tasks WHERE ${activeCollectionScopeSql("collection_tasks")} AND status IN ${activeStatuses}`,
      );
      const limit = Math.min(
        20,
        Math.max(
          0,
          automaticIntakeBacklogLimit(this.queueBacklogLimit) - Number(backlog[0]?.count ?? 0),
        ),
      );
      if (!limit) {
        await c.commit();
        return 0;
      }
      let provenanceSource = legacyProvenanceSource;
      let recheckSource = legacyProvenanceSource;
      if (nativeEvidence) {
        const [columns] = await c.query<RowDataPacket[]>(
          "SHOW COLUMNS FROM trend_topics WHERE Field IN ('account_id','organization_id','workspace_id')",
        );
        const shape = columns.map(row => row.Field).sort().join(",");
        if (shape !== "account_id" && shape !== "organization_id,workspace_id")
          throw new Error("trend_topic_scope_schema_invalid");
        if (accountOnly && shape !== "account_id")
          throw new Error("intelligence_recovery_account_topic_required");
        provenanceSource = nativeProvenanceSource(shape === "account_id");
        recheckSource = nativeProvenanceSource(shape === "account_id", true);
      }
      const [candidates] = await c.query<RowDataPacket[]>(
        nativeEvidence ? recoveryCandidatesSql(provenanceSource, accountOnly) : intelligenceRecoveryCandidatesSql, [
        provider.id,
        provider.version,
        limit,
      ]);
      let recovered = 0;
      for (const candidate of candidates) {
        const [tasks] = await c.query<RowDataPacket[]>(
          "SELECT t.* FROM collection_tasks t " +
            (accountOnly ? "" : "JOIN organizations o ON o.id=t.organization_id AND o.status='active' " +
              "JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=t.organization_id AND w.status='active' ") +
            "JOIN users u ON u.id=t.created_by AND u.status='active' " +
            "WHERE t.id=? AND " + (accountOnly ? "t.account_id=? " : "t.organization_id=? AND t.workspace_id=? ") +
            "AND t.status='failed_terminal' AND t.last_error_code='permission_denied' AND t.available_result_count=0 " +
            "AND t.replay_of_task_id IS NULL AND t.finished_at>=? AND t.finished_at<? FOR UPDATE",
          [
            candidate.id,
            ...(accountOnly ? [candidate.account_id] : [candidate.organization_id,candidate.workspace_id]),
            candidate.disabled_at,
            candidate.restored_at,
          ],
        );
        const task = tasks[0];
        if (!task) continue;
        const [replays] = await c.query<RowDataPacket[]>(
          "SELECT id FROM collection_tasks WHERE replay_of_task_id=? LIMIT 1 FOR UPDATE",
          [task.id],
        );
        if (replays.length) continue;
        const [queries] = await c.query<RowDataPacket[]>(
          "SELECT * FROM collection_subqueries WHERE task_id=? ORDER BY ordinal FOR UPDATE",
          [task.id],
        );
        const query = queries[0];
        if (
          queries.length !== 1 ||
          !query ||
          query.provider_id !== provider.id ||
          query.status !== "blocked" ||
          query.error_code !== "permission_denied" ||
          Number(query.is_required) !== 1
        )
          continue;
        if (accountOnly) {
          const [proof] = await c.query<RowDataPacket[]>(
            "SELECT s.source_id FROM account_owned_records s JOIN collection_task_events e ON e.task_id=? " +
              "JOIN collection_tasks original ON original.id=e.task_id AND original.account_id=s.account_id " +
              "AND BINARY original.request_id=BINARY e.request_id AND BINARY original.trace_id=BINARY e.trace_id " +
              "JOIN account_owned_records a ON a.source_table='collection_task_events' AND a.source_id=e.id AND a.account_id=s.account_id " +
              "WHERE s.source_table='collection_subqueries' AND s.source_id=? AND s.account_id=? " +
              "AND e.event_type='intelligence.product_search.auto_scheduled' AND e.actor_type='worker' LIMIT 1 FOR UPDATE",
            [task.id,query.id,task.account_id],
          );
          if (!proof.length) continue;
        }
        const target =
          typeof query.target_json === "string" ? JSON.parse(query.target_json) : query.target_json;
        if (
          target?.projection_type !== "intelligence_product_discovery" ||
          typeof target.query !== "string" ||
          !target.query.trim() ||
          target.query.length > 300 ||
          typeof target.intelligence_source_record_id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            target.intelligence_source_record_id,
          ) ||
          Object.keys(target).some(
            (key) => !["query", "projection_type", "intelligence_source_record_id"].includes(key),
          )
        )
          continue;
        const [evidence] = await c.query<RowDataPacket[]>(
          (nativeEvidence ? "SELECT n.id,recovery_owner.account_id,recovery_owner.reason " : "SELECT n.id ") + recheckSource +
            "WHERE " + (nativeEvidence ? "recovery_owner.source_id=t.id AND " : "") +
            "n.id=? AND " + (accountOnly ? accountTaskProof :
              "origin.organization_id=? AND origin.workspace_id=? ") + "AND n.status='active' " +
            "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.normalized_record_id'))=BINARY n.id " +
            "AND JSON_CONTAINS(JSON_EXTRACT(e.payload_json,'$.association.queries'),JSON_QUOTE(?)) LIMIT 1 FOR UPDATE",
          [
            ...(nativeEvidence ? [task.id] : []),
            target.intelligence_source_record_id,
            ...(accountOnly ? [] : [task.organization_id,task.workspace_id]),
            target.query,
          ],
        );
        if (!evidence.length) continue;
        const ownership: TrendProjectionOwnership = nativeEvidence
          ? { owner: { account_id: evidence[0]!.account_id, reason: evidence[0]!.reason } }
          : null;
        if (accountOnly && ownership?.owner?.account_id !== task.account_id) continue;
        const taskId = randomUUID(),
          requestId = randomUUID();
        const [insert] = await c.query<ResultSetHeader>(
          "INSERT INTO collection_tasks (id," + (accountOnly ? "account_id," : "organization_id,workspace_id,") +
            "status,coverage_status,priority,scheduled_at,available_at," +
            "attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json," +
            "replay_of_task_id,replay_reason,request_id,trace_id,version,created_by,created_at,updated_at) " +
            "VALUES (" + (accountOnly ? "?,?" : "?,?,?") + ",'scheduled',NULL,?,?,?,0,0,0,0,0,'[]',?,?,?,?,1,?,?,?)",
          [
            taskId,
            ...(accountOnly ? [ownership!.owner!.account_id] : [task.organization_id,task.workspace_id]),
            task.priority,
            now,
            now,
            task.id,
            "自动情报来源经健康检查及审计重新启用，补采停用区间内的原搜索。",
            requestId,
            task.trace_id,
            task.created_by,
            now,
            now,
          ],
        );
        if (insert.affectedRows !== 1) throw new Error("intelligence_recovery_task_not_inserted");
        const subqueryId = randomUUID();
        const owned: [string, string][] = [["collection_tasks", taskId], ["collection_subqueries", subqueryId]];
        await appendCollectionSubquery(c, {
          id: subqueryId, taskId, providerId: String(provider.id), ordinal: Number(query.ordinal),
          targetJson: JSON.stringify(target), required: true, status: "pending", now,
        }, accountOnly);
        for (const event of [
          "intelligence.product_search.auto_scheduled",
          "intelligence.product_search.source_recovered",
        ]) {
          const eventId = randomUUID();
          owned.push(["collection_task_events", eventId]);
          await c.query(
            "INSERT INTO collection_task_events (id,task_id,event_type,from_status,to_status,actor_type," +
              "actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES (?,?,?,NULL,'scheduled','worker',?,?,?,?,?)",
            [
              eventId,
              taskId,
              event,
              this.workerId,
              requestId,
              task.trace_id,
              JSON.stringify({
                original_task_id: task.id,
                provider_id: provider.id,
                provider_version: Number(candidate.restored_version),
                disabled_version: Number(candidate.disabled_version),
                automatic: true,
                source: "automatic_product_discovery",
              }),
              now,
            ],
          );
        }
        await registerTrendProjectionOwners(c, ownership, owned);
        recovered += 1;
      }
      await c.commit();
      return recovered;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
}
