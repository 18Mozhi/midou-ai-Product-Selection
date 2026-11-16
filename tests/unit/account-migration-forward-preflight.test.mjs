import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  preflightAccountRehearsalForward,
  splitSqlStatements,
} from "../../scripts/apply-deployment-migrations.mjs";

const competitor = "0194_competitor_account_scope.up.sql";
const first = "0080_primary_account_cost_approval.up.sql";
const last = "0197_retire_tenancy_roots.up.sql";
const bundle = [
  { name: first, checksum: "one" },
  {
    name: competitor,
    checksum: "two",
    statements: splitSqlStatements(await readFile(`database/migrations/${competitor}`, "utf8")),
  },
  { name: last, checksum: "three" },
];
const testDb = ({ receipts = [], failAt = -1 } = {}) => {
  const reads = [];
  return {
    reads,
    async query(sql, args) {
      assert.match(sql, /^SELECT /);
      reads.push(sql);
      if (sql.startsWith("SELECT name,checksum")) {
        assert.deepEqual(args, [[first, competitor, last]]);
        return [receipts];
      }
      return [reads.length - 2 === failAt ? [{ rejected: 1 }] : []];
    },
  };
};

test("preflight makes the compiled production target guard a read-only check", async () => {
  const db = testDb();
  const production = bundle.map((item) => ({
    ...item,
    statements: item.statements?.map((sql) => sql.replace(
      "SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'",
      "SELECT 1 WHERE BINARY DATABASE() <> BINARY 'product_scout'",
    )),
  }));
  await preflightAccountRehearsalForward(db, production);
  assert.match(db.reads[1], /^SELECT 1 FROM DUAL WHERE BINARY DATABASE\(\) <> BINARY 'product_scout'/);
});

test("forward reads every receipt before mutation, including drift or gaps later in the bundle", async () => {
  for (const [receipts, error] of [
    [[{ name: last, checksum: "stale" }], /migration_checksum_drift:0197/],
    [[{ name: competitor, checksum: "two" }], /account_migration_receipt_gap:0194/],
  ]) {
    const db = testDb({ receipts });
    await assert.rejects(preflightAccountRehearsalForward(db, bundle), error);
    assert.equal(db.reads.length, 1);
  }
});

test("forward preflights original 0194 checks in read-only form, and skips them once 0194 is applied", async () => {
  const db = testDb({ receipts: [{ name: first, checksum: "one" }] });
  await preflightAccountRehearsalForward(db, bundle);
  assert.equal(db.reads.length, 4);
  assert.match(db.reads[1], /^SELECT 1 FROM DUAL WHERE /);
  assert.match(db.reads[1], /0075_competitor_opportunity_identity/);
  assert.match(db.reads[2], /latest_snapshot_id/);
  assert.match(db.reads[3], /HAVING COUNT\(\*\)>1/);
  const applied = testDb({ receipts: bundle.map(({ name, checksum }) => ({ name, checksum })) });
  await preflightAccountRehearsalForward(applied, bundle);
  assert.equal(applied.reads.length, 1);
  for (const [failAt, error] of [
    [0, /competitor_forward_index_or_receipt_mismatch/],
    [1, /competitor_forward_original_owner_or_reference_mismatch/],
    [2, /competitor_forward_account_identity_collision/],
  ])
    await assert.rejects(preflightAccountRehearsalForward(testDb({ failAt }), bundle), error);
});
