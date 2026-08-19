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
  assert.match(deploy, /remote_python\(client, panel_deploy_source/);
  assert.ok(
    deploy.indexOf("ssh_exec(client, migrate") <
      deploy.indexOf("remote_python(client, panel_deploy_source"),
  );
  assert.match(
    runner,
    /allowed = new Set\(\["0040_platform_messages\.up\.sql"\]\)/,
  );
  assert.match(runner, /migration_checksum_drift/);
  assert.doesNotMatch(runner, /readdir|glob/);
});
