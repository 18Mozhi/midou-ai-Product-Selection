import { expect, test, type Page } from "@playwright/test";
const envelope = (data: unknown) => ({ data, request_id: "m08-03-e2e", trace_id: "m08-03-e2e" });
const base = {
  state: "ready",
  mode: "single_primary",
  durability: {
    log_bin_enabled: true,
    binlog_format: "ROW",
    innodb_flush_log_at_trx_commit: 2,
    sync_binlog: 1,
  },
  connections: { connected: 20, running: 2, maximum: 512, usage_basis_points: 391 },
  storage: { used_bytes: 171798691840, total_bytes: 429496729600, usage_basis_points: 4000 },
  io: {
    buffer_pool_bytes: 4294967296,
    buffer_pool_data_bytes: 2147483648,
    buffer_pool_hit_rate_basis_points: 9999,
    innodb_log_waits: 0,
    innodb_row_lock_waits: 0,
  },
  slow_queries: { per_minute: 0, long_query_time_seconds: 2 },
  recovery: { status: "verified", actual_rpo_minutes: 1, actual_rto_minutes: 3, drill_age_days: 1 },
  findings: [],
  single_primary: true,
  replica_enabled: false,
  backup_server_used: false,
  capacity_claim: "unverified",
  observed_at: "2026-08-14T13:00:00.000Z",
};
async function navigation(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_operations_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "allowed",
      }),
    }),
  );
}
test.beforeEach(async ({ page }) => navigation(page));
test("M08-03.A07/A08/A15 desktop and 390 single-primary truth", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/mysql", (route) =>
    route.fulfill({ json: envelope(base) }),
  );
  await page.goto("/platform-admin/mysql");
  await expect(page.getByRole("heading", { name: "数据库 5.7 单主韧性" })).toBeVisible();
  await expect(page.getByText("MySQL 单主韧性门已满足")).toBeVisible();
  await expect(page.getByRole("heading", { name: "慢查询与锁等待影响" })).toBeVisible();
  await expect(page.getByText("实例启动后未记录行锁等待")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByText("惠州单机只运行一个宝塔 MySQL 主实例；不启用读副本、负载均衡或备用服务器。", {
      exact: true,
    }),
  ).toBeVisible();
});
test("MySQL refresh is single-flight and preserves the last verified snapshot on failure", async ({
  page,
}) => {
  let calls = 0;
  let releaseRefresh: (() => void) | undefined;
  await page.route("**/api/v1/platform/operations/mysql", async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({ json: envelope(base) });
      return;
    }
    if (calls === 2) await new Promise<void>((resolve) => (releaseRefresh = resolve));
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: "mysql_resilience_dependency_unavailable",
          message: "MySQL 运行事实暂不可用。",
          action_hint: "在宝塔检查 Node API 与 MySQL 后重新核验。",
        },
        request_id: "m08-03-refresh-failure",
        trace_id: "m08-03-refresh-failure",
      },
    });
  });
  await page.goto("/platform-admin/mysql");
  await expect(page.getByText("MySQL 单主韧性门已满足")).toBeVisible();
  const refresh = page.getByRole("button", { name: "刷新运行事实" });
  await refresh.click();
  await expect(page.getByRole("button", { name: "正在刷新…" })).toBeDisabled();
  await page.getByRole("button", { name: "正在刷新…" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  expect(calls).toBe(2);
  await expect(page.getByText("MySQL 单主韧性门已满足")).toBeVisible();
  await expect(page.getByText("ROW", { exact: true })).toBeVisible();
  releaseRefresh?.();
  await expect(page.getByText("刷新未完成")).toBeVisible();
  await expect(page.getByText(/已保留上次成功的 MySQL 运行事实/)).toBeVisible();
  await expect(page.getByText("MySQL 单主韧性门已满足")).toBeVisible();
});
test("M08-03.A08/A09/A16 warning blocked empty forbidden expired rate limited unavailable and recovering", async ({
  page,
}) => {
  let status = 200;
  let response: unknown = {
    ...base,
    state: "warning",
    findings: [
      { code: "mysql_slow_query_warning", severity: "warning", action_hint: "检查慢查询。" },
    ],
  };
  await page.route("**/api/v1/platform/operations/mysql", (route) =>
    status === 200
      ? route.fulfill({ json: envelope(response) })
      : route.fulfill({
          status,
          json: {
            error: { action_hint: "按权限或频率门恢复。" },
            request_id: "m08-03-state",
            trace_id: "m08-03-state",
          },
        }),
  );
  await page.goto("/platform-admin/mysql");
  await expect(page.getByText("MySQL 指标接近预警线")).toBeVisible();
  response = {
    ...base,
    state: "blocked",
    findings: [
      { code: "mysql_binlog_disabled", severity: "blocked", action_hint: "通过宝塔恢复。" },
    ],
  };
  await page.reload();
  await expect(page.getByText("MySQL 韧性门已阻断")).toBeVisible();
  response = null;
  await page.reload();
  await expect(page.getByText("尚无 MySQL 观测")).toBeVisible();
  for (const [next, label] of [
    [403, "没有平台运维权限"],
    [401, "登录已失效"],
    [429, "刷新过于频繁"],
    [503, "MySQL 运行事实暂不可用"],
  ] as const) {
    status = next;
    await page.reload();
    await expect(page.getByText(label)).toBeVisible();
  }
  await page.goto("/platform-admin/mysql?state=recovering");
  await expect(page.getByRole("heading", { name: "数据库 5.7 单主韧性" })).toBeVisible();
});
