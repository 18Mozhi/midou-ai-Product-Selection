import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { HomeDashboardService } from "../apps/api/dist/home-dashboard-service.js";
import { MySqlHomeDashboardRepository } from "../apps/api/dist/mysql-home-dashboard-repository.js";

const requestId = randomUUID(),
  traceId = requestId,
  ids = {
    user: randomUUID(),
    otherUser: randomUUID(),
    org: randomUUID(),
    otherOrg: randomUUID(),
    workspace: randomUUID(),
    otherWorkspace: randomUUID(),
    task: randomUUID(),
    approvalTemplate: randomUUID(),
    approvalVersion: randomUUID(),
    approvalNode: randomUUID(),
    approvalRequest: randomUUID(),
    approvalRun: randomUUID(),
    opportunity: randomUUID(),
  },
  now = new Date(),
  pool = createDatabasePool(loadRuntimeConfig(process.env, "api"));

async function ensure() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='home_dashboard_items'",
  );
  if (Number(rows[0].count) === 0)
    await pool.query(
      await readFile("database/migrations/0015b_home_dashboard_m02_06.up.sql", "utf8"),
    );
}

async function cleanup() {
  try {
    await pool.query(
      "UPDATE organizations SET default_workspace_id=NULL WHERE LOWER(slug) REGEXP '^(m0[0-8]|test|qa|synthetic|fixture|acceptance)'",
    );
  } catch {}
  for (const [sql, values] of [
    ["DELETE FROM approval_node_runs WHERE id=?", [ids.approvalRun]],
    ["DELETE FROM approval_requests WHERE id=?", [ids.approvalRequest]],
    ["DELETE FROM approval_template_nodes WHERE id=?", [ids.approvalNode]],
    ["DELETE FROM approval_template_versions WHERE id=?", [ids.approvalVersion]],
    ["DELETE FROM approval_templates WHERE id=?", [ids.approvalTemplate]],
    ["DELETE FROM tasks WHERE id=?", [ids.task]],
    ["DELETE FROM opportunities WHERE id=?", [ids.opportunity]],
    ["DELETE FROM home_dashboard_items WHERE organization_id IN (?,?)", [ids.org, ids.otherOrg]],
    ["DELETE FROM workspaces WHERE id IN (?,?)", [ids.workspace, ids.otherWorkspace]],
    ["DELETE FROM organizations WHERE id IN (?,?)", [ids.org, ids.otherOrg]],
    ["DELETE FROM users WHERE id IN (?,?)", [ids.user, ids.otherUser]],
  ])
    try {
      await pool.query(sql, values);
    } catch {}
}

try {
  const [versionRows] = await pool.query(
      "SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name",
    ),
    runtime = versionRows[0];
  if (
    !String(runtime.version).startsWith("5.7.") ||
    runtime.charset !== "utf8mb4" ||
    runtime.database_name !== "product_scout" ||
    !String(runtime.account_name).startsWith("product_scout@")
  )
    throw new Error("requires MySQL57 utf8mb4 product_scout business account");
  await ensure();
  await cleanup();
  for (const [id, label] of [
    [ids.user, "viewer"],
    [ids.otherUser, "other"],
  ]) {
    const email = `m02-06-${label}-${requestId}@example.test`;
    await pool.query(
      "INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES (?,?,?,'live-probe','active',?,?,1,?,?)",
      [id, email, email, now, now, now, now],
    );
  }
  for (const [id, name, slug] of [
    [ids.org, "M02 Home Org", `home-${requestId.slice(0, 8)}`],
    [ids.otherOrg, "M02 Other Org", `other-${requestId.slice(0, 8)}`],
  ])
    await pool.query(
      "INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES (?,?,?,'active','Asia/Shanghai',365,NULL,?,1,?,?)",
      [id, name, slug, ids.user, now, now],
    );
  for (const [id, org, name, slug] of [
    [ids.workspace, ids.org, "Home Workspace", "home"],
    [ids.otherWorkspace, ids.otherOrg, "Other Workspace", "other"],
  ])
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [id, org, name, slug, ids.user, now, now],
    );

  await pool.query(
    "INSERT INTO tasks (id,organization_id,workspace_id,title,description,status,priority,assignee_id,source_type,source_ref_id,collection_task_id,due_at,completed_at,created_by,version,created_at,updated_at) VALUES (?,?,?,?,?,'paused','critical',?,'collection_followup',NULL,NULL,?,NULL,?,1,?,?)",
    [
      ids.task,
      ids.org,
      ids.workspace,
      "真实阻断任务",
      "验证阻断任务完整上下文",
      ids.user,
      new Date(now.getTime() - 60_000),
      ids.user,
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO approval_templates (id,organization_id,workspace_id,name,resource_type,status,current_version,revision,created_by,published_by,published_at,created_at,updated_at) VALUES (?,?,?,'今日行动审批','task','published',1,1,?,?,?, ?,?)",
    [ids.approvalTemplate, ids.org, ids.workspace, ids.user, ids.user, now, now, now],
  );
  await pool.query(
    "INSERT INTO approval_template_versions (id,template_id,organization_id,workspace_id,version_number,status,created_by,created_at,published_at) VALUES (?,?,?,?,1,'published',?,?,?)",
    [ids.approvalVersion, ids.approvalTemplate, ids.org, ids.workspace, ids.user, now, now],
  );
  await pool.query(
    "INSERT INTO approval_template_nodes (id,template_version_id,organization_id,workspace_id,ordinal,name,approver_id,sla_minutes,escalation_assignee_id) VALUES (?,?,?,?,1,'风险复核',?,60,?)",
    [ids.approvalNode, ids.approvalVersion, ids.org, ids.workspace, ids.user, ids.otherUser],
  );
  await pool.query(
    "INSERT INTO approval_requests (id,organization_id,workspace_id,template_id,template_version_id,resource_type,resource_id,title,status,current_node_ordinal,requested_by,completed_at,version,created_at,updated_at) VALUES (?,?,?,?,?,'task',?,'真实待审批事项','pending',1,?,NULL,1,?,?)",
    [
      ids.approvalRequest,
      ids.org,
      ids.workspace,
      ids.approvalTemplate,
      ids.approvalVersion,
      ids.task,
      ids.otherUser,
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO approval_node_runs (id,approval_request_id,organization_id,workspace_id,template_node_id,ordinal,name,approver_id,active_approver_id,escalation_assignee_id,status,due_at,escalated_at,decided_by,decision_reason,decided_at,version,created_at,updated_at) VALUES (?,?,?,?,?,1,'风险复核',?,?,?,'pending',?,NULL,NULL,NULL,NULL,1,?,?)",
    [
      ids.approvalRun,
      ids.approvalRequest,
      ids.org,
      ids.workspace,
      ids.approvalNode,
      ids.user,
      ids.user,
      ids.otherUser,
      new Date(now.getTime() + 3_600_000),
      now,
      now,
    ],
  );
  await pool.query(
    "INSERT INTO opportunities (id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) VALUES (?,?,?,'真实高价值机会','US','home-live','manual',NULL,?,'ready','recommend',92,88,84,'calculated','low','measured',86,1,1,'complete','home-live-v1',?,'pending',1,?,?,?)",
    [ids.opportunity, ids.org, ids.workspace, ids.user, now, ids.user, now, now],
  );

  const projectionRows = [
    [
      ids.org,
      ids.workspace,
      null,
      "action",
      "普通投影待办",
      "normal",
      "task:read",
      "/tasks/normal",
    ],
    [
      ids.org,
      ids.workspace,
      ids.user,
      "health",
      "本人健康告警",
      null,
      "task:read",
      "/platform-admin/collection",
    ],
    [
      ids.org,
      ids.workspace,
      ids.otherUser,
      "health",
      "他人健康告警",
      null,
      "task:read",
      "/platform-admin/collection",
    ],
    [ids.org, ids.workspace, null, "change", "无权变化", null, "platform:secure", "/trends/secure"],
    [
      ids.otherOrg,
      ids.otherWorkspace,
      null,
      "change",
      "其他组织变化",
      null,
      "task:read",
      "/trends/cross",
    ],
  ];
  for (const [org, ws, audience, kind, title, priority, capability, route] of projectionRows)
    await pool.query(
      "INSERT INTO home_dashboard_items (id,organization_id,workspace_id,audience_user_id,kind,title,reason,route,required_capability,priority,owner_label,due_at,source_count,observed_at,severity,source_version,created_at,updated_at) VALUES (?,?,?,?,?,?,'live evidence',?,?,?,'验证人',?,2,?,'warning',1,?,?)",
      [
        randomUUID(),
        org,
        ws,
        audience,
        kind,
        title,
        route,
        capability,
        priority,
        new Date(now.getTime() + 86_400_000),
        now,
        now,
        now,
      ],
    );
  const result = await new HomeDashboardService(
    new MySqlHomeDashboardRepository(pool),
    () => now,
  ).get({
    organizationId: ids.org,
    workspaceId: ids.workspace,
    actorId: ids.user,
    capabilities: ["task:read", "opportunity:read"],
  });
  for (const source of ["task", "approval", "opportunity", "projection"])
    if (!result.actions.some((item) => item.source_module === source))
      throw new Error(`cross-module action missing: ${source}`);
  if (result.actions[0].title !== "真实阻断任务" || result.actions[0].priority !== "overdue")
    throw new Error("deadline blocker risk priority mismatch");
  const blocked = result.actions.find((item) => item.id === ids.approvalRequest);
  if (!blocked?.blocked || blocked.route !== `/tasks/approvals?approval=${ids.approvalRequest}`)
    throw new Error("blocking context route mismatch");
  const opportunity = result.actions.find((item) => item.id === ids.opportunity);
  if (opportunity?.value_score !== 92 || opportunity.priority !== "high_value")
    throw new Error("opportunity value ordering mismatch");
  if (result.health.length !== 1 || result.health[0].title !== "本人健康告警")
    throw new Error("health audience mismatch");
  if (
    [...result.changes, ...result.health].some(
      (item) =>
        item.title.includes("其他") || item.title.includes("无权") || item.title.includes("他人"),
    )
  )
    throw new Error("scope capability or audience leak");
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M02-06",
      mysql: runtime.version,
      isolation: "organization_workspace_exact",
      audience: "current_user_health_only",
      capability: "filtered",
      cross_module_actions: "task_approval_opportunity_projection",
      ordering: "deadline_blocker_risk_value",
      context_routes: "passed",
      cleanup: "passed",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: error?.code ?? "home_dashboard_live_failed",
      message: error instanceof Error ? error.message : "unknown",
      request_id: requestId,
      trace_id: traceId,
    }),
  );
  process.exitCode = 2;
} finally {
  await cleanup();
  await pool.end();
}
