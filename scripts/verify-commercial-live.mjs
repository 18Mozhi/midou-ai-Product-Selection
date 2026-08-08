import { randomUUID } from "node:crypto";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { CommercialService } from "../apps/api/dist/commercial-service.js";
import { MySqlCommercialRepository } from "../apps/api/dist/mysql-commercial-repository.js";

const pool = createDatabasePool(loadRuntimeConfig(process.env, "api"));
const now = new Date();
const requestId = randomUUID();
const traceId = randomUUID();
const ids = { user: randomUUID(), organization: randomUUID(), client: randomUUID() };
const service = new CommercialService(new MySqlCommercialRepository(pool, () => now), 50);
const context = (idempotencyKey) => ({ actorId: ids.user, idempotencyKey, requestId, traceId });

async function clean() {
  const statements = [
    ["DELETE FROM commercial_views WHERE actor_id=?", [ids.user]],
    ["DELETE FROM commercial_events WHERE actor_id=?", [ids.user]],
    ["DELETE FROM commercial_quota_adjustments WHERE organization_id=?", [ids.organization]],
    ["DELETE FROM organization_plan_assignments WHERE organization_id=?", [ids.organization]],
    ["DELETE FROM commercial_plans WHERE created_by=?", [ids.user]],
    ["DELETE FROM commercial_operations WHERE actor_id=?", [ids.user]],
    ["DELETE FROM open_api_usage WHERE organization_id=?", [ids.organization]],
    ["DELETE FROM platform_api_clients WHERE organization_id=?", [ids.organization]],
    ["DELETE FROM outbox_events WHERE organization_id=?", [ids.organization]],
    ["DELETE FROM platform_audit_events WHERE actor_id=?", [ids.user]],
    ["DELETE FROM organizations WHERE id=?", [ids.organization]],
    ["DELETE FROM users WHERE id=?", [ids.user]]
  ];
  for (const [sql, parameters] of statements) {
    try { await pool.query(sql, parameters); } catch {}
  }
}

try {
  const [server] = await pool.query("SELECT VERSION() version,@@character_set_server charset,CURRENT_USER() account");
  if (!String(server[0].version).startsWith("5.7.") || server[0].charset !== "utf8mb4") throw new Error("mysql57 required");
  await clean();
  const email = `m0606-${requestId.slice(0, 8)}@test.local`;
  await pool.query("INSERT INTO users(id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES(?,?,?,'probe','active',?,?,1,?,?)", [ids.user, email, email, now, now, now, now]);
  await pool.query("INSERT INTO organizations(id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES(?,?,?,'active','Asia/Shanghai',365,NULL,?,1,?,?)", [ids.organization, "M06 Commercial", `m0606-${requestId.slice(0, 8)}`, ids.user, now, now]);

  const plan = await service.createPlan({ ...context("plan-create"), value: { code: `verify_${requestId.slice(0, 8)}`, name: "Verification Plan", description: "quota only", quotas: { collection_tasks: 100, open_api_requests: 1000, report_exports: 20 }, reason: "verification" } });
  const replay = await service.createPlan({ ...context("plan-create"), value: { code: `ignored_${requestId.slice(0, 8)}`, name: "Ignored", description: null, quotas: { collection_tasks: 1 }, reason: "verification replay" } });
  if (replay.id !== plan.id || replay.idempotent_replay !== true) throw new Error("commercial idempotency replay mismatch");
  const active = await service.updatePlan({ ...context("plan-active"), planId: plan.id, value: { name: "Verification Plan", description: "quota only", quotas: { collection_tasks: 100, open_api_requests: 1000, report_exports: 20 }, status: "active", expected_version: 1, reason: "verification" } });
  const assignment = await service.assign({ ...context("assign"), value: { organization_id: ids.organization, plan_id: plan.id, period_start: new Date(now.getTime() - 3_600_000).toISOString(), period_end: new Date(now.getTime() + 86_400_000).toISOString(), reason: "verification" } });
  await service.adjust({ ...context("adjust"), value: { organization_id: ids.organization, assignment_id: assignment.id, quota_key: "open_api_requests", delta_value: 50, effective_at: now.toISOString(), reason: "verification" } });

  await pool.query("INSERT INTO platform_api_clients(id,organization_id,name,client_prefix,secret_hash,scopes_json,quota_per_minute,status,expires_at,last_used_at,rotated_from_id,version,created_by,created_at,updated_at) VALUES(?,?,?,'verify','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','[\"status:read\"]',10,'active',?,NULL,NULL,1,?,?,?)", [ids.client, ids.organization, "verify", new Date(now.getTime() + 86_400_000), ids.user, now, now]);
  await pool.query("INSERT INTO open_api_usage(id,client_id,organization_id,route_key,outcome,status_code,request_id,trace_id,occurred_at) VALUES(?,?,?,'GET:/open/v1/status','succeeded',200,?,?,?)", [randomUUID(), ids.client, ids.organization, requestId, traceId, now]);
  const result = await service.read({ actorId: ids.user, organizationId: ids.organization, requestId, traceId });
  if (result.assignment.plan_id !== plan.id || result.usage.open_api_requests !== 1 || result.effective_quotas.open_api_requests !== 1050) throw new Error("commercial usage or adjustment mismatch");
  if ("price" in result.plans[0] || "payment" in result.plans[0]) throw new Error("payment boundary violated");
  const [[evidence]] = await pool.query("SELECT (SELECT COUNT(*) FROM platform_audit_events WHERE actor_id=?) audits,(SELECT COUNT(*) FROM commercial_events WHERE actor_id=?) events,(SELECT COUNT(*) FROM outbox_events WHERE organization_id=?) outbox", [ids.user, ids.user, ids.organization]);
  if (Number(evidence.audits) < 5 || Number(evidence.events) < 5 || Number(evidence.outbox) < 2) throw new Error("commercial audit or event missing");
  await clean();
  console.log(JSON.stringify({ status: "passed", module: "M06-06", mysql: server[0].version, plan_version: active.version, idempotency: "passed", usage_truth: "passed", adjustment: "passed", payment_boundary: "absent", audit_event_outbox: "passed", cleanup: "passed", request_id: requestId, trace_id: traceId }, null, 2));
} catch (error) {
  await clean();
  throw error;
} finally {
  await pool.end();
}
