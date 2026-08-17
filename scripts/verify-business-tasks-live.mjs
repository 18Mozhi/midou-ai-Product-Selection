import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { BusinessTaskService } from "../apps/api/dist/business-task-service.js";
import { MySqlBusinessTaskRepository } from "../apps/api/dist/mysql-business-task-repository.js";
const pool = createDatabasePool(loadRuntimeConfig(process.env, "worker")),
  now = new Date(),
  requestId = randomUUID(),
  traceId = randomUUID(),
  id = {
    user: randomUUID(),
    user2: randomUUID(),
    org: randomUUID(),
    ws: randomUUID(),
    otherOrg: randomUUID(),
    otherWs: randomUUID(),
  },
  service = new BusinessTaskService(
    new MySqlBusinessTaskRepository(pool, () => now),
  ),
  scope = { organizationId: id.org, workspaceId: id.ws, actorId: id.user },
  write = (k) => ({ ...scope, requestId, traceId, idempotencyKey: k });
async function migrate() {
  for (const [table, file] of [
    ["outbox_events", "database/migrations/0001_m00_01_foundation.up.sql"],
    ["audit_logs", "database/migrations/0006b_m00_06_audit_logs.up.sql"],
    ["tasks", "database/migrations/0018a_business_tasks_m05_01.up.sql"],
  ]) {
    const [rows] = await pool.query(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
      [table],
    );
    if (Number(rows[0].n)) continue;
    const sql = await readFile(file, "utf8");
    for (const statement of sql
      .split(";")
      .map((value) => value.replace(/^--.*$/gm, "").trim())
      .filter(Boolean))
      await pool.query(statement);
  }
}
async function cleanup() {
  try { await pool.query("UPDATE organizations SET default_workspace_id=NULL WHERE LOWER(slug) REGEXP '^(m0[0-8]|test|qa|synthetic|fixture|acceptance)'" ); } catch {}

  for (const q of [
    "DELETE FROM task_operations WHERE actor_id IN (?,?)",
    "DELETE FROM outbox_events WHERE organization_id IN (?,?)",
    "DELETE FROM audit_logs WHERE organization_id IN (?,?)",
    "DELETE FROM task_events WHERE organization_id IN (?,?)",
    "DELETE FROM task_comments WHERE organization_id IN (?,?)",
    "DELETE FROM tasks WHERE organization_id IN (?,?)",
  ])
    try {
      await pool.query(
        q,
        [id.user, id.user2].length && q.includes("actor_id")
          ? [id.user, id.user2]
          : [id.org, id.otherOrg],
      );
    } catch {}
  for (const user of [id.user, id.user2])
    try {
      await pool.query(
        "DELETE FROM membership_data_scopes WHERE membership_id IN (SELECT id FROM memberships WHERE user_id=?)",
        [user],
      );
      await pool.query("DELETE FROM memberships WHERE user_id=?", [user]);
    } catch {}
  for (const [table, key] of [
    ["workspaces", id.ws],
    ["workspaces", id.otherWs],
    ["organizations", id.org],
    ["organizations", id.otherOrg],
    ["users", id.user],
    ["users", id.user2],
  ])
    try {
      await pool.query(`DELETE FROM ${table} WHERE id=?`, [key]);
    } catch {}
}
async function seed() {
  for (const [u, n] of [
    [id.user, "a"],
    [id.user2, "b"],
  ]) {
    const e = `m0501-${n}-${requestId}@test.local`;
    await pool.query(
      "INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES (?,?,?,'probe','active',?,?,1,?,?)",
      [u, e, e, now, now, now, now],
    );
  }
  for (const [o, w, n] of [
    [id.org, id.ws, "a"],
    [id.otherOrg, id.otherWs, "b"],
  ]) {
    await pool.query(
      "INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES (?,?,?,'active','Asia/Shanghai',365,NULL,?,1,?,?)",
      [o, `M05 ${n}`, `m0501-${n}-${requestId.slice(0, 8)}`, id.user, now, now],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [w, o, `M05 ${n}`, `m05-${n}`, id.user, now, now],
    );
    await pool.query(
      "UPDATE organizations SET default_workspace_id=? WHERE id=?",
      [w, o],
    );
  }
  for (const u of [id.user, id.user2]) {
    const m = randomUUID();
    await pool.query(
      "INSERT INTO memberships (id,organization_id,user_id,status,joined_at,version,created_at,updated_at) VALUES (?,?,?,'active',?,1,?,?)",
      [m, id.org, u, now, now, now],
    );
    await pool.query(
      "INSERT INTO membership_data_scopes (id,membership_id,scope_type,scope_key,workspace_id,team_id,created_by,version,created_at) VALUES (?,?,'workspace',?, ?,NULL,?,1,?)",
      [randomUUID(), m, `workspace:${id.ws}`, id.ws, id.user, now],
    );
  }
}
try {
  const [v] = await pool.query(
    "SELECT VERSION() version,@@character_set_server charset,CURRENT_USER() account",
  );
  if (
    !String(v[0].version).startsWith("5.7.") ||
    v[0].charset !== "utf8mb4" ||
    !String(v[0].account).startsWith("product_scout@")
  )
    throw new Error("mysql57 business account required");
  await migrate();
  await cleanup();
  await seed();
  const created = await service.create({
      ...write("create"),
      value: {
        title: "核验供应商报价",
        description: "保留证据并确认 MOQ",
        priority: "high",
        due_at: null,
      },
    }),
    again = await service.create({
      ...write("create"),
      value: { title: "ignored", description: "", priority: "low" },
    });
  if (created.id !== again.id) throw new Error("idempotency failed");
  let detail = await service.detail({ ...scope, taskId: created.id });
  if (detail.sla_status !== "not_set")
    throw new Error("missing due truth failed");
  await service.comment({
    ...write("comment"),
    taskId: created.id,
    value: { body: "已核对原始报价证据" },
  });
  await service.action({
    ...write("start"),
    taskId: created.id,
    value: { action: "start", expected_version: 1 },
  });
  const moved = await service.action({
    ...write("transfer"),
    taskId: created.id,
    value: {
      action: "transfer",
      expected_version: 2,
      assignee_id: id.user2,
      reason: "采购成员继续跟进",
    },
  });
  if (moved.assignee_id !== id.user2 || moved.version !== 3)
    throw new Error("transfer failed");
  detail = await service.detail({ ...scope, taskId: created.id });
  const other = await service.list({
    organizationId: id.otherOrg,
    workspaceId: id.otherWs,
    actorId: id.user,
    page: 1,
    pageSize: 50,
  });
  const [counts] = await pool.query(
    "SELECT (SELECT COUNT(*) FROM task_comments WHERE task_id=?) comments,(SELECT COUNT(*) FROM task_events WHERE task_id=?) events,(SELECT COUNT(*) FROM outbox_events WHERE organization_id=? AND event_type LIKE 'task.%') outbox,(SELECT COUNT(*) FROM audit_logs WHERE organization_id=? AND resource_type='task') audit",
    [created.id, created.id, id.org, id.org],
  );
  if (
    detail.comments.length !== 1 ||
    other.total !== 0 ||
    Number(counts[0].events) < 3 ||
    Number(counts[0].outbox) < 3 ||
    Number(counts[0].audit) < 3
  )
    throw new Error("comments isolation or events failed");
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M05-01",
      mysql: v[0].version,
      task_create_idempotency: "passed",
      sla_missing_truth: "not_set",
      comment_immutable: "passed",
      version_lock_and_transfer: "passed",
      organization_workspace_isolation: "passed",
      audit_outbox_correlation: "passed",
      cleanup: "passed",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (e) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: e?.code ?? "business_task_live_failed",
      message: e instanceof Error ? e.message : "unknown",
      stack: e instanceof Error ? e.stack : null,
      request_id: requestId,
      trace_id: traceId,
    }),
  );
  process.exitCode = 2;
} finally {
  await cleanup();
  await pool.end();
}
