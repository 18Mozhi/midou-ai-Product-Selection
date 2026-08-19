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
  assert.match(deploy, /"npm\.cmd" if os\.name == "nt" else "npm"/);
  assert.match(deploy, /remote_python\(client, panel_deploy_source/);
  assert.ok(
    deploy.indexOf("ssh_exec(client, migrate") <
      deploy.indexOf("remote_python(client, panel_deploy_source"),
  );
  assert.match(
    runner,
    /"0040_platform_messages\.up\.sql"[\s\S]*"0041_member_workspace_tasks\.up\.sql"[\s\S]*"0042_erp_product_import\.up\.sql"[\s\S]*"0043_trend_rule_collection_schedule\.up\.sql"[\s\S]*"0044a_competitor_soft_delete\.up\.sql"[\s\S]*"0044f_enable_amazon_public_crawler\.up\.sql"/,
  );
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
  ]) {
    const sql = await readFile(`database/migrations/${name}`, "utf8");
    const statements = sql
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean);
    assert.equal(statements.length, 1, `${name} must remain single-statement`);
  }
});
