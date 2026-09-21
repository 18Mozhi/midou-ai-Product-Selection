import test from "node:test";
import assert from "node:assert/strict";
import { backupStateFixtures } from "../../scripts/lib/backup-state-fixtures.mjs";
const cases = await backupStateFixtures();
const state = (id) => cases.find((item) => item.id === id).data;
test("P64 synthetic review cases each execute one current service repository read", () => {
  assert.equal(cases.length, 9);
  assert.ok(cases.every((item) => item.repositoryReads === 1));
  assert.ok(cases.every((item) => item.data.observed_at === "2026-09-15T08:00:00.000Z"));
  assert.ok(cases.every((item) => item.data.targets.every((target) => !("run_id" in target))));
});
test("P64 complete synthetic evidence has verified current state, not a manually relabeled partial fixture", () => {
  const data = state("verified");
  assert.equal(data.state, "verified");
  assert.equal(data.recovery_copy_verified, true);
  assert.equal(data.latest_drill.permission_boundary_verified, true);
  assert.equal(data.latest_drill.audit_chain_verified, true);
  assert.equal(data.latest_drill.evidence_hash_verified, true);
  assert.deepEqual(data.blockers, []);
});
test("P64 exact integer expiry boundaries follow current service outputs without changing policy", () => {
  for (const [id, remaining, expected] of [
    ["expiring", 1, "verified"],
    ["due-today", 0, "verified"],
    ["stale", -1, "stale"],
  ]) {
    assert.equal(state(id).days_until_drill_expiry, remaining);
    assert.equal(state(id).state, expected);
    assert.equal(state(id).policy.maximum_drill_age_days, 90);
  }
  assert.equal(state("stale").blockers[0].code, "restore_drill_stale");
});
test("P64 missing checks and missing drill are blocked with service-generated reasons", () => {
  for (const id of ["checks-missing", "no-drill"]) {
    assert.equal(state(id).state, "blocked");
    assert.deepEqual(
      state(id).blockers.map((b) => b.code),
      ["isolated_restore_unverified"],
    );
  }
  assert.equal(state("no-drill").latest_drill, null);
  assert.equal(state("no-drill").days_until_drill_expiry, null);
});
test("P64 empty has no fabricated assets or metrics, while zero is explicit numeric data", () => {
  assert.equal(state("empty").state, "empty");
  assert.deepEqual(state("empty").targets, []);
  assert.equal(state("empty").latest_backup, null);
  assert.equal(state("zero-actual").latest_backup.actual_rpo_minutes, 0);
  assert.equal(state("zero-actual").latest_drill.actual_rto_minutes, 0);
  assert.equal(state("zero-actual").targets[0].size_bytes, 0);
});
test("P64 long-region fixture remains inside the existing 64-character storage field", () => {
  assert.ok(state("long-region").policy.primary_region.length <= 64);
  assert.ok(state("long-region").policy.primary_region.length > 32);
  assert.ok(
    state("long-region").targets.every(
      (t) => t.region === state("long-region").policy.recovery_region,
    ),
  );
});
