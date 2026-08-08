#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import mysql from "mysql2/promise";

const argv = process.argv.slice(2), arg = (name) => argv[argv.indexOf(name) + 1];
const requestId = randomUUID(), traceId = randomUUID();
const fail = (code, message) => Object.assign(new Error(message), { code });
const parseEnv = (source) => Object.fromEntries(source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const at = line.indexOf("="); let value = line.slice(at + 1).trim(); if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1); return [line.slice(0, at).trim(), value]; }));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const run = (command, args) => new Promise((done, reject) => { const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] }); let tail = ""; child.stderr.on("data", (chunk) => { tail = `${tail}${chunk}`.slice(-3000); }); child.once("error", reject); child.once("exit", (code) => code === 0 ? done() : reject(fail("release_command_failed", `${basename(command)} exited ${code}: ${tail}`))); });
const percentile = (values, percent) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? Math.ceil(sorted[Math.max(0, Math.ceil(sorted.length * percent) - 1)]) : null; };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const absolute = (value, key) => { if (!isAbsolute(value ?? "")) throw fail("release_path_invalid", `${key} must be absolute`); return resolve(value); };
const readFrom = async (path, offset) => { const handle = await open(path, "r"); try { const info = await handle.stat(), start = info.size >= offset ? offset : 0, buffer = Buffer.alloc(Math.max(0, info.size - start)); if (buffer.length) await handle.read(buffer, 0, buffer.length, start); return buffer.toString("utf8"); } finally { await handle.close(); } };

function splitConfig(percent, stablePort, candidatePort) {
  const candidate = percent > 0 ? `    ${percent}% http://127.0.0.1:${candidatePort};\n` : "";
  return `# Managed by the Baota product-scout-release-rollout task.\n# Do not edit during an active release.\nsplit_clients \"$request_id\" $scoutops_release_upstream {\n${candidate}    * http://127.0.0.1:${stablePort};\n}\n`;
}

function siteConfig(source, timingLog) {
  let result = source.replaceAll(/proxy_pass\s+(?:http:\/\/127\.0\.0\.1:\d+|\$scoutops_release_upstream);/g, "proxy_pass $scoutops_release_upstream;");
  const directive = `access_log ${timingLog} mdzx_upstream_timing;`;
  if (!result.includes(directive)) result = result.replace(/\n}\s*$/, `\n    ${directive}\n}\n`);
  if (!result.includes("proxy_pass $scoutops_release_upstream;")) throw fail("release_nginx_site_invalid", "no ScoutOps proxy_pass could be converted to the rollout upstream");
  return result;
}

function parseTimingLines(source, candidatePort) {
  const records = [];
  for (const line of source.split(/\r?\n/)) {
    const method = line.match(/\"(GET|HEAD|POST|PUT|PATCH|DELETE)\s/)?.[1];
    const status = Number(line.match(/\bstatus=(\d{3})\b/)?.[1]);
    const seconds = Number(line.match(/\brequest_time=([0-9.]+)/)?.[1]);
    const upstream = line.match(/\bupstream_addr=\"([^\"]*)\"/)?.[1] ?? "";
    if (method && Number.isFinite(status) && Number.isFinite(seconds) && upstream.split(/\s*,\s*/).some((item) => item.endsWith(`:${candidatePort}`))) records.push({ method, status, milliseconds: seconds * 1000 });
  }
  return records;
}

function breachFor(metrics, readCount, writeCount, minimumSamples, thresholds) {
  if (readCount < minimumSamples || writeCount < minimumSamples) return "insufficient_candidate_samples";
  if (![metrics.errorRate, metrics.readP95, metrics.writeP95, metrics.asyncLag].every(Number.isFinite)) return "release_metric_missing";
  if (metrics.errorRate >= thresholds.errorRate) return "error_rate_threshold_exceeded";
  if (metrics.readP95 > thresholds.readP95) return "read_p95_threshold_exceeded";
  if (metrics.writeP95 > thresholds.writeP95) return "write_p95_threshold_exceeded";
  if (metrics.asyncLag > thresholds.asyncLag) return "async_lag_threshold_exceeded";
  return null;
}

if (argv.includes("--self-test")) {
  const records = parseTimingLines('127.0.0.1 - - [time] "GET /api/v1/health/live HTTP/1.1" status=200 bytes=1 request_time=0.100 upstream_addr="127.0.0.1:4103"\n127.0.0.1 - - [time] "POST /api/v1/auth/password-reset/request HTTP/1.1" status=202 bytes=1 request_time=0.200 upstream_addr="127.0.0.1:4103"\n127.0.0.1 - - [time] "GET /api/v1/health/live HTTP/1.1" status=500 bytes=1 request_time=9.000 upstream_addr="127.0.0.1:4101"', 4103);
  const metrics = { errorRate: 0, readP95: percentile(records.filter((item) => item.method === "GET").map((item) => item.milliseconds), .95), writeP95: percentile(records.filter((item) => item.method === "POST").map((item) => item.milliseconds), .95), asyncLag: 2 };
  const thresholds = { errorRate: 1, readP95: 300, writeP95: 600, asyncLag: 60 };
  if (records.length !== 2 || metrics.readP95 !== 100 || metrics.writeP95 !== 200 || breachFor(metrics, 1, 1, 1, thresholds) !== null || breachFor(metrics, 0, 1, 1, thresholds) !== "insufficient_candidate_samples" || breachFor({ ...metrics, errorRate: 1 }, 1, 1, 1, thresholds) !== "error_rate_threshold_exceeded" || splitConfig(0, 4101, 4103).includes(":4103") || !siteConfig("server { location /api/ { proxy_pass http://127.0.0.1:4101; }\n}", "/www/wwwlogs/test.log").includes("$scoutops_release_upstream")) throw fail("release_self_test_failed", "release parser, thresholds, stable fallback or Nginx rendering drifted");
  process.stdout.write(`${JSON.stringify({ module: "M07-05", status: "passed", upstream_parser: "passed", fail_closed_thresholds: "passed", stable_fallback: "passed", request_id: requestId, trace_id: traceId })}\n`); process.exit(0);
}

async function asyncLagSeconds(pool) {
  const [tables] = await pool.query("SELECT TABLE_NAME table_name FROM information_schema.columns WHERE table_schema=DATABASE() AND COLUMN_NAME IN ('status','available_at') GROUP BY TABLE_NAME HAVING COUNT(DISTINCT COLUMN_NAME)=2 ORDER BY TABLE_NAME");
  let maximum = 0;
  for (const row of tables) {
    const table = String(row.table_name);
    if (!/^[a-z0-9_]+$/.test(table)) continue;
    const [values] = await pool.query(`SELECT COALESCE(MAX(GREATEST(0,TIMESTAMPDIFF(SECOND,available_at,UTC_TIMESTAMP(3)))),0) lag_seconds FROM \`${table}\` WHERE available_at<=UTC_TIMESTAMP(3) AND status IN ('queued','pending','scheduled','failed_retryable')`);
    maximum = Math.max(maximum, Number(values[0]?.lag_seconds ?? 0));
  }
  return maximum;
}

async function fetchIdentity(baseUrl) {
  const response = await fetch(`${baseUrl}/api/v1/health/version`, { headers: { accept: "application/json", "x-request-id": randomUUID(), "x-trace-id": randomUUID() }, signal: AbortSignal.timeout(10_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data?.build_sha || !/^[a-f0-9]{64}$/.test(body?.data?.config_fingerprint ?? "")) throw fail("candidate_identity_invalid", "candidate version health is unavailable or incomplete");
  return body.data;
}

async function writeGate(pool, releaseId, kind, status, values = {}) {
  const id = randomUUID(), now = new Date();
  await pool.query("INSERT INTO deployment_release_gates(id,release_id,gate_kind,status,traffic_percent,observe_seconds,sample_count,error_rate_percent,read_p95_ms,write_p95_ms,async_lag_seconds,failure_code,started_at,finished_at,request_id,trace_id,metadata) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),traffic_percent=VALUES(traffic_percent),observe_seconds=VALUES(observe_seconds),sample_count=VALUES(sample_count),error_rate_percent=VALUES(error_rate_percent),read_p95_ms=VALUES(read_p95_ms),write_p95_ms=VALUES(write_p95_ms),async_lag_seconds=VALUES(async_lag_seconds),failure_code=VALUES(failure_code),started_at=VALUES(started_at),finished_at=VALUES(finished_at),request_id=VALUES(request_id),trace_id=VALUES(trace_id),metadata=VALUES(metadata)", [id, releaseId, kind, status, values.percent ?? 0, values.observeSeconds ?? 0, values.sampleCount ?? 0, values.errorRate ?? null, values.readP95 ?? null, values.writeP95 ?? null, values.asyncLag ?? null, values.failureCode ?? null, values.startedAt ?? now, ["passed","failed","stopped","rolled_back"].includes(status) ? now : null, requestId, traceId, JSON.stringify(values.metadata ?? {})]);
  const [[gate]] = await pool.query("SELECT id FROM deployment_release_gates WHERE release_id=? AND gate_kind=?", [releaseId, kind]);
  return gate.id;
}

async function event(pool, releaseId, gateId, type, reasonCode = null, metadata = {}) {
  await pool.query("INSERT INTO deployment_release_gate_events(id,release_id,gate_id,event_type,actor_type,actor_id,reason_code,request_id,trace_id,occurred_at,metadata) VALUES(?,?,?,?, 'baota_task',NULL,?,?,?,?,?)", [randomUUID(), releaseId, gateId, type, reasonCode, requestId, traceId, new Date(), JSON.stringify(metadata)]);
}

let pool, runtime, originalSite = "", sitePath, splitPath, nginxBin = "", stablePort = 0, candidatePort = 0, nginxConfigured = false;
try {
  const envFile = arg("--env-file");
  if (!argv.includes("--run") || !envFile) throw fail("release_arguments_invalid", "use --run --env-file <Baota restricted env file>");
  runtime = { ...process.env, ...parseEnv(await readFile(envFile, "utf8")) };
  const production = runtime.NODE_ENV === "production";
  const observeSeconds = Number(runtime.RELEASE_CANARY_OBSERVE_SECONDS ?? 1800), intervalSeconds = Number(runtime.RELEASE_SAMPLE_INTERVAL_SECONDS ?? 5), minimumSamples = Number(runtime.RELEASE_MINIMUM_CANDIDATE_SAMPLES ?? 5);
  if (!Number.isInteger(observeSeconds) || observeSeconds < (production ? 1800 : 1)) throw fail("release_observation_invalid", production ? "production observation must be at least 1800 seconds" : "observation must be positive");
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 60 || !Number.isInteger(minimumSamples) || minimumSamples < 1) throw fail("release_sampling_invalid", "sampling interval or minimum sample count is invalid");
  const webOrigin = runtime.WEB_ORIGIN; if (!/^https:\/\/[^/]+$/.test(webOrigin ?? "")) throw fail("release_web_origin_invalid", "WEB_ORIGIN must be the production HTTPS origin");
  stablePort = Number(runtime.RELEASE_STABLE_API_PORT ?? 4101); candidatePort = Number(runtime.RELEASE_CANDIDATE_API_PORT ?? 4103);
  if (stablePort === candidatePort || ![stablePort, candidatePort].every((port) => Number.isInteger(port) && port >= 1024 && port <= 65535)) throw fail("release_port_invalid", "stable and candidate private ports must be different");
  sitePath = absolute(runtime.RELEASE_NGINX_SITE_CONFIG, "RELEASE_NGINX_SITE_CONFIG"); splitPath = absolute(runtime.RELEASE_NGINX_SPLIT_CONFIG, "RELEASE_NGINX_SPLIT_CONFIG");
  const releaseRoot = absolute(runtime.RELEASE_ROOT, "RELEASE_ROOT"), timingLog = absolute(runtime.RELEASE_NGINX_TIMING_LOG, "RELEASE_NGINX_TIMING_LOG"), evidencePath = absolute(runtime.RELEASE_PRODUCTION_EVIDENCE_FILE, "RELEASE_PRODUCTION_EVIDENCE_FILE");
  if (!releaseRoot.startsWith("/www/wwwroot/") || !sitePath.startsWith("/www/server/panel/vhost/nginx/") || !splitPath.startsWith("/www/server/panel/vhost/nginx/") || !timingLog.startsWith("/www/wwwlogs/") || !evidencePath.startsWith(`${releaseRoot}/.artifacts/verification/`)) throw fail("release_baota_path_invalid", "release, Nginx, log and evidence paths must remain under Baota-managed roots");
  pool = mysql.createPool({ host: runtime.DB_HOST, port: Number(runtime.DB_PORT), user: runtime.DB_USER, password: runtime.DB_PASSWORD, database: runtime.DB_NAME, waitForConnections: true, connectionLimit: 2, timezone: "Z" });
  await pool.query("SELECT 1");
  const identity = await fetchIdentity(runtime.RELEASE_CANDIDATE_BASE_URL ?? `http://127.0.0.1:${candidatePort}`);
  if (identity.build_sha !== runtime.BUILD_SHA) throw fail("candidate_build_mismatch", "candidate build_sha differs from the release task BUILD_SHA");
  const migrationName = "0026_release_rollout_m07_05.up.sql", migrationSql = await readFile(resolve(releaseRoot, "database/migrations", migrationName), "utf8"), checksum = sha256(migrationSql.replace(/\r\n/g, "\n"));
  const [[existingMigration]] = await pool.query("SELECT checksum FROM schema_migrations WHERE name=?", [migrationName]);
  if (!existingMigration.length) { for (const statement of migrationSql.split(";").map((value) => value.trim()).filter(Boolean)) await pool.query(statement); await pool.query("INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))", [migrationName, checksum]); }
  else if (existingMigration[0].checksum !== checksum) throw fail("release_migration_drift", "M07-05 migration checksum drifted");
  const releaseId = randomUUID(), now = new Date();
  const [[sameBuild]] = await pool.query("SELECT id FROM deployment_releases WHERE stage='S0' AND build_sha=?", [runtime.BUILD_SHA]);
  const effectiveReleaseId = sameBuild[0]?.id ?? releaseId;
  if (sameBuild.length) { await pool.query("DELETE FROM deployment_release_gates WHERE release_id=?", [effectiveReleaseId]); await pool.query("UPDATE deployment_releases SET app_version=?,config_fingerprint=?,migration_version=?,status='deploying',request_id=?,trace_id=?,started_at=?,finished_at=NULL,updated_at=? WHERE id=?", [runtime.APP_VERSION, identity.config_fingerprint, migrationName, requestId, traceId, now, now, effectiveReleaseId]); }
  else await pool.query("INSERT INTO deployment_releases(id,stage,app_version,build_sha,config_fingerprint,migration_version,status,approved_by,request_id,trace_id,started_at,finished_at,created_at,updated_at) VALUES(?,'S0',?,?,?,?,'deploying',NULL,?,?,?,?,?,?)", [effectiveReleaseId, runtime.APP_VERSION, runtime.BUILD_SHA, identity.config_fingerprint, migrationName, requestId, traceId, now, null, now, now]);
  const preflightGate = await writeGate(pool, effectiveReleaseId, "preflight", "passed", { metadata: { candidate_port: candidatePort, identity_verified: true, manager: "baota" } }); await event(pool, effectiveReleaseId, preflightGate, "passed");
  const [[backup]] = await pool.query("SELECT id,finished_at FROM backup_recovery_runs WHERE run_type='restore_drill' AND status='verified' AND isolated=1 AND encrypted=1 AND integrity_verified=1 ORDER BY finished_at DESC LIMIT 1");
  if (!backup.length) throw fail("release_backup_gate_missing", "no verified M07-04 restore drill exists");
  const backupGate = await writeGate(pool, effectiveReleaseId, "backup", "passed", { metadata: { backup_run_id: backup[0].id, same_host_scope: true } }); await event(pool, effectiveReleaseId, backupGate, "passed");
  const migrationGate = await writeGate(pool, effectiveReleaseId, "migration", "passed", { metadata: { migration: migrationName, checksum } }); await event(pool, effectiveReleaseId, migrationGate, "passed");
  originalSite = await readFile(sitePath, "utf8"); const rolloutSite = siteConfig(originalSite, timingLog); await writeFile(sitePath, rolloutSite, { mode: 0o600 });
  nginxBin = runtime.RELEASE_NGINX_BIN ?? "/www/server/nginx/sbin/nginx"; nginxConfigured = true;
  const publicBase = (runtime.RELEASE_PUBLIC_BASE_URL ?? "https://midouai.mozhiz.cn").replace(/\/$/, "");
  const thresholds = { errorRate: Number(runtime.RELEASE_5XX_STOP_BASIS_POINTS ?? 100) / 100, readP95: Number(runtime.RELEASE_READ_P95_STOP_MS ?? 300), writeP95: Number(runtime.RELEASE_WRITE_P95_STOP_MS ?? 600), asyncLag: Number(runtime.RELEASE_ASYNC_LAG_STOP_SECONDS ?? 60) };
  const gates = [];
  for (const percent of [5, 25, 100]) {
    await writeFile(splitPath, splitConfig(percent, stablePort, candidatePort), { mode: 0o600 }); await run(nginxBin, ["-t"]); await run(nginxBin, ["-s", "reload"]);
    const gateStarted = new Date(), startSize = await stat(timingLog).then((value) => value.size).catch(() => 0), lagSamples = [];
    const runningGate = await writeGate(pool, effectiveReleaseId, `canary_${percent}`, "running", { percent, startedAt: gateStarted, metadata: { routing_key: "$request_id", measurement: "baota_nginx_upstream_timing_log" } }); await event(pool, effectiveReleaseId, runningGate, "started", null, { percent });
    while ((Date.now() - gateStarted.getTime()) / 1000 < observeSeconds) {
      const correlation = randomUUID();
      const common = { "x-request-id": correlation, "x-trace-id": correlation };
      await Promise.allSettled([
        fetch(`${publicBase}/api/v1/health/live`, { headers: { ...common, accept: "application/json" }, signal: AbortSignal.timeout(10_000) }),
        fetch(`${publicBase}/api/v1/auth/password-reset/request`, { method: "POST", headers: { ...common, accept: "application/json", "content-type": "application/json", origin: webOrigin, "idempotency-key": `release-${effectiveReleaseId}-${percent}` }, body: JSON.stringify({ email: `release-probe-${effectiveReleaseId}@invalid.local` }), signal: AbortSignal.timeout(10_000) }),
      ]);
      lagSamples.push(await asyncLagSeconds(pool)); await sleep(intervalSeconds * 1000);
    }
    const log = await readFrom(timingLog, startSize).catch(() => ""), records = parseTimingLines(log, candidatePort);
    const reads = records.filter((item) => ["GET","HEAD"].includes(item.method)), writes = records.filter((item) => !["GET","HEAD"].includes(item.method));
    const metrics = { percent, observeSeconds: Math.floor((Date.now() - gateStarted.getTime()) / 1000), sampleCount: records.length, errorRate: records.length ? records.filter((item) => item.status >= 500).length * 100 / records.length : null, readP95: percentile(reads.map((item) => item.milliseconds), .95), writeP95: percentile(writes.map((item) => item.milliseconds), .95), asyncLag: Math.max(0, ...lagSamples) };
    const breach = breachFor(metrics, reads.length, writes.length, minimumSamples, thresholds);
    if (breach) {
      await writeGate(pool, effectiveReleaseId, `canary_${percent}`, "failed", { ...metrics, failureCode: breach, startedAt: gateStarted, metadata: { read_samples: reads.length, write_samples: writes.length } });
      await writeFile(splitPath, splitConfig(0, stablePort, candidatePort), { mode: 0o600 }); await run(nginxBin, ["-t"]); await run(nginxBin, ["-s", "reload"]);
      const stopped = await writeGate(pool, effectiveReleaseId, "automatic_stop", "stopped", { percent, failureCode: breach, metadata: metrics }); await event(pool, effectiveReleaseId, stopped, "automatic_stop", breach, metrics);
      const rollback = await writeGate(pool, effectiveReleaseId, "rollback", "rolled_back", { metadata: { stable_port: stablePort, candidate_port: candidatePort } }); await event(pool, effectiveReleaseId, rollback, "rolled_back", breach);
      await pool.query("UPDATE deployment_releases SET status='rolled_back',finished_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?", [effectiveReleaseId]);
      throw fail(breach, `canary ${percent}% failed and traffic was rolled back to the stable Baota project`);
    }
    await writeGate(pool, effectiveReleaseId, `canary_${percent}`, "passed", { ...metrics, startedAt: gateStarted, metadata: { read_samples: reads.length, write_samples: writes.length } }); await event(pool, effectiveReleaseId, runningGate, "passed", null, metrics); gates.push({ ...metrics, readSamples: reads.length, writeSamples: writes.length });
  }
  await pool.query("UPDATE deployment_releases SET status='healthy',finished_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?", [effectiveReleaseId]);
  const evidence = { schemaVersion: 1, module: "M07-05", manager: "baota", topology: "single_host_stable_and_candidate", backupServerUsed: false, releaseId: effectiveReleaseId, buildSha: runtime.BUILD_SHA, appVersion: runtime.APP_VERSION, configFingerprint: identity.config_fingerprint, migrationVersion: migrationName, percentages: [5,25,100], minimumObservationSeconds: observeSeconds, gates, automaticStopArmed: true, rollbackTarget: { sameHost: true, stablePort }, requestId, traceId, capturedAt: new Date().toISOString() };
  await mkdir(dirname(evidencePath), { recursive: true, mode: 0o700 }); await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 }); process.stdout.write(`${JSON.stringify(evidence)}\n`);
} catch (error) {
  if (nginxConfigured && splitPath && stablePort && candidatePort) {
    try { await writeFile(splitPath, splitConfig(0, stablePort, candidatePort), { mode: 0o600 }); await run(nginxBin, ["-t"]); await run(nginxBin, ["-s", "reload"]); } catch {}
  }
  process.stderr.write(`${JSON.stringify({ module: "M07-05", status: "blocked", code: error.code ?? "release_rollout_failed", message: error.message, request_id: requestId, trace_id: traceId })}\n`); process.exitCode = 2;
} finally { if (pool) await pool.end(); }
