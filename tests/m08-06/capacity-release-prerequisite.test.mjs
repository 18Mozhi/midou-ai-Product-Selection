import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { capacityReleasePrerequisite } from "../../scripts/lib/capacity-release-prerequisite.mjs";
const head = "a".repeat(40),
  previous = "b".repeat(40),
  now = Date.parse("2026-10-16T01:00:00Z");
const phase = (buildSha) => ({
  buildSha,
  verifiedAt: new Date(now - 1000).toISOString(),
  live: true,
  ready: true,
  available: true,
  version: true,
  knownRoute: true,
  missingRoute: true,
  browserHelper: true,
});
const fixture = () => ({
  schemaVersion: 1,
  module: "M07-05",
  manager: "baota",
  topology: "single_backend_fixed_directories",
  buildSha: head,
  previousBuildSha: previous,
  candidateInstances: 0,
  nodeProject: "ai选品",
  pythonProject: "ai选品-python",
  nodePort: 4101,
  databaseRollback: false,
  migrationCompatible: true,
  cleanupVerified: true,
  migrationVersion: "0074_provider_terms_permanent.up.sql",
  release: phase(head),
  rollback: phase(previous),
  recovery: phase(head),
  capturedAt: new Date(now).toISOString(),
});
const identity = { build_sha: head, version: "0.1.0", config_fingerprint: "c".repeat(64) };
test("fixed BaoTa package includes the capacity CLI and its complete local import chain", async () => {
  const deploy = await readFile("scripts/deploy-baota.py", "utf8");
  for (const name of [
    "capture-capacity-boundary-production.mjs",
    "release-rollout-async-lag.mjs",
    "single-backend-release-evidence.mjs",
    "scripts/lib/capacity-release-prerequisite.mjs",
  ])
    assert.ok(deploy.includes(name), name);
});
test("capacity accepts current real single-backend release rollback recovery receipt", () => {
  const result = capacityReleasePrerequisite(JSON.stringify(fixture()), head, identity, now);
  assert.match(result.evidenceSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.previousBuildSha, previous);
});
test("capacity rejects stale, wrong-build, candidate, DB-down and incomplete rollback receipts", () => {
  for (const mutate of [
    (e) => (e.buildSha = previous),
    (e) => (e.previousBuildSha = head),
    (e) => (e.candidateInstances = 1),
    (e) => (e.databaseRollback = true),
    (e) => (e.rollback.ready = false),
    (e) => (e.cleanupVerified = false),
    (e) => (e.capturedAt = new Date(now - 1800001).toISOString()),
  ]) {
    const e = fixture();
    mutate(e);
    assert.throws(() => capacityReleasePrerequisite(JSON.stringify(e), head, identity, now));
  }
  assert.throws(() =>
    capacityReleasePrerequisite(
      JSON.stringify(fixture()),
      head,
      { ...identity, build_sha: previous },
      now,
    ),
  );
});
