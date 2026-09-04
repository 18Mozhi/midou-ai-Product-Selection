import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ApprovalService,
  validateTemplate,
  validateRequest,
  validateDecision,
  ApprovalServiceError,
} from "../../apps/api/dist/approval-service.js";
import {
  MySqlApprovalRepository,
  compareApprovalDecisionContexts,
} from "../../apps/api/dist/mysql-approval-repository.js";
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
test("M05-02 compares the captured submission evidence with current facts", () => {
  const base = {
      observed_at: "2026-08-19T08:00:00.000Z",
      evidence: {
        complete: 2,
        total: 4,
        percent: 50,
        requirements: [
          {
            code: "risk",
            label: "风险识别",
            complete: false,
            detail: "尚未形成风险等级",
          },
        ],
      },
      rule_versions: { scoring: "SCORE-1", profit: null },
      basis_items: [{ code: "risk_level", label: "风险等级", value: "unknown" }],
    },
    current = {
      observed_at: "2026-08-19T09:00:00.000Z",
      evidence: {
        complete: 3,
        total: 4,
        percent: 75,
        requirements: [
          { code: "risk", label: "风险识别", complete: true, detail: "风险等级 medium" },
        ],
      },
      rule_versions: { scoring: "SCORE-2", profit: null },
      basis_items: [{ code: "risk_level", label: "风险等级", value: "medium" }],
    },
    diff = compareApprovalDecisionContexts(base, current);
  assert.equal(diff.has_changes, true);
  assert.deepEqual(diff.evidence_summary, {
    before_complete: 2,
    before_total: 4,
    before_percent: 50,
    after_complete: 3,
    after_total: 4,
    after_percent: 75,
  });
  assert.equal(diff.requirement_changes[0].before_complete, false);
  assert.equal(diff.requirement_changes[0].after_complete, true);
  assert.deepEqual(diff.basis_changes[0], {
    code: "risk_level",
    label: "风险等级",
    before: "unknown",
    after: "medium",
  });
  assert.equal(diff.rule_version_changes[0].after, "SCORE-2");
});
test("M05-02 splits actionable and requested approvals before repository pagination", async () => {
  const calls = [],
    service = new ApprovalService({
      listRequests: async (input) => {
        calls.push(input);
        return { items: [], page: input.page, page_size: input.pageSize, total: 0 };
      },
    });
  await service.listRequests({ involvement: "decidable" });
  await service.listRequests({ involvement: "requested" });
  await service.listRequests({ involvement: "unknown" });
  assert.equal(calls[0].involvement, "decidable");
  assert.equal(calls[1].involvement, "requested");
  assert.equal(calls[2].involvement, null);
  const [repository, routes, ui, queueUi, openapi] = await Promise.all(
    [
      "apps/api/src/mysql-approval-repository.ts",
      "apps/api/src/approval-routes.ts",
      "apps/web/src/components/ApprovalWorkspace.vue",
      "apps/web/src/components/ApprovalQueuePanel.vue",
      "docs/openapi.yaml",
    ].map((path) => readFile(path, "utf8")),
  );
  const approvalUi = `${ui}\n${queueUi}`;
  assert.match(repository, /involvement === "requested"[\s\S]*requested_by=\?/);
  assert.match(repository, /involvement === "decidable"[\s\S]*active_approver_id=\?/);
  assert.match(repository, /ORDER BY \(r\.status='pending'\)[\s\S]*n\.due_at[\s\S]*r\.id DESC/);
  assert.match(repository, /route: `\/tasks\/\$\{input\.resourceId\}`/);
  assert.match(repository, /normalizeApprovalResourceRoute/);
  assert.match(routes, /involvement: q\.involvement/);
  assert.match(queueUi, /待我处理[\s\S]*我发起的/);
  assert.match(approvalUi, /审批依据与影响范围/);
  assert.match(ui, /canManage[\s\S]*task:assign/);
  assert.match(ui, /只读权限/);
  assert.match(ui, /审批操作记录[\s\S]*selected\.actions/);
  assert.match(ui, /当前审批重点[\s\S]*待我处理[\s\S]*已超时[\s\S]*可用模板/);
  assert.match(ui, /资源类型由模板锁定/);
  assert.match(openapi, /name: involvement[\s\S]*decidable, requested/);
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
  assert.match(values[2], /original_profile[\s\S]*escalation_profile/);
  assert.match(values[2], /compareApprovalDecisionContexts[\s\S]*decision_context_diff/);
  assert.match(values[4], /node_sla_overdue[\s\S]*approval\.overdue/);
  assert.match(values[5], /证据完整度[\s\S]*规则版本[\s\S]*决策依据[\s\S]*批准与驳回均必填/);
  assert.match(values[5], /expected_revision/);
  assert.match(values[5], /发布审批模板[\s\S]*发布原因/);
  assert.match(values[5], /当前审批人[\s\S]*超时后[\s\S]*escalation_assignee_name/);
  assert.match(values[5], /提交快照与当前证据[\s\S]*requirement_changes/);
  assert.doesNotMatch(values[5], /window\.prompt/);
  assert.equal(JSON.parse(values.at(-2)).atomicTasks.length, 17);
  assert.match(values.at(-1), /0047_approval_decision_context_snapshot\.up\.sql/);
});
