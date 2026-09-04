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
  const observed = {
    templateCreates: 0,
    templatePublishes: 0,
    requestCreates: 0,
    decisions: 0,
  };
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
  await page.route("**/api/v1/tasks/approval-templates", async (route) => {
    if (route.request().method() === "POST") {
      observed.templateCreates += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
      await route.fulfill({
        status: 201,
        json: env({
          id: "00000000-0000-4000-8000-000000000940",
          name: "采购确认审批",
          status: "draft",
          current_version: 1,
          revision: 1,
          node_count: 1,
        }),
      });
      return;
    }
    await route.fulfill({
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
        {
          id: "00000000-0000-4000-8000-000000000941",
          name: "待发布采购审批",
          resource_type: "task",
          status: "draft",
          current_version: 1,
          revision: 1,
          node_count: 1,
        },
      ]),
    });
  });
  await page.route("**/api/v1/tasks/approval-templates/*/actions", async (route) => {
    observed.templatePublishes += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ json: env({ status: "published", revision: 2 }) });
  });
  await page.route("**/api/v1/tasks/member-options", (r) =>
    r.fulfill({
      json: env([
        { id: actor, label: "选品经理" },
        { id: "00000000-0000-4000-8000-000000000930", label: "运营负责人" },
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
        decision_context_diff: {
          available: true,
          observed_at: "2026-08-08T10:00:00.000Z",
          has_changes: true,
          evidence_summary: {
            before_complete: 3,
            before_total: 4,
            before_percent: 75,
            after_complete: 4,
            after_total: 4,
            after_percent: 100,
          },
          requirement_changes: [
            {
              code: "risk",
              label: "风险识别",
              before_complete: false,
              after_complete: true,
              before_detail: "尚未形成风险等级",
              after_detail: "风险等级 medium",
            },
          ],
          basis_changes: [
            {
              code: "risk_level",
              label: "风险等级",
              before: "unknown",
              after: "medium",
            },
          ],
          rule_version_changes: [],
        },
        nodes: [
          {
            id: "00000000-0000-4000-8000-000000000927",
            ordinal: 1,
            name: "选品经理复核",
            approver_id: actor,
            approver_name: "选品经理",
            active_approver_id: actor,
            active_approver_name: "选品经理",
            escalation_assignee_id: actor,
            escalation_assignee_name: "运营负责人",
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
            approver_name: "采购负责人",
            active_approver_id: actor,
            active_approver_name: "采购负责人",
            escalation_assignee_id: actor,
            escalation_assignee_name: "组织管理员",
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
        actions: [
          {
            id: "00000000-0000-4000-8000-000000000931",
            action: "escalated",
            reason: "节点超过处理时限，已转交运营负责人。",
            actor_name: "审批升级任务",
            created_at: "2026-08-09T10:01:00.000Z",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/tasks/approvals?*", (r) =>
    r.fulfill({
      json: { ...env([item]), meta: { page: 1, page_size: 100, total: 1 } },
    }),
  );
  await page.route("**/api/v1/tasks/approvals", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    observed.requestCreates += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ status: 201, json: env({ ...item, id: crypto.randomUUID() }) });
  });
  await page.route(`**/api/v1/tasks/approvals/${approvalId}/actions`, async (route) => {
    observed.decisions += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ json: env({ ...item, status: "approved", version: 2 }) });
  });
  return observed;
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
  await expect(
    page.locator(".approval-decision-context > header").getByText("75%", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/发起审批时已锁定/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "提交快照与当前证据" })).toBeVisible();
  await expect(page.getByText("已有变化", { exact: true })).toBeVisible();
  await expect(page.getByText("当前完整度")).toBeVisible();
  await expect(page.getByText("当前：风险等级 medium")).toBeVisible();
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
  await expect(
    page.locator(".approval-escalation-path").getByText("运营负责人", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("超时后 →").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "审批操作记录" })).toContainText(
    "节点超过处理时限",
  );
  await expect(page.getByText("批准与驳回均必填")).toBeVisible();
  await expect(page.getByRole("button", { name: "批准并流转" })).toBeDisabled();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect(page).toHaveScreenshot("m05-02-approval-workflow.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("approval inbox hides write entries and decision actions without task:assign", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000925",
        workspace_id: "00000000-0000-4000-8000-000000000926",
        roles: ["auditor"],
        capabilities: ["task:read"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.goto(`/tasks/approvals?approval=${approvalId}`);
  await expect(page.getByText("只读权限")).toBeVisible();
  await expect(page.getByRole("button", { name: "配置模板" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "发起审批" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "批准并流转" })).toHaveCount(0);
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

test("approval management creates and publishes templates, starts requests, and deduplicates decisions", async ({
  page,
}) => {
  const observed = await setup(page);
  await page.goto("/tasks/approvals");

  await page.getByRole("button", { name: "管理模板" }).click();
  const templateDialog = page.getByRole("dialog", { name: "新建审批模板草稿" });
  await templateDialog.getByLabel("模板名称").fill("采购确认审批");
  await templateDialog.getByLabel("节点名称").fill("运营复核");
  await templateDialog.getByText("技术配置：审批人与超时接收人", { exact: true }).click();
  await templateDialog.getByLabel("审批人").selectOption(actor);
  await templateDialog
    .getByLabel("超时接收人")
    .selectOption("00000000-0000-4000-8000-000000000930");
  await templateDialog.getByRole("button", { name: "保存草稿" }).dblclick();
  await expect(page.getByText("审批模板草稿已创建；发布前不会用于新审批。")).toBeVisible();
  expect(observed.templateCreates).toBe(1);

  await page.getByRole("button", { name: "管理模板" }).click();
  const reopenedTemplateDialog = page.getByRole("dialog", { name: "新建审批模板草稿" });
  await reopenedTemplateDialog
    .locator(".template-list article")
    .filter({ hasText: "待发布采购审批" })
    .getByRole("button", { name: "发布" })
    .click();
  const publishDialog = page.getByRole("dialog", { name: "发布审批模板" });
  await publishDialog.getByLabel("发布原因").fill("用于采购成本复核");
  await publishDialog.getByRole("button", { name: "确认发布" }).dblclick();
  await expect(page.getByText("模板版本已发布并锁定。")).toBeVisible();
  expect(observed.templatePublishes).toBe(1);

  await page.reload();
  await page.getByRole("button", { name: "＋ 发起审批" }).click();
  const requestDialog = page.getByRole("dialog", { name: "发起审批" });
  await requestDialog.getByLabel("已发布模板").selectOption(item.template_id);
  await requestDialog.getByText("技术配置：关联资源编号", { exact: true }).click();
  await requestDialog.getByLabel("资源编号").fill(decisionId);
  await requestDialog.getByLabel("审批标题").fill("复核便携净水杯采纳决策");
  await requestDialog.getByRole("button", { name: "发起", exact: true }).dblclick();
  await expect(page.getByText("审批已发起；第一节点 SLA 已开始计时。")).toBeVisible();
  expect(observed.requestCreates).toBe(1);

  await page.goto(`/tasks/approvals?approval=${approvalId}`);
  await page.getByLabel("审批原因（批准与驳回均必填）").fill("证据变化已核对，同意进入下一节点");
  await page.getByRole("button", { name: "批准并流转" }).dblclick();
  await expect(page.getByText("本节点已批准，审批历史不可变。")).toBeVisible();
  expect(observed.decisions).toBe(1);
});

test("approval empty state exposes only the next valid setup action", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/tasks/approval-templates", (route) =>
    route.fulfill({ json: env([]) }),
  );
  await page.route("**/api/v1/tasks/approvals?*", (route) =>
    route.fulfill({ json: { ...env([]), meta: { page: 1, page_size: 20, total: 0 } } }),
  );
  await page.goto("/tasks/approvals");
  await expect(page.getByRole("heading", { name: "目前没有需要你审批的事项" })).toBeVisible();
  await expect(page.getByRole("button", { name: "配置第一个模板" })).toBeVisible();
  await expect(page.getByRole("button", { name: "＋ 发起审批" })).toHaveCount(0);
  await page.getByRole("button", { name: "配置第一个模板" }).click();
  await expect(page.getByRole("dialog", { name: "新建审批模板草稿" })).toBeVisible();
});
