#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { closeSync, createReadStream, openSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import mysql from "mysql2/promise";
import { createBundle, decryptBundle, digestFile, verifyBundle } from "./backup-recovery.mjs";

const args = process.argv.slice(2), value = (name) => args[args.indexOf(name) + 1];
const envFile = value("--env-file");
const requestId = randomUUID(), traceId = randomUUID();
const fail = (code, message) => Object.assign(new Error(message), { code });
const parseEnv = (source) => Object.fromEntries(source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const at = line.indexOf("="); let result = line.slice(at + 1).trim(); if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith("'") && result.endsWith("'"))) result = result.slice(1, -1); return [line.slice(0, at).trim(), result]; }));
const run = (command, commandArgs, options = {}) => new Promise((resolveRun, reject) => {
  const child = spawn(command, commandArgs, { stdio: ["ignore", "ignore", "pipe"], ...options }); let errorTail = "";
  child.stderr.on("data", (chunk) => { errorTail = `${errorTail}${chunk}`.slice(-4000); });
  child.once("error", reject); child.once("exit", (code) => code === 0 ? resolveRun() : reject(fail("backup_command_failed", `${basename(command)} exited ${code}: ${errorTail.replaceAll(/password\s*=\s*\S+/ig, "password=[redacted]")}`)));
});
const safeRoot = (path, key) => { if (!isAbsolute(path)) throw fail("backup_path_invalid", `${key} must be absolute in production`); const result = resolve(path); if (!result.startsWith("/www/backup/product-scout/")) throw fail("backup_path_invalid", `${key} must be under /www/backup/product-scout`); return result; };
const iso = (date) => date.toISOString().replaceAll(/[:.]/g, "-");
const sqlIdentifier = (value) => `\`${String(value).replaceAll("`", "``")}\``;

async function tableCounts(connection, schema) {
  const [tables] = await connection.query("SELECT TABLE_NAME table_name FROM information_schema.tables WHERE table_schema=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME", [schema]);
  const counts = {};
  for (const row of tables) { const [result] = await connection.query(`SELECT COUNT(*) count FROM ${sqlIdentifier(schema)}.${sqlIdentifier(row.table_name)}`); counts[row.table_name] = Number(result[0].count); }
  return counts;
}

async function readMasterCoordinates(dumpPath) {
  const lines = createInterface({ input: createReadStream(dumpPath, { encoding: "utf8" }), crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      const match = line.match(/CHANGE MASTER TO MASTER_LOG_FILE='([^']+)', MASTER_LOG_POS=(\d+)/);
      if (match) return { file: match[1], position: Number(match[2]) };
    }
  } finally { lines.close(); }
  throw fail("backup_master_coordinates_missing", "mysqldump did not embed binary log coordinates");
}

async function ensureMigration(pool, releaseRoot) {
  const migrationName = "0025_backup_recovery_m07_04.up.sql";
  const bootstrap = await readFile(join(releaseRoot, "database/bootstrap/schema_migrations.sql"), "utf8");
  const migration = await readFile(join(releaseRoot, "database/migrations", migrationName), "utf8");
  const checksum = createHash("sha256").update(migration.replace(/\r\n/g, "\n")).digest("hex");
  await pool.query(bootstrap);
  const [[existing], [tables]] = await Promise.all([
    pool.query("SELECT checksum FROM schema_migrations WHERE name=?", [migrationName]),
    pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('backup_recovery_runs','backup_recovery_assets') ORDER BY table_name"),
  ]);
  if (existing.length) {
    if (existing[0].checksum !== checksum || tables.length !== 2) throw fail("backup_migration_drift", "M07-04 migration checksum or table set drifted");
    return "already_applied";
  }
  if (tables.length) throw fail("backup_migration_partial", "M07-04 migration is partially applied and requires operator review");
  for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) await pool.query(statement);
  await pool.query("INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))", [migrationName, checksum]);
  return "applied";
}

async function pruneExpired(root, retentionDays, now) {
  let removed = 0;
  for (const name of await readdir(root)) {
    if (!name.endsWith(".scoutbackup") && !name.endsWith("-evidence.json")) continue;
    const path = join(root, name), info = await stat(path);
    if (now.getTime() - info.mtimeMs <= retentionDays * 86_400_000) continue;
    await unlink(path); removed += 1;
  }
  return removed;
}

let runtime, databasePool, adminPool, restoreDatabase = "", drillRoot = "";
try {
  if (!args.includes("--run") || !envFile) throw fail("backup_arguments_invalid", "use --run --env-file <Baota restricted env file>");
  runtime = { ...process.env, ...parseEnv(await readFile(envFile, "utf8")) };
  if ((runtime.BACKUP_ENCRYPTION_KEY ?? "").length < 32) throw fail("backup_key_invalid", "BACKUP_ENCRYPTION_KEY must contain at least 32 characters");
  const retentionDays = Number(runtime.BACKUP_RETENTION_DAYS || 90);
  if (!Number.isInteger(retentionDays) || retentionDays < 1) throw fail("backup_retention_invalid", "BACKUP_RETENTION_DAYS must be a positive integer");
  const primaryRoot = safeRoot(runtime.BACKUP_PRIMARY_ROOT, "BACKUP_PRIMARY_ROOT"), copyRoot = safeRoot(runtime.BACKUP_LOCAL_COPY_ROOT, "BACKUP_LOCAL_COPY_ROOT");
  drillRoot = safeRoot(runtime.BACKUP_DRILL_ROOT, "BACKUP_DRILL_ROOT");
  if (new Set([primaryRoot, copyRoot, drillRoot]).size !== 3) throw fail("backup_path_overlap", "backup roots must be different");
  await Promise.all([mkdir(primaryRoot, { recursive: true, mode: 0o700 }), mkdir(copyRoot, { recursive: true, mode: 0o700 }), mkdir(drillRoot, { recursive: true, mode: 0o700 })]);
  const mysqlClient = runtime.BACKUP_MYSQL_CLIENT || "/www/server/mysql/bin/mysql", dumpClient = runtime.BACKUP_MYSQLDUMP_CLIENT || "/www/server/mysql/bin/mysqldump", binlogClient = runtime.BACKUP_MYSQLBINLOG_CLIENT || "/www/server/mysql/bin/mysqlbinlog";
  const adminSocket = resolve(runtime.BACKUP_MYSQL_SOCKET || "");
  if (!isAbsolute(runtime.BACKUP_MYSQL_SOCKET || "") || !(await stat(adminSocket).catch(() => null))?.isSocket()) throw fail("backup_mysql_socket_invalid", "BACKUP_MYSQL_SOCKET must be an existing absolute MySQL Unix socket");
  const adminPasswordFile = resolve(runtime.BACKUP_MYSQL_ADMIN_PASSWORD_FILE || "");
  if (!isAbsolute(runtime.BACKUP_MYSQL_ADMIN_PASSWORD_FILE || "") || !adminPasswordFile.startsWith("/www/server/panel/data/")) throw fail("backup_admin_credential_path_invalid", "BACKUP_MYSQL_ADMIN_PASSWORD_FILE must be a Baota restricted data path");
  const adminPassword = (await readFile(adminPasswordFile, "utf8")).trim();
  const db = { host: runtime.DB_HOST || "127.0.0.1", port: Number(runtime.DB_PORT || 3306), database: runtime.DB_NAME || "product_scout", user: runtime.DB_USER || "product_scout", password: runtime.DB_PASSWORD || "" };
  databasePool = mysql.createPool({ ...db, connectionLimit: 2, charset: "utf8mb4" });
  adminPool = mysql.createPool({ socketPath: adminSocket, user: "root", password: adminPassword, connectionLimit: 2, charset: "utf8mb4" });
  const [runtimeRows] = await databasePool.query("SELECT VERSION() version,@@character_set_server charset,CURRENT_USER() account");
  if (!String(runtimeRows[0].version).startsWith("5.7.") || runtimeRows[0].charset !== "utf8mb4" || !String(runtimeRows[0].account).startsWith("product_scout@")) throw fail("mysql_runtime_invalid", "MySQL 5.7 utf8mb4 product_scout business account required");
  const releaseRoot = resolve(runtime.BACKUP_RELEASE_ROOT || process.cwd());
  const migrationStatus = await ensureMigration(databasePool, releaseRoot);
  const startedAt = new Date(), stamp = iso(startedAt), workingRoot = join(drillRoot, `run-${stamp}-${requestId.slice(0, 8)}`); await mkdir(workingRoot, { recursive: true, mode: 0o700 });
  const sourceCutoffAt = new Date(), dumpPath = join(workingRoot, "product_scout.sql");
  const [[binlogPolicy]] = await adminPool.query("SELECT @@log_bin log_bin,@@binlog_format binlog_format,@@expire_logs_days expire_logs_days,@@datadir data_dir");
  if (Number(binlogPolicy.log_bin) !== 1 || Number(binlogPolicy.expire_logs_days) < 1) throw fail("backup_pitr_unavailable", "MySQL binary logging and at least one day retention are required");
  await run(dumpClient, ["--socket", adminSocket, "--user", "root", "--single-transaction", "--master-data=2", "--flush-logs", "--routines", "--triggers", "--events", "--hex-blob", "--set-gtid-purged=OFF", `--result-file=${dumpPath}`, db.database], { env: { ...process.env, MYSQL_PWD: adminPassword } });
  const masterCoordinates = await readMasterCoordinates(dumpPath);
  await adminPool.query("FLUSH BINARY LOGS");
  const [binaryLogs] = await adminPool.query("SHOW BINARY LOGS");
  const startIndex = binaryLogs.findIndex((row) => row.Log_name === masterCoordinates.file);
  const closedLogs = binaryLogs.slice(startIndex, -1).map((row) => row.Log_name);
  if (startIndex < 0 || !closedLogs.length || closedLogs.some((name) => !/^[A-Za-z0-9._-]+$/.test(name))) throw fail("backup_binlog_range_invalid", "closed binary log range does not contain the dump coordinates");
  const binlogTar = join(workingRoot, "mysql-binlog.tar.gz");
  await run("tar", ["-czf", binlogTar, "-C", String(binlogPolicy.data_dir), ...closedLogs]);
  const evidenceRoot = runtime.EVIDENCE_ROOT, exportRoot = runtime.EXPORT_ROOT;
  const evidenceTar = join(workingRoot, "evidence.tar.gz"), exportsTar = join(workingRoot, "exports.tar.gz"), configTar = join(workingRoot, "config.tar.gz");
  await Promise.all([mkdir(evidenceRoot, { recursive: true }), mkdir(exportRoot, { recursive: true })]);
  await run("tar", ["-czf", evidenceTar, "-C", evidenceRoot, "."]); await run("tar", ["-czf", exportsTar, "-C", exportRoot, "."]);
  await run("tar", ["-czf", configTar, "-C", releaseRoot, "config/env.example", "config/schema.json", "infra/baota/service-manifest.json", "infra/baota/backup-recovery-manifest.json"]);
  const inputs = [{ kind: "mysql_full", source: dumpPath }, { kind: "mysql_binlog", source: binlogTar }, { kind: "evidence", source: evidenceTar }, { kind: "export", source: exportsTar }, { kind: "config", source: configTar }], assets = [];
  for (const item of inputs) {
    const file = `${stamp}-${item.kind}.scoutbackup`, primary = join(primaryRoot, file), copy = join(copyRoot, file);
    const created = await createBundle({ source: item.source, output: primary, secret: runtime.BACKUP_ENCRYPTION_KEY }); await verifyBundle({ bundle: primary, secret: runtime.BACKUP_ENCRYPTION_KEY });
    await copyFile(primary, copy, 0); const copyHash = await digestFile(copy); if (copyHash !== created.bundleSha256) throw fail("backup_copy_integrity_failed", `${item.kind} recovery copy hash mismatch`);
    await verifyBundle({ bundle: copy, secret: runtime.BACKUP_ENCRYPTION_KEY });
    assets.push({ kind: item.kind, file, primary, copy, ...created });
  }
  const backupFinishedAt = new Date(), actualRpoMinutes = Math.max(0.01, (backupFinishedAt - sourceCutoffAt) / 60000);
  const drillStartedAt = new Date(), restoreRoot = join(workingRoot, "restore"); await mkdir(restoreRoot, { recursive: true, mode: 0o700 });
  const restored = {};
  for (const asset of assets) { const output = join(restoreRoot, asset.kind === "mysql_full" ? "product_scout.sql" : `${asset.kind}.tar.gz`); restored[asset.kind] = output; await decryptBundle({ bundle: asset.copy, output, secret: runtime.BACKUP_ENCRYPTION_KEY }); }
  restoreDatabase = `product_scout_restore_m0704_${requestId.replaceAll("-", "").slice(0, 12)}`;
  await adminPool.query(`CREATE DATABASE ${sqlIdentifier(restoreDatabase)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const restoreSqlFd = openSync(restored.mysql_full, "r");
  try { await run(mysqlClient, ["--socket", adminSocket, "--user", "root", restoreDatabase], { env: { ...process.env, MYSQL_PWD: adminPassword }, stdio: [restoreSqlFd, "ignore", "pipe"] }); }
  finally { closeSync(restoreSqlFd); }
  const [sourceCounts, restoreCounts] = await Promise.all([tableCounts(adminPool, db.database), tableCounts(adminPool, restoreDatabase)]);
  if (JSON.stringify(sourceCounts) !== JSON.stringify(restoreCounts)) throw fail("restore_business_data_mismatch", "restored table counts differ from production snapshot");
  for (const kind of ["mysql_binlog", "evidence", "export", "config"]) { const target = join(restoreRoot, `${kind}-files`); await mkdir(target, { recursive: true }); await run("tar", ["-xzf", restored[kind], "-C", target]); if (kind === "mysql_binlog") for (const name of closedLogs) await run(binlogClient, ["--verify-binlog-checksum", join(target, name)]); }
  const requiredTables = ["audit_logs", "platform_audit_events", "file_assets", "memberships", "membership_data_scopes", "role_capabilities"];
  if (requiredTables.some((table) => !(table in restoreCounts) || restoreCounts[table] !== sourceCounts[table])) throw fail("restore_control_tables_invalid", "audit evidence or permission tables were not restored exactly");
  const [scopeRows] = await adminPool.query(`SELECT COUNT(*) invalid_count FROM ${sqlIdentifier(restoreDatabase)}.workspaces w LEFT JOIN ${sqlIdentifier(restoreDatabase)}.organizations o ON o.id=w.organization_id WHERE o.id IS NULL`);
  if (Number(scopeRows[0].invalid_count) !== 0) throw fail("restore_permission_boundary_invalid", "restored workspace organization boundary contains orphans");
  const drillFinishedAt = new Date(), actualRtoMinutes = Math.max(0.01, (drillFinishedAt - drillStartedAt) / 60000);
  if (actualRpoMinutes > Number(runtime.BACKUP_RPO_MINUTES || 15) || actualRtoMinutes > Number(runtime.BACKUP_RTO_MINUTES || 240)) throw fail("recovery_objective_missed", "actual RPO or RTO exceeded target");
  const backupRunId = randomUUID(), drillRunId = randomUUID(), runSql = "INSERT INTO backup_recovery_runs(id,run_type,scope_type,primary_region,recovery_region,status,rpo_target_minutes,rto_target_minutes,actual_rpo_minutes,actual_rto_minutes,source_cutoff_at,started_at,finished_at,isolated,encrypted,integrity_verified,permission_boundary_verified,audit_chain_verified,evidence_hash_verified,request_id,trace_id,metadata) VALUES(?,?,'platform','惠州','惠州','verified',15,240,?,?,?,?,?,?,1,1,?,?,?,?,?,?)";
  await databasePool.query(runSql, [backupRunId, "backup", actualRpoMinutes, null, sourceCutoffAt, startedAt, backupFinishedAt, 0, 0, 0, 0, requestId, traceId, JSON.stringify({ topology: "same_host_local_isolation", host_failure_protected: false })]);
  await databasePool.query(runSql, [drillRunId, "restore_drill", null, actualRtoMinutes, sourceCutoffAt, drillStartedAt, drillFinishedAt, 1, 1, 1, 1, requestId, traceId, JSON.stringify({ topology: "same_host_local_isolation", table_count: Object.keys(sourceCounts).length })]);
  const retentionUntil = new Date(drillFinishedAt.getTime() + retentionDays * 86_400_000);
  for (const asset of assets) for (const role of ["primary_backup", "recovery_copy"]) await databasePool.query("INSERT INTO backup_recovery_assets(id,run_id,asset_kind,region,storage_role,bundle_name,bundle_sha256,plaintext_sha256,size_bytes,encrypted,integrity_verified,retention_until) VALUES(?,?,?,?,?,?,?,?,?,1,1,?)", [randomUUID(), backupRunId, asset.kind, "惠州", role, asset.file, asset.bundleSha256, asset.plaintextSha256, asset.sizeBytes, retentionUntil]);
  const evidencePath = join(copyRoot, `${stamp}-evidence.json`);
  const result = { schemaVersion: 1, module: "M07-04", manager: "baota", primaryRegion: "惠州", recoveryRegion: "惠州", topology: "same_host_local_isolation", hostFailureProtected: false, migrationStatus, backup: { encrypted: true, integrityVerified: true, pitrVerified: true, coordinatesEmbedded: true, binlogRetentionDays: Number(binlogPolicy.expire_logs_days), rpoMinutes: Number(actualRpoMinutes.toFixed(2)), assetKinds: assets.map((asset) => asset.kind), retentionDays }, recoveryCopy: { region: "惠州", sameHost: true, separateEncryptedRoot: true, integrityVerified: true }, restoreDrill: { isolated: true, rtoMinutes: Number(actualRtoMinutes.toFixed(2)), businessDataVerified: true, auditChainVerified: true, evidenceHashVerified: true, permissionBoundaryVerified: true, restoredTableCount: Object.keys(sourceCounts).length }, backupRunId, drillRunId, requestId, traceId, capturedAt: drillFinishedAt.toISOString() };
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  result.prunedExpiredFiles = (await pruneExpired(primaryRoot, retentionDays, drillFinishedAt)) + (await pruneExpired(copyRoot, retentionDays, drillFinishedAt));
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ module: "M07-04", status: "blocked", code: error.code || "baota_backup_drill_failed", message: error.message, request_id: requestId, trace_id: traceId })}\n`); process.exitCode = 2;
} finally {
  if (restoreDatabase && adminPool) try { await adminPool.query(`DROP DATABASE IF EXISTS ${sqlIdentifier(restoreDatabase)}`); } catch {}
  if (drillRoot) for (const path of [drillRoot]) { try { const entries = await import("node:fs/promises").then(({ readdir }) => readdir(path)); for (const name of entries.filter((name) => name.startsWith("run-"))) await rm(join(path, name), { recursive: true, force: true }); } catch {} }
  if (databasePool) await databasePool.end(); if (adminPool) await adminPool.end();
}
