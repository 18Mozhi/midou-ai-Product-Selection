import { trendTopicEventReadRelation } from "@scoutops/database";
import { opportunityEventReadRelation } from "@scoutops/database";
import {
  latestCompetitorDetailSnapshotSql,
  selectionCompetitionGateSql,
  selectionCompetitorRelevanceSql,
  selectionPrimaryAsinSql,
} from "@scoutops/database";
import {
  PRIMARY_SOURCE_SUPPORT_REVISION,
  PRIMARY_SOURCE_SUPPORT_EVENT,
} from "./primary-source-support-contract.js";
import { accountCompletionRankProof, nativeCompletionPrimaryAsin, nativeCompletionTaskProof } from "./native-completion-task-proof.js";

/** Scheduling proof only. Evaluation/completion still recheck the full current fingerprint. */
const approvedSourceSql = (native: boolean) => `EXISTS (SELECT 1 FROM ${opportunityEventReadRelation} source_approval
  JOIN ${trendTopicEventReadRelation} source_origin ON source_origin.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.origin_event_id')) USING ascii)
    AND BINARY source_origin.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.origin_event_id'))
    AND source_origin.organization_id=source_approval.organization_id AND source_origin.workspace_id=source_approval.workspace_id
    AND source_origin.event_type='trend.intelligence.primary_selected' AND source_origin.resource_type='trend_topic'
    AND BINARY JSON_UNQUOTE(JSON_EXTRACT(source_origin.payload_json,'$.intelligence_source_record_id'))=
      BINARY JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.intelligence_record_id'))
  JOIN normalized_records source_news ON source_news.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.intelligence_record_id')) USING ascii)
    AND BINARY source_news.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.intelligence_record_id'))
    ${native ? "" : "AND source_news.organization_id=source_approval.organization_id AND source_news.workspace_id=source_approval.workspace_id"}
    AND source_news.status IN ('active','superseded')
  WHERE source_approval.organization_id=o.organization_id AND source_approval.workspace_id=o.workspace_id
    ${native ? "AND source_news.account_id=o.account_id" : ""}
    AND source_origin.resource_id=o.source_ref_id
    AND BINARY JSON_UNQUOTE(JSON_EXTRACT(source_origin.payload_json,'$.opportunity_id'))=BINARY o.id
    AND source_approval.resource_id=o.id AND source_approval.resource_type='opportunity' AND source_approval.actor_type='worker'
    AND source_approval.event_type='${PRIMARY_SOURCE_SUPPORT_EVENT}'
    AND JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.revision'))='${PRIMARY_SOURCE_SUPPORT_REVISION}'
    AND JSON_TYPE(JSON_EXTRACT(source_approval.payload_json,'$.supported'))='BOOLEAN'
    AND JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.supported'))='true'
    AND JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.fingerprint')) REGEXP '^[a-f0-9]{64}$'
    AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.primary_asin')))=BINARY o.primary_asin
    AND NOT EXISTS (SELECT 1 FROM ${opportunityEventReadRelation} newer_source WHERE newer_source.organization_id=source_approval.organization_id
      AND newer_source.workspace_id=source_approval.workspace_id AND newer_source.resource_id=source_approval.resource_id
      AND newer_source.resource_type=source_approval.resource_type AND newer_source.actor_type='worker'
      AND newer_source.event_type=source_approval.event_type AND (newer_source.occurred_at>source_approval.occurred_at
        OR (newer_source.occurred_at=source_approval.occurred_at AND newer_source.id>source_approval.id)))
    AND NOT EXISTS (SELECT 1 FROM ${trendTopicEventReadRelation} newer_origin WHERE newer_origin.organization_id=source_origin.organization_id
      AND newer_origin.workspace_id=source_origin.workspace_id AND newer_origin.resource_type=source_origin.resource_type
      AND newer_origin.resource_id=source_origin.resource_id AND newer_origin.event_type=source_origin.event_type
      AND BINARY JSON_UNQUOTE(JSON_EXTRACT(newer_origin.payload_json,'$.opportunity_id'))=BINARY o.id
      AND (newer_origin.occurred_at>source_origin.occurred_at
        OR (newer_origin.occurred_at=source_origin.occurred_at AND newer_origin.id>source_origin.id))))`;

export const completionCompetitorApprovedSourceSql = approvedSourceSql(false);
const owner = (table: string, id: string, account: string) =>
  `EXISTS (SELECT 1 FROM account_owned_records rank_owner WHERE rank_owner.source_table='${table}'
    AND rank_owner.source_id=${id} AND rank_owner.account_id=${account})`;
const pendingDetails = (native: boolean) => `SELECT STRAIGHT_JOIN t.id task_id,c.id competitor_id,c.opportunity_id,c.organization_id,c.workspace_id${native ? ",t.account_id" : ""}
  FROM collection_tasks t JOIN collection_subqueries q ON q.task_id=t.id
  JOIN competitors c ON c.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id')) USING ascii)
    AND ${native ? owner("competitors", "c.id", "t.account_id") : "c.organization_id=t.organization_id AND c.workspace_id=t.workspace_id"}
    AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id'))=BINARY c.id
  JOIN providers p ON p.id=q.provider_id AND p.id=c.provider_id
  WHERE t.status='queued' AND t.available_at<=NOW(3)
    AND t.attempt_count<4 AND q.status='pending' AND p.code='amazon_product' AND p.status='enabled'
    AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0
    AND (p.terms_permanent=1 OR p.terms_expires_at>NOW(3))
    AND NOT EXISTS (SELECT 1 FROM provider_runtime_circuits circuit WHERE circuit.provider_id=p.id AND circuit.state='open')
    AND c.status='active' AND c.deleted_at IS NULL AND c.source_site='Amazon'
    AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot'
    ${native ? `AND ${owner("collection_tasks", "t.id", "t.account_id")} AND ${owner("collection_subqueries", "q.id", "t.account_id")}` : ""}
    AND EXISTS (SELECT 1 FROM collection_task_events e WHERE e.task_id=t.id
      AND e.actor_type='worker' AND e.event_type='competitor.detail.auto_scheduled'
      ${native ? `AND ${owner("collection_task_events", "e.id", "t.account_id")}` : ""})`;

// Evaluate opportunity-wide evidence once per cohort, not once per queued competitor.
const candidateOpportunities = (native: boolean) => `SELECT o.id,o.market,o.organization_id,o.workspace_id,o.source_ref_id,${native ? nativeCompletionPrimaryAsin("scopes.account_id") : selectionPrimaryAsinSql} primary_asin${native ? ",scopes.account_id" : ""}
  FROM (SELECT DISTINCT pending.opportunity_id,pending.organization_id,pending.workspace_id${native ? ",pending.account_id" : ""}
    FROM (${pendingDetails(native)} LIMIT 18446744073709551615) pending) scopes
  JOIN opportunities o ON o.id=scopes.opportunity_id AND o.organization_id=scopes.organization_id AND o.workspace_id=scopes.workspace_id
    ${native ? `AND ${owner("opportunities", "o.id", "scopes.account_id")}` : ""}
  JOIN organizations org ON org.id=o.organization_id AND org.status='active'
  JOIN workspaces ws ON ws.id=o.workspace_id AND ws.organization_id=o.organization_id AND ws.status='active'
  WHERE o.source_type='trend_topic' AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted')`;

const readyOpportunities = (native: boolean) => `SELECT o.* FROM (${candidateOpportunities(native)} LIMIT 18446744073709551615) o
  WHERE ${approvedSourceSql(native)}
    AND NOT ${selectionCompetitionGateSql(5, "materialized")}
    AND EXISTS (SELECT 1 FROM competitors c JOIN competitor_snapshots s_main ON s_main.id=${latestCompetitorDetailSnapshotSql("c")}
      WHERE c.opportunity_id=o.id AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id
        AND c.source_site='Amazon' AND c.status='active' AND c.deleted_at IS NULL AND c.market=o.market
        AND BINARY UPPER(c.external_id)=BINARY o.primary_asin
        AND s_main.freshness='fresh' AND s_main.source_status='healthy'
        AND s_main.current_price IS NOT NULL AND s_main.currency IS NOT NULL
        AND s_main.review_count IS NOT NULL AND s_main.rating_value IS NOT NULL)`;

/** Finish the original minimum cohort before spending the same completion turn on more primary discovery. */
const completionReadyCompetitorRows = (native: boolean) => `SELECT pending.task_id,o.id opportunity_id,pending.competitor_id,o.primary_asin
  FROM (${readyOpportunities(native)} LIMIT 18446744073709551615) o
  JOIN (${pendingDetails(native)} LIMIT 18446744073709551615) pending
    ON pending.opportunity_id=o.id AND pending.organization_id=o.organization_id AND pending.workspace_id=o.workspace_id
    ${native ? "AND pending.account_id=o.account_id" : ""}
  JOIN competitors c_sample ON c_sample.id=pending.competitor_id AND c_sample.organization_id=o.organization_id AND c_sample.workspace_id=o.workspace_id
  WHERE c_sample.market=o.market AND BINARY UPPER(c_sample.external_id)<>BINARY o.primary_asin
    AND ${selectionCompetitorRelevanceSql.replaceAll(selectionPrimaryAsinSql, "o.primary_asin")}
    AND NOT EXISTS (SELECT 1 FROM competitor_snapshots s_sample WHERE s_sample.id=${latestCompetitorDetailSnapshotSql("c_sample")}
      AND s_sample.freshness='fresh' AND s_sample.source_status='healthy' AND s_sample.current_price IS NOT NULL
      AND s_sample.currency IS NOT NULL AND s_sample.review_count IS NOT NULL AND s_sample.rating_value IS NOT NULL)`;

/** Preference only: no task, source, snapshot, score or completion event is changed. */
export const completionReadyCompetitorRowsSql = completionReadyCompetitorRows(false);
export const nativeCompletionReadyCompetitorRowsSql = nativeCompletionTaskProof(completionReadyCompetitorRows(true), "o.account_id");
const preference = (rows: string) => `EXISTS (SELECT 1 FROM (${rows}
  LIMIT 18446744073709551615) close_competitor WHERE close_competitor.task_id=collection_tasks.id)`;
export const completionReadyCompetitorTaskSql = preference(completionReadyCompetitorRowsSql);
export const nativeCompletionReadyCompetitorTaskSql = preference(nativeCompletionReadyCompetitorRowsSql);
export const accountCompetitorCompletionRankTaskSql = [0, 1, 2].map(shape => preference(
  accountCompletionRankProof(nativeCompletionTaskProof(completionReadyCompetitorRows(true), "o.account_id", shape > 0), shape > 0, shape === 2),
));
