import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compareAccountMigrationPreservation } from "../../scripts/lib/account-migration-preservation.mjs";
import {
  captureOriginalBusinessRows,
  originalBusinessTables,
} from "../../scripts/lib/account-original-business-rows.mjs";

const sha = (digit) => digit.repeat(64);
function snapshot() {
  return {
    quotes: {
      schema: "account_quote_snapshot_v1",
      database: "product_scout_check_rehearsal",
      source_run_id: "test-run",
      tables: {
        supplier_quotes: { rows: 2, sha256: sha("a") },
        sourcing_comparisons: { rows: 1, sha256: sha("b") },
        exchange_rate_quotes: { rows: 0, sha256: sha("c") },
      },
    },
    trends: { topics: 2, topics_sha256: sha("d"), signals: 3, signals_sha256: sha("e") },
    business: Object.fromEntries(
      originalBusinessTables.map((table) => [table, { rows: 1, sha256: sha("9") }]),
    ),
  };
}

test("compares original quotes and trends but does not attest to nonempty coverage for empty tables", () => {
  const report = compareAccountMigrationPreservation(snapshot(), snapshot());
  assert.equal(report.status, "matched");
  assert.equal(report.scope, "this_invocation");
  assert.equal(report.quotes.sourcing_comparisons.status, "matched");
  assert.equal(report.quotes.exchange_rate_quotes.status, "no_historical_rows");
  assert.equal(report.trends.signals.rows, 3);
});

test("same counts do not mask a changed quote, comparison order, or original signal", () => {
  const before = snapshot();
  const after = snapshot();
  after.quotes.tables.supplier_quotes.sha256 = sha("f");
  after.quotes.tables.sourcing_comparisons.sha256 = sha("f");
  after.trends.signals_sha256 = sha("f");
  after.business.tasks.sha256 = sha("f");
  after.business.cost_rule_approvals.sha256 = sha("f");
  assert.throws(
    () => compareAccountMigrationPreservation(before, after),
    /account_migration_preservation_mismatch:supplier_quotes,sourcing_comparisons,signals,tasks,cost_rule_approvals$/,
  );
  after.quotes.source_run_id = "different-run";
  assert.throws(
    () => compareAccountMigrationPreservation(before, after),
    /quote_snapshot_batch_mismatch/,
  );
});

test("business row capture accepts only known scope changes and normalizes only the old approval slot", async () => {
  function connection(scope, value = sha("a")) {
    let rolledBack = false;
    return {
      get rolledBack() {
        return rolledBack;
      },
      async rollback() {
        rolledBack = true;
      },
      async query(sql, args) {
        if (/^SET TRANSACTION|^START TRANSACTION/.test(sql)) return [];
        const [, table] = sql.match(/FROM `([a-z_]+)`/) ?? [];
        assert.ok(originalBusinessTables.includes(table));
        if (sql.startsWith("SHOW COLUMNS")) {
          const approval = table === "cost_rule_approvals" ? ["approval_role", "actor_id"] : [];
          const fields = scope.filter(
            (field) => field !== "historical_context" || table.endsWith("_rules"),
          );
          return [["id", ...fields, "note", ...approval].map((Field) => ({ Field }))];
        }
        assert.doesNotMatch(sql, /workspace_id|historical_context|\baccount_id\b/);
        assert.match(sql, /HEX\(CAST\(`note` AS BINARY\)\)/);
        assert.match(sql, /WHERE id>\? ORDER BY id LIMIT 500$/);
        if (table === "cost_rule_approvals") {
          assert.match(
            sql,
            /CASE WHEN approval_role='organization_admin' THEN 'primary_account' ELSE approval_role END/,
          );
          assert.match(sql, /CAST\(`actor_id` AS BINARY\)/);
        } else {
          assert.doesNotMatch(sql, /CASE WHEN/);
        }
        return [args[0] ? [] : [{ id: "original-row", digest: value }]];
      },
    };
  }
  const before = connection(["organization_id", "workspace_id"]);
  const after = connection(["account_id", "historical_context"]);
  assert.deepEqual(
    await captureOriginalBusinessRows(before),
    await captureOriginalBusinessRows(after),
  );
  assert.equal(before.rolledBack && after.rolledBack, true);
  const broken = connection([], "invalid");
  await assert.rejects(
    captureOriginalBusinessRows(broken),
    /account_original_business_row_invalid:opportunities/,
  );
  assert.equal(broken.rolledBack, true);
});

test("the isolated executor captures before any durable migration statement and verifies before both success responses", async () => {
  const source = await readFile(
    new URL("../../scripts/apply-deployment-migrations.mjs", import.meta.url),
    "utf8",
  );
  const command = source.slice(source.indexOf("async function main()"));
  const lock = command.indexOf("SET SESSION lock_wait_timeout=5");
  const before = command.indexOf(
    "const before = preservation ? await preservation.captureAccountMigrationPreservation(db)",
  );
  const reverse = command.indexOf("if (rollbackRehearsal) {");
  const forward = command.indexOf("CREATE TABLE IF NOT EXISTS schema_migrations");
  assert.ok(lock >= 0 && lock < before && before < reverse && reverse < forward);
  assert.match(
    command.slice(reverse, forward),
    /await readBackPreservation\(\);[\s\S]*status: "ok"[\s\S]*preservation: originalData/,
  );
  assert.match(
    command.slice(forward),
    /preservation \? await readBackPreservation\(\) : null;[\s\S]*status: "ok"[\s\S]*preservation: originalData/,
  );
});
