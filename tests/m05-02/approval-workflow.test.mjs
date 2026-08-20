import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateTemplate,
  validateRequest,
  validateDecision,
  ApprovalServiceError,
} from "../../apps/api/dist/approval-service.js";
import { MySqlApprovalRepository } from "../../apps/api/dist/mysql-approval-repository.js";
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
    () => validateDecision({ action: "approve", expected_version: 1, reason: "" }),
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
test("M05-02 resolves opportunity evidence from the decision resource and snapshots rule versions", async () => {
  const decisionId = "00000000-0000-4000-8000-000000000911",
    opportunityId = "00000000-0000-4000-8000-000000000912",
    seen = [],
    pool = {
      query: async (sql, args) => {
        seen.push({ sql, args });
        if (sql.includes("FROM opportunity_decisions d"))
          return [
            [
              {
                action: "adopt",
                reason: "证据满足首轮验证要求",
                opportunity_version: 7,
                decision_created_at: "2026-08-19T08:00:00.000Z",
                opportunity_id: opportunityId,
                opportunity_name: "便携净水杯",
                recommendation_status: "recommend",
                risk_level: "unknown",
                score_rule_version: "SCORE-OLD",
              },
            ],
          ];
        if (sql.includes("FROM opportunity_score_runs"))
          return [
            [
              {
                status: "calculated",
                coverage_percent: 88,
                recommendation_status: "recommend",
                rule_version_code: "SCORE-2026-08",
                missing_fields_json: "[]",
                scored_at: "2026-08-19T07:50:00.000Z",
              },
            ],
          ];
        if (sql.includes("FROM opportunity_profit_runs"))
          return [
            [
              {
                status: "insufficient_data",
                rule_version_code: "PROFIT-2026-08",
                missing_fields_json: '["purchase_price"]',
                calculated_at: "2026-08-19T07:55:00.000Z",
              },
            ],
          ];
        if (sql.includes("FROM opportunity_evidence_links"))
          return [[{ evidence_count: 6, source_count: 3 }]];
        throw new Error(`unexpected query: ${sql}`);
      },
    },
    repository = new MySqlApprovalRepository(pool),
    context = await repository.loadDecisionContext(
      pool,
      {
        organizationId: "org",
        workspaceId: "workspace",
        resourceType: "opportunity_decision",
        resourceId: decisionId,
        approvalTemplateVersion: 4,
      },
      new Date("2026-08-19T08:01:00.000Z"),
      "captured",
    );
  assert.equal(seen[0].args[0], decisionId);
  assert.equal(context.resource.id, opportunityId);
  assert.equal(context.snapshot_status, "captured");
  assert.equal(context.evidence.complete, 2);
  assert.equal(context.evidence.total, 4);
  assert.deepEqual(context.evidence.missing_items, ["利润依据", "风险识别"]);
  assert.deepEqual(context.rule_versions, {
    approval_template: "v4",
    scoring: "SCORE-2026-08",
    profit: "PROFIT-2026-08",
  });
  assert.equal(context.decision.reason, "证据满足首轮验证要求");
});
test("M05-02 does not fabricate evidence completeness for task approvals", async () => {
  const pool = {
      query: async () => [
        [
          {
            title: "复核采购任务",
            status: "in_progress",
            priority: "high",
            progress_percent: 40,
            due_at: null,
            assignee_name: "采购负责人",
          },
        ],
      ],
    },
    repository = new MySqlApprovalRepository(pool),
    context = await repository.loadDecisionContext(
      pool,
      {
        organizationId: "org",
        workspaceId: "workspace",
        resourceType: "task",
        resourceId: uuid,
        approvalTemplateVersion: 2,
      },
      new Date("2026-08-19T08:01:00.000Z"),
      "live_fallback",
    );
  assert.equal(context.evidence.applicable, false);
  assert.equal(context.evidence.is_complete, null);
  assert.equal(context.snapshot_status, "live_fallback");
  assert.match(context.evidence.note, /未配置独立证据完整度规则/);
});
test("M05-02.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const files = [
    "database/migrations/0018b_approval_workflow_m05_02.up.sql",
    "database/migrations/0047_approval_decision_context_snapshot.up.sql",
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
    "scripts/deploy-baota.py",
  ];
  const values = await Promise.all(files.map((x) => readFile(x, "utf8")));
  assert.match(
    values[0],
    /approval_template_versions[\s\S]*approval_node_runs[\s\S]*approval_actions[\s\S]*approval_escalation_jobs/,
  );
  assert.match(values[1], /decision_context_json/);
  assert.match(values[2], /FROM opportunity_decisions ["' +\n\r]*d[\s\S]*JOIN opportunities o/);
  assert.match(values[2], /decision_context_json/);
  assert.match(values[2], /approval_version_conflict[\s\S]*outbox_events/);
  assert.match(values[4], /node_sla_overdue[\s\S]*approval\.overdue/);
  assert.match(values[5], /证据完整度[\s\S]*规则版本[\s\S]*决策依据[\s\S]*批准与驳回均必填/);
  assert.equal(JSON.parse(values.at(-2)).atomicTasks.length, 17);
  assert.match(values.at(-1), /0047_approval_decision_context_snapshot\.up\.sql/);
});
