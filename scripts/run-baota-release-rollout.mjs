#!/usr/bin/env node
import { createHash, createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import mysql from "mysql2/promise";
import { asyncLagSeconds } from "./release-rollout-async-lag.mjs";

const argv = process.argv.slice(2),
  arg = (name) => argv[argv.indexOf(name) + 1];
const requestId = randomUUID(),
  traceId = randomUUID();
const fail = (code, message) => Object.assign(new Error(message), { code });
const parseEnv = (source) =>
  Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const at = line.indexOf("=");
        let value = line.slice(at + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        )
          value = value.slice(1, -1);
        return [line.slice(0, at).trim(), value];
      }),
  );
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const run = (command, args) =>
  new Promise((done, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let tail = "";
    child.stderr.on("data", (chunk) => {
      tail = `${tail}${chunk}`.slice(-3000);
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? done()
        : reject(fail("release_command_failed", `${basename(command)} exited ${code}: ${tail}`)),
    );
  });
const percentile = (values, percent) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? Math.ceil(sorted[Math.max(0, Math.ceil(sorted.length * percent) - 1)])
    : null;
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const absolute = (value, key) => {
  if (!isAbsolute(value ?? "")) throw fail("release_path_invalid", `${key} must be absolute`);
  return resolve(value);
};
const readFrom = async (path, offset) => {
  const handle = await open(path, "r");
  try {
    const info = await handle.stat(),
      start = info.size >= offset ? offset : 0,
      buffer = Buffer.alloc(Math.max(0, info.size - start));
    if (buffer.length) await handle.read(buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
};

function splitConfig(percent, stablePort, candidatePort) {
  const candidate = percent > 0 ? `    ${percent}% http://127.0.0.1:${candidatePort};\n` : "";
  return `# Managed by the Baota product-scout-release-rollout task.\n# Do not edit during an active release.\nsplit_clients \"$request_id\" $scoutops_release_upstream {\n${candidate}    * http://127.0.0.1:${stablePort};\n}\n`;
}

function siteConfig(source, timingLog) {
  let result = source.replaceAll(
    /proxy_pass\s+(?:http:\/\/127\.0\.0\.1:\d+|\$scoutops_release_upstream);/g,
    "proxy_pass $scoutops_release_upstream;",
  );
  const directive = `access_log ${timingLog} mdzx_upstream_timing;`;
  if (!result.includes(directive)) result = result.replace(/\n}\s*$/, `\n    ${directive}\n}\n`);
  if (!result.includes("proxy_pass $scoutops_release_upstream;"))
    throw fail(
      "release_nginx_site_invalid",
      "no ScoutOps proxy_pass could be converted to the rollout upstream",
    );
  return result;
}

function parseTimingLines(source, candidatePort) {
  const records = [];
  for (const line of source.split(/\r?\n/)) {
    const request =
      line.match(/\"(GET|HEAD|POST|PUT|PATCH|DELETE)\s+([^?\s]+)(?:\?[^\s]*)?\s/) ?? [];
    const method = request[1],
      path = request[2];
    const status = Number(line.match(/\bstatus=(\d{3})\b/)?.[1]);
    const seconds = Number(line.match(/\brequest_time=([0-9.]+)/)?.[1]);
    const upstream = line.match(/\bupstream_addr=\"([^\"]*)\"/)?.[1] ?? "";
    const upstreamStatus = line.match(/\bupstream_status=\"([^\"]*)\"/)?.[1] ?? "";
    const upstreamReached = upstreamStatus.split(/\s*,\s*/).some((item) => /^\d{3}$/.test(item));
    if (
      method &&
      path &&
      Number.isFinite(status) &&
      Number.isFinite(seconds) &&
      upstream.split(/\s*,\s*/).some((item) => item.endsWith(`:${candidatePort}`))
    )
      records.push({ method, path, status, milliseconds: seconds * 1000, upstreamReached });
  }
  return records;
}

const probeCanonical = ({ timestamp, nonce, releaseId, sampleId }) =>
  [timestamp, nonce, releaseId, sampleId].join("\n");
const probeSignature = (input, signingKey) =>
  createHmac("sha256", signingKey).update(probeCanonical(input)).digest("hex");
const pinnedLookup = (connectAddress) => (_hostname, options, callback) =>
  options.all
    ? callback(null, [{ address: connectAddress, family: 4 }])
    : callback(null, connectAddress, 4);

function requestViaPinnedAddress(baseUrl, path, options, connectAddress) {
  const target = new URL(path, `${baseUrl}/`);
  const body = options.body ?? null;
  const headers = { ...options.headers };
  if (body !== null && headers["content-length"] === undefined)
    headers["content-length"] = Buffer.byteLength(body);
  return new Promise((done, reject) => {
    const request = httpsRequest(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: options.method ?? "GET",
        headers,
        servername: target.hostname,
        lookup: pinnedLookup(connectAddress),
      },
      (response) => {
        response.resume();
        response.once("end", () => done({ status: response.statusCode ?? 0 }));
        response.once("error", reject);
      },
    );
    request.setTimeout(10_000, () =>
      request.destroy(
        fail(
          "release_public_probe_timeout",
          "public probe timed out before the Baota Nginx response",
        ),
      ),
    );
    request.once("error", reject);
    if (body !== null) request.write(body);
    request.end();
  });
}

async function sendWriteProbe(baseUrl, runtime, releaseId, correlation, connectAddress = null) {
  const timestamp = Math.floor(Date.now() / 1000),
    nonce = randomUUID(),
    input = {
      timestamp,
      nonce,
      requestId: correlation,
      traceId: correlation,
      releaseId,
      sampleId: correlation,
    };
  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: runtime.WEB_ORIGIN,
      "x-request-id": correlation,
      "x-trace-id": correlation,
      "x-release-probe-timestamp": String(timestamp),
      "x-release-probe-nonce": nonce,
      "x-release-probe-signature": probeSignature(input, runtime.RELEASE_PROBE_SIGNING_KEY),
    },
    body: JSON.stringify({ release_id: releaseId, sample_id: correlation }),
  };
  return connectAddress
    ? requestViaPinnedAddress(
        baseUrl,
        "/api/v1/platform/operations/releases/write-probe",
        options,
        connectAddress,
      )
    : fetch(`${baseUrl}/api/v1/platform/operations/releases/write-probe`, {
        ...options,
        signal: AbortSignal.timeout(10_000),
      });
}

async function sendWriteProbeWithDeliveryRetry(
  baseUrl,
  runtime,
  releaseId,
  correlation,
  connectAddress = null,
) {
  let lastError;
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    try {
      const response = await sendWriteProbe(
        baseUrl,
        runtime,
        releaseId,
        correlation,
        connectAddress,
      );
      if (response.status !== 499) return response;
      lastError = fail(
        "release_write_probe_transport_aborted",
        "write probe transport closed before an upstream response",
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw (
    lastError ??
    fail("release_write_probe_delivery_failed", "write probe did not reach an upstream response")
  );
}

async function applyMigration(pool, releaseRoot, migrationName) {
  const migrationSql = await readFile(
      resolve(releaseRoot, "database/migrations", migrationName),
      "utf8",
    ),
    checksum = sha256(migrationSql.replace(/\r\n/g, "\n"));
  const [rows] = await pool.query("SELECT checksum FROM schema_migrations WHERE name=?", [
    migrationName,
  ]);
  const existing = rows[0];
  if (!existing) {
    for (const statement of migrationSql
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean))
      await pool.query(statement);
    await pool.query(
      "INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))",
      [migrationName, checksum],
    );
  } else if (existing.checksum !== checksum)
    throw fail("release_migration_drift", `M07-05 migration ${migrationName} checksum drifted`);
  return { name: migrationName, checksum };
}

async function writeProbeCount(pool, releaseId, buildSha) {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) sample_count FROM deployment_release_write_samples WHERE release_id=? AND build_sha=?",
    [releaseId, Buffer.from(buildSha, "hex")],
  );
  return Number(row?.sample_count ?? 0);
}

function writeProbeBreach(writes, durableWriteSamples) {
  if (writes.some((item) => item.status !== 202)) return "release_write_probe_rejected";
  if (durableWriteSamples !== writes.length) return "release_write_probe_persistence_mismatch";
  return null;
}

function breachFor(metrics, readCount, writeCount, minimumSamples, thresholds) {
  if (readCount < minimumSamples || writeCount < minimumSamples)
    return "insufficient_candidate_samples";
  if (
    ![metrics.errorRate, metrics.readP95, metrics.writeP95, metrics.asyncLag].every(Number.isFinite)
  )
    return "release_metric_missing";
  if (metrics.errorRate >= thresholds.errorRate) return "error_rate_threshold_exceeded";
  if (metrics.readP95 > thresholds.readP95) return "read_p95_threshold_exceeded";
  if (metrics.writeP95 > thresholds.writeP95) return "write_p95_threshold_exceeded";
  if (metrics.asyncLag > thresholds.asyncLag) return "async_lag_threshold_exceeded";
  return null;
}

if (argv.includes("--self-test")) {
  const records = parseTimingLines(
    '127.0.0.1 - - [time] "GET /api/v1/health/live HTTP/1.1" status=200 bytes=1 request_time=0.100 upstream_addr="127.0.0.1:4103" upstream_status="200"\n' +
      '127.0.0.1 - - [time] "POST /api/v1/platform/operations/releases/write-probe HTTP/1.1" status=202 bytes=1 request_time=0.200 upstream_addr="127.0.0.1:4103" upstream_status="202"\n' +
      '127.0.0.1 - - [time] "POST /api/v1/platform/operations/releases/write-probe HTTP/1.1" status=499 bytes=0 request_time=0.000 upstream_addr="127.0.0.1:4103" upstream_status="-"\n' +
      '127.0.0.1 - - [time] "GET /api/v1/health/live HTTP/1.1" status=500 bytes=1 request_time=9.000 upstream_addr="127.0.0.1:4101" upstream_status="500"',
    4103,
  );
  const reached = records.filter((item) => item.upstreamReached),
    transportAborts = records.filter((item) => !item.upstreamReached);
  const metrics = {
    errorRate: 0,
    readP95: percentile(
      reached.filter((item) => item.method === "GET").map((item) => item.milliseconds),
      0.95,
    ),
    writeP95: percentile(
      reached.filter((item) => item.method === "POST").map((item) => item.milliseconds),
      0.95,
    ),
    asyncLag: 2,
  };
  const thresholds = { errorRate: 1, readP95: 300, writeP95: 600, asyncLag: 60 };
  if (
    records.length !== 3 ||
    reached.length !== 2 ||
    transportAborts.length !== 1 ||
    transportAborts[0].upstreamReached !== false ||
    reached[1].path !== "/api/v1/platform/operations/releases/write-probe" ||
    metrics.readP95 !== 100 ||
    metrics.writeP95 !== 200 ||
    writeProbeBreach([reached[1]], 1) !== null ||
    writeProbeBreach([{ ...reached[1], status: 401 }], 0) !== "release_write_probe_rejected" ||
    writeProbeBreach([reached[1]], 0) !== "release_write_probe_persistence_mismatch" ||
    breachFor(metrics, 1, 1, 1, thresholds) !== null ||
    breachFor(metrics, 0, 1, 1, thresholds) !== "insufficient_candidate_samples" ||
    breachFor({ ...metrics, errorRate: 1 }, 1, 1, 1, thresholds) !==
      "error_rate_threshold_exceeded" ||
    splitConfig(0, 4101, 4103).includes(":4103") ||
    !siteConfig(
      "server { location /api/ { proxy_pass http://127.0.0.1:4101; }\n}",
      "/www/wwwlogs/test.log",
    ).includes("$scoutops_release_upstream")
  )
    throw fail(
      "release_self_test_failed",
      "release parser, write persistence, transport scope, thresholds, stable fallback or Nginx rendering drifted",
    );
  process.stdout.write(
    `${JSON.stringify({ module: "M07-05", status: "passed", upstream_parser: "passed", fail_closed_thresholds: "passed", stable_fallback: "passed", request_id: requestId, trace_id: traceId })}\n`,
  );
  process.exit(0);
}

async function fetchIdentity(baseUrl) {
  const response = await fetch(`${baseUrl}/api/v1/health/version`, {
    headers: {
      accept: "application/json",
      "x-request-id": randomUUID(),
      "x-trace-id": randomUUID(),
    },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null);
  if (
    !response.ok ||
    !body?.data?.build_sha ||
    !/^[a-f0-9]{64}$/.test(body?.data?.config_fingerprint ?? "")
  )
    throw fail(
      "candidate_identity_invalid",
      "candidate version health is unavailable or incomplete",
    );
  return body.data;
}

async function writeGate(pool, releaseId, kind, status, values = {}) {
  const id = randomUUID(),
    now = new Date();
  await pool.query(
    "INSERT INTO deployment_release_gates(id,release_id,gate_kind,status,traffic_percent," +
      "observe_seconds,sample_count,error_rate_percent,read_p95_ms,write_p95_ms," +
      "async_lag_seconds,failure_code,started_at,finished_at,request_id,trace_id,metadata) " +
      "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status)," +
      "traffic_percent=VALUES(traffic_percent),observe_seconds=VALUES(observe_seconds)," +
      "sample_count=VALUES(sample_count),error_rate_percent=VALUES(error_rate_percent)," +
      "read_p95_ms=VALUES(read_p95_ms),write_p95_ms=VALUES(write_p95_ms)," +
      "async_lag_seconds=VALUES(async_lag_seconds),failure_code=VALUES(failure_code)," +
      "started_at=VALUES(started_at),finished_at=VALUES(finished_at)," +
      "request_id=VALUES(request_id),trace_id=VALUES(trace_id),metadata=VALUES(metadata)",
    [
      id,
      releaseId,
      kind,
      status,
      values.percent ?? 0,
      values.observeSeconds ?? 0,
      values.sampleCount ?? 0,
      values.errorRate ?? null,
      values.readP95 ?? null,
      values.writeP95 ?? null,
      values.asyncLag ?? null,
      values.failureCode ?? null,
      values.startedAt ?? now,
      ["passed", "failed", "stopped", "rolled_back"].includes(status) ? now : null,
      requestId,
      traceId,
      JSON.stringify(values.metadata ?? {}),
    ],
  );
  const [[gate]] = await pool.query(
    "SELECT id FROM deployment_release_gates WHERE release_id=? AND gate_kind=?",
    [releaseId, kind],
  );
  return gate.id;
}

async function event(pool, releaseId, gateId, type, reasonCode = null, metadata = {}) {
  await pool.query(
    "INSERT INTO deployment_release_gate_events(id,release_id,gate_id,event_type,actor_type,actor_id,reason_code,request_id,trace_id,occurred_at,metadata) VALUES(?,?,?,?, 'baota_task',NULL,?,?,?,?,?)",
    [
      randomUUID(),
      releaseId,
      gateId,
      type,
      reasonCode,
      requestId,
      traceId,
      new Date(),
      JSON.stringify(metadata),
    ],
  );
}

let pool,
  lockConnection,
  lockName = "",
  lockAcquired = false,
  runtime,
  originalSite = "",
  sitePath,
  splitPath,
  nginxBin = "",
  stablePort = 0,
  candidatePort = 0,
  nginxConfigured = false;
try {
  const envFile = arg("--env-file");
  if (!argv.includes("--run") || !envFile)
    throw fail("release_arguments_invalid", "use --run --env-file <Baota restricted env file>");
  runtime = { ...process.env, ...parseEnv(await readFile(envFile, "utf8")) };
  const production = runtime.NODE_ENV === "production";
  const observeSeconds = Number(runtime.RELEASE_CANARY_OBSERVE_SECONDS ?? 1800),
    intervalSeconds = Number(runtime.RELEASE_SAMPLE_INTERVAL_SECONDS ?? 1),
    minimumSamples = Number(runtime.RELEASE_MINIMUM_CANDIDATE_SAMPLES ?? 5);
  if (!Number.isInteger(observeSeconds) || observeSeconds < (production ? 1800 : 1))
    throw fail(
      "release_observation_invalid",
      production
        ? "production observation must be at least 1800 seconds"
        : "observation must be positive",
    );
  if (
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < 1 ||
    intervalSeconds > 60 ||
    !Number.isInteger(minimumSamples) ||
    minimumSamples < 1
  )
    throw fail("release_sampling_invalid", "sampling interval or minimum sample count is invalid");
  const webOrigin = runtime.WEB_ORIGIN;
  if (!/^https:\/\/[^/]+$/.test(webOrigin ?? ""))
    throw fail("release_web_origin_invalid", "WEB_ORIGIN must be the production HTTPS origin");
  if (String(runtime.RELEASE_PROBE_SIGNING_KEY ?? "").length < 32)
    throw fail(
      "release_probe_signing_key_invalid",
      "RELEASE_PROBE_SIGNING_KEY must contain at least 32 characters",
    );
  stablePort = Number(runtime.RELEASE_STABLE_API_PORT ?? 4101);
  candidatePort = Number(runtime.RELEASE_CANDIDATE_API_PORT ?? 4103);
  if (
    stablePort === candidatePort ||
    ![stablePort, candidatePort].every(
      (port) => Number.isInteger(port) && port >= 1024 && port <= 65535,
    )
  )
    throw fail("release_port_invalid", "stable and candidate private ports must be different");
  sitePath = absolute(runtime.RELEASE_NGINX_SITE_CONFIG, "RELEASE_NGINX_SITE_CONFIG");
  splitPath = absolute(runtime.RELEASE_NGINX_SPLIT_CONFIG, "RELEASE_NGINX_SPLIT_CONFIG");
  const releaseRoot = absolute(runtime.RELEASE_ROOT, "RELEASE_ROOT"),
    timingLog = absolute(runtime.RELEASE_NGINX_TIMING_LOG, "RELEASE_NGINX_TIMING_LOG"),
    evidencePath = absolute(
      runtime.RELEASE_PRODUCTION_EVIDENCE_FILE,
      "RELEASE_PRODUCTION_EVIDENCE_FILE",
    );
  if (
    !releaseRoot.startsWith("/www/wwwroot/") ||
    !sitePath.startsWith("/www/server/panel/vhost/nginx/") ||
    !splitPath.startsWith("/www/server/panel/vhost/nginx/") ||
    !timingLog.startsWith("/www/wwwlogs/") ||
    !evidencePath.startsWith(`${releaseRoot}/.artifacts/verification/`)
  )
    throw fail(
      "release_baota_path_invalid",
      "release, Nginx, log and evidence paths must remain under Baota-managed roots",
    );
  pool = mysql.createPool({
    host: runtime.DB_HOST,
    port: Number(runtime.DB_PORT),
    user: runtime.DB_USER,
    password: runtime.DB_PASSWORD,
    database: runtime.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    timezone: "Z",
  });
  await pool.query("SELECT 1");
  lockName = runtime.RELEASE_ROLLOUT_LOCK_NAME ?? "scoutops:m07-05:release-rollout";
  if (!/^[a-z0-9:_-]{1,64}$/.test(lockName))
    throw fail(
      "release_rollout_lock_name_invalid",
      "RELEASE_ROLLOUT_LOCK_NAME must be a stable lowercase MySQL lock name",
    );
  lockConnection = await pool.getConnection();
  const [[lockRow]] = await lockConnection.query("SELECT GET_LOCK(?, 0) acquired", [lockName]);
  if (Number(lockRow?.acquired) !== 1)
    throw fail(
      "release_rollout_lock_busy",
      "another BaoTa release rollout already owns the MySQL session named lock",
    );
  lockAcquired = true;
  const [[durabilityRow]] = await pool.query(
    "SELECT @@innodb_flush_log_at_trx_commit innodb_flush_log_at_trx_commit,@@sync_binlog sync_binlog,@@global.binlog_format binlog_format,@@global.innodb_buffer_pool_size innodb_buffer_pool_size,@@global.innodb_buffer_pool_instances innodb_buffer_pool_instances,@@global.innodb_io_capacity innodb_io_capacity,@@global.innodb_io_capacity_max innodb_io_capacity_max,@@global.innodb_flush_neighbors innodb_flush_neighbors,@@global.innodb_flush_method innodb_flush_method",
  );
  const [masterStatusRows] = await pool.query("SHOW MASTER STATUS");
  const ignoredDatabases = String(masterStatusRows[0]?.Binlog_Ignore_DB ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const mysqlDurability = {
    innodbFlushLogAtTrxCommit: Number(durabilityRow?.innodb_flush_log_at_trx_commit),
    syncBinlog: Number(durabilityRow?.sync_binlog),
    binlogFormat: String(durabilityRow?.binlog_format ?? "").toUpperCase(),
    productScoutBinlogExcluded: ignoredDatabases.includes(runtime.DB_NAME),
    osCrashDataLossWindowSeconds: 1,
  };
  if (
    mysqlDurability.innodbFlushLogAtTrxCommit !== 2 ||
    mysqlDurability.syncBinlog !== 1 ||
    mysqlDurability.binlogFormat !== "ROW" ||
    mysqlDurability.productScoutBinlogExcluded !== false ||
    runtime.DB_NAME !== "product_scout"
  )
    throw fail(
      "release_mysql_durability_contract_invalid",
      "MySQL must use the approved one-second redo flush window and include product_scout in ROW binlog",
    );
  const mysqlResourceProfile = {
    innodbBufferPoolBytes: Number(durabilityRow?.innodb_buffer_pool_size),
    innodbBufferPoolInstances: Number(durabilityRow?.innodb_buffer_pool_instances),
    innodbIoCapacity: Number(durabilityRow?.innodb_io_capacity),
    innodbIoCapacityMax: Number(durabilityRow?.innodb_io_capacity_max),
    innodbFlushNeighbors: Number(durabilityRow?.innodb_flush_neighbors),
    innodbFlushMethod: String(durabilityRow?.innodb_flush_method ?? "").toUpperCase(),
  };
  if (
    mysqlResourceProfile.innodbBufferPoolBytes !== 4294967296 ||
    mysqlResourceProfile.innodbBufferPoolInstances !== 4 ||
    mysqlResourceProfile.innodbIoCapacity !== 1000 ||
    mysqlResourceProfile.innodbIoCapacityMax !== 4000 ||
    mysqlResourceProfile.innodbFlushNeighbors !== 0 ||
    mysqlResourceProfile.innodbFlushMethod !== "O_DIRECT"
  )
    throw fail(
      "release_mysql_resource_profile_invalid",
      "MySQL runtime resource profile must match the BaoTa-approved M07-05 single-host configuration",
    );
  const candidateBase = (
    runtime.RELEASE_CANDIDATE_BASE_URL ?? `http://127.0.0.1:${candidatePort}`
  ).replace(/\/$/, "");
  const identity = await fetchIdentity(candidateBase);
  if (identity.build_sha !== runtime.BUILD_SHA)
    throw fail(
      "candidate_build_mismatch",
      "candidate build_sha differs from the release task BUILD_SHA",
    );
  const migrationStarted = new Date(),
    migrations = [];
  for (const name of [
    "0026_release_rollout_m07_05.up.sql",
    "0027_release_write_probe_m07_05.up.sql",
    "0027a_release_rollout_attempts_m07_05.up.sql",
    "0032_mysql_resilience_m08_03.up.sql",
    "0032a_compact_release_write_probe_m08_03.up.sql",
    "0033_file_resilience_m08_04.up.sql",
    "0034_crawler_scheduler_m08_05.up.sql",
    "0035_capacity_boundary_m08_06.up.sql",
  ])
    migrations.push(await applyMigration(pool, releaseRoot, name));
  const migrationName = migrations.at(-1).name;
  const releaseId = randomUUID(),
    now = new Date();
  const effectiveReleaseId = releaseId;
  await pool.query(
    "INSERT INTO deployment_releases(id,stage,app_version,build_sha,config_fingerprint,migration_version,status,approved_by,request_id,trace_id,started_at,finished_at,created_at,updated_at) VALUES(?,'S0',?,?,?,?,'deploying',NULL,?,?,?,?,?,?)",
    [
      effectiveReleaseId,
      runtime.APP_VERSION,
      runtime.BUILD_SHA,
      identity.config_fingerprint,
      migrationName,
      requestId,
      traceId,
      now,
      null,
      now,
      now,
    ],
  );
  const warmupCorrelation = randomUUID(),
    warmupResponse = await sendWriteProbeWithDeliveryRetry(
      candidateBase,
      runtime,
      effectiveReleaseId,
      warmupCorrelation,
    );
  if (warmupResponse.status !== 202)
    throw fail(
      "candidate_write_warmup_failed",
      "candidate signed release write probe did not return accepted",
    );
  const preflightGate = await writeGate(pool, effectiveReleaseId, "preflight", "passed", {
    metadata: {
      candidate_port: candidatePort,
      identity_verified: true,
      manager: "baota",
      mysql_durability: mysqlDurability,
      mysql_resource_profile: mysqlResourceProfile,
    },
  });
  await event(pool, effectiveReleaseId, preflightGate, "passed");
  const [backupRows] = await pool.query(
    "SELECT id,finished_at FROM backup_recovery_runs WHERE run_type='restore_drill' AND status='verified' AND isolated=1 AND encrypted=1 AND integrity_verified=1 ORDER BY finished_at DESC LIMIT 1",
  );
  const backup = backupRows[0];
  if (!backup) throw fail("release_backup_gate_missing", "no verified M07-04 restore drill exists");
  const backupGate = await writeGate(pool, effectiveReleaseId, "backup", "passed", {
    metadata: { backup_run_id: backup.id, same_host_scope: true },
  });
  await event(pool, effectiveReleaseId, backupGate, "passed");
  const migrationGate = await writeGate(pool, effectiveReleaseId, "migration", "passed", {
    startedAt: migrationStarted,
    metadata: { migration: migrationName, migrations, timing_schema: 2 },
  });
  await event(pool, effectiveReleaseId, migrationGate, "passed");
  originalSite = await readFile(sitePath, "utf8");
  const rolloutSite = siteConfig(originalSite, timingLog);
  await writeFile(sitePath, rolloutSite, { mode: 0o600 });
  nginxBin = runtime.RELEASE_NGINX_BIN ?? "/www/server/nginx/sbin/nginx";
  nginxConfigured = true;
  const publicBase = (runtime.RELEASE_PUBLIC_BASE_URL ?? "https://midouai.mozhiz.cn").replace(
      /\/$/,
      "",
    ),
    publicConnectAddress = runtime.RELEASE_PUBLIC_CONNECT_ADDRESS ?? "127.0.0.1";
  let publicTarget;
  try {
    publicTarget = new URL(publicBase);
  } catch {
    throw fail(
      "release_public_origin_invalid",
      "RELEASE_PUBLIC_BASE_URL must be a valid HTTPS origin",
    );
  }
  if (
    publicTarget.origin !== new URL(webOrigin).origin ||
    publicTarget.protocol !== "https:" ||
    publicTarget.pathname !== "/" ||
    publicTarget.search ||
    publicTarget.hash ||
    publicConnectAddress !== "127.0.0.1"
  )
    throw fail(
      "release_public_origin_invalid",
      "public probes must preserve the production HTTPS origin and connect only to the same-host Baota Nginx loopback",
    );
  const thresholds = {
    errorRate: Number(runtime.RELEASE_5XX_STOP_BASIS_POINTS ?? 100) / 100,
    readP95: Number(runtime.RELEASE_READ_P95_STOP_MS ?? 300),
    writeP95: Number(runtime.RELEASE_WRITE_P95_STOP_MS ?? 600),
    asyncLag: Number(runtime.RELEASE_ASYNC_LAG_STOP_SECONDS ?? 60),
  };
  const gates = [];
  for (const percent of [5, 25, 100]) {
    await writeFile(splitPath, splitConfig(percent, stablePort, candidatePort), { mode: 0o600 });
    await run(nginxBin, ["-t"]);
    await run(nginxBin, ["-s", "reload"]);
    const gateStarted = new Date(),
      startSize = await stat(timingLog)
        .then((value) => value.size)
        .catch(() => 0),
      writeProbeBaseline = await writeProbeCount(pool, effectiveReleaseId, identity.build_sha),
      lagSamples = [];
    let writeDeliveryFailures = 0;
    const runningGate = await writeGate(pool, effectiveReleaseId, `canary_${percent}`, "running", {
      percent,
      startedAt: gateStarted,
      metadata: { routing_key: "$request_id", measurement: "baota_nginx_upstream_timing_log" },
    });
    await event(pool, effectiveReleaseId, runningGate, "started", null, { percent });
    while ((Date.now() - gateStarted.getTime()) / 1000 < observeSeconds) {
      const correlation = randomUUID();
      const common = { "x-request-id": correlation, "x-trace-id": correlation };
      const settled = await Promise.allSettled([
        requestViaPinnedAddress(
          publicBase,
          "/api/v1/health/live",
          { headers: { ...common, accept: "application/json" } },
          publicConnectAddress,
        ),
        sendWriteProbeWithDeliveryRetry(
          publicBase,
          runtime,
          effectiveReleaseId,
          correlation,
          publicConnectAddress,
        ),
      ]);
      if (settled[1].status === "rejected") writeDeliveryFailures += 1;
      lagSamples.push(await asyncLagSeconds(pool));
      await sleep(intervalSeconds * 1000);
    }
    const log = await readFrom(timingLog, startSize).catch(() => ""),
      parsedRecords = parseTimingLines(log, candidatePort),
      transportAborts = parsedRecords.filter((item) => !item.upstreamReached),
      records = parsedRecords.filter((item) => item.upstreamReached);
    const reads = records.filter(
        (item) => ["GET", "HEAD"].includes(item.method) && item.path === "/api/v1/health/live",
      ),
      writes = records.filter(
        (item) =>
          !["GET", "HEAD"].includes(item.method) &&
          item.path === "/api/v1/platform/operations/releases/write-probe",
      );
    const durableWriteSamples =
      (await writeProbeCount(pool, effectiveReleaseId, identity.build_sha)) - writeProbeBaseline;
    const metrics = {
      percent,
      observeSeconds: Math.floor((Date.now() - gateStarted.getTime()) / 1000),
      sampleCount: records.length,
      errorRate: records.length
        ? (records.filter((item) => item.status >= 500).length * 100) / records.length
        : null,
      readP95: percentile(
        reads.map((item) => item.milliseconds),
        0.95,
      ),
      writeP95: percentile(
        writes.map((item) => item.milliseconds),
        0.95,
      ),
      asyncLag: Math.max(0, ...lagSamples),
    };
    const breach =
      writeDeliveryFailures > 0
        ? "release_write_probe_delivery_failed"
        : (writeProbeBreach(writes, durableWriteSamples) ??
          breachFor(metrics, reads.length, durableWriteSamples, minimumSamples, thresholds));
    if (breach) {
      await writeGate(pool, effectiveReleaseId, `canary_${percent}`, "failed", {
        ...metrics,
        failureCode: breach,
        startedAt: gateStarted,
        metadata: {
          read_samples: reads.length,
          write_samples: writes.length,
          durable_write_samples: durableWriteSamples,
          pre_upstream_transport_aborts: transportAborts.length,
          write_delivery_failures: writeDeliveryFailures,
        },
      });
      const rollbackStarted = new Date();
      await writeFile(splitPath, splitConfig(0, stablePort, candidatePort), { mode: 0o600 });
      await run(nginxBin, ["-t"]);
      await run(nginxBin, ["-s", "reload"]);
      const stopped = await writeGate(pool, effectiveReleaseId, "automatic_stop", "stopped", {
        percent,
        failureCode: breach,
        metadata: metrics,
      });
      await event(pool, effectiveReleaseId, stopped, "automatic_stop", breach, metrics);
      const rollback = await writeGate(pool, effectiveReleaseId, "rollback", "rolled_back", {
        startedAt: rollbackStarted,
        metadata: { stable_port: stablePort, candidate_port: candidatePort, timing_schema: 2 },
      });
      await event(pool, effectiveReleaseId, rollback, "rolled_back", breach);
      await pool.query(
        "UPDATE deployment_releases SET status='rolled_back',finished_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?",
        [effectiveReleaseId],
      );
      throw fail(
        breach,
        `canary ${percent}% failed and traffic was rolled back to the stable Baota project`,
      );
    }
    await writeGate(pool, effectiveReleaseId, `canary_${percent}`, "passed", {
      ...metrics,
      startedAt: gateStarted,
      metadata: {
        read_samples: reads.length,
        write_samples: writes.length,
        durable_write_samples: durableWriteSamples,
        pre_upstream_transport_aborts: transportAborts.length,
        write_delivery_failures: writeDeliveryFailures,
      },
    });
    await event(pool, effectiveReleaseId, runningGate, "passed", null, {
      ...metrics,
      durableWriteSamples,
      preUpstreamTransportAborts: transportAborts.length,
      writeDeliveryFailures,
    });
    gates.push({
      ...metrics,
      readSamples: reads.length,
      writeSamples: writes.length,
      durableWriteSamples,
      preUpstreamTransportAborts: transportAborts.length,
      writeDeliveryFailures,
    });
  }
  await pool.query(
    "UPDATE deployment_releases SET status='healthy',finished_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?",
    [effectiveReleaseId],
  );
  const evidence = {
    schemaVersion: 6,
    module: "M07-05",
    manager: "baota",
    topology: "single_host_stable_and_candidate",
    backupServerUsed: false,
    releaseId: effectiveReleaseId,
    buildSha: runtime.BUILD_SHA,
    appVersion: runtime.APP_VERSION,
    configFingerprint: identity.config_fingerprint,
    migrationVersion: migrationName,
    concurrencyProtection: {
      taskTrigger: "manual_only",
      lock: "mysql_session_named_lock",
      lockName,
      lockTimeoutSeconds: 0,
      acquired: true,
      attemptHistoryPreserved: true,
    },
    publicProbe: {
      origin: publicTarget.origin,
      connectAddress: publicConnectAddress,
      tlsHostnamePreserved: true,
      manager: "baota_nginx",
    },
    mysqlDurability,
    mysqlResourceProfile,
    writeProbe: {
      path: "/api/v1/platform/operations/releases/write-probe",
      signed: true,
      canonicalFields: ["timestamp", "nonce", "release_id", "sample_id"],
      proxyRequestIdsExcluded: true,
      candidatePersistenceMatched: true,
      durableStatementsPerSample: 1,
      preUpstreamTransportRetryAttempts: 1,
      candidateResponsesRemainFailClosed: true,
    },
    percentages: [5, 25, 100],
    minimumObservationSeconds: observeSeconds,
    sampleIntervalSeconds: intervalSeconds,
    gates,
    automaticStopArmed: true,
    rollbackTarget: { sameHost: true, stablePort },
    requestId,
    traceId,
    capturedAt: new Date().toISOString(),
  };
  await mkdir(dirname(evidencePath), { recursive: true, mode: 0o700 });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} catch (error) {
  if (nginxConfigured && splitPath && stablePort && candidatePort) {
    try {
      await writeFile(splitPath, splitConfig(0, stablePort, candidatePort), { mode: 0o600 });
      await run(nginxBin, ["-t"]);
      await run(nginxBin, ["-s", "reload"]);
    } catch {}
  }
  process.stderr.write(
    `${JSON.stringify({ module: "M07-05", status: "blocked", code: error.code ?? "release_rollout_failed", message: error.message, request_id: requestId, trace_id: traceId })}\n`,
  );
  process.exitCode = 2;
} finally {
  if (lockConnection) {
    if (lockAcquired) {
      try {
        await lockConnection.query("SELECT RELEASE_LOCK(?) released", [lockName]);
      } catch {}
    }
    lockConnection.release();
  }
  if (pool) await pool.end();
}
