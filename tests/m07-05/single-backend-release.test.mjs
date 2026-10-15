import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateSingleBackendReleaseEvidence } from "../../scripts/single-backend-release-evidence.mjs";
import { validateSingleServerEvidence } from "../../scripts/single-server-evidence.mjs";
const head = "a".repeat(40),
  previous = "b".repeat(40),
  now = Date.parse("2026-10-15T12:00:00Z");
function valid() {
  const health = (buildSha, second) => ({
    buildSha,
    verifiedAt: `2026-10-15T11:59:${second}Z`,
    live: true,
    ready: true,
    available: true,
    version: true,
    knownRoute: true,
    missingRoute: true,
    browserHelper: true,
  });
  return {
    schemaVersion: 1,
    module: "M07-05",
    manager: "baota",
    topology: "single_backend_fixed_directories",
    buildSha: head,
    previousBuildSha: previous,
    nodeProject: "ai选品",
    pythonProject: "ai选品-python",
    nodePort: 4101,
    candidateInstances: 0,
    databaseRollback: false,
    migrationCompatible: true,
    migrationVersion: "0074_provider_terms_permanent.up.sql",
    cleanupVerified: true,
    capturedAt: "2026-10-15T12:00:00Z",
    release: health(head, "00"),
    rollback: health(previous, "20"),
    recovery: health(head, "40"),
  };
}
test("single-backend production gate requires real ordered release rollback and recovery", () => {
  assert.equal(validateSingleBackendReleaseEvidence(valid(), head, now).status, "passed");
  assert.throws(
    () => validateSingleBackendReleaseEvidence(valid(), head, now + 31 * 60_000),
    /evidence_stale/,
  );
  assert.throws(
    () =>
      validateSingleBackendReleaseEvidence(
        { ...valid(), capturedAt: new Date(now + 1).toISOString() },
        head,
        now,
      ),
    /evidence_stale/,
  );
  for (const mutate of [
    (e) => delete e.rollback,
    (e) => (e.rollback.ready = false),
    (e) => (e.recovery.buildSha = previous),
    (e) => (e.rollback.verifiedAt = e.capturedAt),
    (e) => (e.candidateInstances = 1),
    (e) => (e.cleanupVerified = false),
    (e) => (e.databaseRollback = true),
    (e) => (e.migrationCompatible = false),
    (e) => (e.buildSha = previous),
    (e) => (e.previousBuildSha = head),
    (e) => (e.capturedAt = "2020-01-01T00:00:00Z"),
  ]) {
    const e = valid();
    mutate(e);
    assert.throws(() => validateSingleBackendReleaseEvidence(e, head, now));
  }
});
test("active M07-05 commands cannot demand legacy candidate production evidence", async () => {
  const m = JSON.parse(await readFile("verification/modules/M07-05.json", "utf8"));
  assert.ok(
    m.commands.includes("node scripts/verify-single-backend-release-production.mjs --production"),
  );
  assert.ok(
    !m.commands.some((x) => /verify-release-rollout-production|run-baota-release-rollout/.test(x)),
  );
  const script = await readFile("scripts/single-backend-rollback.py", "utf8");
  assert.match(script, /StopProject/);
  assert.match(script, /stop_project/);
  assert.match(script, /rollback_processes_still_running/);
  assert.doesNotMatch(script, /4103|CreateProject|systemctl|nohup/);
});
test("MySQL exception never waives API Redis or other privacy gates", async () => {
  const manifest = JSON.parse(await readFile("infra/baota/single-server-manifest.json", "utf8"));
  const exception = manifest.host.publicAccessExceptions[0];
  const e = {
    schemaVersion: 1,
    module: "M08-01",
    status: "ready",
    buildSha: head,
    manager: "baota",
    topology: "single_host",
    region: "惠州",
    host: {
      hostId: "hz",
      manager: "baota",
      region: "惠州",
      roles: ["api"],
      privateServices: false,
      otherServicesPrivate: true,
      publicAccessException: exception,
    },
    api: {
      hostId: "hz",
      nodeId: "api",
      status: "ready",
      ready: true,
      buildSha: head,
      loopbackHost: "127.0.0.1",
      publicPortExposed: false,
      lastHeartbeatAt: "2026-10-15T12:00:00Z",
    },
    nginx: {
      managedBy: "baota_site",
      mode: "single_upstream_reverse_proxy",
      tlsProbeReady: true,
      sseBufferingOff: true,
    },
    loadBalancingEnabled: false,
    backupServerUsed: false,
    multiNodeClaim: false,
    capacityClaim: "unverified",
    capturedAt: "2026-10-15T12:00:00Z",
  };
  assert.equal(
    validateSingleServerEvidence({ evidence: e, manifest, head, now }).activeApiInstances,
    1,
  );
  for (const mutate of [
    (x) => (x.host.otherServicesPrivate = false),
    (x) => (x.host.publicAccessException = { ...exception, service: "redis" }),
    (x) => (x.host.publicAccessException = { ...exception, port: 6379 }),
    (x) => delete x.host.publicAccessException,
    (x) => (x.api.publicPortExposed = true),
  ]) {
    const x = structuredClone(e);
    mutate(x);
    assert.throws(() => validateSingleServerEvidence({ evidence: x, manifest, head, now }));
  }
});
