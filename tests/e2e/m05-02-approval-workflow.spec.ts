import { test, expect, type Page } from "@playwright/test";
const approvalId = "00000000-0000-4000-8000-000000000921",
  actor = "00000000-0000-4000-8000-000000000922",
  decisionId = "00000000-0000-4000-8000-000000000924",
  opportunityId = "00000000-0000-4000-8000-000000000929",
  env = (data: unknown) => ({
    data,
    request_id: "m05-02-e2e",
    trace_id: "m05-02-trace",
  }),
  item = {
    id: approvalId,
    title: "便携净水杯采纳决策复核",
    template_id: "00000000-0000-4000-8000-000000000923",
    template_name: "机会决策审批",
    resource_type: "opportunity_decision",
    resource_id: decisionId,
    status: "pending",
    current_node_ordinal: 1,
    current_node_name: "选品经理复核",
    active_approver_id: actor,
    can_decide: true,
    due_at: "2026-08-09T10:00:00.000Z",
    escalated_at: null,
    requested_by: actor,
    completed_at: null,
    version: 1,
    created_at: "2026-08-08T09:00:00.000Z",
    updated_at: "2026-08-08T09:00:00.000Z",
  };
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000925",
        workspace_id: "00000000-0000-4000-8000-000000000926",
        roles: ["selection_manager"],
        capabilities: ["task:read", "task:assign"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/tasks/approval-templates", (r) =>
    r.fulfill({
      json: env([
        {
          id: item.template_id,
          name: "机会决策审批",
          resource_type: "opportunity_decision",
          status: "published",
          current_version: 1,
          revision: 2,
          node_count: 2,
        },
      ]),
    }),
  );
  await page.route(`**/api/v1/tasks/approvals/${approvalId}`, (r) =>
    r.fulfill({
      json: env({
        ...item,
        approval_template_version: 3,
        decision_context: {
          schema_version: 1,
          snapshot_status: "captured",
          captured_at: "2026-08-08T09:00:00.000Z",
          observed_at: "2026-08-08T09:00:00.000Z",
          resource: {
            type: "opportunity",
            id: opportunityId,
            label: "便携净水杯机会",
            route: `/opportunities/${opportunityId}`,
          },
          evidence: {
            applicable: true,
            complete: 3,
            total: 4,
            percent: 75,
            is_complete: false,
            missing_items: ["风险识别"],
            note: null,
            requirements: [
              {
                code: "market_evidence",
                label: "市场证据",
                complete: true,
                detail: "6 条证据，来自 3 个来源",
                route: `/opportunities/${opportunityId}?tab=evidence`,
              },
              {
                code: "scoring",
                label: "评分依据",
                complete: true,
                detail: "覆盖 88%，缺失 0 项",
                route: `/opportunities/${opportunityId}?tab=overview`,
              },
              {
                code: "profit",
                label: "利润依据",
                complete: true,
                detail: "利润输入与规则已完成计算",
                route: `/opportunities/${opportunityId}?tab=profit`,
              },
              {
                code: "risk",
                label: "风险识别",
                complete: false,
                detail: "尚未形成风险等级",
                route: `/opportunities/${opportunityId}?tab=risk`,
              },
            ],
          },
          rule_versions: {
            approval_template: "v3",
            scoring: "SCORE-2026-08",
            profit: "PROFIT-US-AMZ-2026-08",
          },
          decision: {
            action: "adopt",
            reason: "市场和利润证据支持进入验证阶段",
            opportunity_version: 7,
            created_at: "2026-08-08T08:58:00.000Z",
          },
          basis_items: [
            { code: "requested_decision", label: "申请决策", value: "adopt" },
            {
              code: "system_recommendation",
              label: "系统建议",
              value: "recommend",
            },
            { code: "score_coverage", label: "评分覆盖", value: "88%" },
            {
              code: "profit_status",
              label: "利润状态",
              value: "calculated",
            },
            { code: "risk_level", label: "风险等级", value: "unknown" },
            {
              code: "evidence_sources",
              label: "来源证据",
              value: "6 条 / 3 个来源",
            },
          ],
          evidence_complete: 3,
          evidence_total: 4,
          missing_items: ["风险识别"],
          rule_version: "SCORE-2026-08",
          basis: [],
        },
        nodes: [
          {
            id: "00000000-0000-4000-8000-000000000927",
            ordinal: 1,
            name: "选品经理复核",
            approver_id: actor,
            active_approver_id: actor,
            active_approver_name: "选品经理",
            escalation_assignee_id: actor,
            status: "pending",
            due_at: item.due_at,
            escalated_at: null,
            decided_by: null,
            decided_by_name: null,
            decision_reason: null,
            decided_at: null,
            version: 1,
          },
          {
            id: "00000000-0000-4000-8000-000000000928",
            ordinal: 2,
            name: "采购负责人确认",
            approver_id: actor,
            active_approver_id: actor,
            active_approver_name: "采购负责人",
            escalation_assignee_id: actor,
            status: "waiting",
            due_at: null,
            escalated_at: null,
            decided_by: null,
            decided_by_name: null,
            decision_reason: null,
            decided_at: null,
            version: 1,
          },
        ],
        actions: [],
      }),
    }),
  );
  await page.route("**/api/v1/tasks/approvals?*", (r) =>
    r.fulfill({
      json: { ...env([item]), meta: { page: 1, page_size: 100, total: 1 } },
    }),
  );
}
test("M05-02.A07/A08/A09/A15 renders approval inbox timeline and mandatory reason on desktop and 390", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/tasks/approvals");
  await expect(page.getByRole("heading", { name: "审批中心", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "待我处理" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("便携净水杯采纳决策复核")).toBeVisible();
  await page.getByRole("button", { name: /便携净水杯采纳决策复核/ }).click();
  await expect(page).toHaveURL(new RegExp(`approval=${approvalId}`));
  await expect(page.getByLabel("审批依据与影响范围")).toContainText("机会决策");
  await expect(page.getByText("75%", { exact: true })).toBeVisible();
  await expect(page.getByText(/发起审批时已锁定/)).toBeVisible();
  await expect(page.getByText("SCORE-2026-08", { exact: true })).toBeVisible();
  await expect(page.getByText("PROFIT-US-AMZ-2026-08", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "决策依据" })).toBeVisible();
  await expect(page.getByText("市场和利润证据支持进入验证阶段")).toBeVisible();
  await expect(page.getByRole("link", { name: /利润依据/ })).toHaveAttribute(
    "href",
    `/opportunities/${opportunityId}?tab=profit`,
  );
  await expect(page.getByText(decisionId, { exact: true }).first()).not.toBeVisible();
  await expect(page.getByText(actor, { exact: false }).first()).not.toBeVisible();
  await expect(page.getByText("选品经理复核").last()).toBeVisible();
  await expect(page.getByText("批准与驳回均必填")).toBeVisible();
  await expect(page.getByRole("button", { name: "批准并流转" })).toBeDisabled();
});

test("approval inbox splits actionable and requested views and restores detail deep links", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/tasks/approvals?view=requested&approval=${approvalId}`);
  await expect(page.getByRole("button", { name: "我发起的" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "便携净水杯采纳决策复核" })).toBeVisible();
  await page.getByRole("button", { name: "关闭审批详情" }).click();
  await expect(page).not.toHaveURL(/approval=/);
});
