import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { NotificationOutboxWorker } from "../apps/worker/dist/notification-outbox-worker.js";
import { RealtimeService } from "../apps/api/dist/realtime-service.js";
import { MySqlRealtimeRepository } from "../apps/api/dist/mysql-realtime-repository.js";
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
    task: randomUUID(),
  },
  events = [randomUUID(), randomUUID()];
async function migrate() {
  for (const [table, file] of [
    ["outbox_events", "database/migrations/0001_m00_01_foundation.up.sql"],
    ["audit_logs", "database/migrations/0006b_m00_06_audit_logs.up.sql"],
    ["notifications", "database/migrations/0018c_notifications_m05_03.up.sql"],
    ["realtime_events", "database/migrations/0018d_realtime_sse_m05_04.up.sql"],
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
    "DELETE FROM realtime_events WHERE organization_id IN (?,?)",
    "DELETE FROM notification_deliveries WHERE organization_id IN (?,?)",
    "DELETE FROM notifications WHERE organization_id IN (?,?)",
    "DELETE FROM notification_preferences WHERE organization_id IN (?,?)",
    "DELETE FROM audit_logs WHERE organization_id IN (?,?)",
    "DELETE FROM outbox_events WHERE organization_id IN (?,?)",
  ])
    try {
      await pool.query(q, [id.org, id.otherOrg]);
    } catch {}
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
    const e = `m0504-${n}-${requestId.slice(0, 8)}@test.local`;
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
      [o, `M05 ${n}`, `m0504-${n}-${requestId.slice(0, 8)}`, id.user, now, now],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [w, o, `M05 ${n}`, `m0504-${n}`, id.user, now, now],
    );
    await pool.query(
      "UPDATE organizations SET default_workspace_id=? WHERE id=?",
      [w, o],
    );
  }
  for (const event of events)
    await pool.query(
      "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (?,?,?,'task.created',1,?,'pending',0,?,?,?,?,?,1)",
      [
        event,
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
  if (!String(v[0].version).startsWith("5.7.") || v[0].charset !== "utf8mb4")
    throw new Error("mysql57 required");
  await migrate();
  await cleanup();
  await seed();
  const worker = new NotificationOutboxWorker(pool, 120, 3, () => now);
  await worker.processOnce();
  await worker.processOnce();
  const service = new RealtimeService(new MySqlRealtimeRepository(pool), 100),
    scope = {
      organizationId: id.org,
      workspaceId: id.ws,
      actorId: id.user,
      requestId,
      traceId,
    },
    all = await service.replay({ ...scope, afterId: 0 });
  if (all.length !== 2 || all[1].id <= all[0].id)
    throw new Error("monotonic replay failed");
  const resumed = await service.replay({ ...scope, afterId: all[0].id }),
    other = await service.replay({
      organizationId: id.otherOrg,
      workspaceId: id.otherWs,
      actorId: id.other,
      afterId: 0,
    });
  if (resumed.length !== 1 || resumed[0].id !== all[1].id || other.length !== 0)
    throw new Error("cursor or isolation failed");
  await service.auditConnect({ ...scope, afterId: all[0].id });
  const [counts] = await pool.query(
    "SELECT (SELECT COUNT(*) FROM realtime_events WHERE organization_id=? AND recipient_id=?) events,(SELECT COUNT(*) FROM audit_logs WHERE organization_id=? AND action='realtime.connected') audit",
    [id.org, id.user, id.org],
  );
  if (Number(counts[0].events) !== 2 || Number(counts[0].audit) !== 1)
    throw new Error("dedupe or audit failed");
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M05-04",
      mysql: v[0].version,
      monotonic_cursor: "passed",
      last_event_id_replay: "passed",
      notification_event_dedupe: "passed",
      organization_workspace_recipient_isolation: "passed",
      connection_audit: "passed",
      deployment_boundary: "S0_single_host",
      cleanup: "passed",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (e) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: e?.code ?? "realtime_live_failed",
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
