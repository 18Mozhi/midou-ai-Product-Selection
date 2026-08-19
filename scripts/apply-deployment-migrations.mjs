import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import mysql from "mysql2/promise";

const allowed = new Set(["0040_platform_messages.up.sql"]);
const requested = process.argv.slice(2);

if (
  !requested.length ||
  requested.some((name) => !allowed.has(basename(name)))
) {
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
    const checksum = createHash("sha256")
      .update(sql.replaceAll("\r\n", "\n"))
      .digest("hex");
    const [rows] = await pool.query(
      "SELECT checksum FROM schema_migrations WHERE name=?",
      [name],
    );
    if (rows[0]) {
      if (rows[0].checksum !== checksum)
        throw new Error(`migration_checksum_drift:${name}`);
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
  process.stdout.write(
    `${JSON.stringify({ status: "ok", migrations: results })}\n`,
  );
} finally {
  await pool.end();
}
