import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { MySqlRuntimeTopologyRepository } from "../apps/api/dist/mysql-runtime-topology-repository.js";

const moduleId = "M08-01";
const requestId = randomUUID();
const traceId = requestId;
const nodeId = `m08-01-${requestId}`;
const hostId = `m08-01-host-${requestId}`;
const migrationName = "0030_load_balancing_m08_01.up.sql";
const tableNames = ["runtime_nodes", "runtime_node_heartbeats", "load_balancer_observations", "runtime_topology_views"];
const config = loadRuntimeConfig(process.env, "api");
const pool = createDatabasePool(config);

async function ensureMigration() {
  const [tables] = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN (?,?,?,?)",
    tableNames,
  );
  if (tables.length !== 0 && tables.length !== tableNames.length) throw new Error("runtime_topology_migration_partial");
  const sql = await readFile(`database/migrations/${migrationName}`, "utf8");
  const checksum = createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
  if (tables.length === 0) {
    for (const statement of sql.split(";").map((value) => value.trim()).filter(Boolean)) await pool.query(statement);
  }
  await pool.query(await readFile("database/bootstrap/schema_migrations.sql", "utf8"));
  const [migrations] = await pool.query("SELECT checksum FROM schema_migrations WHERE name=?", [migrationName]);
  if (migrations[0] && migrations[0].checksum !== checksum) throw new Error("runtime_topology_migration_checksum_drift");
  if (!migrations[0]) await pool.query("INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))", [migrationName, checksum]);
  return checksum;
}

async function cleanup() {
  try {
    await pool.query("DELETE FROM runtime_node_heartbeats WHERE runtime_node_id IN (SELECT id FROM runtime_nodes WHERE node_id=?)", [nodeId]);
    await pool.query("DELETE FROM runtime_nodes WHERE node_id=?", [nodeId]);
  } catch {}
}

try {
  const [runtimeRows] = await pool.query("SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name");
  const runtime = runtimeRows[0];
  if (!String(runtime.version).startsWith("5.7.") || runtime.charset !== "utf8mb4" || runtime.database_name !== "product_scout" || !String(runtime.account_name).startsWith("product_scout@")) throw new Error("requires_mysql57_utf8mb4_product_scout_business_account");
  const checksum = await ensureMigration();
  await cleanup();
  const repository = new MySqlRuntimeTopologyRepository(pool);
  const observedAt = new Date();
  await repository.heartbeat({nodeId, hostId, region: "惠州", zone: "live-probe", buildSha: "a".repeat(40), version: "0.1.0", status: "ready", requestId, traceId, observedAt});
  await repository.heartbeat({nodeId, hostId, region: "惠州", zone: "live-probe", buildSha: "a".repeat(40), version: "0.1.0", status: "degraded", requestId, traceId, observedAt: new Date(observedAt.getTime() + 1)});
  const snapshot = await repository.snapshot();
  const node = snapshot.nodes.find((item) => item.nodeId === nodeId);
  const [counts] = await pool.query("SELECT (SELECT COUNT(*) FROM runtime_nodes WHERE node_id=?) nodes,(SELECT COUNT(*) FROM runtime_node_heartbeats WHERE runtime_node_id=(SELECT id FROM runtime_nodes WHERE node_id=?)) heartbeats", [nodeId, nodeId]);
  if (!node || node.hostId !== hostId || node.status !== "degraded" || Number(counts[0].nodes) !== 1 || Number(counts[0].heartbeats) !== 2) throw new Error("runtime_topology_heartbeat_repository_mismatch");
  await cleanup();
  console.log(JSON.stringify({module: moduleId, status: "passed", mysql: runtime.version, migration: migrationName, migrationChecksum: checksum, heartbeatUpsert: "passed", heartbeatAppendCount: 2, cleanup: "passed", capacityClaim: "unverified", request_id: requestId, trace_id: traceId}));
} catch (error) {
  console.error(JSON.stringify({module: moduleId, status: "blocked", code: error?.code ?? "runtime_topology_live_failed", message: error instanceof Error ? error.message : "unknown", request_id: requestId, trace_id: traceId}));
  process.exitCode = 2;
} finally {
  await cleanup();
  await pool.end();
}
