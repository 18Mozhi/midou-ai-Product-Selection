import { test, expect, type Page, type Request } from "@playwright/test";
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
  await expect(page.getByRole("heading", { name: "审批中心", level: 1 }).first()).toBeVisible();
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

test("UI2-AN05 approval list re-reads on KeepAlive return and ignores the old response", async ({
  page,
}) => {
  await setup(page);
  let releaseOlder!: () => void;
  let olderReached!: () => void;
  let listRequests = 0;
  const olderGate = new Promise<void>((resolve) => (releaseOlder = resolve));
  const olderRequest = new Promise<void>((resolve) => (olderReached = resolve));
  await page.route("**/api/v1/tasks/approvals?*", async (route) => {
    listRequests += 1;
    if (listRequests === 1) {
      olderReached();
      await olderGate;
      try {
        await route.fulfill({
          json: { ...env([{ ...item, title: "离页前的旧结果" }]), meta: { total: 1 } },
        });
      } catch {
        // Deactivation aborts the old read; its result must not reach the page.
      }
      return;
    }
    await route.fulfill({
      json: { ...env([{ ...item, title: "返回后的最新结果" }]), meta: { total: 41 } },
    });
  });
  await page.goto("/tasks/approvals");
  await olderRequest;
  await page.locator('a[href="/home"]').first().click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("link", { name: "审批中心" }).first().click();
  await expect(page).toHaveURL(/\/tasks\/approvals$/);
  await expect(page.getByRole("button", { name: /返回后的最新结果/ })).toBeVisible();
  await expect.poll(() => listRequests).toBe(2);

  releaseOlder();
  await expect(page.getByRole("button", { name: /离页前的旧结果/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /返回后的最新结果/ })).toBeVisible();
  await expect(page.getByLabel("审批分页")).toContainText("共 41 项");
});

test("UI2-AN06 approval detail failure cannot reopen after its scope is cleared", async ({
  page,
}) => {
  await setup(page);
  let releaseDetail!: () => void;
  let detailReached!: () => void;
  let pendingRequest: Request | undefined;
  const detailGate = new Promise<void>((resolve) => (releaseDetail = resolve));
  const detailRequest = new Promise<void>((resolve) => (detailReached = resolve));
  await page.route(`**/api/v1/tasks/approvals/${approvalId}`, async (route) => {
    pendingRequest = route.request();
    detailReached();
    await detailGate;
    try {
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "dependency_unavailable",
            message: "审批服务暂不可用。",
            action_hint: "请稍后重试。",
          },
          request_id: "stale-approval-detail",
        },
      });
    } catch {
      // The production request is expected to be aborted after its scope is cleared.
    }
  });
  await page.goto(`/tasks/approvals?approval=${approvalId}`);
  await detailRequest;
  await page.getByRole("button", { name: "已批准" }).click();
  await expect(page).not.toHaveURL(/approval=/);
  await expect.poll(() => pendingRequest?.failure(), { timeout: 1_000 }).toBeTruthy();
  releaseDetail();
  await page.waitForTimeout(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: item.title })).toHaveCount(0);
});

test("UI2-AN07 committed decision response cannot close a newer cached detail", async ({
  page,
}) => {
  await setup(page);
  let releaseDecision!: () => void;
  let decisionReached!: () => void;
  let decisionCount = 0;
  let submittedBody: unknown;
  const decisionGate = new Promise<void>((resolve) => (releaseDecision = resolve));
  const decisionRequest = new Promise<void>((resolve) => (decisionReached = resolve));
  await page.route(`**/api/v1/tasks/approvals/${approvalId}/actions`, async (route) => {
    decisionCount += 1;
    submittedBody = route.request().postDataJSON();
    decisionReached();
    await decisionGate;
    await route.fulfill({ json: env({ ...item, status: "approved", version: 2 }) });
  });
  await page.goto(`/tasks/approvals?approval=${approvalId}`);
  const dialog = page.getByRole("dialog", { name: item.title });
  await expect(dialog).toBeVisible();
  const reason = "证据变化已核对，同意进入下一节点";
  await dialog.getByLabel("审批原因（批准与驳回均必填）").fill(reason);
  await dialog.getByRole("button", { name: "批准并流转" }).click();
  await decisionRequest;
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /便携净水杯采纳决策复核/ }).click();
  const returnedDialog = page.getByRole("dialog", { name: item.title });
  await expect(returnedDialog).toBeVisible();
  releaseDecision();
  await expect(returnedDialog).toBeVisible();
  expect(decisionCount).toBe(1);
  expect(submittedBody).toEqual({ action: "approve", reason, expected_version: item.version });
});

test("approval decision handler ignores synchronous re-entry while the first POST is pending", async ({
  page,
}) => {
  await setup(page);
  let action: "approve" | "reject" = "approve";
  let releaseDecision!: () => void;
  let signalDecision!: () => void;
  let decisionGate = new Promise<void>((resolve) => (releaseDecision = resolve));
  let decisionStarted = new Promise<void>((resolve) => (signalDecision = resolve));
  let decisionCount = 0;
  let submittedBody: unknown;
  await page.route(`**/api/v1/tasks/approvals/${approvalId}/actions`, async (route) => {
    decisionCount += 1;
    submittedBody = route.request().postDataJSON();
    signalDecision();
    await decisionGate;
    await route.fulfill({
      json: env({
        ...item,
        status: action === "approve" ? "approved" : "rejected",
        version: item.version + 1,
      }),
    });
  });

  const reason = "提交前核对当前证据版本";
  for (action of ["approve", "reject"] as const) {
    const previousDecisionCount = decisionCount;
    decisionGate = new Promise<void>((resolve) => (releaseDecision = resolve));
    decisionStarted = new Promise<void>((resolve) => (signalDecision = resolve));
    await page.goto(`/tasks/approvals?approval=${approvalId}`);
    const dialog = page.getByRole("dialog", { name: item.title });
    await dialog.getByLabel("审批原因（批准与驳回均必填）").fill(reason);
    const decisionButton = dialog.getByRole("button", {
      name: action === "approve" ? "批准并流转" : "驳回",
    });
    await decisionButton.click();
    await decisionStarted;
    await expect(decisionButton).toBeDisabled();
    await decisionButton.evaluate((button) =>
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
      ),
    );
    await expect.poll(() => decisionCount).toBe(previousDecisionCount + 1);

    releaseDecision();
    await expect(
      page.getByText(
        action === "approve" ? "本节点已批准，审批历史不可变。" : "本节点已驳回，审批历史不可变。",
      ),
    ).toBeVisible();
    expect(decisionCount).toBe(previousDecisionCount + 1);
    expect(submittedBody).toEqual({ action, reason, expected_version: item.version });
  }
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

test("UI2-AN01 approval detail owns keyboard focus, Escape and return without deciding", async ({
  page,
}) => {
  const observed = await setup(page);
  await page.goto("/tasks/approvals");
  const trigger = page.getByRole("button", { name: /便携净水杯采纳决策复核/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: item.title });
  const close = dialog.getByRole("button", { name: "关闭审批详情" });
  await expect.poll(() => dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator("summary").last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/approval=/);
  await expect(trigger).toBeFocused();
  expect(observed.decisions).toBe(0);
  await trigger.click();
  await expect(close).toBeFocused();
  await dialog.click({ position: { x: 20, y: 12 } });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThan(0);
  await page.mouse.click(bounds!.x / 2, bounds!.y + 60);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(observed.decisions).toBe(0);
});

for (const form of ["template", "request"] as const) {
  test(`UI2-AN02 ${form} reveals and focuses a required field inside collapsed details`, async ({
    page,
  }) => {
    const observed = await setup(page);
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/tasks/approvals");
    await page
      .getByRole("button", { name: form === "template" ? "管理模板" : "＋ 发起审批" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: form === "template" ? "新建审批模板草稿" : "发起审批",
      exact: true,
    });
    if (form === "template") {
      await dialog.getByLabel("模板名称").fill("必填成员验证");
      await dialog.getByLabel("节点名称").fill("当前工作区复核");
    } else {
      await dialog.getByLabel("已发布模板").selectOption(item.template_id);
      await dialog.getByLabel("审批标题").fill("必填资源验证");
    }
    const details = dialog.locator(".approval-form-technical");
    await expect(details).not.toHaveAttribute("open");
    await dialog
      .getByRole("button", { name: form === "template" ? "保存草稿" : "发起", exact: true })
      .click();
    await expect(details).toHaveAttribute("open");
    const field = dialog.getByLabel(form === "template" ? "审批人" : "资源编号");
    await expect(field).toBeVisible();
    await expect(field).toBeFocused();
    expect(errors.filter((message) => /not focusable/i.test(message))).toEqual([]);
    expect(observed.templateCreates + observed.requestCreates).toBe(0);
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });
}

test("UI2-AN04 approval conflict stays visible in the modal and preserves the audited reason", async ({
  page,
}) => {
  await setup(page);
  const bodies: unknown[] = [];
  await page.route(`**/api/v1/tasks/approvals/${approvalId}/actions`, async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "approval_version_conflict",
          message: "审批版本已变化",
          action_hint: "刷新审批详情后再判断。",
        },
        request_id: "ui2-an-conflict",
        trace_id: "ui2-an-conflict-trace",
      },
    });
  });
  await page.goto("/tasks/approvals");
  const trigger = page.getByRole("button", { name: /便携净水杯采纳决策复核/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: item.title });
  await dialog.getByLabel("审批原因（批准与驳回均必填）").fill("核对当前证据后驳回");
  await dialog.getByRole("button", { name: "驳回", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("刷新审批详情后再判断。");
  await expect(dialog.getByLabel("审批原因（批准与驳回均必填）")).toHaveValue("核对当前证据后驳回");
  expect(bodies).toEqual([{ action: "reject", reason: "核对当前证据后驳回", expected_version: 1 }]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(bodies).toHaveLength(1);
  await trigger.click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(dialog.getByLabel("审批原因（批准与驳回均必填）")).toHaveValue("");
});
