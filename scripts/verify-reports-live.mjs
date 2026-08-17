import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import {
  ReportService,
  ReportServiceError,
} from "../apps/api/dist/report-service.js";
import { MySqlReportRepository } from "../apps/api/dist/mysql-report-repository.js";
import { ReportExportWorker } from "../apps/worker/dist/report-export-worker.js";
const pool = createDatabasePool(loadRuntimeConfig(process.env, "worker")),
  now = new Date(),
  requestId = randomUUID(),
  traceId = randomUUID(),
  root = resolve(tmpdir(), `scoutops-m05-06-${requestId}`),
  id = {
    user: randomUUID(),
    other: randomUUID(),
    org: randomUUID(),
    ws: randomUUID(),
    otherOrg: randomUUID(),
    otherWs: randomUUID(),
    member: randomUUID(),
    scope: randomUUID(),
    opp: randomUUID(),
    trend: randomUUID(),
    task: randomUUID(),
  },
  repo = new MySqlReportRepository(pool, () => now),
  service = new ReportService(repo, root, 24),
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
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='report_exports'",
  );
  if (Number(rows[0].n)) return;
  for (const s of (
    await readFile("database/migrations/0018f_reports_m05_06.up.sql", "utf8")
  )
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean))
    await pool.query(s);
}
async function cleanup() {
  try { await pool.query("UPDATE organizations SET default_workspace_id=NULL WHERE LOWER(slug) REGEXP '^(m0[0-8]|test|qa|synthetic|fixture|acceptance)'" ); } catch {}

  for (const q of [
    "DELETE FROM report_export_operations WHERE actor_id IN (?,?)",
    "DELETE FROM report_exports WHERE organization_id IN (?,?)",
    "DELETE FROM task_events WHERE organization_id IN (?,?)",
    "DELETE FROM tasks WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_events WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_outbox WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_decisions WHERE organization_id IN (?,?)",
    "DELETE FROM opportunity_evidence_links WHERE organization_id IN (?,?)",
    "DELETE FROM opportunities WHERE organization_id IN (?,?)",
    "DELETE FROM trend_topic_follows WHERE organization_id IN (?,?)",
    "DELETE FROM trend_topic_keywords WHERE organization_id IN (?,?)",
    "DELETE FROM trend_signals WHERE organization_id IN (?,?)",
    "DELETE FROM trend_topics WHERE organization_id IN (?,?)",
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
  for (const u of [id.user, id.other])
    try {
      await pool.query(
        "DELETE FROM membership_data_scopes WHERE membership_id IN (SELECT id FROM memberships WHERE user_id=?)",
        [u],
      );
      await pool.query("DELETE FROM memberships WHERE user_id=?", [u]);
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
  await rm(root, { recursive: true, force: true });
}
async function seed() {
  for (const [u, n] of [
    [id.user, "a"],
    [id.other, "b"],
  ]) {
    const e = `m0506-${n}-${requestId.slice(0, 8)}@test.local`;
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
      [o, `M05 ${n}`, `m0506-${n}-${requestId.slice(0, 8)}`, id.user, now, now],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [w, o, `M05 ${n}`, `m0506-${n}`, id.user, now, now],
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
  await pool.query(
    "INSERT INTO opportunities (id,organization_id,workspace_id,name,market,category,source_type,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,decision_status,version,created_by,created_at,updated_at) VALUES (?,?,?,'=公式注入机会','US','test','manual',?,'adopted','recommend',88,90,70,'calculated','low','measured',80,3,2,'complete','adopted',1,?,?,?)",
    [id.opp, id.org, id.ws, id.user, id.user, now, now],
  );
  await pool.query(
    "INSERT INTO trend_topics (id,organization_id,workspace_id,topic_key,title,category,market,language,status,signal_count,source_count,heat_value,heat_unit,momentum_percent,confidence_score,confidence_status,first_seen_at,last_seen_at,source_fresh_at,version,created_by,created_at,updated_at) VALUES (?,?,?,?,'测试趋势','test','US','zh-CN','active',4,2,4,'signals',12,75,'measured',?,?,?,1,?,?,?)",
    [id.trend, id.org, id.ws, "a".repeat(64), now, now, now, id.user, now, now],
  );
  await pool.query(
    "INSERT INTO tasks (id,organization_id,workspace_id,title,description,status,priority,assignee_id,source_type,due_at,created_by,version,created_at,updated_at) VALUES (?,?,?,'报告任务','事实任务','completed','normal',?,'manual',NULL,?,1,?,?)",
    [id.task, id.org, id.ws, id.user, id.user, now, now],
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
  const opportunity = await service.report({
      ...ctx("read"),
      reportType: "opportunity",
    }),
    trend = await service.report({ ...ctx("read"), reportType: "trend" }),
    team = await service.report({ ...ctx("read"), reportType: "team" });
  if (
    opportunity.summary.total !== 1 ||
    opportunity.summary.average_score !== 88 ||
    trend.summary.signals !== 4 ||
    team.summary.completed !== 1
  )
    throw new Error("truthful aggregates failed");
  const created = await service.createExport({
      ...ctx("create"),
      value: { report_type: "opportunity", format: "csv" },
    }),
    again = await service.createExport({
      ...ctx("create"),
      value: { report_type: "trend", format: "csv" },
    });
  if (created.id !== again.id) throw new Error("export idempotency failed");
  const result = await new ReportExportWorker(
    pool,
    "m05-06-probe",
    root,
    120,
    3,
    100,
    () => now,
  ).processOnce();
  if (result.status !== "succeeded" || result.row_count !== 1)
    throw new Error("export worker failed");
  const download = await service.download({
      ...ctx("download"),
      exportId: created.id,
    }),
    csv = download.content.toString("utf8");
  if (!csv.includes("'=公式注入机会"))
    throw new Error("csv injection guard failed");
  let isolated = false;
  try {
    await service.download({
      organizationId: id.otherOrg,
      workspaceId: id.otherWs,
      actorId: id.other,
      exportId: created.id,
    });
  } catch (e) {
    isolated =
      e instanceof ReportServiceError && e.code === "report_export_not_found";
  }
  await pool.query(
    "UPDATE report_exports SET expires_at=DATE_SUB(?,INTERVAL 1 SECOND) WHERE id=?",
    [now, created.id],
  );
  await new ReportExportWorker(
    pool,
    "m05-06-probe",
    root,
    120,
    3,
    100,
    () => now,
  ).processOnce();
  const expired = await service.detail({
      ...ctx("expired"),
      exportId: created.id,
    }),
    other = await service.listExports({
      organizationId: id.otherOrg,
      workspaceId: id.otherWs,
      actorId: id.other,
    }),
    [counts] = await pool.query(
      "SELECT (SELECT COUNT(*) FROM audit_logs WHERE organization_id=? AND resource_type='report_export') audits,(SELECT COUNT(*) FROM outbox_events WHERE organization_id=? AND event_type LIKE 'report.export.%') events",
      [id.org, id.org],
    );
  if (
    !isolated ||
    expired.status !== "expired" ||
    other.length !== 0 ||
    Number(counts[0].audits) < 2 ||
    Number(counts[0].events) < 2
  )
    throw new Error("lifecycle isolation audit or outbox failed");
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M05-06",
      mysql: v[0].version,
      opportunity_report: "passed",
      trend_report: "passed",
      team_report: "passed",
      async_csv: "passed",
      formula_injection_guard: "passed",
      idempotency: "passed",
      expiry_cleanup: "passed",
      tenant_file_isolation: "passed",
      audit_outbox: "passed",
      cleanup: "passed",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (e) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: e?.code ?? "reports_live_failed",
      message: e instanceof Error ? e.message : "unknown",
      stack: e instanceof Error ? e.stack : null,
      request_id: requestId,
      trace_id: traceId,
      temporary_root: root,
    }),
  );
  process.exitCode = 2;
} finally {
  await cleanup();
  await pool.end();
}
