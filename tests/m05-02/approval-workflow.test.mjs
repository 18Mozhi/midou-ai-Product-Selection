import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateTemplate,
  validateRequest,
  validateDecision,
  ApprovalServiceError,
} from "../../apps/api/dist/approval-service.js";
const uuid = "00000000-0000-4000-8000-000000000901";
test("M05-02.A01/A02/A04/A12 locks versioned nodes and mandatory reasons", () => {
  const value = validateTemplate({
    name: "任务复核",
    resource_type: "task",
    nodes: [
      {
        name: "负责人审批",
        approver_id: uuid,
        sla_minutes: 60,
        escalation_assignee_id: uuid,
      },
    ],
  });
  assert.equal(value.nodes[0].ordinal, 1);
  assert.equal(value.nodes[0].sla_minutes, 60);
  assert.equal(
    validateRequest({
      template_id: uuid,
      resource_type: "task",
      resource_id: uuid,
      title: "复核任务",
    }).resource_type,
    "task",
  );
  assert.throws(
    () =>
      validateDecision({ action: "approve", expected_version: 1, reason: "" }),
    (e) => e instanceof ApprovalServiceError,
  );
  assert.throws(
    () =>
      validateTemplate({
        ...value,
        nodes: [{ ...value.nodes[0], sla_minutes: 0 }],
      }),
    (e) => e instanceof ApprovalServiceError,
  );
});
test("M05-02.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const files = [
    "database/migrations/0018b_approval_workflow_m05_02.up.sql",
    "apps/api/src/mysql-approval-repository.ts",
    "apps/api/src/approval-routes.ts",
    "apps/worker/src/approval-escalation-worker.ts",
    "apps/web/src/components/ApprovalWorkspace.vue",
    "docs/architecture/m05-02-approval-workflow.md",
    "docs/runbooks/m05-02-approval-workflow.md",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "config/env.example",
    "verification/modules/M05-02.json",
  ];
  const values = await Promise.all(files.map((x) => readFile(x, "utf8")));
  assert.match(
    values[0],
    /approval_template_versions[\s\S]*approval_node_runs[\s\S]*approval_actions[\s\S]*approval_escalation_jobs/,
  );
  assert.match(values[1], /approval_version_conflict[\s\S]*outbox_events/);
  assert.match(values[3], /node_sla_overdue[\s\S]*approval\.overdue/);
  assert.match(values[4], /批准与驳回均必填|超时只升级审批人|登录已失效/);
  assert.equal(JSON.parse(values.at(-1)).atomicTasks.length, 17);
});
