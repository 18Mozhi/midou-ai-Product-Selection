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
  assert.match(deploy, /"npm\.cmd" if os\.name == "nt" else "npm"/);
  assert.match(deploy, /remote_python\(client, panel_deploy_source/);
  assert.ok(
    deploy.indexOf("ssh_exec(client, migrate") <
      deploy.indexOf("remote_python(client, panel_deploy_source"),
  );
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

test("allowlisted deployment migrations remain single-statement for the locked MySQL runner", async () => {
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
  ]) {
    const sql = await readFile(`database/migrations/${name}`, "utf8");
    const statements = sql
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean);
    assert.equal(statements.length, 1, `${name} must remain single-statement`);
  }
});
