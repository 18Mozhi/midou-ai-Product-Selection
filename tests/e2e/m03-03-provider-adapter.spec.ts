import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === origin && !url.pathname.startsWith("/api/")
      ? route.continue()
      : route.abort();
  });
});
const navigation = {
    shell: "platform_admin",
    organization_id: null,
    workspace_id: null,
    roles: [],
    capabilities: [],
    platform_roles: ["platform_super_admin"],
    platform_capabilities: [
      "platform:operate",
      "platform:secure",
      "platform:superadmin",
      "provider:configure",
    ],
    guard_reason: "navigation_platform_admin_allowed",
  },
  base = {
    provider_status: "disabled",
    last_checked_at: null,
    last_latency_ms: null,
    last_error_code: null,
    consecutive_failures: 0,
    latest_runtime_category: "unknown",
    runtime_sample_count_24h: 0,
    runtime_success_rate_basis_points_24h: null,
    runtime_duration_p95_ms_24h: null,
    runtime_network_failure_count_24h: 0,
    runtime_parser_failure_count_24h: 0,
    runtime_login_failure_count_24h: 0,
    runtime_empty_success_count_24h: 0,
    runtime_circuit_state: "closed",
    runtime_consecutive_failures: 0,
    runtime_failure_threshold: 5,
    runtime_error_budget_remaining: 5,
    runtime_last_error_code: null,
    runtime_circuit_opened_at: null,
    runtime_last_recovered_at: null,
    runtime_recovery_gate_met: false,
    compatibility_matrix: [],
    version: 0,
    updated_at: "1970-01-01T00:00:00.000Z",
  },
  items = [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000741",
      code: "public_signal_rss",
      name: "公开趋势 RSS",
      access_mode: "public_rss",
      adapter_registered: true,
      adapter_version: "rss-v1",
      health_status: "ready",
      last_checked_at: "2026-08-07T19:30:00.000Z",
      last_latency_ms: 84,
      version: 2,
      updated_at: "2026-08-07T19:30:00.000Z",
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000742",
      code: "market_login",
      name: "登录态商品来源",
      access_mode: "authenticated_browser",
      adapter_registered: false,
      adapter_version: null,
      health_status: "blocked",
      last_error_code: "adapter_not_registered",
      consecutive_failures: 1,
      runtime_circuit_state: "open",
      runtime_consecutive_failures: 3,
      runtime_failure_threshold: 3,
      runtime_error_budget_remaining: 0,
      runtime_last_error_code: "timeout",
      runtime_circuit_opened_at: "2026-08-07T19:29:00.000Z",
      version: 1,
    },
  ];
async function nav(page: any) {
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: navigation,
        request_id: "m03-03-nav",
        trace_id: "m03-03-nav",
      }),
    }),
  );
}
test("M03-03.A07/A08/A15 adapter matrix and health state are responsive and visual", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/provider-adapters", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: items,
        request_id: "m03-03-list",
        trace_id: "m03-03-list",
      }),
    }),
  );
  await page.route("**/api/v1/platform/provider-adapters/*/health-check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...items[1],
          health_status: "ready",
          last_checked_at: "2026-08-07T19:31:00.000Z",
          last_latency_ms: 0,
          last_error_code: null,
          runtime_recovery_gate_met: true,
          version: 2,
        },
        request_id: "m03-03-probe",
        trace_id: "m03-03-probe",
      }),
    }),
  );
  await page.goto("/platform-admin/providers/adapters");
  await expect(page.getByRole("heading", { name: "采集程序", level: 1 })).toBeVisible();
  await expect(page.getByText("统一采集、标准化与健康检查合同")).toBeVisible();
  const semanticText = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--p47-ink)";
    document.body.append(probe);
    const expected = getComputedStyle(probe).color,
      actual = [
        document.querySelector(".adapter-heading h2"),
        document.querySelector(".adapter-metrics strong"),
        document.querySelector(".adapter-table-wrap td"),
      ].map((element) => (element ? getComputedStyle(element).color : null));
    probe.remove();
    return { expected, actual };
  });
  expect(semanticText.actual).toEqual([
    semanticText.expected,
    semanticText.expected,
    semanticText.expected,
  ]);
  if (testInfo.project.name === "mobile-390") {
    await page.getByRole("button", { name: /登录态商品来源.*查看详情/ }).click();
    const dialog = page.getByRole("dialog", { name: "登录态商品来源" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("尚未登记适配器")).toBeVisible();
    await expect(dialog.getByText(/连续失败 3 \/ 阈值 3/)).toBeVisible();
    await expect(dialog.getByText(/晚于暂停时间/)).toBeVisible();
    await dialog.getByText("技术详情").click();
    await expect(dialog.getByText("adapter_not_registered")).toBeVisible();
    await dialog.getByRole("button", { name: "执行健康检查" }).click();
    await expect(dialog.getByRole("link", { name: "前往采集调度解除暂停" })).toBeVisible();
    await dialog.getByRole("button", { name: "关闭详情" }).click();
  } else {
    await expect(page.getByText("尚未登记适配器")).toBeVisible();
    await expect(page.getByText(/连续失败 3 \/ 阈值 3/)).toBeVisible();
    await page
      .locator(".adapter-table-wrap tbody tr")
      .filter({ hasText: "登录态商品来源" })
      .getByRole("button", { name: "健康检查", exact: true })
      .click();
    await expect(page.getByRole("link", { name: "前往解除暂停" })).toBeVisible();
  }
  await expect(page.locator(".adapter-message[role='status']")).toContainText("健康检查通过");
  await page.evaluate(() => window.scrollTo(0, 0));
});

test("P47 approved table controls are styled on desktop and stay hidden on mobile", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/provider-adapters", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: items,
        request_id: "p47-table-controls-list",
        trace_id: "p47-table-controls-list",
      }),
    }),
  );
  await page.goto("/platform-admin/providers/adapters");
  const desktop = page.locator(".responsive-data-view__desktop"),
    mobile = page.locator(".responsive-data-view__mobile");

  if (testInfo.project.name === "mobile-390") {
    await expect(desktop).toBeHidden();
    await expect(mobile).toBeVisible();
    return;
  }

  const controls = desktop,
    toolbar = controls.locator(".table-view-controls__toolbar"),
    columnMenu = toolbar.locator("details");
  await expect(controls).toBeVisible();
  await expect(toolbar.locator("summary")).toHaveCSS("min-height", "44px");
  await expect(toolbar.locator("button")).toHaveAttribute("aria-pressed", "true");
  await expect(controls).toHaveCSS("border-radius", "8px");
  await columnMenu.locator("summary").click();
  const fieldset = columnMenu.locator("fieldset");
  await expect(fieldset).toBeVisible();
  await expect(fieldset.locator("div")).toHaveCount(5);
  await expect(fieldset.locator("div").first()).toHaveCSS("min-height", "44px");
  await fieldset.getByLabel("切换第 3 列").uncheck();
  await expect(desktop.locator("table thead th").nth(2)).toBeHidden();
  await toolbar.locator("select").selectOption("compact");
  await expect(desktop.locator("table")).toHaveAttribute("data-table-density", "compact");
  await toolbar.locator("button").click();
  await expect(toolbar.locator("button")).toHaveAttribute("aria-pressed", "false");
});

test("M03-03.A08/A16 filters and empty results are explicit", async ({ page }, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/platform/provider-adapters", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: items,
        request_id: "m03-03-list",
        trace_id: "m03-03-list",
      }),
    }),
  );
  await page.goto("/platform-admin/providers/adapters");
  await page.getByText("更多筛选与排序", { exact: true }).click();
  await page.getByLabel("接入模式").selectOption("manual");
  await expect(
    page.getByRole("heading", {
      name:
        testInfo.project.name === "mobile-390"
          ? "当前筛选下没有匹配来源"
          : "没有符合筛选条件的适配器",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(
    page.getByText(
      testInfo.project.name === "mobile-390" ? "公开趋势 RSS · 健康" : "公开趋势 RSS",
      { exact: true },
    ),
  ).toBeVisible();
});
for (const cause of ["query", "provider-status", "registration", "combined"] as const) {
  test(`UI2-PR47 empty recovery resets all controls ${cause}`, async ({ page }, testInfo) => {
    await nav(page);
    let reads = 0;
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/platform/provider-adapters") && request.method() !== "GET")
        writes.push(request.url());
    });
    await page.route("**/api/v1/platform/provider-adapters", (route) => {
      reads += 1;
      return route.fulfill({
        json: {
          data: items.map((item) => ({ ...item, adapter_registered: true })),
          request_id: "ui2-pr47-list",
          trace_id: "ui2-pr47-list",
        },
      });
    });
    await page.goto("/platform-admin/providers/adapters");
    await expect(page.getByText("2 个结果", { exact: true })).toBeVisible();
    await page.getByText("更多筛选与排序", { exact: true }).click();
    await page.getByRole("combobox", { name: "排序", exact: true }).selectOption("recent");
    if (cause === "query" || cause === "combined")
      await page.getByLabel("搜索来源", { exact: true }).fill("no-such-adapter");
    if (cause === "provider-status" || cause === "combined")
      await page.getByRole("combobox", { name: "来源状态", exact: true }).selectOption("enabled");
    if (cause === "registration" || cause === "combined")
      await page
        .getByRole("combobox", { name: "登记状态", exact: true })
        .selectOption("unregistered");
    if (cause === "combined") {
      await page.getByRole("combobox", { name: "接入模式", exact: true }).selectOption("manual");
      await page.getByRole("combobox", { name: "健康状态", exact: true }).selectOption("degraded");
    }
    await expect(
      page.getByRole("heading", {
        name:
          testInfo.project.name === "mobile-390"
            ? "当前筛选下没有匹配来源"
            : "没有符合筛选条件的适配器",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "清除筛选", exact: true }).click();
    await expect(page.getByLabel("搜索来源", { exact: true })).toHaveValue("");
    for (const label of ["接入模式", "来源状态", "登记状态", "健康状态"])
      await expect(page.getByRole("combobox", { name: label, exact: true })).toHaveValue("all");
    await expect(page.getByRole("combobox", { name: "排序", exact: true })).toHaveValue(
      "attention",
    );
    await expect(page.getByText("2 个结果", { exact: true })).toBeVisible();
    await expect(page.getByText("第 1 / 1 页 · 每页 20 条", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name:
          testInfo.project.name === "mobile-390"
            ? "当前筛选下没有匹配来源"
            : "没有符合筛选条件的适配器",
      }),
    ).toHaveCount(0);
    expect(reads).toBe(1);
    expect(writes).toEqual([]);
  });
}

test("adapter catalog search, registration filter, reset and pagination bound the rendered rows", async ({
  page,
}, testInfo) => {
  await nav(page);
  const catalog = Array.from({ length: 45 }, (_, index) => ({
    ...base,
    id: `00000000-0000-4000-8000-${String(800000000000 + index).padStart(12, "0")}`,
    code: `catalog_source_${index + 1}`,
    name: `测试来源 ${String(index + 1).padStart(2, "0")}`,
    access_mode: index % 2 ? "public_page" : "public_rss",
    adapter_registered: index % 3 !== 0,
    adapter_version: index % 3 !== 0 ? "catalog-v1" : null,
    health_status: "unknown" as const,
  }));
  await page.route("**/api/v1/platform/provider-adapters", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: catalog, request_id: "catalog-list", trace_id: "catalog-list" }),
    }),
  );
  await page.goto("/platform-admin/providers/adapters");
  await expect(page.getByText("第 1 / 3 页 · 每页 20 条")).toBeVisible();
  const rendered =
    testInfo.project.name === "mobile-390"
      ? page.getByRole("button", { name: /查看详情/ })
      : page.locator(".adapter-table-wrap tbody tr");
  await expect(rendered).toHaveCount(20);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByText("第 2 / 3 页 · 每页 20 条")).toBeVisible();
  await page.getByLabel("搜索来源").fill("catalog_source_45");
  await expect(page.getByText("1 个结果")).toBeVisible();
  await expect(
    testInfo.project.name === "mobile-390"
      ? page.getByRole("button", { name: /测试来源 45.*查看详情/ })
      : page.getByText("测试来源 45", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重置" }).click();
  await expect(page.getByText("45 个结果")).toBeVisible();
  await page.getByText("更多筛选与排序", { exact: true }).click();
  await page.getByLabel("登记状态").selectOption("unregistered");
  await expect(page.getByText("15 个结果")).toBeVisible();
});
test("M03-03.A08/A09/A16 empty forbidden and dependency states stay actionable", async ({
  page,
}, testInfo) => {
  await nav(page);
  let status = 200;
  await page.route("**/api/v1/platform/provider-adapters", (route) =>
    route.fulfill(
      status === 200
        ? {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              data: [],
              request_id: "m03-03-empty",
              trace_id: "m03-03-empty",
            }),
          }
        : {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: status === 403 ? "authorization_denied" : "dependency_unavailable",
                message: "请求失败",
                action_hint: "按状态恢复",
              },
              request_id: `m03-03-${status}`,
              trace_id: `m03-03-${status}`,
            }),
          },
    ),
  );
  await page.goto("/platform-admin/providers/adapters");
  await expect(
    page.getByRole("heading", {
      name:
        testInfo.project.name === "mobile-390"
          ? "还没有可查看的来源"
          : "还没有来源可绑定适配器",
    }),
  ).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.getByRole("heading", { name: "你没有此项权限" })).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
});
