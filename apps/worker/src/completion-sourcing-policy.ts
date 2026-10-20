import {
  latestCompetitorDetailSnapshotSql,
  selectionCompetitionGateSql,
  selectionPrimaryAsinSql,
} from "@scoutops/database";

const pendingSourceSql = `SELECT t.id task_id,ss.id search_id,ss.organization_id,ss.workspace_id,ss.input_ref opportunity_id
  FROM sourcing_searches ss JOIN collection_tasks t ON t.id=ss.collection_task_id
    AND t.organization_id=ss.organization_id AND t.workspace_id=ss.workspace_id
  JOIN collection_subqueries q ON q.task_id=t.id AND q.organization_id=t.organization_id AND q.workspace_id=t.workspace_id
  JOIN providers p ON p.id=q.provider_id
  WHERE ss.input_type='opportunity' AND ss.deleted_at IS NULL AND ss.status='queued'
    AND t.status IN ('queued','scheduled','retry_scheduled','rate_limited') AND t.available_at<=NOW(3)
    AND p.code='1688_search' AND p.status='enabled' AND p.access_mode='authenticated_browser'
    AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0
    AND (p.terms_permanent=1 OR p.terms_expires_at>NOW(3)) AND q.status='pending'
    AND NOT EXISTS (SELECT 1 FROM provider_runtime_circuits source_circuit WHERE source_circuit.provider_id=p.id AND source_circuit.state='open')
    AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search'
    AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.search_id'))=BINARY ss.id
    AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query_contract'))='supplier-keywords-v2'
    AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.image_url')) REGEXP '^https://(m[.]media-amazon[.]com|images-na[.]ssl-images-amazon[.]com)/'
    AND EXISTS (SELECT 1 FROM collection_task_events a WHERE a.task_id=t.id AND a.organization_id=t.organization_id
      AND a.workspace_id=t.workspace_id AND a.actor_type='worker' AND a.event_type='sourcing.collection.auto_scheduled')
    AND NOT EXISTS (SELECT 1 FROM sourcing_searches newer WHERE newer.input_type='opportunity'
      AND newer.input_ref=ss.input_ref AND newer.organization_id=ss.organization_id AND newer.workspace_id=ss.workspace_id
      AND newer.deleted_at IS NULL AND (newer.created_at>ss.created_at OR (newer.created_at=ss.created_at AND newer.id>ss.id)))`;

/** Materialize the small pending-source set and primary identity before the existing formal evidence gates. */
export const completionReadySourcingRowsSql = `SELECT o.task_id,o.search_id,o.id opportunity_id,o.organization_id,o.workspace_id,o.primary_asin
  FROM (SELECT candidate.*,o.id,o.market,${selectionPrimaryAsinSql} primary_asin
    FROM (${pendingSourceSql} LIMIT 18446744073709551615) candidate
    JOIN opportunities o ON o.id=candidate.opportunity_id AND o.organization_id=candidate.organization_id AND o.workspace_id=candidate.workspace_id
    JOIN organizations org ON org.id=o.organization_id AND org.status='active'
    JOIN workspaces ws ON ws.id=o.workspace_id AND ws.organization_id=o.organization_id AND ws.status='active'
    WHERE o.source_type='trend_topic' AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted')
      AND EXISTS (SELECT 1 FROM automatic_selection_evaluations e WHERE e.opportunity_id=o.id
        AND e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id AND e.status='waiting_evidence'
        AND e.last_error_code IN ('high_confidence_1688_match_missing','automatic_cost_scope_mismatch'))
      AND NOT EXISTS (SELECT 1 FROM opportunity_cost_inputs ci WHERE ci.opportunity_id=o.id
        AND ci.organization_id=o.organization_id AND ci.workspace_id=o.workspace_id AND ci.platform='amazon'
        AND ci.input_type='purchase_price' AND ci.is_current=1 AND ci.amount_value>0)
    LIMIT 18446744073709551615) o
  WHERE ${selectionCompetitionGateSql(5, "materialized")}
    AND EXISTS (SELECT 1 FROM competitors c JOIN competitor_snapshots s_main ON s_main.id=${latestCompetitorDetailSnapshotSql("c")}
      WHERE c.opportunity_id=o.id AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id
        AND c.source_site='Amazon' AND c.status='active' AND c.deleted_at IS NULL AND c.market=o.market
        AND BINARY UPPER(c.external_id)=BINARY o.primary_asin AND s_main.organization_id=c.organization_id
        AND s_main.workspace_id=c.workspace_id AND s_main.freshness='fresh' AND s_main.source_status='healthy'
        AND s_main.current_price IS NOT NULL AND s_main.currency IS NOT NULL
        AND s_main.review_count IS NOT NULL AND s_main.rating_value IS NOT NULL)`;

/** This is a scheduling preference, never permission to accept a quote or complete a product. */
export const completionReadySourcingTaskSql = `EXISTS (SELECT 1 FROM (${completionReadySourcingRowsSql}
  LIMIT 18446744073709551615) close_sourcing WHERE close_sourcing.task_id=collection_tasks.id)`;
