import { randomUUID } from "node:crypto";
import {
  calculationOwnersMatch,
  hasCalculationAccountCutover,
  registerCalculationOwners,
  resolveCalculationOwnership,
  type CalculationOwnership,
} from "./opportunity-calculation-ownership.js";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { appendSourcingEvent, selectionPrimaryAsinSql } from "@scoutops/database";
import { automaticPrimaryImageSql } from "./automatic-selection-evidence.js";
import { buildSupplierSearchQuery } from "./trend-projection-calculation.js";

/** Only an empty automatic task blocked by a circuit that has since recovered. */
const recoveryCandidate = (
  account: boolean,
) => `SELECT ss.id search_id,${account ? "o" : "ss"}.organization_id,${account ? "o" : "ss"}.workspace_id,
  ss.collection_task_id previous_task_id,ss.input_ref opportunity_id,t.created_by,${account ? "q.id subquery_id,so.account_id," : ""}
  p.id provider_id,rc.recovered_at,o.name,q.updated_at blocked_updated_at
  FROM providers p JOIN provider_runtime_circuits rc ON rc.provider_id=p.id AND rc.state='closed'
  JOIN collection_subqueries q ON q.provider_id=p.id
  JOIN collection_tasks t ON t.id=q.task_id
  JOIN sourcing_searches ss ON ss.collection_task_id=t.id
  JOIN opportunities o ON o.id=ss.input_ref
  ${
    account
      ? `JOIN account_owned_records so ON so.source_table='sourcing_searches' AND so.source_id=ss.id
  JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
    AND (so.reason='exclusive_owner' OR (so.reason IN ('shared','unassigned') AND so.account_id=cut.primary_account_id))
  JOIN account_owned_records too ON too.source_table='collection_tasks' AND too.source_id=t.id AND too.account_id=so.account_id
  JOIN account_owned_records qo ON qo.source_table='collection_subqueries' AND qo.source_id=q.id AND qo.account_id=so.account_id
  JOIN account_owned_records oo ON oo.source_table='opportunities' AND oo.source_id=o.id AND oo.account_id=so.account_id`
      : `
  JOIN organizations org ON org.id=ss.organization_id AND org.status='active'
  JOIN workspaces ws ON ws.id=ss.workspace_id AND ws.organization_id=ss.organization_id AND ws.status='active'`
  }
  WHERE p.code='1688_search' AND p.status='enabled' AND p.access_mode='authenticated_browser'
    ${account ? "" : "AND ss.organization_id=t.organization_id AND ss.workspace_id=t.workspace_id AND o.organization_id=ss.organization_id AND o.workspace_id=ss.workspace_id"}
    AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0
    AND (p.terms_permanent=1 OR p.terms_expires_at>?)
    AND q.status='blocked' AND q.error_code='source_circuit_open' AND q.available_result_count=0
    AND rc.recovered_at>q.updated_at AND t.status='completed_with_warnings' AND t.available_result_count=0
    AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search'
    AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.search_id'))=BINARY ss.id
    AND ss.input_type='opportunity' AND ss.deleted_at IS NULL AND ss.candidate_count=0
    AND ss.status IN ('queued','succeeded_empty') AND o.source_type='trend_topic' AND o.lifecycle_status<>'deleted'
    AND NOT EXISTS (SELECT 1 FROM sourcing_candidates offer WHERE offer.search_id=ss.id)
    AND EXISTS (SELECT 1 FROM collection_task_events auto_event WHERE auto_event.task_id=t.id
      AND auto_event.event_type='sourcing.collection.auto_scheduled' AND auto_event.actor_type='worker')`;

export const recoveredSourcingCandidateSql = recoveryCandidate(false);
export const accountRecoveredSourcingCandidateSql = recoveryCandidate(true);
/** Resolve each actionable primary once and reject missing images before the FIFO limit. */
const recoveryImageCandidate = (candidateSql: string) => `SELECT o.* FROM (
  SELECT recovery.*,o.id,${selectionPrimaryAsinSql} primary_asin
  FROM (${candidateSql} LIMIT 18446744073709551615) recovery
  JOIN opportunities o ON o.id=recovery.opportunity_id AND o.organization_id=recovery.organization_id
    AND o.workspace_id=recovery.workspace_id
  LIMIT 18446744073709551615
) o WHERE BINARY (${automaticPrimaryImageSql})
  REGEXP '^https://(m[.]media-amazon[.]com|images-na[.]ssl-images-amazon[.]com)/'
ORDER BY o.blocked_updated_at,o.search_id LIMIT 1`;
export const recoveredSourcingImageCandidateSql = recoveryImageCandidate(
  recoveredSourcingCandidateSql,
);

type Schedule = (
  connection: PoolConnection,
  row: RowDataPacket,
  taskId: string,
  target: Record<string, unknown>,
  requestId: string,
  traceId: string,
  ownership: CalculationOwnership,
) => Promise<void>;

/** One PK lock and a fresh eligibility read; never lock the historical scan. */
export async function recoverCircuitHeldSourcing(pool: Pool, schedule: Schedule, now: Date) {
  const accountMode = await hasCalculationAccountCutover(pool);
  const candidateSql = accountMode
    ? accountRecoveredSourcingCandidateSql
    : recoveredSourcingCandidateSql;
  const [candidates] = await pool.query<RowDataPacket[]>(recoveryImageCandidate(candidateSql), [
    now,
  ]);
  const candidate = candidates[0];
  if (!candidate) return false;
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const scope = accountMode
      ? [candidate.search_id]
      : [candidate.search_id, candidate.organization_id, candidate.workspace_id];
    const predicate = accountMode ? "id=?" : "id=? AND organization_id=? AND workspace_id=?";
    const [locked] = await c.query<RowDataPacket[]>(
      `SELECT collection_task_id FROM sourcing_searches WHERE ${predicate} AND deleted_at IS NULL FOR UPDATE`,
      scope,
    );
    if (!locked[0] || locked[0].collection_task_id !== candidate.previous_task_id) {
      await c.commit();
      return false;
    }
    const [eligible] = await c.query<RowDataPacket[]>(
      candidateSql +
        (accountMode
          ? " AND ss.id=? AND q.id=? AND so.account_id=? LIMIT 1 FOR UPDATE"
          : " AND ss.id=? AND ss.organization_id=? AND ss.workspace_id=? LIMIT 1"),
      [now, ...scope, ...(accountMode ? [candidate.subquery_id, candidate.account_id] : [])],
    );
    const row = eligible[0];
    if (!row || row.previous_task_id !== candidate.previous_task_id) {
      await c.commit();
      return false;
    }
    const ownership = await resolveCalculationOwnership(c, String(row.opportunity_id));
    if (
      (!accountMode && ownership !== null) ||
      (accountMode && (!ownership?.owner || ownership.owner.account_id !== row.account_id)) ||
      !(await calculationOwnersMatch(c, ownership, [
        ["sourcing_searches", String(row.search_id)],
        ["collection_tasks", String(row.previous_task_id)],
        ...(accountMode ? [["collection_subqueries", String(row.subquery_id)] as const] : []),
      ]))
    ) {
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
      ownership,
    );
    const [updated] = await c.query<ResultSetHeader>(
      `UPDATE sourcing_searches SET collection_task_id=?,status='queued',candidate_count=0,missing_fields_json='[]',updated_at=? WHERE ${predicate} AND collection_task_id=? AND deleted_at IS NULL AND candidate_count=0 AND status IN ('queued','succeeded_empty')`,
      [taskId, now, ...scope, row.previous_task_id],
    );
    if (updated.affectedRows !== 1) throw new Error("sourcing_recovery_link_changed");
    const eventId = randomUUID();
    await appendSourcingEvent(c, {
      id: eventId,
      ...(accountMode
        ? {}
        : { organizationId: row.organization_id, workspaceId: row.workspace_id }),
      eventType: "sourcing.search.circuit_requeued",
      resourceId: row.search_id,
      actorId: "ai-selection-worker",
      payloadJson: JSON.stringify({
        previous_task_id: row.previous_task_id,
        collection_task_id: taskId,
        provider_id: row.provider_id,
        recovered_at: row.recovered_at,
      }),
      requestId,
      traceId,
      createdAt: now,
    });
    await registerCalculationOwners(c, ownership, [["sourcing_events", eventId]]);
    await c.commit();
    return true;
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}
