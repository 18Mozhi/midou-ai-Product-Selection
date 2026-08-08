import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import {
  ApprovalService,
  ApprovalServiceError,
} from "../apps/api/dist/approval-service.js";
import { MySqlApprovalRepository } from "../apps/api/dist/mysql-approval-repository.js";
import { ApprovalEscalationWorker } from "../apps/worker/dist/approval-escalation-worker.js";
const pool = createDatabasePool(loadRuntimeConfig(process.env, "worker")),
  now = new Date(),
  requestId = randomUUID(),
  traceId = randomUUID(),
  id = {
    requester: randomUUID(),
    approver: randomUUID(),
    escalator: randomUUID(),
    org: randomUUID(),
    ws: randomUUID(),
    otherOrg: randomUUID(),
    otherWs: randomUUID(),
    task: randomUUID(),
  },
  service = new ApprovalService(new MySqlApprovalRepository(pool, () => now)),
  scope = { organizationId: id.org, workspaceId: id.ws },
  write = (actorId, key) => ({
    ...scope,
    actorId,
    requestId,
    traceId,
    idempotencyKey: key,
  });
async function migrate() {
  for (const [table, file] of [
    ["outbox_events", "database/migrations/0001_m00_01_foundation.up.sql"],
    ["audit_logs", "database/migrations/0006b_m00_06_audit_logs.up.sql"],
    ["tasks", "database/migrations/0018a_business_tasks_m05_01.up.sql"],
    [
      "approval_templates",
      "database/migrations/0018b_approval_workflow_m05_02.up.sql",
    ],
  ]) {
    const [rows] = await pool.query(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
      [table],
    );
    if (Number(rows[0].n)) continue;
    const sql = await readFile(file, "utf8");
    for (const statement of sql
      .split(";")
      .map((v) => v.replace(/^--.*$/gm, "").trim())
      .filter(Boolean))
      await pool.query(statement);
  }
}
async function cleanup() {
  for (const q of [
    "DELETE FROM approval_operations WHERE actor_id IN (?,?,?)",
    "DELETE FROM outbox_events WHERE organization_id IN (?,?)",
    "DELETE FROM audit_logs WHERE organization_id IN (?,?)",
    "DELETE FROM approval_escalation_jobs WHERE organization_id IN (?,?)",
    "DELETE FROM approval_actions WHERE organization_id IN (?,?)",
    "DELETE FROM approval_node_runs WHERE organization_id IN (?,?)",
    "DELETE FROM approval_requests WHERE organization_id IN (?,?)",
    "DELETE FROM approval_template_nodes WHERE organization_id IN (?,?)",
    "DELETE FROM approval_template_versions WHERE organization_id IN (?,?)",
    "DELETE FROM approval_templates WHERE organization_id IN (?,?)",
    "DELETE FROM task_events WHERE organization_id IN (?,?)",
    "DELETE FROM tasks WHERE organization_id IN (?,?)",
  ]) {
    try {
      await pool.query(
        q,
        q.includes("actor_id")
          ? [id.requester, id.approver, id.escalator]
          : [id.org, id.otherOrg],
      );
    } catch {}
  }
  for (const user of [id.requester, id.approver, id.escalator]) {
    try {
      await pool.query(
        "DELETE FROM membership_data_scopes WHERE membership_id IN (SELECT id FROM memberships WHERE user_id=?)",
        [user],
      );
      await pool.query("DELETE FROM memberships WHERE user_id=?", [user]);
    } catch {}
  }
  for (const [table, key] of [
    ["workspaces", id.ws],
    ["workspaces", id.otherWs],
    ["organizations", id.org],
    ["organizations", id.otherOrg],
    ["users", id.requester],
    ["users", id.approver],
    ["users", id.escalator],
  ])
    try {
      await pool.query(`DELETE FROM ${table} WHERE id=?`, [key]);
    } catch {}
}
async function seed() {
  for (const [u, n] of [
    [id.requester, "requester"],
    [id.approver, "approver"],
    [id.escalator, "escalator"],
  ]) {
    const e = `m0502-${n}-${requestId.slice(0, 8)}@test.local`;
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
      [
        o,
        `M05 ${n}`,
        `m0502-${n}-${requestId.slice(0, 8)}`,
        id.requester,
        now,
        now,
      ],
    );
    await pool.query(
      "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
      [w, o, `M05 ${n}`, `m0502-${n}`, id.requester, now, now],
    );
    await pool.query(
      "UPDATE organizations SET default_workspace_id=? WHERE id=?",
      [w, o],
    );
  }
  for (const u of [id.requester, id.approver, id.escalator]) {
    const m = randomUUID();
    await pool.query(
      "INSERT INTO memberships (id,organization_id,user_id,status,joined_at,version,created_at,updated_at) VALUES (?,?,?,'active',?,1,?,?)",
      [m, id.org, u, now, now, now],
    );
    await pool.query(
      "INSERT INTO membership_data_scopes (id,membership_id,scope_type,scope_key,workspace_id,team_id,created_by,version,created_at) VALUES (?,?,'workspace',?,?,NULL,?,1,?)",
      [randomUUID(), m, `workspace:${id.ws}`, id.ws, id.requester, now],
    );
  }
  await pool.query(
    "INSERT INTO tasks (id,organization_id,workspace_id,title,description,status,priority,assignee_id,source_type,source_ref_id,due_at,completed_at,created_by,version,created_at,updated_at) VALUES (?,?,?,'待审批任务','契约探针','todo','normal',?,'manual',NULL,NULL,NULL,?,1,?,?)",
    [id.task, id.org, id.ws, id.requester, id.requester, now, now],
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
  const draft = await service.createTemplate({
      ...write(id.requester, "tpl-create"),
      value: {
        name: "任务单节点审批",
        resource_type: "task",
        nodes: [
          {
            name: "业务复核",
            approver_id: id.approver,
            sla_minutes: 1,
            escalation_assignee_id: id.escalator,
          },
        ],
      },
    }),
    same = await service.createTemplate({
      ...write(id.requester, "tpl-create"),
      value: {
        name: "ignored",
        resource_type: "task",
        nodes: [
          {
            name: "ignored",
            approver_id: id.approver,
            sla_minutes: 1,
            escalation_assignee_id: id.escalator,
          },
        ],
      },
    });
  if (draft.id !== same.id) throw new Error("template idempotency failed");
  await service.publishTemplate({
    ...write(id.requester, "tpl-publish"),
    templateId: draft.id,
    value: { expected_revision: 1, reason: "用于真实任务复核" },
  });
  const created = await service.createRequest({
      ...write(id.requester, "req-create"),
      value: {
        template_id: draft.id,
        resource_type: "task",
        resource_id: id.task,
        title: "待审批任务复核",
      },
    }),
    again = await service.createRequest({
      ...write(id.requester, "req-create"),
      value: {
        template_id: draft.id,
        resource_type: "task",
        resource_id: id.task,
        title: "ignored",
      },
    });
  if (created.id !== again.id) throw new Error("request idempotency failed");
  let forbidden = false;
  try {
    await service.decide({
      ...write(id.requester, "wrong-decide"),
      requestIdValue: created.id,
      value: { action: "approve", expected_version: 1, reason: "越权" },
    });
  } catch (e) {
    forbidden =
      e instanceof ApprovalServiceError &&
      e.code === "approval_actor_forbidden";
  }
  if (!forbidden) throw new Error("approver guard failed");
  await pool.query(
    "UPDATE approval_escalation_jobs SET available_at=DATE_SUB(?,INTERVAL 1 MINUTE) WHERE approval_request_id=?",
    [now, created.id],
  );
  const escalated = await new ApprovalEscalationWorker(
    pool,
    "verify-m05-02",
    120,
    () => now,
  ).processOnce();
  if (!escalated.escalated) throw new Error("timeout escalation failed");
  const detail = await service.detail({
    ...scope,
    actorId: id.escalator,
    requestIdValue: created.id,
  });
  if (!detail.can_decide || detail.actions[0]?.action !== "escalated")
    throw new Error("escalation history failed");
  const rejected = await service.decide({
    ...write(id.escalator, "reject"),
    requestIdValue: created.id,
    value: { action: "reject", expected_version: 1, reason: "证据不足" },
  });
  if (rejected.status !== "rejected") throw new Error("reject failed");
  const created2 = await service.createRequest({
      ...write(id.requester, "req-create-2"),
      value: {
        template_id: draft.id,
        resource_type: "task",
        resource_id: id.task,
        title: "第二次复核",
      },
    }),
    approved = await service.decide({
      ...write(id.approver, "approve"),
      requestIdValue: created2.id,
      value: { action: "approve", expected_version: 1, reason: "证据完整" },
    });
  if (approved.status !== "approved") throw new Error("approve failed");
  const isolated = await service.listRequests({
    organizationId: id.otherOrg,
    workspaceId: id.otherWs,
    actorId: id.requester,
    page: 1,
    pageSize: 50,
    status: null,
    mine: false,
  });
  const [counts] = await pool.query(
    "SELECT (SELECT COUNT(*) FROM approval_actions WHERE organization_id=?) actions,(SELECT COUNT(*) FROM audit_logs WHERE organization_id=? AND resource_type IN ('approval_template','approval_request')) audit,(SELECT COUNT(*) FROM outbox_events WHERE organization_id=? AND event_type LIKE 'approval.%') outbox",
    [id.org, id.org, id.org],
  );
  if (
    isolated.total !== 0 ||
    Number(counts[0].actions) !== 3 ||
    Number(counts[0].audit) < 6 ||
    Number(counts[0].outbox) < 6
  )
    throw new Error("history isolation audit or outbox failed");
  await cleanup();
  console.log(
    JSON.stringify({
      status: "passed",
      module: "M05-02",
      mysql: v[0].version,
      template_publish: "passed",
      request_idempotency: "passed",
      approver_guard: "passed",
      timeout_escalates_without_decision: "passed",
      approve_reject_reasons: "passed",
      immutable_actions: Number(counts[0].actions),
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
      code: e?.code ?? "approval_live_failed",
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
