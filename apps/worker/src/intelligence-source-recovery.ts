import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";

import { activeCollectionScopeSql } from "./collection-source-scheduling-policy.js";

const activeStatuses =
  "('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited')";
const provenance =
  "EXISTS (SELECT 1 FROM normalized_records n JOIN trend_signals tsig ON tsig.normalized_record_id=n.id " +
  "AND tsig.organization_id=n.organization_id AND tsig.workspace_id=n.workspace_id " +
  "JOIN trend_events e ON e.resource_type='trend_topic' AND e.resource_id=tsig.topic_id AND e.organization_id=n.organization_id " +
  "AND e.workspace_id=n.workspace_id AND e.event_type='trend.intelligence.associated' " +
  "WHERE n.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.intelligence_source_record_id')) USING ascii) " +
  "AND BINARY n.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.intelligence_source_record_id')) " +
  "AND n.organization_id=t.organization_id AND n.workspace_id=t.workspace_id AND n.status='active' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.normalized_record_id'))=BINARY n.id " +
  "AND JSON_CONTAINS(JSON_EXTRACT(e.payload_json,'$.association.queries'),JSON_EXTRACT(s.target_json,'$.query')))";

export const intelligenceRecoveryCandidatesSql =
  "SELECT t.id,t.organization_id,t.workspace_id FROM collection_subqueries s " +
  "JOIN collection_tasks t ON t.id=s.task_id AND t.organization_id=s.organization_id AND t.workspace_id=s.workspace_id " +
  "JOIN organizations o ON o.id=t.organization_id AND o.status='active' " +
  "JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=t.organization_id AND w.status='active' " +
  "JOIN users u ON u.id=t.created_by AND u.status='active' " +
  "WHERE s.provider_id=? AND s.status='blocked' AND s.error_code='permission_denied' AND s.is_required=1 " +
  "AND t.status='failed_terminal' AND t.last_error_code='permission_denied' AND t.available_result_count=0 " +
  "AND t.replay_of_task_id IS NULL AND t.finished_at>=? AND t.finished_at<? " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.projection_type'))='intelligence_product_discovery' " +
  "AND EXISTS (SELECT 1 FROM collection_task_events origin WHERE origin.task_id=t.id " +
  "AND origin.organization_id=t.organization_id AND origin.workspace_id=t.workspace_id " +
  "AND origin.event_type='intelligence.product_search.auto_scheduled' AND origin.actor_type='worker') " +
  "AND NOT EXISTS (SELECT 1 FROM collection_tasks replay WHERE replay.replay_of_task_id=t.id) " +
  "AND NOT EXISTS (SELECT 1 FROM collection_subqueries other WHERE other.task_id=t.id AND other.id<>s.id) " +
  "AND " +
  provenance +
  " ORDER BY t.finished_at,t.id LIMIT ?";

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
      const [backlog] = await c.query<RowDataPacket[]>(
        `SELECT COUNT(*) count FROM collection_tasks WHERE ${activeCollectionScopeSql("collection_tasks")} AND status IN ${activeStatuses}`,
      );
      const limit = Math.min(
        20,
        Math.max(0, this.queueBacklogLimit - Number(backlog[0]?.count ?? 0)),
      );
      if (!limit) {
        await c.commit();
        return 0;
      }
      const [candidates] = await c.query<RowDataPacket[]>(intelligenceRecoveryCandidatesSql, [
        provider.id,
        provider.disabled_at,
        provider.restored_at,
        limit,
      ]);
      let recovered = 0;
      for (const candidate of candidates) {
        const [tasks] = await c.query<RowDataPacket[]>(
          "SELECT t.* FROM collection_tasks t JOIN organizations o ON o.id=t.organization_id AND o.status='active' " +
            "JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=t.organization_id AND w.status='active' " +
            "JOIN users u ON u.id=t.created_by AND u.status='active' " +
            "WHERE t.id=? AND t.organization_id=? AND t.workspace_id=? " +
            "AND t.status='failed_terminal' AND t.last_error_code='permission_denied' AND t.available_result_count=0 " +
            "AND t.replay_of_task_id IS NULL AND t.finished_at>=? AND t.finished_at<? FOR UPDATE",
          [
            candidate.id,
            candidate.organization_id,
            candidate.workspace_id,
            provider.disabled_at,
            provider.restored_at,
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
          "SELECT * FROM collection_subqueries WHERE task_id=? AND organization_id=? AND workspace_id=? ORDER BY ordinal FOR UPDATE",
          [task.id, task.organization_id, task.workspace_id],
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
          "SELECT n.id FROM normalized_records n JOIN trend_signals tsig ON tsig.normalized_record_id=n.id " +
            "AND tsig.organization_id=n.organization_id AND tsig.workspace_id=n.workspace_id " +
            "JOIN trend_events e ON e.resource_type='trend_topic' AND e.resource_id=tsig.topic_id AND e.organization_id=n.organization_id " +
            "AND e.workspace_id=n.workspace_id AND e.event_type='trend.intelligence.associated' " +
            "WHERE n.id=? AND n.organization_id=? AND n.workspace_id=? AND n.status='active' " +
            "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.normalized_record_id'))=BINARY n.id " +
            "AND JSON_CONTAINS(JSON_EXTRACT(e.payload_json,'$.association.queries'),JSON_QUOTE(?)) LIMIT 1 FOR UPDATE",
          [
            target.intelligence_source_record_id,
            task.organization_id,
            task.workspace_id,
            target.query,
          ],
        );
        if (!evidence.length) continue;
        const taskId = randomUUID(),
          requestId = randomUUID();
        await c.query(
          "INSERT INTO collection_tasks (id,organization_id,workspace_id,status,coverage_status,priority,scheduled_at,available_at," +
            "attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json," +
            "replay_of_task_id,replay_reason,request_id,trace_id,version,created_by,created_at,updated_at) " +
            "VALUES (?,?,?,'scheduled',NULL,?,?,?,0,0,0,0,0,'[]',?,?,?,?,1,?,?,?)",
          [
            taskId,
            task.organization_id,
            task.workspace_id,
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
        await c.query(
          "INSERT INTO collection_subqueries (id,task_id,organization_id,workspace_id,provider_id,ordinal,target_json,is_required," +
            "status,available_result_count,missing_fields_json,retryable,version,created_at,updated_at) " +
            "VALUES (?,?,?,?,?,?,?,1,'pending',0,'[]',0,1,?,?)",
          [
            randomUUID(),
            taskId,
            task.organization_id,
            task.workspace_id,
            provider.id,
            query.ordinal,
            JSON.stringify(target),
            now,
            now,
          ],
        );
        for (const event of [
          "intelligence.product_search.auto_scheduled",
          "intelligence.product_search.source_recovered",
        ]) {
          await c.query(
            "INSERT INTO collection_task_events (id,task_id,organization_id,workspace_id,event_type,from_status,to_status,actor_type," +
              "actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES (?,?,?,?,?,NULL,'scheduled','worker',?,?,?,?,?)",
            [
              randomUUID(),
              taskId,
              task.organization_id,
              task.workspace_id,
              event,
              this.workerId,
              requestId,
              task.trace_id,
              JSON.stringify({
                original_task_id: task.id,
                provider_id: provider.id,
                provider_version: provider.version,
                disabled_version: provider.disabled_version,
                automatic: true,
                source: "automatic_product_discovery",
              }),
              now,
            ],
          );
        }
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
