import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  compareAccountQuoteSnapshots,
  readAccountQuoteSnapshot,
} from "../../scripts/verify-account-quote-preservation.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const dbName = "product_scout_quote_validation_rehearsal";
function fixture({
  db = dbName,
  run = "same-run",
  anchor = false,
  price = "1.123456",
  reverse = false,
  invalidAnchor = false,
  empty = false,
} = {}) {
  let readOnly = false,
    rolledBack = false;
  return {
    get rolledBack() {
      return rolledBack;
    },
    async query(sql) {
      if (sql.includes("VERSION()")) return [[{ db, version: "5.7.44" }]];
      if (sql.startsWith("SET TRANSACTION")) return [[]];
      if (sql.includes("READ ONLY")) {
        readOnly = true;
        return [[]];
      }
      assert.ok(readOnly);
      if (sql.includes("account_ownership_cutover")) return [[{ db, source_run_id: run }]];
      if (sql.startsWith("SHOW COLUMNS")) return [anchor ? [{ Field: "anchor_quote_id" }] : []];
      assert.match(sql, /ORDER BY BINARY id$/);
      if (sql.includes("FROM supplier_quotes")) {
        assert.match(sql, /quote_version.*is_current/s);
        assert.match(sql, /CAST\(quoted_price AS CHAR\)/);
        assert.match(sql, /evidence_id/);
        return [empty ? [] : [{ row_sha256: hash(price) }]];
      }
      if (sql.includes("FROM sourcing_comparisons")) {
        assert.match(sql, /JSON_ARRAY\(id,name,quote_ids_json,/);
        assert.equal(sql.includes("anchor_quote_id"), anchor);
        return [
          empty
            ? []
            : [
                {
                  row_sha256: hash(reverse ? "[2,1]" : "[1,2]"),
                  invalid_anchor: Number(invalidAnchor),
                },
              ],
        ];
      }
      assert.match(sql, /FROM exchange_rate_quotes/);
      assert.match(sql, /CAST\(rate_value AS CHAR\)/);
      return [empty ? [] : [{ row_sha256: hash("fx") }]];
    },
    async rollback() {
      rolledBack = true;
    },
  };
}

test("binary-ordered original quote content matches after scope conversion, not just by ID and count", async () => {
  const db = fixture();
  const baseline = await readAccountQuoteSnapshot(db);
  assert.ok(db.rolledBack);
  const migrated = await readAccountQuoteSnapshot(fixture({ anchor: true }));
  assert.equal(compareAccountQuoteSnapshots(baseline, migrated).status, "matched");
  const changed = await readAccountQuoteSnapshot(
    fixture({ anchor: true, price: "1.123457", reverse: true }),
  );
  assert.deepEqual(compareAccountQuoteSnapshots(baseline, changed).mismatches, [
    "supplier_quotes",
    "sourcing_comparisons",
  ]);
});

test("empty historical tables remain labeled empty; wrong batches, invalid anchors and production are refused", async () => {
  const empty = await readAccountQuoteSnapshot(fixture({ empty: true }));
  assert.equal(
    compareAccountQuoteSnapshots(empty, empty).tables.supplier_quotes.status,
    "no_historical_rows",
  );
  assert.throws(
    () => compareAccountQuoteSnapshots(empty, { ...empty, source_run_id: "other-run" }),
    /quote_snapshot_batch_mismatch/,
  );
  assert.throws(
    () => compareAccountQuoteSnapshots({ ...empty, tables: {} }, empty),
    /quote_snapshot_invalid/,
  );
  const invalid = fixture({ anchor: true, invalidAnchor: true });
  await assert.rejects(readAccountQuoteSnapshot(invalid), /quote_snapshot_invalid_anchor/);
  assert.ok(invalid.rolledBack);
  await assert.rejects(
    readAccountQuoteSnapshot(fixture({ db: "product_scout" })),
    /mysql57_rehearsal_database_required/,
  );
});
