import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { preflightCompetitorRollback, splitSqlStatements } from "../../scripts/apply-deployment-migrations.mjs";

const statements = async direction => splitSqlStatements(await readFile(new URL(
  `../../database/migrations/0194_competitor_account_scope.${direction}.sql`, import.meta.url,
), "utf8"));

test("0194 validates the exact historical layout, ownership and references before dropping old competitor columns", async () => {
  const up = await statements("up");
  assert.match(up[2], /INDEX_NAME='uq_competitor_identity'.*organization_id,workspace_id,market,source_site,external_id/s);
  assert.match(up[3], /snap.id=c.latest_snapshot_id AND snap.competitor_id=c.id/);
  assert.match(up[3], /c.opportunity_id IS NOT NULL AND NOT\(p.account_id<=>o.account_id\)/);
  assert.match(up[4], /GROUP BY o.account_id,c.market,c.source_site,c.external_id,c.opportunity_id HAVING COUNT\(\*\)>1/);
  assert.match(up[5], /^DROP TEMPORARY TABLE/);
  assert.match(up[6], /^ALTER TABLE competitors ADD COLUMN account_id/);
  assert.match(up.at(-1), /DROP COLUMN organization_id, DROP COLUMN workspace_id/);
  assert.doesNotMatch(up.join("\n"), /DELETE FROM|DROP FOREIGN KEY fk_competitor_(opportunity|latest_snapshot|provider|creator)/i);
});

test("0194 rollback checks original identity collisions and refuses unsealed rows before DDL", async () => {
  const down = await statements("down");
  assert.match(down[3], /r.source_id IS NULL.*c.account_id<=>o.account_id/s);
  assert.match(down[4], /ON legacy\.has_0075=0 OR c\.opportunity_id IS NOT NULL/);
  assert.match(down[4], /GROUP BY r\.legacy_org_id,r\.legacy_workspace_id,c\.market,c\.source_site,c\.external_id,\s+IF\(legacy\.has_0075,c\.opportunity_id,NULL\) HAVING COUNT\(\*\)>1/);
  assert.match(down[5], /JSON_CONTAINS_PATH\(e.payload_json,'one','\$\.competitor_account_contract'\)/);
  assert.match(down[7], /^ALTER TABLE competitors ADD COLUMN organization_id/);
  assert.match(down[9], /EXISTS \(SELECT 1 FROM schema_migrations WHERE name='0075_competitor_opportunity_identity\.up\.sql'\)/);
  assert.match(down[10], /ADD UNIQUE KEY uq_competitor_identity \(organization_id,workspace_id,market,source_site,external_id',IF\(@scoutops_competitor_has_0075,',opportunity_id',''\),'\)/);
  assert.deepEqual(down.slice(11).map((sql) => sql.trim()), [
    "PREPARE scoutops_competitor_restore_index FROM @scoutops_competitor_restore_ddl",
    "EXECUTE scoutops_competitor_restore_index",
    "DEALLOCATE PREPARE scoutops_competitor_restore_index",
  ]);
});

test("0194 bundle preflight stops before any persistent DDL and drops its guard", async () => {
  const down = await statements("down");
  const seen = [], failure = new Error("new delivery");
  await assert.rejects(preflightCompetitorRollback({ async query(sql) {
    seen.push(sql);
    if (sql.includes("competitor_account_contract")) throw failure;
  } }, [{ name: "0194_competitor_account_scope.down.sql", statements: down }]), failure);
  assert.deepEqual(seen, down.slice(0,7));
});
