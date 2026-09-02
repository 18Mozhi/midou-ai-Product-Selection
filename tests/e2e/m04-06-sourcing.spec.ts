import { test, expect, type Page } from "@playwright/test";

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

test("M04-06.A07/A08/A09/A15 renders source-backed suppliers, missing fields and responsive actions", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/sourcing?create=1");
  await expect(page.getByRole("heading", { name: "供应链找货", level: 2 })).toBeVisible();
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
    page.getByText("当前候选仍缺：规格、交期、所在地、可信度、稳定性、风险。"),
  ).toBeVisible();
  await expect(page.getByLabel("找货流程").getByText("3 对比供应商")).toHaveAttribute(
    "aria-current",
    "step",
  );
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

test("opportunity sourcing detail exposes designated dual-person cost review", async ({ page }) => {
  await setup(page);
  const opportunityId = "00000000-0000-4000-8000-000000000612";
  const opportunitySearch = {
    id: searchId,
    input_type: "opportunity",
    input_ref: opportunityId,
    status: "completed",
    candidate_count: 1,
    missing_fields: [],
    created_at: "2026-08-08T12:00:00.000Z",
  };
  await page.unroute(`**/api/v1/sourcing/searches/${searchId}`);
  await page.unroute("**/api/v1/sourcing/searches");
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({ json: envelope({ ...opportunitySearch, candidates: [readyCandidate] }) }),
  );
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({ json: envelope([opportunitySearch]) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({ json: envelope({ id: opportunityId, version: 8 }) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({
      json: envelope({ latest_run: null, current_inputs: [], cost_input_reviews: [] }),
    }),
  );
  await page.route("**/api/v1/cost-input-reviewers", (route) =>
    route.fulfill({
      json: envelope([{ id: "00000000-0000-4000-8000-000000000613", label: "供应链成本复核人" }]),
    }),
  );
  await page.goto("/sourcing");
  await expect(page.getByRole("heading", { name: "双人成本复核" })).toBeVisible();
  await expect(page.getByText("提交后 24 小时内由指定复核人处理")).toBeVisible();
  await expect(page.getByLabel("指定复核人")).toContainText("供应链成本复核人");
  await expect(page.getByRole("link", { name: "打开机会详情" })).toHaveAttribute(
    "href",
    new RegExp(`/opportunities/${opportunityId}`),
  );
});

test("供应链详情完整跟随深色与浅色主题", async ({ page }) => {
  await setup(page);
  await page.goto("/sourcing");
  const surface = page.locator(".sourcing-detail");
  await expect(surface).toBeVisible();
  const deepBackground = await surface.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(deepBackground).not.toBe("rgb(255, 255, 255)");
  await page.getByRole("button", { name: "切换界面主题" }).click();
  await page.getByRole("button", { name: /云雾白/ }).click();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("cloud-white");
  const lightBackground = await surface.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(lightBackground).not.toBe(deepBackground);
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
  await expect(page.getByRole("heading", { name: "正在读取真实数据" })).toBeVisible();
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
  await page.goto("/sourcing");
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
