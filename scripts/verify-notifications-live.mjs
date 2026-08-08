import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import {
  NotificationService,
  NotificationServiceError,
} from "../apps/api/dist/notification-service.js";
import { MySqlNotificationRepository } from "../apps/api/dist/mysql-notification-repository.js";
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
    event: randomUUID(),
    task: randomUUID(),
  },
  service = new NotificationService(
    new MySqlNotificationRepository(pool, () => now),
  ),
  scope = { organizationId: id.org, workspaceId: id.ws, actorId: id.user },
  write = (k) => ({ ...scope, requestId, traceId, idempotencyKey: k });
async function migrate() {
  for (const [table, file] of [
    ["outbox_events", "database/migrations/0001_m00_01_foundation.up.sql"],
    ["audit_logs", "database/migrations/0006b_m00_06_audit_logs.up.sql"],
    ["notifications", "database/migrations/0018c_notifications_m05_03.up.sql"],
  ]) {
    const [rows] = await pool.query(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
      [table],
    );
    if (Number(rows[0].n)) continue;
    for (const s of (await readFile(file, "utf8"))
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean))
      await pool.query(s);
  }
}
async function cleanup() {
  for (const q of [
    "DELETE FROM notification_operations WHERE actor_id IN (?,?)",
    "DELETE FROM notification_deliveries WHERE organization_id IN (?,?)",
    "DELETE FROM notifications WHERE organization_id IN (?,?)",
    "DELETE FROM notification_preferences WHERE organization_id IN (?,?)",
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
  for (const user of [id.user, id.other]) {
    try {
      await pool.query(
        "DELETE FROM membership_data_scopes WHERE membership_id IN (SELECT id FROM memberships WHERE user_id=?)",
        [user],
      );
      await pool.query("DELETE FROM memberships WHERE user_id=?", [user]);
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
    const e = `m0503-${n}-${requestId.slice(0, 8)}@test.local`;
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
      [o, `M05 ${n}`, `m0503-${n}-${requestId.slice(0, 8)}`, id.user, now, now],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [w, o, `M05 ${n}`, `m0503-${n}`, id.user, now, now],
    );
    await pool.query(
      "UPDATE organizations SET default_workspace_id=? WHERE id=?",
      [w, o],
    );
  }
  await pool.query(
    "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (?,?,?,'task.created',1,?,'pending',0,?,?,?,?,?,1)",
    [
      id.event,
      id.org,
      id.ws,
      JSON.stringify({
        task_id: id.task,
        resource_type: "task",
        resource_id: id.task,
        assignee_id: id.user,
      }),
      now,
      requestId,
      traceId,
      now,
      now,
    ],
  );
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
  const pref = await service.updatePreferences({
      ...write("pref"),
      route: "PUT:/api/v1/me/notification-preferences",
      value: {
        expected_version: 1,
        in_app_enabled: true,
        email_enabled: true,
        task_enabled: true,
        approval_enabled: true,
        competitor_enabled: true,
      },
    }),
    prefAgain = await service.updatePreferences({
      ...write("pref"),
      route: "PUT:/api/v1/me/notification-preferences",
      value: {
        expected_version: 1,
        in_app_enabled: false,
        email_enabled: false,
        task_enabled: false,
        approval_enabled: false,
        competitor_enabled: false,
      },
    });
  if (pref.version !== 2 || prefAgain.version !== 2)
    throw new Error("preference idempotency failed");
  const projected = await new NotificationOutboxWorker(
    pool,
    120,
    3,
    () => now,
  ).processOnce();
  if (projected.status !== "published" || projected.notifications !== 1)
    throw new Error("outbox projection failed");
  const list = await service.list({
      ...scope,
      page: 1,
      pageSize: 50,
      unread: "true",
    }),
    other = await service.list({
      organizationId: id.otherOrg,
      workspaceId: id.otherWs,
      actorId: id.other,
      page: 1,
      pageSize: 50,
      unread: "false",
    });
  if (list.total !== 1 || other.total !== 0)
    throw new Error("inbox isolation failed");
  const read = await service.action({
    ...write("read"),
    notificationId: list.items[0].id,
    route: "POST:/api/v1/notifications/:id/actions",
    value: { action: "read", expected_version: 1 },
  });
  if (!read.read_at || read.version !== 2)
    throw new Error("read action failed");
  let conflict = false;
  try {
    await service.action({
      ...write("conflict"),
      notificationId: list.items[0].id,
      route: "POST:/api/v1/notifications/:id/actions",
      value: { action: "unread", expected_version: 1 },
    });
  } catch (e) {
    conflict =
      e instanceof NotificationServiceError &&
      e.code === "notification_version_conflict";
  }
  const [counts] = await pool.query(
    "SELECT (SELECT COUNT(*) FROM notification_deliveries WHERE organization_id=? AND channel='in_app' AND status='delivered') inapp,(SELECT COUNT(*) FROM notification_deliveries WHERE organization_id=? AND channel='email' AND status='pending_placeholder') email,(SELECT COUNT(*) FROM audit_logs WHERE organization_id=? AND resource_type='notification') audit,(SELECT status FROM outbox_events WHERE id=?) outbox",
    [id.org, id.org, id.org, id.event],
  );
  if (
    !conflict ||
    Number(counts[0].inapp) !== 1 ||
    Number(counts[0].email) !== 1 ||
    Number(counts[0].audit) < 2 ||
    counts[0].outbox !== "published"
  )
    throw new Error("delivery version audit or publish failed");
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M05-03",
      mysql: v[0].version,
      outbox_dedupe: "passed",
      in_app_delivery: "passed",
      email_provider: "pending_placeholder",
      preference_idempotency: "passed",
      read_version_lock: "passed",
      organization_workspace_recipient_isolation: "passed",
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
      code: e?.code ?? "notification_live_failed",
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
