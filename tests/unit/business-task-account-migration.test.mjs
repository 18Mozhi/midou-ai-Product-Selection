import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { preflightBusinessTaskRollback, assertCalculationRollbackScope, splitSqlStatements } from "../../scripts/apply-deployment-migrations.mjs";

const read = async (direction) => splitSqlStatements(await readFile(new URL(
  `../../database/migrations/0193_business_task_account_scope.${direction}.sql`, import.meta.url,
), "utf8"));

test("0193 bundle refuses native deliveries before running any permanent SQL", async () => {
  const statements = await read("down");
  const seen = [];
  const failure = new Error("native delivery");
  await assert.rejects(preflightBusinessTaskRollback({query: async sql => {
    seen.push(sql);
    if (sql.includes("task_account_contract")) throw failure;
  }}, [{ name: "0193_business_task_account_scope.down.sql", statements }]), failure);
  assert.deepEqual(seen, statements.slice(0, 6));
});

test("rollback checks scoring triggers against sealed business task coordinates before restoring columns", async () => {
  const relation = "(SELECT id,organization_id,workspace_id FROM sealed_tasks)";
  let checked = false;
  await assertCalculationRollbackScope({query: async sql => {
    if (sql.includes("h.trigger_task_id")) {
      assert.ok(sql.includes("LEFT JOIN " + relation + " t ON t.id=h.trigger_task_id"));
      checked = true;
    }
    return [[{ incompatible: 0 }]];
  }}, "score_rules", "cost_rules", relation);
  assert.ok(checked);
});

test("0193 checks sealed ownership and account-level source collisions before any persistent DDL", async () => {
  const up = await read("up");
  assert.match(up[2], /DATABASE\(\) NOT REGEXP.*rehearsal/);
  assert.match(up[3], /r.source_table='tasks' AND r.source_id=t.id/);
  assert.match(up[3], /r.legacy_org_id<=>t.organization_id AND r.legacy_workspace_id<=>t.workspace_id/);
  assert.match(up[3], /s.account_id<=>o.account_id AND s.reason<=>o.reason/);
  assert.match(up[4], /GROUP BY o.account_id,t.source_type,t.source_ref_id HAVING COUNT\(\*\)>1/);
  assert.match(up[5], /^DROP TEMPORARY TABLE/);
  assert.match(up[6], /^ALTER TABLE tasks ADD COLUMN account_id/);
  assert.match(up.at(-1), /DROP COLUMN organization_id, DROP COLUMN workspace_id$/);
  assert.doesNotMatch(up.join("\n"), /\b(DELETE FROM|TRUNCATE|DROP TABLE|INSERT IGNORE)\b/i);
});

test("0193 down restores each original coordinate before restoring the original source key", async () => {
  const down = await read("down");
  assert.match(down[3], /NOT \(t.account_id<=>o.account_id\)/);
  assert.match(down[4], /task_account_contract/);
  assert.match(down[7], /r.run_id=cut.source_run_id AND r.source_table='tasks' AND r.source_id=t.id/);
  assert.match(down.at(-1), /ADD UNIQUE KEY uq_tasks_source \(organization_id,workspace_id,source_type,source_ref_id\)/);
  assert.match(down.at(-1), /DROP COLUMN account_id$/);
  assert.doesNotMatch(down.join("\n"), /DROP FOREIGN KEY fk_tasks_(collection_task|assignee|creator|deleted_by)\b/);
});
