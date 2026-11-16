import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { splitSqlStatements } from "../../scripts/apply-deployment-migrations.mjs";

const read = async direction => splitSqlStatements(await readFile(new URL(
  `../../database/migrations/0195_opportunity_account_scope.${direction}.sql`, import.meta.url,
), "utf8"));

test("0195 checks account, source topic and destination identity before changing the opportunity table", async () => {
  const up = await read("up");
  assert.match(up[2], /rehearsal/);
  assert.match(up[3], /topic.source_id=t.source_ref_id/);
  assert.match(up[3], /topic.account_id<=>o.account_id/);
  assert.match(up[4], /GROUP BY o.account_id,t.source_type,t.source_ref_id HAVING COUNT\(\*\)>1/);
  assert.match(up[6], /^ALTER TABLE opportunities ADD COLUMN account_id/);
  assert.match(up.at(-1), /DROP COLUMN organization_id, DROP COLUMN workspace_id$/);
  assert.doesNotMatch(up.join("\n"), /DELETE FROM|DROP FOREIGN KEY fk_opportunity_(owner|creator)/i);
});

test("0195 rollback uses only sealed original coordinates and checks the original unique key", async () => {
  const down = await read("down");
  assert.equal((down[3].match(/JOIN workspaces w /g) ?? []).length,1);
  assert.match(down[3], /NOT \(t.account_id<=>o.account_id\)/);
  assert.match(down[4], /GROUP BY r.legacy_org_id,r.legacy_workspace_id,t.source_type,t.source_ref_id HAVING COUNT\(\*\)>1/);
  assert.match(down[7], /source_table='opportunities' AND r.source_id=t.id/);
  assert.match(down.at(-1), /ADD UNIQUE KEY uq_opportunity_source \(organization_id,workspace_id,source_type,source_ref_id\)/);
});
