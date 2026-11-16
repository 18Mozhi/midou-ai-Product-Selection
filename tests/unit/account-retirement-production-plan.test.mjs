import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  compileAccountRetirementProduction,
  planAccountMigrationFile,
  planAccountRetirementProduction,
  renderAccountReleaseReceipts,
} from "../../scripts/plan-account-retirement-production.mjs";
import { splitSqlStatements } from "../../scripts/apply-deployment-migrations.mjs";
import { inspectAccountReleaseReceiptPrefix } from "../../scripts/verify-account-release-receipt-prefix.mjs";

test("production planning pins 118 forward and reverse migrations without enabling execution", async () => {
  const result = await planAccountRetirementProduction();
  assert.equal(result.executable, false);
  assert.equal(result.target_database, "product_scout");
  assert.equal(result.prerequisites.length, 3);
  assert.equal(result.forward.length, 118);
  assert.equal(result.rollback.length, 118);
  const numbers = (rows) => rows.map(({ name }) => Number(name.slice(0, 4)));
  assert.deepEqual(
    numbers(result.forward.filter(({ retargeted }) => retargeted)),
    [189, 190, 191, 192, 193, 194, 195, 196, 197],
  );
  assert.deepEqual(numbers(result.rollback), numbers(result.forward).reverse());
  for (const { rehearsal_sha256, candidate_sha256, retargeted, statement_count } of [
    ...result.forward,
    ...result.rollback,
  ]) {
    assert.equal(rehearsal_sha256 !== candidate_sha256, retargeted);
    assert.ok(statement_count > 0);
  }
  assert.equal(result.plan_sha256, (await planAccountRetirementProduction()).plan_sha256);
  assert.doesNotMatch(JSON.stringify(result), /RENAME TABLE|ALTER TABLE|INSERT INTO/);
  const runtimeModule = await readFile(
    new URL("../../packages/database/src/account-release-receipts.ts", import.meta.url),
    "utf8",
  );
  assert.equal(runtimeModule.replaceAll("\r\n", "\n"), renderAccountReleaseReceipts(result));
  assert.equal([...result.prerequisites, ...result.forward].length, 121);
});

test("production planning rejects a missing, misplaced or undisclosed target guard", () => {
  const guard = "SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'";
  const release = "0197_retire_tenancy_roots.up.sql";
  assert.throws(() => planAccountMigrationFile(release, "SELECT 1;"), /target_guard_drift/);
  assert.throws(() => planAccountMigrationFile(release, guard + ";"), /unexpected_guard_statement/);
  assert.throws(
    () => planAccountMigrationFile("0080_primary_account_cost_approval.up.sql", guard + ";"),
    /target_guard_drift/,
  );
  assert.throws(
    () =>
      planAccountMigrationFile(
        release,
        `INSERT INTO scoutops_a_guard\n${guard} OR DATABASE() LIKE '%rehearsal';`,
      ),
    /isolation_guard_remaining/,
  );
});

test("receipt preflight only recognizes an exact contiguous production prefix", async () => {
  const plan = await planAccountRetirementProduction();
  const rows = [...plan.prerequisites, ...plan.forward].map(({ name, candidate_sha256 }) => ({
    name,
    checksum: candidate_sha256,
  }));
  const check = (values) => inspectAccountReleaseReceiptPrefix(plan, values);
  assert.equal(check([]).next_receipt, rows[0].name);
  assert.equal(check(rows.slice(0, 3)).next_receipt, rows[3].name);
  assert.equal(check(rows).applied, 121);
  assert.equal(check(rows).next_receipt, null);
  assert.equal(check(rows).executable, false);
  assert.equal(check([rows[1]]).status, "account_release_receipt_gap");
  assert.equal(
    check([{ ...rows[0], checksum: "0".repeat(64) }]).status,
    "account_release_receipt_checksum_mismatch",
  );
  assert.equal(
    check([{ ...rows[0], name: "0077_impostor.up.sql" }]).status,
    "unexpected_account_release_receipt",
  );
  assert.throws(() => check([rows[0], rows[0]]), /invalid_receipt/);
});

test("compiled inputs match the pinned plan and differ only by the exact database guards", async () => {
  const plan = await planAccountRetirementProduction();
  await assert.rejects(compileAccountRetirementProduction(), /expected_plan_digest_required/);
  await assert.rejects(compileAccountRetirementProduction("0".repeat(64)), /plan_digest_mismatch/);
  const result = await compileAccountRetirementProduction(plan.plan_sha256);
  assert.deepEqual(result.plan, plan);
  assert.equal(result.plan.executable, false);
  for (const stage of ["prerequisites", "forward", "rollback"]) {
    assert.deepEqual(
      result[stage].map(({ metadata }) => metadata),
      plan[stage],
    );
    for (const { metadata, statements } of result[stage]) {
      const source = await readFile(
        new URL(`../../database/migrations/${metadata.name}`, import.meta.url),
        "utf8",
      );
      const original = splitSqlStatements(source.replaceAll("\r\n", "\n"));
      assert.equal(statements.length, original.length);
      const modified = statements.flatMap((next, index) =>
        next !== original[index] ? [index] : [],
      );
      assert.equal(modified.length, metadata.retargeted ? 1 : 0);
      for (const index of modified) {
        assert.equal(
          statements[index].replace(
            "SELECT 1 WHERE BINARY DATABASE() <> BINARY 'product_scout'",
            () => "SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'",
          ),
          original[index],
        );
      }
      assert.ok(Object.isFrozen(statements));
    }
  }
  assert.equal(result.prerequisites.length + result.forward.length + result.rollback.length, 239);
});
