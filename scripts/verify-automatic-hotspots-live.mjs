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
// Keep generated work future-dated so the production Worker cannot claim it
// while this probe verifies and removes its tenant-scoped fixture.
const schedulerNow = new Date(now.getTime() + 30 * 60_000);
const ids = { organization: randomUUID(), workspace: randomUUID() };
let actorId = "";
let stage = "runtime";

async function ensureMigration() {
  const sql = await readFile("database/migrations/0036_automatic_hotspot_sources.up.sql", "utf8");
  for (const statement of sql
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)) {
    const table = statement.match(/^CREATE TABLE `([^`]+)`/)?.[1];
    if (!table) throw new Error("unexpected_0036_migration_statement");
    const [rows] = await pool.query(
      "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
      [table],
    );
    if (Number(rows[0].count) === 0) throw new Error(`required_migration_table_missing:${table}`);
  }
}

async function cleanup() {
  await pool.query("DELETE FROM automatic_source_schedules WHERE organization_id=?", [
    ids.organization,
  ]);
  await pool.query(
    "DELETE FROM provider_refresh_operations WHERE task_id IN (SELECT id FROM collection_tasks WHERE organization_id=?)",
    [ids.organization],
  );
  await pool.query("DELETE FROM collection_task_outbox WHERE organization_id=?", [
    ids.organization,
  ]);
  await pool.query("DELETE FROM collection_task_events WHERE organization_id=?", [
    ids.organization,
  ]);
  await pool.query("DELETE FROM collection_subqueries WHERE organization_id=?", [ids.organization]);
  await pool.query("DELETE FROM collection_tasks WHERE organization_id=?", [ids.organization]);
  await pool.query("UPDATE organizations SET default_workspace_id=NULL WHERE id=?", [
    ids.organization,
  ]);
  await pool.query("DELETE FROM workspaces WHERE organization_id=?", [ids.organization]);
  await pool.query("DELETE FROM organizations WHERE id=?", [ids.organization]);
}

async function assertCleanup() {
  for (const [table, column, value] of [
    ["automatic_source_schedules", "organization_id", ids.organization],
    ["collection_tasks", "organization_id", ids.organization],
    ["workspaces", "organization_id", ids.organization],
    ["organizations", "id", ids.organization],
  ]) {
    const [rows] = await pool.query(`SELECT COUNT(*) count FROM ${table} WHERE ${column}=?`, [
      value,
    ]);
    if (Number(rows[0].count) !== 0) throw new Error(`live_cleanup_failed:${table}`);
  }
}

function tenantScopedSchedulerPool(organizationId) {
  return {
    async getConnection() {
      const connection = await pool.getConnection();
      const query = connection.query.bind(connection);
      connection.query = (sql, values = []) => {
        if (
          typeof sql === "string" &&
          sql.startsWith("INSERT IGNORE INTO automatic_source_schedules")
        )
          return Promise.resolve([{ affectedRows: 0 }, undefined]);
        if (
          typeof sql === "string" &&
          sql.includes("SELECT s.* FROM automatic_source_schedules s WHERE s.next_scheduled_at<=?")
        ) {
          sql = sql.replace("AND (SELECT COUNT(*)", "AND s.organization_id=? AND (SELECT COUNT(*)");
          values = [values[0], organizationId, values[1]];
        }
        return query(sql, values);
      };
      return connection;
    },
  };
}

try {
  stage = "mysql_identity";
  const [runtimeRows] = await pool.query(
    "SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name",
  );
  const runtime = runtimeRows[0];
  if (
    !String(runtime.version).startsWith("5.7.") ||
    runtime.charset !== "utf8mb4" ||
    runtime.database_name !== "product_scout" ||
    !String(runtime.account_name).startsWith("product_scout@")
  )
    throw new Error("requires_mysql57_utf8mb4_product_scout_business_account");

  stage = "schema_preflight";
  await ensureMigration();
  await cleanup();

  stage = "fixture_create";
  const [admins] = await pool.query(
    "SELECT pra.user_id FROM platform_role_assignments pra JOIN users u ON u.id=pra.user_id WHERE pra.role_code='platform_super_admin' AND u.status='active' ORDER BY pra.created_at LIMIT 1",
  );
  if (!admins[0]) throw new Error("active_platform_superadmin_required");
  actorId = String(admins[0].user_id);
  await pool.query(
    "INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES (?,'Automatic Hotspot Live',?,'active','Asia/Shanghai',365,NULL,?,1,?,?)",
    [ids.organization, `hotspot-${requestId.slice(0, 8)}`, actorId, now, now],
  );
  await pool.query(
    "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,'default','active',?,1,?,?)",
    [ids.workspace, ids.organization, "默认工作区", actorId, now, now],
  );
  await pool.query("UPDATE organizations SET default_workspace_id=? WHERE id=?", [
    ids.workspace,
    ids.organization,
  ]);

  stage = "catalog_readback";
  const repository = new MySqlProviderSourceRepository(pool);
  const service = new ProviderSourceService(repository, () => now);
  const catalog = await service.list();
  const codes = new Set(catalog.map((item) => item.code));
  if (!codes.has("google_news_search") || !codes.has("manual_product_supply_csv"))
    throw new Error("m03_07_blueprint_source_baseline_missing");
  if (catalog.length < 100) throw new Error(`catalog_scope_insufficient:${catalog.length}`);
  const [persistedCatalog] = await pool.query(
    `SELECT code FROM providers WHERE code IN (${catalog.map(() => "?").join(",")})`,
    catalog.map((item) => item.code),
  );
  const persistedCodes = new Set(persistedCatalog.map((item) => String(item.code)));
  if (persistedCodes.size < 100)
    throw new Error(`persisted_catalog_scope_insufficient:${persistedCodes.size}`);
  if (!persistedCodes.has("google_news_search") || !persistedCodes.has("manual_product_supply_csv"))
    throw new Error("persisted_blueprint_source_baseline_missing");

  stage = "source_compliance_readback";
  const [eligible] = await pool.query(
    [
      "SELECT id,code,parser_version FROM providers WHERE status='enabled' ",
      "AND terms_review_status='approved' AND terms_version IS NOT NULL ",
      "AND terms_expires_at>NOW(3) AND parser_version IN ",
      "('google-news-fixed-rss-v1','syndication-feed-v1','structured-public-page-v1') ",
      "ORDER BY code",
    ].join(""),
  );
  let manualRefresh = "blocked_by_compliance_gate";
  let manualTaskId = "";
  let manualSourceCount = 0;
  if (eligible.length > 0) {
    stage = "manual_refresh";
    const futureService = new ProviderSourceService(repository, () => schedulerNow);
    const context = { actorId, idempotencyKey: `refresh-${requestId}`, requestId, traceId };
    const first = await futureService.refresh(
      { organization_id: ids.organization, workspace_id: ids.workspace },
      context,
    );
    const replay = await futureService.refresh(
      { organization_id: ids.organization, workspace_id: ids.workspace },
      context,
    );
    if (first.task_id !== replay.task_id || first.source_count !== Math.min(100, eligible.length))
      throw new Error("manual_refresh_idempotency_or_scope_failed");
    manualRefresh = "scheduled_idempotently";
    manualTaskId = first.task_id;
    manualSourceCount = first.source_count;
  } else {
    stage = "manual_refresh_policy_gate";
    try {
      await service.refresh(
        { organization_id: ids.organization, workspace_id: ids.workspace },
        { actorId, idempotencyKey: `refresh-${requestId}`, requestId, traceId },
      );
      throw new Error("manual_refresh_bypassed_source_compliance_gate");
    } catch (error) {
      if (error?.code !== "provider_source_automatic_empty") throw error;
    }
  }

  stage = "schedule_fixture";
  await pool.query(
    "INSERT INTO automatic_source_schedules (id,organization_id,workspace_id,last_task_id,provider_offset,last_scheduled_at,next_scheduled_at,updated_at) VALUES (?,?,?,NULL,0,NULL,?,?)",
    [randomUUID(), ids.organization, ids.workspace, schedulerNow, now],
  );

  stage = "automatic_scheduler";
  const scheduled = await new MySqlAutomaticSourceScheduler(
    tenantScopedSchedulerPool(ids.organization),
    16,
    () => schedulerNow,
    { systemActorId: actorId, tenantActiveTaskBudget: 2, queueBacklogLimit: 1_000_000 },
  ).processFullOnce();

  let taskEventOutbox = "not_created_no_eligible_sources";
  let scheduledSourceCount = 0;
  if (eligible.length > 0) {
    if (
      scheduled.status !== "scheduled" ||
      scheduled.organizationId !== ids.organization ||
      scheduled.workspaceId !== ids.workspace ||
      scheduled.sourceCount !== Math.min(16, eligible.length) ||
      !scheduled.taskId
    )
      throw new Error("automatic_scheduler_scope_failed");
    const [evidenceRows] = await pool.query(
      "SELECT (SELECT COUNT(*) FROM collection_subqueries WHERE task_id=?) subqueries,(SELECT COUNT(*) FROM collection_task_events WHERE task_id=? AND event_type='hotspot.automatic.scheduled') events,(SELECT COUNT(*) FROM collection_task_outbox WHERE task_id=? AND event_type='hotspot.automatic.scheduled') outbox",
      [scheduled.taskId, scheduled.taskId, scheduled.taskId],
    );
    const evidence = evidenceRows[0];
    if (
      Number(evidence.subqueries) !== scheduled.sourceCount ||
      Number(evidence.events) !== 1 ||
      Number(evidence.outbox) !== 1
    )
      throw new Error("automatic_scheduler_evidence_failed");
    taskEventOutbox = "passed";
    scheduledSourceCount = scheduled.sourceCount;
  } else {
    if (scheduled.status !== "idle")
      throw new Error("scheduler_did_not_idle_without_eligible_sources");
    const [rows] = await pool.query(
      "SELECT (SELECT COUNT(*) FROM collection_tasks WHERE organization_id=?) tasks,(SELECT COUNT(*) FROM collection_task_events WHERE organization_id=?) events,(SELECT COUNT(*) FROM collection_task_outbox WHERE organization_id=?) outbox,(SELECT next_scheduled_at FROM automatic_source_schedules WHERE organization_id=? LIMIT 1) next_scheduled_at",
      [ids.organization, ids.organization, ids.organization, ids.organization],
    );
    if (Number(rows[0].tasks) !== 0 || Number(rows[0].events) !== 0 || Number(rows[0].outbox) !== 0)
      throw new Error("no_source_scheduler_created_persisted_work");
    if (new Date(rows[0].next_scheduled_at).getTime() <= now.getTime())
      throw new Error("no_source_scheduler_did_not_defer");
  }

  stage = "cleanup";
  await cleanup();
  await assertCleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M03-07",
      mysql: runtime.version,
      catalog_total: catalog.length,
      persisted_catalog_total: persistedCodes.size,
      blueprint_sources_present: true,
      terms_eligible_automatic_sources: eligible.length,
      compliance_gate:
        eligible.length > 0 ? "approved_sources_only" : "no_sources_enabled_until_owner_review",
      manual_refresh: manualRefresh,
      manual_refresh_source_count: manualSourceCount,
      manual_refresh_task_created: Boolean(manualTaskId),
      scheduler: scheduled.status,
      scheduled_sources: scheduledSourceCount,
      task_event_outbox: taskEventOutbox,
      organization_workspace_isolation: "passed",
      production_worker_claim_risk: "avoided_future_available_at_and_tenant_scope",
      cleanup: "passed",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: error?.code ?? "automatic_hotspot_live_failed",
      message: error instanceof Error ? error.message : "unknown",
      stage,
      request_id: requestId,
      trace_id: traceId,
    }),
  );
  process.exitCode = 2;
} finally {
  try {
    await cleanup();
    await assertCleanup();
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "blocked",
        code: "live_cleanup_failed",
        message: error instanceof Error ? error.message : "unknown",
        request_id: requestId,
        trace_id: traceId,
      }),
    );
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
}
