import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import mysql from "mysql2/promise";
import { costRuleScopeRelation, scoreRuleScopeRelation } from "./lib/opportunity-event-scope.mjs";

const allowed = new Set([
  "0040_platform_messages.up.sql",
  "0041_member_workspace_tasks.up.sql",
  "0042_erp_product_import.up.sql",
  "0043_trend_rule_collection_schedule.up.sql",
  "0044a_competitor_soft_delete.up.sql",
  "0044b_sourcing_soft_delete.up.sql",
  "0044c_truthful_missing_metrics.up.sql",
  "0044d_nullable_competitor_metrics.up.sql",
  "0044e_core_collection_projection.up.sql",
  "0044f_enable_amazon_public_crawler.up.sql",
  "0045_operational_task_links.up.sql",
  "0046_notification_workflow_root_cause.up.sql",
  "0047_approval_decision_context_snapshot.up.sql",
  "0048_browser_collection_jobs.up.sql",
  "0049_credential_renewal_auto_replay.up.sql",
  "0050_browser_evidence_artifacts.up.sql",
  "0051a_provider_parser_samples.up.sql",
  "0051b_provider_parser_sample_replay_runs.up.sql",
  "0051c_provider_parser_sample_operations.up.sql",
  "0052a_amazon_structured_parser.up.sql",
  "0052b_provider_public_compliance.up.sql",
  "0053_provider_configuration_versions.up.sql",
  "0054_crawler_succeeded_empty.up.sql",
  "0055_provider_runtime_circuits.up.sql",
  "0056_provider_terms_version_expiry.up.sql",
  "0057_data_quality_issue_workflow.up.sql",
  "0058_opportunity_archive_stage.up.sql",
  "0059_selection_journey_candidates.up.sql",
  "0060_opportunity_workflow_visibility.up.sql",
  "0061_crawler_completion_spool_status.up.sql",
  "0062_runtime_process_restart_observations.up.sql",
  "0063_runtime_health_endpoint_probes.up.sql",
  "0064_governed_workflow_confirmations.up.sql",
  "0065_opportunity_operating_feedback.up.sql",
  "0066_automation_task_source_restore.up.sql",
  "0067_usernames_login.up.sql",
  "0068_automatic_selection_rule_matches.up.sql",
  "0069_rule_based_recommendations.up.sql",
  "0070_rule_candidates_quality_gate.up.sql",
  "0071_opportunity_migration_timestamp_timezone.up.sql",
  "0072_automatic_quality_evaluation.up.sql",
  "0073_automatic_selection_migration_timestamp_timezone.up.sql",
  "0074_provider_terms_permanent.up.sql",
  "0075_competitor_opportunity_identity.up.sql",
  "0076_collection_backlog_cancellation.up.sql",
]);
const accountRehearsalUp = [
  "0080_primary_account_cost_approval.up.sql",
  "0081_cost_approval_parent_scope.up.sql",
  "0082_account_cost_approval_events.up.sql",
  "0083_trend_keyword_parent_scope.up.sql",
  "0084_trend_signal_parent_scope.up.sql",
  "0085_task_history_parent_scope.up.sql",
  "0086_approval_history_parent_scope.up.sql",
  "0087_supplier_quote_parent_scope.up.sql",
  "0088_competitor_history_parent_scope.up.sql",
  "0089_opportunity_decision_parent_scope.up.sql",
  "0090_selection_history_parent_scope.up.sql",
  "0091_opportunity_inputs_parent_scope.up.sql",
  "0092_calculation_job_parent_scope.up.sql",
  "0093_calculation_run_parent_scope.up.sql",
  "0094_cost_facts_parent_scope.up.sql",
  "0095_opportunity_evidence_parent_scope.up.sql",
  "0096_opportunity_progress_parent_scope.up.sql",
  "0097_selection_journey_history_parent_scope.up.sql",
  "0098_market_projection_job_parent_scope.up.sql",
  "0099_purchase_task_quote_scope.up.sql",
  "0100_sourcing_candidate_parent_scope.up.sql",
  "0101_collection_dead_letter_parent_scope.up.sql",
  "0102_collection_history_parent_scope.up.sql",
  "0103_collection_evidence_parent_scope.up.sql",
  "0104_approval_escalation_parent_scope.up.sql",
  "0105_account_cost_rule_manager_grants.up.sql",
  "0106_account_cost_rule_manager_read_scope.up.sql",
  "0107_retire_legacy_trend_follows.up.sql",
  "0108_trend_projection_parent_scope.up.sql",
  "0109_field_provenance_parent_scope.up.sql",
  "0110_approval_template_node_parent_scope.up.sql",
  "0111_approval_template_version_parent_scope.up.sql",
  "0112_approval_request_parent_scope.up.sql",
  "0113_sourcing_comparison_quote_anchor.up.sql",
  "0114_automation_execution_parent_scope.up.sql",
  "0115_browser_evidence_parent_scope.up.sql",
  "0116_competitor_event_parent_scope.up.sql",
  "0117_competitor_outbox_parent_scope.up.sql",
  "0118_trend_outbox_parent_scope.up.sql",
  "0119_sourcing_outbox_parent_scope.up.sql",
  "0120_sourcing_event_parent_scope.up.sql",
  "0121_opportunity_outbox_parent_scope.up.sql",
  "0122_evidence_event_parent_scope.up.sql",
  "0123_evidence_outbox_parent_scope.up.sql",
  "0124_opportunity_event_parent_scope.up.sql",
  "0125_trend_event_parent_scope.up.sql",
  "0126_trend_change_request_parent_scope.up.sql",
  "0127_trend_rule_account_owner.up.sql",
  "0128_core_collection_projection_run_parent_scope.up.sql",
  "0129_notification_delivery_parent_scope.up.sql",
  "0130_realtime_event_parent_scope.up.sql",
  "0131_erp_product_import_operation_parent_scope.up.sql",
  "0132_provider_source_replay_parent_scope.up.sql",
  "0133_collection_subquery_parent_scope.up.sql",
  "0134_crawler_lease_event_parent_scope.up.sql",
  "0135_browser_collection_job_parent_scope.up.sql",
  "0136_crawler_scheduler_lease_parent_scope.up.sql",
  "0137_ai_analysis_history_parent_scope.up.sql",
  "0138_ai_analysis_request_parent_scope.up.sql",
  "0139_ai_analysis_delivery_parent_scope.up.sql",
  "0140_runtime_nodes_platform_scope.up.sql",
  "0141_platform_observations_unscoped.up.sql",
  "0142_parser_sample_parent_scope.up.sql",
  "0143_backup_history_platform_scope.up.sql",
  "0144_platform_release_verification_history.up.sql",
  "0145_retire_unused_api_idempotency.up.sql",
  "0146_selection_journey_task_scope.up.sql",
  "0147_retire_trend_signal_scope_view.up.sql",
  "0148_authorization_decision_audit_context.up.sql",
  "0149_retire_tenancy_audit_scope.up.sql",
  "0150_retire_organization_admin_history.up.sql",
  "0151_retire_organization_api_tokens.up.sql",
  "0152_retire_empty_resource_grants.up.sql",
  "0153_retire_empty_legacy_home_projection.up.sql",
  "0154_ui_preference_account_scope.up.sql",
  "0155_exchange_rate_quote_account_scope.up.sql",
  "0156_retire_session_context.up.sql",
  "0157_retire_empty_workspace_search_projection.up.sql",
  "0158_retire_empty_organization_teams.up.sql",
  "0159_reconciliation_account_scope.up.sql",
  "0160_commercial_audit_context.up.sql",
  "0161_commercial_quota_assignment_scope.up.sql",
  "0162_webhook_event_delivery_scope.up.sql",
  "0163_webhook_delivery_endpoint_scope.up.sql",
  "0164_open_api_usage_client_scope.up.sql",
  "0165_competitor_rule_account_scope.up.sql",
  "0166_crawler_run_historical_context.up.sql",
  "0167_data_quality_issue_historical_context.up.sql",
  "0168_automatic_source_schedule_account_scope.up.sql",
  "0169_webhook_endpoint_account_scope.up.sql",
  "0170_open_api_client_account_scope.up.sql",
  "0171_platform_audit_historical_context.up.sql",
  "0172_business_audit_historical_context.up.sql",
  "0173_platform_message_historical_audience.up.sql",
  "0174_notification_preferences_account_scope.up.sql",
  "0175_commercial_assignment_account_scope.up.sql",
  "0176_notification_recipient_scope.up.sql",
  "0177_report_export_account_scope.up.sql",
  "0178_file_asset_account_scope.up.sql",
  "0179_trend_rule_scope_retirement.up.sql",
  "0180_approval_template_account_scope.up.sql",
  "0181_automation_rule_account_scope.up.sql",
  "0182_score_rule_account_scope.up.sql",
  "0183_cost_rule_account_scope.up.sql",
  "0184_quality_assignee_account_reference.up.sql",
  "0185_retire_membership_data_scopes.up.sql",
  "0186_retire_membership_role_assignments.up.sql",
  "0187_retire_organization_memberships.up.sql",
  "0188_platform_message_account_delivery.up.sql",
  "0189_sourcing_search_parent_scope.up.sql",
  "0190_evidence_account_scope.up.sql",
  "0191_trend_topic_account_scope.up.sql",
  "0192_collection_task_account_scope.up.sql",
  "0193_business_task_account_scope.up.sql",
  "0194_competitor_account_scope.up.sql",
  "0195_opportunity_account_scope.up.sql",
  "0196_outbox_historical_scope.up.sql",
  "0197_retire_tenancy_roots.up.sql",
];
const accountRehearsalDown = accountRehearsalUp
  .map((name) => name.replace(/\.up\.sql$/, ".down.sql"))
  .reverse();

// Planning tools consume the exact same ordered files but do not inherit execution authorization.
export const listAccountRetirementMigrationNames = () => [...accountRehearsalUp];
const matches = (requested, known) =>
  requested.length === known.length && requested.every((name, i) => name === known[i]);
export function splitSqlStatements(source) {
  const statements = [];
  let statement = "";
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
        statement += "\n";
      }
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
        statement += " ";
      }
      continue;
    }
    if (quote) {
      statement += character;
      if (character === "\\") {
        if (next !== undefined) {
          statement += next;
          index += 1;
        }
        continue;
      }
      if (character === quote && next === quote) {
        statement += next;
        index += 1;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }
    if (
      (character === "-" && next === "-" && /\s/.test(source[index + 2] ?? "")) ||
      character === "#"
    ) {
      lineComment = true;
      index += character === "-" ? 1 : 0;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      statement += character;
      continue;
    }
    if (character === ";") {
      if (statement.trim()) statements.push(statement.trim());
      statement = "";
      continue;
    }
    statement += character;
  }

  if (quote || blockComment) throw new Error("migration_sql_unterminated_token");
  if (statement.trim()) statements.push(statement.trim());
  if (!statements.length) throw new Error("migration_sql_empty");
  return statements;
}

const migrationRetryDelaysMs = [100, 300, 750];

export async function executeMigrationStatement(
  execute,
  statement,
  {
    retryDelaysMs = migrationRetryDelaysMs,
    wait = (delay) => new Promise((done) => setTimeout(done, delay)),
  } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await execute(statement);
    } catch (error) {
      const retryable = ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error?.code);
      if (!retryable || attempt >= retryDelaysMs.length) throw error;
      await wait(retryDelaysMs[attempt]);
    }
  }
}

export async function assertNoAccountScoreDecisions(db) {
  const [[row]] = await db.query(
    "SELECT EXISTS(SELECT 1 FROM score_rule_operations " +
      "WHERE route LIKE 'POST:/api/v1/opportunity-score-rules/%/actions:account' " +
      "OR route='POST:/api/v1/opportunity-score-rules:account') has_decisions",
  );
  if (Number(row?.has_decisions) !== 0)
    throw new Error("rollback_would_invalidate_account_score_approval_history");
}

export async function assertCalculationRollbackScope(
  db,
  scoreRules = "score_rules",
  costRules = "cost_rules",
  businessTasks = "tasks",
  opportunities = "opportunities",
) {
  // 0092/0093 reconstruct legacy coordinates from the opportunity. Account-mode
  // rules and trigger tasks can now legitimately live in another old workspace.
  for (const [table, ruleTable, ruleColumn, hasTrigger] of [
    ["opportunity_score_jobs", "score_rules", "score_rule_id", true],
    ["opportunity_profit_jobs", "cost_rules", "cost_rule_id", false],
    ["opportunity_score_runs", "score_rules", "score_rule_id", false],
    ["opportunity_profit_runs", "cost_rules", "cost_rule_id", false],
  ]) {
    const [[row]] = await db.query(
      `SELECT EXISTS(SELECT 1 FROM ${table} h ` +
        `LEFT JOIN ${opportunities} o ON o.id=h.opportunity_id ` +
        `LEFT JOIN ${ruleTable === "score_rules" ? scoreRules : costRules} r ON r.id=h.${ruleColumn} ` +
        (hasTrigger ? `LEFT JOIN ${businessTasks} t ON t.id=h.trigger_task_id ` : "") +
        "WHERE o.id IS NULL OR r.id IS NULL OR NOT " +
        "(o.organization_id <=> r.organization_id AND o.workspace_id <=> r.workspace_id)" +
        (hasTrigger
          ? " OR (h.trigger_task_id IS NOT NULL AND (t.id IS NULL OR NOT " +
            "(o.organization_id <=> t.organization_id AND o.workspace_id <=> t.workspace_id)))"
          : "") +
        ") incompatible",
    );
    if (Number(row?.incompatible) !== 0)
      throw new Error(`rollback_would_invalidate_calculation_scope:${table}`);
  }
}

export async function assertSupplierQuoteRollbackScope(
  db,
  restoreSearchScopeFromTask = false,
  restoreEvidenceScopeFromTask = false,
  taskRelation = "collection_tasks",
) {
  // 0087 down restores the candidate's legacy scope; it cannot also represent
  // account-mode evidence from a different legacy scope without rewriting history.
  const scope = restoreSearchScopeFromTask ? "t" : "s";
  const evidence = restoreEvidenceScopeFromTask ? "et" : "e";
  const [[row]] = await db.query(
    "SELECT EXISTS(SELECT 1 FROM supplier_quotes q " +
      "LEFT JOIN sourcing_candidates c ON c.id=q.candidate_id " +
      "LEFT JOIN sourcing_searches s ON s.id=c.search_id " +
      (restoreSearchScopeFromTask
        ? `LEFT JOIN ${taskRelation} t ON t.id=s.collection_task_id `
        : "") +
      "LEFT JOIN raw_evidence e ON e.id=q.evidence_id " +
      (restoreEvidenceScopeFromTask
        ? `LEFT JOIN ${taskRelation} et ON et.id=e.collection_task_id `
        : "") +
      "WHERE s.id IS NULL OR e.id IS NULL " +
      (restoreSearchScopeFromTask ? "OR t.id IS NULL " : "") +
      (restoreEvidenceScopeFromTask ? "OR et.id IS NULL " : "") +
      `OR NOT (${scope}.organization_id <=> ${evidence}.organization_id AND ${scope}.workspace_id <=> ${evidence}.workspace_id)) incompatible`,
  );
  if (Number(row?.incompatible) !== 0)
    throw new Error("rollback_would_invalidate_supplier_quote_evidence_scope");
}

export async function assertSelectionJourneyRollbackScope(
  db,
  restoreEvidenceScopeFromTask = false,
  taskRelation = "collection_tasks",
  opportunities = "opportunities",
) {
  const evidence = restoreEvidenceScopeFromTask ? "et" : "e";
  const [[row]] = await db.query(
    "SELECT EXISTS(SELECT 1 FROM selection_journeys j " +
      `LEFT JOIN ${taskRelation} t ON t.id=j.task_id ` +
      `LEFT JOIN ${opportunities} o ON o.id=j.opportunity_id ` +
      "LEFT JOIN selection_journey_decisions d ON d.journey_id=j.id " +
      `LEFT JOIN ${opportunities} decided ON decided.id=d.opportunity_id ` +
      "LEFT JOIN raw_evidence e ON e.id=d.selected_raw_evidence_id " +
      (restoreEvidenceScopeFromTask
        ? `LEFT JOIN ${taskRelation} et ON et.id=e.collection_task_id `
        : "") +
      "WHERE t.id IS NULL OR (j.opportunity_id IS NOT NULL AND (o.id IS NULL OR NOT " +
      "(o.organization_id <=> t.organization_id AND o.workspace_id <=> t.workspace_id))) " +
      "OR (d.opportunity_id IS NOT NULL AND (decided.id IS NULL OR NOT " +
      "(decided.organization_id <=> t.organization_id AND decided.workspace_id <=> t.workspace_id))) " +
      "OR (d.selected_raw_evidence_id IS NOT NULL AND (e.id IS NULL OR NOT " +
      (restoreEvidenceScopeFromTask ? "(et.id IS NOT NULL AND " : "(") +
      `${evidence}.organization_id <=> t.organization_id AND ${evidence}.workspace_id <=> t.workspace_id)))) incompatible`,
  );
  if (Number(row?.incompatible) !== 0)
    throw new Error("rollback_would_invalidate_selection_journey_scope");
}

export async function preflightRecentHistoricalRollback(
  db,
  bundle,
  taskRelation = "collection_tasks",
  outboxRelation = "outbox_events",
) {
  const guards = [
    [
      "0188_platform_message_account_delivery",
      "scoutops_platform_message_delivery_guard",
      "outbox_events e",
      "WHERE e.organization_id IS NULL",
      "",
    ],
    [
      "0187_retire_organization_memberships",
      "scoutops_membership_archive_guard",
      "historical_organization_memberships m",
      "WHERE o.id IS NULL OR u.id IS NULL",
      "organizations o",
    ],
    [
      "0186_retire_membership_role_assignments",
      "scoutops_membership_role_archive_guard",
      "historical_membership_role_assignments a",
      "m.id IS NULL OR r.code IS NULL OR u.id IS NULL",
      "memberships m",
    ],
    [
      "0185_retire_membership_data_scopes",
      "scoutops_membership_scope_archive_guard",
      "historical_membership_data_scopes s",
      "s.historical_workspace_id IS NOT NULL AND w.id IS NULL",
      "memberships m",
    ],
    [
      "0184_quality_assignee_account_reference",
      "scoutops_quality_assignee_guard",
      "data_quality_issues i",
      "OR NOT (i.assigned_account_id <=> m.user_id)",
      "memberships m",
    ],
    [
      "0183_cost_rule_account_scope",
      "scoutops_cost_rule_guard",
      "cost_rules t",
      "WHERE w.id IS NULL OR s.account_id IS NULL OR s.account_id<>t.account_id",
    ],
    [
      "0182_score_rule_account_scope",
      "scoutops_score_rule_guard",
      "score_rules t",
      "WHERE w.id IS NULL OR s.account_id IS NULL OR s.account_id<>t.account_id",
    ],
    [
      "0181_automation_rule_account_scope",
      "scoutops_automation_rule_guard",
      "automation_rules t",
      "WHERE w.id IS NULL OR s.account_id IS NULL OR s.account_id<>t.account_id",
    ],
    [
      "0180_approval_template_account_scope",
      "scoutops_approval_template_guard",
      "approval_templates t",
      "WHERE w.id IS NULL OR s.account_id IS NULL OR s.account_id<>t.account_id",
    ],
    [
      "0179_trend_rule_scope_retirement",
      "scoutops_trend_rule_scope_guard",
      "trend_monitoring_rules r",
      "WHERE w.id IS NULL OR s.account_id IS NULL OR s.account_id<>r.account_id",
    ],
    [
      "0178_file_asset_account_scope",
      "scoutops_file_asset_guard",
      "file_assets f",
      "WHERE w.id IS NULL OR o.account_id IS NULL OR o.account_id<>f.account_id",
    ],
    [
      "0177_report_export_account_scope",
      "scoutops_report_export_guard",
      "report_exports e",
      "WHERE w.id IS NULL OR m.account_id IS NULL OR m.account_id<>e.account_id",
    ],
    [
      "0176_notification_recipient_scope",
      "scoutops_notification_parent_guard",
      "notifications n",
      "WHERE e.id IS NULL OR e.organization_id IS NULL OR e.workspace_id IS NULL",
      "outbox_events e",
    ],
    [
      "0175_commercial_assignment_account_scope",
      "scoutops_commercial_assignment_guard",
      "organization_plan_assignments e",
      "WHERE o.id IS NULL OR m.account_id IS NULL OR m.account_id<>e.account_id",
      "organizations o",
    ],
    [
      "0174_notification_preferences_account_scope",
      "scoutops_notification_pref_guard",
      "notification_preferences p",
      "WHERE COALESCE(JSON_TYPE(JSON_EXTRACT(p.historical_context",
      "",
    ],
    [
      "0173_platform_message_historical_audience",
      "scoutops_platform_message_guard",
      "platform_messages m",
      "WHERE m.historical_context IS NOT NULL AND o.id IS NULL",
      "organizations o",
    ],
    [
      "0172_business_audit_historical_context",
      "scoutops_business_audit_guard",
      "audit_logs a",
      "WHERE COALESCE(JSON_TYPE(JSON_EXTRACT(a.historical_context",
      "",
    ],
    [
      "0171_platform_audit_historical_context",
      "scoutops_platform_audit_guard",
      "platform_audit_events e",
      "WHERE (JSON_TYPE(JSON_EXTRACT(e.historical_context",
      "organizations o",
    ],
    [
      "0170_open_api_client_account_scope",
      "scoutops_api_client_guard",
      "platform_api_clients e",
      "WHERE o.id IS NULL OR m.account_id IS NULL OR m.account_id<>e.account_id",
      "organizations o",
    ],
    [
      "0169_webhook_endpoint_account_scope",
      "scoutops_webhook_endpoint_guard",
      "webhook_endpoints e",
      "WHERE o.id IS NULL OR m.account_id IS NULL OR m.account_id<>e.account_id",
      "organizations o",
    ],
    [
      "0168_automatic_source_schedule_account_scope",
      "scoutops_source_schedule_guard",
      "automatic_source_schedules r",
      "WHERE w.id IS NULL OR duplicate_scope.id IS NOT NULL",
    ],
    [
      "0167_data_quality_issue_historical_context",
      "scoutops_quality_issue_guard",
      "data_quality_issues r",
    ],
    ["0166_crawler_run_historical_context", "scoutops_crawler_run_guard", "crawler_browser_runs r"],
    [
      "0165_competitor_rule_account_scope",
      "scoutops_competitor_rule_guard",
      "competitor_monitor_rules q",
    ],
  ];
  const validated = guards.map(([migration, guard, table, firstWhere, parent = "workspaces w"]) => {
    const entry = bundle.find(({ name }) => name === migration + ".down.sql");
    if (!entry) throw new Error(`historical_rollback_guard_missing:${migration}`);
    const [create, seed, check, drop] = entry.statements;
    if (
      create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
      seed !== `INSERT INTO ${guard} VALUES (1)` ||
      !check
        ?.replace(/\s+/g, " ")
        .startsWith(
          `INSERT INTO ${guard} SELECT 1 FROM ${table} ${parent ? `LEFT JOIN ${parent}` : "WHERE"}`,
        ) ||
      !(firstWhere
        ? check.replace(/\s+/g, " ").includes(firstWhere) && check.endsWith("LIMIT 1")
        : check.endsWith("WHERE w.id IS NULL LIMIT 1")) ||
      drop !== `DROP TEMPORARY TABLE ${guard}`
    )
      throw new Error(`historical_rollback_guard_changed:${migration}`);
    // 0187 down restores memberships before these SQL files execute. In the
    // read-only bundle preflight the identical IDs are still in the archive.
    const preflightCheck =
      parent === "memberships m"
        ? check.replace(
            "LEFT JOIN memberships m",
            "LEFT JOIN historical_organization_memberships m",
          )
        : check;
    if (
      migration === "0168_automatic_source_schedule_account_scope" &&
      !preflightCheck.includes("LEFT JOIN collection_tasks t ON t.id=r.last_task_id")
    )
      throw new Error(`historical_rollback_guard_changed:${migration}`);
    const projected =
      migration === "0168_automatic_source_schedule_account_scope"
        ? projectTaskRollbackGuard(preflightCheck, taskRelation)
        : ["0188_platform_message_account_delivery", "0176_notification_recipient_scope"].includes(
              migration,
            )
          ? preflightCheck.replace("outbox_events e", `${outboxRelation} e`)
          : preflightCheck;
    return { create, seed, check: projected, drop, migration };
  });
  for (const { create, seed, check, drop, migration } of validated) {
    await db.query(create);
    try {
      await db.query(seed);
      await db.query(check);
    } catch (error) {
      throw new Error(
        `historical_rollback_guard_failed:${migration}:${error.code ?? error.message}`,
        { cause: error },
      );
    } finally {
      await db.query(drop);
    }
  }
}

export async function preflightUiPreferenceRollback(db, bundle) {
  const migration = bundle.find(({ name }) => name === "0154_ui_preference_account_scope.down.sql");
  if (!migration) throw new Error("ui_preference_rollback_guard_missing");
  const [create, seed, preferences, audits, operations, drop] = migration.statements;
  if (
    !create?.startsWith("CREATE TEMPORARY TABLE scoutops_ui_preference_scope_guard ") ||
    !seed?.startsWith("INSERT INTO scoutops_ui_preference_scope_guard VALUES ") ||
    ![preferences, audits, operations].every(
      (statement, index) =>
        statement?.startsWith("INSERT INTO scoutops_ui_preference_scope_guard") &&
        statement.includes(
          "FROM " +
            [
              "user_ui_preferences",
              "user_ui_preference_audit_events",
              "user_ui_preference_operations",
            ][index] +
            " h",
        ),
    ) ||
    drop !== "DROP TEMPORARY TABLE scoutops_ui_preference_scope_guard"
  )
    throw new Error("ui_preference_rollback_guard_changed");
  await db.query(create);
  try {
    for (const statement of [seed, preferences, audits, operations]) await db.query(statement);
  } finally {
    await db.query(drop);
  }
}

const projectTaskRollbackGuard = (sql, relation) =>
  sql.replace(/\bJOIN collection_tasks t ON/g, () => `JOIN ${relation} t ON`);

export async function preflightSourcingSearchRollback(
  db,
  bundle,
  taskRelation = "collection_tasks",
) {
  const migration = bundle.find(
    ({ name }) => name === "0189_sourcing_search_parent_scope.down.sql",
  );
  if (migration?.name !== "0189_sourcing_search_parent_scope.down.sql")
    throw new Error("sourcing_search_rollback_guard_missing");
  const [create, seed, target, owner, drop] = migration.statements;
  const guard = "scoutops_sourcing_search_scope_guard";
  if (
    !create?.startsWith(`CREATE TEMPORARY TABLE ${guard} `) ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    !target?.startsWith(`INSERT INTO ${guard}\nSELECT 1 WHERE DATABASE()`) ||
    !owner?.startsWith(`INSERT INTO ${guard}\nSELECT 1 FROM sourcing_searches s`) ||
    !owner.includes("t.id=s.collection_task_id") ||
    !owner.includes("so.account_id<=>tor.account_id") ||
    drop !== `DROP TEMPORARY TABLE ${guard}`
  )
    throw new Error("sourcing_search_rollback_guard_changed");
  await db.query(create);
  try {
    for (const statement of [seed, target, projectTaskRollbackGuard(owner, taskRelation)])
      await db.query(statement);
  } finally {
    await db.query(drop);
  }
}

export async function preflightEvidenceRollback(db, bundle, taskRelation = "collection_tasks") {
  const migration = bundle.find(({ name }) => name === "0190_evidence_account_scope.down.sql");
  if (migration?.name !== "0190_evidence_account_scope.down.sql")
    throw new Error("evidence_rollback_guard_missing");
  const guard = "scoutops_evidence_scope_guard";
  const [create, seed, target, raw, normalized, rawKeys, normalizedKeys, drop, ddl] =
    migration.statements;
  const prefixes = [
    "SELECT 1 WHERE DATABASE()",
    "SELECT 1 FROM raw_evidence e\nLEFT JOIN collection_tasks",
    "SELECT 1 FROM normalized_records n\nLEFT JOIN raw_evidence",
    "SELECT 1 FROM raw_evidence e JOIN collection_tasks",
    "SELECT 1 FROM normalized_records n JOIN raw_evidence",
  ];
  const checks = [target, raw, normalized, rawKeys, normalizedKeys];
  if (
    create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    drop !== `DROP TEMPORARY TABLE ${guard}` ||
    !ddl?.startsWith("ALTER TABLE raw_evidence ADD COLUMN organization_id ") ||
    checks.some((sql, i) => !sql?.startsWith(`INSERT INTO ${guard}\n${prefixes[i]}`)) ||
    !raw?.includes("e.account_id<=>eo.account_id") ||
    !normalized?.includes("n.account_id<=>e.account_id") ||
    [rawKeys, normalizedKeys].some((sql) => !sql.includes("HAVING COUNT(*)>1 LIMIT 1"))
  )
    throw new Error("evidence_rollback_guard_changed");
  await db.query(create);
  try {
    for (const statement of [seed, ...checks])
      await db.query(projectTaskRollbackGuard(statement, taskRelation));
  } finally {
    await db.query(drop);
  }
}

export async function preflightTrendTopicRollback(db, bundle) {
  const migration = bundle.find(({ name }) => name === "0191_trend_topic_account_scope.down.sql");
  if (migration?.name !== "0191_trend_topic_account_scope.down.sql")
    throw new Error("trend_topic_rollback_guard_missing");
  const guard = "scoutops_topic_scope_guard";
  const [create, seed, target, owner, keys, drop, ddl] = migration.statements;
  if (
    create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    drop !== `DROP TEMPORARY TABLE ${guard}` ||
    !target?.startsWith(`INSERT INTO ${guard}\nSELECT 1 WHERE DATABASE()`) ||
    [owner, keys].some(
      (sql) => !sql?.startsWith(`INSERT INTO ${guard}\nSELECT 1 FROM trend_topics t`),
    ) ||
    !owner?.includes("r.source_id IS NULL OR w.id IS NULL") ||
    !owner?.includes("t.account_id<>o.account_id OR t.account_id<>s.account_id") ||
    !keys?.includes(
      "GROUP BY r.legacy_org_id,r.legacy_workspace_id,t.topic_key HAVING COUNT(*)>1 LIMIT 1",
    ) ||
    !ddl?.startsWith("ALTER TABLE trend_topics ADD COLUMN organization_id ")
  )
    throw new Error("trend_topic_rollback_guard_changed");
  await db.query(create);
  try {
    for (const statement of [seed, target, owner, keys]) await db.query(statement);
  } finally {
    await db.query(drop);
  }
}

const sealedBusinessTaskCoordinates =
  "(SELECT t.id,r.legacy_org_id organization_id,r.legacy_workspace_id workspace_id " +
  "FROM tasks t JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
  "JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='tasks' AND r.source_id=t.id)";

const sealedOpportunityCoordinates =
  "(SELECT o.id,r.legacy_org_id organization_id,r.legacy_workspace_id workspace_id " +
  "FROM opportunities o JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
  "JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='opportunities' AND r.source_id=o.id)";

export async function preflightTenancyRootRollback(db, bundle) {
  const guard = "scoutops_tenancy_root_guard";
  const migration = bundle.find(({ name }) => name === "0197_retire_tenancy_roots.down.sql");
  const [create, seed, target, references, triggers, views, drop, rename] =
    migration?.statements ?? [];
  if (
    create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    !target?.startsWith(`INSERT INTO ${guard}\nSELECT 1 WHERE DATABASE()`) ||
    !references?.startsWith(
      `INSERT INTO ${guard}\nSELECT 1 FROM information_schema.KEY_COLUMN_USAGE k`,
    ) ||
    !triggers?.startsWith(`INSERT INTO ${guard}\nSELECT 1 FROM information_schema.TRIGGERS`) ||
    views !==
      `INSERT INTO ${guard}
SELECT 1 FROM information_schema.TABLES t
LEFT JOIN information_schema.VIEWS v ON v.TABLE_SCHEMA=t.TABLE_SCHEMA AND v.TABLE_NAME=t.TABLE_NAME
WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_TYPE='VIEW'
  AND (NULLIF(v.VIEW_DEFINITION,'') IS NULL
    OR LOWER(v.VIEW_DEFINITION) REGEXP '(^|[^[:alnum:]_])(historical_organizations|historical_workspaces)([^[:alnum:]_]|$)')
LIMIT 1` ||
    drop !== `DROP TEMPORARY TABLE ${guard}` ||
    rename !==
      "RENAME TABLE historical_organizations TO organizations, historical_workspaces TO workspaces"
  )
    throw new Error("tenancy_root_rollback_guard_changed");
  await db.query(create);
  try {
    for (const sql of [seed, target, references, triggers, views]) await db.query(sql);
  } finally {
    await db.query(drop);
  }
  // Only preflight SELECTs read the archive. Actual down files run unchanged,
  // after 0197 has restored the original names and foreign-key relationships.
  return {
    query: (sql) =>
      db.query(
        sql.replace(
          /\b(FROM|JOIN) (organizations|workspaces)\b/g,
          (_, join, table) => `${join} historical_${table}`,
        ),
      ),
  };
}

export async function preflightOutboxRollback(db, bundle) {
  const guard = "scoutops_outbox_scope_guard";
  const migration = bundle.find(({ name }) => name === "0196_outbox_historical_scope.down.sql");
  const [create, seed, target, missingArchive, missingLive, drop, ddl] =
    migration?.statements ?? [];
  if (
    create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    !target?.startsWith(`INSERT INTO ${guard}\nSELECT 1 WHERE DATABASE()`) ||
    missingArchive !==
      `INSERT INTO ${guard}\nSELECT 1 FROM outbox_events e LEFT JOIN outbox_event_scope_history h ON h.event_id=e.id\nWHERE h.event_id IS NULL LIMIT 1` ||
    missingLive !==
      `INSERT INTO ${guard}\nSELECT 1 FROM outbox_event_scope_history h LEFT JOIN outbox_events e ON e.id=h.event_id\nWHERE e.id IS NULL LIMIT 1` ||
    drop !== `DROP TEMPORARY TABLE ${guard}` ||
    !ddl?.startsWith("ALTER TABLE outbox_events ADD COLUMN organization_id ")
  )
    throw new Error("outbox_rollback_guard_changed");
  await db.query(create);
  try {
    for (const sql of [seed, target, missingArchive, missingLive]) await db.query(sql);
  } finally {
    await db.query(drop);
  }
  return (
    "(SELECT live.id,history.legacy_org_id organization_id,history.legacy_workspace_id workspace_id " +
    "FROM outbox_events live JOIN outbox_event_scope_history history ON history.event_id=live.id)"
  );
}

export async function preflightOpportunityRollback(db, bundle) {
  const guard = "scoutops_opportunity_scope_guard";
  const migration = bundle.find(({ name }) => name === "0195_opportunity_account_scope.down.sql");
  const [create, seed, target, owner, collision, drop, ddl] = migration?.statements ?? [];
  if (
    create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    !target?.startsWith(`INSERT INTO ${guard}\nSELECT 1 WHERE DATABASE()`) ||
    !owner?.startsWith(`INSERT INTO ${guard}\nSELECT 1 FROM opportunities t`) ||
    !owner.includes("NOT (t.account_id<=>o.account_id)") ||
    !collision?.startsWith(`INSERT INTO ${guard}\nSELECT 1 FROM opportunities t`) ||
    !collision.includes(
      "GROUP BY r.legacy_org_id,r.legacy_workspace_id,t.source_type,t.source_ref_id HAVING COUNT(*)>1",
    ) ||
    drop !== `DROP TEMPORARY TABLE ${guard}` ||
    !ddl?.startsWith("ALTER TABLE opportunities ADD COLUMN organization_id ")
  )
    throw new Error("opportunity_rollback_guard_changed");
  await db.query(create);
  try {
    for (const sql of [seed, target, owner, collision]) await db.query(sql);
  } finally {
    await db.query(drop);
  }
  return sealedOpportunityCoordinates;
}

export async function preflightBusinessTaskRollback(db, bundle) {
  const guard = "scoutops_business_task_scope_guard";
  const migration = bundle.find(({ name }) => name === "0193_business_task_account_scope.down.sql");
  const [create, seed, target, owner, delivery, drop, ddl] = migration?.statements ?? [];
  if (
    create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    !target?.startsWith(`INSERT INTO ${guard}\nSELECT 1 WHERE DATABASE()`) ||
    !owner?.startsWith(`INSERT INTO ${guard}\nSELECT 1 FROM tasks t`) ||
    !owner?.includes("NOT (t.account_id<=>o.account_id)") ||
    !delivery?.startsWith(`INSERT INTO ${guard}\nSELECT 1 FROM outbox_events e`) ||
    !delivery?.includes("'$.task_account_contract'") ||
    drop !== `DROP TEMPORARY TABLE ${guard}` ||
    !ddl?.startsWith("ALTER TABLE tasks ADD COLUMN organization_id ")
  )
    throw new Error("business_task_rollback_guard_changed");
  await db.query(create);
  try {
    for (const sql of [seed, target, owner, delivery]) await db.query(sql);
  } finally {
    await db.query(drop);
  }
}

export async function preflightAccountRehearsalForward(db, bundle) {
  const [rows] = await db.query("SELECT name,checksum FROM schema_migrations WHERE name IN (?)", [
    bundle.map(({ name }) => name),
  ]);
  const receipts = new Map(rows.map((row) => [row.name, row.checksum]));
  let gap = false;
  for (const { name, checksum } of bundle) {
    if (!receipts.has(name)) {
      gap = true;
      continue;
    }
    if (receipts.get(name) !== checksum) throw new Error(`migration_checksum_drift:${name}`);
    if (gap) throw new Error(`account_migration_receipt_gap:${name}`);
  }

  const name = "0194_competitor_account_scope.up.sql";
  if (receipts.has(name)) return;
  const guard = "scoutops_competitor_scope_guard";
  const [create, seed, target, owner, keys, drop, ddl] =
    bundle.find((item) => item.name === name)?.statements ?? [];
  const prefix = `INSERT INTO ${guard}\n`;
  if (
    create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    drop !== `DROP TEMPORARY TABLE ${guard}` ||
    !(target?.startsWith(`${prefix}SELECT 1 WHERE DATABASE()`) ||
      target?.startsWith(`${prefix}SELECT 1 WHERE BINARY DATABASE() <> BINARY 'product_scout'`)) ||
    !target.includes("0075_competitor_opportunity_identity.up.sql") ||
    !owner?.startsWith(`${prefix}SELECT 1 FROM competitors c\nJOIN account_ownership_cutover`) ||
    !owner.includes("snap.id=c.latest_snapshot_id") ||
    !keys?.startsWith(`${prefix}SELECT 1 FROM competitors c JOIN account_owned_records`) ||
    !keys.includes("HAVING COUNT(*)>1") ||
    !ddl?.startsWith("ALTER TABLE competitors ADD COLUMN account_id ")
  )
    throw new Error("competitor_forward_guard_changed");
  for (const [statement, error] of [
    [target, "competitor_forward_index_or_receipt_mismatch"],
    [owner, "competitor_forward_original_owner_or_reference_mismatch"],
    [keys, "competitor_forward_account_identity_collision"],
  ]) {
    // Run the exact existing guard queries without their temporary INSERT wrapper.
    const [violations] = await db.query(
      statement.slice(prefix.length).replace(/^SELECT 1 WHERE /, "SELECT 1 FROM DUAL WHERE "),
    );
    if (violations.length) throw new Error(error);
  }
}

async function readForwardMigration(relativeName) {
  const name = basename(relativeName);
  const sql = await readFile(resolve("database/migrations", name), "utf8");
  const checksum = createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex");
  return { name, checksum, statements: splitSqlStatements(sql) };
}

export async function preflightCompetitorRollback(db, bundle) {
  const guard = "scoutops_competitor_scope_guard";
  const migration = bundle.find(({ name }) => name === "0194_competitor_account_scope.down.sql");
  const [create, seed, target, owner, collision, delivery, drop, ddl] = migration?.statements ?? [];
  const check = (sql, start, marker) =>
    sql?.startsWith(`INSERT INTO ${guard}\nSELECT 1 ${start}`) &&
    sql.includes(marker) &&
    sql.endsWith("LIMIT 1");
  if (
    create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    !target?.startsWith(`INSERT INTO ${guard}\nSELECT 1 WHERE DATABASE()`) ||
    !check(owner, "FROM competitors c", "c.account_id<=>o.account_id") ||
    !check(
      collision,
      "FROM competitors c",
      "IF(legacy.has_0075,c.opportunity_id,NULL) HAVING COUNT(*)>1",
    ) ||
    !collision?.includes("ON legacy.has_0075=0 OR c.opportunity_id IS NOT NULL") ||
    !check(delivery, "FROM outbox_events e", "'$.competitor_account_contract'") ||
    drop !== `DROP TEMPORARY TABLE ${guard}` ||
    !ddl?.startsWith("ALTER TABLE competitors ADD COLUMN organization_id ")
  )
    throw new Error("competitor_rollback_guard_changed");
  await db.query(create);
  try {
    for (const sql of [seed, target, owner, collision, delivery]) await db.query(sql);
  } finally {
    await db.query(drop);
  }
}

export async function preflightCollectionTaskRollback(db, bundle) {
  const guard = "scoutops_task_scope_guard";
  const migration = bundle.find(
    ({ name }) => name === "0192_collection_task_account_scope.down.sql",
  );
  const [create, seed, target, owner, drop, ddl] = migration?.statements ?? [];
  if (
    create !== `CREATE TEMPORARY TABLE ${guard} (id INT PRIMARY KEY) ENGINE=InnoDB` ||
    seed !== `INSERT INTO ${guard} VALUES (1)` ||
    !target?.startsWith(`INSERT INTO ${guard}\nSELECT 1 WHERE DATABASE()`) ||
    !owner?.startsWith(`INSERT INTO ${guard}\nSELECT 1 FROM collection_tasks t`) ||
    !owner?.includes(
      "t.account_id<=>o.account_id AND t.account_id<=>s.account_id AND o.reason<=>s.reason",
    ) ||
    drop !== `DROP TEMPORARY TABLE ${guard}` ||
    !ddl?.startsWith("ALTER TABLE collection_tasks ADD COLUMN organization_id ")
  )
    throw new Error("collection_task_rollback_guard_changed");
  await db.query(create);
  try {
    for (const sql of [seed, target, owner]) await db.query(sql);
  } finally {
    await db.query(drop);
  }
}

async function main() {
  const requested = process.argv.slice(2);
  const rollbackRehearsal = matches(requested, accountRehearsalDown);
  const approvalRehearsal = rollbackRehearsal || matches(requested, accountRehearsalUp);
  if (
    !approvalRehearsal &&
    (!requested.length || requested.some((name) => !allowed.has(basename(name))))
  ) {
    throw new Error("deployment_migration_not_allowed");
  }

  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  for (const name of required) {
    if (!process.env[name]) throw new Error(`missing_${name.toLowerCase()}`);
  }
  if (
    approvalRehearsal &&
    (process.env.DB_HOST !== "127.0.0.1" ||
      !/^product_scout_[a-z0-9_]*rehearsal$/.test(process.env.DB_NAME) ||
      /^root$/i.test(process.env.DB_USER))
  )
    throw new Error("approval_migration_requires_isolated_mysql57");

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: "utf8mb4",
    connectionLimit: 1,
    multipleStatements: false,
  });

  let dedicated;
  try {
    if (approvalRehearsal) dedicated = await pool.getConnection();
    const db = dedicated ?? pool;
    const preservation = approvalRehearsal
      ? await import("./lib/account-migration-preservation.mjs")
      : null;
    if (approvalRehearsal) {
      const [[target]] = await db.query("SELECT DATABASE() db, VERSION() version");
      if (target?.db !== process.env.DB_NAME || !/^5\.7\./.test(target?.version ?? ""))
        throw new Error("approval_migration_requires_isolated_mysql57");
      const [[lock]] = await db.query(
        "SELECT GET_LOCK(CONCAT('scoutops-acct-approval:',LEFT(SHA2(DATABASE(),256),32)),0) acquired",
      );
      if (Number(lock?.acquired) !== 1) throw new Error("approval_migration_lock_busy");
      const [[receipt]] = await db.query(
        "SELECT contract_version FROM account_ownership_cutover WHERE slot='current'",
      );
      if (Number(receipt?.contract_version) !== 25)
        throw new Error("approval_migration_requires_ownership_receipt");
      await db.query("SET SESSION lock_wait_timeout=5");
    }
    const before = preservation ? await preservation.captureAccountMigrationPreservation(db) : null;
    const readBackPreservation = async () =>
      preservation.compareAccountMigrationPreservation(
        before,
        await preservation.captureAccountMigrationPreservation(db),
      );
    if (rollbackRehearsal) {
      // Preflight the entire bundle before running any down statement. An individual
      // migration may protect its own history, but it must not reject after later
      // schema changes have already been reversed.
      const bundle = await Promise.all(
        requested.map(async (name) => {
          const upName = name.replace(/\.down\.sql$/, ".up.sql");
          const up = await readFile(resolve("database/migrations", upName), "utf8");
          const checksum = createHash("sha256").update(up.replaceAll("\r\n", "\n")).digest("hex");
          const down = await readFile(resolve("database/migrations", name), "utf8");
          return { name, upName, checksum, statements: splitSqlStatements(down) };
        }),
      );
      for (const { upName, checksum } of bundle) {
        const [[row]] = await db.execute("SELECT checksum FROM schema_migrations WHERE name=?", [
          upName,
        ]);
        if (row?.checksum !== checksum)
          throw new Error(`rollback_requires_matching_receipt:${upName}`);
      }
      const [[history]] = await db.query(
        "SELECT EXISTS(SELECT 1 FROM account_cost_approval_events) has_events," +
          " EXISTS(SELECT 1 FROM account_cost_approval_outbox) has_deliveries",
      );
      if (Number(history?.has_events) !== 0 || Number(history?.has_deliveries) !== 0)
        throw new Error("rollback_would_remove_account_approval_history");
      await assertNoAccountScoreDecisions(db);
      const [[costSwitches]] = await db.query(
        "SELECT EXISTS(SELECT 1 FROM cost_operations " +
          "WHERE route='POST:/api/v1/cost-rules:account' OR (route LIKE 'POST:/api/v1/cost-rules/%/actions:account' " +
          "AND JSON_UNQUOTE(JSON_EXTRACT(result_json,'$.result.status')) IN ('active','pending_approval'))) has_switches",
      );
      if (Number(costSwitches?.has_switches) !== 0)
        throw new Error("rollback_would_invalidate_account_cost_rule_switch_history");
      const [[trendRuleOwner]] = await db.query(
        "SELECT EXISTS(SELECT 1 FROM trend_monitoring_rules r LEFT JOIN account_owned_records o " +
          "ON o.source_table='trend_monitoring_rules' AND o.source_id=r.id " +
          "WHERE NOT (r.account_id <=> o.account_id)) owner_divergence",
      );
      if (Number(trendRuleOwner?.owner_divergence) !== 0)
        throw new Error("rollback_would_remove_divergent_trend_rule_owner");
      const checks = await preflightTenancyRootRollback(db, bundle);
      const outboxScope = await preflightOutboxRollback(checks, bundle);
      const opportunityScope = await preflightOpportunityRollback(checks, bundle);
      await preflightCompetitorRollback(checks, bundle);
      await preflightBusinessTaskRollback(checks, bundle);
      await preflightCollectionTaskRollback(checks, bundle);
      const { accountRehearsalTaskScope } = await import("./lib/account-rehearsal-task-scope.mjs");
      const taskScope = await accountRehearsalTaskScope(db);
      if (!taskScope.native) throw new Error("collection_task_rollback_requires_native_scope");
      await preflightTrendTopicRollback(checks, bundle);
      await preflightEvidenceRollback(checks, bundle, taskScope.relation);
      await preflightRecentHistoricalRollback(checks, bundle, taskScope.relation, outboxScope);
      await preflightSourcingSearchRollback(checks, bundle, taskScope.relation);
      await assertCalculationRollbackScope(
        checks,
        await scoreRuleScopeRelation(db),
        await costRuleScopeRelation(db),
        sealedBusinessTaskCoordinates,
        opportunityScope,
      );
      await assertSupplierQuoteRollbackScope(checks, true, true, taskScope.relation);
      await assertSelectionJourneyRollbackScope(checks, true, taskScope.relation, opportunityScope);
      await preflightUiPreferenceRollback(checks, bundle);
      const results = [];
      for (const { name, upName, checksum, statements } of bundle) {
        for (const statement of statements)
          await executeMigrationStatement((value) => db.query(value), statement);
        const [deleted] = await db.execute(
          "DELETE FROM schema_migrations WHERE name=? AND checksum=?",
          [upName, checksum],
        );
        if (deleted.affectedRows !== 1) throw new Error(`rollback_receipt_changed:${upName}`);
        results.push({ name, status: "rolled_back" });
      }
      const originalData = await readBackPreservation();
      process.stdout.write(
        `${JSON.stringify({ status: "ok", migrations: results, preservation: originalData })}\n`,
      );
      return;
    }
    const forwardBundle = approvalRehearsal
      ? await Promise.all(requested.map(readForwardMigration))
      : null;
    if (forwardBundle) await preflightAccountRehearsalForward(db, forwardBundle);
    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      checksum CHAR(64) CHARACTER SET ascii NOT NULL,
      applied_at DATETIME(3) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const results = [];
    for (const [index, relativeName] of requested.entries()) {
      const { name, checksum, statements } =
        forwardBundle?.[index] ?? (await readForwardMigration(relativeName));
      const [rows] = await db.query("SELECT checksum FROM schema_migrations WHERE name=?", [name]);
      if (rows[0]) {
        if (rows[0].checksum !== checksum) throw new Error(`migration_checksum_drift:${name}`);
        results.push({ name, status: "already_applied" });
        continue;
      }
      for (const statement of statements)
        await executeMigrationStatement((value) => db.query(value), statement);
      await db.query(
        "INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))",
        [name, checksum],
      );
      results.push({ name, status: "applied" });
    }
    const originalData = preservation ? await readBackPreservation() : null;
    process.stdout.write(
      `${JSON.stringify({
        status: "ok",
        migrations: results,
        ...(originalData && { preservation: originalData }),
      })}\n`,
    );
  } finally {
    dedicated?.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
