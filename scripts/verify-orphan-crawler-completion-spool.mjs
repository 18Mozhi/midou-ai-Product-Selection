import { constants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const productionSpool = "/www/wwwroot/ai选品/runtime/crawler-completions";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const maxEntries = 1024;
const maxReceiptBytes = 8 * 1024 * 1024;
const maxTotalBytes = 64 * 1024 * 1024;

export async function auditCrawlerCompletionSpool(root, runIds) {
  if (
    typeof root !== "string" ||
    resolve(root) !== root ||
    !Array.isArray(runIds) ||
    runIds.length > 100 ||
    !runIds.every((id) => uuid.test(id)) ||
    new Set(runIds).size !== runIds.length
  )
    throw new Error("crawler_spool_audit_invalid_input");
  const targets = new Set(runIds),
    matches = new Set();
  const result = {
    orphan_rows: runIds.length,
    pending: 0,
    quarantined: 0,
    opaque_receipts: 0,
    matched_orphans: 0,
    partial_temp: 0,
  };
  let totalBytes = 0;
  for (const [directory, bucket] of [
    [root, "pending"],
    [join(root, "quarantine"), "quarantined"],
  ]) {
    let entries;
    try {
      const info = await lstat(directory);
      if (!info.isDirectory() || (await realpath(directory)) !== directory)
        throw new Error("crawler_spool_audit_unsafe_directory");
      entries = await opendir(directory);
    } catch (error) {
      if (error.code === "ENOENT" && bucket === "quarantined") continue;
      throw error;
    }
    let count = 0;
    for await (const item of entries) {
      if (++count > maxEntries) throw new Error("crawler_spool_audit_entry_limit");
      if (item.name.endsWith(".tmp")) {
        result.partial_temp++;
        continue;
      }
      if (!item.name.endsWith(".json")) continue;
      result[bucket]++;
      try {
        const path = join(directory, item.name);
        const expected = await lstat(path);
        if (!expected.isFile() || expected.size > maxReceiptBytes)
          throw new Error("opaque_receipt");
        const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
          const initial = await file.stat();
          if (
            initial.dev !== expected.dev ||
            initial.ino !== expected.ino ||
            initial.size !== expected.size
          )
            throw new Error("opaque_receipt");
          totalBytes += expected.size;
          if (totalBytes > maxTotalBytes) throw new Error("opaque_receipt");
          const read = Buffer.alloc(expected.size + 1);
          let offset = 0;
          while (offset < read.length) {
            const { bytesRead } = await file.read(read, offset, read.length - offset, offset);
            if (!bytesRead) break;
            offset += bytesRead;
          }
          const final = await file.stat();
          if (offset !== expected.size || final.mtimeMs !== initial.mtimeMs)
            throw new Error("opaque_receipt");
          const record = JSON.parse(read.subarray(0, offset).toString("utf8"));
          const runId = record?.body?.run_id;
          if (
            record?.schema_version !== 1 ||
            typeof runId !== "string" ||
            !uuid.test(runId) ||
            typeof record.path !== "string" ||
            !/^\/api\/v1\/internal\/crawler-runtime\/jobs\/[\da-f-]{36}\/complete$/i.test(
              record.path,
            )
          )
            throw new Error("opaque_receipt");
          if (targets.has(runId)) matches.add(runId);
        } finally {
          await file.close();
        }
      } catch {
        result.opaque_receipts++;
      }
    }
  }
  result.matched_orphans = matches.size;
  return {
    ...result,
    status:
      result.partial_temp || result.opaque_receipts
        ? "inconclusive"
        : result.matched_orphans
          ? "matching_completion_receipt_present"
          : "no_matching_completion_receipt_observed",
  };
}

async function live() {
  const env = process.env;
  if (
    process.platform !== "linux" ||
    env.DB_HOST !== "127.0.0.1" ||
    env.DB_NAME !== "product_scout" ||
    env.DB_USER !== "product_scout" ||
    env.DB_READ_HOST ||
    env.DB_WRITE_HOST ||
    env.CRAWLER_COMPLETION_SPOOL_ROOT !== productionSpool
  )
    throw new Error("crawler_spool_audit_target_invalid");
  const { default: mysql } = await import("mysql2/promise");
  const db = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectTimeout: 3000,
  });
  let rows;
  try {
    await db.query("SET SESSION max_execution_time=1500");
    await db.query("START TRANSACTION READ ONLY");
    [rows] = await db.query(
      "SELECT r.id FROM crawler_browser_runs r LEFT JOIN browser_collection_jobs j ON j.crawler_run_id=r.id " +
        "WHERE r.status='running' AND j.id IS NULL ORDER BY r.id LIMIT 101",
    );
  } finally {
    await db.rollback();
    await db.end();
  }
  return auditCrawlerCompletionSpool(
    productionSpool,
    rows.map(({ id }) => id),
  );
}

const stdinMain = process.argv[1] === "-" && /\/\[(?:eval|stdin)\d*\]$/.test(import.meta.url);
if (
  stdinMain ||
  (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== "--read-only")
      throw new Error("crawler_spool_audit_read_only_required");
    const report = await live();
    console.log(JSON.stringify(report));
    if (report.status === "inconclusive") process.exitCode = 1;
  } catch (error) {
    const code = /^(?:crawler_spool_audit_[a-z_]+|[A-Z0-9_]+)$/.test(error.message)
      ? error.message
      : "crawler_spool_audit_failed";
    console.error(JSON.stringify({ status: "failed", code }));
    process.exitCode = 1;
  }
}
