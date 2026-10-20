import {
  latestCompetitorDetailSnapshotSql,
  selectionCompetitionGateSql,
  selectionCompetitorRelevanceSql,
  selectionPrimaryAsinSql,
} from "@scoutops/database";

const pendingDetailsSql = `SELECT STRAIGHT_JOIN t.id task_id,c.id competitor_id,c.opportunity_id,c.organization_id,c.workspace_id
  FROM collection_tasks t JOIN collection_subqueries q ON q.task_id=t.id AND q.organization_id=t.organization_id AND q.workspace_id=t.workspace_id
  JOIN competitors c ON c.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id')) USING ascii)
    AND c.organization_id=q.organization_id AND c.workspace_id=q.workspace_id
    AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id'))=BINARY c.id
  JOIN providers p ON p.id=q.provider_id AND p.id=c.provider_id
  WHERE t.status='queued' AND t.available_at<=NOW(3)
    AND t.attempt_count<4 AND q.status='pending' AND p.code='amazon_product' AND p.status='enabled'
    AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0
    AND (p.terms_permanent=1 OR p.terms_expires_at>NOW(3))
    AND NOT EXISTS (SELECT 1 FROM provider_runtime_circuits circuit WHERE circuit.provider_id=p.id AND circuit.state='open')
    AND c.status='active' AND c.deleted_at IS NULL AND c.source_site='Amazon'
    AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot'
    AND EXISTS (SELECT 1 FROM collection_task_events e WHERE e.task_id=t.id AND e.organization_id=t.organization_id
      AND e.workspace_id=t.workspace_id AND e.actor_type='worker' AND e.event_type='competitor.detail.auto_scheduled')`;

// Evaluate opportunity-wide evidence once per cohort, not once per queued competitor.
const candidateOpportunitiesSql = `SELECT o.id,o.market,o.organization_id,o.workspace_id,${selectionPrimaryAsinSql} primary_asin
  FROM (SELECT DISTINCT pending.opportunity_id,pending.organization_id,pending.workspace_id
    FROM (${pendingDetailsSql} LIMIT 18446744073709551615) pending) scopes
  JOIN opportunities o ON o.id=scopes.opportunity_id AND o.organization_id=scopes.organization_id AND o.workspace_id=scopes.workspace_id
  JOIN organizations org ON org.id=o.organization_id AND org.status='active'
  JOIN workspaces ws ON ws.id=o.workspace_id AND ws.organization_id=o.organization_id AND ws.status='active'
  WHERE o.source_type='trend_topic' AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted')`;

const readyOpportunitiesSql = `SELECT o.* FROM (${candidateOpportunitiesSql} LIMIT 18446744073709551615) o
  WHERE NOT ${selectionCompetitionGateSql(5, "materialized")}
    AND EXISTS (SELECT 1 FROM competitors c JOIN competitor_snapshots s_main ON s_main.id=${latestCompetitorDetailSnapshotSql("c")}
      WHERE c.opportunity_id=o.id AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id
        AND c.source_site='Amazon' AND c.status='active' AND c.deleted_at IS NULL AND c.market=o.market
        AND BINARY UPPER(c.external_id)=BINARY o.primary_asin AND s_main.organization_id=c.organization_id
        AND s_main.workspace_id=c.workspace_id AND s_main.freshness='fresh' AND s_main.source_status='healthy'
        AND s_main.current_price IS NOT NULL AND s_main.currency IS NOT NULL
        AND s_main.review_count IS NOT NULL AND s_main.rating_value IS NOT NULL)`;

/** Finish the original minimum cohort before spending the same completion turn on more primary discovery. */
export const completionReadyCompetitorRowsSql = `SELECT pending.task_id,o.id opportunity_id,pending.competitor_id,o.primary_asin
  FROM (${readyOpportunitiesSql} LIMIT 18446744073709551615) o
  JOIN (${pendingDetailsSql} LIMIT 18446744073709551615) pending
    ON pending.opportunity_id=o.id AND pending.organization_id=o.organization_id AND pending.workspace_id=o.workspace_id
  JOIN competitors c_sample ON c_sample.id=pending.competitor_id AND c_sample.organization_id=o.organization_id AND c_sample.workspace_id=o.workspace_id
  WHERE c_sample.market=o.market AND BINARY UPPER(c_sample.external_id)<>BINARY o.primary_asin
    AND ${selectionCompetitorRelevanceSql.replaceAll(selectionPrimaryAsinSql, "o.primary_asin")}
    AND NOT EXISTS (SELECT 1 FROM competitor_snapshots s_sample WHERE s_sample.id=${latestCompetitorDetailSnapshotSql("c_sample")}
      AND s_sample.organization_id=c_sample.organization_id AND s_sample.workspace_id=c_sample.workspace_id
      AND s_sample.freshness='fresh' AND s_sample.source_status='healthy' AND s_sample.current_price IS NOT NULL
      AND s_sample.currency IS NOT NULL AND s_sample.review_count IS NOT NULL AND s_sample.rating_value IS NOT NULL)`;

/** Preference only: no task, source, snapshot, score or completion event is changed. */
export const completionReadyCompetitorTaskSql = `EXISTS (SELECT 1 FROM (${completionReadyCompetitorRowsSql}
  LIMIT 18446744073709551615) close_competitor WHERE close_competitor.task_id=collection_tasks.id)`;
