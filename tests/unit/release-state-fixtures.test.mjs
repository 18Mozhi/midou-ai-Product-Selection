import test from "node:test";
import assert from "node:assert/strict";
import {
  releaseStateFixtures,
  releaseStateClock,
} from "../../scripts/lib/release-state-fixtures.mjs";
const cases = await releaseStateFixtures();
const state = (id) => cases.find((item) => item.id === id).data;
test("P65 each state comes from one current read service call, with metadata removed", () => {
  assert.equal(cases.length, 25);
  assert.ok(
    cases.every((c) => c.repositoryReads === 1 && c.data.observed_at === releaseStateClock),
  );
  assert.ok(cases.every((c) => c.data.gates.every((g) => !("metadata" in g))));
  assert.deepEqual([...new Set(cases.map((c) => c.data.state))].sort(), [
    "blocked",
    "empty",
    "rolled_back",
    "stale",
    "stopped",
    "verified",
  ]);
});
test("P65 verified input is not the contradictory original E2E fixture", () => {
  assert.equal(state("verified").state, "verified");
  assert.deepEqual(state("verified").blockers, []);
  assert.equal(state("verified").rollback_verified, false);
  assert.ok(state("verified").gates.every((g) => g.gate_kind !== "rollback"));
});
test("P65 current matching and most recent history remain separate", () => {
  assert.equal(state("empty").state, "empty");
  assert.equal(state("empty").latest_release, null);
  assert.equal(state("empty").latest_historical_release, null);
  assert.equal(state("current-missing").state, "blocked");
  assert.equal(state("current-missing").latest_release, null);
  assert.deepEqual(state("current-missing").gates, []);
  assert.equal(state("current-missing").blockers[0].code, "current_release_evidence_missing");
  assert.equal(state("newest-other").latest_release.build_sha, "a".repeat(40));
  assert.equal(state("newest-other").latest_historical_release.build_sha, "b".repeat(40));
  assert.equal(state("newest-other").state, "verified");
});
test("P65 identity and source blockers and fallback follow current service", () => {
  for (const id of ["identity-app", "identity-config", "identity-migration"]) {
    assert.equal(state(id).state, "blocked");
    assert.equal(state(id).blockers[0].code, "release_identity_mismatch");
  }
  assert.equal(state("source-mismatch").blockers[0].code, "release_source_mismatch");
  assert.equal(state("source-fallback").state, "verified");
  assert.equal(state("source-fallback").versions.remote.repository, null);
  assert.equal(state("source-fallback").versions.remote.build_sha, "a".repeat(40));
});
test("P65 stopped and rolled-back verdicts do not imply evidence flags", () => {
  for (const [id, expected, flag, value] of [
    ["status-stopped", "stopped", "automatic_stop_verified", false],
    ["stopped", "stopped", "automatic_stop_verified", true],
    ["status-rollback", "rolled_back", "rollback_verified", false],
    ["rolled-back", "rolled_back", "rollback_verified", true],
  ]) {
    assert.equal(state(id).state, expected);
    assert.equal(state(id)[flag], value);
  }
  assert.equal(state("identity-before-rollback").state, "blocked");
  assert.equal(state("identity-before-rollback").rollback_verified, true);
  assert.equal(state("rollback-before-stop").state, "rolled_back");
  assert.equal(state("rollback-before-stop").automatic_stop_verified, true);
  assert.equal(
    state("rolled-back").gates.find((g) => g.gate_kind === "rollback").duration_ms,
    1250,
  );
});
test("P65 required records, null, zero and threshold boundaries keep real predicate semantics", () => {
  for (const id of [
    "missing-gate",
    "no-gates",
    "gate-pending",
    "error-equal",
    "read-over",
    "missing-metric",
  ]) {
    assert.equal(state(id).state, "blocked", id);
    assert.equal(state(id).blockers[0].code, "rollout_gates_incomplete");
  }
  for (const id of ["read-equal", "zero-metrics"]) assert.equal(state(id).state, "verified", id);
  assert.equal(state("missing-metric").gates[0].read_p95_ms, null);
  assert.equal(state("zero-metrics").gates[0].read_p95_ms, 0);
});
test("P65 exact evidence-age limit is accepted and one minute beyond is stale", () => {
  assert.equal(state("age-exact").state, "verified");
  assert.equal(state("stale").state, "stale");
  assert.equal(state("stale").blockers[0].code, "rollout_evidence_stale");
});
test("P65 selected examples use stored gate enums and UUID shape, no synthetic extra or duplicate gate kinds", () => {
  const kinds = new Set([
    "preflight",
    "backup",
    "migration",
    "canary_5",
    "canary_25",
    "canary_100",
    "automatic_stop",
    "rollback",
  ]);
  for (const { data } of cases) {
    assert.equal(new Set(data.gates.map((g) => g.gate_kind)).size, data.gates.length);
    for (const g of data.gates) {
      assert.ok(kinds.has(g.gate_kind));
      assert.match(g.id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/);
      assert.equal(g.release_id, data.latest_release.id);
    }
  }
});
