import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("fixed-layout deployment packages and applies only allowlisted migrations before BaoTa restart", async () => {
  const [deploy, runner] = await Promise.all([
    readFile("scripts/deploy-baota.py", "utf8"),
    readFile("scripts/apply-deployment-migrations.mjs", "utf8"),
  ]);
  assert.match(deploy, /apply-deployment-migrations\.mjs/);
  assert.match(deploy, /0040_platform_messages\.up\.sql/);
  assert.match(deploy, /0042_erp_product_import\.up\.sql/);
  assert.match(deploy, /0043_trend_rule_collection_schedule\.up\.sql/);
  assert.match(deploy, /0044f_enable_amazon_public_crawler\.up\.sql/);
  assert.match(deploy, /0041_member_workspace_tasks\.up\.sql/);
  assert.match(deploy, /0047_approval_decision_context_snapshot\.up\.sql/);
  assert.match(deploy, /0048_browser_collection_jobs\.up\.sql/);
  assert.match(deploy, /0049_credential_renewal_auto_replay\.up\.sql/);
  assert.match(deploy, /0050_browser_evidence_artifacts\.up\.sql/);
  assert.match(deploy, /0051a_provider_parser_samples\.up\.sql/);
  assert.match(deploy, /0051b_provider_parser_sample_replay_runs\.up\.sql/);
  assert.match(deploy, /0051c_provider_parser_sample_operations\.up\.sql/);
  assert.match(deploy, /0052a_amazon_structured_parser\.up\.sql/);
  assert.match(deploy, /0052b_provider_public_compliance\.up\.sql/);
  assert.match(deploy, /0065_opportunity_operating_feedback\.up\.sql/);
  assert.match(deploy, /0066_automation_task_source_restore\.up\.sql/);
  assert.match(deploy, /0067_usernames_login\.up\.sql/);
  assert.match(deploy, /0068_automatic_selection_rule_matches\.up\.sql/);
  assert.match(deploy, /0069_rule_based_recommendations\.up\.sql/);
  assert.match(deploy, /0070_rule_candidates_quality_gate\.up\.sql/);
  assert.match(deploy, /0071_opportunity_migration_timestamp_timezone\.up\.sql/);
  assert.match(deploy, /0072_automatic_quality_evaluation\.up\.sql/);
  assert.match(deploy, /"npm\.cmd" if os\.name == "nt" else "npm"/);
  assert.match(deploy, /verify-release-change-ownership\.mjs/);
  assert.match(deploy, /release-change-ownership\.json/);
  assert.match(deploy, /EXPECTED_GITHUB_REPOSITORY = "18Mozhi\/midou-ai-Product-Selection"/);
  assert.match(deploy, /git", "fetch", "--quiet", "--no-tags", "origin", "main"/);
  assert.match(deploy, /local main and origin\/main must be the same commit/);
  assert.match(deploy, /merge-base", "--is-ancestor", production_sha, target_sha/);
  assert.match(
    deploy,
    /production BUILD_SHA is not an ancestor in the current approved repository history/,
  );
  for (const name of [
    "RELEASE_SOURCE_LOCAL_SHA",
    "RELEASE_SOURCE_REMOTE_SHA",
    "RELEASE_SOURCE_REMOTE_BRANCH",
    "RELEASE_SOURCE_REPOSITORY",
  ])
    assert.match(deploy, new RegExp(name));
  assert.match(deploy, /\/api\/v1\/health\/available/);
  assert.match(deploy, /available_status == "available"/);
  assert.match(deploy, /shutil\.chown\(runtime, user="root", group="www"\)/);
  assert.match(deploy, /os\.chmod\(runtime, 0o2770\)/);
  assert.match(deploy, /"crawler-completions"/);
  assert.match(deploy, /shutil\.chown\(destination, user="root", group="www"\)/);
  assert.match(deploy, /os\.chmod\(destination, 0o2770\)/);
  assert.match(deploy, /shutil\.chown\(config, user="root", group="www"\)/);
  assert.match(deploy, /os\.chmod\(config, 0o750\)/);
  assert.match(deploy, /shutil\.chown\(env_file, user="root", group="www"\)/);
  assert.match(deploy, /shutil\.chown\(release_file, user="root", group="www"\)/);
  assert.match(
    deploy,
    /upload = root \/ \("\.deploy-upload-" \+ v\["build_sha"\] \+ "\.tar\.gz"\)/,
  );
  assert.match(
    deploy,
    /permitted_entries = allowed \| \{\{stage\.name, rollback\.name, upload\.name\}\}/,
  );
  assert.ok(
    deploy.lastIndexOf("verify_release_change_ownership(repo)") <
      deploy.lastIndexOf("read_windows_credential()"),
  );
  assert.match(deploy, /remote_python\(client, panel_deploy_source/);
  assert.ok(
    deploy.indexOf("ssh_exec(client, migrate") <
      deploy.indexOf("remote_python(client, panel_deploy_source"),
  );
  assert.ok(
    deploy.indexOf('remote_python(client, panel_node_action_source("stop")') <
      deploy.indexOf("ssh_exec(client, migrate"),
  );
  assert.match(deploy, /if node_stopped_for_migration:[\s\S]*panel_node_action_source\("start"\)/);
  assert.match(deploy, /def project_processes\(\):/);
  assert.match(deploy, /apps\/worker\/dist\/index\.js/);
  assert.match(deploy, /deadline=time\.time\(\) \+ 45/);
  assert.match(deploy, /if remaining:[\s\S]*Node project processes did not stop/);
  assert.match(deploy, /time\.sleep\(2\)/);
  const orderedMigrations = [
    "0040_platform_messages.up.sql",
    "0041_member_workspace_tasks.up.sql",
    "0042_erp_product_import.up.sql",
    "0043_trend_rule_collection_schedule.up.sql",
    "0044a_competitor_soft_delete.up.sql",
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
  ];
  let previousIndex = -1;
  for (const migration of orderedMigrations) {
    const index = runner.indexOf(`"${migration}"`);
    assert.ok(index > previousIndex, `${migration} must remain allowlisted in deployment order`);
    previousIndex = index;
  }
  assert.match(runner, /migration_checksum_drift/);
  assert.doesNotMatch(runner, /readdir|glob/);
});

test("allowlisted deployment migrations use the locked statement splitter", async () => {
  const { splitSqlStatements } = await import("../../scripts/apply-deployment-migrations.mjs");
  for (const name of [
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
  ]) {
    const sql = await readFile(`database/migrations/${name}`, "utf8");
    const statements = splitSqlStatements(sql);
    assert.ok(statements.length >= 1, `${name} must contain executable SQL`);
    assert.ok(statements.every((statement) => !statement.includes(";")));
    const expectedStatementCounts = {
      "0054_crawler_succeeded_empty.up.sql": 2,
      "0060_opportunity_workflow_visibility.up.sql": 4,
      "0064_governed_workflow_confirmations.up.sql": 7,
      "0069_rule_based_recommendations.up.sql": 2,
      "0072_automatic_quality_evaluation.up.sql": 4,
    };
    assert.equal(
      statements.length,
      expectedStatementCounts[name] ?? 1,
      `${name} statement count changed unexpectedly`,
    );
  }
});

test("opportunity timestamp repair only adjusts rows stamped by migration 0070", async () => {
  const sql = await readFile(
    "database/migrations/0071_opportunity_migration_timestamp_timezone.up.sql",
    "utf8",
  );
  assert.match(sql, /FROM `schema_migrations` m/);
  assert.match(sql, /WHERE m\.`name`='0070_rule_candidates_quality_gate\.up\.sql'/);
  assert.match(sql, /TIMESTAMPDIFF\(SECOND,UTC_TIMESTAMP\(3\),NOW\(3\)\)/);
  assert.match(
    sql,
    /TIMESTAMPDIFF\(\s*MICROSECOND,\s*o\.`updated_at`,\s*\(\s*SELECT m\.`applied_at`/s,
  );
  assert.match(sql, /o\.`score_rule_version` IS NULL/);
  assert.match(sql, /o\.`recommendation_status`='insufficient_data'/);
});

test("deployment migration statements retry only transient MySQL lock failures", async () => {
  const { executeMigrationStatement } =
    await import("../../scripts/apply-deployment-migrations.mjs");
  const attempts = [];
  const waits = [];
  const result = await executeMigrationStatement(
    async (statement) => {
      attempts.push(statement);
      if (attempts.length < 3) throw { code: "ER_LOCK_DEADLOCK" };
      return "applied";
    },
    "UPDATE opportunities SET updated_at=updated_at",
    { retryDelaysMs: [1, 2], wait: async (delay) => waits.push(delay) },
  );
  assert.equal(result, "applied");
  assert.equal(attempts.length, 3);
  assert.deepEqual(waits, [1, 2]);
  await assert.rejects(
    executeMigrationStatement(
      async () => {
        throw { code: "ER_PARSE_ERROR" };
      },
      "invalid",
      { retryDelaysMs: [1], wait: async () => undefined },
    ),
    (error) => error.code === "ER_PARSE_ERROR",
  );
});
