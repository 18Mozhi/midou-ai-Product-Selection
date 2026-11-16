import assert from "node:assert/strict";
import test from "node:test";
import { snapshotAccountTrendPreservation } from "../../scripts/verify-account-trend-preservation.mjs";

function fixture({
  scope = 2,
  bad = 0,
  production = false,
  signalTitle = "original",
  native = false,
  ownershipInvalid = false,
  mixed = false,
} = {}) {
  const calls = [];
  let rolledBack = false;
  const db = {
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith("SELECT DATABASE"))
        return [
          [
            {
              db: production ? "product_scout" : "product_scout_scope_rehearsal",
              version: "5.7.44",
            },
          ],
        ];
      if (sql.startsWith("SHOW COLUMNS FROM trend_signals"))
        return [Array.from({ length: scope }, () => ({}))];
      if (sql.startsWith("SHOW COLUMNS FROM trend_topics"))
        return [
          (mixed
            ? ["account_id", "organization_id"]
            : native
              ? ["account_id"]
              : ["organization_id", "workspace_id"]
          ).map((Field) => ({ Field })),
        ];
      if (sql.startsWith("SELECT slot FROM account_ownership_cutover"))
        return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT * FROM trend_topics"))
        return [
          [{ id: "original-topic", organization_id: "org", workspace_id: "space", title: "topic" }],
        ];
      if (sql.startsWith("SELECT t.*")) {
        assert.match(sql, /r.run_id=cut.source_run_id/);
        assert.match(sql, /o.account_id=cut.primary_account_id/);
        return [
          [
            {
              id: "original-topic",
              account_id: "owner",
              title: "topic",
              organization_id: "org",
              workspace_id: "space",
              invalid_owner: Number(ownershipInvalid),
            },
          ],
        ];
      }
      if (sql.startsWith("SELECT s.id"))
        return [[{ id: "original-signal", title: signalTitle, topic_id: "original-topic" }]];
      if (sql.startsWith("SELECT COUNT")) return [[{ total: bad }]];
      if (sql.startsWith("SET TRANSACTION") || sql.includes("READ ONLY")) return [[]];
      assert.fail("unexpected query");
    },
    async rollback() {
      rolledBack = true;
    },
  };
  return { db, calls, rolledBack: () => rolledBack };
}

test("trend preservation hashes original records regardless of the scope layout and detects content edits", async () => {
  const baseline = fixture(),
    migrated = fixture({ scope: 0 }),
    edited = fixture({ scope: 0, signalTitle: "edited" });
  const expected = await snapshotAccountTrendPreservation(baseline.db);
  assert.deepEqual(await snapshotAccountTrendPreservation(migrated.db), expected);
  assert.notEqual(
    (await snapshotAccountTrendPreservation(edited.db)).signals_sha256,
    expected.signals_sha256,
  );
  assert.ok(baseline.calls.some((sql) => sql.includes("s.organization_id,s.workspace_id")));
  assert.ok(migrated.calls.some((sql) => sql.includes("t.organization_id,t.workspace_id")));
  assert.ok(migrated.calls.some((sql) => sql.includes("LEFT JOIN raw_evidence")));
  assert.equal(migrated.rolledBack(), true);
});

test("0191 reads sealed original coordinates and keeps identical digests without restoring the old columns", async () => {
  const legacy = fixture({ scope: 0 }),
    native = fixture({ scope: 0, native: true });
  assert.deepEqual(
    await snapshotAccountTrendPreservation(native.db),
    await snapshotAccountTrendPreservation(legacy.db),
  );
  assert.ok(
    native.calls.some(
      (sql) => sql.startsWith("SELECT s.id") && sql.includes("r.legacy_org_id AS organization_id"),
    ),
  );
  assert.ok(
    native.calls.some(
      (sql) => sql.startsWith("SELECT COUNT") && sql.includes("sl.account_id<=>t.account_id"),
    ),
  );
  assert.ok(native.calls.every((sql) => !sql.includes("t.organization_id")));
  await assert.rejects(
    snapshotAccountTrendPreservation(
      fixture({ scope: 0, native: true, ownershipInvalid: true }).db,
    ),
    /trend_topic_original_owner_mismatch/,
  );
  await assert.rejects(
    snapshotAccountTrendPreservation(fixture({ scope: 0, native: true, bad: 1 }).db),
    /trend_signal_reference_mismatch/,
  );
  await assert.rejects(
    snapshotAccountTrendPreservation(fixture({ scope: 2, native: true }).db),
    /trend_topic_scope_invalid/,
  );
  await assert.rejects(
    snapshotAccountTrendPreservation(fixture({ scope: 0, mixed: true }).db),
    /trend_topic_scope_invalid/,
  );
});

test("trend preservation fails closed for production, partial migration and broken references", async () => {
  const production = fixture({ production: true }),
    partial = fixture({ scope: 1 }),
    broken = fixture({ bad: 1 });
  await assert.rejects(
    snapshotAccountTrendPreservation(production.db),
    /mysql57_rehearsal_database_required/,
  );
  assert.equal(production.calls.length, 1);
  await assert.rejects(snapshotAccountTrendPreservation(partial.db), /trend_signal_scope_partial/);
  await assert.rejects(
    snapshotAccountTrendPreservation(broken.db),
    /trend_signal_reference_mismatch/,
  );
  assert.ok(partial.rolledBack() && broken.rolledBack());
});
