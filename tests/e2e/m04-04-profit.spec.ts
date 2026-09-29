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

async function openProfitSection(page: Page) {
  const mobileDirectory = page.locator(".opportunity-detail-directory-mobile");
  if ((page.viewportSize()?.width ?? 0) <= 900) {
    if (!(await mobileDirectory.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await mobileDirectory.locator("summary").click();
    }
    await mobileDirectory.getByRole("button", { name: "利润与成本" }).click();
    return;
  }
  await page.getByRole("button", { name: "利润与成本" }).click();
}

const phase2CostRule = (status = "active") => ({
  id: ruleId,
  market: "US",
  platform: "amazon",
  version_code: "ui2-current",
  name: "现行费用规则",
  status,
  fee_lines: [
    { type: "platform_fee", mode: "percentage_of_sale", value: 10, currency: null },
    { type: "payment_fee", mode: "percentage_of_sale", value: 3, currency: null },
    { type: "tax", mode: "percentage_of_sale", value: 5, currency: null },
    { type: "fulfillment", mode: "fixed_amount", value: 2, currency: "USD" },
  ],
  conversion_rates: [],
  automatic_scope: null,
  effective_from: "2026-08-08",
  revision: 7,
  approvals: status === "active" ? ["selection_manager", "organization_admin"] : [],
  published_at: status === "active" ? "2026-08-08T10:00:00.000Z" : null,
  updated_at: "2026-08-08T10:00:00.000Z",
});

test("UI2-SC01 active fees retain an authorized draft entry and zero explicit fees", async ({
  page,
}) => {
  await navigation(page);
  const current = phase2CostRule();
  const bodies: Record<string, unknown>[] = [];
  let created: Record<string, unknown> | null = null;
  await page.route("**/api/v1/cost-rules", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      bodies.push(body);
      created = { ...phase2CostRule("draft"), ...body, id: opportunityId, revision: 1 };
      await route.fulfill({ status: 201, json: envelope(created) });
    } else await route.fulfill({ json: envelope(created ? [created, current] : [current]) });
  });
  await page.goto("/sourcing/cost-rules");
  await expect(page.getByText("成本规则已生效", { exact: true })).toBeVisible();
  const trigger = page.getByRole("button", { name: "新建规则版本", exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "新建费用规则草稿" });
  await dialog.getByLabel("版本号", { exact: true }).fill("discarded-version");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(bodies).toEqual([]);
  await trigger.click();
  await expect(dialog.getByLabel("版本号", { exact: true })).toHaveValue("");
  await dialog.getByLabel("版本号", { exact: true }).fill("ui2-zero");
  await dialog.getByLabel("规则名称", { exact: true }).fill("显式零费用草稿");
  await dialog.getByLabel("生效日期", { exact: true }).fill("2026-08-08");
  const save = dialog.getByRole("button", { name: "保存草稿", exact: true });
  for (const label of ["平台费 %", "支付手续费 %", "税费 %", "履约成本"]) {
    await expect(save).toBeDisabled();
    await dialog.getByLabel(label, { exact: true }).fill("0");
  }
  await expect(save).toBeEnabled();
  await save.click();
  await expect(dialog).toHaveCount(0);
  expect(bodies).toEqual([
    {
      market: "US",
      platform: "amazon",
      version_code: "ui2-zero",
      name: "显式零费用草稿",
      effective_from: "2026-08-08",
      fee_lines: [
        { type: "platform_fee", mode: "percentage_of_sale", value: 0, currency: null },
        { type: "payment_fee", mode: "percentage_of_sale", value: 0, currency: null },
        { type: "tax", mode: "percentage_of_sale", value: 0, currency: null },
        { type: "fulfillment", mode: "fixed_amount", value: 0, currency: "USD" },
      ],
      conversion_rates: [],
      automatic_scope: null,
    },
  ]);
  await expect(page.getByRole("heading", { name: "显式零费用草稿", exact: true })).toBeVisible();
  await expect(page.locator(".cost-rule-detail > header > b")).toHaveText("草稿");
});

test("UI2-SC02 read-only active fees never expose a new-version entry", async ({ page }) => {
  await navigation(page, { roles: ["selection_manager"], capabilities: ["opportunity:read"] });
  await page.route("**/api/v1/cost-rules", (route) =>
    route.fulfill({ json: envelope([phase2CostRule()]) }),
  );
  await page.goto("/sourcing/cost-rules?from=https%3A%2F%2Fexample.test");
  await expect(page.getByText("成本规则已生效", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /新建规则|创建后续版本|创建首个规则/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "返回当前找货记录" })).toHaveAttribute(
    "href",
    "/sourcing",
  );
});

test("UI2-SC03 rule revision conflict keeps the audit reason and never auto-replays", async ({
  page,
}) => {
  await navigation(page, { roles: ["selection_manager"] });
  const pending = phase2CostRule("pending_approval");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/cost-rules", (route) => route.fulfill({ json: envelope([pending]) }));
  await page.route(`**/api/v1/cost-rules/${ruleId}/actions`, async (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "cost_rule_revision_conflict",
          message: "规则版本冲突",
          action_hint: "刷新规则并使用最新 revision。",
        },
        request_id: "ui2-sc-conflict",
        trace_id: "ui2-sc-conflict-trace",
      },
    });
  });
  await page.goto("/sourcing/cost-rules");
  await expect(page.getByRole("button", { name: "组织管理员批准" })).toHaveCount(0);
  await page.getByRole("button", { name: "选品经理批准" }).click();
  const dialog = page.getByRole("dialog", { name: "选品经理审批" });
  const reason = dialog.getByLabel("操作原因（至少 2 个字）");
  await reason.fill("  已核对费用来源  ");
  await dialog.getByRole("button", { name: "确认批准" }).click();
  await expect(dialog.getByRole("alert")).toContainText("规则已被其他操作更新");
  await expect(reason).toHaveValue("  已核对费用来源  ");
  expect(bodies).toEqual([
    {
      action: "approve",
      reason: "已核对费用来源",
      expected_revision: 7,
      approval_role: "selection_manager",
    },
  ]);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "选品经理批准" })).toBeFocused();
  expect(bodies).toHaveLength(1);
});

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
  await expect(page.getByRole("heading", { name: "成本质量门", level: 1 })).toBeVisible();
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

test("P22 draft dialog locks pending writes, preserves conflicts, and allows only explicit retry", async ({
  page,
}) => {
  await navigation(page);
  const active = phase2CostRule();
  let created: Record<string, unknown> | null = null;
  let postCount = 0;
  let releaseFirst!: () => void;
  let markFirstArrived!: () => void;
  const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
  const firstArrived = new Promise<void>((resolve) => (markFirstArrived = resolve));
  const submittedBodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/cost-rules", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({ json: envelope(created ? [created, active] : [active]) });
      return;
    }
    postCount += 1;
    submittedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (postCount === 1) {
      markFirstArrived();
      await firstGate;
      await route.fulfill({
        status: 409,
        json: {
          error: {
            code: "cost_rule_version_conflict",
            message: "版本冲突",
            action_hint: "请修改版本号后重试。",
          },
          request_id: "p22-create-conflict",
          trace_id: "p22-create-conflict-trace",
        },
      });
      return;
    }
    created = {
      ...phase2CostRule("draft"),
      ...(route.request().postDataJSON() as Record<string, unknown>),
      id: "00000000-0000-4000-8000-000000000447",
      revision: 1,
    };
    await route.fulfill({ status: 201, json: envelope(created) });
  });
  await page.goto("/sourcing/cost-rules");
  const trigger = page.getByRole("button", { name: "新建规则版本", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "新建费用规则草稿" });
  await dialog.getByLabel("版本号", { exact: true }).fill("US-AMZ-P22");
  await dialog.getByLabel("规则名称", { exact: true }).fill("P22 草稿生命周期测试");
  await dialog.getByLabel("平台费 %", { exact: true }).fill("0");
  await dialog.getByLabel("支付手续费 %", { exact: true }).fill("0");
  await dialog.getByLabel("税费 %", { exact: true }).fill("0");
  await dialog.getByLabel("履约成本", { exact: true }).fill("0");

  const save = dialog.getByRole("button", { name: "保存草稿", exact: true });
  await save.click();
  await firstArrived;
  await expect(dialog).toHaveAttribute("aria-busy", "true");
  await expect(dialog.getByRole("button", { name: "关闭新建规则" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
  await expect(dialog.locator(".cost-dialog-input-lock input")).toHaveCount(14);
  expect(
    await dialog
      .locator(".cost-dialog-input-lock input, .cost-dialog-input-lock select")
      .evaluateAll((elements) => elements.every((element) => element.matches(":disabled"))),
  ).toBe(true);
  const footer = dialog.locator(".cost-dialog-footer");
  await expect(footer).toBeVisible();
  const footerBox = await footer.boundingBox();
  expect(footerBox).not.toBeNull();
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.locator("form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
  expect(postCount).toBe(1);

  releaseFirst();
  const conflict = dialog.getByRole("alert");
  await expect(conflict).toContainText("同一市场和平台下的版本号已存在。");
  await expect(conflict).toContainText("p22-create-conflict");
  await expect(dialog.getByLabel("版本号", { exact: true })).toHaveValue("US-AMZ-P22");
  await expect(dialog.getByRole("button", { name: "保存草稿", exact: true })).toBeEnabled();
  expect(postCount).toBe(1);

  await dialog.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(postCount).toBe(2);
  expect(submittedBodies[0]).toEqual(submittedBodies[1]);
  await expect(
    page.getByRole("heading", { name: "P22 草稿生命周期测试", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cost-rule-detail > header > b")).toHaveText("草稿");
});

test("P22 action dialog traps focus, locks a pending conflict, and restores its trigger", async ({
  page,
}) => {
  await navigation(page, { roles: ["selection_manager"] });
  const pending = phase2CostRule("pending_approval");
  await page.route("**/api/v1/cost-rules", (route) => route.fulfill({ json: envelope([pending]) }));
  let postCount = 0;
  let releasePost!: () => void;
  let markPostArrived!: () => void;
  const postGate = new Promise<void>((resolve) => (releasePost = resolve));
  const postArrived = new Promise<void>((resolve) => (markPostArrived = resolve));
  await page.route(`**/api/v1/cost-rules/${ruleId}/actions`, async (route) => {
    postCount += 1;
    markPostArrived();
    await postGate;
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "cost_rule_revision_conflict",
          message: "规则版本冲突",
          action_hint: "刷新规则并使用最新 revision。",
        },
        request_id: "p22-action-conflict",
        trace_id: "p22-action-conflict-trace",
      },
    });
  });
  await page.goto("/sourcing/cost-rules");
  const trigger = page.getByRole("button", { name: "选品经理批准", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "选品经理审批" });
  const confirm = dialog.getByRole("button", { name: "确认批准", exact: true });
  await dialog.getByLabel("操作原因（至少 2 个字）").fill("已核对费用来源和适用范围");
  await dialog.getByRole("button", { name: "关闭操作确认" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "关闭操作确认" })).toBeFocused();

  await confirm.click();
  await postArrived;
  await expect(dialog).toHaveAttribute("aria-busy", "true");
  await expect(dialog.getByRole("button", { name: "关闭操作确认" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("操作原因（至少 2 个字）")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.locator("form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
  expect(postCount).toBe(1);

  releasePost();
  await expect(dialog.getByRole("alert")).toContainText("p22-action-conflict");
  await expect(dialog.getByLabel("操作原因（至少 2 个字）")).toHaveValue(
    "已核对费用来源和适用范围",
  );
  await expect(dialog.getByLabel("操作原因（至少 2 个字）")).toBeEnabled();
  expect(postCount).toBe(1);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
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
  await expect(page).toHaveURL(new RegExp(`rule=${accumulated[10].id}`));
});

test("M04-04 selected cost rule stays aligned with the route query", async ({ page }) => {
  await navigation(page, { roles: ["auditor"], capabilities: ["opportunity:read"] });
  const rules = ["A", "B"].map((id) => ({
    id: `00000000-0000-4000-8000-${id === "A" ? "000000000461" : "000000000462"}`,
    market: "US",
    platform: "amazon",
    version_code: `route-${id}`,
    name: `${id}规则`,
    status: "retired",
    fee_lines: [],
    conversion_rates: [],
    automatic_scope: null,
    effective_from: "2026-08-25",
    revision: 4,
    approvals: ["selection_manager", "organization_admin"],
    published_at: "2026-08-25T01:00:00.000Z",
    updated_at: "2026-08-25T01:00:00.000Z",
  }));
  await page.route("**/api/v1/cost-rules", (route) => route.fulfill({ json: envelope(rules) }));
  await page.goto(`/sourcing/cost-rules?rule=${rules[0].id}`);
  await expect(page.getByRole("heading", { name: "A规则", level: 3 })).toBeVisible();

  const search = page.getByRole("searchbox", { name: "搜索规则" });
  await search.fill("B规则");
  await expect(page.getByRole("heading", { name: "B规则", level: 3 })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`rule=${rules[1].id}`));
  expect(new URL(page.url()).searchParams.has("search")).toBe(false);

  await page.evaluate((id) => {
    window.history.pushState({}, "", `/sourcing/cost-rules?rule=${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, rules[0].id);
  await expect(page.getByRole("heading", { name: "A规则", level: 3 })).toBeVisible();
  await expect(search).toHaveValue("");

  await page.evaluate((id) => {
    window.history.pushState({}, "", `/sourcing/cost-rules?rule=${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, rules[1].id);
  await expect(page.getByRole("heading", { name: "B规则", level: 3 })).toBeVisible();
});

test("M04-04 open action stays bound to its rule when the route selection changes", async ({
  page,
}) => {
  await navigation(page, { roles: ["selection_manager"] });
  const makeRule = (id: string, name: string) => ({
    id,
    market: "US",
    platform: "amazon",
    version_code: name,
    name,
    status: "draft",
    fee_lines: [],
    conversion_rates: [],
    automatic_scope: null,
    effective_from: "2026-08-25",
    revision: 4,
    approvals: [],
    published_at: null,
    updated_at: "2026-08-25T01:00:00.000Z",
  });
  const ruleA = makeRule("00000000-0000-4000-8000-000000000471", "A费用规则"),
    ruleB = makeRule("00000000-0000-4000-8000-000000000472", "B费用规则");
  let currentRules = [ruleA, ruleB];
  let submitted: { id: string; body: Record<string, unknown> } | null = null;
  await page.route("**/api/v1/cost-rules", (route) =>
    route.fulfill({ json: envelope(currentRules) }),
  );
  await page.route("**/api/v1/cost-rules/*/actions", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!;
    submitted = { id, body: route.request().postDataJSON() as Record<string, unknown> };
    currentRules = [{ ...ruleA, status: "pending_approval", revision: 5 }, ruleB];
    await route.fulfill({
      json: envelope({ ...ruleA, status: "pending_approval", revision: 5 }),
    });
  });
  await page.goto(`/sourcing/cost-rules?rule=${ruleA.id}`);
  await expect(page.getByRole("heading", { name: "A费用规则", level: 3 })).toBeVisible();
  await page.getByRole("button", { name: "提交审批" }).click();
  const dialog = page.getByRole("dialog", { name: "提交费用规则审批" });
  await dialog.getByLabel("操作原因（至少 2 个字）").fill("提交 A 规则审议");

  await page.evaluate((id) => {
    window.history.pushState({}, "", `/sourcing/cost-rules?rule=${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, ruleB.id);
  await expect(page.getByRole("heading", { name: "B费用规则", level: 3 })).toBeVisible();
  await dialog.getByRole("button", { name: "确认提交审批" }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted).toEqual({
    id: ruleA.id,
    body: {
      action: "submit",
      reason: "提交 A 规则审议",
      expected_revision: 4,
    },
  });
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

test("M04-04 organization administrator rejection uses its own approval role", async ({ page }) => {
  await navigation(page, { roles: ["organization_admin"] });
  let current = {
    ...phase2CostRule("pending_approval"),
    approvals: ["selection_manager"],
  };
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/v1/cost-rules", (route) => route.fulfill({ json: envelope([current]) }));
  await page.route(`**/api/v1/cost-rules/${ruleId}/actions`, async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    current = { ...current, status: "rejected", revision: current.revision + 1 };
    await route.fulfill({ json: envelope(current) });
  });
  await page.goto("/sourcing/cost-rules");
  await expect(page.getByRole("button", { name: "选品经理拒绝" })).toHaveCount(0);
  await page.getByRole("button", { name: "组织管理员拒绝" }).click();
  const dialog = page.getByRole("dialog", { name: "拒绝费用规则" });
  await dialog.getByLabel("操作原因（至少 2 个字）").fill("履约成本来源还需核实");
  await dialog.getByRole("button", { name: "确认拒绝" }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted).toEqual({
    action: "reject",
    reason: "履约成本来源还需核实",
    expected_revision: 7,
    approval_role: "organization_admin",
  });
  await expect(page.locator(".cost-rule-detail > header > b")).toHaveText("已拒绝");
});

test("M04-04.A07/A08/A15 profit detail shows formula components provenance and historical quote", async ({
  page,
}) => {
  await navigation(page);
  const reviewerId = "00000000-0000-4000-8000-000000000448";
  const reviewId = "00000000-0000-4000-8000-000000000449";
  const reviewerReadMethods: string[] = [];
  let reviewerReadAttempts = 0;
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
  await page.route("**/api/v1/cost-input-reviewers", (route) => {
    reviewerReadAttempts += 1;
    reviewerReadMethods.push(route.request().method());
    if (reviewerReadAttempts <= 3)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "reviewer_directory_unavailable",
            message: "复核人名单暂不可用",
            action_hint: "暂时无法读取成本复核人名单，请稍后重试。",
          },
          request_id: "m04-04-reviewer-read-failure",
          trace_id: "m04-04-reviewer-read-failure-trace",
        },
      });
    return route.fulfill({ json: envelope([{ id: reviewerId, label: "成本复核人" }]) });
  });
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
  await openProfitSection(page);
  const reviewerStatus = page.locator(".profit-reviewer-status");
  await expect(reviewerStatus).toHaveAttribute("data-state", "error");
  await expect(reviewerStatus).toContainText("暂时无法读取成本复核人名单，请稍后重试。");
  await expect(reviewerStatus).toContainText("m04-04-reviewer-read-failure");
  await expect(page.getByLabel("指定复核人")).toBeDisabled();
  await expect(page.getByRole("button", { name: "提交双人复核" })).toBeDisabled();
  await reviewerStatus.getByRole("button", { name: "重新加载复核人" }).click();
  await expect(reviewerStatus).toHaveCount(0);
  await expect(page.getByLabel("指定复核人")).toContainText("成本复核人");
  expect(reviewerReadAttempts).toBe(4);
  expect(reviewerReadMethods).toEqual(["GET", "GET", "GET", "GET"]);
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
  await expect(reviewQueue.locator("form")).toHaveCount(0);
  await expect(reviewQueue.locator("article")).toHaveAttribute("data-status", "approved");
  await expect(reviewQueue.getByRole("button", { name: "通过", exact: true })).toHaveCount(0);
});

test("P18 rejected cost review closes its stale inline form after the refreshed row", async ({
  page,
}) => {
  await navigation(page);
  const reviewerId = "00000000-0000-4000-8000-000000000468";
  const reviewId = "00000000-0000-4000-8000-000000000469";
  const review = {
    id: reviewId,
    cost_input_id: "00000000-0000-4000-8000-000000000470",
    input_type: "purchase_price",
    amount_value: 40,
    currency: "CNY",
    platform: "amazon",
    input_version: 1,
    evidence_id: "00000000-0000-4000-8000-000000000471",
    submitter_id: "00000000-0000-4000-8000-000000000472",
    submitter_label: "成本提交人",
    reviewer_id: reviewerId,
    reviewer_label: "当前复核人",
    status: "pending",
    due_at: "2026-10-01T12:00:00.000Z",
    overdue: false,
    can_review: true,
    decision_reason: null,
    version: 1,
  };
  let submitted: Record<string, unknown> | null = null;
  let profitReads = 0;
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: opportunityId,
        name: "驳回复核状态测试机会",
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
        profit_status: "insufficient_data",
        risk_level: "unknown",
        confidence: { status: "measured", score: 80 },
        evidence_count: 0,
        source_count: 0,
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
          profit: "insufficient_data",
          risk: "insufficient_data",
          execution: "not_available",
        },
      }),
    }),
  );
  await page.route("**/api/v1/cost-input-reviewers", (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) => {
    profitReads += 1;
    return route.fulfill({
      json: envelope({
        latest_run: null,
        current_inputs: [],
        cost_input_reviews: [
          submitted
            ? {
                ...review,
                status: "rejected",
                can_review: false,
                decision_reason: submitted.reason,
                version: 2,
              }
            : review,
        ],
      }),
    });
  });
  await page.route(
    `**/api/v1/opportunities/${opportunityId}/cost-input-reviews/${reviewId}/actions`,
    async (route) => {
      submitted = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: envelope({ status: "rejected" }) });
    },
  );

  await page.goto(`/opportunities/${opportunityId}`);
  await openProfitSection(page);
  const queue = page.locator(".profit-review-queue");
  await queue.getByRole("button", { name: "驳回", exact: true }).click();
  await queue.getByLabel("驳回原因").fill("采购金额与证据不符");
  await queue.getByRole("button", { name: "提交", exact: true }).click();

  await expect
    .poll(() => submitted)
    .toEqual({
      decision: "rejected",
      reason: "采购金额与证据不符",
      expected_version: 1,
    });
  await expect.poll(() => profitReads).toBeGreaterThan(1);
  await expect(page.getByText("成本复核已驳回；原提交保留但不会进入利润计算。")).toBeVisible();
  await expect(queue.locator("form")).toHaveCount(0);
  await expect(queue.locator("article")).toHaveAttribute("data-status", "rejected");
  await expect(queue.getByText("处理说明：采购金额与证据不符")).toBeVisible();
  await expect(queue.getByRole("button", { name: "驳回", exact: true })).toHaveCount(0);
});

test("P18 cost submission preserves local time and rejects duplicate in-flight POSTs", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.PLAYWRIGHT_WEB_PORT ?? 5173}`,
    timezoneId: "Asia/Tokyo",
  });
  try {
    const page = await context.newPage();
    await navigation(page);
    const reviewerId = "00000000-0000-4000-8000-000000000452";
    let releaseCostPost!: () => void;
    let markCostPostStarted!: () => void;
    const costPostGate = new Promise<void>((resolve) => (releaseCostPost = resolve));
    const costPostStarted = new Promise<void>((resolve) => (markCostPostStarted = resolve));
    const submissions: Record<string, unknown>[] = [];
    await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
      route.fulfill({
        json: envelope({
          id: opportunityId,
          name: "成本时间测试机会",
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
          profit_status: "insufficient_data",
          risk_level: "unknown",
          confidence: { status: "measured", score: 80 },
          evidence_count: 0,
          source_count: 0,
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
            profit: "insufficient_data",
            risk: "insufficient_data",
            execution: "not_available",
          },
        }),
      }),
    );
    await page.route("**/api/v1/cost-input-reviewers", (route) =>
      route.fulfill({ json: envelope([{ id: reviewerId, label: "成本复核人" }]) }),
    );
    await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
      route.fulfill({
        json: envelope({ latest_run: null, current_inputs: [], cost_input_reviews: [] }),
      }),
    );
    await page.route(`**/api/v1/opportunities/${opportunityId}/cost-inputs`, async (route) => {
      submissions.push(route.request().postDataJSON() as Record<string, unknown>);
      markCostPostStarted();
      await costPostGate;
      await route.fulfill({ status: 201, json: envelope({ id: ruleId }) });
    });

    await page.goto(`/opportunities/${opportunityId}`);
    await openProfitSection(page);
    const observedAt = page.getByLabel("观测时间");
    await expect(observedAt).toHaveValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const localValue = await observedAt.inputValue();
    const expectedInstant = await page.evaluate(
      (value) => new Date(value).toISOString(),
      localValue,
    );
    const localEpoch = await page.evaluate((value) => new Date(value).getTime(), localValue);
    expect(Math.abs(Date.now() - localEpoch)).toBeLessThan(120_000);

    await page.getByLabel("来源标识").fill("source:local-time-check");
    await page.getByLabel("证据 ID").fill("00000000-0000-4000-8000-000000000453");
    await page.getByLabel("指定复核人").selectOption(reviewerId);
    const form = page.locator("form.profit-input");
    await form.evaluate((element) => (element as HTMLFormElement).requestSubmit());
    await costPostStarted;
    await form.evaluate((element) => (element as HTMLFormElement).requestSubmit());
    await page.waitForTimeout(100);
    expect(submissions).toHaveLength(1);
    const response = page.waitForResponse(
      (candidate) =>
        candidate.url().includes(`/api/v1/opportunities/${opportunityId}/cost-inputs`) &&
        candidate.status() === 201,
    );
    releaseCostPost();
    await response;
    expect(submissions[0]).toMatchObject({ observed_at: expectedInstant });
  } finally {
    await context.close();
  }
});

test("P18 cost review rejects a duplicate requestSubmit while approval is pending", async ({
  page,
}) => {
  await navigation(page);
  const reviewId = "00000000-0000-4000-8000-000000000459";
  let reviewStatus: "pending" | "approved" = "pending";
  let releaseReviewPost!: () => void;
  let markReviewPostStarted!: () => void;
  const reviewPostGate = new Promise<void>((resolve) => (releaseReviewPost = resolve));
  const reviewPostStarted = new Promise<void>((resolve) => (markReviewPostStarted = resolve));
  const reviewBodies: Record<string, unknown>[] = [];
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: opportunityId,
        name: "待复核成本机会",
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
        profit_status: "insufficient_data",
        risk_level: "unknown",
        confidence: { status: "measured", score: 80 },
        evidence_count: 0,
        source_count: 0,
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
          profit: "insufficient_data",
          risk: "insufficient_data",
          execution: "not_available",
        },
      }),
    }),
  );
  await page.route("**/api/v1/cost-input-reviewers", (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({
      json: envelope({
        latest_run: null,
        current_inputs: [],
        cost_input_reviews: [
          {
            id: reviewId,
            cost_input_id: "00000000-0000-4000-8000-000000000460",
            input_type: "purchase_price",
            amount_value: 40,
            currency: "CNY",
            platform: "amazon",
            input_version: 1,
            evidence_id: "00000000-0000-4000-8000-000000000461",
            submitter_id: "00000000-0000-4000-8000-000000000462",
            submitter_label: "成本提交人",
            reviewer_id: "00000000-0000-4000-8000-000000000463",
            reviewer_label: "当前复核人",
            status: reviewStatus,
            due_at: "2026-10-01T12:00:00.000Z",
            overdue: false,
            can_review: reviewStatus === "pending",
            decision_reason: reviewStatus === "approved" ? "核验来源与币种" : null,
            version: reviewStatus === "approved" ? 2 : 1,
          },
        ],
      }),
    }),
  );
  await page.route(
    `**/api/v1/opportunities/${opportunityId}/cost-input-reviews/${reviewId}/actions`,
    async (route) => {
      reviewBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      markReviewPostStarted();
      await reviewPostGate;
      reviewStatus = "approved";
      await route.fulfill({ json: envelope({ status: "approved", version: 2 }) });
    },
  );

  await page.goto(`/opportunities/${opportunityId}`);
  await openProfitSection(page);
  const queue = page.locator(".profit-review-queue");
  await queue.getByRole("button", { name: "通过", exact: true }).click();
  const form = queue.locator("form");
  await form.getByLabel("复核说明").fill("核验来源与币种");
  await form.evaluate((element) => (element as HTMLFormElement).requestSubmit());
  await reviewPostStarted;
  await form.evaluate((element) => (element as HTMLFormElement).requestSubmit());
  await page.waitForTimeout(100);
  expect(reviewBodies).toHaveLength(1);
  expect(reviewBodies[0]).toEqual({
    decision: "approved",
    reason: "核验来源与币种",
    expected_version: 1,
  });

  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(`/cost-input-reviews/${reviewId}/actions`) &&
      candidate.status() === 200,
  );
  releaseReviewPost();
  await response;
  await expect(
    page.getByText("成本复核已通过并生效；如有活动费用规则，利润重算已排队。"),
  ).toBeVisible();
  await expect(form).toHaveCount(0);
  await expect(queue.locator("article")).toHaveAttribute("data-status", "approved");
  expect(reviewBodies).toHaveLength(1);
});

test("P18 cancelling an inline cost review returns focus and discards its draft", async ({
  page,
}) => {
  await navigation(page);
  const reviewId = "00000000-0000-4000-8000-000000000464";
  const review = {
    id: reviewId,
    cost_input_id: "00000000-0000-4000-8000-000000000465",
    input_type: "purchase_price",
    amount_value: 40,
    currency: "CNY",
    platform: "amazon",
    input_version: 1,
    evidence_id: "00000000-0000-4000-8000-000000000466",
    submitter_id: "00000000-0000-4000-8000-000000000467",
    submitter_label: "成本提交人",
    reviewer_id: "00000000-0000-4000-8000-000000000468",
    reviewer_label: "当前复核人",
    status: "pending",
    due_at: "2026-10-01T12:00:00.000Z",
    overdue: false,
    can_review: true,
    decision_reason: null,
    version: 1,
  };
  let reviewWrites = 0;
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: opportunityId,
        name: "待复核成本机会",
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
        profit_status: "insufficient_data",
        risk_level: "unknown",
        confidence: { status: "measured", score: 80 },
        evidence_count: 0,
        source_count: 0,
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
          profit: "insufficient_data",
          risk: "insufficient_data",
          execution: "not_available",
        },
      }),
    }),
  );
  await page.route("**/api/v1/cost-input-reviewers", (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({
      json: envelope({ latest_run: null, current_inputs: [], cost_input_reviews: [review] }),
    }),
  );
  await page.route(
    `**/api/v1/opportunities/${opportunityId}/cost-input-reviews/${reviewId}/actions`,
    (route) => {
      reviewWrites += 1;
      return route.fulfill({ json: envelope({ status: "approved" }) });
    },
  );

  await page.goto(`/opportunities/${opportunityId}`);
  await openProfitSection(page);
  const queue = page.locator(".profit-review-queue");
  for (const decision of ["通过", "驳回"]) {
    const trigger = queue.getByRole("button", { name: decision, exact: true });
    await trigger.click();
    const form = queue.locator("form");
    const reason = form.getByRole("textbox");
    await reason.fill("未完成的复核草稿");
    await form.getByRole("button", { name: "取消", exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(reviewWrites).toBe(0);
    await trigger.click();
    await expect(queue.locator("form").getByRole("textbox")).toHaveValue("");
    await queue.locator("form").getByRole("button", { name: "取消", exact: true }).click();
  }
});

test("a late reviewer-directory failure cannot replace the current opportunity reviewers", async ({
  page,
}) => {
  const nextOpportunityId = "00000000-0000-4000-8000-000000000454";
  await navigation(page);
  const detailFor = (id: string, name: string) => ({
    id,
    name,
    market: "US",
    category: "outdoor",
    source_type: "manual",
    source_ref_id: null,
    owner_id: null,
    lifecycle_status: "ready",
    lifecycle_entered_at: "2026-08-08T00:00:00.000Z",
    lifecycle_dwell_seconds: 120,
    recommendation_status: "observe",
    overall_score: 72,
    trend_score: 80,
    competition_score: 65,
    profit_status: "calculated",
    risk_level: "unknown",
    confidence: { status: "measured", score: 80 },
    evidence_count: 0,
    source_count: 0,
    coverage_status: "partial",
    blocking_reasons: [],
    decision_status: "pending",
    version: 1,
    updated_at: "2026-08-08T00:00:00.000Z",
    selection_stage: "rule_candidate",
    quality_gates: {
      score: false,
      market: false,
      competition: false,
      cost: false,
      risk: false,
      all_passed: false,
    },
    score_rule_version: null,
    scored_at: null,
    latest_score_run: null,
    score_components: [],
    lineage: {
      freshness: { observed_at: "2026-08-08T00:00:00.000Z", age_seconds: 120 },
      failure_impact: { level: "healthy", codes: [], affected_stages: [] },
      request_ids: [],
      trace_ids: [],
      nodes: [],
    },
    operating_feedback: { facts: [], calibration: null },
    adoption_blockers: [],
    redecision_ready: false,
    evidence: [],
    decisions: [],
    section_status: {
      market: "covered",
      competition: "covered",
      profit: "calculated",
      risk: "insufficient_data",
      execution: "not_available",
    },
  });
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({ json: envelope(detailFor(opportunityId, "旧机会成本复核")) }),
  );
  await page.route(`**/api/v1/opportunities/${nextOpportunityId}`, (route) =>
    route.fulfill({ json: envelope(detailFor(nextOpportunityId, "当前机会成本复核")) }),
  );
  for (const id of [opportunityId, nextOpportunityId]) {
    await page.route(`**/api/v1/opportunities/${id}/profit-analysis`, (route) =>
      route.fulfill({
        json: envelope({ latest_run: null, current_inputs: [], cost_input_reviews: [] }),
      }),
    );
    await page.route(`**/api/v1/opportunities/${id}/ai-analyses`, (route) =>
      route.fulfill({ json: envelope([]) }),
    );
  }
  await page.route("**/api/v1/sourcing/searches", (route) => route.fulfill({ json: envelope([]) }));
  let reviewerReadCount = 0;
  let releaseOldReviewers!: () => void;
  let markOldReviewerReadStarted!: () => void;
  let markOldReviewerReadResolved!: () => void;
  const oldReviewersGate = new Promise<void>((resolve) => (releaseOldReviewers = resolve));
  const oldReviewerReadStarted = new Promise<void>(
    (resolve) => (markOldReviewerReadStarted = resolve),
  );
  const oldReviewerReadResolved = new Promise<void>(
    (resolve) => (markOldReviewerReadResolved = resolve),
  );
  await page.route("**/api/v1/cost-input-reviewers", async (route) => {
    reviewerReadCount += 1;
    if (reviewerReadCount === 1) {
      markOldReviewerReadStarted();
      await oldReviewersGate;
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "reviewer_directory_unavailable",
            message: "旧机会复核人读取失败",
            action_hint: "旧机会复核人读取失败。",
          },
        },
      });
      markOldReviewerReadResolved();
      return;
    }
    await route.fulfill({ json: envelope([{ id: "current-reviewer", label: "当前机会复核人" }]) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await oldReviewerReadStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  await page.evaluate((id) => {
    window.history.pushState({}, "", `/opportunities/${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, nextOpportunityId);
  await currentDetailRequest;
  await expect(page.getByRole("heading", { name: "当前机会成本复核", exact: true })).toBeVisible();
  await openProfitSection(page);
  await expect(page.getByLabel("指定复核人")).toContainText("当前机会复核人");

  releaseOldReviewers();
  await oldReviewerReadResolved;
  await expect(page.getByLabel("指定复核人")).toContainText("当前机会复核人");
  await expect(page.getByText("旧机会复核人读取失败", { exact: true })).toHaveCount(0);
  expect(reviewerReadCount).toBe(2);
});
