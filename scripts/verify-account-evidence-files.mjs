import { fileAssetScopeRelation } from "./lib/file-asset-scope.mjs";
import { accountRehearsalTaskScope } from "./lib/account-rehearsal-task-scope.mjs";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep, win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { isHistoricalAuditAsset } from "./account-historical-audit-evidence.mjs";
import {
  assertAccountRehearsalTarget,
  connectLocalAccountRehearsal,
} from "./stage-account-scope-retirement.mjs";

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const batchSize = 250;
const baotaProjectRoot = "/www/wwwroot/ai选品";

export async function browserEvidenceTaskScopeJoin(connection, task) {
  const [columns] = await connection.query(
    "SHOW COLUMNS FROM browser_evidence_artifacts WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1)
    throw new Error("partial_inherited_scope_schema:browser_evidence_artifacts");
  task ??= await accountRehearsalTaskScope(connection);
  return (
    `LEFT JOIN ${task.relation} t ON t.id=a.collection_task_id` +
    (columns.length === 2
      ? " AND t.organization_id=a.organization_id AND t.workspace_id=a.workspace_id"
      : "")
  );
}

export async function rawEvidenceVerificationProjection(connection, task) {
  const [columns] = await connection.query(
    "SHOW COLUMNS FROM raw_evidence WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = columns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape !== "organization_id,workspace_id" && shape !== "account_id")
    throw new Error("raw_evidence_scope_shape_invalid");
  task ??= await accountRehearsalTaskScope(connection);
  if (shape === "organization_id,workspace_id" && !task.native)
    return {
      select:
        "r.organization_id,r.workspace_id,NULL recorded_owner,0 missing_parent FROM raw_evidence r",
      native: false,
    };
  const hasRawOwner = shape === "account_id";
  return {
    select:
      `rt.organization_id,rt.workspace_id,${task.native ? "rt.account_id" : "r.account_id"} recorded_owner,` +
      `(rt.id IS NULL${task.native && hasRawOwner ? " OR NOT (r.account_id<=>rt.account_id)" : ""}) missing_parent ` +
      `FROM raw_evidence r LEFT JOIN ${task.relation} rt ON rt.id=r.collection_task_id` +
      (hasRawOwner
        ? ""
        : " AND r.organization_id=rt.organization_id AND r.workspace_id=rt.workspace_id"),
    native: true,
  };
}

function strictlyInside(parent, child) {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export async function resolveRehearsalEvidenceRoot(evidenceRoot, drillRoot) {
  const error = "isolated_evidence_directory_required";
  async function canonicalDirectory(path) {
    if (typeof path !== "string" || !isAbsolute(path)) throw new Error(error);
    const expected = resolve(path);
    const canonical = await realpath(expected).catch(() => null);
    if (
      canonical !== expected ||
      canonical.startsWith("\\\\") ||
      dirname(canonical) === canonical ||
      !(await stat(canonical)).isDirectory()
    )
      throw new Error(error);
    return canonical;
  }
  const root = await canonicalDirectory(evidenceRoot);
  if (drillRoot !== undefined && !strictlyInside(await canonicalDirectory(drillRoot), root))
    throw new Error(error);
  return root;
}

export async function baotaEvidenceBoundary() {
  if (process.platform === "win32") return undefined;
  const layout = await lstat(baotaProjectRoot).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!layout) return undefined;
  const drillRoot = process.env.BACKUP_DRILL_ROOT;
  if (
    !layout.isDirectory() ||
    !drillRoot ||
    !isAbsolute(drillRoot) ||
    !strictlyInside(resolve(baotaProjectRoot, "backups"), resolve(drillRoot))
  )
    throw new Error("baota_backup_drill_root_required");
  return drillRoot;
}

export async function checkEvidenceFile(root, row, onChunk) {
  const path = row.relative_path;
  if (
    typeof path !== "string" ||
    isAbsolute(path) ||
    win32.isAbsolute(path) ||
    path.includes(":") ||
    path.split(/[\\/]/).some((part) => !part || part === "." || part === "..")
  )
    return "unsafe_path";
  // Evidence producers persist buildScopedFilePath() output using forward slashes.
  // A valid hash is not proof that the file is under the asset's own legacy scope.
  const segments = path.split("/");
  const safeSegment = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
  if (
    segments.length !== 7 ||
    !segments.every((segment) => safeSegment.test(segment)) ||
    segments[0] !== "organizations" ||
    segments[1] !== row.organization_id ||
    segments[2] !== "workspaces" ||
    segments[3] !== row.workspace_id ||
    segments[4] !== "evidence"
  )
    return "scope_path_mismatch";
  if (
    typeof row.content_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/i.test(row.content_sha256) ||
    !/^\d+$/.test(String(row.size_bytes))
  )
    return "invalid_metadata";
  let handle, sinkError;
  try {
    const expected = resolve(root, ...segments);
    const file = await realpath(expected);
    const contained = relative(root, file);
    if (
      !contained ||
      contained === ".." ||
      contained.startsWith(`..${sep}`) ||
      isAbsolute(contained) ||
      file !== expected
    )
      return "unsafe_path";
    const pathInfo = await lstat(file, { bigint: true });
    if (!pathInfo.isFile()) return "unsafe_path";
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const metadata = await handle.stat({ bigint: true });
    if (!metadata.isFile()) return "not_regular_file";
    if (metadata.nlink !== 1n || metadata.dev !== pathInfo.dev || metadata.ino !== pathInfo.ino)
      return "unsafe_path";
    const size = BigInt(row.size_bytes);
    if (metadata.size !== size) return "size_mismatch";
    const hash = createHash("sha256");
    let bytes = 0n;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      bytes += BigInt(chunk.length);
      if (bytes > size) return "size_mismatch";
      hash.update(chunk);
      if (onChunk) {
        try {
          await onChunk(chunk);
        } catch (error) {
          sinkError = error;
          throw error;
        }
      }
    }
    if (bytes !== size) return "size_mismatch";
    const after = await handle.stat({ bigint: true });
    const finalPath = await lstat(file, { bigint: true });
    if (
      !finalPath.isFile() ||
      finalPath.dev !== metadata.dev ||
      finalPath.ino !== metadata.ino ||
      finalPath.size !== pathInfo.size ||
      finalPath.mtimeNs !== pathInfo.mtimeNs ||
      finalPath.ctimeNs !== pathInfo.ctimeNs ||
      (await realpath(file)) !== file ||
      after.nlink !== 1n ||
      after.size !== size ||
      after.mtimeNs !== metadata.mtimeNs ||
      after.ctimeNs !== metadata.ctimeNs
    )
      return "source_changed";
    return hash.digest("hex") === row.content_sha256.toLowerCase() ? "verified" : "hash_mismatch";
  } catch (error) {
    if (error === sinkError) throw error;
    return error.code === "ENOENT" ? "missing" : "unreadable";
  } finally {
    await handle?.close();
  }
}

export async function verifyAccountEvidenceFiles(
  connection,
  runId,
  evidenceRoot,
  drillRoot,
  withEvidenceFile,
  auditOnly,
) {
  if (
    typeof runId !== "string" ||
    !uuid.test(runId) ||
    typeof evidenceRoot !== "string" ||
    !isAbsolute(evidenceRoot)
  )
    throw new Error("expected_backfill_run_uuid_and_absolute_evidence_root");
  const root = await resolveRehearsalEvidenceRoot(evidenceRoot, drillRoot);
  await assertAccountRehearsalTarget(connection);
  await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  try {
    return await scanEvidenceInTransaction(connection, runId, root, withEvidenceFile, auditOnly);
  } finally {
    await connection.rollback();
  }
}

// The backfill owns the transaction. Verify its provisional rows without START/COMMIT/ROLLBACK.
export async function verifyAccountEvidenceBeforeBackfillCommit(
  connection,
  runId,
  evidenceRoot,
  drillRoot,
  auditOnly,
) {
  const root = await resolveRehearsalEvidenceRoot(evidenceRoot, drillRoot);
  return scanEvidenceInTransaction(connection, runId, root, undefined, auditOnly);
}

async function scanEvidenceInTransaction(connection, runId, root, withEvidenceFile, auditOnly) {
  const task = await accountRehearsalTaskScope(connection);
  const browserScopeJoin = await browserEvidenceTaskScopeJoin(connection, task);
  const raw = await rawEvidenceVerificationProjection(connection, task);
  const assets = await fileAssetScopeRelation(connection);
  const native = assets !== "file_assets";
  const ownedCoordinate = "f.organization_id=e.organization_id AND f.workspace_id=e.workspace_id";
  const scopeMatch = native
    ? `(${ownedCoordinate} OR f.historical_context IS NULL)`
    : ownedCoordinate;
  const nativeMismatch =
    (native ? " OR NOT (f.account_id <=> fo.account_id)" : "") +
    (raw.native
      ? " OR (NOT e.is_browser AND (e.missing_parent OR NOT (e.recorded_owner <=> eo.account_id)))"
      : "") +
    (task.native
      ? " OR (e.is_browser AND (e.missing_parent OR NOT (e.recorded_owner <=> eo.account_id)))"
      : "");
  const [receipt] = await connection.execute(
    "SELECT slot FROM account_ownership_cutover WHERE slot='current' AND source_run_id=? AND contract_version=25",
    [runId],
  );
  if (receipt.length !== 1) throw new Error("current_backfill_run_required");
  // MySQL 5.7 materializes UNION literals; match the ledger's ASCII source_table collation.
  const [[references]] = await connection.query(`SELECT COUNT(*) total,
      COALESCE(SUM(e.is_active),0) active,
      COALESCE(SUM(e.is_active AND e.is_browser),0) active_browser,
      COALESCE(SUM(NOT e.is_active AND f.status='deleted'),0) historical_deleted_assets,
      COALESCE(SUM(e.is_active AND (f.id IS NULL OR fo.account_id IS NULL OR eo.account_id IS NULL OR eo.account_id<>fo.account_id${nativeMismatch})),0) invalid_active,
      COALESCE(SUM(NOT e.is_active AND (f.id IS NULL OR fo.account_id IS NULL OR eo.account_id IS NULL OR eo.account_id<>fo.account_id${nativeMismatch})),0) invalid_historical
      FROM (
        SELECT _ascii'raw_evidence' COLLATE ascii_general_ci source_table,0 is_browser,
          r.status='active' is_active,
          r.id,r.file_asset_id,r.size_bytes,r.content_sha256,${raw.select}
        UNION ALL
        SELECT _ascii'browser_evidence_artifacts' COLLATE ascii_general_ci,1,
          a.status='active',
          a.id,a.file_asset_id,a.size_bytes,a.content_sha256,t.organization_id,t.workspace_id,${task.native ? "t.account_id,(t.id IS NULL)" : "NULL,0"}
          FROM browser_evidence_artifacts a ${browserScopeJoin}
      ) e
      LEFT JOIN ${assets} f ON f.id=e.file_asset_id AND ${scopeMatch}
        AND (NOT e.is_active OR f.status='active') AND f.category='evidence'
        AND f.size_bytes=e.size_bytes AND f.content_sha256=e.content_sha256
      LEFT JOIN account_owned_records eo ON eo.source_table=e.source_table AND eo.source_id=e.id
      LEFT JOIN account_owned_records fo ON fo.source_table='file_assets' AND fo.source_id=f.id`);
  const counters = {};
  let after = "",
    activeChecked = 0n,
    quarantinedChecked = 0n;
  for (;;) {
    const [rows] = await connection.execute(
      `SELECT f.id,f.organization_id,f.workspace_id,f.relative_path,f.content_sha256,f.size_bytes,fo.account_id,f.status asset_status
        FROM ${assets} f LEFT JOIN account_owned_records fo ON fo.source_table='file_assets' AND fo.source_id=f.id
        WHERE f.category='evidence' AND f.status IN ('active','quarantined') AND f.id>? ORDER BY f.id LIMIT ${batchSize}`,
      [after],
    );
    if (!rows.length) break;
    for (const row of rows) {
      if (typeof row.id !== "string" || !uuid.test(row.id) || row.id <= after)
        throw new Error("invalid_evidence_file_cursor");
      after = row.id;
      if (row.asset_status === "active") activeChecked++;
      else if (row.asset_status === "quarantined") quarantinedChecked++;
      else throw new Error("invalid_retained_evidence_asset_status");
      let status = "missing_owner";
      if (isHistoricalAuditAsset(auditOnly, row)) {
        status = "audit_only_unavailable";
      } else if (row.account_id) {
        if (withEvidenceFile) {
          let started = false;
          status = undefined;
          await withEvidenceFile(row, async (onChunk) => {
            if (started) throw new Error("evidence_stream_already_started");
            started = true;
            status = await checkEvidenceFile(root, row, onChunk);
            return status;
          });
          if (status === undefined) throw new Error("evidence_stream_not_completed");
        } else {
          status = await checkEvidenceFile(root, row);
        }
      }
      counters[status] = (counters[status] ?? 0n) + 1n;
    }
  }
  const checked = activeChecked + quarantinedChecked;
  const auditCount = counters.audit_only_unavailable ?? 0n;
  return {
    run_id: runId,
    status:
      String(references.invalid_active) !== "0" ||
      String(references.invalid_historical) !== "0" ||
      (counters.verified ?? 0n) + auditCount !== checked ||
      auditCount !== BigInt(auditOnly?.size ?? 0)
        ? "mismatch"
        : checked === 0n || String(references.total) === "0"
          ? "empty"
          : "verified",
    active_evidence_references: String(references.active),
    active_browser_evidence_references: String(references.active_browser),
    invalid_active_references: String(references.invalid_active),
    historical_evidence_references: String(BigInt(references.total) - BigInt(references.active)),
    historical_deleted_asset_references: String(references.historical_deleted_assets),
    invalid_historical_references: String(references.invalid_historical),
    active_files_checked: String(activeChecked),
    quarantined_files_checked: String(quarantinedChecked),
    retained_files_checked: String(checked),
    ...(auditOnly ? { audit_only_unavailable_files: String(auditCount) } : {}),
    files: Object.fromEntries(Object.entries(counters).map(([key, count]) => [key, String(count)])),
  };
}

async function main() {
  const [runId, ...extra] = process.argv.slice(2);
  const root = process.env.EVIDENCE_ROOT;
  if (!runId || !uuid.test(runId) || extra.length || !root || !isAbsolute(root))
    throw new Error("expected_backfill_run_uuid_and_absolute_evidence_root");
  const drillRoot = await baotaEvidenceBoundary();
  await resolveRehearsalEvidenceRoot(root, drillRoot);
  const connection = await connectLocalAccountRehearsal();
  try {
    const report = await verifyAccountEvidenceFiles(connection, runId, root, drillRoot);
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "verified") process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      error.code ??
        (/^[a-z_]+$/.test(error.message) ? error.message : "evidence_verification_failed"),
    );
    process.exitCode = 1;
  });
}
