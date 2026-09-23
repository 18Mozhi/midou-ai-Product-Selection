import { test, expect } from "@playwright/test";

const org = "00000000-0000-4000-8000-000000000b72",
  ws = "00000000-0000-4000-8000-000000000b73";
const navigation = (shell: "platform_admin" | "member") => ({
  shell,
  organization_id: shell === "member" ? org : null,
  workspace_id: shell === "member" ? ws : null,
  roles: shell === "member" ? ["member"] : [],
  capabilities: shell === "member" ? ["trend:read"] : [],
  platform_roles: shell === "platform_admin" ? ["platform_super_admin"] : [],
  platform_capabilities:
    shell === "platform_admin"
      ? ["platform:operate", "platform:superadmin", "provider:configure", "collection:replay"]
      : [],
  guard_reason: `navigation_${shell}_allowed`,
});
const automatic = Array.from({ length: 138 }, (_, index) => ({
  code: `crawler_${String(index + 1).padStart(3, "0")}`,
  name: `全球爬虫频道 ${index + 1}`,
  access_mode: index >= 136 ? "public_page" : "public_rss",
  target_url:
    index < 96 ? "https://news.google.com/rss" : `https://source-${index}.example.test/feed`,
  category: ["news", "ecommerce", "data", "community"][index % 4],
  availability: "automatic",
  policy_note: "公开 RSS/Atom 或固定页面爬虫，系统会自动采集并保留原文证据。",
  markets: ["GLOBAL"],
  languages: ["zh-CN"],
  fields: ["title", "url", "published_at"],
  concurrency_limit: 1,
  timeout_ms: 20000,
  retry_limit: 3,
  schedule_minutes: 15,
  provisioned: {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    status: "enabled",
    version: 1,
  },
}));
const setup = [
  "Amazon 登录页",
  "eBay 登录页",
  "1688 搜索",
  "TikTok Shop",
  "Reddit 登录页",
  "Similarweb 登录页",
].map((name, index) => ({
  code: `setup_${index}`,
  name,
  access_mode: "authenticated_browser",
  target_url: `https://login-${index}.example.test/`,
  category: index < 4 ? "ecommerce" : index === 4 ? "community" : "data",
  availability: "setup_required",
  policy_note: "来源已登记；配置自有账号浏览器档案后才会运行，不依赖官方 API。",
  markets: ["GLOBAL"],
  languages: ["zh-CN"],
  fields: ["title", "url"],
  concurrency_limit: 1,
  timeout_ms: 20000,
  retry_limit: 3,
  schedule_minutes: 30,
  provisioned: {
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    status: "disabled",
    version: 1,
    schedule_minutes: 30,
    timeout_ms: 20000,
    retry_limit: 3,
    updated_at: "2026-08-18T00:00:00.000Z",
  },
}));
const manual = [
  {
    code: "google_news_search",
    name: "Google News 手动关键词",
    access_mode: "public_rss",
    target_url: "https://news.google.com/rss/search",
    category: "news",
    availability: "manual",
    policy_note: "由用户输入关键词后立即采集。",
    markets: ["GLOBAL"],
    languages: ["zh-CN"],
    fields: ["title", "url", "published_at"],
    concurrency_limit: 1,
    timeout_ms: 20000,
    retry_limit: 3,
    schedule_minutes: 15,
    provisioned: {
      id: "20000000-0000-4000-8000-000000000001",
      status: "enabled",
      version: 1,
    },
  },
  {
    code: "manual_product_supply_csv",
    name: "商品与供应链 CSV 导入",
    access_mode: "import",
    target_url: "manual://product-supply-csv",
    category: "product_supply",
    availability: "manual",
    policy_note: "只处理用户明确上传的文件。",
    markets: ["GLOBAL"],
    languages: ["zh-CN"],
    fields: ["title", "url"],
    concurrency_limit: 1,
    timeout_ms: 20000,
    retry_limit: 3,
    schedule_minutes: 10080,
    provisioned: {
      id: "20000000-0000-4000-8000-000000000002",
      status: "disabled",
      version: 1,
    },
  },
];
const sources = [...automatic, ...setup, ...manual];
const envelope = (data: unknown) => ({
  data,
  request_id: "m03-07-e2e",
  trace_id: "m03-07-e2e",
});
async function nav(page: any, shell: "platform_admin" | "member") {
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({ json: envelope(navigation(shell)) }),
  );
}
async function catalog(page: any) {
  await page.route("**/api/v1/platform/provider-sources", (route) =>
    route.fulfill({ json: envelope(sources) }),
  );
}
async function openMobileSourceDetails(page: any, sourceName?: string) {
  const article = sourceName
    ? page.locator(".source-list article").filter({ hasText: sourceName }).first()
    : page.locator(".source-list article").first();
  const button = article.getByRole("button", { name: "查看来源详情" }).first();
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    await expect(button).toBeVisible();
    await button.click();
    await article.getByRole("button", { name: "返回来源目录" }).waitFor({ state: "visible" });
  }
}
async function openMobileFilters(page: any) {
  const button = page.getByRole("button", { name: "更多筛选与排序" });
  if (await button.isVisible()) await button.click();
}

test("M03-07.A07/A08/A15 novice catalog shows 100+ automatic setup and manual channels", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  await catalog(page);
  await page.goto("/platform-admin/providers/sources");
  await expect(page.getByRole("heading", { name: "多平台、多国家来源已自动登记" })).toBeVisible();
  await expect(page.getByText("138", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("已经替你配置好的部分")).toBeVisible();
  await expect(page.getByRole("heading", { name: "市场热点与消费者信号" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "商品与竞品观察" })).toBeVisible();
  await openMobileFilters(page);
  await page.getByLabel("业务类型").selectOption("product_supply");
  await expect(page.getByRole("heading", { name: "供应链找货" })).toBeVisible();
  await page.getByRole("button", { name: "重置筛选" }).click();
  await expect(page.getByText("解析验收")).toHaveCount(0);
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
  await expect(page.getByRole("heading", { name: "Amazon 登录页" })).toBeVisible();
  await expect(page.getByText("待配置", { exact: true }).last()).toBeVisible();
  await openMobileSourceDetails(page);
  await page.getByRole("button", { name: "编辑采集设置" }).click();
  await expect(page.getByLabel("采集频率（分钟）")).toHaveValue("30");
  await expect(page.getByLabel("来源设置状态")).toHaveValue("disabled");
  await expect(page.getByRole("heading", { name: "调度同频与当前并发占用" })).toBeVisible();
  await page.getByRole("button", { name: /关闭 .*采集设置/ }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
});

test("enabled Amazon and 1688 sources are shown as automatic instead of stale catalog setup labels", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  const enabledProductSources = [
    {
      ...manual[0],
      code: "amazon_product",
      name: "Amazon 商品页面",
      access_mode: "public_page",
      category: "ecommerce",
      schedule_minutes: 30,
      provisioned: {
        ...manual[0].provisioned,
        id: "30000000-0000-4000-8000-000000000001",
        code: "amazon_product",
        schedule_minutes: 30,
        timeout_ms: 20000,
        retry_limit: 2,
        updated_at: "2026-09-04T06:05:08.000Z",
        last_success: {
          task_id: "30000000-0000-4000-8000-000000000011",
          status: "succeeded",
          available_result_count: 1,
          finished_at: "2026-09-04T06:05:08.000Z",
        },
      },
    },
    {
      ...setup[2],
      code: "1688_search",
      name: "1688 搜索",
      category: "product_supply",
      provisioned: {
        ...setup[2].provisioned,
        id: "30000000-0000-4000-8000-000000000002",
        code: "1688_search",
        status: "enabled",
        last_success: {
          task_id: "30000000-0000-4000-8000-000000000012",
          status: "succeeded",
          available_result_count: 10,
          finished_at: "2026-09-04T06:16:00.000Z",
        },
      },
    },
  ];
  await page.route("**/api/v1/platform/provider-sources", (route) =>
    route.fulfill({ json: envelope(enabledProductSources) }),
  );

  await page.goto("/platform-admin/providers/sources?availability=automatic");
  const automaticCards = page.locator('.source-list article[data-availability="automatic"]');
  await expect(automaticCards).toHaveCount(2);
  await expect(automaticCards.getByText("自动采集", { exact: true })).toHaveCount(2);
  await expect(page.getByText("手工来源", { exact: true })).toHaveCount(0);
  await expect(page.getByText("待配置", { exact: true })).toHaveCount(0);
  await openMobileSourceDetails(page, "Amazon 商品页面");
  await expect(page.getByText(/系统按选品规则每 30 分钟抓取公开 Amazon 商品页/)).toBeVisible();
  const back = page.getByRole("button", { name: "返回来源目录" });
  if (await back.isVisible()) await back.click();
  await openMobileSourceDetails(page, "1688 搜索");
  await expect(page.getByText(/系统按选品规则每 30 分钟采集 1688 公开商品/)).toBeVisible();
});

test("source catalog paginates the real-size directory and preserves filter state in the URL", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  let reads = 0;
  await page.route("**/api/v1/platform/provider-sources", (route) => {
    reads += 1;
    return route.fulfill({ json: envelope(sources) });
  });
  await page.goto("/platform-admin/providers/sources");

  await expect(page.locator(".source-list article")).toHaveCount(20);
  await expect(page.getByRole("navigation", { name: "热点来源分页" })).toContainText(
    "第 1 / 8 页 · 当前 1–20，共 146 个来源",
  );
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("navigation", { name: "热点来源分页" })).toContainText("当前 21–40");

  await page.getByLabel("搜索来源").fill("Amazon");
  await expect(page.locator(".source-list article")).toHaveCount(1);
  await expect(page).toHaveURL(/q=Amazon/);
  await page.reload();
  await expect(page.getByLabel("搜索来源")).toHaveValue("Amazon");
  await expect(page.getByRole("heading", { name: "Amazon 登录页" })).toBeVisible();

  await page.getByLabel("搜索来源").fill("");
  await openMobileFilters(page);
  await page.getByLabel("准备状态").selectOption("setup_required");
  await page.getByLabel("排序").selectOption("attention");
  await expect(
    page.locator('.source-list article[data-availability="setup_required"]'),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "重置筛选" }).click();
  await expect(page.locator(".source-list article")).toHaveCount(20);
  await expect(page).not.toHaveURL(/q=|availability=|sort=/);

  await page.getByRole("button", { name: "刷新来源" }).click();
  await expect(page.getByRole("status").last()).toContainText("已刷新 146 个来源频道");
  expect(reads).toBeGreaterThanOrEqual(3);
});

test("mobile source filters fold and source details expand in-page without another read", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) > 760, "mobile-only source detail contract");
  await nav(page, "platform_admin");
  let reads = 0;
  await page.route("**/api/v1/platform/provider-sources", (route) => {
    reads += 1;
    return route.fulfill({ json: envelope(sources) });
  });
  await page.goto("/platform-admin/providers/sources");

  await expect(page.getByLabel("搜索来源")).toBeVisible();
  await expect(page.getByLabel("业务类型")).not.toBeVisible();
  await page.getByRole("button", { name: "更多筛选与排序" }).click();
  await expect(page.getByRole("button", { name: "收起筛选" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByLabel("业务类型")).toBeVisible();
  await page.getByRole("button", { name: "收起筛选" }).click();
  await expect(page.getByLabel("业务类型")).not.toBeVisible();

  const detail = page.getByRole("button", { name: "查看来源详情" }).first();
  await detail.click();
  const back = page.getByRole("button", { name: "返回来源目录" });
  await expect(back).toBeFocused();
  await expect(page.getByText("负责人", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "匿名测试" }).first()).toBeVisible();
  expect(reads).toBe(1);
  await back.click();
  await expect(detail).toBeFocused();
});

test("platform administrator can save source schedule, retry and enablement", async ({ page }) => {
  await nav(page, "platform_admin");
  await catalog(page);
  let updateBody: any = null;
  await page.route("**/api/v1/platform/provider-sources/**/configuration", async (route) => {
    updateBody = route.request().postDataJSON();
    expect(route.request().method()).toBe("PUT");
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({
      json: envelope({
        ...setup[0].provisioned,
        status: updateBody.status,
        schedule_minutes: updateBody.schedule_minutes,
        timeout_ms: updateBody.timeout_ms,
        retry_limit: updateBody.retry_limit,
        version: 2,
      }),
    });
  });
  await page.goto("/platform-admin/providers/sources");
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
  await openMobileSourceDetails(page);
  const editTrigger = page.getByRole("button", { name: "编辑采集设置" }).first();
  await editTrigger.click();
  const editDialog = page.getByRole("dialog", { name: /采集设置/ });
  const editTitle = editDialog.getByRole("heading", { name: /采集设置/ });
  await expect(editTitle).toBeFocused();
  await expect(page.locator(".source-center > .source-guide")).toHaveAttribute("inert", "");
  await expect(page.getByLabel("采集频率（分钟）")).toHaveAttribute(
    "aria-describedby",
    "source-edit-schedule-help",
  );
  await page.keyboard.press("Shift+Tab");
  await expect(editDialog.getByRole("button", { name: "保存配置" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(editDialog.getByRole("button", { name: /关闭.*采集设置/ })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(editDialog.getByRole("button", { name: "保存配置" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(editDialog).not.toBeVisible();
  await expect(page.locator(".source-center > .source-guide")).not.toHaveAttribute("inert");
  await expect(editTrigger).toBeFocused();
  await editTrigger.click();
  await page.getByLabel("采集频率（分钟）").fill("45");
  await page.getByLabel("来源设置状态").selectOption("enabled");
  await page.getByLabel("变更原因").fill("调整 Amazon 公开来源采集频率");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect
    .poll(() => updateBody)
    .toMatchObject({
      schedule_minutes: 45,
      status: "enabled",
      expected_version: 1,
      reason: "调整 Amazon 公开来源采集频率",
    });
  const saveFeedback = page.locator(".p48-source-configuration-save-feedback");
  await expect(saveFeedback).toHaveAttribute("data-stage", "success");
  await expect(saveFeedback).toContainText("采集设置已保存");
  await expect(editDialog.getByRole("heading", { name: "采集设置已保存" })).toBeFocused();
  await editDialog.getByRole("button", { name: "完成" }).click();
  await expect(page.locator(".p48-source-configuration-return")).toHaveAttribute(
    "data-state",
    "success",
  );
  await expect(page.locator(".p48-source-configuration-return")).toContainText(
    "设置已保存，来源目录已更新",
  );
});

test("configuration write remains confirmed when catalog reread fails and retry performs only GET", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  let catalogReads = 0;
  await page.route("**/api/v1/platform/provider-sources", async (route) => {
    catalogReads += 1;
    if (catalogReads === 2) {
      await route.fulfill({
        status: 500,
        json: {
          error: {
            code: "internal_error",
            message: "来源目录暂时未能读取。",
            action_hint: "可以重新读取来源目录。",
          },
          request_id: "m03-07-catalog-reread-failed",
          trace_id: "m03-07-catalog-reread-failed",
        },
      });
      return;
    }
    await route.fulfill({ json: envelope(sources) });
  });
  let putCount = 0;
  await page.route("**/api/v1/platform/provider-sources/**/configuration", async (route) => {
    putCount += 1;
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: envelope({
        ...automatic[0].provisioned,
        status: body.status,
        schedule_minutes: body.schedule_minutes,
        timeout_ms: body.timeout_ms,
        retry_limit: body.retry_limit,
        version: 2,
      }),
    });
  });

  await page.goto("/platform-admin/providers/sources");
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
  await openMobileSourceDetails(page);
  await page.getByRole("button", { name: "编辑采集设置" }).first().click();
  const dialog = page.getByRole("dialog", { name: /采集设置/ });
  await page.getByLabel("采集频率（分钟）").fill("45");
  await page.getByLabel("变更原因").fill("更新来源采集频率");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(dialog.locator(".p48-source-configuration-save-feedback")).toHaveAttribute(
    "data-stage",
    "success",
  );
  await dialog.getByRole("button", { name: "完成" }).click();
  const returnFeedback = page.locator(".p48-source-configuration-return");
  await expect(returnFeedback).toHaveAttribute("data-state", "failed");
  await expect(returnFeedback).toContainText("设置已保存，但来源目录尚未更新");
  await expect(returnFeedback).toContainText("刚才的写入不会撤销");
  await expect(returnFeedback.getByText("m03-07-catalog-reread-failed")).not.toBeVisible();
  await expect(page.locator(".source-list article").first()).toBeVisible();
  await returnFeedback.getByRole("button", { name: "重新读取来源目录" }).click();
  await expect(returnFeedback).toHaveAttribute("data-state", "success");
  await expect(returnFeedback.getByRole("heading")).toBeFocused();
  expect(catalogReads).toBe(3);
  expect(putCount).toBe(1);
});

test("failed smoke keeps the disabled configuration and never performs the enabling PUT", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  const smokeSource = {
    ...automatic[0],
    provisioned: {
      ...automatic[0].provisioned,
      status: "disabled",
      schedule_minutes: 15,
      timeout_ms: 20_000,
      retry_limit: 3,
      updated_at: "2026-08-20T02:00:00.000Z",
    },
  };
  await page.route("**/api/v1/platform/provider-sources", (route) =>
    route.fulfill({ json: envelope([smokeSource]) }),
  );
  let putCount = 0;
  await page.route("**/api/v1/platform/provider-sources/**/configuration", async (route) => {
    putCount += 1;
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: envelope({ ...smokeSource.provisioned, ...body, version: 2 }),
    });
  });
  let smokeCount = 0;
  await page.route("**/api/v1/platform/provider-adapters/**/health-check", async (route) => {
    smokeCount += 1;
    await route.fulfill({
      json: envelope({ health_status: "failed", last_error_code: "parser_mismatch" }),
    });
  });

  await page.goto("/platform-admin/providers/sources");
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("crawler_001");
  await openMobileSourceDetails(page);
  await page.getByRole("button", { name: "编辑采集设置" }).first().click();
  await page.getByLabel("运行状态").selectOption("enabled");
  await page.getByLabel("变更原因").fill("烟测失败时保留停用");
  await page.getByRole("button", { name: "烟测并启用" }).click();
  const dialog = page.getByRole("dialog", { name: /采集设置/ });
  const feedback = dialog.locator(".p48-source-configuration-save-feedback");
  await expect(feedback).toHaveAttribute("data-stage", "partial");
  await expect(feedback).toContainText("停用配置已保存，来源尚未启用");
  await expect(feedback).toContainText("parser_mismatch");
  expect(putCount).toBe(1);
  expect(smokeCount).toBe(1);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.locator(".p48-source-configuration-return")).toHaveAttribute(
    "data-outcome",
    "partial",
  );
  await expect(page.locator(".p48-source-configuration-return")).toContainText(
    "停用配置已保存，来源目录已更新",
  );
});

test("configuration version conflict closes only into a safe catalog reread", async ({ page }) => {
  await nav(page, "platform_admin");
  await catalog(page);
  let catalogReads = 0;
  await page.route("**/api/v1/platform/provider-sources", async (route) => {
    catalogReads += 1;
    await route.fulfill({ json: envelope(sources) });
  });
  let putCount = 0;
  await page.route("**/api/v1/platform/provider-sources/**/configuration", async (route) => {
    putCount += 1;
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "version_conflict",
          message: "配置版本已变化。",
          action_hint: "重新读取配置后再试。",
        },
        request_id: "m03-07-configuration-conflict",
        trace_id: "m03-07-configuration-conflict",
      },
    });
  });

  await page.goto("/platform-admin/providers/sources");
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
  await openMobileSourceDetails(page);
  await page.getByRole("button", { name: "编辑采集设置" }).first().click();
  const dialog = page.getByRole("dialog", { name: /采集设置/ });
  await page.getByLabel("变更原因").fill("按最新版本检查修改");
  await dialog.getByRole("button", { name: "保存配置" }).click();
  const feedback = dialog.locator(".p48-source-configuration-save-feedback");
  await expect(feedback).toHaveAttribute("data-stage", "conflict");
  await expect(feedback).toContainText("配置已经更新，请重新读取");
  await expect(feedback.getByRole("heading")).toBeFocused();
  await feedback.getByText("技术详情").click();
  await expect(feedback.getByText("m03-07-configuration-conflict")).toBeVisible();
  await dialog.getByRole("button", { name: "关闭后重新读取" }).click();
  await expect(page.locator(".p48-source-configuration-return")).toHaveAttribute(
    "data-outcome",
    "conflict",
  );
  await expect(page.locator(".p48-source-configuration-return")).toHaveAttribute(
    "data-state",
    "success",
  );
  expect(catalogReads).toBe(2);
  expect(putCount).toBe(1);
});

test("source detail shows parser and observed page-version compatibility", async ({ page }) => {
  await nav(page, "platform_admin");
  await catalog(page);
  const item = automatic[136],
    pageHash = "a".repeat(64);
  await page.route("**/api/v1/platform/provider-adapters", (route) =>
    route.fulfill({
      json: envelope([
        {
          id: item.provisioned.id,
          adapter_version: "structured-public-page-adapter-v1",
          compatibility_matrix: [
            {
              parser_version: "structured-public-page-v1",
              page_version_sha256: pageHash,
              status: "compatible",
              observation_count: 3,
              succeeded_count: 3,
              parser_failure_count: 0,
              last_observed_at: "2026-08-21T08:00:00.000Z",
            },
          ],
        },
      ]),
    }),
  );
  await page.goto("/platform-admin/providers/sources");
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill(item.name);
  await openMobileSourceDetails(page);
  const compatTrigger = page.getByRole("button", { name: "解析兼容矩阵" }).first();
  await compatTrigger.click();
  const dialog = page.getByRole("dialog", { name: `解析器与页面版本 · ${item.name}` });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: `解析器与页面版本 · ${item.name}` }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(compatTrigger).toBeFocused();
  await compatTrigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("sha256:aaaaaaaaaaaa", { exact: true })).toBeVisible();
  await expect(dialog.getByText("structured-public-page-v1", { exact: true })).toBeVisible();
  await expect(dialog.getByText("已兼容", { exact: true })).toBeVisible();
  await expect(dialog.getByText("3 / 0", { exact: true })).toBeVisible();
  await expect(dialog.getByText(pageHash, { exact: true })).not.toBeVisible();
  await dialog.getByText("完整指纹").click();
  await expect(dialog.getByText(pageHash, { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("public source is staged disabled, smoke-tested on the real page, then enabled", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  const smokeSource = {
      ...automatic[0],
      provisioned: {
        ...automatic[0].provisioned,
        status: "disabled",
        schedule_minutes: 15,
        timeout_ms: 20_000,
        retry_limit: 3,
        updated_at: "2026-08-20T02:00:00.000Z",
        concurrency_snapshot: { configured_limit: 1, active_subquery_count: 1 },
      },
    },
    bodies: any[] = [];
  await page.route("**/api/v1/platform/provider-sources", (route) =>
    route.fulfill({ json: envelope([smokeSource]) }),
  );
  await page.route("**/api/v1/platform/provider-sources/**/configuration", async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    await route.fulfill({
      json: envelope({
        ...smokeSource.provisioned,
        ...body,
        version: body.expected_version + 1,
      }),
    });
  });
  let smokeCount = 0;
  await page.route("**/api/v1/platform/provider-adapters/**/health-check", async (route) => {
    smokeCount += 1;
    await route.fulfill({
      json: envelope({ health_status: "ready", last_error_code: null }),
    });
  });

  await page.goto("/platform-admin/providers/sources");
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("crawler_001");
  await openMobileSourceDetails(page);
  await page.getByRole("button", { name: "编辑采集设置" }).click();
  await page.getByLabel("运行状态").selectOption("enabled");
  await expect(page.getByText("烟测失败不会启用来源")).toBeVisible();
  await expect(page.getByText("1 / 1， 剩余 0 个配置槽位")).toBeVisible();
  await page.getByLabel("变更原因").fill("真实页面烟测通过后启用");
  await page.getByRole("button", { name: "烟测并启用" }).click();

  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies.map((body) => [body.status, body.expected_version])).toEqual([
    ["disabled", 1],
    ["enabled", 2],
  ]);
  expect(smokeCount).toBe(1);
  const smokeDialog = page.getByRole("dialog", { name: /采集设置/ });
  await expect(smokeDialog.locator(".p48-source-configuration-save-feedback")).toHaveAttribute(
    "data-stage",
    "success",
  );
  await expect(smokeDialog.locator(".p48-source-configuration-save-feedback")).toContainText(
    "烟测通过，来源已启用",
  );
  await smokeDialog.getByRole("button", { name: "完成" }).click();
  await expect(page.locator(".p48-source-configuration-return")).toHaveAttribute(
    "data-state",
    "success",
  );
});

test("platform administrator can compare source configuration versions and restore one as a new version", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  await catalog(page);
  let rollbackBody: any = null;
  let currentVersion = 3;
  await page.route("**/api/v1/platform/provider-sources/**/configuration/versions", (route) =>
    route.fulfill({
      json: envelope({
        provider_id: setup[0].provisioned.id,
        current_version: currentVersion,
        versions: [
          ...(currentVersion === 4
            ? [
                {
                  version: 4,
                  action: "configuration_rolled_back",
                  created_at: "2026-08-20T04:00:00.000Z",
                  current: true,
                  rollback_available: false,
                  changes: [{ field: "schedule_minutes", before: 45, after: 30 }],
                },
              ]
            : []),
          {
            version: 3,
            action: "configuration_updated",
            created_at: "2026-08-20T03:00:00.000Z",
            current: currentVersion === 3,
            rollback_available: currentVersion === 4,
            changes: [{ field: "schedule_minutes", before: 30, after: 45 }],
          },
          {
            version: 1,
            action: "created",
            created_at: "2026-08-18T00:00:00.000Z",
            current: false,
            rollback_available: true,
            changes: [
              { field: "schedule_minutes", before: null, after: 30 },
              { field: "status", before: null, after: "disabled" },
            ],
          },
        ],
      }),
    }),
  );
  await page.route(
    "**/api/v1/platform/provider-sources/**/configuration/rollbacks",
    async (route) => {
      rollbackBody = route.request().postDataJSON();
      expect(route.request().method()).toBe("POST");
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      currentVersion = 4;
      await route.fulfill({ json: envelope({ ...setup[0].provisioned, version: 4 }) });
    },
  );
  await page.goto("/platform-admin/providers/sources");
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
  await openMobileSourceDetails(page);
  const versionsTrigger = page.getByRole("button", { name: "版本与回滚" }).first();
  await versionsTrigger.click();
  const versionsDialog = page.getByRole("dialog", { name: /版本、差异与回滚/ });
  await expect(versionsDialog.getByRole("heading", { name: /版本、差异与回滚/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(versionsDialog).not.toBeVisible();
  await expect(versionsTrigger).toBeFocused();
  await versionsTrigger.click();
  await expect(page.getByRole("heading", { name: /版本、差异与回滚/ })).toBeVisible();
  await expect(page.getByText("采集频率").first()).toBeVisible();
  await page.getByLabel("回滚原因").fill("恢复稳定采集设置");
  await page.getByRole("button", { name: "恢复此版本" }).click();
  await expect
    .poll(() => rollbackBody)
    .toEqual({
      target_version: 1,
      expected_version: 3,
      reason: "恢复稳定采集设置",
    });
  await expect(versionsDialog.locator(".p48-source-version-action-feedback")).toHaveAttribute(
    "data-stage",
    "success",
  );
  await expect(versionsDialog.locator(".p48-source-version-action-feedback")).toContainText(
    "已生成新的当前版本",
  );
  await expect(versionsDialog.getByText("第 4 版", { exact: true })).toBeVisible();
});

test("confirmed rollback is never resubmitted when catalog reread fails", async ({ page }) => {
  await nav(page, "platform_admin");
  let catalogReads = 0;
  await page.route("**/api/v1/platform/provider-sources", async (route) => {
    catalogReads += 1;
    if (catalogReads === 2) {
      await route.fulfill({
        status: 500,
        json: {
          error: {
            code: "internal_error",
            message: "来源目录暂时未能读取。",
            action_hint: "可以重新核对目录与历史。",
          },
          request_id: "m03-07-rollback-catalog-failed",
          trace_id: "m03-07-rollback-catalog-failed",
        },
      });
      return;
    }
    await route.fulfill({ json: envelope(sources) });
  });
  let currentVersion = 3;
  let versionReads = 0;
  await page.route(
    "**/api/v1/platform/provider-sources/**/configuration/versions",
    async (route) => {
      versionReads += 1;
      await route.fulfill({
        json: envelope({
          provider_id: setup[0].provisioned.id,
          current_version: currentVersion,
          versions: [
            ...(currentVersion === 4
              ? [
                  {
                    version: 4,
                    action: "configuration_rolled_back",
                    created_at: "2026-08-20T04:00:00.000Z",
                    current: true,
                    rollback_available: false,
                    changes: [{ field: "schedule_minutes", before: 45, after: 30 }],
                  },
                ]
              : []),
            {
              version: 3,
              action: "configuration_updated",
              created_at: "2026-08-20T03:00:00.000Z",
              current: currentVersion === 3,
              rollback_available: currentVersion === 4,
              changes: [{ field: "schedule_minutes", before: 30, after: 45 }],
            },
            {
              version: 1,
              action: "created",
              created_at: "2026-08-18T00:00:00.000Z",
              current: false,
              rollback_available: true,
              changes: [{ field: "schedule_minutes", before: null, after: 30 }],
            },
          ],
        }),
      });
    },
  );
  let rollbackCount = 0;
  await page.route(
    "**/api/v1/platform/provider-sources/**/configuration/rollbacks",
    async (route) => {
      rollbackCount += 1;
      currentVersion = 4;
      await route.fulfill({ json: envelope({ ...setup[0].provisioned, version: 4 }) });
    },
  );

  await page.goto("/platform-admin/providers/sources");
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
  await openMobileSourceDetails(page);
  await page.getByRole("button", { name: "版本与回滚" }).first().click();
  const dialog = page.getByRole("dialog", { name: /版本、差异与回滚/ });
  await page.getByLabel("回滚原因").fill("恢复稳定采集设置");
  await dialog.getByRole("button", { name: "恢复此版本" }).click();
  const feedback = dialog.locator(".p48-source-version-action-feedback");
  await expect(feedback).toHaveAttribute("data-stage", "sync_failed");
  await expect(feedback).toContainText("新版本已生成，来源目录尚未更新");
  await expect(dialog.locator(".configuration-version-list")).toContainText("第 3 版");
  await feedback.getByRole("button", { name: "重新核对目录与历史" }).click();
  await expect(feedback).toHaveAttribute("data-stage", "success");
  await expect(dialog.getByText("第 4 版", { exact: true })).toBeVisible();
  expect(catalogReads).toBe(3);
  expect(versionReads).toBe(2);
  expect(rollbackCount).toBe(1);
});

test("1688 acceptance shows the factual search detail and pagination coverage matrix", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  let acceptanceBody: any = null;
  await page.route("**/api/v1/org/memberships", (route) =>
    route.fulfill({
      json: envelope([
        {
          id: org,
          name: "一次性验收组织",
          slug: "acceptance-org",
          status: "active",
          default_workspace_id: ws,
          membership_status: "active",
        },
      ]),
    }),
  );
  await page.route(`**/api/v1/org/${org}/workspaces`, (route) =>
    route.fulfill({
      json: envelope([
        {
          id: ws,
          organization_id: org,
          name: "1688 验收工作区",
          slug: "1688-acceptance",
          status: "active",
          version: 1,
        },
      ]),
    }),
  );
  await page.route("**/api/v1/platform/provider-sources/**/replays", async (route) => {
    acceptanceBody = route.request().postDataJSON();
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({
      status: 202,
      json: envelope({
        task_id: "00000000-0000-4000-8000-000000001688",
        status: "scheduled",
      }),
    });
  });
  await page.route("**/api/v1/platform/provider-sources/1688-acceptance", (route) =>
    route.fulfill({
      json: envelope({
        provider_id: setup[2].provisioned.id,
        source_status: "disabled",
        owner_label: "平台来源中心",
        overall: "setup_required",
        gates: [
          {
            key: "login",
            state: "passed",
            evidence_at: "2026-08-21T07:12:00.000Z",
            reason: "当前有效浏览器档案已完成一次登录态运行。",
          },
          {
            key: "captcha",
            state: "passed",
            evidence_at: "2026-08-21T07:12:00.000Z",
            reason: "最近登录态运行未被验证码阻断。",
          },
          {
            key: "parser",
            state: "pending",
            evidence_at: null,
            reason: "需要用真实登录样本完成当前解析器版本回放。",
          },
        ],
        latest_run: {
          status: "succeeded",
          error_code: null,
          started_at: "2026-08-21T07:10:00.000Z",
          finished_at: "2026-08-21T07:12:00.000Z",
        },
        coverage_matrix: {
          parser_version: "1688-browser-contract-v3",
          observed_at: "2026-08-21T07:12:00.000Z",
          rows: [
            {
              key: "search",
              contract: "1688.search.v1",
              state: "covered",
              observed_count: 12,
              reason: "搜索快照通过当前合同，共 12 条。",
            },
            {
              key: "detail",
              contract: "1688.offer-detail.v1",
              state: "covered",
              observed_count: 3,
              reason: "商品详情快照全部通过当前合同，共 3 条。",
            },
            {
              key: "pagination",
              contract: "browser-plan-pagination-v1",
              state: "not_exercised",
              observed_count: 1,
              reason: "执行计划只允许 1 页，本次未演练翻页。",
            },
          ],
        },
        pending_reasons: ["需要用真实登录样本完成当前解析器版本回放。"],
      }),
    }),
  );
  await page.goto("/platform-admin/providers/sources/1688-acceptance");
  await expect(page.getByRole("heading", { name: "尚未满足启用条件" })).toBeVisible();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await expect(page.getByText("overall setup_required", { exact: true })).toBeHidden();
  await expect(page.getByRole("heading", { name: "搜索、详情与翻页矩阵" })).toBeVisible();
  await expect(page.getByText("搜索结果")).toBeVisible();
  await expect(page.getByText("商品详情", { exact: true })).toBeVisible();
  await expect(page.getByText("翻页覆盖")).toBeVisible();
  await expect(page.getByText("执行计划只允许 1 页，本次未演练翻页。")).toBeVisible();
  await expect(page.getByText("1688.search.v1 · 12 项")).toBeVisible();
  const acceptanceForm = page.locator(".acceptance-1688__start");
  await expect(acceptanceForm.getByLabel("组织", { exact: true })).toHaveValue(org);
  await expect(acceptanceForm.getByLabel("工作区", { exact: true })).toHaveValue(ws);
  await acceptanceForm.getByLabel("验收关键词").fill("桌面灯");
  await acceptanceForm.getByRole("button", { name: "发起登录验收运行" }).click();
  await expect
    .poll(() => acceptanceBody)
    .toEqual({
      organization_id: org,
      workspace_id: ws,
      query: "桌面灯",
      acceptance_run: true,
    });
  await expect(page.getByRole("status")).toContainText("登录验收运行已提交");
  const sampleLink = page.getByRole("link", { name: "定位 1688 固定样本" });
  await expect(sampleLink).toHaveAttribute(
    "href",
    `/platform-admin/providers/sources?provider_id=${setup[2].provisioned.id}`,
  );
  await page.getByText("技术详情", { exact: true }).click();
  await expect(page.getByText("overall setup_required", { exact: true })).toBeVisible();
});

test("1688 acceptance refresh keeps verified facts and suppresses duplicate reads on failure", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  let reads = 0;
  let releaseRefresh = () => {};
  const refreshBlocked = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const acceptance = {
    provider_id: setup[2].provisioned.id,
    source_status: "disabled",
    owner_label: "平台来源中心",
    overall: "setup_required",
    gates: [
      {
        key: "login",
        state: "pending",
        evidence_at: null,
        reason: "需要有效浏览器档案并完成一次登录态运行。",
      },
      {
        key: "captcha",
        state: "pending",
        evidence_at: null,
        reason: "尚无可证明验证码未阻断的成功登录态运行。",
      },
      {
        key: "parser",
        state: "pending",
        evidence_at: null,
        reason: "需要用真实登录样本完成当前解析器版本回放并通过人工审批。",
      },
    ],
    latest_run: null,
    coverage_matrix: {
      parser_version: "1688-browser-contract-v3",
      observed_at: null,
      rows: [
        {
          key: "search",
          contract: "1688.search.v1",
          state: "not_observed",
          observed_count: 0,
          reason: "尚无真实浏览器作业可验证搜索覆盖。",
        },
        {
          key: "detail",
          contract: "1688.offer-detail.v1",
          state: "not_observed",
          observed_count: 0,
          reason: "尚无真实浏览器作业可验证详情覆盖。",
        },
        {
          key: "pagination",
          contract: "browser-plan-pagination-v1",
          state: "not_observed",
          observed_count: 0,
          reason: "尚无真实浏览器作业可验证翻页覆盖。",
        },
      ],
    },
    pending_reasons: ["需要有效浏览器档案并完成一次登录态运行。"],
  };
  await page.route("**/api/v1/platform/provider-sources/1688-acceptance", async (route) => {
    reads += 1;
    if (reads === 1) return route.fulfill({ json: envelope(acceptance) });
    await refreshBlocked;
    return route.abort("internetdisconnected");
  });
  await page.goto("/platform-admin/providers/sources/1688-acceptance");
  await expect(page.getByRole("heading", { name: "尚未满足启用条件" })).toBeVisible();
  const refresh = page.locator(".acceptance-1688__refresh button");
  const pendingRefresh = refresh.click();
  await expect.poll(() => reads).toBe(2);
  await expect(refresh).toBeDisabled();
  await refresh.evaluate((button: HTMLButtonElement) => button.click());
  expect(reads).toBe(2);
  releaseRefresh();
  await pendingRefresh;
  await expect(page.getByRole("status")).toContainText("已保留上一次成功读取的启用条件");
  await expect(page.getByRole("heading", { name: "尚未满足启用条件" })).toBeVisible();
  await expect(refresh).toBeEnabled();
  expect(reads).toBeGreaterThanOrEqual(2);
});

test("M03-07.A08/A09 member can manually schedule immediate hotspot refresh", async ({ page }) => {
  await nav(page, "member");
  await page.route("**/api/v1/trends?**", (route) =>
    route.fulfill({
      json: { ...envelope([]), meta: { page: 1, page_size: 20, total: 0 } },
    }),
  );
  await page.route("**/api/v1/trends/monitoring-rules", (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  let body: any = null;
  await page.route("**/api/v1/provider-sources/refresh", async (route) => {
    body = route.request().postDataJSON();
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({
      status: 202,
      json: envelope({
        task_id: "00000000-0000-4000-8000-000000000b75",
        source_count: 138,
        status: "scheduled",
      }),
    });
  });
  await page.goto("/trends");
  await page.getByRole("button", { name: /立即刷新来源/ }).click();
  await expect.poll(() => body).toEqual({ organization_id: org, workspace_id: ws });
  await expect(page.getByText(/已开始从 138 个实时频道获取热点/)).toBeVisible();
});

test("M03-07.A08/A16 forbidden and dependency states are truthful", async ({ page }) => {
  await nav(page, "platform_admin");
  let status = 403;
  await page.route("**/api/v1/platform/provider-sources", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: status === 403 ? "authorization_denied" : "dependency_unavailable",
          message: "请求失败",
          action_hint: "按状态恢复",
        },
        request_id: `m03-07-${status}`,
        trace_id: `m03-07-${status}`,
      }),
    }),
  );
  await page.goto("/platform-admin/providers/sources");
  await expect(page.locator('[data-kind="forbidden"]')).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.locator('[data-kind="blocked"]')).toBeVisible();
});

test("fixed parser sample keeps an immutable second-person approval conclusion", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  const provider = { ...setup[2], code: "1688_search" };
  const sampleId = "30000000-0000-4000-8000-000000000001";
  let reviewStatus: "pending" | "approved" = "pending",
    reviewBody: any = null,
    sampleReads = 0,
    reviewWrites = 0,
    failedReviewReads = 0;
  await page.route("**/api/v1/platform/provider-sources", (route) =>
    route.fulfill({ json: envelope([provider]) }),
  );
  await page.route(
    `**/api/v1/platform/provider-sources/${provider.provisioned.id}/parser-samples`,
    async (route) => {
      sampleReads += 1;
      if (reviewWrites > 0 && failedReviewReads < 3) {
        failedReviewReads += 1;
        await route.fulfill({
          status: 503,
          json: {
            error: {
              code: "sample_read_unavailable",
              message: "样本列表暂时不可用",
              action_hint: "样本列表暂未能更新。",
            },
            request_id: `sample-read-after-review-503-${failedReviewReads}`,
            trace_id: `sample-read-after-review-503-${failedReviewReads}`,
          },
        });
        return;
      }
      await route.fulfill({
        json: envelope({
          candidates: [],
          samples: [
            {
              id: sampleId,
              name: "1688 搜索真实样本",
              baseline_parser_version: "1688.search.v1",
              last_replay_status: "passed",
              last_replay_at: "2026-08-22T12:00:00.000Z",
              review_status: reviewStatus,
              reviewed_by: reviewStatus === "approved" ? "另一位来源管理员" : null,
              review_reason: reviewStatus === "approved" ? "字段基线与真实页面一致" : null,
              reviewed_at: reviewStatus === "approved" ? "2026-08-22T12:10:00.000Z" : null,
              review_version: reviewStatus === "approved" ? 2 : 1,
              created_by: "30000000-0000-4000-8000-000000000002",
              can_review: reviewStatus === "pending",
              created_at: "2026-08-22T11:00:00.000Z",
            },
          ],
        }),
      });
    },
  );
  await page.route(
    `**/api/v1/platform/provider-sources/${provider.provisioned.id}/parser-samples/${sampleId}/reviews`,
    async (route) => {
      reviewWrites += 1;
      reviewBody = route.request().postDataJSON();
      reviewStatus = "approved";
      await route.fulfill({ status: 201, json: envelope({ status: "approved" }) });
    },
  );
  await page.goto("/platform-admin/providers/sources");
  await openMobileSourceDetails(page);
  const samplesTrigger = page.getByRole("button", { name: "固定样本回放" }).first();
  await samplesTrigger.click();
  const samplesDialog = page.getByRole("dialog", { name: /固定样本回放/ });
  await expect(samplesDialog.getByRole("heading", { name: /固定样本回放/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(samplesDialog).not.toBeVisible();
  await expect(samplesTrigger).toBeFocused();
  await samplesTrigger.click();
  await expect(samplesDialog).toBeVisible();
  await expect(page.getByText("一致通过 · 待另一管理员审批")).toBeVisible();
  await page.getByLabel("审批原因").fill("字段基线与真实页面一致");
  await page.getByRole("button", { name: "审批通过" }).click();
  await expect
    .poll(() => reviewBody)
    .toMatchObject({
      decision: "approved",
      reason: "字段基线与真实页面一致",
      expected_version: 1,
    });
  await expect.poll(() => failedReviewReads).toBe(3);
  await expect(
    samplesDialog.getByText("复核决定已记录，但样本列表暂未能更新。", { exact: true }),
  ).toBeVisible();
  await expect(samplesDialog.getByText("最新样本列表暂未更新")).toBeVisible();
  await samplesDialog.getByText("读取追踪").click();
  await expect(samplesDialog.getByText("sample-read-after-review-503-3")).toBeVisible();
  await expect(samplesDialog.getByText("一致通过 · 待另一管理员审批")).toBeVisible();
  const readsBeforeRetry = sampleReads;
  await samplesDialog.getByRole("button", { name: "重新读取固定样本" }).click();
  await expect(page.getByText("审批结论：字段基线与真实页面一致")).toBeVisible();
  expect(sampleReads).toBe(readsBeforeRetry + 1);
  expect(reviewWrites).toBe(1);
});
