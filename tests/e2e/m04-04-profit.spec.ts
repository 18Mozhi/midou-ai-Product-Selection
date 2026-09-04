import { test, expect, type Page } from "@playwright/test";

const opportunityId = "00000000-0000-4000-8000-000000000444";
const ruleId = "00000000-0000-4000-8000-000000000445";
const envelope = (data: unknown) => ({
  data,
  request_id: "m04-04-e2e-request",
  trace_id: "m04-04-e2e-trace",
});

async function navigation(
  page: Page,
  overrides: { roles?: string[]; capabilities?: string[] } = {},
) {
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000441",
        workspace_id: "00000000-0000-4000-8000-000000000442",
        roles: overrides.roles ?? ["selection_manager", "organization_admin"],
        capabilities: overrides.capabilities ?? [
          "task:read",
          "opportunity:read",
          "opportunity:approve",
          "cost:confirm",
          "sourcing:read",
        ],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
}

test("M04-04.A07/A08/A09/A15 cost rule console exposes explicit fees and dual approval", async ({
  page,
}) => {
  await navigation(page);
  let status = "draft",
    revision = 1,
    approvals: string[] = [];
  const actionBodies: any[] = [];
  const rule = () => ({
    id: ruleId,
    market: "US",
    platform: "amazon",
    version_code: "US-AMZ-2026-01",
    name: "美国站标准费用",
    status,
    fee_lines: [
      { type: "platform_fee", mode: "percentage_of_sale", value: 10, currency: null },
      { type: "payment_fee", mode: "percentage_of_sale", value: 3, currency: null },
      { type: "tax", mode: "percentage_of_sale", value: 5, currency: null },
      { type: "fulfillment", mode: "fixed_amount", value: 2, currency: "USD" },
    ],
    effective_from: "2026-08-08",
    revision,
    approvals,
    published_at: null,
    updated_at: "2026-08-08T10:00:00.000Z",
  });
  await page.route("**/api/v1/cost-rules", (route) => route.fulfill({ json: envelope([rule()]) }));
  await page.route(`**/api/v1/cost-rules/${ruleId}/actions`, (route) => {
    const body = route.request().postDataJSON();
    actionBodies.push(body);
    revision++;
    if (body.action === "submit") status = "pending_approval";
    if (body.action === "approve") {
      approvals = [...approvals, body.approval_role];
      if (approvals.length === 2) status = "approved";
    }
    if (body.action === "publish") status = "active";
    return route.fulfill({ json: envelope(rule()) });
  });
  await page.goto("/sourcing/cost-rules");
  await expect(page.getByRole("heading", { name: "成本质量门", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "成本规则准备度" })).toBeVisible();
  await expect(page.getByText("成本质量门未就绪", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "美国站标准费用", level: 3 })).toBeVisible();
  await expect(
    page.locator(".cost-rule-detail").getByText("平台费", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("按售价百分比", { exact: true }).first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(page).toHaveScreenshot("m04-04-cost-rules.png", { fullPage: true });
  await page.getByRole("button", { name: "提交审批" }).click();
  await expect(page.getByRole("dialog", { name: "提交费用规则审批" })).toBeVisible();
  await page.getByLabel("操作原因（至少 2 个字）").fill("提交美国站费用规则审批");
  await page.getByRole("button", { name: "确认提交审批" }).click();
  await expect(page.getByText("规则已提交审批，历史版本与审计记录均已保留。")).toBeVisible();
  await page.getByRole("button", { name: "选品经理批准" }).click();
  await page.getByLabel("操作原因（至少 2 个字）").fill("选品经理复核费用完整");
  await page.getByRole("button", { name: "确认批准" }).click();
  await page.getByRole("button", { name: "组织管理员批准" }).click();
  await page.getByLabel("操作原因（至少 2 个字）").fill("组织管理员确认费率有效");
  await page.getByRole("button", { name: "确认批准" }).click();
  await page.getByRole("button", { name: "发布规则" }).click();
  await page.getByLabel("操作原因（至少 2 个字）").fill("双审批完成后发布");
  await page.getByRole("button", { name: "确认发布" }).click();
  expect(actionBodies).toMatchObject([
    { action: "submit", reason: "提交美国站费用规则审批", expected_revision: 1 },
    {
      action: "approve",
      approval_role: "selection_manager",
      reason: "选品经理复核费用完整",
    },
    {
      action: "approve",
      approval_role: "organization_admin",
      reason: "组织管理员确认费率有效",
    },
    { action: "publish", reason: "双审批完成后发布" },
  ]);
  await expect(page.locator(".cost-rule-detail > header > b")).toHaveText("生效中");
  await expect(page.getByText("成本规则已生效", { exact: true })).toBeVisible();
});

test("M04-04 cost rule console uses capabilities, explicit entry and keyboard-safe dialogs", async ({
  page,
}) => {
  await navigation(page, {
    roles: ["selection_manager"],
    capabilities: ["opportunity:read"],
  });
  await page.route("**/api/v1/cost-rules", (route) => route.fulfill({ json: envelope([]) }));
  await page.goto("/sourcing/cost-rules");
  await expect(page.getByRole("button", { name: "新建规则" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "刷新列表" })).toBeVisible();

  await page.unroute("**/api/v1/me/navigation?shell=member");
  await navigation(page, {
    roles: ["selection_manager"],
    capabilities: ["opportunity:read", "opportunity:approve"],
  });
  await page.reload();
  const createButton = page.getByRole("button", { name: "新建规则" });
  await createButton.click();
  const dialog = page.getByRole("dialog", { name: "新建费用规则草稿" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("平台费 %")).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "保存草稿" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(createButton).toBeFocused();
});

test("M04-04 cost rule console paginates accumulated versions", async ({ page }) => {
  await navigation(page, { roles: ["auditor"], capabilities: ["opportunity:read"] });
  const accumulated = Array.from({ length: 12 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(500 + index).padStart(12, "0")}`,
    market: "US",
    platform: "amazon",
    version_code: `archive-${index + 1}`,
    name: `历史规则 ${index + 1}`,
    status: "retired",
    fee_lines: [
      { type: "platform_fee", mode: "percentage_of_sale", value: 10, currency: null },
      { type: "payment_fee", mode: "percentage_of_sale", value: 3, currency: null },
      { type: "tax", mode: "percentage_of_sale", value: 5, currency: null },
      { type: "fulfillment", mode: "fixed_amount", value: 2, currency: "USD" },
    ],
    effective_from: "2026-08-25",
    revision: 4,
    approvals: ["selection_manager", "organization_admin"],
    published_at: "2026-08-25T01:00:00.000Z",
    updated_at: "2026-08-25T01:00:00.000Z",
  }));
  await page.route("**/api/v1/cost-rules", (route) =>
    route.fulfill({ json: envelope(accumulated) }),
  );
  await page.goto("/sourcing/cost-rules");
  await expect(page.locator(".cost-rule-list > button")).toHaveCount(10);
  await expect(page.getByText("第 1 / 2 页", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.locator(".cost-rule-list > button")).toHaveCount(2);
  await expect(page.getByText("第 2 / 2 页", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "历史规则 11", level: 3 })).toBeVisible();
});

test("M04-04 cost rule console exposes audited reject and rollback", async ({ page }) => {
  await navigation(page, { roles: ["selection_manager"] });
  const retiredId = "00000000-0000-4000-8000-000000000446";
  const makeRule = (id: string, name: string, version: string, ruleStatus: string) => ({
    id,
    market: "US",
    platform: "amazon",
    version_code: version,
    name,
    status: ruleStatus,
    fee_lines: [
      { type: "platform_fee", mode: "percentage_of_sale", value: 10, currency: null },
      { type: "payment_fee", mode: "percentage_of_sale", value: 3, currency: null },
      { type: "tax", mode: "percentage_of_sale", value: 5, currency: null },
      { type: "fulfillment", mode: "fixed_amount", value: 2, currency: "USD" },
    ],
    effective_from: "2026-08-25",
    revision: 5,
    approvals: ["selection_manager", "organization_admin"],
    published_at: "2026-08-25T01:00:00.000Z",
    updated_at: "2026-08-25T01:00:00.000Z",
  });
  const active = makeRule(ruleId, "当前费用规则", "v2", "active"),
    retired = makeRule(retiredId, "历史费用规则", "v1", "retired");
  let actionBody: any = null;
  await page.route("**/api/v1/cost-rules", (route) =>
    route.fulfill({ json: envelope([active, retired]) }),
  );
  await page.route(`**/api/v1/cost-rules/${ruleId}/actions`, async (route) => {
    actionBody = route.request().postDataJSON();
    await route.fulfill({ json: envelope({ ...retired, status: "active", revision: 6 }) });
  });
  await page.goto("/sourcing/cost-rules");
  await page.getByRole("searchbox", { name: "搜索规则" }).fill("历史");
  await expect(page.getByRole("button", { name: /当前费用规则/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /历史费用规则/ })).toBeVisible();
  await page.getByRole("button", { name: "重置" }).click();
  await page.getByRole("combobox", { name: "状态" }).selectOption("retired");
  await expect(page.getByText("共 1 条", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "重置" }).click();
  await page.getByRole("button", { name: /历史费用规则/ }).click();
  await expect(page).toHaveURL(new RegExp(`rule=${retiredId}`));
  await page.reload();
  await expect(page.getByRole("heading", { name: "历史费用规则", level: 3 })).toBeVisible();
  await page.getByRole("button", { name: /当前费用规则/ }).click();
  await page.getByRole("button", { name: "回滚到历史版本" }).click();
  await expect(page.getByLabel("恢复目标")).toContainText("历史费用规则 · v1 · 已停用");
  await page.getByLabel("操作原因（至少 2 个字）").fill("恢复已验证的上一版本");
  await page.getByRole("button", { name: "确认回滚" }).click();
  expect(actionBody).toMatchObject({
    action: "rollback",
    reason: "恢复已验证的上一版本",
    target_rule_id: retiredId,
    expected_revision: 5,
  });
});

test("M04-04 cost rule console records a real-role rejection reason", async ({ page }) => {
  await navigation(page, { roles: ["selection_manager"] });
  let ruleStatus = "pending_approval";
  const pending = {
    id: ruleId,
    market: "US",
    platform: "amazon",
    version_code: "reject-v1",
    name: "待拒绝费用规则",
    status: ruleStatus,
    fee_lines: [
      { type: "platform_fee", mode: "percentage_of_sale", value: 10, currency: null },
      { type: "payment_fee", mode: "percentage_of_sale", value: 3, currency: null },
      { type: "tax", mode: "percentage_of_sale", value: 5, currency: null },
      { type: "fulfillment", mode: "fixed_amount", value: 2, currency: "USD" },
    ],
    effective_from: "2026-08-25",
    revision: 2,
    approvals: [],
    published_at: null,
    updated_at: "2026-08-25T01:00:00.000Z",
  };
  let actionBody: any = null;
  await page.route("**/api/v1/cost-rules", (route) =>
    route.fulfill({ json: envelope([{ ...pending, status: ruleStatus }]) }),
  );
  await page.route(`**/api/v1/cost-rules/${ruleId}/actions`, async (route) => {
    actionBody = route.request().postDataJSON();
    ruleStatus = "rejected";
    await route.fulfill({
      json: envelope({ ...pending, status: ruleStatus, revision: 3 }),
    });
  });
  await page.goto("/sourcing/cost-rules");
  await page.getByRole("button", { name: "选品经理拒绝" }).click();
  await page.getByLabel("操作原因（至少 2 个字）").fill("费用证据不足");
  await page.getByRole("button", { name: "确认拒绝" }).click();
  expect(actionBody).toMatchObject({
    action: "reject",
    approval_role: "selection_manager",
    reason: "费用证据不足",
    expected_revision: 2,
  });
  await expect(page.locator(".cost-rule-detail > header > b")).toHaveText("已拒绝");
});

test("M04-04.A07/A08/A15 profit detail shows formula components provenance and historical quote", async ({
  page,
}) => {
  await navigation(page);
  const reviewerId = "00000000-0000-4000-8000-000000000448";
  const reviewId = "00000000-0000-4000-8000-000000000449";
  let reviewStatus: "pending" | "approved" = "pending",
    reviewBody: any = null;
  const detail = {
    id: opportunityId,
    name: "户外净水杯利润机会",
    market: "US",
    category: "outdoor",
    source_type: "manual",
    source_ref_id: null,
    owner_id: null,
    lifecycle_status: "ready",
    recommendation_status: "observe",
    overall_score: 72,
    trend_score: 80,
    competition_score: 65,
    profit_status: "calculated",
    risk_level: "unknown",
    confidence: { status: "measured", score: 80 },
    evidence_count: 3,
    source_count: 2,
    coverage_status: "partial",
    decision_status: "pending",
    version: 8,
    updated_at: "2026-08-08T12:00:00.000Z",
    score_rule_version: "v1",
    scored_at: "2026-08-08T11:00:00.000Z",
    latest_score_run: null,
    score_components: [],
    evidence: [],
    decisions: [],
    section_status: {
      market: "covered",
      competition: "covered",
      profit: "calculated",
      risk: "insufficient_data",
      execution: "not_available",
    },
  };
  const components = [
    ["sale_price", 100, "USD", 100, null],
    ["purchase_price", 40, "CNY", 5.6, "00000000-0000-4000-8000-000000000446"],
    ["logistics", 5, "USD", 5, null],
    ["platform_fee", 10, "PCT", 10, null],
    ["payment_fee", 3, "PCT", 3, null],
    ["tax", 5, "PCT", 5, null],
    ["fulfillment", 2, "USD", 2, null],
  ].map(
    ([component_type, source_amount, source_currency, converted_amount, exchange_quote_id]) => ({
      component_type,
      source_amount,
      source_currency,
      converted_amount,
      target_currency: "USD",
      source_ref_id:
        String(component_type).includes("fee") ||
        component_type === "tax" ||
        component_type === "fulfillment"
          ? "cost_rule:US-AMZ-2026-01"
          : `verified:${component_type}`,
      evidence_id:
        String(component_type).includes("price") || component_type === "logistics"
          ? "00000000-0000-4000-8000-000000000447"
          : null,
      exchange_quote_id,
      missing_reason: null,
    }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({ json: envelope(detail) }),
  );
  await page.route("**/api/v1/cost-input-reviewers", (route) =>
    route.fulfill({ json: envelope([{ id: reviewerId, label: "成本复核人" }]) }),
  );
  await page.route(
    `**/api/v1/opportunities/${opportunityId}/cost-input-reviews/${reviewId}/actions`,
    async (route) => {
      reviewBody = route.request().postDataJSON();
      reviewStatus = "approved";
      await route.fulfill({ json: envelope({ status: "approved" }) });
    },
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({
      json: envelope({
        latest_run: {
          id: ruleId,
          status: "calculated",
          rule_version_code: "US-AMZ-2026-01",
          platform: "amazon",
          market: "US",
          currency: "USD",
          sale_price: 100,
          total_cost: 30.6,
          net_profit: 69.4,
          net_margin_percent: 69.4,
          missing_fields: [],
          calculated_at: "2026-08-08T12:00:00.000Z",
          components,
        },
        current_inputs: [],
        cost_input_reviews: [
          {
            id: reviewId,
            cost_input_id: "00000000-0000-4000-8000-000000000450",
            input_type: "purchase_price",
            amount_value: 40,
            currency: "CNY",
            platform: "amazon",
            input_version: 1,
            evidence_id: "00000000-0000-4000-8000-000000000447",
            submitter_id: "00000000-0000-4000-8000-000000000451",
            submitter_label: "成本提交人",
            reviewer_id: reviewerId,
            reviewer_label: "成本复核人",
            status: reviewStatus,
            due_at: "2026-08-23T12:00:00.000Z",
            overdue: false,
            can_review: reviewStatus === "pending",
            decision_reason: reviewStatus === "approved" ? "报价证据与币种一致" : null,
            version: reviewStatus === "approved" ? 2 : 1,
          },
        ],
      }),
    }),
  );
  await page.goto(`/opportunities/${opportunityId}`);
  await page.getByRole("button", { name: "利润与成本" }).click();
  await page.getByLabel("观测时间").fill("2026-08-08T12:00");
  await expect(page.getByText("69.4 USD", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("汇率快照 00000000-0000-4000-8000-000000000446")).toBeVisible();
  await expect(page.getByText("净利润 = 含税售价")).toBeVisible();
  const reviewQueue = page.locator(".profit-review-queue");
  await expect(reviewQueue.getByText("提交后 24 小时内由指定复核人处理")).toBeVisible();
  await expect(page.getByLabel("指定复核人")).toContainText("成本复核人");
  await reviewQueue.getByRole("button", { name: "通过", exact: true }).click();
  await reviewQueue.getByLabel("复核说明").fill("报价证据与币种一致");
  await reviewQueue.getByRole("button", { name: "提交", exact: true }).click();
  await expect
    .poll(() => reviewBody)
    .toMatchObject({
      decision: "approved",
      reason: "报价证据与币种一致",
      expected_version: 1,
    });
  await expect(
    page.getByText("成本复核已通过并生效；如有活动费用规则，利润重算已排队。"),
  ).toBeVisible();
});
