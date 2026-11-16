import { randomUUID } from "node:crypto";
import {
  calculationOwnersMatch, hasCalculationAccountCutover, registerCalculationOwners, resolveCalculationOwnership, type CalculationOwnership,
} from "./opportunity-calculation-ownership.js";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { appendSourcingEvent, latestCompetitorDetailSnapshotSql, selectionPrimaryAsinSql, sourcingSearchHasLegacyScope } from "@scoutops/database";
import {
  automaticPrimaryImageSql,
  automaticPrimaryTitleSql,
  hasNativeNormalizedAccountScope,
  readAutomaticPrimaryEvidence,
} from "./automatic-selection-evidence.js";
import { normalizedProductFields } from "./automatic-selection-evaluation.js";
import { automaticCollectionBacklogCountSql } from "./collection-source-scheduling-policy.js";
import { sealedAccountCollectionBacklogCountSql as accountCollectionBacklogCountSql } from "./collection-account-backlog.js";
import { buildSupplierSearchQuery } from "./trend-projection-calculation.js";

// A main detail can outlive its original trend link. Use its exact normalized evidence,
// not the editable opportunity name or a different competitor's title.
const refreshTitleSql = `COALESCE(${automaticPrimaryTitleSql},(SELECT JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.title'))
  FROM competitors c JOIN competitor_snapshots s_title ON s_title.id=${latestCompetitorDetailSnapshotSql("c")}
  JOIN normalized_records n ON n.id=CONVERT(RIGHT(s_title.source_ref_id,36) USING ascii)
    AND n.raw_evidence_id=s_title.evidence_id AND n.organization_id=c.organization_id AND n.workspace_id=c.workspace_id
    AND n.status IN ('active','superseded')
  WHERE c.opportunity_id=o.id AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id
    AND c.source_site='Amazon' AND c.market=o.market AND c.status='active' AND c.deleted_at IS NULL
    AND BINARY c.external_id=BINARY o.primary_asin
    AND JSON_TYPE(JSON_EXTRACT(n.payload_json,'$.title'))='STRING'
    AND CHAR_LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.title'))))>0
  ORDER BY s_title.captured_at DESC,s_title.id DESC LIMIT 1))`;

/** Successful automatic searches expire at the existing source cadence; history is immutable. */
export const automaticSourcingRefreshEligibilitySql = `SELECT ss.id search_id,ss.organization_id,ss.workspace_id,
  ss.collection_task_id previous_task_id,ss.input_ref opportunity_id,t.created_by,p.id provider_id,ss.updated_at
  FROM sourcing_searches ss
  JOIN opportunities o ON o.id=ss.input_ref AND o.organization_id=ss.organization_id AND o.workspace_id=ss.workspace_id
  JOIN organizations org ON org.id=ss.organization_id AND org.status='active'
  JOIN workspaces ws ON ws.id=ss.workspace_id AND ws.organization_id=ss.organization_id AND ws.status='active'
  JOIN collection_tasks t ON t.id=ss.collection_task_id AND t.organization_id=ss.organization_id AND t.workspace_id=ss.workspace_id
  JOIN collection_subqueries q ON q.task_id=t.id
  JOIN providers p ON p.id=q.provider_id
  WHERE ss.input_type='opportunity' AND ss.deleted_at IS NULL
    AND ss.status IN ('completed_with_warnings','succeeded_empty')
    AND t.status IN ('succeeded','succeeded_empty','completed_with_warnings')
    AND q.status IN ('succeeded','succeeded_empty')
    AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search'
    AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.search_id'))=BINARY ss.id
    AND p.code='1688_search' AND p.status='enabled' AND p.access_mode='authenticated_browser'
    AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0
    AND (p.terms_permanent=1 OR p.terms_expires_at>?)
    AND p.schedule_minutes BETWEEN 1 AND 10080
    AND TIMESTAMPADD(MINUTE,p.schedule_minutes,ss.updated_at)<=?
    AND NOT EXISTS (SELECT 1 FROM provider_runtime_circuits rc WHERE rc.provider_id=p.id AND rc.state='open')
    AND o.source_type='trend_topic' AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted')
    AND EXISTS (SELECT 1 FROM automatic_selection_evaluations e WHERE e.opportunity_id=o.id
      AND e.status='waiting_evidence'
      AND e.last_error_code IN ('high_confidence_1688_match_missing','automatic_cost_scope_mismatch'))
    AND NOT EXISTS (SELECT 1 FROM opportunity_cost_inputs ci WHERE ci.opportunity_id=o.id
      AND ci.platform='amazon' AND ci.input_type='purchase_price' AND ci.is_current=1 AND ci.amount_value>0)
    AND EXISTS (SELECT 1 FROM collection_task_events a WHERE a.task_id=t.id
      AND a.event_type='sourcing.collection.auto_scheduled' AND a.actor_type='worker')
    AND NOT EXISTS (SELECT 1 FROM sourcing_searches newer WHERE newer.input_type='opportunity'
      AND newer.input_ref=ss.input_ref AND newer.organization_id=ss.organization_id AND newer.workspace_id=ss.workspace_id
      AND newer.deleted_at IS NULL AND (newer.created_at>ss.created_at OR (newer.created_at=ss.created_at AND newer.id>ss.id)))
    AND NOT EXISTS (SELECT 1 FROM sourcing_searches running_search JOIN collection_tasks running_task
      ON running_task.id=running_search.collection_task_id AND running_task.organization_id=running_search.organization_id
      AND running_task.workspace_id=running_search.workspace_id WHERE running_search.input_type='opportunity'
      AND running_search.input_ref=o.id AND running_search.organization_id=o.organization_id
      AND running_search.workspace_id=o.workspace_id AND running_search.deleted_at IS NULL
      AND running_task.status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited'))
    AND ${automaticCollectionBacklogCountSql}<?`;

const currentPrimarySql = (
  scopeSql = "",
) => `SELECT o.* FROM (SELECT refresh.*,o.id,o.market,${selectionPrimaryAsinSql} primary_asin
  FROM (${automaticSourcingRefreshEligibilitySql}${scopeSql} LIMIT 18446744073709551615) refresh
  JOIN opportunities o ON o.id=refresh.opportunity_id AND o.organization_id=refresh.organization_id
    AND o.workspace_id=refresh.workspace_id LIMIT 18446744073709551615) o
  WHERE EXISTS (SELECT 1 FROM competitors c WHERE c.opportunity_id=o.id
    AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id AND c.source_site='Amazon'
    AND c.status='active' AND c.deleted_at IS NULL AND c.market=o.market AND BINARY c.external_id=BINARY o.primary_asin
    AND ${latestCompetitorDetailSnapshotSql("c")} IS NOT NULL)
  AND BINARY (${automaticPrimaryImageSql}) REGEXP '^https://(m[.]media-amazon[.]com|images-na[.]ssl-images-amazon[.]com)/'
  AND CHAR_LENGTH((${refreshTitleSql}))>0`;
export const automaticSourcingRefreshCandidateSql =
  automaticSourcingRefreshEligibilitySql + " ORDER BY ss.updated_at,ss.id";
export const automaticSourcingRefreshPrimarySql =
  currentPrimarySql(" AND ss.id=? AND ss.organization_id=? AND ss.workspace_id=?") + " LIMIT 1";

const refreshAccountEligibility = automaticSourcingRefreshEligibilitySql
  .replace(automaticCollectionBacklogCountSql, accountCollectionBacklogCountSql)
  .replace("ss.id search_id,ss.organization_id,ss.workspace_id","ss.id search_id,o.organization_id,o.workspace_id,so.account_id,q.id subquery_id")
  .replace(/JOIN opportunities o ON o.id=ss.input_ref[\s\S]+?JOIN collection_subqueries q ON q.task_id=t.id/, `JOIN opportunities o ON o.id=ss.input_ref
  JOIN collection_tasks t ON t.id=ss.collection_task_id
  JOIN collection_subqueries q ON q.task_id=t.id
  JOIN account_owned_records so ON so.source_table='sourcing_searches' AND so.source_id=ss.id
  JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
    AND (so.reason='exclusive_owner' OR (so.reason IN ('shared','unassigned') AND so.account_id=cut.primary_account_id))
  JOIN account_owned_records oo ON oo.source_table='opportunities' AND oo.source_id=o.id AND oo.account_id=so.account_id
  JOIN account_owned_records too ON too.source_table='collection_tasks' AND too.source_id=t.id AND too.account_id=so.account_id
  JOIN account_owned_records qo ON qo.source_table='collection_subqueries' AND qo.source_id=q.id AND qo.account_id=so.account_id`)
  .replace("newer.organization_id=ss.organization_id AND newer.workspace_id=ss.workspace_id",
    "EXISTS (SELECT 1 FROM account_owned_records no WHERE no.source_table='sourcing_searches' AND no.source_id=newer.id AND no.account_id=so.account_id)")
  .replace(" AND running_task.organization_id=running_search.organization_id\n      AND running_task.workspace_id=running_search.workspace_id","")
  .replace("running_search.organization_id=o.organization_id\n      AND running_search.workspace_id=o.workspace_id",
    "EXISTS (SELECT 1 FROM account_owned_records ro WHERE ro.source_table='sourcing_searches' AND ro.source_id=running_search.id AND ro.account_id=so.account_id) " +
    "AND EXISTS (SELECT 1 FROM account_owned_records rt WHERE rt.source_table='collection_tasks' AND rt.source_id=running_task.id AND rt.account_id=so.account_id)");
export const accountSourcingRefreshCandidateSql = refreshAccountEligibility + " ORDER BY ss.updated_at,ss.id";
const accountSourcingRefreshPrimarySql = currentPrimarySql(" AND ss.id=? AND q.id=? AND so.account_id=?")
  .replace(automaticSourcingRefreshEligibilitySql,refreshAccountEligibility) + " LIMIT 1";
const nativeSourcingRefreshRecheckSql = refreshAccountEligibility + " AND ss.id=? AND q.id=? AND so.account_id=? LIMIT 1";
const imageAllowed = (value: unknown): value is string => typeof value === "string" &&
  /^https:\/\/(m\.media-amazon\.com|images-na\.ssl-images-amazon\.com)\//.test(value);

async function nativeRefreshFacts(db: Pick<Pool, "query">, row: RowDataPacket) {
  const {linked, detail} = await readAutomaticPrimaryEvidence(db, {
    opportunityId: String(row.opportunity_id), accountId: String(row.account_id),
    organizationId: String(row.organization_id), workspaceId: String(row.workspace_id),
  });
  if (!linked || !detail) return null;
  const fields = [linked, detail].map(record => {
    const payload = record.payload_json;
    return normalizedProductFields(typeof payload === "string" ? JSON.parse(payload) : payload);
  });
  const image_url = fields.map(field => field.image_url).find(imageAllowed);
  const title = fields.map(field => field.title).find(value => typeof value === "string" && value.trim());
  return image_url && title ? {image_url, title} : null;
}

type Schedule = (
  connection: PoolConnection,
  row: RowDataPacket,
  taskId: string,
  target: Record<string, unknown>,
  requestId: string,
  traceId: string,
  ownership: CalculationOwnership,
) => Promise<void>;

export async function refreshStaleAutomaticSourcing(
  pool: Pool,
  schedule: Schedule,
  now: Date,
  backlogLimit: number,
) {
  const params = [now, now, backlogLimit];
  const accountMode = await hasCalculationAccountCutover(pool);
  const native = accountMode && await hasNativeNormalizedAccountScope(pool);
  const primarySql = native ? nativeSourcingRefreshRecheckSql
    : accountMode ? accountSourcingRefreshPrimarySql : automaticSourcingRefreshPrimarySql;
  const scopeOf = (r: RowDataPacket) => accountMode ? [r.search_id,r.subquery_id,r.account_id]
    : [r.search_id,r.organization_id,r.workspace_id];
  const [candidates] = await pool.query<RowDataPacket[]>(
    accountMode ? accountSourcingRefreshCandidateSql : automaticSourcingRefreshCandidateSql,
    params,
  );
  // Resolve one scoped primary at a time instead of sorting an expensive correlated
  // primary/detail expression over the whole history. Missing images do not hide later rows.
  let candidate: RowDataPacket | undefined;
  for (const item of candidates) {
    const [ready] = await pool.query<RowDataPacket[]>(primarySql, [
      ...params,
      ...scopeOf(item),
    ]);
    if (ready[0] && (!native || await nativeRefreshFacts(pool, ready[0]))) {
      candidate = ready[0];
      break;
    }
  }
  if (!candidate) return false;
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const scope = scopeOf(candidate);
    const [locked] = await c.query<RowDataPacket[]>(
      "SELECT collection_task_id FROM sourcing_searches WHERE id=? " +
        (accountMode ? "" : "AND organization_id=? AND workspace_id=? ") + "AND deleted_at IS NULL FOR UPDATE",
      accountMode ? [candidate.search_id] : scope,
    );
    if (locked[0]?.collection_task_id !== candidate.previous_task_id) {
      await c.commit();
      return false;
    }
    // Serialize new searches for this opportunity; the admission scan never locks a range.
    await c.query(
      "SELECT id FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
      [candidate.opportunity_id, candidate.organization_id, candidate.workspace_id],
    );
    const [rows] = await c.query<RowDataPacket[]>(primarySql, [
      ...params,
      ...scope,
    ]);
    const row = rows[0];
    if (!row || row.previous_task_id !== candidate.previous_task_id) {
      await c.commit();
      return false;
    }
    const ownership = await resolveCalculationOwnership(c,String(row.opportunity_id));
    if ((!accountMode && ownership !== null) ||
      (accountMode && (!ownership?.owner || ownership.owner.account_id !== row.account_id)) ||
      !(await calculationOwnersMatch(c,ownership,[
      ["sourcing_searches",String(row.search_id)],["collection_tasks",String(row.previous_task_id)],
      ...(accountMode ? [["collection_subqueries",String(row.subquery_id)] as const] : []),
    ]))) {
      await c.commit();
      return false;
    }
    const facts = native ? await nativeRefreshFacts(c, row) : (await c.query<RowDataPacket[]>(
      `SELECT ${automaticPrimaryImageSql} image_url,
      ${refreshTitleSql} title FROM (SELECT o.*,${selectionPrimaryAsinSql} primary_asin FROM opportunities o
      WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? LIMIT 1) o`,
      [row.opportunity_id, row.organization_id, row.workspace_id],
    ))[0][0];
    const image = facts?.image_url,
      title = facts?.title;
    if (
      !imageAllowed(image) ||
      typeof title !== "string" ||
      !title.trim()
    ) {
      await c.commit();
      return false;
    }
    const legacySearchScope = !accountMode || await sourcingSearchHasLegacyScope(c);
    const searchId = randomUUID(),
      taskId = randomUUID(),
      requestId = randomUUID(),
      traceId = randomUUID();
    await schedule(
      c,
      row,
      taskId,
      {
        query: buildSupplierSearchQuery(title),
        image_url: image,
        query_contract: "supplier-keywords-v2",
        projection_type: "sourcing_search",
        search_id: searchId,
      },
      requestId,
      traceId,
      ownership,
    );
    await c.query(
      `INSERT INTO sourcing_searches (id,${legacySearchScope ? "organization_id,workspace_id," : ""}collection_task_id,input_type,input_ref,status,candidate_count,missing_fields_json,request_id,trace_id,created_by,created_at,updated_at) VALUES (?,${legacySearchScope ? "?,?," : ""}?,'opportunity',?,'queued',0,'[]',?,?,?,?,?)`,
      [
        searchId,
        ...(legacySearchScope ? [row.organization_id,row.workspace_id] : []),
        taskId,
        row.opportunity_id,
        requestId,
        traceId,
        row.created_by,
        now,
        now,
      ],
    );
    const eventId = randomUUID();
    await appendSourcingEvent(c, {
      id: eventId, ...(accountMode ? {} : {organizationId:row.organization_id,workspaceId:row.workspace_id}),
      eventType: "sourcing.search.seeded_from_opportunity", resourceId: searchId, actorId: "ai-selection-worker",
      payloadJson: JSON.stringify({
          opportunity_id: row.opportunity_id,
          candidate_count: 0,
          previous_search_id: row.search_id,
          refresh_reason: "source_schedule_due",
        }),
      requestId, traceId, createdAt: now,
    });
    await registerCalculationOwners(c,ownership,[["sourcing_searches",searchId],["sourcing_events",eventId]]);
    await c.commit();
    return true;
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}
