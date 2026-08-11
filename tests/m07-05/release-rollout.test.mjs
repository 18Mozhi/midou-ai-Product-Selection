import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  RELEASE_ASYNC_QUEUE_PROBES,
  asyncLagSeconds,
} from "../../scripts/release-rollout-async-lag.mjs";

const read = (path) => readFile(path, "utf8");

test("M07-05 async lag probes only queues consumed by the BaoTa Worker", async () => {
  const tables = RELEASE_ASYNC_QUEUE_PROBES.map((probe) => probe.table);
  for (const table of [
    "collection_task_outbox",
    "evidence_data_outbox",
    "selection_journey_outbox",
    "trend_outbox",
  ])
    assert.ok(!tables.includes(table), `${table} has no runtime consumer`);
  for (const table of [
    "collection_tasks",
    "trend_projection_jobs",
    "opportunity_refresh_jobs",
    "sourcing_projection_jobs",
    "ai_analysis_requests",
    "outbox_events",
    "webhook_deliveries",
  ])
    assert.ok(tables.includes(table), `${table} must remain release-gated`);

  const queried = [];
  const pool = {
    query: async (sql) => {
      queried.push(sql);
      return [[{ lag_seconds: sql.includes("collection_tasks") ? 42 : 0 }]];
    },
  };
  assert.equal(await asyncLagSeconds(pool), 42);
  assert.equal(queried.length, RELEASE_ASYNC_QUEUE_PROBES.length);
  assert.ok(queried.every((sql) => !sql.includes("selection_journey_outbox")));
  assert.match(
    RELEASE_ASYNC_QUEUE_PROBES.find((probe) => probe.table === "collection_tasks").sql,
    /CASE WHEN status IN \('leased','running'\) THEN lease_expires_at/,
  );
});

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
  assert.deepEqual(manifest.automaticStop.asyncQueueTables, RELEASE_ASYNC_QUEUE_PROBES.map((probe) => probe.table));
  assert.deepEqual(manifest.canary.syntheticWriteCanonicalFields, ["timestamp", "nonce", "release_id", "sample_id"]);
  assert.equal(manifest.canary.proxyRequestIdsExcludedFromSignature, true);
  assert.equal(manifest.canary.candidatePersistenceParityRequired, true);
  assert.equal(manifest.schemaVersion, 2);
  assert.deepEqual(manifest.mysqlDurability, {
    innodbFlushLogAtTrxCommit: 2,
    syncBinlog: 1,
    productScoutBinlogExcluded: true,
    osCrashDataLossWindowSeconds: 1,
    verificationAccount: "existing product_scout@127.0.0.1 account with global REPLICATION CLIENT",
    authorization: "explicit user approval on 2026-08-10",
    rollback: "restore the BaoTa-restricted my.cnf backup and restart MySQL through BaoTa",
  });
  assert.match(runner, /release_mysql_durability_contract_invalid/);
  assert.match(runner, /SHOW MASTER STATUS/);
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
  for (const token of ["M07-05", "platform:operate", "/api/v1/platform/operations/releases", "RELEASE_CANARY_OBSERVE_SECONDS", "innodb_flush_log_at_trx_commit=2", "binlog-ignore-db=product_scout", "REPLICATION CLIENT", "5", "25", "100", "回滚"]) assert.match(all, new RegExp(token));
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

test("M07-05 Playwright verification uses isolated configurable API and Web ports", async () => {
  const [playwrightConfig, viteConfig, envExample, schema, featureMap, runbook] = await Promise.all([
    read("playwright.config.ts"),
    read("apps/web/vite.config.ts"),
    read("config/env.example"),
    read("config/schema.json"),
    read("docs/feature-map.json"),
    read("docs/runbooks/m07-05-release-rollout.md"),
  ]);
  for (const name of ["PLAYWRIGHT_API_PORT", "PLAYWRIGHT_WEB_PORT"]) {
    for (const source of [playwrightConfig, viteConfig, envExample, schema, featureMap, runbook]) assert.match(source, new RegExp(name));
  }
  assert.match(envExample, /^PLAYWRIGHT_API_PORT=4101$/m);
  assert.match(envExample, /^PLAYWRIGHT_WEB_PORT=5173$/m);
  assert.equal(playwrightConfig.match(/timeout:\s*300_000/g)?.length, 2);
  assert.match(featureMap, /"e2eStartupTimeoutMs":\s*300000/);
  assert.match(runbook, /启动等待上限为 300 秒/);
});

test("M07-05 Playwright verification can use the BaoTa host system Chromium", async () => {
  const [playwrightConfig, envExample, schema, featureMap, architecture, runbook, blueprint, phasePlan, moduleManifest, hostVerifier, ...linuxSnapshots] = await Promise.all([
    read("playwright.config.ts"),
    read("config/env.example"),
    read("config/schema.json"),
    read("docs/feature-map.json"),
    read("docs/architecture/m07-05-release-rollout.md"),
    read("docs/runbooks/m07-05-release-rollout.md"),
    read("new-product-enterprise-blueprint.md"),
    read("plans/phase-07-release-production.md"),
    read("verification/modules/M07-05.json").then(JSON.parse),
    read("scripts/verify-playwright-host.mjs"),
    ...[
      "m07-05-release-rollout-desktop-desktop-chromium-linux.png",
      "m07-05-release-rollout-desktop-mobile-390-linux.png",
      "m07-05-release-rollout-mobile-390-desktop-chromium-linux.png",
      "m07-05-release-rollout-mobile-390-mobile-390-linux.png",
    ].map((name) => read(`tests/e2e/m07-05-release-rollout.spec.ts-snapshots/${name}`)),
  ]);
  for (const source of [playwrightConfig, envExample, schema, featureMap, runbook, blueprint, phasePlan]) {
    assert.match(source, /PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH/);
  }
  assert.match(playwrightConfig, /launchOptions/);
  assert.match(playwrightConfig, /executablePath/);
  assert.match(envExample, /^PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$/m);
  assert.match(runbook, /\/usr\/bin\/chromium/);
  for (const source of [featureMap, architecture, runbook, blueprint, phasePlan]) assert.match(source, /fonts-noto-cjk/);
  assert.equal(linuxSnapshots.length, 4);
  for (const snapshot of linuxSnapshots) assert.ok(snapshot.length > 100_000);
  assert.ok(moduleManifest.commands.includes("node scripts/verify-playwright-host.mjs"));
  assert.match(hostVerifier, /fc-list/);
  assert.match(hostVerifier, /:lang=zh/);
  assert.match(hostVerifier, /playwright_chinese_font_missing/);
  const { verifyPlaywrightHost } = await import("../../scripts/verify-playwright-host.mjs");
  const executable = async () => {};
  await assert.rejects(
    () => verifyPlaywrightHost({ platform: "linux", env: { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: "/usr/bin/chromium" }, assertExecutable: executable, run: () => ({ status: 0, stdout: "" }) }),
    { code: "playwright_chinese_font_missing" },
  );
  assert.equal((await verifyPlaywrightHost({ platform: "linux", env: { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: "/usr/bin/chromium" }, assertExecutable: executable, run: () => ({ status: 0, stdout: "/font/NotoSansCJK.ttc: Noto Sans CJK SC" }) })).status, "passed");
});

test("M07-05 MySQL single-row gates use object presence instead of array length", async () => {
  const runner = await read("scripts/run-baota-release-rollout.mjs");
  assert.doesNotMatch(runner, /\b(?:existing|backup|sameBuild)\.length\b/);
  assert.match(runner, /if \(!existing\)/);
  assert.match(runner, /if \(!backup\)/);
  assert.match(runner, /if \(sameBuild\)/);
});

test("M07-05 live verification timestamps its probe after any existing production release", async () => {
  const verifier = await read("scripts/verify-release-rollout-live.mjs");
  assert.match(verifier, /now\s*=\s*new Date\(\)/);
  assert.doesNotMatch(verifier, /now\s*=\s*new Date\(["']\d{4}-\d{2}-\d{2}T/);
  assert.match(verifier, /UTC_TIMESTAMP\(3\)/);
  assert.match(verifier, /DATE_SUB\(UTC_TIMESTAMP\(3\), INTERVAL 1800 SECOND\)/);
  assert.doesNotMatch(verifier, /new Date\(now\.getTime\(\)-5_400_000\)/);
});

test("M07-05 signed release write probe rejects stale or forged requests before the durable write", async () => {
  const { ReleaseWriteProbeService, signReleaseProbe } = await import("../../apps/api/dist/release-rollout-service.js");
  const now = new Date("2026-08-08T18:00:00.000Z"), signingKey = "m07-05-test-signing-key-with-32-characters", writes = [];
  const service = new ReleaseWriteProbeService({ writeProbe: async (input) => writes.push(input) }, signingKey, "a".repeat(40), 60, () => now);
  const input = { timestamp: Math.floor(now.getTime() / 1000), nonce: randomUUID(), requestId: randomUUID(), traceId: randomUUID(), releaseId: randomUUID(), sampleId: randomUUID() };
  const proxiedInput = { ...input, requestId: "f".repeat(32), traceId: randomUUID() };
  const accepted = await service.record({ ...proxiedInput, signature: signReleaseProbe(input, signingKey) });
  assert.equal(accepted.accepted, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].requestId, proxiedInput.requestId);
  assert.equal(writes[0].traceId, proxiedInput.traceId);
  await assert.rejects(() => service.record({ ...input, sampleId: randomUUID(), signature: "0".repeat(64) }), { code: "release_probe_signature_invalid" });
  await assert.rejects(() => service.record({ ...input, timestamp: input.timestamp - 61, signature: signReleaseProbe({ ...input, timestamp: input.timestamp - 61 }, signingKey) }), { code: "release_probe_timestamp_invalid" });
  assert.equal(writes.length, 1);
});

test("M07-05 warms a signed single-transaction release write probe and measures unique writes", async () => {
  const [runner, up, down, routes, repository, envExample] = await Promise.all([
    read("scripts/run-baota-release-rollout.mjs"),
    read("database/migrations/0027_release_write_probe_m07_05.up.sql"),
    read("database/migrations/0027_release_write_probe_m07_05.down.sql"),
    read("apps/api/src/release-rollout-routes.ts"),
    read("apps/api/src/mysql-release-rollout-repository.ts"),
    read("config/env.example"),
  ]);
  assert.match(runner, /candidate_write_warmup_failed/);
  assert.match(runner, /\/api\/v1\/platform\/operations\/releases\/write-probe/);
  assert.match(runner, /RELEASE_PROBE_SIGNING_KEY/);
  assert.match(runner, /createHmac\("sha256"/);
  assert.match(runner, /release_write_probe_rejected/);
  assert.match(runner, /release_write_probe_persistence_mismatch/);
  assert.match(runner, /durableWriteSamples/);
  assert.match(up, /CREATE TABLE `deployment_release_write_probes`/);
  assert.match(down, /DROP TABLE IF EXISTS `deployment_release_write_probes`/);
  assert.match(routes, /x-release-probe-signature/);
  assert.match(repository, /INSERT INTO deployment_release_write_probes/);
  assert.match(envExample, /RELEASE_PROBE_SIGNING_KEY=/);
  assert.doesNotMatch(runner, /auth\/password-reset\/request/);
});

test("M07-05 retries only pre-upstream transport aborts without relaxing candidate rejection gates", async () => {
  const [runner, manifest, architecture, runbook] = await Promise.all([
    read("scripts/run-baota-release-rollout.mjs"),
    read("infra/baota/release-rollout-manifest.json").then(JSON.parse),
    read("docs/architecture/m07-05-release-rollout.md"),
    read("docs/runbooks/m07-05-release-rollout.md"),
  ]);
  assert.equal(manifest.canary.transportDeliveryRetryAttempts, 1);
  assert.equal(manifest.canary.transportAbortRetryScope, "nginx-499-before-upstream-only");
  assert.match(runner, /upstream_status/);
  assert.match(runner, /upstreamReached/);
  assert.match(runner, /sendWriteProbeWithDeliveryRetry/);
  assert.match(runner, /response\.status !== 499/);
  assert.match(runner, /sampleId/);
  assert.match(runner, /release_write_probe_rejected/);
  assert.match(runner, /release_write_probe_persistence_mismatch/);
  for (const source of [architecture, runbook]) {
    assert.match(source, /到达上游前/);
    assert.match(source, /同一 sample_id/);
    assert.match(source, /不得重试候选拒绝/);
  }
});

test("M07-05 uses one-second production sampling without relaxing rollout gates", async () => {
  const [manifest, runner, envExample, openapi, featureMap, architecture, runbook, verifier, evidenceSchema] = await Promise.all([
    read("infra/baota/release-rollout-manifest.json").then(JSON.parse),
    read("scripts/run-baota-release-rollout.mjs"),
    read("config/env.example"),
    read("docs/openapi.yaml"),
    read("docs/feature-map.json"),
    read("docs/architecture/m07-05-release-rollout.md"),
    read("docs/runbooks/m07-05-release-rollout.md"),
    read("scripts/verify-release-rollout-production.mjs"),
    read("verification/release-rollout-production-evidence.schema.json").then(JSON.parse),
  ]);
  assert.equal(manifest.canary.syntheticProbeIntervalSeconds, 1);
  assert.match(runner, /RELEASE_SAMPLE_INTERVAL_SECONDS \?\? 1/);
  assert.match(envExample, /^RELEASE_SAMPLE_INTERVAL_SECONDS=1$/m);
  for (const source of [openapi, featureMap, architecture, runbook]) assert.match(source, /1 秒采样/);
  assert.match(verifier, /sampleIntervalSeconds !== 1/);
  assert.ok(evidenceSchema.required.includes("sampleIntervalSeconds"));
  assert.ok(evidenceSchema.required.includes("mysqlDurability"));
  assert.equal(evidenceSchema.properties.schemaVersion.const, 2);
  assert.equal(evidenceSchema.properties.mysqlDurability.properties.innodbFlushLogAtTrxCommit.const, 2);
  assert.equal(evidenceSchema.properties.mysqlDurability.properties.productScoutBinlogExcluded.const, true);
  assert.equal(evidenceSchema.properties.sampleIntervalSeconds.const, 1);
  assert.equal(manifest.canary.minimumObservationSeconds, 1800);
  assert.equal(manifest.automaticStop.writeP95MsInclusive, 600);
  assert.equal(manifest.automaticStop.readP95MsInclusive, 300);
  assert.equal(manifest.automaticStop.errorRatePercentExclusive, 1);
});
