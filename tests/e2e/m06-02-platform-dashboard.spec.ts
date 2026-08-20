import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const env = (data: any) => ({ data, request_id: "m06-02-e2e", trace_id: "m06-02-e2e" }),
  dashboard = {
    window: "24h",
    summary: {
      active_organizations: 42,
      active_users: 318,
      enabled_providers: 3,
      task_success_rate: 96.4,
      queue_backlog: 7,
      open_alerts: 2,
      storage_bytes: 734003200,
      file_growth_bytes: 12582912,
    },
    queues: [
      { status: "queued", total: 5 },
      { status: "retry_scheduled", total: 2 },
    ],
    provider_health: [
      {
        id: "p1",
        code: "news_rss",
        name: "公开趋势 RSS",
        status: "healthy",
        observed_count: 28,
        success_count: 28,
        failed_count: 0,
        last_observed_at: "2026-08-08T11:50:00.000Z",
      },
      {
        id: "p2",
        code: "supplier",
        name: "供应商公开页",
        status: "degraded",
        observed_count: 12,
        success_count: 10,
        failed_count: 2,
        last_observed_at: "2026-08-08T11:40:00.000Z",
      },
      {
        id: "p3",
        code: "new",
        name: "待观测来源",
        status: "unknown",
        observed_count: 0,
        success_count: 0,
        failed_count: 0,
        last_observed_at: null,
      },
    ],
    task_trend: [],
    health_signals: [
      { code: "mysql", status: "healthy", value: "query_succeeded" },
      { code: "queue", status: "healthy", value: 7 },
      { code: "data_quality", status: "warning", value: 1 },
    ],
    alerts: [
      {
        id: "a1",
        organization_id: "00000000-0000-4000-8000-000000000601",
        workspace_id: "00000000-0000-4000-8000-000000000602",
        kind: "quality",
        severity: "warning",
        code: "title_accuracy",
        observed_at: "2026-08-08T11:45:00.000Z",
      },
    ],
    activity: [],
    observed_at: "2026-08-08T12:00:00.000Z",
  };
async function nav(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (r) =>
    r.fulfill({
      json: env({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_operations_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "navigation_platform_admin_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/me/ui-preferences", (r) =>
    r.fulfill({
      json: env({ theme: "dark", density: "comfortable", motion_enabled: true, version: 1 }),
    }),
  );
}
test("M06-02.A07/A08/A15 desktop and 390 cockpit use factual states", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/dashboard?**", (r) => r.fulfill({ json: env(dashboard) }));
  await page.goto("/platform-admin");
  await expect(
    page.getByRole("heading", { name: "平台现在怎么样，一眼看懂", level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /等待处理 7/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /需要关注 2/ })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    await expect(page.getByText("待观测来源 · 未知", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByText("待观测来源", { exact: true })).toBeVisible();
    await expect(page.getByText("未知", { exact: true })).toBeVisible();
  }
  await expect(page.getByText("数据库", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /检查来源是否启用/ })).toBeVisible();
  await expect(page).toHaveScreenshot("m06-02-platform-dashboard-desktop.png", { fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("查看排队、运行或受阻的采集任务 →")).toBeVisible();
  await page.getByRole("button", { name: "查看详情" }).first().click();
  const dialog = page.getByRole("dialog", { name: "公开趋势 RSS" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("技术详情").click();
  await expect(dialog.getByText("p1", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "关闭详情" }).click();
  await expect(page).toHaveScreenshot("m06-02-platform-dashboard-mobile-390.png", {
    fullPage: true,
  });
});
test("M06-02.A08/A16 empty forbidden and dependency states recover truthfully", async ({
  page,
}) => {
  await nav(page);
  let status = 200;
  await page.route("**/api/v1/platform/dashboard?**", (r) =>
    r.fulfill(
      status === 200
        ? { json: env({ ...dashboard, queues: [], provider_health: [], alerts: [] }) }
        : {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: status === 403 ? "permission_denied" : "dependency_unavailable",
                message: "failed",
                action_hint: "按状态恢复",
              },
              request_id: `m06-02-${status}`,
              trace_id: `m06-02-${status}`,
            }),
          },
    ),
  );
  await page.goto("/platform-admin");
  await expect(page.getByRole("heading", { name: "这段时间还没有采集记录" })).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.getByRole("heading", { name: "当前账号不能进入平台管理后台" })).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByRole("heading", { name: "管理首页暂时无法读取数据" })).toBeVisible();
});

test("platform completion renders trend and management without overflow or console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await nav(page);
  await page.route("**/api/v1/platform/dashboard?**", (route) =>
    route.fulfill({
      json: env({
        ...dashboard,
        task_trend: [
          { bucket: "2026-08-08T10:00:00.000Z", succeeded: 8, failed: 2 },
          { bucket: "2026-08-08T11:00:00.000Z", succeeded: 14, failed: 1 },
          { bucket: "2026-08-08T12:00:00.000Z", succeeded: 21, failed: 0 },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: env({
        domain: "content",
        summary: { total: 1, active: 1, review: 0 },
        items: [
          {
            id: "00000000-0000-4000-8000-000000000701",
            title: "便携式照明热度上升",
            category: "home",
            market: "US",
            language: "en-US",
            status: "active",
            signal_count: 18,
            source_count: 5,
            heat_value: 82,
            confidence_status: "measured",
            version: 1,
            last_seen_at: "2026-08-08T12:00:00.000Z",
            organization_name: "米豆选品",
            workspace_name: "默认工作区",
          },
        ],
        observed_at: "2026-08-08T12:00:00.000Z",
      }),
    }),
  );
  await page.goto("/platform-admin");
  await expect(page.getByLabel("采集任务成功和失败趋势折线图")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.goto("/platform-admin/content");
  await expect(page.getByRole("heading", { name: "内容管理", level: 2 })).toBeVisible();
  await expect(page.getByText("便携式照明热度上升")).toBeVisible();
  await page.getByRole("button", { name: "无关" }).click();
  await expect(page.getByRole("heading", { name: "审核热点内容" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "内容管理", level: 2 })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  expect(errors).toEqual([]);
});

test("platform completion exposes data governance notifications and user-panel switch", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) => {
    const domain = new URL(route.request().url()).searchParams.get("domain");
    const data =
      domain === "data"
        ? {
            domain,
            summary: { total: 1, active: 1 },
            items: [
              {
                id: "trend-1",
                title: "便携照明趋势",
                organization_name: "米豆选品",
                workspace_name: "默认工作区",
                category: "home",
                market: "US",
                status: "active",
                metric_primary: 18,
                metric_secondary: 5,
                updated_at: "2026-08-18T12:00:00.000Z",
              },
            ],
            observed_at: "2026-08-18T12:00:00.000Z",
          }
        : domain === "governance"
          ? {
              domain,
              summary: {
                score_rules: 1,
                cost_rules: 0,
                approval_templates: 0,
                automation_rules: 1,
                releases: 0,
                provider_versions: 2,
              },
              score_rules: [
                {
                  id: "rule-1",
                  name: "标准评分规则",
                  version_code: "score-v1",
                  organization_name: "米豆选品",
                  workspace_name: "默认工作区",
                  status: "active",
                  revision: 1,
                  updated_at: "2026-08-18T12:00:00.000Z",
                },
              ],
              cost_rules: [],
              approval_templates: [],
              automation_rules: [
                {
                  id: "auto-1",
                  name: "竞品降价提醒",
                  trigger_event_type: "competitor.changed",
                  status: "enabled",
                  version: 1,
                  updated_at: "2026-08-18T12:00:00.000Z",
                },
              ],
              releases: [],
              provider_versions_latest_at: "2026-08-18T12:00:00.000Z",
            }
          : {
              domain: "notifications",
              summary: { total: 1, unread: 1, critical: 0 },
              messages: [],
              templates: [
                {
                  category: "task",
                  title: "任务状态通知",
                  event_pattern: "task.*",
                  status: "active",
                },
              ],
              channels: [
                {
                  code: "in_app",
                  name: "站内通知",
                  status: "enabled",
                  deliveries: [{ status: "delivered", total: 1 }],
                },
              ],
              subscriptions: { in_app: 3, email: 0, disabled: 0 },
              alert_routes: [
                {
                  id: "route-1",
                  name: "竞品变更提醒",
                  event_type: "competitor.changed",
                  action_type: "notify",
                  status: "enabled",
                },
              ],
              items: [
                {
                  id: "notice-1",
                  title: "采集任务完成",
                  recipient_email: "member@example.test",
                  organization_name: "米豆选品",
                  category: "task",
                  severity: "info",
                  read_at: null,
                  delivery_status: "delivered",
                  created_at: "2026-08-18T12:00:00.000Z",
                },
              ],
              observed_at: "2026-08-18T12:00:00.000Z",
            };
    return route.fulfill({ json: env(data) });
  });

  await page.goto("/platform-admin/data");
  await expect(page.getByRole("heading", { name: "全量业务数据", level: 2 })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(page.getByRole("button", { name: /^便携照明趋势 · 展示中/ })).toBeVisible();
  else await expect(page.getByText("便携照明趋势", { exact: true })).toBeVisible();
  await expect(page.getByText("trend-1", { exact: true })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "进入用户工作台" })).toHaveAttribute("href", "/home");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: "筛选全量数据" }).click();
    const dataFilters = page.getByRole("dialog", { name: "筛选全量数据" });
    await dataFilters.getByPlaceholder("搜索名称、组织或工作区").fill("便携");
    await dataFilters.getByLabel("记录状态").selectOption("active");
    await dataFilters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /筛选全量数据.*2 项已选/ }).click();
    await expect(dataFilters.getByPlaceholder("搜索名称、组织或工作区")).toHaveValue("便携");
    await expect(dataFilters.getByLabel("记录状态")).toHaveValue("active");
    await dataFilters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /^便携照明趋势 · 展示中/ }).click();
    const dataDialog = page.getByRole("dialog", { name: "便携照明趋势" });
    await dataDialog.getByText("技术详情").click();
    await expect(dataDialog.getByText("trend-1", { exact: true })).toBeVisible();
    await dataDialog.getByRole("button", { name: "关闭详情" }).click();
  }

  await page.goto("/platform-admin/governance");
  await expect(page.getByRole("heading", { name: "规则、工作流与自动化", level: 2 })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(page.getByRole("button", { name: /^标准评分规则 · 启用/ })).toBeVisible();
  else await expect(page.getByText("标准评分规则", { exact: true })).toBeVisible();
  await expect(page.getByText("score-v1", { exact: true })).not.toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: "筛选治理记录" }).click();
    const governanceFilters = page.getByRole("dialog", { name: "筛选治理记录" });
    await governanceFilters.getByPlaceholder("搜索规则、版本、组织或工作区").fill("标准");
    await governanceFilters.getByLabel("治理状态").selectOption("active");
    await governanceFilters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /筛选治理记录.*2 项已选/ }).click();
    await expect(governanceFilters.getByPlaceholder("搜索规则、版本、组织或工作区")).toHaveValue(
      "标准",
    );
    await expect(governanceFilters.getByLabel("治理状态")).toHaveValue("active");
    await governanceFilters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /^标准评分规则 · 启用/ }).click();
    const governanceDialog = page.getByRole("dialog", { name: "标准评分规则" });
    await governanceDialog.getByText("技术详情").click();
    await expect(governanceDialog.getByText("rule-1", { exact: true })).toBeVisible();
    await governanceDialog.getByRole("button", { name: "关闭详情" }).click();
  }
  await page.getByRole("button", { name: "自动化规则" }).click();
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(page.getByRole("button", { name: /^竞品降价提醒 · 启用/ })).toBeVisible();
  else await expect(page.getByText("竞品降价提醒", { exact: true })).toBeVisible();
  await expect(page.getByText("enabled", { exact: true })).toHaveCount(0);

  await page.goto("/platform-admin/notifications");
  await expect(page.getByRole("heading", { name: "通知管理", level: 2 })).toBeVisible();
  await expect(page.getByText("任务状态通知")).toBeVisible();
  await expect(page.getByText("member@example.test")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "通知管理", level: 2 })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  expect(errors).toEqual([]);
});

test("system status aggregates real operations observations and management links", async ({
  page,
}) => {
  await nav(page);
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: env({
        domain: "status",
        summary: {
          api: "ready",
          database: "healthy",
          dashboard_reads: 5,
          active_organizations: 2,
          active_users: 8,
        },
        services: [
          {
            code: "api",
            name: "Node API",
            status: "ready",
            detail: "0.1.0 · abcdef123456",
            observed_at: "2026-08-18T12:00:00.000Z",
            href: "/platform-admin/topology",
          },
          {
            code: "mysql",
            name: "MySQL",
            status: "healthy",
            detail: "最近一次韧性检查",
            observed_at: "2026-08-18T12:00:00.000Z",
            href: "/platform-admin/mysql",
          },
          {
            code: "redis",
            name: "Redis",
            status: "warning",
            detail: "最近一次韧性检查",
            observed_at: "2026-08-18T11:59:00.000Z",
            href: "/platform-admin/redis",
          },
          {
            code: "files",
            name: "文件存储",
            status: "stale",
            detail: "最近一次存储检查",
            observed_at: "2026-08-18T10:00:00.000Z",
            href: "/platform-admin/files",
          },
          {
            code: "worker",
            name: "Node Worker",
            status: "ready",
            detail: "1 个实例 · 1 个活动任务",
            observed_at: "2026-08-18T12:00:00.000Z",
            href: "/platform-admin/crawler-scheduler",
          },
          {
            code: "crawler",
            name: "Python Crawler",
            status: "ready",
            detail: "1 个实例 · 0 个活动运行",
            observed_at: "2026-08-18T12:00:00.000Z",
            href: "/platform-admin/crawler-scheduler",
          },
        ],
        collections: [{ status: "running", total: 1 }],
        sources: [{ status: "enabled", total: 138 }],
        observed_at: "2026-08-18T12:00:00.000Z",
      }),
    }),
  );
  await page.goto("/platform-admin/status");
  await expect(page.getByRole("heading", { name: "系统状态", level: 2 })).toBeVisible();
  await expect(page.getByText("Python Crawler")).toBeVisible();
  await expect(page.getByText("1 个实例 · 1 个活动任务")).toBeVisible();
  await expect(page.getByRole("link", { name: /Redis/ })).toHaveAttribute(
    "href",
    "/platform-admin/redis",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
