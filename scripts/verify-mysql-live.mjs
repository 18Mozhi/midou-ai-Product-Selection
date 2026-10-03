import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import {
  applyMigration,
  createDatabasePool,
  createMigrationExecutor,
  withTransaction,
} from "../packages/database/dist/index.js";

async function runLocalProbe() {
  const requestId = randomUUID();
  const traceId = requestId;
  const config = loadRuntimeConfig(process.env, "api");
  const pool = createDatabasePool(config);
  const marker = `m00-03-live-${requestId}.sql`;
  const probe = `m00_03_tx_${requestId.replaceAll("-", "")}`;

  try {
    const [rows] = await pool.query(
      "SELECT VERSION() AS version, @@character_set_server AS charset, DATABASE() AS database_name, CURRENT_USER() AS account_name",
    );
    const row = rows[0];
    if (!String(row.version).startsWith("5.7."))
      throw new Error(`requires MySQL 5.7, received ${row.version}`);
    if (row.charset !== "utf8mb4") throw new Error(`requires utf8mb4, received ${row.charset}`);
    if (
      row.database_name !== "product_scout" ||
      !String(row.account_name).startsWith("product_scout@")
    )
      throw new Error("requires product_scout database and business account");

    await pool.query(await readFile("database/bootstrap/schema_migrations.sql", "utf8"));
    const executor = createMigrationExecutor(pool);
    if ((await applyMigration(executor, { name: marker, sql: "SELECT 1" })) !== "applied")
      throw new Error("migration did not apply");
    if ((await applyMigration(executor, { name: marker, sql: "SELECT 1" })) !== "already_applied")
      throw new Error("migration idempotency failed");

    await pool.query(
      `CREATE TABLE \`${probe}\` (id INT NOT NULL PRIMARY KEY) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    try {
      await withTransaction(pool, async (connection) => {
        await connection.query(`INSERT INTO \`${probe}\` (id) VALUES (1)`);
        throw new Error("expected_rollback");
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "expected_rollback") throw error;
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS count FROM \`${probe}\``);
    if (Number(countRows[0].count) !== 0) throw new Error("transaction rollback failed");
    console.log(
      JSON.stringify({
        status: "passed",
        version: row.version,
        charset: row.charset,
        database: row.database_name,
        account: "product_scout",
        migration: "applied_idempotent",
        transaction: "rollback_verified",
        request_id: requestId,
        trace_id: traceId,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "blocked",
        code: "mysql_unavailable_or_incompatible",
        message: error instanceof Error ? error.message : "unknown",
        request_id: requestId,
        trace_id: traceId,
      }),
    );
    process.exitCode = 2;
  } finally {
    try {
      await pool.query(`DROP TABLE IF EXISTS \`${probe}\``);
    } catch {}
    try {
      await pool.query("DELETE FROM schema_migrations WHERE name = ?", [marker]);
    } catch {}
    await pool.end();
  }
}

async function runBaoTaProbe() {
  const result = spawnSync("python", ["scripts/verify-live-baota.py", "mysql"], {
    encoding: "utf8",
    timeout: 150_000,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    const requestId = randomUUID();
    console.error(
      JSON.stringify({
        status: "blocked",
        code: "baota_probe_runner_unavailable",
        message: "The BaoTa-side probe runner could not be started.",
        request_id: requestId,
        trace_id: requestId,
      }),
    );
    process.exitCode = 2;
    return;
  }
  if (result.status !== 0) process.exitCode = result.status ?? 2;
}

const target = process.env.SCOUTOPS_MYSQL_LIVE_TARGET ?? "local";
if (target === "baota-production") await runBaoTaProbe();
else if (target === "local") await runLocalProbe();
else {
  const requestId = randomUUID();
  console.error(
    JSON.stringify({
      status: "blocked",
      code: "mysql_live_target_invalid",
      message: "SCOUTOPS_MYSQL_LIVE_TARGET must be local or baota-production.",
      request_id: requestId,
      trace_id: requestId,
    }),
  );
  process.exitCode = 2;
}
