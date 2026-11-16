import { automationRuleScopeRelation } from "./lib/automation-rule-scope.mjs";
import { approvalTemplateScopeRelation } from "./lib/approval-template-scope.mjs";
import { fileAssetScopeRelation } from "./lib/file-asset-scope.mjs";
import { assertAccountProductionFence, assertAccountProductionPrerequisitePrefix, assertAccountProductionTarget } from "./lib/account-production-fence.mjs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { readLegacyAccountScopeDefaults } from "./preview-account-scope-retirement.mjs";
import {
  evidenceAccountScopeRelations,
  evidenceEventScopeRelation,
  evidenceOutboxScopeRelation,
  qualityIssueScopeRelation,
  reconciliationScopeRelation,
} from "./lib/evidence-event-scope.mjs";
import {
  costRuleScopeRelation,
  exchangeRateQuoteScopeRelation,
  opportunityEventScopeRelation,
  scoreRuleScopeRelation,
} from "./lib/opportunity-event-scope.mjs";
import {
  trendEventScopeRelation,
  trendRuleScopeRelation,
  trendTopicHistoricalScopeRelation,
} from "./lib/trend-event-scope.mjs";

// Only verified id-based business tables. Actor, creator and assignee columns are not ownership.
const sourcingEventParents = Object.freeze({
  "sourcing.search.queued": "sourcing_searches",
  "sourcing.search.refreshed": "sourcing_searches",
  "sourcing.search.deleted": "sourcing_searches",
  "sourcing.search.projected": "sourcing_searches",
  "sourcing.search.seeded_from_opportunity": "sourcing_searches",
  "sourcing.search.circuit_requeued": "sourcing_searches",
  "supplier_quote.confirmed": "supplier_quotes",
  "sourcing.comparison.created": "sourcing_comparisons",
  "sourcing.purchase_task.queued": "sourcing_purchase_tasks",
  "sourcing.purchase_task.account_rehearsal.queued": "sourcing_purchase_tasks",
});
const sourcingEventLinks = Object.freeze(
  Object.entries(sourcingEventParents).map(([type, parent]) =>
    Object.freeze(["resource_id", parent, "event_type", type]),
  ),
);
const evidenceHistoryParents = Object.freeze({
  raw_evidence: "raw_evidence",
  browser_evidence_artifact: "browser_evidence_artifacts",
  data_quality_issue: "data_quality_issues",
  reconciliation_run: "reconciliation_runs",
});
const evidenceHistoryLinks = Object.freeze(
  Object.entries(evidenceHistoryParents).map(([type, parent]) =>
    Object.freeze(["resource_id", parent, "resource_type", type]),
  ),
);
export const approvalDeliveryTypes = Object.freeze([
  "approval.template.created",
  "approval.template.published",
  "approval.request.created",
  "approval.node.approved",
  "approval.node.rejected",
  "approval.overdue",
]);
const approvalDeliveryTypeSql = approvalDeliveryTypes.map((value) => `'${value}'`).join(",");
const taskLifecycleDeliveryTypes = Object.freeze([
  "task.created",
  "task.start",
  "task.pause",
  "task.resume",
  "task.complete",
  "task.cancel",
  "task.delay",
  "task.transfer",
  "task.progress",
  "task.comment.created",
  "task.updated",
  "task.deleted",
]);
export const taskDeliveryTypes = Object.freeze([
  ...taskLifecycleDeliveryTypes,
  "task.evidence_completion.redecision_ready",
]);
const taskLifecycleDeliveryTypeSql = taskLifecycleDeliveryTypes
  .map((value) => `'${value}'`)
  .join(",");
const genericDeliveryTypeSql = [...approvalDeliveryTypes, ...taskDeliveryTypes]
  .map((value) => `'${value}'`)
  .join(",");
const archivedTaskId = "JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.task_id'))";
const archivedAssigneeId = "JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.assignee_id'))";
const auditUuid = "'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'";
// Exact retired notification acceptance-probe signature. These rows and their notification
// references stay in the restored audit source, never in account delivery ownership.
export const notificationProbeAuditOnlySql = (
  realtimeHasScope,
  notificationHasScope = true,
  historicalRoots = false,
) => `COALESCE((
  o.event_type='task.created' AND o.schema_version=1 AND o.status='published'
  AND o.published_at IS NOT NULL
  AND o.request_id REGEXP ${auditUuid} AND o.trace_id REGEXP ${auditUuid}
  AND JSON_LENGTH(o.payload_json)=4 AND JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.resource_type'))='task'
  AND ${archivedTaskId} REGEXP ${auditUuid} AND ${archivedAssigneeId} REGEXP ${auditUuid}
  AND BINARY ${archivedTaskId}=BINARY JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.resource_id'))
  AND NOT EXISTS (SELECT 1 FROM ${historicalRoots ? "historical_organizations" : "organizations"} og WHERE og.id=o.organization_id)
  AND NOT EXISTS (SELECT 1 FROM ${historicalRoots ? "historical_workspaces" : "workspaces"} ow WHERE ow.id=o.workspace_id)
  AND NOT EXISTS (SELECT 1 FROM tasks ot WHERE ot.id=CONVERT(${archivedTaskId} USING ascii))
  AND NOT EXISTS (SELECT 1 FROM task_events oe WHERE oe.task_id=CONVERT(${archivedTaskId} USING ascii))
  AND EXISTS (SELECT 1 FROM users pu
    JOIN notifications pn ON pn.recipient_id=pu.id
    JOIN realtime_events pr ON pr.notification_id=pn.id AND pr.recipient_id=pu.id
    WHERE pu.id=CONVERT(${archivedAssigneeId} USING ascii)
      AND pn.source_event_id=o.id
      ${notificationHasScope ? "AND pn.organization_id=o.organization_id AND pn.workspace_id=o.workspace_id" : ""}
      ${realtimeHasScope ? "AND pr.organization_id=o.organization_id AND pr.workspace_id=o.workspace_id" : ""}
      AND BINARY pu.email_normalized=BINARY CONCAT('m0503-a-',LEFT(o.request_id,8),'@test.local'))
),0)`;
export const accountScopeSources = Object.freeze({
  opportunities: [["source_ref_id", "trend_topics", "source_type", "trend_topic"]],
  trend_topics: [],
  trend_topic_keywords: [["topic_id", "trend_topics"]],
  trend_events: [
    ["resource_id", "trend_topics", "resource_type", "trend_topic"],
    ["resource_id", "trend_topic_change_requests", "resource_type", "trend_topic_change_request"],
    ["resource_id", "trend_monitoring_rules", "resource_type", "trend_monitoring_rule"],
  ],
  trend_outbox: [],
  trend_projection_jobs: [["normalized_record_id", "normalized_records"]],
  trend_topic_change_requests: [
    ["target_topic_id", "trend_topics"],
    ["result_topic_id", "trend_topics"],
  ],
  trend_monitoring_rules: [],
  collection_tasks: [["replay_of_task_id", "collection_tasks"]],
  collection_task_events: [["task_id", "collection_tasks"]],
  collection_task_outbox: [["task_id", "collection_tasks"]],
  collection_subqueries: [["task_id", "collection_tasks"]],
  collection_task_evidence_links: [
    ["collection_task_id", "collection_tasks"],
    ["collection_subquery_id", "collection_subqueries"],
    ["raw_evidence_id", "raw_evidence"],
    ["normalized_record_id", "normalized_records"],
  ],
  file_assets: [],
  raw_evidence: [
    ["collection_task_id", "collection_tasks"],
    ["collection_subquery_id", "collection_subqueries"],
    ["file_asset_id", "file_assets"],
  ],
  browser_evidence_artifacts: [
    ["collection_task_id", "collection_tasks"],
    ["collection_subquery_id", "collection_subqueries"],
    ["file_asset_id", "file_assets"],
  ],
  reconciliation_runs: [],
  data_quality_issues: [
    ["reconciliation_run_id", "reconciliation_runs"],
    ["raw_evidence_id", "raw_evidence"],
    ["normalized_record_id", "normalized_records"],
  ],
  evidence_data_events: evidenceHistoryLinks,
  evidence_data_outbox: evidenceHistoryLinks,
  normalized_records: [
    ["raw_evidence_id", "raw_evidence"],
    ["supersedes_record_id", "normalized_records"],
  ],
  field_provenance: [
    ["normalized_record_id", "normalized_records"],
    ["raw_evidence_id", "raw_evidence"],
  ],
  trend_signals: [
    ["topic_id", "trend_topics"],
    ["normalized_record_id", "normalized_records"],
    ["raw_evidence_id", "raw_evidence"],
  ],
  opportunity_evidence_links: [
    ["opportunity_id", "opportunities"],
    ["raw_evidence_id", "raw_evidence"],
    ["evidence_id", "trend_signals", "evidence_type", "trend_signal"],
  ],
  opportunity_rule_matches: [
    ["opportunity_id", "opportunities"],
    ["monitoring_rule_id", "trend_monitoring_rules"],
    ["topic_id", "trend_topics"],
  ],
  opportunity_decisions: [["opportunity_id", "opportunities"]],
  opportunity_events: [],
  opportunity_outbox: [],
  opportunity_cost_inputs: [["opportunity_id", "opportunities"]],
  opportunity_cost_input_reviews: [
    ["opportunity_id", "opportunities"],
    ["cost_input_id", "opportunity_cost_inputs"],
  ],
  opportunity_operating_facts: [["opportunity_id", "opportunities"]],
  opportunity_score_jobs: [
    ["opportunity_id", "opportunities"],
    ["score_rule_id", "score_rules"],
    ["trigger_task_id", "tasks"],
  ],
  opportunity_refresh_jobs: [["opportunity_id", "opportunities"]],
  opportunity_profit_jobs: [
    ["opportunity_id", "opportunities"],
    ["cost_rule_id", "cost_rules"],
  ],
  competitors: [
    ["opportunity_id", "opportunities"],
    ["latest_snapshot_id", "competitor_snapshots"],
  ],
  competitor_snapshots: [["competitor_id", "competitors"]],
  competitor_snapshot_jobs: [
    ["competitor_id", "competitors"],
    ["snapshot_id", "competitor_snapshots"],
  ],
  competitor_changes: [
    ["competitor_id", "competitors"],
    ["snapshot_id", "competitor_snapshots"],
  ],
  competitor_alerts: [
    ["competitor_id", "competitors"],
    ["change_id", "competitor_changes"],
    ["rule_id", "competitor_monitor_rules"],
  ],
  competitor_events: [
    ["competitor_id", "competitor_monitor_rules", "event_type", "competitor.rule.created"],
    ["competitor_id", "competitors", "event_type", "competitor.rule.created", "not"],
  ],
  competitor_outbox: [],
  competitor_monitor_rules: [["competitor_id", "competitors"]],
  sourcing_searches: [
    ["collection_task_id", "collection_tasks"],
    ["input_ref", "opportunities", "input_type", "opportunity"],
  ],
  sourcing_candidates: [
    ["search_id", "sourcing_searches"],
    ["normalized_record_id", "normalized_records"],
    ["raw_evidence_id", "raw_evidence"],
  ],
  supplier_quotes: [
    ["candidate_id", "sourcing_candidates"],
    ["evidence_id", "raw_evidence"],
  ],
  sourcing_comparisons: [],
  sourcing_projection_jobs: [["search_id", "sourcing_searches"]],
  sourcing_purchase_tasks: [["quote_id", "supplier_quotes"]],
  sourcing_events: sourcingEventLinks,
  sourcing_outbox: sourcingEventLinks,
  tasks: [
    ["collection_task_id", "collection_tasks"],
    ["source_ref_id", "sourcing_purchase_tasks", "source_type", "sourcing_purchase"],
    ["source_ref_id", "opportunities", "source_type", "evidence_completion"],
    [
      "source_ref_id",
      ["opportunity_decisions", "opportunities", "competitor_changes", "selection_journeys"],
      "source_type",
      "selection_verification",
    ],
    ["source_ref_id", "automation_executions", "source_type", "automation"],
  ],
  task_comments: [["task_id", "tasks"]],
  task_events: [["task_id", "tasks"]],
  approval_templates: [],
  approval_template_versions: [["template_id", "approval_templates"]],
  approval_template_nodes: [["template_version_id", "approval_template_versions"]],
  approval_requests: [
    ["template_id", "approval_templates"],
    ["template_version_id", "approval_template_versions"],
    ["resource_id", "tasks", "resource_type", "task"],
    ["resource_id", "opportunity_decisions", "resource_type", "opportunity_decision"],
  ],
  approval_node_runs: [
    ["approval_request_id", "approval_requests"],
    ["template_node_id", "approval_template_nodes"],
  ],
  approval_actions: [
    ["approval_request_id", "approval_requests"],
    ["node_run_id", "approval_node_runs"],
  ],
  approval_escalation_jobs: [
    ["approval_request_id", "approval_requests"],
    ["node_run_id", "approval_node_runs"],
  ],
  outbox_events: [],
  automation_rules: [],
  automation_executions: [
    ["rule_id", "automation_rules"],
    ["action_resource_id", "tasks", "action_resource_type", "task"],
  ],
  selection_journeys: [
    ["task_id", "collection_tasks"],
    ["opportunity_id", "opportunities"],
  ],
  selection_journey_decisions: [
    ["journey_id", "selection_journeys"],
    ["opportunity_id", "opportunities"],
    ["selected_raw_evidence_id", "raw_evidence"],
  ],
  selection_journey_events: [["journey_id", "selection_journeys"]],
  selection_journey_outbox: [["journey_id", "selection_journeys"]],
  score_rules: [["rollback_target_id", "score_rules"]],
  score_rule_actions: [["score_rule_id", "score_rules"]],
  opportunity_score_inputs: [["opportunity_id", "opportunities"]],
  cost_rules: [["rollback_target_id", "cost_rules"]],
  cost_rule_approvals: [["cost_rule_id", "cost_rules"]],
  exchange_rate_quotes: [],
  opportunity_score_runs: [
    ["opportunity_id", "opportunities"],
    ["score_rule_id", "score_rules"],
  ],
  opportunity_profit_runs: [
    ["opportunity_id", "opportunities"],
    ["cost_rule_id", "cost_rules"],
  ],
});

const rehearsalName = /^product_scout_[a-z0-9_]*rehearsal$/;

const ident = (name) => {
  if (typeof name !== "string" || !/^[a-z][a-z0-9_]*$/i.test(name))
    throw new Error("invalid_unique_index_metadata");
  return `\`${name}\``;
};

// These natural keys still constrain their original namespaces. In a verified
// history rehearsal the account ledger points at the unchanged physical PK.
const preservableHistoricalIndexes = new Map([
  ["trend_topics/uq_trend_topic_scope_key", ["topic_key"]],
  ["raw_evidence/uq_raw_evidence_scope_dedupe", ["provider_id", "dedupe_key"]],
  [
    "normalized_records/uq_normalized_scope_record_version",
    ["provider_id", "record_key", "record_version"],
  ],
]);
const exactFullIndex = (index, columns) =>
  index?.length === columns.length &&
  index.every((row, position) => row.column_name === columns[position] && row.sub_part == null);

export async function findAccountUniqueKeyCollisions(
  connection,
  runId,
  { preserveHistoricalKeys = false } = {},
) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME table_name, INDEX_NAME index_name, COLUMN_NAME column_name, SUB_PART sub_part
     FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND NON_UNIQUE=0
       AND TABLE_NAME IN (?) ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX`,
    [Object.keys(accountScopeSources)],
  );
  const indexes = new Map();
  for (const row of rows) {
    const key = `${row.table_name}/${row.index_name}`;
    if (!indexes.has(key)) indexes.set(key, []);
    indexes.get(key).push(row);
  }
  const collisions = [];
  for (const index of indexes.values()) {
    const columns = index.map((row) => row.column_name);
    if (!columns.includes("organization_id") && !columns.includes("workspace_id")) continue;
    const keys = index.filter(
      (row) => !["organization_id", "workspace_id"].includes(row.column_name),
    );
    const group = [
      "m.account_id",
      ...keys.map((row) => {
        const column = `s.${ident(row.column_name)}`;
        if (row.sub_part == null) return column;
        const length = Number(row.sub_part);
        if (!Number.isSafeInteger(length) || length < 1)
          throw new Error("invalid_unique_index_metadata");
        return `LEFT(${column},${length})`;
      }),
    ];
    const notNull = keys.map((row) => ` AND s.${ident(row.column_name)} IS NOT NULL`).join("");
    const { table_name, index_name } = index[0];
    const [[result]] = await connection.execute(
      `SELECT COUNT(*) collision_groups, COALESCE(SUM(duplicate_rows),0) affected_rows FROM (
        SELECT COUNT(*) duplicate_rows FROM ${ident(table_name)} s
        JOIN account_retirement_scopes m ON m.run_id=? AND m.legacy_org_id=s.organization_id
          AND m.legacy_workspace_id=s.workspace_id
        WHERE 1=1${notNull} GROUP BY ${group.join(",")} HAVING COUNT(*)>1
      ) collisions`,
      [runId],
    );
    if (String(result.collision_groups) !== "0") {
      const historicalKey = preservableHistoricalIndexes.get(`${table_name}/${index_name}`);
      const keepsOriginalId =
        preserveHistoricalKeys &&
        historicalKey &&
        exactFullIndex(index, ["organization_id", "workspace_id", ...historicalKey]) &&
        exactFullIndex(indexes.get(`${table_name}/PRIMARY`), ["id"]);
      collisions.push({
        table: table_name,
        index: index_name,
        collision_groups: String(result.collision_groups),
        affected_rows: String(result.affected_rows),
        ...(keepsOriginalId ? { preserved_by_original_id: true } : {}),
      });
    }
  }
  return collisions;
}

export async function assertAccountRehearsalTarget(connection) {
  const [[target]] = await connection.query("SELECT DATABASE() db, VERSION() version");
  if (!rehearsalName.test(target?.db ?? "") || !/^5\.7\./.test(target?.version ?? ""))
    throw new Error("mysql57_rehearsal_database_required");
}

export async function stageAccountScopeRetirement(connection, { commit = false } = {}) {
  if (typeof commit !== "boolean") throw new Error("invalid_stage_mode");
  await assertAccountRehearsalTarget(connection);
  return stageOnBoundTarget(connection, commit);
}

// A coordinated-release step, not a standalone production write command.
export async function stageAccountProductionRetirement(connection, plan) {
  await assertAccountProductionTarget(connection);
  const assertFenced = () =>
    assertAccountProductionFence(connection, "account_release_staging_not_fenced");
  await assertFenced();
  return stageOnBoundTarget(connection, true, assertFenced, plan);
}

async function stageOnBoundTarget(connection, commit, assertFenced, plan) {
  await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
  const runId = randomUUID();
  try {
    if (assertFenced) {
      await assertFenced();
      await assertAccountProductionPrerequisitePrefix(
        connection, plan, "account_release_staging_requires_exact_prerequisites",
      );
      // Do not start staging over an existing run or over a partially applied
      // coordinated migration. The caller may reopen existing staging by ID.
      const [[state]] = await connection.query(
        "SELECT (SELECT COUNT(*) FROM account_retirement_runs) staged_runs, " +
          "(SELECT COUNT(*) FROM account_ownership_cutover) cutover_rows, " +
          "(SELECT COUNT(*) FROM schema_migrations WHERE SUBSTRING(name,1,4) BETWEEN '0080' AND '0197') forward_receipts",
      );
      if (
        Number(state?.staged_runs) !== 0 ||
        Number(state?.cutover_rows) !== 0 ||
        Number(state?.forward_receipts) !== 0
      )
        throw new Error("account_release_staging_requires_unmigrated_source");
    }
    const { primaryId, scopeDefaults } = await readLegacyAccountScopeDefaults(connection);
    await connection.execute(
      "INSERT INTO account_retirement_runs (id,primary_account_id,created_at) VALUES (?,?,UTC_TIMESTAMP(3))",
      [runId, primaryId],
    );
    for (let start = 0; start < scopeDefaults.length; start += 500) {
      const values = scopeDefaults
        .slice(start, start + 500)
        .map((scope) => [
          runId,
          scope.organization_id,
          scope.workspace_id,
          scope.account_id,
          scope.reason,
        ]);
      await connection.query(
        `INSERT INTO account_retirement_scopes
        (run_id,legacy_org_id,legacy_workspace_id,account_id,reason) VALUES ?`,
        [values],
      );
    }

    const tables = await checkAccountScopeRecords(connection, runId, { stage: true });
    const keyCollisions = await findAccountUniqueKeyCollisions(connection, runId);
    if (assertFenced) await assertFenced();
    if (commit) await connection.commit();
    else await connection.rollback();
    return {
      run_id: runId,
      status: commit ? "staged" : "rolled_back",
      scope_count: scopeDefaults.length,
      account_unique_key_collisions: keyCollisions,
      tables,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

// Components are authoritative children of the immutable calculation run,
// not independently scoped records. Their parent coordinates are derived
// in SQL; neither a caller nor an actor field can select their owner.
export const accountScopeInheritedSources = Object.freeze({
  opportunity_score_components: ["score_run_id", "opportunity_score_runs"],
  opportunity_profit_components: ["profit_run_id", "opportunity_profit_runs"],
});
// Both shapes are accepted because original recovery snapshots still carry the old columns.
export const accountScopeOptionalInheritedSources = Object.freeze({
  collection_subqueries: ["task_id", "collection_tasks"],
  cost_rule_approvals: ["cost_rule_id", "cost_rules"],
  trend_topic_keywords: ["topic_id", "trend_topics"],
  task_comments: ["task_id", "tasks"],
  task_events: ["task_id", "tasks"],
  score_rule_actions: ["score_rule_id", "score_rules"],
  opportunity_refresh_jobs: ["opportunity_id", "opportunities"],
  sourcing_projection_jobs: ["search_id", "sourcing_searches"],
  trend_projection_jobs: ["normalized_record_id", "normalized_records"],
  collection_task_events: ["task_id", "collection_tasks"],
  collection_task_outbox: ["task_id", "collection_tasks"],
  opportunity_score_inputs: ["opportunity_id", "opportunities"],
  opportunity_operating_facts: ["opportunity_id", "opportunities"],
});
export const accountScopeDerivedApprovalSources = Object.freeze({
  approval_requests: ["template_id", "approval_templates"],
  approval_template_versions: ["template_id", "approval_templates"],
  approval_template_nodes: ["template_version_id", "approval_template_versions"],
  approval_node_runs: ["approval_request_id", "approval_requests"],
  approval_actions: ["approval_request_id", "approval_requests"],
  approval_escalation_jobs: ["approval_request_id", "approval_requests"],
});
export const accountScopeDerivedCollectionEvidenceSources = Object.freeze({
  browser_evidence_artifacts: ["collection_task_id", "collection_tasks"],
  collection_task_evidence_links: ["collection_task_id", "collection_tasks"],
  field_provenance: ["normalized_record_id", "normalized_records"],
});
export const accountScopeDerivedQuoteSources = Object.freeze([
  "supplier_quotes",
  "sourcing_purchase_tasks",
  "sourcing_candidates",
]);
export const accountScopeDerivedCompetitorSources = Object.freeze([
  "competitor_snapshots",
  "competitor_changes",
  "competitor_alerts",
  "competitor_snapshot_jobs",
]);
export const accountScopeDerivedJourneySources = Object.freeze([
  "selection_journey_decisions",
  "selection_journey_events",
  "selection_journey_outbox",
]);
export const accountScopeDerivedOpportunitySources = Object.freeze([
  "opportunity_score_jobs",
  "opportunity_profit_jobs",
  "opportunity_score_runs",
  "opportunity_profit_runs",
  "opportunity_cost_inputs",
  "opportunity_cost_input_reviews",
  "opportunity_evidence_links",
  "opportunity_rule_matches",
]);
export const accountScopeDerivedDecisionSources = Object.freeze(["opportunity_decisions"]);
export const accountScopeSourceNames = Object.freeze([
  ...Object.keys(accountScopeSources),
  ...Object.keys(accountScopeInheritedSources),
]);

const legacyBusinessUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Separate legacy foreign keys prove rows exist, not that they describe the same competitor.
// A workspace-wide rule (NULL target) remains valid. Snapshot evidence IDs can be opaque.
const sourceLinkConditions = {
  "collection_task_evidence_links.collection_subquery_id":
    "parent.task_id=child.collection_task_id AND parent.provider_id=child.provider_id",
  "collection_task_evidence_links.raw_evidence_id": "parent.provider_id=child.provider_id",
  "collection_task_evidence_links.normalized_record_id":
    "parent.raw_evidence_id=child.raw_evidence_id AND parent.provider_id=child.provider_id",
  "opportunity_cost_input_reviews.cost_input_id": "parent.opportunity_id=child.opportunity_id",
  "normalized_records.raw_evidence_id": "parent.provider_id=child.provider_id",
  // Schema versions may legitimately change. The business key and provider stay
  // fixed, and each non-null predecessor is the immediately preceding revision.
  "normalized_records.supersedes_record_id":
    "parent.provider_id=child.provider_id AND parent.record_key=child.record_key AND parent.record_version+1=child.record_version",
  "field_provenance.normalized_record_id": "parent.raw_evidence_id=child.raw_evidence_id",
  "competitors.latest_snapshot_id": "parent.competitor_id=child.id",
  "competitor_changes.snapshot_id":
    "parent.competitor_id=child.competitor_id AND parent.evidence_id=child.evidence_id",
  "competitor_alerts.change_id": "parent.competitor_id=child.competitor_id",
  "competitor_alerts.rule_id":
    "(parent.competitor_id IS NULL OR parent.competitor_id=child.competitor_id)",
  // The projection copies these values from the same normalized record. Confirmed
  // quotes may independently use a different same-scope source evidence record.
  "sourcing_candidates.normalized_record_id":
    "parent.raw_evidence_id=child.raw_evidence_id AND parent.provider_id=child.provider_id",
  "approval_requests.template_id": "parent.resource_type=child.resource_type",
  "approval_requests.template_version_id": "parent.template_id=child.template_id",
  // The request pins an immutable template version; the ordinal is copied from its node.
  "approval_node_runs.template_node_id": `parent.ordinal=child.ordinal AND EXISTS (
    SELECT 1 FROM approval_requests q WHERE q.id=child.approval_request_id
      AND q.template_version_id=parent.template_version_id)`,
  "approval_actions.node_run_id": "parent.approval_request_id=child.approval_request_id",
  "approval_escalation_jobs.node_run_id": "parent.approval_request_id=child.approval_request_id",
};

async function checkTrendChangeRequestLinks(connection, scopeRelation) {
  let after = "";
  const source = scopeRelation("trend_topic_change_requests");
  for (;;) {
    const [rows] = await connection.execute(
      `SELECT id,organization_id,workspace_id,operation,target_topic_id,
        CAST(source_topic_ids_json AS CHAR) source_topics, CAST(signal_ids_json AS CHAR) signals
       FROM ${source}${source.startsWith("(") ? " change_source" : ""} WHERE id>? ORDER BY id LIMIT 100`,
      [after],
    );
    if (!rows.length) return;
    const requests = rows.map((row) => {
      const ids = (raw, min, max, column) => {
        const invalid = () =>
          new Error(`invalid_source_link:trend_topic_change_requests.${column}`);
        let values;
        try {
          values = JSON.parse(raw);
        } catch {
          throw invalid();
        }
        if (
          !Array.isArray(values) ||
          values.length < min ||
          values.length > max ||
          values.some((id) => typeof id !== "string" || !legacyBusinessUuid.test(id))
        )
          throw invalid();
        const normalized = values.map((id) => id.toLowerCase());
        if (new Set(normalized).size !== normalized.length) throw invalid();
        return normalized;
      };
      const merge = row.operation === "merge";
      if (!merge && row.operation !== "split")
        throw new Error("invalid_source_link:trend_topic_change_requests.operation");
      const topics = ids(row.source_topics, merge ? 1 : 0, merge ? 10 : 0, "source_topic_ids_json");
      if (topics.includes(row.target_topic_id.toLowerCase()))
        throw new Error("invalid_source_link:trend_topic_change_requests.source_topic_ids_json");
      return {
        row,
        topics,
        signals: ids(row.signals, merge ? 0 : 1, merge ? 0 : 100, "signal_ids_json"),
      };
    });
    for (const [key, table, column] of [
      ["topics", "trend_topics", "source_topic_ids_json"],
      ["signals", "trend_signals", "signal_ids_json"],
    ]) {
      const required = [...new Set(requests.flatMap((request) => request[key]))];
      if (!required.length) continue;
      const [targets] = await connection.query(
        `SELECT id,organization_id,workspace_id FROM ${scopeRelation(table)} WHERE id IN (?)`,
        [required],
      );
      const byId = new Map(targets.map((target) => [target.id.toLowerCase(), target]));
      for (const { row, [key]: links } of requests) {
        for (const id of links) {
          const target = byId.get(id);
          // A confirmed split moves signals to the result topic; the legacy scope must still match.
          if (
            !target ||
            target.organization_id.toLowerCase() !== row.organization_id.toLowerCase() ||
            target.workspace_id.toLowerCase() !== row.workspace_id.toLowerCase()
          )
            throw new Error(`broken_source_link:trend_topic_change_requests.${column}`);
        }
      }
    }
    after = rows.at(-1).id;
  }
}

async function checkSourcingComparisonQuoteLinks(
  connection,
  quoteRelation,
  comparisonRelation,
  normalized,
) {
  let after = "";
  for (;;) {
    const [rows] = await connection.execute(
      `SELECT id,organization_id,workspace_id,CAST(quote_ids_json AS CHAR) quote_ids${normalized ? ",anchor_quote_id" : ""}
       FROM ${comparisonRelation} c WHERE id>? ORDER BY id LIMIT 250`,
      [after],
    );
    if (!rows.length) return;
    const required = new Set();
    const comparisons = rows.map((row) => {
      const ids = JSON.parse(row.quote_ids);
      if (
        !Array.isArray(ids) ||
        ids.length < 2 ||
        ids.length > 5 ||
        ids.some((id) => typeof id !== "string" || !legacyBusinessUuid.test(id))
      )
        throw new Error("invalid_source_link:sourcing_comparisons.quote_ids_json");
      const normalized = ids.map((id) => id.toLowerCase());
      if (new Set(normalized).size !== normalized.length)
        throw new Error("invalid_source_link:sourcing_comparisons.quote_ids_json");
      if ("anchor_quote_id" in row && row.anchor_quote_id?.toLowerCase() !== normalized[0])
        throw new Error("broken_source_link:sourcing_comparisons.anchor_quote_id");
      for (const id of normalized) required.add(id);
      return { row, ids: normalized };
    });
    const [quotes] = await connection.query(
      `SELECT id,organization_id,workspace_id FROM ${quoteRelation} q WHERE id IN (?)`,
      [[...required]],
    );
    const byId = new Map(quotes.map((quote) => [quote.id.toLowerCase(), quote]));
    for (const { row, ids } of comparisons) {
      let crossScope = false;
      for (const id of ids) {
        const quote = byId.get(id);
        if (!quote || !row.organization_id || !row.workspace_id)
          throw new Error("broken_source_link:sourcing_comparisons.quote_ids_json");
        const differentScope =
          quote.organization_id?.toLowerCase() !== row.organization_id.toLowerCase() ||
          quote.workspace_id?.toLowerCase() !== row.workspace_id.toLowerCase();
        if (id === ids[0] && differentScope)
          throw new Error("broken_source_link:sourcing_comparisons.quote_ids_json");
        crossScope ||= differentScope;
      }
      if (crossScope) {
        const [[proof]] = await connection.query(
          `SELECT COUNT(*) total FROM account_owned_records co
             JOIN account_owned_records qo ON qo.source_table='supplier_quotes' AND qo.account_id=co.account_id
             WHERE co.source_table='sourcing_comparisons' AND co.source_id=? AND qo.source_id IN (?)`,
          [row.id, ids],
        );
        if (Number(proof?.total) !== ids.length)
          throw new Error("broken_source_link:sourcing_comparisons.quote_ids_json");
      }
    }
    after = rows.at(-1).id;
  }
}

export async function checkAccountScopeRecords(connection, runId, { stage = false } = {}) {
  const tables = {};
  const [subqueryColumns] = await connection.query(
    "SHOW COLUMNS FROM `collection_subqueries` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (subqueryColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:collection_subqueries");
  const [realtimeColumns] = await connection.query(
    "SHOW COLUMNS FROM `realtime_events` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (realtimeColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:realtime_events");
  if (realtimeColumns.length === 0) {
    const [[parent]] = await connection.query(
      "SELECT COUNT(*) total FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() " +
        "AND TABLE_NAME='realtime_events' AND COLUMN_NAME='notification_id' " +
        "AND REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='notifications' AND REFERENCED_COLUMN_NAME='id'",
    );
    if (Number(parent?.total) !== 1)
      throw new Error("missing_inherited_notification_fk:realtime_events");
  }
  const [notificationColumns] = await connection.query(
    "SHOW COLUMNS FROM notifications WHERE Field IN ('organization_id','workspace_id')",
  );
  if (notificationColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:notifications");
  const notificationSource = notificationColumns.length
    ? "notifications"
    : "(SELECT child.*,parent.organization_id,parent.workspace_id FROM notifications child JOIN outbox_events parent ON parent.id=child.source_event_id)";
  const notificationProbe = notificationProbeAuditOnlySql(
    realtimeColumns.length === 2,
    notificationColumns.length === 2,
  );
  const [eventColumns] = await connection.query(
    "SHOW COLUMNS FROM `task_events` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (eventColumns.length === 1) throw new Error("partial_inherited_scope_schema:task_events");
  const eventHasScope = eventColumns.length === 2;
  const [signalScopeColumns] = await connection.query(
    "SHOW COLUMNS FROM `trend_signals` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (signalScopeColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:trend_signals");
  const [candidateScopeColumns] = await connection.query(
    "SHOW COLUMNS FROM `sourcing_candidates` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (candidateScopeColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:sourcing_candidates");
  const [searchScopeColumns] = await connection.query(
    "SHOW COLUMNS FROM `sourcing_searches` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (searchScopeColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:sourcing_searches");
  const [purchaseScopeColumns] = await connection.query(
    "SHOW COLUMNS FROM `sourcing_purchase_tasks` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (purchaseScopeColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:sourcing_purchase_tasks");
  const [quoteScopeColumns] = await connection.query(
    "SHOW COLUMNS FROM `supplier_quotes` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (quoteScopeColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:supplier_quotes");
  const [comparisonColumns] = await connection.query(
    "SHOW COLUMNS FROM `sourcing_comparisons` WHERE Field IN ('organization_id','workspace_id','anchor_quote_id')",
  );
  const comparisonShape = comparisonColumns
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (!["anchor_quote_id", "organization_id,workspace_id"].includes(comparisonShape))
    throw new Error("partial_inherited_scope_schema:sourcing_comparisons");
  const normalizedComparisons = comparisonShape === "anchor_quote_id";
  const [competitorEventColumns] = await connection.query(
    "SHOW COLUMNS FROM `competitor_events` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (competitorEventColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:competitor_events");
  const normalizedCompetitorEvents = competitorEventColumns.length === 0;
  const [competitorRuleColumns] = await connection.query(
    "SHOW COLUMNS FROM `competitor_monitor_rules` WHERE Field IN ('organization_id','workspace_id','historical_context')",
  );
  const competitorRuleShape = competitorRuleColumns
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (!["historical_context", "organization_id,workspace_id"].includes(competitorRuleShape))
    throw new Error("partial_inherited_scope_schema:competitor_monitor_rules");
  const [competitorOutboxColumns] = await connection.query(
    "SHOW COLUMNS FROM `competitor_outbox` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (competitorOutboxColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:competitor_outbox");
  const normalizedCompetitorOutbox = competitorOutboxColumns.length === 0;
  const [trendOutboxColumns] = await connection.query(
    "SHOW COLUMNS FROM `trend_outbox` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (trendOutboxColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:trend_outbox");
  const normalizedTrendOutbox = trendOutboxColumns.length === 0;
  const [trendEventColumns] = await connection.query(
    "SHOW COLUMNS FROM `trend_events` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (trendEventColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:trend_events");
  const normalizedTrendEvents = trendEventColumns.length === 0;
  const [trendChangeColumns] = await connection.query(
    "SHOW COLUMNS FROM `trend_topic_change_requests` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (trendChangeColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:trend_topic_change_requests");
  const normalizedTrendChangeRequests = trendChangeColumns.length === 0;
  const [opportunityOutboxColumns] = await connection.query(
    "SHOW COLUMNS FROM `opportunity_outbox` WHERE Field IN ('organization_id','workspace_id','event_id')",
  );
  const opportunityDeliveryShape = opportunityOutboxColumns
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (!["event_id", "organization_id,workspace_id"].includes(opportunityDeliveryShape))
    throw new Error("partial_inherited_scope_schema:opportunity_outbox");
  const normalizedOpportunityOutbox = opportunityDeliveryShape === "event_id";
  const [opportunityEventColumns] = await connection.query(
    "SHOW COLUMNS FROM `opportunity_events` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (opportunityEventColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:opportunity_events");
  const normalizedOpportunityEvents = opportunityEventColumns.length === 0;
  const exchangeRateScope = await exchangeRateQuoteScopeRelation(connection);
  const reconciliationScope = await reconciliationScopeRelation(connection);
  const qualityIssueScope = await qualityIssueScopeRelation(connection);
  const scoreRules = await scoreRuleScopeRelation(connection);
  const costRules = await costRuleScopeRelation(connection);
  const opportunityEventScope = opportunityEventScopeRelation(
    exchangeRateScope,
    scoreRules,
    costRules,
  );
  const [evidenceEventColumns] = await connection.query(
    "SHOW COLUMNS FROM `evidence_data_events` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (evidenceEventColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:evidence_data_events");
  const normalizedEvidenceEvents = evidenceEventColumns.length === 0;
  const [evidenceOutboxColumns] = await connection.query(
    "SHOW COLUMNS FROM `evidence_data_outbox` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (evidenceOutboxColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:evidence_data_outbox");
  const normalizedEvidenceOutbox = evidenceOutboxColumns.length === 0;
  const [sourcingOutboxColumns] = await connection.query(
    "SHOW COLUMNS FROM `sourcing_outbox` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (sourcingOutboxColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:sourcing_outbox");
  const normalizedSourcingOutbox = sourcingOutboxColumns.length === 0;
  const [sourcingEventColumns] = await connection.query(
    "SHOW COLUMNS FROM `sourcing_events` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (sourcingEventColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:sourcing_events");
  const normalizedSourcingEvents = sourcingEventColumns.length === 0;
  const [executionColumns] = await connection.query(
    "SHOW COLUMNS FROM `automation_executions` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (executionColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:automation_executions");
  const normalizedExecutions = executionColumns.length === 0;
  const [decisionScopeColumns] = await connection.query(
    "SHOW COLUMNS FROM `opportunity_decisions` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (decisionScopeColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:opportunity_decisions");
  const normalizedCompetitors = new Set();
  for (const table of accountScopeDerivedCompetitorSources) {
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM ${ident(table)} WHERE Field IN ('organization_id','workspace_id')`,
    );
    if (columns.length === 1) throw new Error(`partial_inherited_scope_schema:${table}`);
    if (columns.length === 0) normalizedCompetitors.add(table);
  }
  const normalizedApprovals = new Set();
  for (const table of Object.keys(accountScopeDerivedApprovalSources)) {
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM ${ident(table)} WHERE Field IN ('organization_id','workspace_id')`,
    );
    if (columns.length === 1) throw new Error(`partial_inherited_scope_schema:${table}`);
    if (columns.length === 0) normalizedApprovals.add(table);
  }
  const normalizedOpportunityHistory = new Set();
  for (const table of [
    ...accountScopeDerivedOpportunitySources,
    ...accountScopeDerivedJourneySources,
  ]) {
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM ${ident(table)} WHERE Field IN ('organization_id','workspace_id')`,
    );
    if (columns.length === 1) throw new Error(`partial_inherited_scope_schema:${table}`);
    if (columns.length === 0) normalizedOpportunityHistory.add(table);
  }
  const [journeyScopeColumns] = await connection.query(
    "SHOW COLUMNS FROM `selection_journeys` WHERE Field IN ('organization_id','workspace_id')",
  );
  if (journeyScopeColumns.length === 1)
    throw new Error("partial_inherited_scope_schema:selection_journeys");
  const normalizedEvidenceHistory = new Set();
  for (const table of Object.keys(accountScopeDerivedCollectionEvidenceSources)) {
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM ${ident(table)} WHERE Field IN ('organization_id','workspace_id')`,
    );
    if (columns.length === 1) throw new Error(`partial_inherited_scope_schema:${table}`);
    if (columns.length === 0) normalizedEvidenceHistory.add(table);
  }
  const fileAssetScope = await fileAssetScopeRelation(connection);
  const evidenceScope = await evidenceAccountScopeRelations(connection);
  const trendRules = await trendRuleScopeRelation(connection);
  const trendTopics = await trendTopicHistoricalScopeRelation(connection);
  const trendEvents = trendEventScopeRelation(trendRules, trendTopics);
  const approvalTemplates = await approvalTemplateScopeRelation(connection);
  const automationRules = await automationRuleScopeRelation(connection);
  const scopeRelation = (table) => {
    if (table === "cost_rules") return costRules;
    if (table === "score_rules") return scoreRules;
    if (table === "automation_rules") return automationRules;
    if (table === "approval_templates") return approvalTemplates;
    if (table === "trend_monitoring_rules") return trendRules;
    if (table === "trend_topics") return trendTopics === table ? ident(table) : trendTopics;
    if (table === "file_assets") return fileAssetScope;
    if (table === "raw_evidence")
      return evidenceScope.raw === table ? ident(table) : evidenceScope.raw;
    if (table === "normalized_records")
      return evidenceScope.normalized === table ? ident(table) : evidenceScope.normalized;
    if (table === "competitor_monitor_rules" && competitorRuleShape === "historical_context")
      return (
        "(SELECT r.*,CONVERT(JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.organization_id')) USING ascii) organization_id," +
        "CONVERT(JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.workspace_id')) USING ascii) workspace_id FROM competitor_monitor_rules r)"
      );
    if (table === "exchange_rate_quotes") return exchangeRateScope;
    if (table === "reconciliation_runs") return reconciliationScope;
    if (table === "data_quality_issues") return qualityIssueScope;
    if (table === "collection_subqueries" && subqueryColumns.length === 0)
      return "(SELECT q.*,t.organization_id,t.workspace_id FROM collection_subqueries q LEFT JOIN collection_tasks t ON t.id=q.task_id)";
    if (table === "evidence_data_events" && normalizedEvidenceEvents)
      return evidenceEventScopeRelation(reconciliationScope, qualityIssueScope, evidenceScope.raw);
    if (table === "evidence_data_outbox" && normalizedEvidenceOutbox)
      return evidenceOutboxScopeRelation(reconciliationScope, qualityIssueScope, evidenceScope.raw);
    if (table === "opportunity_events" && normalizedOpportunityEvents) return opportunityEventScope;
    if (table === "opportunity_outbox" && normalizedOpportunityOutbox)
      return (
        "(SELECT d.*,e.organization_id,e.workspace_id FROM opportunity_outbox d " +
        `LEFT JOIN ${normalizedOpportunityEvents ? opportunityEventScope : "opportunity_events"} e ON e.id=d.event_id)`
      );
    if (table === "sourcing_events" && normalizedSourcingEvents) {
      const parents = [...new Set(Object.values(sourcingEventParents))];
      const aliases = parents.map((_, index) => `p${index}`);
      const joins = parents
        .map((parent, index) => {
          const types = Object.entries(sourcingEventParents)
            .filter(([, value]) => value === parent)
            .map(([event]) => `'${event}'`)
            .join(",");
          const alias = aliases[index];
          return `LEFT JOIN ${scopeRelation(parent)} ${alias}
          ON e.event_type IN (${types}) AND ${alias}.id=e.resource_id`;
        })
        .join(" ");
      return `(SELECT e.*,COALESCE(${aliases.map((alias) => `${alias}.organization_id`).join(",")}) organization_id,
        COALESCE(${aliases.map((alias) => `${alias}.workspace_id`).join(",")}) workspace_id
        FROM sourcing_events e ${joins})`;
    }
    if (table === "sourcing_outbox" && normalizedSourcingOutbox)
      return `(SELECT o.*,e.organization_id,e.workspace_id FROM sourcing_outbox o LEFT JOIN ${normalizedSourcingEvents ? scopeRelation("sourcing_events") : "sourcing_events"} e ON e.id=o.id)`;
    if (table === "trend_events" && normalizedTrendEvents) return trendEvents;
    if (table === "trend_topic_change_requests")
      return normalizedTrendChangeRequests
        ? `(SELECT c.*,t.organization_id,t.workspace_id FROM trend_topic_change_requests c LEFT JOIN ${trendTopics} t ON t.id=c.target_topic_id)`
        : "trend_topic_change_requests";
    if (table === "trend_outbox" && normalizedTrendOutbox)
      return `(SELECT o.*,e.organization_id,e.workspace_id FROM trend_outbox o LEFT JOIN ${normalizedTrendEvents ? trendEvents : "trend_events"} e ON e.id=o.id)`;
    if (table === "competitor_outbox" && normalizedCompetitorOutbox)
      return `(SELECT x.*,COALESCE(e.organization_id,a.organization_id) organization_id,
        COALESCE(e.workspace_id,a.workspace_id) workspace_id FROM competitor_outbox x
        LEFT JOIN ${scopeRelation("competitor_events")} e ON x.event_type<>'competitor.threshold.triggered'
          AND e.id=x.id AND e.event_type=x.event_type AND e.competitor_id=x.aggregate_id
        LEFT JOIN ${scopeRelation("competitor_alerts")} a ON x.event_type='competitor.threshold.triggered'
          AND a.id=x.id AND a.competitor_id=x.aggregate_id
          AND BINARY JSON_UNQUOTE(JSON_EXTRACT(x.payload_json,'$.change_id'))=BINARY a.change_id)`;
    if (table === "competitor_events" && normalizedCompetitorEvents)
      return `(SELECT x.*,COALESCE(c.organization_id,r.organization_id) organization_id,
        COALESCE(c.workspace_id,r.workspace_id) workspace_id FROM competitor_events x
        LEFT JOIN ${competitorRuleShape === "historical_context" ? scopeRelation("competitor_monitor_rules") : "competitor_monitor_rules"} r ON x.event_type='competitor.rule.created' AND r.id=x.competitor_id
        LEFT JOIN competitors c ON x.event_type<>'competitor.rule.created' AND c.id=x.competitor_id)`;
    if (normalizedEvidenceHistory.has(table)) {
      const [column, parent] = accountScopeDerivedCollectionEvidenceSources[table];
      return `(SELECT l.*,t.organization_id,t.workspace_id FROM ${table} l LEFT JOIN ${parent} t ON t.id=l.${column})`;
    }
    if (table === "sourcing_searches" && searchScopeColumns.length === 0)
      return "(SELECT s.*,t.organization_id,t.workspace_id FROM sourcing_searches s LEFT JOIN collection_tasks t ON t.id=s.collection_task_id)";
    if (table === "sourcing_candidates" && candidateScopeColumns.length === 0)
      return (
        "(SELECT c.*,s.organization_id,s.workspace_id FROM sourcing_candidates c " +
        `LEFT JOIN ${scopeRelation("sourcing_searches")} s ON s.id=c.search_id)`
      );
    if (table === "sourcing_purchase_tasks" && purchaseScopeColumns.length === 0)
      return (
        "(SELECT p.*,c.organization_id,c.workspace_id FROM sourcing_purchase_tasks p " +
        "LEFT JOIN supplier_quotes q ON q.id=p.quote_id LEFT JOIN " +
        (candidateScopeColumns.length
          ? "sourcing_candidates"
          : scopeRelation("sourcing_candidates")) +
        " c ON c.id=q.candidate_id)"
      );
    if (table === "selection_journeys" && journeyScopeColumns.length === 0)
      return "(SELECT j.*,t.organization_id,t.workspace_id FROM selection_journeys j LEFT JOIN collection_tasks t ON t.id=j.task_id)";
    if (normalizedOpportunityHistory.has(table)) {
      const journey = accountScopeDerivedJourneySources.includes(table);
      const parent = journey ? scopeRelation("selection_journeys") : "opportunities";
      const column = journey ? "journey_id" : "opportunity_id";
      return `(SELECT j.*,o.organization_id,o.workspace_id FROM ${ident(table)} j
        LEFT JOIN ${parent} o ON o.id=j.${column})`;
    }
    if (table === "opportunity_decisions" && decisionScopeColumns.length === 0)
      return "(SELECT d.*,o.organization_id,o.workspace_id FROM opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id)";
    if (normalizedCompetitors.has(table))
      return `(SELECT d.*,c.organization_id,c.workspace_id FROM ${ident(table)} d JOIN competitors c ON c.id=d.competitor_id)`;
    if (table === "supplier_quotes" && quoteScopeColumns.length === 0)
      return (
        "(SELECT d.*,c.organization_id,c.workspace_id FROM supplier_quotes d JOIN " +
        (candidateScopeColumns.length
          ? "sourcing_candidates"
          : scopeRelation("sourcing_candidates")) +
        " c ON c.id=d.candidate_id)"
      );
    if (table === "sourcing_comparisons" && normalizedComparisons)
      return `(SELECT c.*,q.organization_id,q.workspace_id FROM sourcing_comparisons c
        LEFT JOIN ${scopeRelation("supplier_quotes")} q ON q.id=c.anchor_quote_id)`;
    if (table === "automation_executions" && normalizedExecutions)
      return `(SELECT e.*,r.organization_id,r.workspace_id FROM automation_executions e
        LEFT JOIN ${automationRules} r ON r.id=e.rule_id)`;
    if (normalizedApprovals.has(table)) {
      const [column, parent] = accountScopeDerivedApprovalSources[table];
      return `(SELECT d.*,r.organization_id,r.workspace_id FROM ${ident(table)} d
        LEFT JOIN ${parent === "approval_templates" || normalizedApprovals.has(parent) ? scopeRelation(parent) : parent} r ON r.id=d.${column})`;
    }
    if (table === "trend_signals" && signalScopeColumns.length === 0)
      return `(SELECT s.*,t.organization_id,t.workspace_id FROM trend_signals s JOIN ${trendTopics} t ON t.id=s.topic_id)`;
    return ident(table);
  };
  for (const table of accountScopeSourceNames) {
    if (table === "automation_executions") {
      const [broken] = await connection.query(`SELECT 1 FROM ${scopeRelation(table)} x
        LEFT JOIN ${notificationSource} n ON n.id=x.notification_id
          AND n.organization_id=x.organization_id AND n.workspace_id=x.workspace_id
        WHERE n.id IS NULL LIMIT 1`);
      if (broken.length)
        throw new Error("broken_source_link:automation_executions.notification_id");
    }
    if (table === "sourcing_comparisons")
      await checkSourcingComparisonQuoteLinks(
        connection,
        scopeRelation("supplier_quotes"),
        scopeRelation(table),
        normalizedComparisons,
      );
    if (table === "trend_topic_change_requests")
      await checkTrendChangeRequestLinks(connection, scopeRelation);
    if (table === "outbox_events") {
      const [invalid] = await connection.query(`SELECT 1 FROM outbox_events o
        LEFT JOIN ${approvalTemplates} t ON o.event_type IN ('approval.template.created','approval.template.published')
          AND t.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.id')) USING ascii)
          AND t.organization_id=o.organization_id AND t.workspace_id=o.workspace_id
        LEFT JOIN ${scopeRelation("approval_requests")} a ON o.event_type NOT IN ('approval.template.created','approval.template.published')
          AND a.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,
            IF(o.event_type='approval.overdue','$.approval_request_id','$.id'))) USING ascii)
          AND a.organization_id=o.organization_id AND a.workspace_id=o.workspace_id
        LEFT JOIN ${scopeRelation("approval_node_runs")} n ON n.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.node_run_id')) USING ascii)
          AND n.approval_request_id=a.id AND n.organization_id=a.organization_id AND n.workspace_id=a.workspace_id
        WHERE o.event_type IN (${approvalDeliveryTypeSql}) AND
          (o.schema_version<>1 OR (t.id IS NULL AND a.id IS NULL)
            OR (o.event_type IN ('approval.node.approved','approval.node.rejected','approval.overdue') AND n.id IS NULL))
        LIMIT 1`);
      if (invalid.length) throw new Error("broken_source_link:outbox_events.approval");
      // Some task producers reuse the event ID; automation uses independently generated IDs.
      const [badTask] = await connection.query(`SELECT 1 FROM outbox_events o
        WHERE o.event_type IN (${taskLifecycleDeliveryTypeSql}) AND
          NOT ${notificationProbe} AND
          (o.schema_version<>1 OR NOT EXISTS (
            SELECT 1 FROM task_events e JOIN tasks t ON t.id=e.task_id
              ${eventHasScope ? "AND t.organization_id=e.organization_id AND t.workspace_id=e.workspace_id" : ""}
            WHERE e.task_id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.task_id')) USING ascii)
              AND t.organization_id=o.organization_id AND t.workspace_id=o.workspace_id
              AND e.event_type=CONVERT(o.event_type USING ascii) AND e.request_id=CONVERT(o.request_id USING ascii)
              AND e.trace_id=CONVERT(o.trace_id USING ascii)
          )) LIMIT 1`);
      if (badTask.length) throw new Error("broken_source_link:outbox_events.task");
      const [badRedecision] = await connection.query(`SELECT 1 FROM outbox_events o
        LEFT JOIN tasks t ON t.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.trigger_task_id')) USING ascii)
          AND t.organization_id=o.organization_id AND t.workspace_id=o.workspace_id AND t.source_type='evidence_completion'
        LEFT JOIN ${scopeRelation("opportunity_score_runs")} r ON r.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.score_run_id')) USING ascii)
          AND r.organization_id=t.organization_id AND r.workspace_id=t.workspace_id
          AND r.opportunity_id=t.source_ref_id
          AND r.opportunity_id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.opportunity_id')) USING ascii)
          AND r.opportunity_id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.resource_id')) USING ascii)
        WHERE o.event_type='task.evidence_completion.redecision_ready' AND
          (o.schema_version<>1 OR t.id IS NULL OR r.id IS NULL
            OR NOT (JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.resource_type')) <=> 'opportunity'))
        LIMIT 1`);
      if (badRedecision.length) throw new Error("broken_source_link:outbox_events.redecision");
    }
    if (table === "trend_outbox") {
      const [unpaired] =
        await connection.query(`SELECT 1 FROM ${normalizedTrendOutbox ? scopeRelation(table) : "trend_outbox"} o
        LEFT JOIN ${normalizedTrendEvents ? trendEvents : "trend_events"} e ON e.id=o.id AND e.organization_id=o.organization_id
          AND e.workspace_id=o.workspace_id AND BINARY e.resource_type=BINARY o.resource_type
          AND e.resource_id=o.resource_id AND BINARY e.event_type=BINARY o.event_type
          AND BINARY e.request_id=BINARY o.request_id AND BINARY e.trace_id=BINARY o.trace_id
        WHERE e.id IS NULL LIMIT 1`);
      if (unpaired.length) throw new Error("broken_source_link:trend_outbox.event");
    }
    if (table === "opportunity_outbox") {
      const [unpaired] =
        await connection.query(`SELECT 1 FROM ${normalizedOpportunityOutbox ? scopeRelation(table) : "opportunity_outbox"} o
        WHERE NOT EXISTS (
          SELECT 1 FROM ${normalizedOpportunityEvents ? opportunityEventScope : "opportunity_events"} e WHERE e.organization_id=o.organization_id
            AND e.workspace_id=o.workspace_id AND e.resource_type=o.resource_type
            AND e.resource_id=o.resource_id AND BINARY e.resource_type=BINARY o.resource_type
            AND BINARY e.event_type=BINARY o.event_type
            AND BINARY e.request_id=BINARY o.request_id AND BINARY e.trace_id=BINARY o.trace_id
            ${normalizedOpportunityOutbox ? "AND e.id=o.event_id" : ""}
        ) LIMIT 1`);
      if (unpaired.length) throw new Error("broken_source_link:opportunity_outbox.event");
    }
    if (table === "evidence_data_events" || table === "evidence_data_outbox") {
      const [unknown] = await connection.query(
        `SELECT 1 FROM ${ident(table)} WHERE resource_type NOT IN (?) LIMIT 1`,
        [Object.keys(evidenceHistoryParents)],
      );
      if (unknown.length) throw new Error(`unknown_source_resource_type:${table}`);
    }
    if (table === "evidence_data_outbox") {
      // Producers create independent IDs and can emit distinct event and delivery payloads.
      const inheritedBoth = normalizedEvidenceEvents && normalizedEvidenceOutbox;
      const deliverySource =
        inheritedBoth || !normalizedEvidenceOutbox ? "evidence_data_outbox" : scopeRelation(table);
      const eventSource =
        inheritedBoth || !normalizedEvidenceEvents
          ? "evidence_data_events"
          : scopeRelation("evidence_data_events");
      const [unpaired] = await connection.query(`SELECT 1 FROM ${deliverySource} o
        WHERE NOT EXISTS (
          SELECT 1 FROM ${eventSource} e
            WHERE e.resource_type=o.resource_type
            AND e.resource_id=o.resource_id AND e.event_type=o.event_type
            ${inheritedBoth ? "" : "AND e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id"}
            AND e.request_id=o.request_id AND e.trace_id=o.trace_id
            AND BINARY e.resource_type=BINARY o.resource_type AND BINARY e.resource_id=BINARY o.resource_id
            AND BINARY e.event_type=BINARY o.event_type
            AND BINARY e.request_id=BINARY o.request_id AND BINARY e.trace_id=BINARY o.trace_id
        ) LIMIT 1`);
      if (unpaired.length) throw new Error("broken_source_link:evidence_data_outbox.event");
    }
    if (table === "browser_evidence_artifacts") {
      // Browser job identity is provenance, not ownership or authorization to resume that job.
      const [unmatched] =
        await connection.query(`SELECT 1 FROM ${normalizedEvidenceHistory.has(table) ? scopeRelation(table) : "browser_evidence_artifacts"} a
        LEFT JOIN browser_collection_jobs j ON j.id=a.browser_job_id
          AND j.collection_task_id=a.collection_task_id AND j.collection_subquery_id=a.collection_subquery_id
          AND j.provider_id=a.provider_id
        LEFT JOIN collection_tasks job_task ON job_task.id=j.collection_task_id
          AND job_task.organization_id=a.organization_id AND job_task.workspace_id=a.workspace_id
        WHERE j.id IS NULL OR job_task.id IS NULL LIMIT 1`);
      if (unmatched.length)
        throw new Error("broken_source_link:browser_evidence_artifacts.browser_job_id");
    }
    if (table === "competitor_snapshot_jobs") {
      const [mismatched] =
        await connection.query(`SELECT 1 FROM ${normalizedCompetitors.has(table) ? scopeRelation(table) : "competitor_snapshot_jobs"} j
        LEFT JOIN ${scopeRelation("competitor_snapshots")} s ON s.id=j.snapshot_id AND s.competitor_id=j.competitor_id
          AND s.organization_id=j.organization_id AND s.workspace_id=j.workspace_id
        WHERE s.id IS NULL LIMIT 1`);
      if (mismatched.length)
        throw new Error("broken_source_link:competitor_snapshot_jobs.snapshot_id");
    }
    if (table === "competitor_outbox") {
      // Ordinary outbox rows share the event ID; threshold notifications share the alert ID instead.
      const [unpaired] =
        await connection.query(`SELECT 1 FROM ${normalizedCompetitorOutbox ? scopeRelation(table) : "competitor_outbox"} o
        LEFT JOIN ${normalizedCompetitorEvents ? scopeRelation("competitor_events") : "competitor_events"} e ON o.event_type<>'competitor.threshold.triggered'
          AND e.id=o.id AND e.event_type=o.event_type AND e.competitor_id=o.aggregate_id
          AND e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id
        LEFT JOIN ${scopeRelation("competitor_alerts")} a ON o.event_type='competitor.threshold.triggered'
          AND a.id=o.id AND a.competitor_id=o.aggregate_id
          AND a.organization_id=o.organization_id AND a.workspace_id=o.workspace_id
        WHERE e.id IS NULL AND a.id IS NULL LIMIT 1`);
      if (unpaired.length) throw new Error("broken_source_link:competitor_outbox.id");
    }
    if (table === "sourcing_events" || table === "sourcing_outbox") {
      const [unknown] = await connection.query(
        `SELECT 1 FROM ${ident(table)} WHERE event_type NOT IN (?) LIMIT 1`,
        [Object.keys(sourcingEventParents)],
      );
      if (unknown.length) throw new Error(`unknown_source_event_type:${table}`);
      if (table === "sourcing_outbox") {
        const [unpaired] =
          await connection.query(`SELECT 1 FROM ${normalizedSourcingOutbox ? scopeRelation(table) : "sourcing_outbox"} o
          LEFT JOIN ${normalizedSourcingEvents ? scopeRelation("sourcing_events") : "sourcing_events"} e ON e.id=o.id AND BINARY e.event_type=BINARY o.event_type
            AND e.resource_id=o.resource_id AND e.organization_id=o.organization_id
            AND e.workspace_id=o.workspace_id
          WHERE e.id IS NULL OR (o.event_type IN ('sourcing.purchase_task.queued','sourcing.purchase_task.account_rehearsal.queued')
            AND NOT (BINARY JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.id')) <=> BINARY o.resource_id))
          LIMIT 1`);
        if (unpaired.length) throw new Error("broken_source_link:sourcing_outbox.id");
      }
    }
    let optionalInherited;
    if (Object.hasOwn(accountScopeOptionalInheritedSources, table)) {
      const columns =
        table === "task_events"
          ? eventColumns
          : table === "collection_subqueries"
            ? subqueryColumns
            : (
                await connection.query(
                  `SHOW COLUMNS FROM ${ident(table)} WHERE Field IN ('organization_id','workspace_id')`,
                )
              )[0];
      if (columns.length === 1) throw new Error(`partial_inherited_scope_schema:${table}`);
      if (columns.length === 0) optionalInherited = accountScopeOptionalInheritedSources[table];
    }
    const edges = optionalInherited ? [] : (accountScopeSources[table] ?? []);
    for (const [column, parent, discriminator, value, match] of edges) {
      const linkFilter = discriminator
        ? `child.\`${discriminator}\`${match === "not" ? "<>" : "="}?`
        : `child.\`${column}\` IS NOT NULL`;
      const parents = Array.isArray(parent) ? parent : [parent];
      const aliases = parents.map((_, i) => (i === 0 ? "parent" : `parent${i}`));
      const joins = parents.map((table, i) => {
        const alias = aliases[i];
        return `LEFT JOIN ${scopeRelation(table)} ${alias} ON ${alias}.id=child.${ident(column)}
            AND ${alias}.organization_id=child.organization_id AND ${alias}.workspace_id=child.workspace_id`;
      });
      const relationshipCondition = sourceLinkConditions[`${table}.${column}`];
      if (relationshipCondition) joins[0] += ` AND ${relationshipCondition}`;
      const matchCount =
        parents.length > 1
          ? `(${aliases.map((alias) => `(${alias}.id IS NOT NULL)`).join("+")})`
          : null;
      const invalid = matchCount
        ? `${matchCount}<>1`
        : table === "sourcing_searches" && column === "input_ref"
          ? `parent.id IS NULL AND NOT (
          child.input_ref NOT REGEXP '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
          AND EXISTS (SELECT 1 FROM collection_tasks history_task
            WHERE history_task.id=child.collection_task_id
              AND history_task.organization_id=child.organization_id AND history_task.workspace_id=child.workspace_id
              AND BINARY history_task.request_id=BINARY child.request_id
              AND BINARY history_task.trace_id=BINARY child.trace_id)
          AND NOT EXISTS (SELECT 1 FROM sourcing_candidates history_candidate WHERE history_candidate.search_id=child.id)
        )`
          : "parent.id IS NULL";
      const [broken] = await connection.query(
        `SELECT 1${matchCount ? `,${matchCount} parent_matches` : ""} FROM ${scopeRelation(table)} child
          ${joins.join("\n")}
          WHERE ${linkFilter} AND ${invalid} LIMIT 1`,
        discriminator ? [value] : [],
      );
      if (broken.length) {
        const code =
          Number(broken[0].parent_matches) > 1 ? "ambiguous_source_link" : "broken_source_link";
        throw new Error(`${code}:${table}.${column}`);
      }
    }
    const inherited = optionalInherited ?? accountScopeInheritedSources[table];
    const sourceTable = ident(table);
    const scopedSourceTable = scopeRelation(table);
    const selective =
      table === "outbox_events"
        ? `(SELECT o.id,o.organization_id,o.workspace_id FROM outbox_events o
             WHERE o.event_type IN (${genericDeliveryTypeSql}) AND NOT ${notificationProbe}) s`
        : null;
    const sourceFrom =
      selective ??
      (inherited
        ? `${sourceTable} s JOIN ${scopeRelation(inherited[1])} p ON p.id=s.${ident(inherited[0])}`
        : `${scopedSourceTable} s`);
    const coordinate = inherited ? "p" : "s";
    if (inherited) {
      const [broken] = await connection.query(
        `SELECT 1 FROM ${sourceTable} s LEFT JOIN ${ident(inherited[1])} p
          ON p.id=s.${ident(inherited[0])} WHERE p.id IS NULL LIMIT 1`,
      );
      if (broken.length) throw new Error(`broken_source_link:${table}.${inherited[0]}`);
    }
    const [[source]] = await connection.query(
      `SELECT COUNT(*) total FROM ${selective ?? sourceTable}`,
    );
    if (stage)
      await connection.execute(
        `INSERT INTO account_retirement_records
        (run_id,source_table,source_id,legacy_org_id,legacy_workspace_id)
        SELECT m.run_id,?,s.id,${coordinate}.organization_id,${coordinate}.workspace_id FROM ${sourceFrom}
        JOIN account_retirement_scopes m ON m.run_id=? AND m.legacy_org_id=${coordinate}.organization_id
          AND m.legacy_workspace_id=${coordinate}.workspace_id`,
        [table, runId],
      );
    const [[recorded]] = await connection.execute(
      `SELECT COUNT(*) total FROM account_retirement_records
        WHERE run_id=? AND source_table=?`,
      [runId, table],
    );
    if (String(source.total) !== String(recorded.total))
      throw new Error(`source_scope_count_mismatch:${table}`);
    const [missing] = await connection.execute(
      `SELECT 1 FROM ${sourceFrom} LEFT JOIN account_retirement_records r
          ON r.run_id=? AND r.source_table=? AND r.source_id=s.id
            AND r.legacy_org_id=${coordinate}.organization_id AND r.legacy_workspace_id=${coordinate}.workspace_id
          WHERE r.source_id IS NULL LIMIT 1`,
      [runId, table],
    );
    if (missing.length) throw new Error(`source_identity_mismatch:${table}`);
    tables[table] = String(recorded.total);
  }

  const [brokenFollows] = await connection.execute(
    `SELECT 1 FROM trend_topic_follows f
    LEFT JOIN account_retirement_records t ON t.run_id=? AND t.source_table='trend_topics'
      AND t.source_id=f.topic_id AND t.legacy_org_id=f.organization_id AND t.legacy_workspace_id=f.workspace_id
    LEFT JOIN users u ON u.id=f.user_id WHERE t.source_id IS NULL OR u.id IS NULL LIMIT 1`,
    [runId],
  );
  if (brokenFollows.length) throw new Error("broken_source_link:trend_topic_follows.topic_id");
  return tables;
}

export function connectLocalAccountRehearsal() {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (DB_HOST !== "127.0.0.1" || !rehearsalName.test(DB_NAME ?? ""))
    throw new Error("local_rehearsal_connection_required");
  const port = Number(DB_PORT);
  if (!DB_USER || !DB_PASSWORD || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("incomplete_rehearsal_connection");
  return mysql.createConnection({
    host: DB_HOST,
    port,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--commit"))
    throw new Error("unexpected_arguments");
  const connection = await connectLocalAccountRehearsal();
  try {
    console.log(
      JSON.stringify(
        await stageAccountScopeRetirement(connection, { commit: args.length === 1 }),
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      error.code ?? (/^[a-z_:.]+$/.test(error.message) ? error.message : "staging_failed"),
    );
    process.exitCode = 1;
  });
}
