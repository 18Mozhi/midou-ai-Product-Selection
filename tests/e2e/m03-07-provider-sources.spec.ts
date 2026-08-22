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
  await expect(page.getByRole("heading", { name: "供应链找货" })).toBeVisible();
  await expect(page.getByText("解析验收")).toHaveCount(0);
  await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
  await expect(page.getByRole("heading", { name: "Amazon 登录页" })).toBeVisible();
  await expect(page.getByText("待配置", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "编辑采集设置" }).click();
  await expect(page.getByLabel("采集频率（分钟）")).toHaveValue("30");
  await expect(page.getByLabel("来源设置状态")).toHaveValue("disabled");
  await expect(page.getByRole("heading", { name: "调度同频与当前并发占用" })).toBeVisible();
  await page.getByRole("button", { name: "关闭来源编辑" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
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
  await expect(page.getByRole("status")).toContainText("来源设置已保存");
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
  await page.getByRole("button", { name: "解析兼容矩阵" }).click();
  const dialog = page.getByRole("dialog", { name: `解析器与页面版本 · ${item.name}` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("sha256:aaaaaaaaaaaa", { exact: true })).toBeVisible();
  await expect(dialog.getByText("structured-public-page-v1", { exact: true })).toBeVisible();
  await expect(dialog.getByText("已兼容", { exact: true })).toBeVisible();
  await expect(dialog.getByText("3 / 0", { exact: true })).toBeVisible();
  await expect(dialog.getByText(pageHash, { exact: true })).not.toBeVisible();
  await dialog.getByText("技术详情").click();
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
  await expect(page.getByRole("status")).toContainText("真实页面烟测已通过");
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

test("1688 acceptance shows the factual search detail and pagination coverage matrix", async ({
  page,
}) => {
  await nav(page, "platform_admin");
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
          parser_version: "1688-browser-contract-v1",
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
  await expect(page.getByRole("heading", { name: "搜索、详情与翻页矩阵" })).toBeVisible();
  await expect(page.getByText("搜索结果")).toBeVisible();
  await expect(page.getByText("商品详情", { exact: true })).toBeVisible();
  await expect(page.getByText("翻页覆盖")).toBeVisible();
  await expect(page.getByText("执行计划只允许 1 页，本次未演练翻页。")).toBeVisible();
  await expect(page.getByText("1688.search.v1 · 12 项")).toBeVisible();
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

test("fixed parser sample keeps an immutable second-person approval conclusion", async ({
  page,
}) => {
  await nav(page, "platform_admin");
  const provider = { ...setup[2], code: "1688_search" };
  const sampleId = "30000000-0000-4000-8000-000000000001";
  let reviewStatus: "pending" | "approved" = "pending",
    reviewBody: any = null;
  await page.route("**/api/v1/platform/provider-sources", (route) =>
    route.fulfill({ json: envelope([provider]) }),
  );
  await page.route(
    `**/api/v1/platform/provider-sources/${provider.provisioned.id}/parser-samples`,
    (route) =>
      route.fulfill({
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
      }),
  );
  await page.route(
    `**/api/v1/platform/provider-sources/${provider.provisioned.id}/parser-samples/${sampleId}/reviews`,
    async (route) => {
      reviewBody = route.request().postDataJSON();
      reviewStatus = "approved";
      await route.fulfill({ status: 201, json: envelope({ status: "approved" }) });
    },
  );
  await page.goto("/platform-admin/providers/sources");
  await page.getByRole("button", { name: "固定样本回放" }).click();
  await expect(page.getByRole("heading", { name: /固定样本回放/ })).toBeVisible();
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
  await expect(page.getByText("审批结论：字段基线与真实页面一致")).toBeVisible();
});
