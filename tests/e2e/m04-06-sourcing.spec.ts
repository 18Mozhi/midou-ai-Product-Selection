import { test, expect, type Locator, type Page } from "@playwright/test";

const searchId = "00000000-0000-4000-8000-000000000601";
const envelope = (data: unknown) => ({
  data,
  request_id: "m04-06-e2e-request",
  trace_id: "m04-06-e2e-trace",
});

const readyCandidate = {
  id: "00000000-0000-4000-8000-000000000602",
  supplier_name: "宁波澄净户外用品厂",
  product_title: "500ml 便携滤芯净水杯",
  specification: "500ml / 蓝色 / 单只彩盒",
  moq: 100,
  quoted_price: 12.8,
  currency: "CNY",
  lead_time_days: 7,
  location: "浙江宁波",
  original_url: "https://example.test/supply/ready",
  observed_at: "2026-08-08T12:00:00.000Z",
  evidence_id: "00000000-0000-4000-8000-000000000603",
  confidence_value: 88,
  status: "ready",
  missing_fields: [],
  quote: {
    id: "00000000-0000-4000-8000-000000000604",
    version: 2,
    stability_status: "stable",
    risk_level: "low",
  },
};

const incompleteCandidate = {
  id: "00000000-0000-4000-8000-000000000605",
  supplier_name: "广州清流供应链",
  product_title: "户外过滤水杯基础款",
  specification: null,
  moq: 200,
  quoted_price: 10.6,
  currency: "CNY",
  lead_time_days: null,
  location: null,
  original_url: "https://example.test/supply/incomplete",
  observed_at: "2026-08-08T12:05:00.000Z",
  evidence_id: "00000000-0000-4000-8000-000000000606",
  confidence_value: null,
  status: "incomplete",
  missing_fields: [
    "specification",
    "lead_time_days",
    "location",
    "confidence_value",
    "stability_status",
    "risk_level",
  ],
  quote: null,
};
const comparisonQuote = {
  id: "00000000-0000-4000-8000-000000000609",
  supplier_name: "苏州清泉日用品厂",
  product_title: "600ml 户外净水杯",
  specification: "600ml / 绿色 / 双滤芯",
  moq: 300,
  quoted_price: 11.9,
  currency: "CNY",
  lead_time_days: 12,
  location: "江苏苏州",
  confidence_value: 82,
  stability_status: "stable",
  risk_level: "low",
  evidence_id: "00000000-0000-4000-8000-000000000610",
};

async function setup(
  page: Page,
  capabilities = ["task:read", "sourcing:read", "supplier_quote:manage", "cost:confirm"],
) {
  let preference = { theme: "deep-ocean", version: 1 };
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as { theme: string };
      preference = { theme: body.theme, version: preference.version + 1 };
    }
    await route.fulfill({ json: envelope(preference) });
  });
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000607",
        workspace_id: "00000000-0000-4000-8000-000000000608",
        roles: ["selection_manager"],
        capabilities,
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  const summary = {
    id: searchId,
    input_type: "keyword",
    input_ref: "便携净水杯",
    status: "completed_with_warnings",
    candidate_count: 2,
    missing_fields: [
      "specification",
      "lead_time_days",
      "location",
      "confidence_value",
      "stability_status",
      "risk_level",
    ],
    created_at: "2026-08-08T12:00:00.000Z",
  };
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({
      json: envelope({ ...summary, candidates: [readyCandidate, incompleteCandidate] }),
    }),
  );
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({ json: envelope([summary]) }),
  );
  await page.route("**/api/v1/sourcing/comparisons", (route) =>
    route.fulfill({
      json: envelope([
        {
          id: "00000000-0000-4000-8000-000000000611",
          name: "便携净水杯报价对比",
          quotes: [
            {
              id: readyCandidate.quote.id,
              supplier_name: readyCandidate.supplier_name,
              product_title: readyCandidate.product_title,
              specification: readyCandidate.specification,
              moq: readyCandidate.moq,
              quoted_price: readyCandidate.quoted_price,
              currency: readyCandidate.currency,
              lead_time_days: readyCandidate.lead_time_days,
              location: readyCandidate.location,
              confidence_value: readyCandidate.confidence_value,
              stability_status: readyCandidate.quote.stability_status,
              risk_level: readyCandidate.quote.risk_level,
              evidence_id: readyCandidate.evidence_id,
            },
            comparisonQuote,
          ],
          created_at: "2026-08-08T13:00:00.000Z",
        },
      ]),
    }),
  );
}

for (const scenario of [
  {
    name: "running",
    status: "running",
    active: 1,
    blocked: 0,
    failed: 0,
    text: "采集任务正在执行或等待来源返回",
  },
  {
    name: "queued",
    status: "queued",
    active: 1,
    blocked: 0,
    failed: 0,
    text: "采集任务仍在等待处理",
  },
  {
    name: "blocked",
    status: "completed_with_warnings",
    active: 0,
    blocked: 1,
    failed: 0,
    text: "来源采集受阻",
  },
  {
    name: "failed",
    status: "failed",
    active: 0,
    blocked: 0,
    failed: 1,
    text: "本次采集已结束且未取得供应商报价",
  },
  {
    name: "empty",
    status: "completed",
    active: 0,
    blocked: 0,
    failed: 0,
    text: "当前记录没有供应商候选",
  },
  {
    name: "unknown",
    status: "unknown",
    active: 0,
    blocked: 0,
    failed: 0,
    text: "当前记录没有供应商候选",
  },
]) {
  test(`empty sourcing status remains factual for ${scenario.name}`, async ({ page }) => {
    await setup(page);
    const search = {
      id: searchId,
      input_type: "keyword",
      input_ref: "便携净水杯",
      status: "succeeded_empty",
      candidate_count: 0,
      missing_fields: ["supplier_listing"],
      created_at: "2026-08-08T12:00:00.000Z",
    };
    await page.route("**/api/v1/sourcing/searches", (route) =>
      route.fulfill({ json: envelope([search]) }),
    );
    await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
      route.fulfill({
        json: envelope({
          ...search,
          candidates: [],
          collection_progress:
            scenario.name === "unknown"
              ? null
              : {
                  status: scenario.status,
                  total_subqueries: 1,
                  successful_subqueries: scenario.name === "empty" ? 1 : 0,
                  failed_subqueries: scenario.failed,
                  blocked_subqueries: scenario.blocked,
                  active_subqueries: scenario.active,
                  available_at: "2026-08-08T12:00:00.000Z",
                },
        }),
      }),
    );
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/sourcing/") && request.method() !== "GET")
        writes.push(request.method());
    });
    await page.goto("/sourcing");
    await expect(page.locator(".sourcing-pending")).toContainText(scenario.text);
    await expect(page.locator(".sourcing-pending")).not.toContainText(
      "正在采集供应商信息，完成后将显示候选",
    );
    await expect(page.locator(".sourcing-missing")).toHaveCount(1);
    await expect(page.locator(".sourcing-missing")).toHaveText("待补齐：供应商商品资料");
    await expect(page.locator(".sourcing-detail")).not.toContainText("supplier_listing");
    if (scenario.name !== "unknown") {
      const progress = page.getByRole("region", { name: "来源采集进度", exact: true });
      await expect(progress.locator("progress")).toHaveCount(0);
      for (const [label, count] of [
        ["成功", scenario.name === "empty" ? 1 : 0],
        ["受阻", scenario.blocked],
        ["失败", scenario.failed],
        ["执行中 / 等待", scenario.active],
      ] as const)
        await expect(
          progress.locator("dl div").filter({ hasText: label }).locator("dd"),
        ).toHaveText(String(count));
    }
    expect(writes).toEqual([]);
  });
}

async function verifyDialogFocusCycle(
  page: Page,
  trigger: Locator,
  title: string,
  closeLabel: string,
  submitLabel: string,
) {
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: title });
  const close = dialog.getByRole("button", { name: closeLabel });
  const submit = dialog.getByRole("button", { name: submitLabel, exact: true });
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize();
  const geometry = await dialog.evaluate((element) => {
    const dialogBounds = element.getBoundingClientRect();
    const formBounds = element.querySelector("form")?.getBoundingClientRect();
    return {
      nativeModal: element instanceof HTMLDialogElement && element.open,
      dialog: {
        left: dialogBounds.left,
        top: dialogBounds.top,
        right: dialogBounds.right,
        bottom: dialogBounds.bottom,
      },
      form: formBounds
        ? {
            left: formBounds.left,
            top: formBounds.top,
            right: formBounds.right,
            bottom: formBounds.bottom,
          }
        : null,
    };
  });
  expect(geometry.nativeModal).toBe(true);
  expect(geometry.form).not.toBeNull();
  expect(geometry.dialog.left).toBeGreaterThanOrEqual(0);
  expect(geometry.dialog.top).toBeGreaterThanOrEqual(0);
  expect(geometry.dialog.right).toBeLessThanOrEqual(viewport!.width);
  expect(geometry.dialog.bottom).toBeLessThanOrEqual(viewport!.height);
  expect(geometry.form!.left).toBeGreaterThanOrEqual(geometry.dialog.left);
  expect(geometry.form!.right).toBeLessThanOrEqual(geometry.dialog.right);
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

async function rejectSourcingRequest(page: Page, path: string, method: string, requestId: string) {
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: "sourcing_dependency_unavailable",
          message: "sourcing dependency unavailable",
          action_hint: "服务暂时无法完成这项操作，请检查后重试。",
        },
        request_id: requestId,
        trace_id: `${requestId}-trace`,
      },
    });
  });
}

async function navigateMemberMenu(page: Page, label: "选品工作台" | "1688 找货") {
  const sidebar = page.getByRole("complementary", { name: "工作区导航" });
  if (await sidebar.isVisible()) {
    await sidebar.getByRole("link", { name: label, exact: true }).click();
    return;
  }
  const toggle = page.getByRole("button", { name: "打开导航菜单" });
  if (await toggle.isVisible()) await toggle.click();
  const navigation = page.getByRole("navigation", { name: "成员工作台导航" });
  await navigation.getByRole("link", { name: label, exact: true }).click();
}

test("source price conditions remain visible without relabelling confirmed quotes", async ({
  page,
}) => {
  await setup(page);
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: searchId,
        input_type: "image",
        input_ref: "image",
        status: "completed_with_warnings",
        candidate_count: 2,
        missing_fields: [],
        created_at: "2026-10-17T00:00:00Z",
        candidates: [
          { ...readyCandidate, source_price_description: "旧采集新人价" },
          { ...incompleteCandidate, source_price_description: "新人价" },
        ],
      }),
    }),
  );
  await page.goto("/sourcing");
  const cards = page.locator(".supplier-cards");
  const raw = cards.locator("article").filter({ hasText: incompleteCandidate.supplier_name });
  await expect(raw.getByText("采集价格说明", { exact: true })).toBeVisible();
  await expect(raw.getByText("新人价", { exact: true })).toBeVisible();
  const confirmed = cards.locator("article").filter({ hasText: readyCandidate.supplier_name });
  await expect(confirmed.getByText("CNY 12.8", { exact: true })).toBeVisible();
  await expect(confirmed.getByText("旧采集新人价", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".member-module-guide")).toHaveCount(0);
});

test("M04-06.A07/A08/A09/A15 renders source-backed suppliers, missing fields and responsive actions", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/sourcing?create=1");
  await expect(page.getByRole("heading", { name: "供应链找货", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "发起供应商找货" })).toBeVisible();
  await expect(page.getByLabel("输入类型").locator("option")).toHaveText([
    "关键词",
    "图片",
    "机会",
    "商品链接",
  ]);
  await page.getByRole("button", { name: "关闭供应商搜索" }).click();
  const supplierCandidates = page.locator(".supplier-cards");
  await expect(supplierCandidates.getByText("宁波澄净户外用品厂")).toBeVisible();
  await expect(
    page.getByText("待补齐：规格、交期、所在地、可信度、稳定性、风险", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("找货流程")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "刷新记录", exact: true })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "找货记录" }).getByRole("button", { pressed: true }),
  ).toHaveCount(1);
  await expect(page.getByText(/证据 00000000-0000-4000-8000-000000000603/)).toBeVisible();
  await expect(supplierCandidates.getByText("CNY 12.8")).toBeVisible();
  await expect(supplierCandidates.getByText("待费用规则计算").first()).toBeVisible();
  await expect(supplierCandidates.getByText("采集于 2026/08/08 20:00")).toBeVisible();
  await expect(page.getByRole("link", { name: "费用与利润规则" }).last()).toHaveAttribute(
    "href",
    new RegExp(`from=/sourcing\\?record=${searchId}`),
  );
  const comparison = page.getByLabel("规格、最小起订量与交期对比");
  const specificationHint = page.getByLabel("规格归一化提示");
  await expect(specificationHint).toContainText("存在 2 种规格文本，尚未归一");
  await expect(specificationHint).toContainText("系统不会自动换算或判断等价");
  await expect(comparison.getByText("500ml / 蓝色 / 单只彩盒")).toBeVisible();
  await expect(comparison.getByText("600ml / 绿色 / 双滤芯")).toBeVisible();
  await expect(comparison.getByText("300", { exact: true })).toBeVisible();
  await expect(comparison.getByText("12 天", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "确认报价" }).click();
  await expect(page.getByRole("heading", { name: "确认完整供应商报价" })).toBeVisible();
  await page.getByRole("button", { name: "关闭报价编辑" }).click();
  await supplierCandidates.getByLabel("加入对比").check();
  await expect(page.getByText("已选 1 / 5 家供应商")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存报价对比" })).toBeDisabled();
});

test.describe("supplier quote observation time", () => {
  test.use({ timezoneId: "America/New_York" });

  test("preserves the evidence instant through a non-UTC datetime-local editor", async ({
    page,
  }) => {
    await setup(page);
    let submitted: Record<string, unknown> | null = null;
    await page.route("**/api/v1/sourcing/quotes", async (route) => {
      submitted = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, json: envelope({ id: "quote-timezone-proof" }) });
    });
    await page.goto("/sourcing");
    await page.getByRole("button", { name: "确认报价" }).click();
    const dialog = page.getByRole("dialog", { name: "确认完整供应商报价" });
    await expect(dialog.getByLabel("观测时间")).toHaveValue("2026-08-08T08:05");
    await dialog.getByLabel("规格").fill("500ml / 蓝色 / 单只彩盒");
    await dialog.getByLabel("所在地").fill("浙江宁波");
    await dialog.getByLabel("稳定性").selectOption("stable");
    await dialog.getByLabel("风险").selectOption("low");
    await dialog.getByRole("button", { name: "确认新版本" }).click();
    await expect.poll(() => submitted).not.toBeNull();
    expect(submitted?.observed_at).toBe(incompleteCandidate.observed_at);
  });
});

async function opportunitySetup(
  page: Page,
  analysis: unknown,
  currentStatus = "insufficient_data",
) {
  await setup(page);
  const opportunityId = "00000000-0000-4000-8000-000000000612";
  const search = {
    id: searchId,
    input_type: "opportunity",
    input_ref: opportunityId,
    display_name: "当前商品",
    status: "completed",
    candidate_count: 1,
    missing_fields: [],
    created_at: "2026-08-08T12:00:00.000Z",
  };
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({ json: envelope([search]) }),
  );
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({ json: envelope({ ...search, candidates: [readyCandidate] }) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({ json: envelope({ id: opportunityId, profit_status: currentStatus }) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({ json: envelope(analysis) }),
  );
  return { opportunityId, search };
}
const calculatedProfit = (amount: number, rule = "current-rule") => ({
  latest_run: {
    id: rule,
    status: "calculated",
    rule_version_code: rule,
    platform: "amazon",
    market: "US",
    currency: "USD",
    sale_price: 100,
    total_cost: 20,
    net_profit: amount,
    net_margin_percent: amount,
    missing_fields: [],
    calculated_at: "2026-08-08T12:00:00.000Z",
    components: [],
  },
  current_inputs: [],
  cost_input_reviews: [],
});

test("opportunity sourcing shows read-only current profit without old cost forms or reviewer calls", async ({
  page,
}) => {
  await opportunitySetup(page, calculatedProfit(80), "calculated");
  const forbiddenRequests: string[] = [];
  page.on("request", (r) => {
    if (
      r.url().includes("/api/v1/") &&
      (r.method() !== "GET" || r.url().includes("cost-input-reviewers"))
    )
      forbiddenRequests.push(r.url());
  });
  await page.goto("/sourcing");
  const summary = page.getByRole("region", { name: "成本与利润摘要" });
  await expect(summary).toContainText("80 USD");
  await expect(summary).toContainText("80%");
  await expect(page.locator(".profit-input,.sourcing-cost-confirmation")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "提交双人复核" })).toHaveCount(0);
  await expect(summary.getByRole("link", { name: "查看商品分析" })).toHaveAttribute(
    "href",
    /tab=profit/,
  );
  expect(forbiddenRequests).toEqual([]);
});

test("late profit reads cannot replace the selected supplier record", async ({ page }) => {
  const { opportunityId, search } = await opportunitySetup(
    page,
    calculatedProfit(999),
    "calculated",
  );
  const secondId = "00000000-0000-4000-8000-000000000614";
  const secondSearchId = "00000000-0000-4000-8000-000000000615";
  const second = { ...search, id: secondSearchId, input_ref: secondId, display_name: "另一个商品" };
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({ json: envelope([search, second]) }),
  );
  await page.route(`**/api/v1/sourcing/searches/${secondSearchId}`, (route) =>
    route.fulfill({ json: envelope({ ...second, candidates: [] }) }),
  );
  await page.route(`**/api/v1/opportunities/${secondId}`, (route) =>
    route.fulfill({ json: envelope({ profit_status: "calculated" }) }),
  );
  await page.route(`**/api/v1/opportunities/${secondId}/profit-analysis`, (route) =>
    route.fulfill({ json: envelope(calculatedProfit(80, "second-rule")) }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = false;
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, async (route) => {
    entered = true;
    await gate;
    await route.fulfill({ json: envelope(calculatedProfit(999)) });
  });
  await page.goto("/sourcing");
  await expect.poll(() => entered).toBe(true);
  await page
    .getByRole("complementary", { name: "找货记录" })
    .getByRole("button", { name: /另一个商品/ })
    .click();
  const summary = page.getByRole("region", { name: "成本与利润摘要" });
  await expect(summary).toContainText("80 USD");
  release();
  await expect(summary).not.toContainText("999");
});

test("profit read errors retry without writes and historical calculations stay explicitly unknown", async ({
  page,
}) => {
  const { opportunityId } = await opportunitySetup(page, calculatedProfit(80));
  let reads = 0;
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) => {
    reads++;
    return reads <= 3
      ? route.fulfill({
          status: 503,
          json: {
            error: { code: "profit_unavailable", action_hint: "利润读取暂不可用" },
            request_id: "profit-read-failed",
            trace_id: "profit-read-failed",
          },
        })
      : route.fulfill({ json: envelope(calculatedProfit(80)) });
  });
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/") && r.method() !== "GET") writes.push(r.url());
  });
  await page.goto("/sourcing");
  const summary = page.getByRole("region", { name: "成本与利润摘要" });
  await expect(summary.getByRole("alert")).toContainText("profit-read-failed");
  await summary.getByRole("button", { name: "重新读取利润资料" }).click();
  await expect(summary).toContainText("利润未知");
  await expect(summary.locator("dl")).toHaveCount(0);
  await summary.getByText("查看计算依据").click();
  await expect(summary).toContainText("历史结果不作为当前利润");
  expect(writes).toEqual([]);
});

test("hundreds of sourcing records and supplier offers stay bounded and selectable across pages", async ({
  page,
}) => {
  await setup(page);
  const records = Array.from({ length: 628 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(1000 + i).padStart(12, "0")}`,
    input_type: "keyword",
    input_ref: `长标题商品记录${i + 1}用于检验列表与详情导航`,
    status: "completed",
    candidate_count: 21,
    missing_fields: [],
    created_at: "2026-08-08T12:00:00.000Z",
  }));
  const candidates = Array.from({ length: 21 }, (_, i) => ({
    ...readyCandidate,
    id: `candidate-${i}`,
    supplier_name: `供应商${i + 1}`,
    quote: { ...readyCandidate.quote, id: `quote-${i}` },
  }));
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({ json: envelope(records) }),
  );
  await page.route("**/api/v1/sourcing/searches/*", (route) => {
    const id = route.request().url().split("/").pop();
    return route.fulfill({ json: envelope({ ...records.find((r) => r.id === id), candidates }) });
  });
  await page.goto("/sourcing");
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(20);
  await expect(page.locator(".supplier-cards > article")).toHaveCount(10);
  expect(
    await page
      .getByRole("complementary", { name: "找货记录" })
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeLessThan(900);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(12000);
  const recordPager = page.getByRole("navigation", { name: "找货记录分页" });
  await recordPager.getByRole("button", { name: "下一页" }).click();
  await expect(recordPager).toContainText("2 / 32");
  await expect(
    page
      .getByRole("region", { name: "找货记录详情" })
      .getByRole("heading", { name: /长标题商品记录21/ }),
  ).toBeVisible();
  const supplierPager = page.getByRole("navigation", { name: "货源报价分页" });
  await supplierPager.getByRole("button", { name: "下一页" }).click();
  await supplierPager.getByRole("button", { name: "下一页" }).click();
  await expect(page.locator(".supplier-cards > article")).toHaveCount(1);
  await expect(page.locator(".supplier-cards")).toContainText("供应商21");
  await page.getByRole("searchbox", { name: "搜索找货记录" }).fill("长标题商品记录628用于");
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "找货记录详情" })
      .getByRole("heading", { name: /长标题商品记录628/ }),
  ).toBeVisible();
  await expect(page.locator(".supplier-cards > article")).toHaveCount(10);
  expect(
    await page.locator(".sourcing-record-items").evaluate((e) => e.scrollHeight > e.clientHeight),
  ).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`/sourcing?record=${records[627]!.id}`);
  await expect(page.getByRole("navigation", { name: "找货记录分页" })).toContainText("32 / 32");
  await expect(
    page.getByRole("complementary", { name: "找货记录" }).getByRole("button", { pressed: true }),
  ).toContainText("长标题商品记录628");
});

test("returning to sourcing reads profit again and ignores the pre-deactivation reply", async ({
  page,
}) => {
  const { opportunityId } = await opportunitySetup(page, calculatedProfit(999), "calculated");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, async (route) => {
    const first = ++reads === 1;
    if (first) await gate;
    await route.fulfill({ json: envelope(calculatedProfit(first ? 999 : 90)) });
  });
  await page.goto("/sourcing");
  await expect.poll(() => reads).toBe(1);
  await navigateMemberMenu(page, "选品工作台");
  await expect(page).toHaveURL(/\/home/);
  release();
  await navigateMemberMenu(page, "1688 找货");
  const summary = page.getByRole("region", { name: "成本与利润摘要" });
  await expect(summary).toContainText("90 USD");
  await expect(summary).not.toContainText("999");
});

test("commerce sourcing keeps white surfaces while changing the selected accent", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/sourcing");
  const surface = page.locator(".sourcing-detail");
  await expect(surface).toBeVisible();
  await expect(surface).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const primary = () =>
    page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).getPropertyValue("--so-primary").trim());
  const previousAccent = await primary();
  await page.getByRole("button", { name: "切换界面主题" }).click();
  await page.getByRole("button", { name: /青蓝/ }).click();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("cloud-white");
  await expect.poll(primary).not.toBe(previousAccent);
  await expect(surface).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(surface).toHaveCSS("background-image", "none");
});

test("empty state opens the real sourcing form", async ({ page }) => {
  await setup(page);
  await page.unroute("**/api/v1/sourcing/searches");
  await page.route("**/api/v1/sourcing/searches", (route) => route.fulfill({ json: envelope([]) }));
  await page.goto("/sourcing");
  await page.getByRole("button", { name: "开始创建" }).click();
  const dialog = page.getByRole("dialog", { name: "发起供应商找货" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭供应商搜索" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("four sourcing dialogs contain keyboard focus and return it to their opener", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/sourcing");
  await verifyDialogFocusCycle(
    page,
    page.getByRole("button", { name: "发起供应商找货", exact: true }),
    "发起供应商找货",
    "关闭供应商搜索",
    "开始公开网页采集",
  );
  await verifyDialogFocusCycle(
    page,
    page.getByRole("button", { name: "确认报价", exact: true }),
    "确认完整供应商报价",
    "关闭报价编辑",
    "确认新版本",
  );
  await verifyDialogFocusCycle(
    page,
    page.getByRole("button", { name: "创建采购任务", exact: true }),
    "创建采购任务",
    "关闭采购任务创建",
    "确认创建",
  );
  await verifyDialogFocusCycle(
    page,
    page.getByRole("button", { name: "删除找货记录", exact: true }),
    "删除找货记录",
    "关闭删除确认",
    "确认删除",
  );
});

test("query-opened sourcing dialog returns focus to the page heading without an opener", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/sourcing?create=1");
  const dialog = page.getByRole("dialog", { name: "发起供应商找货" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "供应链找货", level: 1 })).toBeFocused();
});

test("four sourcing write failures stay visible with their request IDs inside each dialog", async ({
  page,
}) => {
  await setup(page);
  await rejectSourcingRequest(page, "/api/v1/sourcing/searches", "POST", "p21-search-fail-503");
  await rejectSourcingRequest(page, "/api/v1/sourcing/quotes", "POST", "p21-quote-fail-503");
  await rejectSourcingRequest(
    page,
    "/api/v1/sourcing/purchase-tasks",
    "POST",
    "p21-purchase-fail-503",
  );
  await rejectSourcingRequest(
    page,
    `/api/v1/sourcing/searches/${searchId}`,
    "DELETE",
    "p21-delete-fail-503",
  );
  await page.goto("/sourcing");

  await page.getByRole("button", { name: "发起供应商找货", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "发起供应商找货" });
  await dialog.getByLabel("商品关键词").fill("折叠收纳箱");
  await dialog.getByRole("button", { name: "开始公开网页采集" }).click();
  await expect(dialog.getByRole("alert")).toContainText("服务暂时无法完成这项操作，请检查后重试。");
  await expect(dialog.getByRole("alert")).toContainText("p21-search-fail-503");
  await dialog.getByRole("button", { name: "取消" }).click();

  await page.getByRole("button", { name: "确认报价", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "确认完整供应商报价" });
  await dialog.getByLabel("规格").fill("420ml / 黑色 / 单只盒装");
  await dialog.getByLabel("所在地").fill("浙江宁波");
  await dialog.getByRole("button", { name: "确认新版本" }).click();
  await expect(dialog.getByRole("alert")).toContainText("p21-quote-fail-503");
  await dialog.getByRole("button", { name: "取消" }).click();

  await page.getByRole("button", { name: "创建采购任务", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "创建采购任务" });
  await dialog.getByRole("button", { name: "确认创建" }).click();
  await expect(dialog.getByRole("alert")).toContainText("p21-purchase-fail-503");
  await dialog.getByRole("button", { name: "取消" }).click();

  await page.getByRole("button", { name: "删除找货记录", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "删除找货记录" });
  await dialog.getByLabel("删除原因").fill("来源内容需要重新核对");
  await dialog.getByRole("button", { name: "确认删除" }).click();
  await expect(dialog.getByRole("alert")).toContainText("p21-delete-fail-503");
  await expect(dialog.getByLabel("删除原因")).toHaveValue("来源内容需要重新核对");
});

test("pending sourcing writes do not close or overwrite a reopened dialog", async ({ page }) => {
  await setup(page);
  let releaseWrite: (() => void) | undefined;
  let markWriteStarted: (() => void) | undefined;
  let requestCount = 0;
  await page.route("**/api/v1/sourcing/**", async (route) => {
    const method = route.request().method();
    if (!(
      (method === "POST" && !route.request().url().endsWith("/comparisons")) ||
      method === "DELETE"
    ))
      return route.fallback();
    requestCount += 1;
    markWriteStarted?.();
    await new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    return route.fulfill({ json: envelope({ id: `late-sourcing-write-${requestCount}` }) });
  });
  await page.goto("/sourcing");

  async function beginWrite() {
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    markWriteStarted = markStarted;
    releaseWrite = undefined;
    return { started, release: () => releaseWrite?.() };
  }
  async function duplicateSubmit(dialog: Locator) {
    await dialog.locator("form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect.poll(() => requestCount).toBeGreaterThan(0);
  }

  let pending = await beginWrite();
  await page.getByRole("button", { name: "发起供应商找货", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "发起供应商找货" });
  await dialog.getByLabel("商品关键词").fill("旧找货草稿");
  await dialog.getByRole("button", { name: "开始公开网页采集" }).click();
  await pending.started;
  await duplicateSubmit(dialog);
  await dialog.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "发起供应商找货", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "发起供应商找货" });
  await dialog.getByLabel("商品关键词").fill("新找货草稿");
  pending.release();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("商品关键词")).toHaveValue("新找货草稿");
  await dialog.getByRole("button", { name: "取消" }).click();

  pending = await beginWrite();
  await page.getByRole("button", { name: "确认报价", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "确认完整供应商报价" });
  await dialog.getByLabel("规格").fill("旧报价草稿");
  await dialog.getByLabel("所在地").fill("浙江宁波");
  await dialog.getByRole("button", { name: "确认新版本" }).click();
  await pending.started;
  await duplicateSubmit(dialog);
  await dialog.getByRole("button", { name: "关闭报价编辑" }).click();
  await page.getByRole("button", { name: "确认报价", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "确认完整供应商报价" });
  await dialog.getByLabel("规格").fill("新报价草稿");
  await dialog.getByLabel("所在地").fill("广东广州");
  pending.release();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("规格")).toHaveValue("新报价草稿");
  await dialog.getByRole("button", { name: "取消" }).click();

  pending = await beginWrite();
  await page.getByRole("button", { name: "创建采购任务", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "创建采购任务" });
  await dialog.getByLabel("创建原因").fill("旧采购草稿原因");
  await dialog.getByRole("button", { name: "确认创建" }).click();
  await pending.started;
  await duplicateSubmit(dialog);
  await dialog.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "创建采购任务", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "创建采购任务" });
  await dialog.getByLabel("创建原因").fill("新采购草稿原因");
  pending.release();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("创建原因")).toHaveValue("新采购草稿原因");
  await dialog.getByRole("button", { name: "取消" }).click();

  pending = await beginWrite();
  await page.getByRole("button", { name: "删除找货记录", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "删除找货记录" });
  await dialog.getByLabel("删除原因").fill("旧删除原因草稿");
  await dialog.getByRole("button", { name: "确认删除" }).click();
  await pending.started;
  await duplicateSubmit(dialog);
  await dialog.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "删除找货记录", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "删除找货记录" });
  await dialog.getByLabel("删除原因").fill("新删除原因草稿");
  pending.release();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("删除原因")).toHaveValue("新删除原因草稿");
  expect(requestCount).toBe(4);
});

test("a delayed sourcing failure is not attached to a newly opened draft", async ({ page }) => {
  await setup(page);
  let releaseFailure!: () => void;
  let markFailureStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markFailureStarted = resolve;
  });
  const failureGate = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  await page.route("**/api/v1/sourcing/searches", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    markFailureStarted();
    await failureGate;
    return route.fulfill({
      status: 503,
      json: {
        error: { code: "sourcing_unavailable", action_hint: "旧请求暂时不可用。" },
        request_id: "p21-stale-search-failure",
        trace_id: "p21-stale-search-failure-trace",
      },
    });
  });
  await page.goto("/sourcing");
  await page.getByRole("button", { name: "发起供应商找货", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "发起供应商找货" });
  await dialog.getByLabel("商品关键词").fill("旧失败请求");
  await dialog.getByRole("button", { name: "开始公开网页采集" }).click();
  await started;
  await dialog.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "发起供应商找货", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "发起供应商找货" });
  await dialog.getByLabel("商品关键词").fill("新草稿保持");
  releaseFailure();
  await expect(dialog.getByLabel("商品关键词")).toHaveValue("新草稿保持");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("loading and blocked dependency remain explicit and retryable", async ({ page }) => {
  await setup(page);
  await page.unroute("**/api/v1/sourcing/searches");
  await page.route("**/api/v1/sourcing/searches", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: "sourcing_dependency_unavailable",
          message: "sourcing dependency unavailable",
          action_hint: "检查服务状态后重新尝试。",
        },
        request_id: "m04-06-failure-request",
        trace_id: "m04-06-failure-trace",
      },
    });
  });
  await page.goto("/sourcing");
  await expect(page.getByRole("heading", { name: "正在加载" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  await expect(page.getByText("检查服务状态后重新尝试。").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "稍后重试" })).toBeVisible();
});

test("unmatched sourcing search can be reset without showing unrelated detail", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/sourcing");
  await page.getByLabel("搜索找货记录").fill("不存在的找货记录");
  await expect(page.getByRole("heading", { name: "没有匹配的找货记录" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "便携净水杯" })).toHaveCount(0);
  await page.getByRole("button", { name: "清空搜索" }).click();
  await expect(page.getByRole("heading", { name: "便携净水杯" })).toBeVisible();
});

test("read-only sourcing role sees facts without write controls", async ({ page }) => {
  await setup(page, ["task:read", "sourcing:read"]);
  // Let the lazy page module finish loading before starting business assertions.
  await page.goto("/sourcing", { waitUntil: "networkidle" });
  await expect(page.getByText("供应商报价对比历史")).toBeVisible();
  await expect(page.getByRole("button", { name: "发起供应商找货" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "重新采集" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除找货记录" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "确认报价" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "创建采购任务" })).toHaveCount(0);
  await expect(page.getByLabel("加入对比")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "查看采集任务明细" })).toHaveCount(0);
});

test("opening another incomplete quote resets carried risk choices", async ({ page }) => {
  await setup(page);
  const anotherCandidate = {
    ...incompleteCandidate,
    id: "00000000-0000-4000-8000-000000000614",
    supplier_name: "第二家待确认供应商",
    evidence_id: "00000000-0000-4000-8000-000000000615",
  };
  await page.unroute(`**/api/v1/sourcing/searches/${searchId}`);
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: searchId,
        input_type: "keyword",
        input_ref: "便携净水杯",
        status: "completed_with_warnings",
        candidate_count: 2,
        missing_fields: incompleteCandidate.missing_fields,
        created_at: "2026-08-08T12:00:00.000Z",
        updated_at: "2026-08-08T12:05:00.000Z",
        candidates: [incompleteCandidate, anotherCandidate],
      }),
    }),
  );
  await page.goto("/sourcing");
  await page.getByRole("button", { name: "确认报价" }).first().click();
  await page.getByLabel("稳定性").selectOption("stable");
  await page.getByLabel("风险").selectOption("low");
  await page.getByRole("button", { name: "关闭报价编辑" }).click();
  await page.getByRole("button", { name: "确认报价" }).nth(1).click();
  await expect(page.getByLabel("稳定性")).toHaveValue("unknown");
  await expect(page.getByLabel("风险")).toHaveValue("unknown");
});

for (const input of [
  { type: "keyword", label: "商品关键词", value: "  折叠收纳箱  " },
  { type: "image", label: "图片地址或图片证据编号", value: "https://example.test/source.png" },
  { type: "opportunity", label: "机会编号", value: "00000000-0000-4000-8000-000000000612" },
  { type: "product_url", label: "商品链接", value: "https://example.test/item/source" },
]) {
  test(`UI2-SC04 sourcing ${input.type} submits only its explicit input and cancel does not write`, async ({
    page,
  }) => {
    await setup(page);
    const bodies: unknown[] = [];
    await page.route("**/api/v1/sourcing/searches", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: 202,
        json: envelope({
          id: searchId,
          status: "queued",
          collection_task_id: "00000000-0000-4000-8000-000000000620",
        }),
      });
    });
    await page.goto("/sourcing");
    const trigger = page.getByRole("button", { name: "发起供应商找货", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "发起供应商找货" });
    await dialog.getByLabel("输入类型").selectOption(input.type);
    await dialog.getByRole("button", { name: "开始公开网页采集" }).click();
    expect(bodies).toEqual([]);
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(input.label, { exact: true }).fill(input.value);
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/create=1/);
    expect(bodies).toEqual([]);
    await trigger.click();
    await expect(dialog.getByLabel(input.label, { exact: true })).toHaveValue(input.value);
    await dialog.getByRole("button", { name: "开始公开网页采集" }).click();
    await expect(dialog).toHaveCount(0);
    expect(bodies).toEqual([{ input_type: input.type, input_ref: input.value }]);
    await expect(
      page.getByText("公开供应商网页采集已排队，候选与原始证据会自动回填。"),
    ).toBeVisible();
  });
}

test("UI2-SC05 purchase enforces displayed MOQ and binds the current quote with a trimmed reason", async ({
  page,
}) => {
  await setup(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/sourcing/purchase-tasks", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    bodies.push(body);
    await route.fulfill({
      status: 202,
      json: envelope({
        id: "00000000-0000-4000-8000-000000000621",
        status: "queued",
        quote_id: body.quote_id,
        quantity: body.quantity,
      }),
    });
  });
  await page.goto("/sourcing");
  const trigger = page.getByRole("button", { name: "创建采购任务", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "创建采购任务" });
  await expect(dialog).toContainText("v2");
  await expect(dialog.getByLabel("采购数量")).toHaveValue("100");
  await dialog.getByLabel("采购数量").fill("99");
  await expect(dialog.getByRole("button", { name: "确认创建", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  expect(bodies).toEqual([]);
  await trigger.click();
  await expect(dialog.getByLabel("采购数量")).toHaveValue("100");
  await dialog.getByLabel("创建原因").fill("  核对报价后采购  ");
  await dialog.getByRole("button", { name: "确认创建", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(bodies).toEqual([
    { quote_id: readyCandidate.quote.id, quantity: 100, reason: "核对报价后采购" },
  ]);
  await expect(page.getByText("采购任务已进入任务中心待消费队列。")).toBeVisible();
});

test("UI2-SC06 comparison accepts two through five current quote IDs and leaves a sixth unselected", async ({
  page,
}) => {
  await setup(page);
  const candidates = Array.from({ length: 6 }, (_, i) => ({
    ...readyCandidate,
    id: `00000000-0000-4000-8000-${String(630 + i).padStart(12, "0")}`,
    supplier_name: `隔离报价供应商 ${i + 1}`,
    quote: {
      ...readyCandidate.quote,
      id: `00000000-0000-4000-8000-${String(640 + i).padStart(12, "0")}`,
      evidence_id: readyCandidate.evidence_id,
    },
  }));
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: searchId,
        input_type: "keyword",
        input_ref: "便携净水杯",
        status: "completed",
        candidate_count: 6,
        missing_fields: [],
        candidates,
      }),
    }),
  );
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/sourcing/comparisons", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    bodies.push(body);
    await route.fulfill({
      status: 201,
      json: envelope({
        id: "00000000-0000-4000-8000-000000000650",
        name: body.name,
        quote_count: 5,
      }),
    });
  });
  await page.goto("/sourcing");
  const boxes = page.getByLabel("加入对比");
  await boxes.nth(0).check();
  await expect(page.getByRole("button", { name: "保存报价对比" })).toBeDisabled();
  await boxes.nth(1).check();
  await expect(page.getByRole("button", { name: "保存报价对比" })).toBeEnabled();
  for (let i = 2; i < 5; i++) await boxes.nth(i).check();
  // A controlled checkbox may reject the sixth click; use a pointer click rather than check().
  await boxes.nth(5).click();
  await expect(page.getByText("一次最多比较五家供应商。")).toBeVisible();
  await expect(page.getByText("已选 5 / 5 家供应商")).toBeVisible();
  await expect(boxes.nth(5)).not.toBeChecked();
  await page.getByRole("button", { name: "保存报价对比" }).click();
  await expect(page.getByText("已保存 5 家报价对比。")).toBeVisible();
  expect(bodies).toEqual([
    { name: "便携净水杯 报价对比", quote_ids: candidates.slice(0, 5).map((item) => item.quote.id) },
  ]);
  await expect(page.locator(".sourcing-compare-tray")).toHaveCount(0);
});

test("SC-G02 comparison history failure preserves the sourcing list and retries only its GET", async ({
  page,
}) => {
  await setup(page);
  let attempts = 0;
  const writes: string[] = [];
  await page.route("**/api/v1/sourcing/comparisons", async (route) => {
    if (route.request().method() !== "GET") {
      writes.push(route.request().method());
      return route.fallback();
    }
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        json: {
          error: {
            code: "comparison_history_unavailable",
            message: "对比历史读取失败。",
            action_hint: "读取暂时不可用，请稍后重试。",
          },
          request_id: "comparison-history-failed-01",
          trace_id: "comparison-history-trace-01",
        },
      });
      return;
    }
    await route.fulfill({
      json: envelope([
        {
          id: "00000000-0000-4000-8000-000000000651",
          name: "恢复后的报价对比",
          quotes: [],
          created_at: "2026-08-08T13:00:00.000Z",
        },
      ]),
    });
  });

  await page.goto("/sourcing");
  await expect(page.locator(".sourcing-comparison-error")).toContainText("对比历史暂未读取");
  await expect(page.getByText("宁波澄净户外用品厂")).toBeVisible();
  await expect(page.locator(".sourcing-layout")).toBeVisible();
  await expect(page.getByText("选择两家以上已确认报价后，可保存对比记录。")).toHaveCount(0);
  await expect(page.locator(".sourcing-comparison-error")).toContainText(
    "comparison-history-failed-01",
  );

  await page.getByRole("button", { name: "重新读取对比历史" }).click();
  await expect(page.getByText("恢复后的报价对比")).toBeVisible();
  await expect(page.getByText("宁波澄净户外用品厂")).toBeVisible();
  expect(attempts).toBe(2);
  expect(writes).toEqual([]);
});

test("P21 stale detail responses cannot replace the record selected while they are pending", async ({
  page,
}) => {
  await setup(page);
  const firstId = searchId,
    secondId = "00000000-0000-4000-8000-000000000652",
    first = {
      id: firstId,
      display_name: "第一条找货记录",
      input_type: "keyword",
      input_ref: "第一条找货记录",
      status: "completed",
      candidate_count: 0,
      missing_fields: [],
      created_at: "2026-08-08T12:00:00.000Z",
    },
    second = {
      ...first,
      id: secondId,
      display_name: "第二条找货记录",
      input_ref: "第二条找货记录",
    };
  let releaseFirst!: () => void, markFirstStarted!: () => void;
  const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve)),
    firstStarted = new Promise<void>((resolve) => (markFirstStarted = resolve));
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({ json: envelope([first, second]) }),
  );
  await page.route("**/api/v1/sourcing/searches/*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").at(-1);
    if (id === firstId) {
      markFirstStarted();
      await firstGate;
      await route.fulfill({ json: envelope({ ...first, candidates: [] }) });
      return;
    }
    await route.fulfill({ json: envelope({ ...second, candidates: [] }) });
  });

  await page.goto("/sourcing");
  await firstStarted;
  await page.getByRole("button", { name: /第二条找货记录/ }).click();
  await expect(page.locator(".sourcing-detail h3")).toHaveText("第二条找货记录");
  releaseFirst();
  await expect(page.locator(".sourcing-detail h3")).toHaveText("第二条找货记录");
  await expect(page).toHaveURL(new RegExp(`record=${secondId}`));
  await page.evaluate((id) => {
    window.history.pushState(null, "", `/sourcing?record=${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, firstId);
  await expect(page.locator(".sourcing-detail h3")).toHaveText("第一条找货记录");
});

test("P21 KeepAlive return reloads list, detail and comparisons and ignores pre-deactivation reads", async ({
  page,
}) => {
  await setup(page);
  let listReads = 0,
    comparisonReads = 0,
    releaseFirstComparison!: () => void,
    markFirstComparisonStarted!: () => void;
  const firstComparisonGate = new Promise<void>((resolve) => (releaseFirstComparison = resolve)),
    firstComparisonStarted = new Promise<void>((resolve) => (markFirstComparisonStarted = resolve));
  const record = {
    id: searchId,
    input_type: "keyword",
    input_ref: "离开前找货快照",
    status: "completed",
    candidate_count: 0,
    missing_fields: [],
    created_at: "2026-08-08T12:00:00.000Z",
  };
  await page.route("**/api/v1/sourcing/searches", (route) => {
    listReads += 1;
    const current = {
      ...record,
      input_ref: listReads === 1 ? "离开前找货快照" : "返回后的找货快照",
    };
    return route.fulfill({ json: envelope([current]) });
  });
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) => {
    const current = {
      ...record,
      input_ref: listReads === 1 ? "离开前找货快照" : "返回后的找货快照",
    };
    return route.fulfill({ json: envelope({ ...current, candidates: [] }) });
  });
  await page.route("**/api/v1/sourcing/comparisons", async (route) => {
    comparisonReads += 1;
    if (comparisonReads === 1) {
      markFirstComparisonStarted();
      await firstComparisonGate;
      await route.fulfill({
        json: envelope([{ id: "old", name: "离页前的对比快照", quotes: [] }]),
      });
      return;
    }
    await route.fulfill({
      json: envelope([{ id: "fresh", name: "返回后重新读取的对比", quotes: [] }]),
    });
  });

  await page.goto("/sourcing");
  await firstComparisonStarted;
  await expect(page.locator(".sourcing-detail h3")).toHaveText("离开前找货快照");
  await navigateMemberMenu(page, "选品工作台");
  await expect(page).toHaveURL(/\/home/);
  releaseFirstComparison();

  await navigateMemberMenu(page, "1688 找货");
  await expect(page.locator(".sourcing-detail h3")).toHaveText("返回后的找货快照");
  await expect(page.getByText("返回后重新读取的对比")).toBeVisible();
  expect(listReads).toBe(2);
  expect(comparisonReads).toBe(2);
  await expect(page.getByText("离页前的对比快照")).toHaveCount(0);
});

test("sourcing workspace uses compact catalogue layout and read-only refresh", async ({ page }) => {
  await setup(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/v1/sourcing/"))
      writes.push(request.url());
  });
  await page.goto("/sourcing");
  const root = page.locator(".sourcing-workspace");
  await expect(root.getByRole("heading", { name: "供应链找货", level: 1 })).toBeVisible();
  await expect(root.locator(".sourcing-summary dt")).toHaveCount(4);
  await expect(root.locator(".sourcing-journey,.sourcing-tabs,.member-module-guide")).toHaveCount(
    0,
  );
  const records = root.getByRole("complementary", { name: "找货记录" });
  await expect(records.getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(root.locator(".supplier-cards").getByText("CNY 12.8")).toBeVisible();
  await root.getByRole("button", { name: "刷新记录", exact: true }).click();
  await expect(root.locator(".supplier-cards").getByText("CNY 12.8")).toBeVisible();
  expect(writes).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(page).toHaveScreenshot("sourcing-workspace-layout-commerce-20261018.png", {
    fullPage: false,
  });
});
