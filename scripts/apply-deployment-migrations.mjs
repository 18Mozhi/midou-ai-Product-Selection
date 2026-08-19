import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import mysql from "mysql2/promise";

const allowed = new Set([
  "0040_platform_messages.up.sql",
  "0041_member_workspace_tasks.up.sql",
  "0042_erp_product_import.up.sql",
  "0043_trend_rule_collection_schedule.up.sql",
  "0044a_competitor_soft_delete.up.sql",
  "0044b_sourcing_soft_delete.up.sql",
  "0044c_truthful_missing_metrics.up.sql",
  "0044d_nullable_competitor_metrics.up.sql",
  "0044e_core_collection_projection.up.sql",
  "0044f_enable_amazon_public_crawler.up.sql",
  "0045_operational_task_links.up.sql",
  "0046_notification_workflow_root_cause.up.sql",
  "0047_approval_decision_context_snapshot.up.sql",
  "0048_browser_collection_jobs.up.sql",
  "0049_credential_renewal_auto_replay.up.sql",
  "0050_browser_evidence_artifacts.up.sql",
  "0051a_provider_parser_samples.up.sql",
  "0051b_provider_parser_sample_replay_runs.up.sql",
  "0051c_provider_parser_sample_operations.up.sql",
  "0052a_amazon_structured_parser.up.sql",
  "0052b_provider_public_compliance.up.sql",
]);
const requested = process.argv.slice(2);

if (!requested.length || requested.some((name) => !allowed.has(basename(name)))) {
  throw new Error("deployment_migration_not_allowed");
}

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`missing_${name.toLowerCase()}`);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: "utf8mb4",
  connectionLimit: 1,
  multipleStatements: false,
});

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) NOT NULL PRIMARY KEY,
    checksum CHAR(64) CHARACTER SET ascii NOT NULL,
    applied_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const results = [];
  for (const relativeName of requested) {
    const name = basename(relativeName);
    const sql = await readFile(resolve("database/migrations", name), "utf8");
    const checksum = createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex");
    const [rows] = await pool.query("SELECT checksum FROM schema_migrations WHERE name=?", [name]);
    if (rows[0]) {
      if (rows[0].checksum !== checksum) throw new Error(`migration_checksum_drift:${name}`);
      results.push({ name, status: "already_applied" });
      continue;
    }
    await pool.query(sql);
    await pool.query(
      "INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))",
      [name, checksum],
    );
    results.push({ name, status: "applied" });
  }
  process.stdout.write(`${JSON.stringify({ status: "ok", migrations: results })}\n`);
} finally {
  await pool.end();
}
