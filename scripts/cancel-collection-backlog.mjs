import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const batchRoot = "/www/wwwroot/ai选品/runtime/verification";
const event = "collection.task.cancelled";
const actor = "scoutops-backlog-operator";
const limit = 2_000;
const batchSize = 50;
const eligible = `t.status IN ('scheduled','queued') AND t.attempt_count=0
  AND t.lease_owner IS NULL AND t.leased_at IS NULL AND t.lease_token_hash IS NULL
  AND t.lease_expires_at IS NULL AND t.started_at IS NULL AND t.finished_at IS NULL
  AND t.available_result_count=0 AND t.successful_subquery_count=0
  AND t.failed_subquery_count=0 AND t.blocked_subquery_count=0
  AND EXISTS (SELECT 1 FROM organizations o JOIN workspaces w ON w.organization_id=o.id
    WHERE o.id=t.organization_id AND w.id=t.workspace_id AND o.status='active' AND w.status='active')
  AND NOT EXISTS (SELECT 1 FROM collection_task_attempts a WHERE a.task_id=t.id)
  AND NOT EXISTS (SELECT 1 FROM crawler_scheduler_leases a WHERE a.task_id=t.id)
  AND NOT EXISTS (SELECT 1 FROM browser_collection_jobs a WHERE a.collection_task_id=t.id)
  AND NOT EXISTS (SELECT 1 FROM browser_evidence_artifacts a WHERE a.collection_task_id=t.id)
  AND NOT EXISTS (SELECT 1 FROM core_collection_projection_runs a WHERE a.collection_task_id=t.id)
  AND NOT EXISTS (SELECT 1 FROM raw_evidence a WHERE a.collection_task_id=t.id)
  AND NOT EXISTS (SELECT 1 FROM collection_task_evidence_links a WHERE a.collection_task_id=t.id)
  AND NOT EXISTS (SELECT 1 FROM collection_subqueries a WHERE a.task_id=t.id
    AND (a.status<>'pending' OR a.started_at IS NOT NULL OR a.finished_at IS NOT NULL OR a.available_result_count<>0))`;

export function readBacklogSnapshot(bytes, sha256) {
  if (
    bytes.length > 750_000 ||
    !/^[0-9a-f]{64}$/.test(sha256) ||
    createHash("sha256").update(bytes).digest("hex") !== sha256
  )
    throw new Error("collection_cancel_snapshot_hash_mismatch");
  const snapshot = JSON.parse(bytes.toString("utf8"));
  if (
    snapshot?.schema !== 1 ||
    !uuid.test(snapshot.batch_id) ||
    typeof snapshot.captured_at !== "string" ||
    !Array.isArray(snapshot.rows) ||
    !snapshot.rows.length ||
    snapshot.rows.length > limit
  )
    throw new Error("collection_cancel_snapshot_invalid");
  const ids = new Set(),
    scopes = new Map();
  for (const row of snapshot.rows) {
    if (
      !row ||
      !uuid.test(row.id) ||
      !uuid.test(row.organization_id) ||
      !uuid.test(row.workspace_id) ||
      ids.has(row.id) ||
      !Number.isSafeInteger(row.version) ||
      row.version < 1 ||
      !["queued", "scheduled"].includes(row.status) ||
      (scopes.has(row.workspace_id) && scopes.get(row.workspace_id) !== row.organization_id)
    )
      throw new Error("collection_cancel_snapshot_row_invalid");
    ids.add(row.id);
    scopes.set(row.workspace_id, row.organization_id);
  }
  return snapshot;
}

async function observe(connection, snapshot, sha256) {
  const ids = snapshot.rows.map((row) => row.id);
  const [remaining] = await connection.query(
    `SELECT t.id,t.organization_id,t.workspace_id FROM collection_tasks t WHERE t.id IN (?) AND ${eligible}`,
    [ids],
  );
  const [receipts] = await connection.query(
    `SELECT e.task_id id,e.organization_id,e.workspace_id,t.status current_status,
      JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.snapshot_sha256')) snapshot_sha256
     FROM collection_task_events e
     LEFT JOIN collection_tasks t ON t.id=e.task_id AND t.organization_id=e.organization_id AND t.workspace_id=e.workspace_id
     WHERE e.trace_id=? AND e.request_id=? AND e.event_type=? AND e.actor_type='system' AND e.actor_id=?
     AND e.to_status='cancelled'`,
    [snapshot.batch_id, snapshot.batch_id, event, actor],
  );
  const scoped = new Map(snapshot.rows.map((row) => [row.id, row]));
  const matches = (row) =>
    scoped.get(row.id)?.organization_id === row.organization_id &&
    scoped.get(row.id)?.workspace_id === row.workspace_id;
  if (
    receipts.some(
      (row) =>
        !matches(row) || row.snapshot_sha256 !== sha256 || row.current_status !== "cancelled",
    ) ||
    new Set(receipts.map((row) => row.id)).size !== receipts.length
  )
    throw new Error("collection_cancel_audit_inconsistent");
  const eligibleRemaining = remaining.filter(matches).length;
  return {
    snapshot_count: ids.length,
    cancelled: receipts.length,
    eligible_remaining: eligibleRemaining,
    protected_or_no_longer_eligible: ids.length - receipts.length - eligibleRemaining,
  };
}

export async function cancelFrozenBacklog(connection, snapshot, sha256, { apply = false } = {}) {
  if (!apply)
    return {
      batch_id: snapshot.batch_id,
      mode: "preview",
      ...(await observe(connection, snapshot, sha256)),
    };
  const [[column]] = await connection.query(
    "SELECT COLUMN_TYPE kind FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='collection_tasks' AND COLUMN_NAME='status'",
  );
  if (!column?.kind?.endsWith(",'cancelled')"))
    throw new Error("collection_cancel_migration_required");
  await connection.query("SET SESSION innodb_lock_wait_timeout=3");
  const lockName = `scoutops-cancel:${snapshot.batch_id}`;
  const [[lock]] = await connection.query("SELECT GET_LOCK(?,0) acquired", [lockName]);
  if (lock.acquired !== 1) throw new Error("collection_cancel_batch_busy");
  try {
    await observe(connection, snapshot, sha256);
    const rows = [...snapshot.rows].sort((a, b) => a.id.localeCompare(b.id));
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      await connection.beginTransaction();
      try {
        for (const row of rows.slice(offset, offset + batchSize)) {
          const identity = [row.id, row.organization_id, row.workspace_id];
          const [[current]] = await connection.query(
            "SELECT status,version FROM collection_tasks WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
            identity,
          );
          if (!["queued", "scheduled"].includes(current?.status)) continue;
          const [update] = await connection.query(
            `UPDATE collection_tasks t SET t.status='cancelled',t.finished_at=NOW(3),
               t.updated_at=NOW(3),t.version=t.version+1
             WHERE t.id=? AND t.organization_id=? AND t.workspace_id=? AND t.version=? AND ${eligible}`,
            [...identity, current.version],
          );
          if (!update.affectedRows) continue;
          if (update.affectedRows !== 1) throw new Error("collection_cancel_update_count_invalid");
          const [receipt] = await connection.query(
            `INSERT INTO collection_task_events (id,task_id,organization_id,workspace_id,event_type,
              from_status,to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at)
             VALUES (?,?,?,?,?,?,'cancelled','system',?,?,?,?,NOW(3))`,
            [
              randomUUID(),
              ...identity,
              event,
              current.status,
              actor,
              snapshot.batch_id,
              snapshot.batch_id,
              JSON.stringify({
                reason: "retire_frozen_unstarted_backlog",
                snapshot_sha256: sha256,
                captured_at: snapshot.captured_at,
                snapshot_version: row.version,
                previous_version: current.version,
              }),
            ],
          );
          if (receipt.affectedRows !== 1) throw new Error("collection_cancel_audit_write_failed");
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
    return {
      batch_id: snapshot.batch_id,
      mode: "apply",
      ...(await observe(connection, snapshot, sha256)),
    };
  } finally {
    await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
  }
}

async function main() {
  const [file, sha256, flag, ...rest] = process.argv.slice(2);
  if (!file || !sha256 || rest.length || (flag !== undefined && flag !== "--apply"))
    throw new Error("usage: cancel-collection-backlog.mjs SNAPSHOT SHA256 [--apply]");
  const path = resolve(file);
  if (dirname(path) !== batchRoot || (await realpath(path)) !== path)
    throw new Error("collection_cancel_snapshot_path_invalid");
  const fileStat = await stat(path);
  if (!fileStat.isFile() || fileStat.mode & 0o077 || fileStat.size > 750_000)
    throw new Error("collection_cancel_snapshot_permissions_invalid");
  const snapshot = readBacklogSnapshot(await readFile(path), sha256);
  if (basename(path) !== `collection-backlog-${snapshot.batch_id}.json`)
    throw new Error("collection_cancel_snapshot_batch_mismatch");
  const env = process.env;
  if (
    env.DB_HOST !== "127.0.0.1" ||
    env.DB_NAME !== "product_scout" ||
    env.DB_USER !== "product_scout" ||
    !env.DB_PASSWORD ||
    env.NODE_ENV !== "production"
  )
    throw new Error("collection_cancel_database_identity_mismatch");
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectTimeout: 5_000,
    multipleStatements: false,
  });
  try {
    const result = await cancelFrozenBacklog(connection, snapshot, sha256, {
      apply: flag === "--apply",
    });
    console.log(JSON.stringify(result));
    if (flag === "--apply" && result.eligible_remaining) process.exitCode = 2;
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(
      error?.code ||
        (/^collection_cancel_/.test(error?.message) ? error.message : "collection_cancel_failed"),
    );
    process.exitCode = 1;
  });
}
