import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import {
  AutomationService,
  AutomationServiceError,
} from "../apps/api/dist/automation-service.js";
import { MySqlAutomationRepository } from "../apps/api/dist/mysql-automation-repository.js";
import { AutomationWorker } from "../apps/worker/dist/automation-worker.js";
import { NotificationOutboxWorker } from "../apps/worker/dist/notification-outbox-worker.js";
const pool = createDatabasePool(loadRuntimeConfig(process.env, "worker")),
  now = new Date(),
  requestId = randomUUID(),
  traceId = randomUUID(),
  id = {
    user: randomUUID(),
    other: randomUUID(),
    org: randomUUID(),
    ws: randomUUID(),
    otherOrg: randomUUID(),
    otherWs: randomUUID(),
    member: randomUUID(),
    scope: randomUUID(),
    event1: randomUUID(),
    event2: randomUUID(),
    event3: randomUUID(),
    notification1: randomUUID(),
    notification2: randomUUID(),
    notification3: randomUUID(),
  },
  service = new AutomationService(
    new MySqlAutomationRepository(pool, () => now),
    20,
  ),
  ctx = (k) => ({
    organizationId: id.org,
    workspaceId: id.ws,
    actorId: id.user,
    requestId,
    traceId,
    idempotencyKey: k,
  });
async function migrate() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='automation_rules'",
  );
  if (Number(rows[0].n)) return;
  for (const s of (
    await readFile(
      "database/migrations/0018e_automation_rules_m05_05.up.sql",
      "utf8",
    )
  )
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean))
    await pool.query(s);
}
async function cleanup() {
  for (const q of [
    "DELETE FROM realtime_events WHERE organization_id IN (?,?)",
    "DELETE FROM notification_deliveries WHERE organization_id IN (?,?)",
    "DELETE FROM automation_operations WHERE actor_id IN (?,?)",
    "DELETE FROM automation_executions WHERE organization_id IN (?,?)",
    "DELETE FROM automation_rules WHERE organization_id IN (?,?)",
    "DELETE FROM notifications WHERE organization_id IN (?,?)",
    "DELETE FROM task_events WHERE organization_id IN (?,?)",
    "DELETE FROM tasks WHERE organization_id IN (?,?) AND source_type='automation'",
    "DELETE FROM audit_logs WHERE organization_id IN (?,?)",
    "DELETE FROM outbox_events WHERE organization_id IN (?,?)",
  ]) {
    try {
      await pool.query(
        q,
        q.includes("actor_id") ? [id.user, id.other] : [id.org, id.otherOrg],
      );
    } catch {}
  }
  for (const u of [id.user, id.other]) {
    try {
      await pool.query(
        "DELETE FROM membership_data_scopes WHERE membership_id IN (SELECT id FROM memberships WHERE user_id=?)",
        [u],
      );
      await pool.query("DELETE FROM memberships WHERE user_id=?", [u]);
    } catch {}
  }
  for (const [t, k] of [
    ["workspaces", id.ws],
    ["workspaces", id.otherWs],
    ["organizations", id.org],
    ["organizations", id.otherOrg],
    ["users", id.user],
    ["users", id.other],
  ])
    try {
      await pool.query(`DELETE FROM ${t} WHERE id=?`, [k]);
    } catch {}
}
async function seed() {
  for (const [u, n] of [
    [id.user, "a"],
    [id.other, "b"],
  ]) {
    const e = `m0505-${n}-${requestId.slice(0, 8)}@test.local`;
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
      [o, `M05 ${n}`, `m0505-${n}-${requestId.slice(0, 8)}`, id.user, now, now],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [w, o, `M05 ${n}`, `m0505-${n}`, id.user, now, now],
    );
    await pool.query(
      "UPDATE organizations SET default_workspace_id=? WHERE id=?",
      [w, o],
    );
  }
  await pool.query(
    "INSERT INTO memberships (id,organization_id,user_id,status,joined_at,version,created_at,updated_at) VALUES (?,?,?,'active',?,1,?,?)",
    [id.member, id.org, id.user, now, now, now],
  );
  await pool.query(
    "INSERT INTO membership_data_scopes (id,membership_id,scope_type,scope_key,workspace_id,team_id,created_by,version,created_at) VALUES (?,?,'workspace',?,?,NULL,?,1,?)",
    [id.scope, id.member, id.ws, id.ws, id.user, now],
  );
  for (const [e, n, event, severity] of [
    [id.event1, id.notification1, "approval.overdue", "warning"],
    [id.event2, id.notification2, "competitor.alert.queued", "critical"],
    [id.event3, id.notification3, "approval.overdue", "warning"],
  ]) {
    await pool.query(
      "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version,payload_json,status,attempt_count,available_at,published_at,request_id,trace_id,created_at,updated_at,version) VALUES (?,?,?,?,1,?,'published',0,?,?,?,?,?,?,1)",
      [
        e,
        id.org,
        id.ws,
        event,
        JSON.stringify({ resource_type: "probe", resource_id: e }),
        now,
        now,
        requestId,
        traceId,
        now,
        now,
      ],
    );
    await pool.query(
      "INSERT INTO notifications (id,organization_id,workspace_id,recipient_id,source_event_id,category,severity,title,body,resource_type,resource_id,version,created_at,updated_at) VALUES (?,?,?,?,?,'system',?,?,?,'probe',?,1,?,?)",
      [
        n,
        id.org,
        id.ws,
        id.user,
        e,
        severity,
        event,
        "real source event",
        e,
        now,
        now,
      ],
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
  const notify = await service.create({
      ...ctx("create-notify"),
      value: {
        name: "审批超时提醒",
        trigger_event_type: "approval.overdue",
        condition_severity: "warning",
        action_type: "notify_owner",
        owner_id: id.user,
        action_title: "审批超时，请人工处理",
        rate_limit_count: 1,
        rate_limit_window_minutes: 60,
      },
    }),
    task = await service.create({
      ...ctx("create-task"),
      value: {
        name: "竞品告警任务",
        trigger_event_type: "competitor.alert.queued",
        condition_severity: "critical",
        action_type: "create_task",
        owner_id: id.user,
        action_assignee_id: id.user,
        action_title: "复核竞品告警",
        rate_limit_count: 5,
        rate_limit_window_minutes: 60,
      },
    }),
    worker = new AutomationWorker(pool, "m05-05-probe", 120, 3, () => now),
    first = await worker.processOnce(),
    second = await worker.processOnce(),
    third = await worker.processOnce();
  const states = [first.status, second.status, third.status];
  if (
    states.filter((status) => status === "succeeded").length !== 2 ||
    states.filter((status) => status === "rate_limited").length !== 1
  )
    throw new Error(
      `execution states failed ${first.status}/${second.status}/${third.status}`,
    );
  const notificationWorker = new NotificationOutboxWorker(
    pool,
    120,
    3,
    () => now,
  );
  let automationNotificationPublished = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const projected = await notificationWorker.processOnce();
    if (projected.status === "idle") break;
    const [event] = await pool.query(
      "SELECT event_type FROM outbox_events WHERE id=?",
      [projected.event_id],
    );
    if (event[0]?.event_type === "automation.notification.queued") {
      automationNotificationPublished = true;
      break;
    }
  }
  if (!automationNotificationPublished)
    throw new Error("automation notification projection failed");
  const paused = await service.changeStatus({
    ...ctx("pause"),
    ruleId: notify.id,
    value: { action: "pause", expected_version: 1, reason: "故障演练暂停" },
  });
  let conflict = false;
  try {
    await service.changeStatus({
      ...ctx("conflict"),
      ruleId: notify.id,
      value: { action: "resume", expected_version: 1, reason: "旧版本" },
    });
  } catch (e) {
    conflict =
      e instanceof AutomationServiceError &&
      e.code === "automation_version_conflict";
  }
  const other = await service.list({
      organizationId: id.otherOrg,
      workspaceId: id.otherWs,
      actorId: id.other,
    }),
    [counts] = await pool.query(
      "SELECT (SELECT COUNT(*) FROM tasks WHERE organization_id=? AND source_type='automation') tasks,(SELECT COUNT(*) FROM notifications WHERE organization_id=? AND category='system' AND source_event_id NOT IN (?,?,?)) system_notifications,(SELECT COUNT(*) FROM automation_executions WHERE organization_id=? AND status='rate_limited') limited,(SELECT COUNT(*) FROM audit_logs WHERE organization_id=? AND resource_type='automation_rule') audits",
      [id.org, id.org, id.event1, id.event2, id.event3, id.org, id.org],
    );
  if (
    !conflict ||
    paused.version !== 2 ||
    other.length !== 0 ||
    Number(counts[0].tasks) !== 1 ||
    Number(counts[0].system_notifications) !== 1 ||
    Number(counts[0].limited) !== 1 ||
    Number(counts[0].audits) < 4
  )
    throw new Error("isolation action rate audit or version assertion failed");
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M05-05",
      mysql: v[0].version,
      notification_action: "passed",
      automation_task: "passed",
      dedupe: "passed",
      rate_limit: "passed",
      pause_version_lock: "passed",
      tenant_isolation: "passed",
      audit_correlation: "passed",
      cleanup: "passed",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (e) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: e?.code ?? "automation_live_failed",
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
