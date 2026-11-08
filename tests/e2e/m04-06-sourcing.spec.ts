import { test, expect, chromium, type Locator, type Page } from "@playwright/test";

// SKU fixture values come from the user-provided item-detail sample; this tests rendering, not live procurement.

const searchesRoute = /\/api\/v1\/sourcing\/searches(?:\?.*)?$/;
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
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope([summary]) }));
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
    name: "retry waiting after a failed source",
    status: "retry_scheduled",
    active: 1,
    blocked: 0,
    failed: 1,
    text: "采集任务正在等待重试",
  },
  {
    name: "retry waiting with all previous attempts counted",
    status: "retry_scheduled",
    active: 0,
    blocked: 0,
    failed: 1,
    text: "采集任务正在等待重试",
  },
  {
    name: "queued with a previously failed source",
    status: "queued",
    active: 1,
    blocked: 0,
    failed: 1,
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
    name: "failed without collection permission",
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
    text: "当前记录尚无供应商候选",
  },
  {
    name: "unknown",
    status: "unknown",
    active: 0,
    blocked: 0,
    failed: 0,
    text: "当前记录尚无供应商候选",
  },
]) {
  test(`empty sourcing status remains factual for ${scenario.name}`, async ({ page }, testInfo) => {
    const taskId = "00000000-0000-4000-8000-000000000612";
    if (scenario.name === "failed" && testInfo.project.name === "desktop-chromium")
      await page.setViewportSize({ width: 1672, height: 941 });
    await setup(
      page,
      ["failed", "blocked"].includes(scenario.name)
        ? ["sourcing:read", "platform:operate"]
        : undefined,
    );
    const search = {
      id: searchId,
      input_type: "keyword",
      input_ref: "便携净水杯",
      status: "succeeded_empty",
      candidate_count: 0,
      missing_fields: ["supplier_listing"],
      created_at: "2026-08-08T12:00:00.000Z",
    };
    await page.route(searchesRoute, (route) => route.fulfill({ json: envelope([search]) }));
    await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
      route.fulfill({
        json: envelope({
          ...search,
          candidates: [],
          collection_task_id: taskId,
          collection_progress:
            scenario.name === "unknown"
              ? null
              : {
                  status: scenario.status,
                  total_subqueries: Math.max(
                    1,
                    scenario.active + scenario.failed + scenario.blocked,
                  ),
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
    const notice = page.locator(".sourcing-pending");
    if (scenario.active) await expect(notice).not.toContainText("本次采集已结束");
    const progress = page.getByRole("region", { name: "来源采集进度" });
    const allSourcesEnded = ["failed", "failed without collection permission", "empty"].includes(
      scenario.name,
    );
    const badge = progress.locator("h4");
    if (allSourcesEnded) {
      await expect(badge.getByText("来源已结束", { exact: true })).toBeVisible();
      await expect(badge).toHaveAttribute("title", scenario.failed ? "采集失败" : "已完成");
      const failure = progress.locator("dl > div").nth(2);
      await expect(failure.locator("dt")).toHaveText("失败");
      await expect(failure.locator("dd")).toHaveText(String(scenario.failed));
    } else {
      await expect(badge.getByText("来源已结束", { exact: true })).toHaveCount(0);
    }
    if (scenario.name === "empty") {
      await expect(badge).toHaveAttribute("data-status", "completed");
      const successTone = await badge.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.backgroundColor =
          "var(--midou-status-positive-surface, var(--so-success-soft))";
        element.append(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      });
      expect(successTone).not.toBe("rgba(0, 0, 0, 0)");
      await expect(badge).toHaveCSS("background-color", successTone);
    }
    await expect(notice.getByRole("heading")).toHaveText(
      scenario.failed || scenario.blocked ? "未获得供应商报价" : "供应商报价",
    );
    await expect(page.locator(".sourcing-empty-offers .sourcing-quote-empty")).toContainText(
      scenario.failed || scenario.blocked
        ? "本次采集未获得供应商报价，请核对来源采集状态。"
        : "报价返回后将在这里展示。",
    );
    if (scenario.name === "failed") {
      const action = notice.getByRole("link", { name: "查看失败原因", exact: true });
      await expect(action).toHaveAttribute("href", `/platform-admin/collection?task=${taskId}`);
      await expect(action).toHaveCSS("min-height", "42px");
      await expect(action).toHaveCSS("border-top-style", "solid");
      await expect(action).toHaveCSS("text-decoration-line", "none");
      await expect(notice.locator(".sourcing-notice-icon-surface")).not.toHaveCSS("fill", "none");
      const originalViewport = page.viewportSize()!;
      if (originalViewport.width >= 1440)
        await page.setViewportSize({ ...originalViewport, width: 1280 });
      const rail = await notice.evaluate((node) => {
        const lead = (el: Element) => {
          const text = [...el.childNodes].find(
            (child) => child.nodeType === 3 && child.textContent?.trim(),
          )!;
          const index = text.textContent!.search(/\S/);
          const range = document.createRange();
          range.setStart(text, index);
          range.setEnd(text, index + 1);
          return range.getBoundingClientRect().left;
        };
        return {
          headline: lead(node.querySelector("h4")!),
          explanation: lead(node.querySelector("p")!),
          missing: lead(node.querySelector(".sourcing-missing")!),
          icon: node.querySelector("h4 svg")!.getBoundingClientRect().width,
        };
      });
      console.log("SOURCING_WARNING_RAIL", page.viewportSize()!.width, JSON.stringify(rail));
      expect(Math.abs(rail.headline - rail.explanation)).toBeLessThanOrEqual(2);
      expect(Math.abs(rail.headline - rail.missing)).toBeLessThanOrEqual(2);
      if (originalViewport.width >= 1440) await page.setViewportSize(originalViewport);
      const [messageBox, actionBox] = await Promise.all([
        notice.locator(":scope > div").boundingBox(),
        action.boundingBox(),
      ]);
      if (testInfo.project.name === "desktop-chromium") {
        expect(actionBox!.x).toBeGreaterThan(messageBox!.x + messageBox!.width);
        expect(
          Math.abs(actionBox!.y + actionBox!.height / 2 - messageBox!.y - messageBox!.height / 2),
        ).toBeLessThan(2);
      } else {
        expect(actionBox!.y).toBeGreaterThan(messageBox!.y + messageBox!.height);
        const noticeBox = (await notice.boundingBox())!;
        const endInset = await notice.evaluate((node) => {
          const style = getComputedStyle(node);
          return parseFloat(style.paddingInlineEnd) + parseFloat(style.borderInlineEndWidth);
        });
        expect(actionBox!.x + actionBox!.width).toBeCloseTo(
          noticeBox.x + noticeBox.width - endInset,
          0,
        );
      }
      if (testInfo.project.name === "desktop-chromium")
        await notice.screenshot({ path: testInfo.outputPath("sourcing-authorized-failure.png") });
    } else if (scenario.name === "blocked") {
      await expect(
        notice.getByRole("link", { name: "查看采集任务明细", exact: true }),
      ).toHaveAttribute("href", `/platform-admin/collection?task=${taskId}`);
      await expect(notice.getByRole("link", { name: "查看失败原因", exact: true })).toHaveCount(0);
    } else {
      await expect(notice.getByRole("link", { name: /查看失败原因|查看采集任务明细/ })).toHaveCount(
        0,
      );
    }
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
        ["执行 / 等待", scenario.active],
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
  const cards = page.locator(".supplier-offer-list");
  const raw = cards.locator("tbody > tr").filter({ hasText: incompleteCandidate.supplier_name });
  await expect(raw.getByText("采集价格说明", { exact: true })).toBeVisible();
  await expect(raw.getByText("新人价", { exact: true })).toBeVisible();
  const confirmed = cards.locator("tbody > tr").filter({ hasText: readyCandidate.supplier_name });
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
  await expect(page.getByRole("dialog", { name: "发起供应商找货" })).toHaveCount(0);
  const supplierCandidates = page.locator(".supplier-offer-list");
  await expect(supplierCandidates.getByText("宁波澄净户外用品厂")).toBeVisible();
  await expect(
    page.getByText("待补齐：规格、交期、所在地、可信度、稳定性、风险", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("找货流程")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "刷新记录", exact: true })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "找货记录" }).getByRole("button", { pressed: true }),
  ).toHaveCount(1);
  await supplierCandidates.locator("summary").first().click();
  await expect(page.getByText(/证据 00000000-0000-4000-8000-000000000603/)).toBeVisible();
  await expect(supplierCandidates.getByText("CNY 12.8")).toBeVisible();
  await expect(supplierCandidates.getByText("待费用规则计算").first()).toBeVisible();
  await expect(supplierCandidates.getByText("采集于 2026/08/08 20:00")).toBeVisible();
  await expect(page.getByRole("link", { name: "费用与利润规则" }).last()).toHaveAttribute(
    "href",
    new RegExp(`from=/sourcing\\?record=${searchId}`),
  );
  await page.getByRole("tab", { name: "报价历史" }).click();
  const comparison = page.getByLabel("规格、最小起订量与交期对比");
  const specificationHint = page.getByLabel("规格归一化提示");
  await expect(specificationHint).toContainText("存在 2 种规格文本，尚未归一");
  await expect(specificationHint).toContainText("系统不会自动换算或判断等价");
  await expect(comparison.getByText("500ml / 蓝色 / 单只彩盒")).toBeVisible();
  await expect(comparison.getByText("600ml / 绿色 / 双滤芯")).toBeVisible();
  await expect(comparison.getByText("300", { exact: true })).toBeVisible();
  await expect(comparison.getByText("12 天", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "供应商报价" }).click();
  await page.getByRole("button", { name: "确认报价" }).click();
  await expect(page.getByRole("heading", { name: "确认完整供应商报价" })).toBeVisible();
  await page.getByRole("button", { name: "关闭报价编辑" }).click();
  await supplierCandidates.getByLabel("加入对比").check();
  await expect(page.getByText("已选 1 / 5 家供应商")).toBeVisible();
  const tray = page.locator(".sourcing-compare-tray");
  await expect(tray).toHaveCSS("backdrop-filter", "none");
  await expect(tray).toHaveCSS("box-shadow", "none");
  await expect(tray).toHaveCSS("background-image", "none");
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
  capabilities?: string[],
) {
  await setup(page, capabilities);
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
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope([search]) }));
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

test("empty opportunity offers show the same profit summary without refetching on tab changes", async ({
  page,
}) => {
  const { search } = await opportunitySetup(page, calculatedProfit(80), "calculated");
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({ json: envelope({ ...search, candidate_count: 0, candidates: [] }) }),
  );
  let profitReads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/profit-analysis")) profitReads++;
  });
  await page.goto("/sourcing");
  const offers = page.getByRole("tabpanel", { name: "供应商报价" });
  const summary = offers.getByRole("region", { name: "成本与利润摘要" });
  await expect(offers.getByText("暂无供应商报价")).toBeVisible();
  const emptyIllustration = offers.locator(".sourcing-quote-empty > svg");
  await expect(emptyIllustration).toHaveAttribute("width", "72");
  await expect(emptyIllustration).toHaveAttribute("height", "44");
  await expect(summary).toContainText("80 USD");
  const basis = page.locator(".sourcing-profit-basis");
  const fullRow = offers.locator(".sourcing-empty-offers-basis");
  await expect(fullRow.locator("details")).toHaveCount(1);
  await expect(fullRow.locator("summary svg")).toHaveAttribute("aria-hidden", "true");
  await expect(basis).toHaveCount(1);
  if (page.viewportSize()!.width >= 1101) {
    const [row, panel, profitBox] = await Promise.all(
      [fullRow, offers.locator(".sourcing-empty-offers"), summary].map((node) =>
        node.boundingBox(),
      ),
    );
    expect(row!.width).toBeCloseTo(panel!.width, 0);
    expect(row!.y).toBeGreaterThanOrEqual(profitBox!.y + profitBox!.height);
  }
  await basis.getByText("计算依据", { exact: true }).click();
  await expect(basis).toHaveAttribute("open", "");
  await expect(fullRow.locator("summary svg")).toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)");
  await page.getByRole("tab", { name: "成本与利润" }).click();
  await expect(page.getByRole("tabpanel", { name: "成本与利润" })).toContainText("80 USD");
  await expect(
    page.getByRole("tabpanel", { name: "成本与利润" }).locator("details"),
  ).toHaveAttribute("open", "");
  await page.getByRole("tab", { name: "供应商报价" }).click();
  await expect(summary).toContainText("80 USD");
  expect(profitReads).toBe(1);
});

test("empty sourcing panels follow the usable detail width without squeezing the profit summary", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "verifies the desktop detail container");
  const { search } = await opportunitySetup(
    page,
    { latest_run: null, current_inputs: [], cost_input_reviews: [] },
    "insufficient_data",
  );
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({ json: envelope({ ...search, candidate_count: 0, candidates: [] }) }),
  );
  await page.setViewportSize({ width: 1101, height: 900 });
  await page.goto("/sourcing");
  const offers = page.getByRole("tabpanel", { name: "供应商报价" });
  const empty = offers.locator(".sourcing-quote-empty");
  const profit = offers.getByRole("region", { name: "成本与利润摘要" });
  const basis = offers.locator(".sourcing-empty-offers-basis");
  await expect(empty).toBeVisible();
  await expect(profit.locator(".sourcing-profit-unconfirmed-breakdown dd")).toHaveText([
    "—",
    "—",
    "—",
    "—",
  ]);
  const measure = async () => {
    const [message, cost, disclosure] = await Promise.all(
      [empty, profit, basis].map((locator) => locator.boundingBox()),
    );
    return { message: message!, cost: cost!, disclosure: disclosure! };
  };
  const narrow = await measure();
  console.log(
    "sourcing panel widths at 1101px",
    narrow.message.width,
    narrow.cost.width,
    narrow.disclosure.width,
  );
  expect(narrow.cost.y).toBeGreaterThanOrEqual(narrow.message.y + narrow.message.height + 10);
  expect(narrow.cost.x).toBeCloseTo(narrow.message.x, 0);
  expect(narrow.cost.width).toBeCloseTo(narrow.disclosure.width, 0);
  expect(narrow.message.width).toBeCloseTo(narrow.disclosure.width, 0);
  expect(narrow.disclosure.y).toBeGreaterThanOrEqual(narrow.cost.y + narrow.cost.height + 10);
  await basis.locator("summary").click();
  await expect(basis.locator("details")).toHaveAttribute("open", "");
  await page.setViewportSize({ width: 1672, height: 941 });
  const wide = await measure();
  expect(wide.cost.y).toBeCloseTo(wide.message.y, 0);
  expect(wide.cost.x - (wide.message.x + wide.message.width)).toBeCloseTo(12, 0);
  expect(wide.cost.x + wide.cost.width).toBeCloseTo(wide.disclosure.x + wide.disclosure.width, 0);
  await expect(basis.locator("details")).toHaveAttribute("open", "");
});

test("empty sourcing offers keep unconfirmed cost rows distinct from real profit", async ({
  page,
}) => {
  if (page.viewportSize()!.width >= 1101) await page.setViewportSize({ width: 1672, height: 941 });
  const { search } = await opportunitySetup(
    page,
    { latest_run: null, current_inputs: [], cost_input_reviews: [] },
    "insufficient_data",
  );
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({ json: envelope({ ...search, candidate_count: 0, candidates: [] }) }),
  );
  await page.goto("/sourcing");
  const offers = page.getByRole("tabpanel", { name: "供应商报价" });
  const breakdown = offers.locator(".sourcing-profit-unconfirmed-breakdown");
  await expect(breakdown.locator("dt")).toHaveText([
    "采购成本",
    "头程费用",
    "平台费用",
    "预计利润",
  ]);
  await expect(breakdown.locator("dd")).toHaveText(["—", "—", "—", "—"]);
  if (page.viewportSize()!.width >= 1440) {
    const heading = offers.locator(".sourcing-profit-summary > header > div");
    await expect(heading).toHaveCSS("display", "flex");
    await expect(heading).toHaveCSS("align-items", "baseline");
    await expect(offers.locator(".sourcing-quote-empty")).toHaveCSS("min-height", "169px");
  }
  const basis = offers.locator(".sourcing-profit-basis");
  await expect(basis).not.toHaveAttribute("open", "");
  await basis.locator("summary").click();
  await expect(basis).toContainText("暂无已保存的成本输入或利润计算记录。");
  await expect(basis.locator("p")).toBeVisible();
  await page.getByRole("tab", { name: "成本与利润" }).click();
  const profit = page.getByRole("tabpanel", { name: "成本与利润" });
  await expect(profit).toContainText("利润未知");
  await expect(profit.locator(".sourcing-profit-unconfirmed-breakdown")).toHaveCount(0);
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
  await page.getByRole("tab", { name: "成本与利润" }).click();
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
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope([search, second]) }));
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
  await page.getByRole("tab", { name: "成本与利润" }).click();
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
  await page.getByRole("tab", { name: "成本与利润" }).click();
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
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope(records) }));
  await page.route("**/api/v1/sourcing/searches/*", (route) => {
    const id = route.request().url().split("/").pop();
    return route.fulfill({ json: envelope({ ...records.find((r) => r.id === id), candidates }) });
  });
  await page.goto("/sourcing");
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(20);
  const rowsContainContent = await page
    .locator(".sourcing-record-items > button")
    .evaluateAll((rows) =>
      rows.every((row) => {
        const box = row.getBoundingClientRect();
        return Array.from(row.children).every(
          (child) => child.getBoundingClientRect().bottom <= box.bottom + 1,
        );
      }),
    );
  expect(rowsContainContent).toBe(true);
  await expect(page.locator(".supplier-offer-table tbody > tr")).toHaveCount(10);
  const panels = await page.locator(".sourcing-layout").evaluate((layout) => {
    const list = layout.querySelector("aside")!;
    const detail = layout.querySelector<HTMLElement>(".sourcing-detail")!;
    return {
      wide: matchMedia("(min-width: 1101px)").matches,
      listHeight: list.getBoundingClientRect().height,
      detailMinHeight: Number.parseFloat(getComputedStyle(detail).minHeight),
    };
  });
  if (panels.wide) expect(panels.detailMinHeight).toBeCloseTo(panels.listHeight, 0);
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
  await expect(page.locator(".supplier-offer-table tbody > tr")).toHaveCount(1);
  await expect(page.locator(".supplier-offer-list")).toContainText("供应商21");
  await page.getByRole("searchbox", { name: "搜索找货记录" }).fill("长标题商品记录628用于");
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(1);
  if (panels.wide) {
    await expect(page.locator(".sourcing-detail")).not.toHaveCSS(
      "min-height",
      `${panels.listHeight}px`,
    );
  }
  await expect(
    page
      .getByRole("region", { name: "找货记录详情" })
      .getByRole("heading", { name: /长标题商品记录628/ }),
  ).toBeVisible();
  await expect(page.locator(".supplier-offer-table tbody > tr")).toHaveCount(10);
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
  await page.getByRole("tab", { name: "成本与利润" }).click();
  const summary = page.getByRole("region", { name: "成本与利润摘要" });
  await expect(summary).toContainText("90 USD");
  await expect(summary).not.toContainText("999");
});

test("commerce sourcing keeps white surfaces with a persisted accent preference", async ({
  page,
}) => {
  await setup(page);
  const initialPreferenceRead = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/me/ui-preferences") && response.request().method() === "GET",
  );
  await page.goto("/sourcing");
  await initialPreferenceRead;
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("deep-ocean");
  const surface = page.locator(".sourcing-detail");
  await expect(surface).toBeVisible();
  await expect(surface).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const primary = () =>
    page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).getPropertyValue("--so-primary").trim());
  const previousAccent = await primary();
  await expect(page.getByRole("button", { name: "切换界面主题" })).toHaveCount(0);
  await page.addInitScript(() => localStorage.setItem("scoutops:ui-theme", "cloud-white"));
  // The account preference is authoritative; keep the persisted server fixture
  // consistent with the cached preference instead of racing deep-ocean against it.
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({ json: envelope({ theme: "cloud-white", version: 2 }) }),
  );
  const cachedPreferenceRead = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/me/ui-preferences") && response.request().method() === "GET",
  );
  await page.reload();
  await cachedPreferenceRead;
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("cloud-white");
  await expect.poll(primary).not.toBe(previousAccent);
  await expect(surface).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(surface).toHaveCSS("background-image", "none");
});

test("empty automatic sourcing state refreshes facts without creating work", async ({ page }) => {
  await setup(page);
  let reads = 0;
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && r.url().includes("/api/v1/sourcing/")) writes.push(r.url());
  });
  await page.unroute(searchesRoute);
  await page.route(searchesRoute, (route) => {
    reads += 1;
    return route.fulfill({ json: envelope([]) });
  });
  await page.goto("/sourcing?create=1");
  await expect(page.getByRole("button", { name: "刷新记录", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "刷新记录", exact: true }).last().click();
  await expect.poll(() => reads).toBe(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("quote dialog contains keyboard focus and returns it to its opener", async ({ page }) => {
  await setup(page);
  await page.goto("/sourcing");
  await verifyDialogFocusCycle(
    page,
    page.getByRole("button", { name: "确认报价", exact: true }),
    "确认完整供应商报价",
    "关闭报价编辑",
    "确认新版本",
  );
});

test("legacy sourcing create links preserve readable results without opening or writing", async ({
  page,
}) => {
  await setup(page);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && r.url().includes("/api/v1/sourcing/")) writes.push(r.url());
  });
  await page.goto("/sourcing?create=1&opportunity_id=00000000-0000-4000-8000-000000000612");
  await expect(page.locator(".supplier-offer-list").getByText("CNY 12.8")).toBeVisible();
  for (const name of ["发起供应商找货", "重新采集", "删除找货记录"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("quote write failure retains draft and request ID inside the surviving dialog", async ({
  page,
}) => {
  await setup(page);
  await rejectSourcingRequest(page, "/api/v1/sourcing/quotes", "POST", "p21-quote-fail-503");
  await page.goto("/sourcing");
  await page.getByRole("button", { name: "确认报价", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "确认完整供应商报价" });
  const context = dialog.getByRole("region", { name: "当前确认报价对象" });
  await expect(context.getByRole("heading")).toHaveText(incompleteCandidate.product_title);
  await expect(context).toContainText(incompleteCandidate.supplier_name);
  await expect(context).toContainText("CNY 10.6");
  await expect(context.locator("input, select, button")).toHaveCount(0);
  const box = await context.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await dialog.getByLabel("规格").fill("420ml / 黑色 / 单只盒装");
  await dialog.getByLabel("所在地").fill("浙江宁波");
  await dialog.getByRole("button", { name: "确认新版本" }).click();
  await expect(dialog.getByRole("alert")).toContainText("p21-quote-fail-503");
  await expect(context).toContainText(incompleteCandidate.supplier_name);
  await expect(dialog.getByLabel("规格")).toHaveValue("420ml / 黑色 / 单只盒装");
  await dialog.getByRole("button", { name: "取消" }).click();
});

test("pending quote writes do not close or overwrite a reopened dialog", async ({ page }) => {
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

  const pending = await beginWrite();
  await page.getByRole("button", { name: "确认报价", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "确认完整供应商报价" });
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

  expect(requestCount).toBe(1);
});

test("a delayed quote failure is not attached to a newly opened draft", async ({ page }) => {
  await setup(page);
  let releaseFailure!: () => void;
  let markFailureStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markFailureStarted = resolve;
  });
  const failureGate = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  await page.route("**/api/v1/sourcing/quotes", async (route) => {
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
  await page.getByRole("button", { name: "确认报价", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "确认完整供应商报价" });
  await dialog.getByLabel("规格").fill("旧失败请求");
  await dialog.getByLabel("所在地").fill("浙江宁波");
  await dialog.getByRole("button", { name: "确认新版本" }).click();
  await started;
  await dialog.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "确认报价", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "确认完整供应商报价" });
  await dialog.getByLabel("规格").fill("新草稿保持");
  releaseFailure();
  await expect(dialog.getByLabel("规格")).toHaveValue("新草稿保持");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("loading and blocked dependency remain explicit and retryable", async ({ page }) => {
  await setup(page);
  await page.unroute(searchesRoute);
  await page.route(searchesRoute, async (route) => {
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
  await page.getByRole("tab", { name: "报价历史" }).click();
  await expect(page.getByText("供应商报价对比历史")).toBeVisible();
  await expect(page.getByRole("button", { name: "发起供应商找货" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "重新采集" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除找货记录" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "确认报价" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "创建采购任务" })).toHaveCount(0);
  await expect(page.getByLabel("加入对比")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /查看失败原因|查看采集任务明细/ })).toHaveCount(0);
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

test("UI2-SC05 retired procurement leaves confirmed quote facts readable without purchase writes", async ({
  page,
}) => {
  await setup(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/sourcing/purchase-tasks"))
      writes.push(request.url());
  });
  await page.goto("/sourcing");
  await expect(
    page
      .locator(".supplier-offer-table tbody > tr")
      .filter({ hasText: readyCandidate.supplier_name }),
  ).toContainText(String(readyCandidate.quoted_price));
  await expect(page.getByRole("button", { name: "创建采购任务", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "创建采购任务" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "加入对比" }).first()).toBeVisible();
  await page.getByRole("button", { name: "刷新记录", exact: true }).click();
  await expect(page.getByRole("button", { name: "创建采购任务", exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
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
  await expect(page.getByText("宁波澄净户外用品厂")).toBeVisible();
  await page.getByRole("tab", { name: "报价历史" }).click();
  await expect(page.locator(".sourcing-comparison-error")).toContainText("对比历史暂未读取");
  await expect(page.locator(".sourcing-layout")).toBeVisible();
  await expect(page.getByText("选择两家以上已确认报价后，可保存对比记录。")).toHaveCount(0);
  await expect(page.locator(".sourcing-comparison-error")).toContainText(
    "comparison-history-failed-01",
  );

  await page.getByRole("button", { name: "重新读取对比历史" }).click();
  await expect(page.getByText("恢复后的报价对比", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "供应商报价" }).click();
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
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope([first, second]) }));
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
  await page.route(searchesRoute, (route) => {
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
  await page.getByRole("tab", { name: "报价历史" }).click();
  await expect(page.getByText("返回后重新读取的对比", { exact: true })).toBeVisible();
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
  const overview = root.locator(".sourcing-overview");
  await expect(overview.getByRole("searchbox", { name: "搜索找货记录" })).toBeVisible();
  await expect(overview.locator(".sourcing-summary")).toBeVisible();
  const searchBox = await overview.locator(".sourcing-toolbar").boundingBox();
  const summaryBox = await overview.locator(".sourcing-summary").boundingBox();
  if (test.info().project.name === "mobile-390") {
    expect(summaryBox!.y).toBeGreaterThanOrEqual(searchBox!.y + searchBox!.height);
  } else {
    expect(summaryBox!.x).toBeGreaterThanOrEqual(searchBox!.x + searchBox!.width);
    expect(summaryBox!.y).toBeLessThan(searchBox!.y + searchBox!.height);
  }
  const headerControls = await root
    .locator(".sourcing-heading-actions :is(button,a)")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.min(...headerControls)).toBeGreaterThanOrEqual(44);
  await expect(root.locator(".sourcing-journey,.sourcing-tabs,.member-module-guide")).toHaveCount(
    0,
  );
  const records = root.getByRole("complementary", { name: "找货记录" });
  await expect(records.getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(root.locator(".supplier-offer-list").getByText("CNY 12.8")).toBeVisible();
  await root.getByRole("button", { name: "刷新记录", exact: true }).click();
  await expect(root.locator(".supplier-offer-list").getByText("CNY 12.8")).toBeVisible();
  expect(writes).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(root.locator(".sourcing-heading-actions button")).toHaveCount(1);
});

test("supplier offers align scan columns and disclose evidence without a write", async ({
  page,
}) => {
  await setup(page);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && r.url().includes("/api/v1/sourcing/")) writes.push(r.url());
  });
  await page.goto("/sourcing");
  const table = page.getByRole("table", { name: "当前找货记录的真实供应商报价" });
  await expect(table).toBeVisible();
  await expect(table.locator("thead th")).toHaveText([
    "商品 / 供应商",
    "原币报价",
    "起订 / 交期",
    "状态 / 观测时间",
    "操作",
  ]);
  const rows = table.locator("tbody > tr");
  await expect(rows).toHaveCount(2);
  const incomplete = rows.filter({ hasText: incompleteCandidate.supplier_name });
  await expect(incomplete.locator(".supplier-offer-price")).toHaveText("CNY 10.6");
  await expect(incomplete.locator(".supplier-offer-terms")).toContainText("MOQ 200");
  await expect(incomplete.locator(".supplier-offer-terms")).toContainText("交期待确认");
  await expect(incomplete.locator(".supplier-offer-state")).toContainText("缺 6 项");
  await expect(incomplete.locator("details")).not.toHaveAttribute("open");
  const summary = incomplete.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(incomplete.locator("details")).toHaveAttribute("open", "");
  await expect(
    incomplete.getByText("证据 " + incompleteCandidate.evidence_id, { exact: true }),
  ).toBeVisible();
  await expect(incomplete.locator("dl")).toContainText("规格、交期、所在地、可信度、稳定性、风险");
  await expect(incomplete.locator("dl")).toContainText("待费用规则计算");
  await page.keyboard.press("Enter");
  await expect(incomplete.locator("details")).not.toHaveAttribute("open");
  await expect(page.getByRole("link", { name: "费用与利润规则", exact: true })).toHaveCount(1);
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (test.info().project.name === "desktop-chromium") {
    const first = await rows.nth(0).locator(".supplier-offer-price").boundingBox();
    const second = await rows.nth(1).locator(".supplier-offer-price").boundingBox();
    expect(first!.x).toBe(second!.x);
    expect(first!.width).toBe(second!.width);
    expect((await rows.first().boundingBox())!.height).toBeLessThan(210);
  }
  const confirmedActions = rows.first().locator(".supplier-offer-actions");
  const checkbox = confirmedActions.getByRole("checkbox", { name: "加入对比" });
  const checkboxBox = await checkbox.boundingBox();
  expect(checkboxBox!.width).toBe(16);
  expect(checkboxBox!.height).toBe(16);
  const cellBox = await confirmedActions.boundingBox();
  const labelBox = await confirmedActions.locator("label").boundingBox();
  expect(labelBox!.height).toBeGreaterThanOrEqual(44);
  expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(cellBox!.x + cellBox!.width);
  const controls = await incomplete
    .locator("summary,a,button")
    .evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...controls)).toBeGreaterThanOrEqual(44);
});

test("actual successful source task code is shown in Chinese", async ({ page }) => {
  await setup(page);
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: searchId,
        input_type: "keyword",
        input_ref: "便携净水杯",
        status: "completed_with_warnings",
        candidate_count: 1,
        missing_fields: [],
        created_at: "2026-08-08T12:00:00Z",
        candidates: [incompleteCandidate],
        collection_progress: {
          status: "succeeded",
          total_subqueries: 1,
          successful_subqueries: 1,
          failed_subqueries: 0,
          blocked_subqueries: 0,
          active_subqueries: 0,
          available_at: "2026-08-08T12:00:00Z",
        },
      }),
    }),
  );
  await page.goto("/sourcing");
  const progress = page.getByRole("region", { name: "来源采集进度" });
  await expect(progress).toContainText("采集成功");
  await expect(progress).not.toContainText("succeeded");
  await expect(progress).toContainText("1 / 1 个来源已结束");
});

test("SKU-specific supplier facts preserve quote identity and distinguish package measurements", async ({
  page,
}) => {
  await setup(page, ["task:read", "sourcing:read"]);
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: searchId,
        input_type: "image",
        input_ref: "image",
        status: "completed_with_warnings",
        candidate_count: 2,
        missing_fields: [],
        created_at: "2026-10-20T10:00:00Z",
        candidates: [
          {
            ...incompleteCandidate,
            id: readyCandidate.id,
            supplier_name: "义乌市纳云箱包有限公司",
            product_title: "亚马逊跨境化妆包PU 防水美妆包便携式洗漱包大容量多功能收纳包",
            specification: "编织纹黑色",
            quoted_price: 7.8,
            moq: 1,
            source_sku: {
              offer_id: "835520608338",
              sku_id: "5855334264481",
              price_source: "discountPrice",
              price_amount: 1,
              price_unit: "个",
              properties: [{ name: "颜色", value: "编织纹黑色" }],
              attributes: [{ name: "材质", value: "pu" }],
              packages: [{ length: 24, width: 13, height: 14, weight: 120 }],
              package_units: { length: "cm", width: "cm", height: "cm", weight: "g" },
            },
          },
          { ...incompleteCandidate, source_sku_pending: true },
        ],
      }),
    }),
  );
  await page.goto("/sourcing");
  const row = page
    .locator(".supplier-offer-table tbody > tr")
    .filter({ hasText: "SKU 5855334264481" });
  await expect(row.getByText("CNY 7.8", { exact: true })).toBeVisible();
  await expect(row.getByText("SKU 当前折扣报价", { exact: true })).toBeVisible();
  const help = row.getByText("查看 SKU 属性与包装", { exact: true });
  await expect(row.getByText("120 g", { exact: true })).toBeHidden();
  await help.click();
  await expect(row.getByText("120 g", { exact: true })).toBeVisible();
  await expect(row.getByText("24 cm", { exact: true })).toBeVisible();
  await expect(row.getByText("包装数据不等同于商品本体尺寸。", { exact: true })).toBeVisible();
  await expect(row.getByText("pu", { exact: true })).toBeVisible();
  await expect(page.getByText("图搜参考价，SKU 尚未绑定", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "确认报价" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(row.getByText("120 g", { exact: true })).toBeHidden();
});

test("saved sourcing comparison identifies historical quote references without asserting current purchase cost", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "desktop-chromium")
    await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/sourcing/") && request.method() !== "GET")
      writes.push(request.url());
  });
  await page.goto("/sourcing");
  await page.getByRole("tab", { name: "报价历史" }).click();
  const history = page.locator(".sourcing-comparisons");
  await expect(history.getByRole("heading", { name: "供应商报价对比历史" })).toBeVisible();
  await expect(history.getByText("2 条报价记录", { exact: true })).toBeVisible();
  await expect(history).toContainText("保存时引用的报价记录，不代表当前最新报价或已作为进货价。");
  await expect(history).not.toContainText("家现行报价");
  await expect(history.locator(".sourcing-comparison-grid")).toHaveCount(0);
  const table = history.getByRole("table");
  await expect(table.locator("thead th")).toHaveText([
    "商品 / 供应商",
    "规格",
    "最小起订量",
    "报价",
    "交期",
  ]);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const row = table.locator("tbody tr").filter({ hasText: readyCandidate.supplier_name });
  await expect(row.getByRole("rowheader")).toContainText(readyCandidate.product_title);
  await expect(row.locator('td[data-label="报价"]')).toHaveText("CNY 12.8");
  await expect(row.locator('td[data-label="最小起订量"]')).toHaveText("100");
  await expect(row.locator('td[data-label="交期"]')).toHaveText("7 天");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(history).toContainText(readyCandidate.supplier_name);
  await expect(history).toContainText(comparisonQuote.supplier_name);
  await expect(history.getByLabel("规格归一化提示")).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    const rowBox = (await row.boundingBox())!;
    const specBox = (await row.locator('td[data-label="规格"]').boundingBox())!;
    expect(specBox.width).toBeGreaterThan(rowBox.width * 0.9);
    await table.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const mobileNav = page.getByRole("navigation", { name: "移动快捷导航" });
    const lastRow = table.locator("tbody tr").last();
    await expect(lastRow).toBeInViewport({ ratio: 1 });
    const [rowBounds, navBounds] = await Promise.all([
      lastRow.boundingBox(),
      mobileNav.boundingBox(),
    ]);
    expect(rowBounds!.y + rowBounds!.height).toBeLessThanOrEqual(navBounds!.y);
  }
  await expect(table).toHaveScreenshot("saved-quote-matrix-20261104.png");
  expect(writes).toEqual([]);
});

test("sourcing product analysis roundtrip preserves record and search after a detail reload", async ({
  page,
}) => {
  const { opportunityId } = await opportunitySetup(page, calculatedProfit(80), "calculated", [
    "task:read",
    "sourcing:read",
    "opportunity:read",
  ]);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && request.method() !== "GET")
      writes.push(request.url());
  });
  await page.goto(`/sourcing?record=${searchId}&q=${encodeURIComponent("当前商品")}`);
  await page.getByRole("tab", { name: "成本与利润" }).click();
  const link = page
    .getByRole("region", { name: "成本与利润摘要" })
    .getByRole("link", { name: "查看商品分析" });
  await expect(link).toBeVisible();
  const source = new URL(page.url());
  const returnPath = source.pathname + source.search;
  const destination = new URL((await link.getAttribute("href"))!, page.url());
  expect(destination.pathname).toBe(`/opportunities/${opportunityId}`);
  expect(destination.searchParams.get("tab")).toBe("profit");
  expect(destination.searchParams.get("from")).toBe(returnPath);
  await link.click();
  await expect(page).toHaveURL(destination.href);
  await page.reload();
  const back = page.getByRole("navigation", { name: "选品详情返回路径" }).getByRole("link");
  await expect(back).toHaveAttribute("href", returnPath);
  await back.click();
  await expect(page).toHaveURL(source.href);
  await expect(
    page.getByRole("complementary", { name: "找货记录" }).getByRole("button", { pressed: true }),
  ).toContainText("当前商品");
  expect(writes).toEqual([]);
});

test("sourcing queued and running record total does not claim all records are actively collecting", async ({
  page,
}) => {
  await setup(page);
  const records = ["queued", "running", "completed"].map((status, index) => ({
    id: index === 0 ? searchId : `00000000-0000-4000-8000-${String(700 + index).padStart(12, "0")}`,
    input_type: "keyword",
    input_ref: `状态测试 ${index}`,
    status,
    candidate_count: 0,
    missing_fields: [],
    created_at: "2026-08-08T12:00:00.000Z",
  }));
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope(records) }));
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && request.method() !== "GET")
      writes.push(request.url());
  });
  await page.goto("/sourcing");
  const metric = page.locator(".sourcing-summary > div").filter({ hasText: "排队或采集中" });
  await expect(metric.locator("dd")).toHaveText("2");
  await expect(metric.locator("dt")).toHaveAttribute(
    "title",
    "按找货记录状态统计，不代表当前存活的采集会话",
  );
  await expect(page.locator(".sourcing-summary dt")).toHaveText([
    "找货任务",
    "排队或采集中",
    "真实候选",
    "已有结果",
  ]);
  await expect(page.locator(".sourcing-summary dd")).toHaveText(["3", "2", "0", "0"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(writes).toEqual([]);
});

test("sourcing keeps the list image when the same record detail omits it", async ({ page }) => {
  await setup(page);
  const image = "https://m.media-amazon.com/images/sourcing-list-only.svg";
  const item = {
    id: searchId,
    input_type: "opportunity",
    input_ref: "00000000-0000-4000-8000-000000000001",
    display_name: "列表已带商品图",
    status: "succeeded_empty",
    candidate_count: 0,
    missing_fields: [],
    created_at: "2026-11-03T00:00:00Z",
  };
  await page.route(image, (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="12" fill="blue"/></svg>',
    }),
  );
  await page.route(searchesRoute, (r) =>
    r.fulfill({ json: envelope([{ ...item, image_url: image }]) }),
  );
  await page.route("**/api/v1/sourcing/searches/" + searchId, (r) =>
    r.fulfill({ json: envelope({ ...item, candidates: [] }) }),
  );
  await page.goto("/sourcing");
  const detail = page.getByRole("region", { name: "找货记录详情" });
  await expect(detail).toHaveAttribute("aria-busy", "false");
  await expect(detail.getByRole("img", { name: item.display_name, exact: true })).toHaveAttribute(
    "src",
    image,
  );
});

test("sourcing list and detail show the same authorized image snapshot", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1672, height: 941 });
  const firstImage = "https://m.media-amazon.com/images/sourcing-sync-initial.svg";
  const detailImage = "https://m.media-amazon.com/images/sourcing-sync-detail.svg";
  const record = {
    id: searchId,
    input_type: "opportunity",
    input_ref: "00000000-0000-4000-8000-000000000001",
    display_name: "Compact display with wide base",
    image_url: null as string | null,
    status: "succeeded_empty",
    candidate_count: 0,
    missing_fields: [],
    created_at: "2026-11-03T00:00:00Z",
  };
  let listReads = 0;
  let detailReads = 0;
  let returnedImage: string | null = detailImage;
  await page.route("https://m.media-amazon.com/images/sourcing-sync-*.svg", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect x="4" y="4" width="112" height="66" rx="6" fill="#426082"/><rect x="11" y="11" width="98" height="52" fill="#91acc3"/></svg>',
    }),
  );
  await page.route(searchesRoute, (r) => {
    listReads++;
    return r.fulfill({ json: envelope([record]) });
  });
  await page.route("**/api/v1/sourcing/searches/" + searchId, (r) => {
    detailReads++;
    return r.fulfill({ json: envelope({ ...record, image_url: returnedImage, candidates: [] }) });
  });
  await page.goto("/sourcing");
  const detail = page.getByRole("region", { name: "找货记录详情" });
  const thumbnail = page.locator(".sourcing-record-items .research-thumbnail");
  await expect(detail).toHaveAttribute("aria-busy", "false");
  await expect(detail.locator(".research-thumbnail img")).toHaveAttribute("src", detailImage);
  await expect(thumbnail.locator("img")).toHaveAttribute("src", detailImage, { timeout: 1500 });
  expect([listReads, detailReads]).toEqual([1, 1]);

  record.image_url = firstImage;
  returnedImage = null;
  await page.reload();
  await expect(detail).toHaveAttribute("aria-busy", "false");
  await expect(detail.locator(".research-thumbnail img")).toHaveCount(0);
  await expect(thumbnail.locator("img")).toHaveCount(0);
  expect([listReads, detailReads]).toEqual([2, 2]);
});

// The extra English-title case measures title wrapping with the same local image fixtures.
for (const scenario of ["simple", "rich", "reference-titles"]) {
  const withRichRecords = scenario !== "simple";
  const withReferenceTitles = scenario === "reference-titles";
  test(
    withReferenceTitles
      ? "wide sourcing reference title composition"
      : withRichRecords
        ? "midou reference sourcing compares multiple images and authorized task detail"
        : "midou reference sourcing displays the task Amazon reference image in list and detail",
    async ({ page }, testInfo) => {
      const wide = page.viewportSize()!.width >= 1101;
      if (wide) await page.setViewportSize({ width: 1672, height: 941 });
      const taskId = "00000000-0000-4000-8000-000000009008";
      await setup(
        page,
        withRichRecords
          ? ["task:read", "trend:read", "opportunity:read", "sourcing:read", "platform:operate"]
          : undefined,
      );
      const record = {
        id: searchId,
        input_type: "opportunity",
        input_ref: "00000000-0000-4000-8000-000000000001",
        display_name: withReferenceTitles
          ? 'Amazon Echo Show 15 (newest model), Full HD 15.6" kitchen hub for home organization, with built-in Fire TV, Designed for Alexa+'
          : "Amazon 参考商品：用于验证宽屏长标题折行、图片尺寸和采集进度对齐的供应链找货测试样品",
        image_url: "https://m.media-amazon.com/images/fixture.jpg",
        status: "succeeded_empty",
        candidate_count: 0,
        missing_fields: [],
        created_at: "2026-11-03T00:00:00Z",
      };
      // Product-shaped fixture only; no real Amazon network request is made.
      await page.route("https://m.media-amazon.com/images/fixture.jpg", (r) =>
        r.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect x="4" y="16" width="152" height="88" rx="7" fill="#162233"/><rect x="10" y="22" width="140" height="76" rx="3" fill="#244b76"/><rect x="20" y="34" width="68" height="50" rx="4" fill="#528ac3"/><rect x="96" y="34" width="43" height="22" rx="4" fill="#83a9c4"/><rect x="96" y="62" width="43" height="22" rx="4" fill="#316a88"/></svg>',
        }),
      );
      const recordsFixture = [
        record,
        ...[2, 3, 4, 5].map((index) => ({
          ...record,
          id: `00000000-0000-4000-8000-00000000900${index}`,
          display_name: withReferenceTitles
            ? [
                "HomeView - Space Gray",
                "New Super Mario Bros. U Deluxe (Nintendo Switch)",
                "Pikmin 4 - Nintendo Switch",
                "Tesla Roadster",
              ][index - 2]
            : withRichRecords
              ? [
                  "Home camera · graphite",
                  "Adventure game for handheld consoles",
                  "Colorful puzzle adventure",
                  "Die-cast roadster",
                ][index - 2]
              : `Amazon 参考商品 ${index}`,
          image_url: withRichRecords
            ? `https://m.media-amazon.com/images/sourcing-fixture-${index}.svg`
            : undefined,
        })),
      ];
      if (withRichRecords) {
        const silhouettes = [
          '<circle cx="32" cy="29" r="17" fill="#98a1a8"/><circle cx="32" cy="29" r="11" fill="#28343f"/><path d="M19 51h26" stroke="#7e868c" stroke-width="8"/>',
          '<rect x="12" y="6" width="40" height="52" rx="3" fill="#efbd4c"/><path d="m16 44 13-23 15 19 5 8" fill="#ce653c"/>',
          '<rect x="13" y="6" width="38" height="52" rx="3" fill="#80b97a"/><circle cx="32" cy="32" r="13" fill="#f3d66c"/>',
          '<path d="M6 39v-8l11-3 9-10h20l11 11 3 3v7Z" fill="#b92d31"/><circle cx="18" cy="39" r="6" fill="#28343f"/><circle cx="49" cy="39" r="6" fill="#28343f"/>',
        ];
        await page.route("https://m.media-amazon.com/images/sourcing-fixture-*.svg", (r) => {
          const match = /sourcing-fixture-([2-5])\.svg$/.exec(r.request().url());
          expect(match).not.toBeNull();
          return r.fulfill({
            contentType: "image/svg+xml",
            body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${silhouettes[Number(match![1]) - 2]}</svg>`,
          });
        });
      }
      await page.route(searchesRoute, (r) => r.fulfill({ json: envelope(recordsFixture) }));
      await page.route(`**/api/v1/opportunities/${record.input_ref}`, (r) =>
        r.fulfill({ json: envelope({ id: record.input_ref, profit_status: "insufficient_data" }) }),
      );
      await page.route(`**/api/v1/opportunities/${record.input_ref}/profit-analysis`, (r) =>
        r.fulfill({
          json: envelope({ latest_run: null, current_inputs: [], cost_input_reviews: [] }),
        }),
      );
      await page.route("**/api/v1/sourcing/searches/" + searchId, (r) =>
        r.fulfill({
          json: envelope({
            ...record,
            candidates: [],
            ...(withRichRecords ? { collection_task_id: taskId } : {}),
            collection_progress: {
              status: "failed",
              total_subqueries: 1,
              successful_subqueries: 0,
              failed_subqueries: 1,
              blocked_subqueries: 0,
              active_subqueries: 0,
            },
          }),
        }),
      );
      await page.goto("/sourcing");
      const recordImages = page.locator(".sourcing-record-items .research-thumbnail img");
      await expect(recordImages).toHaveCount(withRichRecords ? 5 : 1);
      await expect(recordImages.first()).toBeVisible();
      if (withRichRecords) {
        await expect(page.getByRole("link", { name: "查看失败原因", exact: true })).toHaveAttribute(
          "href",
          `/platform-admin/collection?task=${taskId}`,
        );
      }
      await expect(page.locator(".sourcing-record-items > button")).toHaveCount(5);
      const detailPhoto = page.locator(".sourcing-detail > header .research-thumbnail img");
      await expect(detailPhoto).toBeVisible();
      await expect(detailPhoto).toHaveAttribute("loading", "eager");
      await expect(detailPhoto).toHaveAttribute("fetchpriority", "high");
      await expect(recordImages.first()).toHaveAttribute("loading", "lazy");
      await expect
        .poll(() => detailPhoto.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      await expect(page.getByRole("heading", { name: "供应链找货", exact: true })).toBeVisible();
      const progress = page.getByRole("region", { name: "来源采集进度" });
      await expect(progress).toContainText("采集失败");
      await expect(progress).toContainText("1 / 1 个来源已结束");
      await expect(page.locator(".sourcing-profit-unconfirmed-breakdown")).toBeVisible();
      if (wide) {
        await expect(page.locator(".sourcing-workspace--review")).toHaveCSS(
          "font-family",
          /DengXian/,
        );
        const actions = page.locator(".sourcing-heading-actions");
        await expect(page.locator(".sourcing-head h1")).toHaveCSS("translate", "0px -3px");
        await expect(progress).toHaveCSS("translate", "0px -2px");
        await expect(recordImages.first()).toHaveCSS("padding", "5px");
        await expect(detailPhoto).toHaveCSS("padding", "14px");
        await expect(detailPhoto).toHaveCSS("object-fit", "contain");
        const imageSurface = await detailPhoto.evaluate(
          (node) => getComputedStyle(node).backgroundColor,
        );
        await expect(recordImages.first()).toHaveCSS("background-color", imageSurface);
        await expect(page.locator(".sourcing-head > div:first-child")).toHaveCSS("top", "4px");
        await expect(page.locator(".sourcing-detail")).toHaveCSS("padding-inline-end", "18px");
        const [title, toolbar, records, detail] = await Promise.all(
          [
            ".sourcing-head",
            ".sourcing-overview",
            ".sourcing-layout > aside",
            ".sourcing-detail",
          ].map((selector) => page.locator(selector).boundingBox()),
        );
        const breadcrumb = (await page
          .getByRole("navigation", { name: "面包屑", exact: true })
          .boundingBox())!;
        const sidebar = (await page
          .getByRole("complementary", { name: "工作区导航" })
          .boundingBox())!;
        expect(Math.abs(title!.x - 259)).toBeLessThanOrEqual(2);
        expect(title!.x - sidebar.x - sidebar.width).toBeGreaterThanOrEqual(12);
        expect(breadcrumb.y + breadcrumb.height).toBeLessThan(title!.y);
        for (const box of [toolbar, records]) expect(box!.x).toBeCloseTo(title!.x, 0);
        expect(records!.width).toBeGreaterThanOrEqual(321);
        expect(Math.abs(detail!.x - 606)).toBeLessThanOrEqual(3);
        expect(detail!.x - records!.x - records!.width).toBeCloseTo(15, 0);
        expect(detail!.y - toolbar!.y - toolbar!.height).toBeCloseTo(14, 0);
        await expect(page.locator(".sourcing-record-items > button").first()).toHaveCSS(
          "column-gap",
          "16px",
        );
        const recordPhoto = (await page
          .locator(".sourcing-record-items .research-thumbnail")
          .first()
          .boundingBox())!;
        expect(Math.abs(recordPhoto.x - 280)).toBeLessThanOrEqual(3);
        const rowTitle = (await page
          .locator(".sourcing-record-items > button > b")
          .first()
          .boundingBox())!;
        expect(Math.abs(rowTitle.x - 364)).toBeLessThanOrEqual(3);
        const recordRows = page.locator(".sourcing-record-items > button");
        await expect(recordRows.first().locator("b")).toHaveCSS("font-family", /^"Segoe UI",/);
        await expect(recordRows.first().locator("b")).toHaveCSS("font-weight", "600");
        await expect(recordRows.first().locator(".sourcing-record-meta small")).toHaveCSS(
          "line-height",
          "19px",
        );
        const readingMeta = recordRows.first().locator(".sourcing-record-meta");
        for (const fact of [readingMeta.locator("small"), readingMeta.locator("em")]) {
          await expect(fact).toHaveCSS("font-size", "13px");
          await expect(fact).toHaveCSS("font-variant-numeric", "tabular-nums");
        }
        await expect(progress.locator("dd").first()).toHaveCSS("font-weight", "650");
        await expect(progress.locator("h4")).toHaveCSS("border-radius", "7px");
        await expect(page.locator(".sourcing-detail > header h3")).toHaveCSS("font-weight", "700");
        const progressTones = await progress.evaluate((node) => {
          const color = (selector: string) => getComputedStyle(node.querySelector(selector)!).color;
          return {
            context: color("small"),
            successful: color("dt:first-child"),
            failed: color("dt[data-fail]"),
            failedCount: color("dt[data-fail] + dd"),
          };
        });
        expect(progressTones.context).toBe(progressTones.successful);
        expect(progressTones.failed).toBe(progressTones.failedCount);
        expect(progressTones.failed).not.toBe(progressTones.successful);
        const firstRecord = (await recordRows.first().boundingBox())!;
        const lastRecord = (await recordRows.last().boundingBox())!;
        expect(Math.abs(firstRecord.y - records!.y - 62)).toBeLessThanOrEqual(4);
        expect(
          Math.abs(lastRecord.y + lastRecord.height - firstRecord.y - 480),
        ).toBeLessThanOrEqual(6);
        const rowOffsets = await Promise.all(
          [recordRows.first(), recordRows.nth(1)].map(async (row) => {
            const [item, name, meta] = await Promise.all([
              row.boundingBox(),
              row.locator("b").boundingBox(),
              row.locator(".sourcing-record-meta").boundingBox(),
            ]);
            expect(meta!.y - name!.y - name!.height).toBeGreaterThanOrEqual(6);
            return {
              titleCenter: name!.y + name!.height / 2 - item!.y,
              titleHeight: name!.height,
              metaTop: meta!.y - item!.y,
            };
          }),
        );
        expect(rowOffsets[0].titleCenter).toBeCloseTo(rowOffsets[1].titleCenter, 0);
        expect(rowOffsets[0].metaTop).toBeCloseTo(rowOffsets[1].metaTop, 0);
        expect(rowOffsets.map(({ titleHeight }) => titleHeight)).toEqual([42, 21]);
        const searchField = page.locator(".sourcing-toolbar .sourcing-search-input");
        const resultCount = page.locator(".sourcing-toolbar > span");
        const [searchBounds, resultBounds] = await Promise.all([
          searchField.boundingBox(),
          resultCount.boundingBox(),
        ]);
        await expect(page.locator(".sourcing-toolbar")).toHaveCSS("translate", "0px -2px");
        await expect(page.locator(".sourcing-summary")).toHaveCSS("translate", "-2px -1px");
        await expect(searchField.locator("..")).toHaveCSS("column-gap", "18px");
        expect(Math.abs(searchBounds!.x - 390)).toBeLessThanOrEqual(4);
        expect(resultBounds!.x - searchBounds!.x - searchBounds!.width).toBeCloseTo(24, 0);
        const warning = page.locator(".sourcing-pending[data-attention='true']");
        const warningBorder = await warning.evaluate((node) =>
          getComputedStyle(node).getPropertyValue("--so-warning-border").trim(),
        );
        const borderColor = await warning.evaluate((node, color) => {
          const probe = document.createElement("span");
          probe.style.color = color;
          node.append(probe);
          const resolved = getComputedStyle(probe).color;
          probe.remove();
          return resolved;
        }, warningBorder);
        await expect(warning).toHaveCSS("border-top-color", borderColor);
        const cost = page.getByRole("region", { name: "成本与利润摘要", exact: true });
        expect(Math.abs((await cost.boundingBox())!.x - 1209)).toBeLessThanOrEqual(4);
        await expect(cost.locator(":scope > header")).toHaveCSS("align-items", "flex-start");
        await expect(cost.locator(".sourcing-profit-unconfirmed-breakdown dt").first()).toHaveCSS(
          "font-size",
          "15px",
        );
        await expect(page.locator(".sourcing-summary dt").first()).toHaveCSS("font-size", "15px");
        const emptyIcon = page.locator(".sourcing-empty-offers .sourcing-quote-empty > svg");
        await expect(emptyIcon).toHaveCSS("stroke-width", "1.2px");
        await expect(emptyIcon).toHaveCSS("width", "72px");
        await expect(emptyIcon).toHaveCSS("translate", "-1px -7px");
        await expect(emptyIcon).toHaveAttribute("aria-hidden", "true");
        const emptyIconTone = await emptyIcon.evaluate((icon) => {
          const probe = document.createElement("span");
          probe.style.color = "color-mix(in srgb, var(--so-text-muted) 48%, var(--so-border))";
          icon.parentElement!.append(probe);
          const tones = {
            actual: getComputedStyle(icon).color,
            expected: getComputedStyle(probe).color,
          };
          probe.remove();
          return tones;
        });
        console.log("SOURCING_EMPTY_ICON_TONE", JSON.stringify(emptyIconTone));
        expect(emptyIconTone.actual).toBe(emptyIconTone.expected);
        await expect(warning.locator("h4")).toHaveCSS("font-weight", "700");
        await expect(warning.locator("h4")).toHaveCSS("translate", "-1px -1px");
        await expect(warning.locator("p")).toBeVisible();
        if (withRichRecords) {
          const inspection = warning.getByRole("link", { name: "查看失败原因", exact: true });
          await expect(inspection).toHaveCSS("min-inline-size", "126px");
          await expect(inspection).toHaveCSS("min-height", "42px");
          await expect(inspection).toHaveCSS("font-size", "14px");
          await expect(inspection).toHaveAttribute(
            "href",
            "/platform-admin/collection?task=" + taskId,
          );
        }
        await expect(cost.locator(".sourcing-profit-unconfirmed-breakdown dd").first()).toHaveCSS(
          "font-variant-numeric",
          "tabular-nums",
        );
        await expect(warning.locator("h4")).toHaveCSS("column-gap", "13px");
        await expect(warning.locator("h4 > svg")).toHaveCSS("width", "24px");
        await expect(warning.locator("h4 > svg")).toHaveAttribute("aria-hidden", "true");
        await expect(warning.locator("p")).toHaveCSS("padding-inline-start", "37px");
        expect(
          Math.abs(records!.y + records!.height - detail!.y - detail!.height),
        ).toBeLessThanOrEqual(3);
        const rules = actions.getByRole("link", { name: "费用与利润规则" });
        const refresh = actions.getByRole("button", { name: "刷新记录", exact: true });
        await expect(rules).toHaveAttribute("href", /^\/sourcing\/cost-rules\?/);
        await expect(rules.locator("svg rect")).toHaveAttribute("height", "20");
        const [rulesBox, refreshBox] = await Promise.all([
          rules.boundingBox(),
          refresh.boundingBox(),
        ]);
        expect([rulesBox!.width, refreshBox!.width]).toEqual([176, 132]);
        expect(refreshBox!.x - rulesBox!.x - rulesBox!.width).toBe(16);
        await expect(page.locator(".sourcing-detail > header h3")).toHaveCSS("font-size", "22px");
        const titleReading = await page.locator(".sourcing-detail > header h3").evaluate((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return {
            column: node.getBoundingClientRect().width,
            em: Number.parseFloat(getComputedStyle(node).fontSize),
            lines: [...range.getClientRects()].map((rect) => rect.width),
          };
        });
        expect(titleReading.lines).toHaveLength(2);
        expect(titleReading.lines[0] / titleReading.column).toBeGreaterThan(0.9);
        expect(titleReading.lines[1]).toBeGreaterThanOrEqual(4 * titleReading.em);
        const appearance = await page
          .locator(".sourcing-workspace--review")
          .evaluate((workspace) => {
            const css = getComputedStyle(workspace);
            const color = document.createElement("canvas").getContext("2d")!;
            const resolve = (value: string) => {
              color.fillStyle = value.trim();
              return color.fillStyle;
            };
            const panel = resolve(css.getPropertyValue("--so-panel"));
            const frame = workspace.querySelector(".sourcing-detail > header .research-thumbnail")!;
            return {
              panel,
              cards: [".sourcing-overview", ".sourcing-layout > aside", ".sourcing-detail"].map(
                (selector) =>
                  resolve(getComputedStyle(workspace.querySelector(selector)!).backgroundColor),
              ),
              frame: resolve(getComputedStyle(frame).backgroundColor),
              image: getComputedStyle(frame.querySelector("img")!).backgroundColor,
            };
          });
        expect(appearance.cards).toEqual(Array(3).fill(appearance.panel));
        expect(appearance.frame).not.toBe(appearance.panel);
        expect(appearance.image).toBe("rgba(0, 0, 0, 0)");
        const surfaceTones = await page
          .locator(".sourcing-empty-offers--with-profit")
          .evaluate((paired) => {
            const sample = document.createElement("span");
            const expectedColor = (soft: number) => {
              sample.style.backgroundColor =
                "color-mix(in srgb, var(--so-panel-soft) " + soft + "%, var(--so-panel))";
              return getComputedStyle(sample).backgroundColor;
            };
            const actualColor = (selector: string) =>
              getComputedStyle(paired.querySelector(selector)!).backgroundColor;
            paired.append(sample);
            const actual = [
              actualColor(":scope > .sourcing-quote-empty"),
              actualColor(".sourcing-profit-summary"),
            ];
            const expected = [expectedColor(30), expectedColor(60)];
            sample.remove();
            return { actual, expected };
          });
        console.log("SOURCING_PAIRED_SURFACES", JSON.stringify(surfaceTones));
        expect(surfaceTones.actual).toEqual(surfaceTones.expected);
        expect(surfaceTones.actual[0]).not.toBe(surfaceTones.actual[1]);
        await expect(recordRows.first().locator(":scope > b")).toHaveCSS("font-weight", "600");
        const recordRhythm = await recordRows.evaluateAll((rows) =>
          rows.map((row) => {
            const rowBox = row.getBoundingClientRect();
            const meta = row.querySelector(".sourcing-record-meta")!.getBoundingClientRect();
            return {
              minimum: getComputedStyle(row).minBlockSize,
              height: rowBox.height,
              metaInside: meta.top >= rowBox.top && meta.bottom <= rowBox.bottom,
            };
          }),
        );
        expect(
          recordRhythm.every((row) => row.minimum === "95px" && row.height >= 95 && row.metaInside),
        ).toBe(true);
        console.log("SOURCING_RECORD_RHYTHM", JSON.stringify(recordRhythm));
        const quoteCaption = page.locator(".sourcing-empty-offers > .sourcing-quote-empty > span");
        for (const caption of [quoteCaption, warning.locator("p")]) {
          const readingTone = await caption.evaluate((node) => {
            const sample = document.createElement("span");
            sample.style.color = "color-mix(in srgb, var(--so-text) 35%, var(--so-text-muted))";
            node.append(sample);
            const actual = getComputedStyle(node).color;
            const expected = getComputedStyle(sample).color;
            sample.remove();
            return { actual, expected };
          });
          console.log("SOURCING_READING_TONE", JSON.stringify(readingTone));
          expect(readingTone.actual).toBe(readingTone.expected);
        }
        const [photoBox, headingBox] = await Promise.all([
          detailPhoto.locator("..").boundingBox(),
          page.locator(".sourcing-detail > header h3").boundingBox(),
        ]);
        expect([photoBox!.width, photoBox!.height]).toEqual([188, 188]);
        expect(headingBox!.x - photoBox!.x - photoBox!.width).toBeCloseTo(16, 0);
        await expect(page.locator(".sourcing-detail > header code")).toHaveCSS("font-size", "15px");
        const basisSummary = page.locator(".sourcing-empty-offers-basis summary");
        await expect(basisSummary).toHaveCSS("min-height", "40px");
        await expect(basisSummary).toHaveCSS("column-gap", "14px");
        await expect(basisSummary).toHaveCSS("padding-inline-start", "10px");
        await expect(basisSummary).toHaveCSS("padding-block", "5px 11px");
        await expect(basisSummary).toBeEnabled();
        await expect(basisSummary).toHaveCSS("font-weight", "600");
        await expect(progress.locator("dt").first()).toHaveCSS("font-size", "15px");
        await expect(progress.locator("dd").first()).toHaveCSS("font-size", "16px");
        const countPositions = await progress
          .locator("dl > div")
          .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().x));
        expect(countPositions.map((x) => Math.round(x - countPositions[0]!))).toEqual([
          0, 82, 178, 260,
        ]);
        const endedLabel = progress.getByText("1 / 1 个来源已结束");
        await expect(endedLabel).toHaveCSS("translate", "0px -4px");
        const ended = (await endedLabel.boundingBox())!;
        const counts = (await progress.locator("dl").boundingBox())!;
        expect(
          Math.abs(ended.y + ended.height / 2 - counts.y - counts.height / 2),
        ).toBeLessThanOrEqual(4);
        expect(ended.x).toBeGreaterThanOrEqual(counts.x + counts.width);
        if (withRichRecords) {
          const switcher = page.getByRole("link", { name: "侧栏切换工作区" });
          const sidebarBox = (await page
            .getByRole("complementary", { name: "工作区导航" })
            .boundingBox())!;
          const switcherBox = (await switcher.boundingBox())!;
          const chevronBox = (await switcher.locator(".midou-workspace-chevron").boundingBox())!;
          expect(chevronBox.x + chevronBox.width).toBeLessThan(switcherBox.x + switcherBox.width);
          expect(switcherBox.x + switcherBox.width).toBeLessThan(sidebarBox.x + sidebarBox.width);
          await expect
            .poll(() =>
              recordImages.evaluateAll((images) =>
                images.every((img) => (img as HTMLImageElement).naturalWidth > 0),
              ),
            )
            .toBe(true);
        }
        if (withReferenceTitles) {
          const title = page.locator(".sourcing-detail > header h3");
          await expect(title).toHaveText(record.display_name);
          await expect(title).toHaveCSS("text-wrap-style", "auto");
          await expect(title).toHaveCSS("letter-spacing", "-0.18px");
          const rendered = await title.evaluate((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const lines = [...range.getClientRects()];
            const bounds = node.getBoundingClientRect();
            return {
              count: lines.length,
              firstLineShare: (lines[0]?.width ?? 0) / bounds.width,
              withinColumn: lines.every(
                (line) => line.left >= bounds.left - 1 && line.right <= bounds.right + 1,
              ),
            };
          });
          expect(rendered.count).toBe(2);
          expect(rendered.firstLineShare).toBeGreaterThan(0.94);
          expect(rendered.withinColumn).toBe(true);
        }
        await expect(page.locator(".sourcing-record-heading")).toHaveCSS("min-height", "54px");
        await expect(progress.locator("header > span")).toHaveCSS("inset-inline-end", "1px");
        const tracks = {
          completion: await progress
            .locator("header > span")
            .evaluate((node) => getComputedStyle(node).insetBlockStart),
          warning: await warning
            .locator("h4 > svg")
            .evaluate((node) => getComputedStyle(node).translate),
          costTitle: await cost
            .locator("header > div")
            .evaluate((node) => getComputedStyle(node).paddingInlineStart),
          costValue: await cost
            .locator(".sourcing-profit-unconfirmed-breakdown dd")
            .first()
            .evaluate((node) => getComputedStyle(node).fontSize),
        };
        console.log("SOURCING_REFERENCE_READING_TRACKS", JSON.stringify(tracks));
        expect(tracks).toEqual({
          completion: "0px",
          warning: "2px 3px",
          costTitle: "4px",
          costValue: "15px",
        });
        await expect(page.getByRole("tab", { name: "成本与利润", exact: true })).toHaveCSS(
          "text-indent",
          "5px",
        );
        await expect(page.getByRole("tab", { name: "报价历史", exact: true })).toHaveCSS(
          "text-indent",
          "-2px",
        );
        await expect(cost.locator("header > div")).toHaveCSS("translate", "2px -1px");
        if (withRichRecords) {
          const noticeTask = warning.locator(".sourcing-notice-task");
          await expect(noticeTask).toHaveCSS("inset-block-start", "2px");
          await expect(noticeTask).toHaveAttribute(
            "href",
            "/platform-admin/collection?task=" + taskId,
          );
        }

        await recordRows.first().focus();
        await page.keyboard.press("Tab");
        await expect(recordRows.nth(1)).toBeFocused();
        await expect(recordRows.nth(1)).toHaveCSS("outline-offset", "-3px");
        await expect(recordRows.nth(1)).toHaveCSS("outline-width", "3px");
        await expect(recordRows.first()).toHaveAttribute("aria-pressed", "true");
        await expect(recordRows.nth(1)).toHaveAttribute("aria-pressed", "false");
      } else {
        const photo = (await detailPhoto.locator("..").boundingBox())!;
        const title = (await page.locator(".sourcing-detail > header h3").boundingBox())!;
        const progressBox = (await progress.boundingBox())!;
        expect(title.x - photo.x - photo.width).toBeCloseTo(12, 0);
        expect(title.y).toBeLessThan(photo.y + photo.height);
        expect(progressBox.x).toBeCloseTo(photo.x, 0);
        expect(progressBox.width).toBeGreaterThan(title.width);
        expect(progressBox.y).toBeGreaterThanOrEqual(photo.y + photo.height);
        const [success, waiting, failed, blocked] = await Promise.all(
          (await progress.locator("dl > div").all()).map((metric) => metric.boundingBox()),
        );
        expect(waiting!.x).toBeGreaterThan(success!.x);
        expect(waiting!.y).toBeCloseTo(success!.y, 0);
        expect(failed!.x).toBeCloseTo(success!.x, 0);
        expect(blocked!.x).toBeCloseTo(waiting!.x, 0);
        expect(failed!.y).toBeGreaterThan(success!.y);
        await progress.screenshot({ path: testInfo.outputPath("sourcing-progress-mobile.png") });
        await page.locator(".sourcing-detail > header").screenshot({
          path: testInfo.outputPath("sourcing-identity-mobile.png"),
        });
      }
      await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    },
  );
}

test("search keeps the same record row width when the scrollbar disappears", async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop scroll gutter");
  const nativeBrowser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  try {
    const page = await nativeBrowser.newPage({ baseURL, viewport: { width: 1672, height: 941 } });
    await setup(page);
    const records = Array.from({ length: 20 }, (_, i) => ({
      id: i === 0 ? searchId : `00000000-0000-4000-8000-${String(7100 + i).padStart(12, "0")}`,
      input_type: "keyword",
      input_ref: `宽屏找货示例 ${i + 1}`,
      display_name: `宽屏找货示例 ${i + 1}`,
      status: "succeeded_empty",
      candidate_count: 0,
      missing_fields: [],
      created_at: "2026-11-03T00:00:00Z",
    }));
    let filteredReads = 0;
    await page.route(searchesRoute, (route) => {
      const q = new URL(route.request().url()).searchParams.get("q");
      if (q) filteredReads++;
      const rows = q ? records.filter((record) => record.display_name === q) : records;
      return route.fulfill({
        json: {
          ...envelope(rows),
          meta: {
            page: 1,
            page_size: 20,
            total: rows.length,
            summary: { total: rows.length, running: 0, candidates: 0, ready: 0 },
          },
        },
      });
    });
    await page.goto("/sourcing");
    const pane = page.locator(".sourcing-record-items");
    const rows = pane.getByRole("button");
    const geometry = () =>
      pane.evaluate((node) => {
        const el = node as HTMLElement;
        const row = el.querySelector("button")!;
        const paneBox = el.getBoundingClientRect();
        const rowBox = row.getBoundingClientRect();
        return {
          rowWidth: rowBox.width,
          rightInset: paneBox.right - rowBox.right,
          scrolls: el.scrollHeight > el.clientHeight,
        };
      });
    await expect(rows).toHaveCount(20);
    const long = await geometry();
    expect(long.scrolls).toBe(true);
    await page.getByRole("searchbox", { name: "搜索找货记录" }).fill(records[0]!.display_name);
    await expect(rows).toHaveCount(1);
    const short = await geometry();
    expect(short.scrolls).toBe(false);
    expect(filteredReads).toBe(1);
    expect(short.rightInset).toBeCloseTo(long.rightInset, 0);
    expect(short.rowWidth).toBeCloseTo(long.rowWidth, 0);
    expect(short.rightInset).toBe(8);
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
  } finally {
    await nativeBrowser.close();
  }
});

test("sourcing record keeps the full status and candidate count at narrow desktop rail widths", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop sourcing record rail");
  await setup(page);
  const records = [
    {
      id: searchId,
      input_type: "product_url",
      input_ref: "https://www.amazon.com/dp/B0B3RT92P5",
      display_name: "用于确认完整状态的找货商品",
      status: "succeeded_empty",
      candidate_count: 999999999,
      missing_fields: [],
      created_at: "2026-08-08T12:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000009002",
      input_type: "keyword",
      input_ref: "便携净水杯",
      status: "succeeded_empty",
      candidate_count: 0,
      missing_fields: [],
      created_at: "2026-08-08T12:00:00.000Z",
    },
  ];
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope(records) }));
  await page.route("**/api/v1/sourcing/searches/" + searchId, (route) =>
    route.fulfill({ json: envelope({ ...records[0], candidates: [] }) }),
  );
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/sourcing");
  const rows = page.locator(".sourcing-record-items > button");
  await expect(rows).toHaveCount(2);
  for (const width of [1440, 1560, 1600, 1672]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await rows.first().evaluate((row) => {
      const meta = row.querySelector(".sourcing-record-meta")!;
      const [state, count] = Array.from(meta.children);
      const following = row.nextElementSibling!;
      const a = state.getBoundingClientRect();
      const b = count.getBoundingClientRect();
      return {
        statusClipped: state.scrollWidth > state.clientWidth + 1,
        countClipped: b.right > meta.getBoundingClientRect().right + 1,
        rowOverlap: Math.max(a.bottom, b.bottom) > following.getBoundingClientRect().top,
      };
    });
    expect(bounds, `width=${width}`).toEqual({
      statusClipped: false,
      countClipped: false,
      rowOverlap: false,
    });
  }
});

test("wide sourcing fills the title column without script-dependent wrapping", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide title measurements");
  await page.setViewportSize({ width: 1672, height: 941 });
  await setup(page);
  const titles = [
    "Amazon 参考商品：用于验证宽屏长标题折行、图片尺寸和采集进度对齐的供应链找货测试样品",
    "家用桌面智能显示器全高清厨房触控屏带壁挂支架和内置音响支持家庭日程管理和食谱浏览支持语音控制与多房间连接",
    "Amazon Echo Show 15 (newest model), Full HD 15.6 kitchen hub for home organization, with built-in Fire TV, Designed for Alexa+",
  ];
  const records = titles.map((title, index) => ({
    id: index === 0 ? searchId : "00000000-0000-4000-8000-00000000751" + index,
    input_type: "keyword",
    input_ref: title,
    display_name: title,
    status: "succeeded_empty",
    candidate_count: 0,
    missing_fields: [],
    created_at: "2026-11-03T00:00:00Z",
  }));
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope(records) }));
  for (const record of records) {
    await page.route("**/api/v1/sourcing/searches/" + record.id, (route) =>
      route.fulfill({ json: envelope({ ...record, candidates: [] }) }),
    );
  }
  await page.goto("/sourcing");
  const heading = page.locator(".sourcing-detail > header h3");
  const buttons = page.locator(".sourcing-record-items > button");
  await expect(buttons).toHaveCount(3);
  const readings = [];
  for (let i = 0; i < records.length; i++) {
    await buttons.nth(i).click();
    await expect(heading).toHaveText(titles[i]);
    readings.push(
      await heading.evaluate((node) => {
        const column = node.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()];
        return {
          style: getComputedStyle(node).textWrapStyle,
          lines: rects.length,
          firstLineShare: Number((rects[0].width / column.width).toFixed(4)),
          within: rects.every((r) => r.left >= column.left - 1 && r.right <= column.right + 1),
        };
      }),
    );
  }
  console.log("SOURCING_SCRIPT_TITLE_GEOMETRY", JSON.stringify(readings));
  expect(
    readings.every(
      ({ lines, firstLineShare, within }) => lines === 2 && firstLineShare > 0.9 && within,
    ),
  ).toBe(true);
});

test("wide sourcing photo framing keeps landscape portrait square and fallback intact", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide and narrow image geometry");
  await page.setViewportSize({ width: 1672, height: 941 });
  await setup(page);
  const formats = [
    { name: "横图商品", size: [160, 100] },
    { name: "竖图商品", size: [90, 160] },
    { name: "方图商品", size: [120, 120] },
    { name: "失效图商品", size: null },
    { name: "无图商品", size: null },
  ];
  const records = formats.map(({ name }, index) => ({
    id: index === 0 ? searchId : "00000000-0000-4000-8000-00000000787" + index,
    input_type: "keyword",
    input_ref: name,
    display_name: name,
    image_url:
      index === 4 ? null : "https://m.media-amazon.com/images/sourcing-ratio-" + index + ".svg",
    status: "succeeded_empty",
    candidate_count: 0,
    missing_fields: [],
    created_at: "2026-11-03T00:00:00Z",
  }));
  await page.route("https://m.media-amazon.com/images/sourcing-ratio-*.svg", (route) => {
    const index = Number(/ratio-(\d+)\.svg$/.exec(route.request().url())?.[1]);
    const size = formats[index].size;
    if (!size) return route.fulfill({ status: 404, body: "" });
    const [width, height] = size;
    return route.fulfill({
      contentType: "image/svg+xml",
      body:
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        width +
        '" height="' +
        height +
        '"><rect width="100%" height="100%" fill="#426587"/></svg>',
    });
  });
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope(records) }));
  for (const record of records) {
    await page.route("**/api/v1/sourcing/searches/" + record.id, (route) =>
      route.fulfill({ json: envelope({ ...record, candidates: [] }) }),
    );
  }
  await page.goto("/sourcing");
  const rows = page.locator(".sourcing-record-items > button");
  const preview = page.locator(".sourcing-detail > header .research-thumbnail");
  await expect(rows).toHaveCount(5);
  const readImage = (node: Element) => {
    const photo = node.querySelector("img");
    const { width, height } = node.getBoundingClientRect();
    if (!photo) return { frame: [width, height], photo: false };
    const css = getComputedStyle(photo);
    const rect = photo.getBoundingClientRect();
    const px = parseFloat(css.paddingInlineStart) + parseFloat(css.paddingInlineEnd);
    const py = parseFloat(css.paddingBlockStart) + parseFloat(css.paddingBlockEnd);
    const availableX = rect.width - px,
      availableY = rect.height - py;
    const scale = Math.min(availableX / photo.naturalWidth, availableY / photo.naturalHeight);
    const paintedW = photo.naturalWidth * scale,
      paintedH = photo.naturalHeight * scale;
    const position = css.objectPosition.split(" ").map(parseFloat);
    return {
      frame: [width, height],
      photo: true,
      fit: css.objectFit,
      position: css.objectPosition,
      scale,
      intact: paintedW <= availableX + 0.1 && paintedH <= availableY + 0.1,
      offsetY: (availableY - paintedH) * ((position[1] ?? 50) / 100 - 0.5),
    };
  };
  const measured = [];
  for (let i = 0; i < formats.length; i++) {
    await rows.nth(i).click();
    await expect(page.locator(".sourcing-detail > header h3")).toHaveText(formats[i].name);
    const thumb = rows.nth(i).locator(".research-thumbnail");
    if (formats[i].size) {
      await expect
        .poll(() =>
          preview.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth),
        )
        .toBe(formats[i].size![0]);
      await expect
        .poll(() => thumb.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth))
        .toBe(formats[i].size![0]);
    } else {
      await expect(preview.locator("img")).toHaveCount(0);
      await expect(thumb.locator("img")).toHaveCount(0);
      await expect(preview.locator("svg")).toBeVisible();
      await expect(thumb.locator("svg")).toBeVisible();
    }
    measured.push({
      detail: await preview.evaluate(readImage),
      list: await thumb.evaluate(readImage),
    });
  }
  console.log("SOURCING_ASPECT_FRAMES", JSON.stringify(measured));
  expect(measured.map((entry) => entry.detail.frame)).toEqual(Array(5).fill([188, 188]));
  expect(measured.map((entry) => entry.list.frame)).toEqual(Array(5).fill([68, 68]));
  expect(
    measured
      .slice(0, 3)
      .every((entry) => entry.detail.fit === "contain" && entry.detail.intact && entry.list.intact),
  ).toBe(true);
  expect(measured[0].detail.offsetY).toBeGreaterThan(0);
  expect(measured[0].detail.offsetY).toBeLessThan(9);
  expect(measured[1].detail.offsetY).toBeCloseTo(0);
  expect(measured[2].detail.offsetY).toBeCloseTo(0);
  expect(measured[0].list.position).toBe("50% 50%");
  await rows.first().click();
  await expect(preview.locator("img")).toHaveCSS("object-fit", "contain");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(preview.locator("img")).toHaveCSS("object-position", "50% 50%");
});

test("sourcing detail title stays inside the panel between the mobile and desktop breakpoints", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Explicit sourcing breakpoint probes");
  const title = "PortableStockKeepingIdentifier".repeat(6);
  await page.setViewportSize({ width: 601, height: 941 });
  await setup(page);
  const record = {
    id: searchId,
    input_type: "keyword",
    input_ref: title,
    display_name: title,
    status: "succeeded_empty",
    candidate_count: 0,
    missing_fields: [],
    created_at: "2026-11-03T00:00:00Z",
  };
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope([record]) }));
  await page.route("**/api/v1/sourcing/searches/" + searchId, (route) =>
    route.fulfill({ json: envelope({ ...record, candidates: [] }) }),
  );
  await page.goto("/sourcing");
  const heading = page.locator(".sourcing-detail > header h3");
  await expect(heading).toHaveText(title);
  for (const width of [601, 700, 760, 761, 840, 1101, 1672, 390, 600]) {
    await page.setViewportSize({ width, height: 941 });
    const geometry = await heading.evaluate((node) => {
      const bounds = node.closest("header")!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(node);
      const lines = [...range.getClientRects()];
      return {
        document: document.documentElement.scrollWidth,
        lines: lines.length,
        containsTitle: lines.every(
          (line) => line.left >= bounds.left - 1 && line.right <= bounds.right + 1,
        ),
      };
    });
    console.log("sourcing title containment", width, JSON.stringify(geometry));
    expect(geometry.document).toBeLessThanOrEqual(width);
    expect(geometry.containsTitle).toBe(true);
    expect(geometry.lines).toBeGreaterThan(1);
  }
});

test("wide sourcing progress keeps large counts inside the detail panel", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide sourcing progress tracks");
  await page.setViewportSize({ width: 1600, height: 900 });
  await setup(page);
  const count = 999999999;
  const search = {
    id: searchId,
    input_type: "keyword",
    input_ref: "便携净水杯",
    status: "succeeded_empty",
    candidate_count: 0,
    missing_fields: ["supplier_listing"],
    created_at: "2026-08-08T12:00:00.000Z",
  };
  await page.route(searchesRoute, (route) =>
    route.fulfill({ json: envelope([{ ...search, candidate_count: 0 }]) }),
  );
  await page.route("**/api/v1/sourcing/searches/" + searchId, (route) =>
    route.fulfill({
      json: envelope({
        ...search,
        candidates: [],
        collection_progress: {
          status: "failed",
          total_subqueries: 4 * count,
          successful_subqueries: count,
          failed_subqueries: count,
          blocked_subqueries: count,
          active_subqueries: count,
        },
      }),
    }),
  );
  await page.goto("/sourcing");
  const detail = page.locator(".sourcing-detail");
  const progress = page.getByRole("region", { name: "来源采集进度" });
  await expect(progress.locator("dd")).toHaveText(Array(4).fill(String(count)));
  for (const number of await progress.locator("dd").all()) {
    await expect(number).toHaveCSS("white-space", "nowrap");
  }
  const positions = await progress.evaluate((node) => {
    const bound = node.getBoundingClientRect();
    const numberBoxes = Array.from(node.querySelectorAll("dd"), (value) =>
      value.getBoundingClientRect(),
    );
    const ended = node.querySelector("header > span")!.getBoundingClientRect();
    return {
      right: bound.right,
      endedLeft: ended.left,
      endedRight: ended.right,
      countsRight: Math.max(...numberBoxes.map((value) => value.right)),
      contained: node.scrollWidth <= node.clientWidth + 1,
    };
  });
  expect(positions.contained).toBe(true);
  expect(positions.countsRight).toBeLessThan(positions.endedLeft);
  expect(positions.endedRight).toBeLessThanOrEqual(positions.right + 1);
  for (const width of [761, 840, 841, 950, 1000, 1100, 1101, 1280, 1440, 1560, 1600, 1672]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await detail.evaluate((node) => {
      const header = node.querySelector("header")!;
      const progress = header.querySelector(".sourcing-progress")!;
      const photo = header.querySelector(".research-thumbnail")!.getBoundingClientRect();
      const bar = progress.getBoundingClientRect();
      const label = progress.querySelector("header > span")!.getBoundingClientRect();
      const number = Array.from(progress.querySelectorAll("dd"), (value) =>
        value.getBoundingClientRect(),
      );
      return {
        compact: header.clientWidth <= 650,
        belowMedia: bar.top >= photo.bottom - 1,
        panelCoverage: Math.round((100 * bar.width) / header.clientWidth),
        identityGutter: header.querySelector("h3")!.getBoundingClientRect().left - photo.right,
        completionVisible: label.right <= bar.right + 1,
        valuesInside: number.every((box) => box.left >= bar.left - 1 && box.right <= bar.right + 1),
        noOverlap: number.every(
          (box) =>
            box.right <= label.left + 1 ||
            box.bottom <= label.top + 1 ||
            box.top >= label.bottom - 1,
        ),
        noOverflow: progress.scrollWidth <= progress.clientWidth + 1,
      };
    });
    expect(geometry.completionVisible, `width=${width}: completion label`).toBe(true);
    expect(geometry.valuesInside, `width=${width}: metric bounds`).toBe(true);
    expect(geometry.noOverlap, `width=${width}: no overlap`).toBe(true);
    expect(geometry.noOverflow, `width=${width}: progress overflow`).toBe(true);
    if (geometry.compact) {
      console.log(
        "sourcing progress uses full-width row",
        width,
        geometry.belowMedia,
        geometry.panelCoverage,
      );
      expect(geometry.belowMedia, `width=${width}: progress uses full row`).toBe(true);
      expect(geometry.panelCoverage, `width=${width}: progress width matches the header`).toBe(100);
      expect(geometry.identityGutter, `width=${width}: media-title gutter`).toBeCloseTo(16, 0);
    }
  }
  await expect(detail).toContainText("采集失败");
});

test("wide sourcing toolbar balances search and four metrics without changing mobile layout", async ({
  page,
}) => {
  await setup(page);
  await page.route(searchesRoute, (route) =>
    route.fulfill({
      json: {
        ...envelope([
          {
            id: searchId,
            input_type: "keyword",
            input_ref: "净水杯",
            status: "queued",
            candidate_count: 0,
            missing_fields: [],
            created_at: "2026-08-08T12:00:00Z",
          },
        ]),
        meta: {
          page: 1,
          page_size: 20,
          total: 945,
          summary: { total: 945, running: 138, candidates: 25100, ready: 343 },
        },
      },
    }),
  );
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/sourcing");
  const overview = page.locator(".sourcing-overview");
  const search = overview.getByRole("searchbox");
  const stats = overview.getByRole("term");
  await expect(stats).toHaveCount(4);
  const values = overview.locator(".sourcing-summary dd");
  await expect(values).toHaveCount(4);
  await expect(values).toHaveText(["945", "138", "25100", "343"]);
  for (const value of await values.all()) {
    await expect(value).toHaveCSS("font-size", "20px");
    await expect(value).toHaveCSS("font-weight", "700");
  }
  await expect(search).toHaveCSS("min-height", "40px");
  const searchBox = (await search.boundingBox())!;
  const overviewBox = (await overview.boundingBox())!;
  expect(searchBox.width).toBeLessThanOrEqual(304);
  // The 18px label gap shifts the control two pixels while preserving its width.
  expect(searchBox.x - overviewBox.x).toBeCloseTo(127, 0);
  const columns = () =>
    overview
      .locator(".sourcing-summary")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  await expect.poll(columns).toBe(4);
  const statsBox = (await overview.locator(".sourcing-summary").boundingBox())!;
  expect(Math.abs(statsBox.x - 1037)).toBeLessThanOrEqual(6);
  expect(statsBox.width).toBe(592);
  const labelStarts = await stats.evaluateAll((labels) =>
    labels.map((label) => Math.round(label.getBoundingClientRect().x)),
  );
  for (const [index, referenceX] of [1037, 1181, 1355, 1520].entries()) {
    expect(Math.abs(labelStarts[index] - referenceX)).toBeLessThanOrEqual(6);
  }
  const labelToValueGaps = await overview
    .locator(".sourcing-summary > div")
    .evaluateAll((groups) =>
      groups.map(
        (group) =>
          group.querySelector("dd")!.getBoundingClientRect().left -
          group.querySelector("dt")!.getBoundingClientRect().right,
      ),
    );
  expect(labelToValueGaps).toEqual([10, 10, 10, 10]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(columns).toBe(2);
  await expect(search).toBeVisible();
});

test("sourcing wide toolbar keeps search usable with large metric values", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  const large = Number.MAX_SAFE_INTEGER;
  await page.route(searchesRoute, (route) =>
    route.fulfill({
      json: {
        ...envelope([
          {
            id: searchId,
            input_type: "keyword",
            input_ref: "净水杯",
            status: "queued",
            candidate_count: 0,
            missing_fields: [],
            created_at: "2026-08-08T12:00:00Z",
          },
        ]),
        meta: {
          page: 1,
          page_size: 20,
          total: large,
          summary: { total: large, running: large - 1, candidates: large, ready: large - 2 },
        },
      },
    }),
  );
  await page.goto("/sourcing");
  const overview = page.locator(".sourcing-overview");
  const search = overview.getByRole("searchbox");
  const summary = overview.locator(".sourcing-summary");
  await expect(summary.locator("dd")).toHaveText([
    String(large),
    String(large - 1),
    String(large),
    String(large - 2),
  ]);
  const [box, searchBox, summaryBox] = await Promise.all([
    overview.boundingBox(),
    search.boundingBox(),
    summary.boundingBox(),
  ]);
  expect(searchBox!.width).toBeGreaterThanOrEqual(220);
  expect(summaryBox!.x + summaryBox!.width).toBeLessThan(box!.x + box!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("sourcing detail tabs switch by keyboard and expose only the active panel", async ({
  page,
}) => {
  const wide = page.viewportSize()!.width >= 1101;
  if (wide) await page.setViewportSize({ width: 1672, height: 941 });
  await setup(page);
  await page.goto("/sourcing");
  const tabs = page.getByRole("tablist", { name: "找货详情视图" });
  const offers = tabs.getByRole("tab", { name: "供应商报价" });
  await expect(offers).toHaveAttribute("aria-selected", "true");
  await expect(offers).toHaveCSS("font-size", wide ? "16px" : "13px");
  if (wide) {
    await expect(tabs).toHaveCSS("margin-block-start", "14px");
    await expect(tabs).toHaveCSS("column-gap", "4px");
    const unselected = tabs.getByRole("tab", { name: "成本与利润" });
    await expect(unselected).toHaveCSS("font-weight", "500");
    await expect(offers).toHaveCSS("font-weight", /^(650|700)$/);
    const selectedInk = await offers.evaluate((tab) => {
      const style = getComputedStyle(tab);
      return { color: style.color, underline: style.borderBottomColor };
    });
    expect(selectedInk.underline).toBe(selectedInk.color);
    await expect(unselected).toHaveCSS("border-bottom-color", "rgba(0, 0, 0, 0)");
    await expect(offers).toHaveCSS("line-height", "22px");
    for (const tab of await tabs.getByRole("tab").all())
      await expect(tab).toHaveCSS("width", "122px");
  }
  await offers.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "成本与利润" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "成本与利润" })).toContainText("未关联选品");
  await page.keyboard.press("End");
  await expect(tabs.getByRole("tab", { name: "报价历史" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "报价历史" })).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "供应商报价" })).toBeHidden();
  await page.keyboard.press("Home");
  await expect(offers).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "供应商报价" })).toBeVisible();
});

test("wide sourcing cost header wraps missing evidence without squeezing its analysis link", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide sourcing header layout");
  const field = "estimated_first_leg_charge_for_supplier_package".repeat(5);
  const profit = calculatedProfit(0);
  const { search, opportunityId } = await opportunitySetup(page, {
    ...profit,
    latest_run: { ...profit.latest_run, status: "insufficient_data", missing_fields: [field] },
  });
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, (route) =>
    route.fulfill({ json: envelope({ ...search, candidate_count: 0, candidates: [] }) }),
  );
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/sourcing");
  const panel = page.getByRole("tabpanel", { name: "供应商报价" });
  const costs = panel.getByRole("region", { name: "成本与利润摘要" });
  const unknown = costs.locator(".sourcing-profit-unconfirmed");
  const action = costs.getByRole("link", { name: "查看商品分析" });
  await expect(unknown).toContainText(field);
  await expect(costs.locator(".sourcing-profit-unconfirmed-breakdown dd")).toHaveText([
    "—",
    "—",
    "—",
    "—",
  ]);
  await expect(action).toHaveAttribute(
    "href",
    new RegExp(`^/opportunities/${opportunityId}\\?tab=profit`),
  );
  for (const width of [1600, 1672]) {
    await page.setViewportSize({ width, height: 941 });
    const [header, text, link] = await Promise.all(
      [costs.locator("header"), unknown, action].map((part) => part.boundingBox()),
    );
    expect(text!.height).toBeGreaterThan(40);
    expect(text!.x + text!.width).toBeLessThan(link!.x);
    expect(link!.x + link!.width).toBeLessThanOrEqual(header!.x + header!.width);
    await expect(unknown).toHaveCSS("overflow-wrap", "anywhere");
    await expect(action).toHaveCSS("white-space", "nowrap");
    await action.focus();
    await expect(action).toBeFocused();
  }
});

test("tablet sourcing keeps the title beside the photo and the progress below both", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Tablet workbench layout");
  await page.setViewportSize({ width: 601, height: 941 });
  await setup(page);
  const search = {
    id: searchId,
    input_type: "opportunity",
    input_ref: "00000000-0000-4000-8000-000000000001",
    display_name:
      "Long Amazon item title for a sourcing detail that wraps and keeps the photo visible",
    status: "succeeded_empty",
    candidate_count: 0,
    missing_fields: [],
    created_at: "2026-11-03T00:00:00Z",
  };
  const count = 999_999_999;
  await page.route(searchesRoute, (route) => route.fulfill({ json: envelope([search]) }));
  await page.route("**/api/v1/sourcing/searches/" + searchId, (route) =>
    route.fulfill({
      json: envelope({
        ...search,
        candidates: [],
        collection_progress: {
          status: "failed",
          total_subqueries: count * 4,
          successful_subqueries: count,
          active_subqueries: count,
          failed_subqueries: count,
          blocked_subqueries: count,
        },
      }),
    }),
  );
  await page.goto("/sourcing");
  const detail = page.locator(".sourcing-detail");
  await expect(detail.locator("h3")).toHaveText(search.display_name);
  await expect(detail.locator(".sourcing-progress dd")).toHaveText(Array(4).fill(String(count)));
  for (const width of [601, 700, 760]) {
    await page.setViewportSize({ width, height: 941 });
    const geometry = await detail.evaluate((node) => {
      const header = node.querySelector("header")!.getBoundingClientRect();
      const photo = node.querySelector(".research-thumbnail")!.getBoundingClientRect();
      const title = node.querySelector("h3")!.getBoundingClientRect();
      const progress = node.querySelector(".sourcing-progress")!.getBoundingClientRect();
      const counts = [...node.querySelectorAll(".sourcing-progress dd")].map((el) =>
        el.getBoundingClientRect(),
      );
      return {
        gutter: title.left - photo.right,
        photoWidth: photo.width,
        headerWidth: header.width,
        progressWidth: progress.width,
        photoSharesRow: title.top < photo.bottom,
        belowIdentity: progress.top >= Math.max(photo.bottom, title.bottom) - 1,
        fits: counts.every((box) => box.left >= progress.left && box.right <= progress.right + 1),
      };
    });
    console.log("TABLET_SOURCING_TRACKS", width, JSON.stringify(geometry));
    expect(geometry.gutter).toBeCloseTo(16, 0);
    expect(geometry.photoWidth).toBe(128);
    expect(geometry.progressWidth).toBeCloseTo(geometry.headerWidth, 0);
    expect(geometry.photoSharesRow && geometry.belowIdentity && geometry.fits).toBe(true);
  }
  await detail.screenshot({ path: testInfo.outputPath("sourcing-tablet-tracks.png") });
});
