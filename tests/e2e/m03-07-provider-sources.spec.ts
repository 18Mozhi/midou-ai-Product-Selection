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
      ? ["platform:operate", "platform:superadmin", "provider:configure"]
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

test("M03-07.A07/A08/A15 novice catalog shows 100+ automatic setup and manual channels", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  await catalog(page);
  await page.goto("/platform-admin/providers/sources");
  await expect(page.getByRole("heading", { name: "多平台、多国家来源已自动登记" })).toBeVisible();
  await expect(page.getByText("138", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("已经替你配置好的部分")).toBeVisible();
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
  await expect(page.getByRole("heading", { name: "Amazon 登录页" })).toBeVisible();
  await expect(page.getByText("需登录并验收解析", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "编辑采集设置" }).click();
  await expect(page.getByLabel("采集频率（分钟）")).toHaveValue("30");
  await expect(page.getByLabel("来源设置状态（解析验收前不会自动采集）")).toHaveValue("disabled");
  await page.getByRole("button", { name: "关闭来源编辑" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("m03-07-provider-sources.png", {
    fullPage: true,
  });
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
  await page.getByRole("button", { name: "编辑采集设置" }).click();
  await page.getByLabel("采集频率（分钟）").fill("45");
  await page.getByLabel("来源设置状态（解析验收前不会自动采集）").selectOption("enabled");
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
  await expect(page.getByRole("status")).toContainText("来源设置已保存");
});

test("platform administrator can compare source configuration versions and restore one as a new version", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  await catalog(page);
  let rollbackBody: any = null;
  await page.route("**/api/v1/platform/provider-sources/**/configuration/versions", (route) =>
    route.fulfill({
      json: envelope({
        provider_id: setup[0].provisioned.id,
        current_version: 3,
        versions: [
          {
            version: 3,
            action: "configuration_updated",
            created_at: "2026-08-20T03:00:00.000Z",
            current: true,
            rollback_available: false,
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
      await route.fulfill({ json: envelope({ ...setup[0].provisioned, version: 4 }) });
    },
  );
  await page.goto("/platform-admin/providers/sources");
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
  await page.getByRole("button", { name: "版本与回滚" }).click();
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
  await expect(page.getByRole("status")).toContainText("生成新的当前版本");
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
  await page.getByRole("button", { name: /立即获取热点/ }).click();
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
