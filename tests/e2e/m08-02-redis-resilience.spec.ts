import { expect, test, type Page } from "@playwright/test";

const envelope = (data: unknown) => ({ data, request_id: "m08-02-e2e", trace_id: "m08-02-e2e" });
const base = {
  state: "ready",
  mode: "single_instance",
  persistence: {
    aof_enabled: true,
    rdb_enabled: true,
    aof_last_write_status: "ok",
    rdb_last_save_status: "ok",
  },
  memory: { used_bytes: 134217728, max_bytes: 536870912, usage_basis_points: 2500 },
  connections: { connected: 18, maximum: 512, usage_basis_points: 352, rejected: 0 },
  evicted_keys: 0,
  max_memory_policy: "noeviction",
  uptime_seconds: 172800,
  keyspace_sample: {
    status: "sampled",
    basis: "bounded_memory_usage",
    sample_limit: 128,
    scanned_keys: 12,
    measured_keys: 12,
    ignored_keys: 0,
    failed_measurements: 0,
    total_sampled_bytes: 1048576,
    truncated: false,
    access_frequency_available: false,
    unavailable_reason: null,
    hotspots: [
      {
        purpose: "queue",
        resource: "collection_task",
        sampled_keys: 8,
        sampled_bytes: 786432,
        sampled_share_basis_points: 7500,
      },
      {
        purpose: "queue",
        resource: "collection_ready",
        sampled_keys: 4,
        sampled_bytes: 262144,
        sampled_share_basis_points: 2500,
      },
    ],
  },
  findings: [],
  single_instance: true,
  sentinel_enabled: false,
  cluster_enabled: false,
  capacity_claim: "unverified",
  observed_at: "2026-08-14T10:00:00.000Z",
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

test("M08-02.A07/A08/A15 desktop and 390 Redis resilience truth", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/redis", (route) =>
    route.fulfill({ json: envelope(base) }),
  );
  await page.goto("/platform-admin/redis");
  await expect(page.getByRole("heading", { name: "缓存服务单实例韧性" })).toBeVisible();
  await expect(page.getByText("单 Redis 韧性门已满足")).toBeVisible();
  await expect(page.getByText("512.0 MiB")).toBeVisible();
  await expect(page.getByRole("heading", { name: "键淘汰风险" })).toBeVisible();
  await expect(page.getByText("noeviction 已启用，当前未记录键淘汰。")).toBeVisible();
  await expect(page.getByRole("heading", { name: "键空间占用热点" })).toBeVisible();
  await expect(page.getByText("采集任务租约")).toBeVisible();
  await expect(page.getByText("75.0%")).toBeVisible();
  await expect(page.getByText(/不把内存占比冒充访问频率/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page).toHaveScreenshot("m08-02-redis-resilience-desktop.png", { fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("不启用 Sentinel、集群、副本或备用服务器")).toBeVisible();
  await expect(page.getByText("采集就绪队列")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page).toHaveScreenshot("m08-02-redis-resilience-mobile-390.png", { fullPage: true });
});

test("M08-02.A08/A09/A16 warning blocked empty forbidden expired rate limited unavailable and recovering", async ({
  page,
}) => {
  let status = 200;
  let response: unknown = {
    ...base,
    state: "warning",
    findings: [
      { code: "redis_memory_warning", severity: "warning", action_hint: "检查缓存增长。" },
    ],
  };
  await page.route("**/api/v1/platform/operations/redis", (route) =>
    status === 200
      ? route.fulfill({ json: envelope(response) })
      : route.fulfill({
          status,
          json: {
            error: { action_hint: "按权限或频率门恢复。" },
            request_id: "m08-02-state",
            trace_id: "m08-02-state",
          },
        }),
  );
  await page.goto("/platform-admin/redis");
  await expect(page.getByText("Redis 资源接近预警线")).toBeVisible();
  response = {
    ...base,
    state: "blocked",
    findings: [{ code: "redis_aof_disabled", severity: "blocked", action_hint: "通过宝塔恢复。" }],
  };
  await page.reload();
  await expect(page.getByText("Redis 韧性门已阻断")).toBeVisible();
  response = null;
  await page.reload();
  await expect(page.getByText("尚无 Redis 观测")).toBeVisible();
  for (const [next, label] of [
    [403, "没有平台运维权限"],
    [401, "登录已失效"],
    [429, "刷新过于频繁"],
    [503, "Redis 运行事实暂不可用"],
  ] as const) {
    status = next;
    await page.reload();
    await expect(page.getByText(label)).toBeVisible();
  }
  await page.goto("/platform-admin/redis?state=recovering");
  await expect(page.getByRole("heading", { name: "缓存服务单实例韧性" })).toBeVisible();
});
