import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { selectionPrimaryAsinSql } from "@scoutops/database";
import { automaticPrimaryImageSql } from "./automatic-selection-evidence.js";
import { buildSupplierSearchQuery } from "./trend-projection-calculation.js";

/** Only an empty automatic task blocked by a circuit that has since recovered. */
export const recoveredSourcingCandidateSql = `SELECT ss.id search_id,ss.organization_id,ss.workspace_id,
  ss.collection_task_id previous_task_id,ss.input_ref opportunity_id,t.created_by,
  p.id provider_id,rc.recovered_at,o.name,q.updated_at blocked_updated_at
  FROM providers p JOIN provider_runtime_circuits rc ON rc.provider_id=p.id AND rc.state='closed'
  JOIN collection_subqueries q ON q.provider_id=p.id
  JOIN collection_tasks t ON t.id=q.task_id AND t.organization_id=q.organization_id AND t.workspace_id=q.workspace_id
  JOIN sourcing_searches ss ON ss.collection_task_id=t.id AND ss.organization_id=t.organization_id AND ss.workspace_id=t.workspace_id
  JOIN opportunities o ON o.id=ss.input_ref AND o.organization_id=ss.organization_id AND o.workspace_id=ss.workspace_id
  JOIN organizations org ON org.id=ss.organization_id AND org.status='active'
  JOIN workspaces ws ON ws.id=ss.workspace_id AND ws.organization_id=ss.organization_id AND ws.status='active'
  WHERE p.code='1688_search' AND p.status='enabled' AND p.access_mode='authenticated_browser'
    AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0
    AND (p.terms_permanent=1 OR p.terms_expires_at>?)
    AND q.status='blocked' AND q.error_code='source_circuit_open' AND q.available_result_count=0
    AND rc.recovered_at>q.updated_at AND t.status='completed_with_warnings' AND t.available_result_count=0
    AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search'
    AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.search_id'))=BINARY ss.id
    AND ss.input_type='opportunity' AND ss.deleted_at IS NULL AND ss.candidate_count=0
    AND ss.status IN ('queued','succeeded_empty') AND o.source_type='trend_topic' AND o.lifecycle_status<>'deleted'
    AND NOT EXISTS (SELECT 1 FROM sourcing_candidates offer WHERE offer.search_id=ss.id
      AND offer.organization_id=ss.organization_id AND offer.workspace_id=ss.workspace_id)
    AND EXISTS (SELECT 1 FROM collection_task_events auto_event WHERE auto_event.task_id=t.id
      AND auto_event.organization_id=t.organization_id AND auto_event.workspace_id=t.workspace_id
      AND auto_event.event_type='sourcing.collection.auto_scheduled' AND auto_event.actor_type='worker')`;

/** Resolve each actionable primary once and reject missing images before the FIFO limit. */
export const recoveredSourcingImageCandidateSql = `SELECT o.* FROM (
  SELECT recovery.*,o.id,${selectionPrimaryAsinSql} primary_asin
  FROM (${recoveredSourcingCandidateSql} LIMIT 18446744073709551615) recovery
  JOIN opportunities o ON o.id=recovery.opportunity_id AND o.organization_id=recovery.organization_id
    AND o.workspace_id=recovery.workspace_id
  LIMIT 18446744073709551615
) o WHERE BINARY (${automaticPrimaryImageSql})
  REGEXP '^https://(m[.]media-amazon[.]com|images-na[.]ssl-images-amazon[.]com)/'
ORDER BY o.blocked_updated_at,o.search_id LIMIT 1`;

type Schedule = (
  connection: PoolConnection,
  row: RowDataPacket,
  taskId: string,
  target: Record<string, unknown>,
  requestId: string,
  traceId: string,
) => Promise<void>;

/** One PK lock and a fresh eligibility read; never lock the historical scan. */
export async function recoverCircuitHeldSourcing(pool: Pool, schedule: Schedule, now: Date) {
  const [candidates] = await pool.query<RowDataPacket[]>(recoveredSourcingImageCandidateSql, [now]);
  const candidate = candidates[0];
  if (!candidate) return false;
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const scope = [candidate.search_id, candidate.organization_id, candidate.workspace_id];
    const [locked] = await c.query<RowDataPacket[]>(
      "SELECT collection_task_id FROM sourcing_searches WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
      scope,
    );
    if (!locked[0] || locked[0].collection_task_id !== candidate.previous_task_id) {
      await c.commit();
      return false;
    }
    const [eligible] = await c.query<RowDataPacket[]>(
      recoveredSourcingCandidateSql +
        " AND ss.id=? AND ss.organization_id=? AND ss.workspace_id=? LIMIT 1",
      [now, ...scope],
    );
    const row = eligible[0];
    if (!row || row.previous_task_id !== candidate.previous_task_id) {
      await c.commit();
      return false;
    }
    const [images] = await c.query<RowDataPacket[]>(
      `SELECT ${automaticPrimaryImageSql} image_url FROM (SELECT o.*,${selectionPrimaryAsinSql} primary_asin
       FROM opportunities o WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? LIMIT 1) o`,
      [row.opportunity_id, row.organization_id, row.workspace_id],
    );
    const image = images[0]?.image_url;
    if (
      typeof image !== "string" ||
      !/^https:\/\/(m\.media-amazon\.com|images-na\.ssl-images-amazon\.com)\//.test(image)
    ) {
      await c.commit();
      return false;
    }
    const taskId = randomUUID(),
      requestId = randomUUID(),
      traceId = randomUUID();
    await schedule(
      c,
      row,
      taskId,
      {
        query: buildSupplierSearchQuery(String(row.name)),
        image_url: image,
        query_contract: "supplier-keywords-v2",
        projection_type: "sourcing_search",
        search_id: String(row.search_id),
      },
      requestId,
      traceId,
    );
    const [updated] = await c.query<ResultSetHeader>(
      "UPDATE sourcing_searches SET collection_task_id=?,status='queued',candidate_count=0,missing_fields_json='[]',updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND collection_task_id=? AND deleted_at IS NULL AND candidate_count=0 AND status IN ('queued','succeeded_empty')",
      [taskId, now, ...scope, row.previous_task_id],
    );
    if (updated.affectedRows !== 1) throw new Error("sourcing_recovery_link_changed");
    await c.query(
      "INSERT INTO sourcing_events(id,organization_id,workspace_id,event_type,resource_id,actor_id,payload_json,request_id,trace_id,created_at) VALUES(?,?,?,'sourcing.search.circuit_requeued',?,'ai-selection-worker',?,?,?,?)",
      [
        randomUUID(),
        row.organization_id,
        row.workspace_id,
        row.search_id,
        JSON.stringify({
          previous_task_id: row.previous_task_id,
          collection_task_id: taskId,
          provider_id: row.provider_id,
          recovered_at: row.recovered_at,
        }),
        requestId,
        traceId,
        now,
      ],
    );
    await c.commit();
    return true;
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}
