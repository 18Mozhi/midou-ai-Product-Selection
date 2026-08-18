import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { ProviderSourceService } from "../apps/api/dist/provider-source-service.js";
import { MySqlProviderSourceRepository } from "../apps/api/dist/mysql-provider-source-repository.js";
import { MySqlAutomaticSourceScheduler } from "../apps/worker/dist/automatic-source-scheduler.js";

const pool = createDatabasePool(loadRuntimeConfig(process.env, "worker"));
const requestId = randomUUID();
const traceId = randomUUID();
const now = new Date();
const ids = { organization: randomUUID(), workspace: randomUUID() };
let actorId = "";

async function ensureMigration() {
  const sql = await readFile("database/migrations/0036_automatic_hotspot_sources.up.sql", "utf8");
  for (const statement of sql.split(";").map((value) => value.trim()).filter(Boolean)) {
    const table = statement.match(/^CREATE TABLE `([^`]+)`/)?.[1];
    if (!table) throw new Error("unexpected_0036_migration_statement");
    const [rows] = await pool.query("SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", [table]);
    if (Number(rows[0].count) === 0) await pool.query(statement);
  }
}

async function cleanup() {
  try {
    await pool.query("DELETE FROM automatic_source_schedules WHERE organization_id=?", [ids.organization]);
    await pool.query("DELETE FROM provider_refresh_operations WHERE task_id IN (SELECT id FROM collection_tasks WHERE organization_id=?)", [ids.organization]);
    await pool.query("DELETE FROM collection_task_outbox WHERE organization_id=?", [ids.organization]);
    await pool.query("DELETE FROM collection_task_events WHERE organization_id=?", [ids.organization]);
    await pool.query("DELETE FROM collection_subqueries WHERE organization_id=?", [ids.organization]);
    await pool.query("DELETE FROM collection_tasks WHERE organization_id=?", [ids.organization]);
    await pool.query("UPDATE organizations SET default_workspace_id=NULL WHERE id=?", [ids.organization]);
    await pool.query("DELETE FROM workspaces WHERE organization_id=?", [ids.organization]);
    await pool.query("DELETE FROM organizations WHERE id=?", [ids.organization]);
  } catch {
    // The normal path verifies that no live-test data remains.
  }
}

async function assertCleanup() {
  for (const [table, column, value] of [
    ["automatic_source_schedules", "organization_id", ids.organization],
    ["collection_tasks", "organization_id", ids.organization],
    ["workspaces", "organization_id", ids.organization],
    ["organizations", "id", ids.organization],
  ]) {
    const [rows] = await pool.query(`SELECT COUNT(*) count FROM ${table} WHERE ${column}=?`, [value]);
    if (Number(rows[0].count) !== 0) throw new Error(`live_cleanup_failed:${table}`);
  }
}

try {
  const [runtimeRows] = await pool.query("SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name");
  const runtime = runtimeRows[0];
  if (!String(runtime.version).startsWith("5.7.") || runtime.charset !== "utf8mb4" || runtime.database_name !== "product_scout" || !String(runtime.account_name).startsWith("product_scout@")) throw new Error("requires_mysql57_utf8mb4_product_scout_business_account");
  await ensureMigration();
  await cleanup();
  const [admins] = await pool.query("SELECT pra.user_id FROM platform_role_assignments pra JOIN users u ON u.id=pra.user_id WHERE pra.role_code='platform_super_admin' AND u.status='active' ORDER BY pra.created_at LIMIT 1");
  if (!admins[0]) throw new Error("active_platform_superadmin_required");
  actorId = String(admins[0].user_id);
  await pool.query("INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES (?,'Automatic Hotspot Live',?,'active','Asia/Shanghai',365,NULL,?,1,?,?)", [ids.organization, `hotspot-${requestId.slice(0, 8)}`, actorId, now, now]);
  await pool.query("INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,'default','active',?,1,?,?)", [ids.workspace, ids.organization, "默认工作区", actorId, now, now]);
  await pool.query("UPDATE organizations SET default_workspace_id=? WHERE id=?", [ids.workspace, ids.organization]);

  const service = new ProviderSourceService(new MySqlProviderSourceRepository(pool), () => now);
  const sync = await service.ensureCatalog();
  if (sync.status !== "synced") throw new Error("catalog_sync_waiting_for_platform_admin");
  const catalog = await service.list();
  const automatic = catalog.filter((item) => item.availability === "automatic" && item.provisioned?.status === "enabled");
  if (catalog.length < 100 || automatic.length < 80) throw new Error(`catalog_scope_insufficient:${catalog.length}/${automatic.length}`);

  const context = { actorId, idempotencyKey: `refresh-${requestId}`, requestId, traceId };
  const first = await service.refresh({ organization_id: ids.organization, workspace_id: ids.workspace }, context);
  const replay = await service.refresh({ organization_id: ids.organization, workspace_id: ids.workspace }, context);
  if (first.task_id !== replay.task_id || first.source_count < 80) throw new Error("manual_refresh_idempotency_or_scope_failed");

  await pool.query("INSERT INTO automatic_source_schedules (id,organization_id,workspace_id,last_task_id,provider_offset,last_scheduled_at,next_scheduled_at,updated_at) VALUES (?,?,?,NULL,0,NULL,'2000-01-01 00:00:00.000',?)", [randomUUID(), ids.organization, ids.workspace, now]);
  const scheduled = await new MySqlAutomaticSourceScheduler(pool, 16, () => now).processOnce();
  if (scheduled.status !== "scheduled" || scheduled.organizationId !== ids.organization || scheduled.workspaceId !== ids.workspace || scheduled.sourceCount !== 16 || !scheduled.taskId) throw new Error("automatic_scheduler_scope_failed");
  const [evidenceRows] = await pool.query("SELECT (SELECT COUNT(*) FROM collection_subqueries WHERE task_id=?) subqueries,(SELECT COUNT(*) FROM collection_task_events WHERE task_id=? AND event_type='hotspot.automatic.scheduled') events,(SELECT COUNT(*) FROM collection_task_outbox WHERE task_id=? AND event_type='hotspot.automatic.scheduled') outbox", [scheduled.taskId, scheduled.taskId, scheduled.taskId]);
  const evidence = evidenceRows[0];
  if (Number(evidence.subqueries) !== 16 || Number(evidence.events) !== 1 || Number(evidence.outbox) !== 1) throw new Error("automatic_scheduler_evidence_failed");

  await cleanup();
  await assertCleanup();
  console.log(JSON.stringify({ status: "passed", module: "M03-07", mysql: runtime.version, catalog_total: catalog.length, automatic_enabled: automatic.length, manual_refresh_sources: first.source_count, manual_refresh_idempotency: "passed", scheduled_sources: scheduled.sourceCount, task_event_outbox: "passed", organization_workspace_isolation: "passed", cleanup: "passed", request_id: requestId, trace_id: traceId }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "blocked", code: error?.code ?? "automatic_hotspot_live_failed", message: error instanceof Error ? error.message : "unknown", request_id: requestId, trace_id: traceId }));
  process.exitCode = 2;
} finally {
  await cleanup();
  await pool.end();
}
