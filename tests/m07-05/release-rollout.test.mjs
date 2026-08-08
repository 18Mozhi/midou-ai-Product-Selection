import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("M07-05.A01-A05 freezes Baota rollout, migration and automatic-stop boundaries", async () => {
  const [manifest, up, down, runner] = await Promise.all([
    read("infra/baota/release-rollout-manifest.json").then(JSON.parse),
    read("database/migrations/0026_release_rollout_m07_05.up.sql"),
    read("database/migrations/0026_release_rollout_m07_05.down.sql"),
    read("scripts/run-baota-release-rollout.mjs"),
  ]);
  assert.equal(manifest.module, "M07-05");
  assert.equal(manifest.productionManager, "baota");
  assert.deepEqual(manifest.canary.percentages, [5, 25, 100]);
  assert.equal(manifest.canary.minimumObservationSeconds, 1800);
  assert.match(up, /CREATE TABLE `deployment_release_gates`/);
  assert.match(down, /DROP TABLE IF EXISTS `deployment_release_gates`/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|CREATE\s+INDEX\s+.*WHERE/i);
  assert.match(runner, /automatic_stop/);
  assert.doesNotMatch(runner, /systemctl|\bpm2\b|crontab/i);
  assert.equal(manifest.restrictedConfig.secretValuesInManifest, false);
  assert.equal(manifest.restrictedConfig.browserExposedReleaseConfiguration, false);
});

test("M07-05.A04/A08/A12/A16 release truth fails closed across current-release boundaries", async () => {
  const { ReleaseRolloutService } = await import("../../apps/api/dist/release-rollout-service.js");
  const current = { id: "release-current", build_sha: "a".repeat(40), status: "deploying", started_at: "2026-08-08T12:00:00.000Z" };
  const policy = { percentages: [5, 25, 100], minimumObservationSeconds: 1800, maximumEvidenceAgeMinutes: 30 };
  const readState = async (releases, gates) => new ReleaseRolloutService({ read: async () => ({ releases, gates }) }, policy, () => new Date("2026-08-08T12:30:00.000Z")).read({ actorId: "actor", requestId: "request", traceId: "trace" });
  assert.equal((await readState([], [])).state, "empty");
  assert.equal((await readState([current], [])).state, "blocked");
  const passed = [5, 25, 100].map((percent) => ({ release_id: current.id, gate_kind: `canary_${percent}`, status: "passed", traffic_percent: percent, observe_seconds: 1800, sample_count: 20, error_rate_percent: 0, read_p95_ms: 100, write_p95_ms: 200, async_lag_seconds: 2, finished_at: "2026-08-08T12:20:00.000Z" }));
  assert.equal((await readState([{ ...current, status: "healthy" }], passed)).state, "verified");
  assert.equal((await readState([{ ...current, status: "failed" }], [...passed, { release_id: current.id, gate_kind: "automatic_stop", status: "stopped", traffic_percent: 25, observe_seconds: 10, finished_at: "2026-08-08T12:10:00.000Z" }])).state, "stopped");
  assert.equal((await readState([{ ...current, status: "rolled_back" }], [{ release_id: current.id, gate_kind: "rollback", status: "rolled_back", traffic_percent: 0, observe_seconds: 0, finished_at: "2026-08-08T12:15:00.000Z" }])).state, "rolled_back");
  assert.equal((await readState([{ ...current, id: "new-release", status: "healthy" }], passed)).state, "blocked");
  assert.equal((await readState([{ ...current, status: "healthy" }], passed.map((gate, index) => index ? gate : { ...gate, write_p95_ms: null }))).state, "blocked");
});

test("M07-05.A06-A17 API, UI, config and documentation contracts stay synchronized", async () => {
  const all = (await Promise.all([
    "apps/api/src/release-rollout-routes.ts",
    "apps/api/src/release-rollout-service.ts",
    "apps/api/src/mysql-release-rollout-repository.ts",
    "apps/web/src/components/ReleaseRolloutCenter.vue",
    "config/env.example",
    "config/schema.json",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "docs/architecture/m07-05-release-rollout.md",
    "docs/runbooks/m07-05-release-rollout.md",
    "verification/modules/M07-05.json",
  ].map(read))).join("\n");
  for (const token of ["M07-05", "platform:operate", "/api/v1/platform/operations/releases", "RELEASE_CANARY_OBSERVE_SECONDS", "5", "25", "100", "回滚"]) assert.match(all, new RegExp(token));
  assert.doesNotMatch(await read("apps/api/src/release-rollout-service.ts"), /password|cookie|token|private_key/i);
});

test("M07-05 candidate slot binds through the real APP_PORT runtime contract", async () => {
  const [runtimeConfig, runbook, serviceManifest] = await Promise.all([
    read("packages/config/src/index.ts"),
    read("docs/runbooks/m07-05-release-rollout.md"),
    read("infra/baota/service-manifest.json").then(JSON.parse),
  ]);
  const candidate = serviceManifest.objects.find((entry) => entry.name === "product-scout-api-canary");
  assert.match(runtimeConfig, /port:\s*integer\(env,\s*"APP_PORT",\s*4101/);
  assert.match(runbook, /APP_PORT=4103/);
  assert.doesNotMatch(runbook, /(^|[^A-Z_])API_PORT=4103/m);
  assert.deepEqual(candidate.runtimeEnvironment, { APP_PORT: 4103 });
});

test("M07-05 MySQL single-row gates use object presence instead of array length", async () => {
  const runner = await read("scripts/run-baota-release-rollout.mjs");
  assert.doesNotMatch(runner, /\b(?:existingMigration|backup|sameBuild)\.length\b/);
  assert.match(runner, /if \(!existingMigration\)/);
  assert.match(runner, /if \(!backup\)/);
  assert.match(runner, /if \(sameBuild\)/);
});

test("M07-05 warms the real candidate write path and measures non-replayed writes", async () => {
  const runner = await read("scripts/run-baota-release-rollout.mjs");
  assert.match(runner, /candidate_write_warmup_failed/);
  assert.match(runner, /idempotency-key": `release-warmup-\$\{warmupCorrelation\}`/);
  assert.match(runner, /idempotency-key": `release-\$\{effectiveReleaseId\}-\$\{percent\}-\$\{correlation\}`/);
  assert.doesNotMatch(runner, /idempotency-key": `release-\$\{effectiveReleaseId\}-\$\{percent\}`/);
});
