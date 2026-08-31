import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("M07-04.A01-A05 freezes encrypted S0 backup and isolated restore contracts", async () => {
  const manifest = JSON.parse(await read("infra/baota/backup-recovery-manifest.json"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.primaryRegion, "惠州");
  assert.equal(manifest.recoveryRegion, "惠州");
  assert.equal(manifest.topology, "S0-single-host-local-isolation");
  assert.equal(manifest.targets.mysql.rpoMinutes, 15);
  assert.equal(manifest.targets.mysql.rtoMinutes, 240);
  assert.equal(manifest.encryption.algorithm, "aes-256-gcm");
  assert.equal(manifest.productionManager, "baota");
  assert.equal(manifest.recoveryDrill.isolated, true);
  const runner = await read("scripts/run-baota-backup-drill.mjs");
  assert.match(runner, /mysqldump/);
  assert.match(runner, /same_host_local_isolation/);
  assert.match(runner, /BACKUP_MYSQL_SOCKET/);
  assert.match(runner, /socketPath:\s*adminSocket/);
  assert.match(runner, /"--socket",\s*adminSocket/);
  assert.doesNotMatch(runner, /adminPool\s*=\s*mysql\.createPool\(\{\s*host:\s*db\.host/);
  assert.doesNotMatch(runner, /systemctl|\bpm2\b|crontab/i);
});

test("M07-04.A02-A04 MySQL 5.7 migration records backup assets, drills and rollback", async () => {
  const up = await read("database/migrations/0025_backup_recovery_m07_04.up.sql");
  const down = await read("database/migrations/0025_backup_recovery_m07_04.down.sql");
  for (const table of ["backup_recovery_runs", "backup_recovery_assets"]) {
    assert.match(up, new RegExp("CREATE TABLE `" + table + "`"));
    assert.match(down, new RegExp("DROP TABLE IF EXISTS `" + table + "`"));
  }
  assert.doesNotMatch(up, /CHECK\s*\(|GENERATED\s+ALWAYS|CREATE\s+INDEX\s+.*WHERE/i);
  assert.match(up, /request_id/);
  assert.match(up, /trace_id/);
  assert.match(up, /actual_rpo_minutes/);
  assert.match(up, /actual_rto_minutes/);
  assert.match(up, /storage_role/);
});

test("M07-04.A05/A10/A12/A14 AES-GCM bundle self-test verifies integrity and cleanup", () => {
  const result = spawnSync(process.execPath, ["scripts/backup-recovery.mjs", "--self-test"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.status, "passed");
  assert.equal(body.algorithm, "aes-256-gcm");
  assert.equal(body.integrity, "verified");
  assert.equal(body.cleanup, "passed");
});

test("M07-04.A06-A11 platform operations status is read-only, guarded and sanitized", async () => {
  const files = await Promise.all([
    read("apps/api/src/backup-recovery-routes.ts"),
    read("apps/api/src/backup-recovery-service.ts"),
    read("apps/api/src/mysql-backup-recovery-repository.ts"),
    read("apps/web/src/components/BackupRecoveryCenter.vue"),
  ]);
  const all = files.join("\n");
  assert.match(all, /platform:operate/);
  assert.match(all, /\/api\/v1\/platform\/operations\/backup-recovery/);
  assert.doesNotMatch(all, /app\.post\([^\n]*backup-recovery/);
  for (const forbidden of ["encryption_key", "private_key", "password", "remote_host"])
    assert.doesNotMatch(all, new RegExp(forbidden, "i"));
  for (const state of ["loading", "empty", "blocked", "stale", "verified"])
    assert.match(all, new RegExp(state));
  for (const token of [
    "AbortController",
    "15_000",
    "refreshing",
    "refreshFailure",
    "backup_recovery_read_timeout",
    "beginTransaction",
    "rollback",
  ])
    assert.match(all, new RegExp(token));
});

test("M07-04.A06/A08 operations route bounds reads and sanitizes dependency failures", async () => {
  const { buildApp } = await import("../../apps/api/dist/app.js");
  const route = (service, readTimeoutMs) => ({
    service,
    authorization: { authorize: async () => undefined },
    auth: {
      authenticate: async () => ({ user: { id: "actor" }, session: { id: "session" } }),
    },
    secureCookie: false,
    readTimeoutMs,
  });
  const failure = Object.assign(new Error("private mysql host detail"), {
    code: "PROTOCOL_CONNECTION_LOST",
  });
  const dependencyApp = buildApp({
    backupRecovery: route({ read: async () => Promise.reject(failure) }),
  });
  const dependency = await dependencyApp.inject({
    method: "GET",
    url: "/api/v1/platform/operations/backup-recovery",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "backup-dependency-request",
      "x-trace-id": "backup-dependency-trace",
    },
  });
  assert.equal(dependency.statusCode, 503);
  assert.equal(dependency.json().error.code, "backup_recovery_dependency_unavailable");
  assert.equal(dependency.json().request_id, "backup-dependency-request");
  assert.doesNotMatch(dependency.body, /private mysql host detail|PROTOCOL_CONNECTION_LOST/);
  await dependencyApp.close();

  let aborted = false;
  const timeoutApp = buildApp({
    backupRecovery: route(
      {
        read: ({ signal }) =>
          new Promise((_, reject) =>
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(signal.reason);
              },
              { once: true },
            ),
          ),
      },
      10,
    ),
  });
  const timeout = await timeoutApp.inject({
    method: "GET",
    url: "/api/v1/platform/operations/backup-recovery",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "backup-timeout-request",
      "x-trace-id": "backup-timeout-trace",
    },
  });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.json().error.code, "backup_recovery_read_timeout");
  assert.equal(aborted, true);
  await timeoutApp.close();
});

test("M07-04.A10/A14 read facts and audit in one cancellable transaction", async () => {
  const { MySqlBackupRecoveryRepository } =
    await import("../../apps/api/dist/mysql-backup-recovery-repository.js");
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (sql, values = []) => {
      calls.push(sql);
      assert.equal(values.length, (sql.match(/\?/g) ?? []).length);
      return [[], []];
    },
  };
  const repository = new MySqlBackupRecoveryRepository({
    getConnection: async () => connection,
  });
  assert.deepEqual(
    await repository.read({
      actorId: "actor",
      requestId: "request",
      traceId: "trace",
      now: new Date("2026-08-08T12:00:00.000Z"),
    }),
    { runs: [], assets: [] },
  );
  assert.deepEqual(
    calls.filter((item) => ["begin", "commit", "rollback", "release"].includes(item)),
    ["begin", "commit", "release"],
  );
  assert.equal(calls.filter((item) => String(item).startsWith("INSERT INTO")).length, 1);

  const controller = new AbortController();
  const cancelledCalls = [];
  const cancelledConnection = {
    beginTransaction: async () => cancelledCalls.push("begin"),
    commit: async () => cancelledCalls.push("commit"),
    rollback: async () => cancelledCalls.push("rollback"),
    release: () => cancelledCalls.push("release"),
    query: async () => {
      controller.abort();
      return [[], []];
    },
  };
  await assert.rejects(
    new MySqlBackupRecoveryRepository({ getConnection: async () => cancelledConnection }).read({
      actorId: "actor",
      requestId: "request",
      traceId: "trace",
      now: new Date("2026-08-08T12:00:00.000Z"),
      signal: controller.signal,
    }),
    /aborted/i,
  );
  assert.deepEqual(cancelledCalls, ["begin", "rollback", "release"]);
});

test("M07-04.A10/A13/A17 config, OpenAPI, Feature Map and runbooks stay synchronized", async () => {
  const all = (
    await Promise.all(
      [
        "config/env.example",
        "config/schema.json",
        "docs/openapi.yaml",
        "docs/feature-map.json",
        "docs/architecture/m07-04-backup-recovery.md",
        "docs/runbooks/m07-04-backup-recovery.md",
        "scripts/run-baota-backup-drill.mjs",
        "verification/modules/M07-04.json",
      ].map(read),
    )
  ).join("\n");
  for (const token of [
    "M07-04",
    "BACKUP_ENCRYPTION_KEY",
    "BACKUP_MYSQL_SOCKET",
    "RPO",
    "RTO",
    "同机",
    "隔离",
    "回滚",
  ])
    assert.match(all, new RegExp(token));
});

test("M07-04.A04/A08/A12/A16 service fails closed and expires old drills", async () => {
  const { BackupRecoveryService } = await import("../../apps/api/dist/backup-recovery-service.js");
  const now = new Date("2026-08-08T12:00:00.000Z");
  const policy = {
    primaryRegion: "惠州",
    recoveryRegion: "惠州",
    rpoMinutes: 15,
    rtoMinutes: 240,
    maximumDrillAgeDays: 90,
  };
  const read = async (runs, assets) =>
    new BackupRecoveryService({ read: async () => ({ runs, assets }) }, policy, () => now).read({
      actorId: "actor",
      requestId: "request",
      traceId: "trace",
    });
  assert.equal((await read([], [])).state, "empty");
  const backup = {
    id: "backup-current",
    run_type: "backup",
    status: "verified",
    encrypted: true,
    integrity_verified: true,
    actual_rpo_minutes: 5,
    finished_at: "2026-08-08T11:00:00.000Z",
  };
  assert.equal((await read([backup], [])).state, "blocked");
  const replica = {
    run_id: backup.id,
    asset_kind: "mysql_full",
    region: "惠州",
    storage_role: "recovery_copy",
    encrypted: true,
    integrity_verified: true,
  };
  const oldDrill = {
    run_type: "restore_drill",
    status: "verified",
    isolated: true,
    encrypted: true,
    integrity_verified: true,
    permission_boundary_verified: true,
    audit_chain_verified: true,
    evidence_hash_verified: true,
    actual_rto_minutes: 18,
    finished_at: "2026-01-01T00:00:00.000Z",
  };
  const stale = await read([backup, oldDrill], [replica]);
  assert.equal(stale.state, "stale");
  assert.ok(stale.blockers.some((item) => item.code === "restore_drill_stale"));
  const currentDrill = { ...oldDrill, finished_at: "2026-08-08T10:00:00.000Z" };
  const verified = await read([backup, currentDrill], [replica]);
  assert.equal(verified.state, "verified");
  assert.equal(verified.blockers.length, 0);
  assert.equal(verified.drill_age_days, 0);
  assert.equal(verified.drill_expires_at, "2026-11-06T10:00:00.000Z");
  assert.equal(verified.days_until_drill_expiry, 90);
  const expiring = await read(
    [backup, { ...currentDrill, finished_at: "2026-05-11T12:00:00.000Z" }],
    [replica],
  );
  assert.equal(expiring.state, "verified");
  assert.equal(expiring.drill_age_days, 89);
  assert.equal(expiring.days_until_drill_expiry, 1);
  assert.equal(
    (await read([{ ...backup, actual_rpo_minutes: 16 }, currentDrill], [replica])).state,
    "blocked",
  );
  assert.equal(
    (await read([backup, { ...currentDrill, permission_boundary_verified: false }], [replica]))
      .state,
    "blocked",
  );
  assert.equal(
    (await read([{ ...backup, id: "newer-backup" }, currentDrill], [replica])).state,
    "blocked",
  );
});

test("M07-04.A14 live verification isolates probe chronology from production runs", async () => {
  const live = await read("scripts/verify-backup-recovery-live.mjs");
  assert.match(live, /SELECT MAX\(started_at\) latest_started_at FROM backup_recovery_runs/);
  assert.match(live, /backupStartedAt/);
  assert.match(live, /drillStartedAt/);
  assert.match(live, /observedAt/);
  assert.doesNotMatch(live, /new Date\(["']2026-08-08T13:30:00\.000Z["']\)/);
});
