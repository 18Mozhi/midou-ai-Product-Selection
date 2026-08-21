import { expect, test, type Page } from "@playwright/test";

const envelope = (data: unknown) => ({ data, request_id: "m08-01-e2e", trace_id: "m08-01-e2e" });
const node = {
  node_id: "api-primary",
  host_id: "huizhou-single-host",
  role: "api",
  status: "ready",
  region: "惠州",
  zone: "primary",
  build_sha: "a".repeat(40),
  version: "0.1.0",
  last_heartbeat_at: "2026-08-14T02:00:00.000Z",
};
const base = {
  state: "ready",
  mode: "single_host",
  active_api_instances: 1,
  single_host: true,
  stale_node_count: 0,
  nodes: [node],
  processes: [
    {
      name: "api",
      status: "running",
      pid: 1201,
      restart_count: 0,
      ready_at: "2026-08-14T02:00:01.000Z",
      circuit_open_until: null,
      last_failure: null,
    },
    {
      name: "worker",
      status: "running",
      pid: 1202,
      restart_count: 1,
      ready_at: "2026-08-14T02:00:03.000Z",
      circuit_open_until: null,
      last_failure: "exit:1",
    },
  ],
  supervisor_pid: 1200,
  worker_scheduler: {
    status: "running",
    max_concurrency: 4,
    active_runs: 3,
    due_queue_count: 2,
    backpressure: true,
    max_queue_delay_ms: 680,
    suspected_stuck_runs: 0,
    snapshot_publish_failed_total: 0,
    last_snapshot_error: null,
    completed_last_minute: 18,
    failed_last_minute: 1,
    failure_rate_percent: 5.56,
    observed_at: "2026-08-14T02:00:05.000Z",
    queues: [
      {
        name: "collection_tasks",
        priority: 100,
        effective_priority: 100,
        max_concurrency: 1,
        timeout_ms: 300000,
        max_retries: 0,
        active_runs: 1,
        running: true,
        queue_delay_ms: 120,
        longest_running_ms: 15200,
        suspected_stuck: false,
        circuit_state: "closed",
        circuit_open_until: null,
        consecutive_failures: 0,
        failed_total: 0,
        timed_out_total: 0,
        retry_total: 0,
        deferred_total: 2,
      },
      {
        name: "notification_outbox",
        priority: 80,
        effective_priority: 82,
        max_concurrency: 1,
        timeout_ms: 60000,
        max_retries: 2,
        active_runs: 0,
        running: false,
        queue_delay_ms: 680,
        longest_running_ms: 0,
        suspected_stuck: false,
        circuit_state: "closed",
        circuit_open_until: null,
        consecutive_failures: 1,
        failed_total: 1,
        timed_out_total: 0,
        retry_total: 1,
        deferred_total: 4,
      },
    ],
  },
  alerts: [
    {
      code: "worker_scheduler_backpressure",
      severity: "warning",
      actionHint: "优先处理高优先级积压。",
    },
  ],
  blockers: [],
  load_balancing_enabled: false,
  backup_server_used: false,
  multi_node_claim: false,
  capacity_claim: "unverified",
  observed_at: "2026-08-14T02:00:06.000Z",
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

test("M08-01.A07/A08/A15 desktop and 390 single-server truth", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/topology", (route) =>
    route.fulfill({ json: envelope(base) }),
  );
  await page.goto("/platform-admin/topology");
  await expect(page.getByRole("heading", { name: "单机运行控制台" })).toBeVisible();
  await expect(page.getByText("单机运行门已满足")).toBeVisible();
  await expect(page.getByText("不做负载均衡")).toBeVisible();
  await expect(page.getByRole("heading", { name: "队列优先级与背压" })).toBeVisible();
  await expect(page.getByText("任务调度发生背压")).toBeVisible();
  await expect(page.getByText("5.56%")).toBeVisible();
  await expect(page.getByText("运行 15200 ms")).toBeVisible();
  await expect(page.getByText("worker_scheduler_backpressure")).toBeHidden();
  await expect(page).toHaveScreenshot("m08-01-single-server-desktop.png", { fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("huizhou-single-host")).toBeVisible();
  await expect(page).toHaveScreenshot("m08-01-single-server-mobile-390.png", { fullPage: true });
});

test("M08-01.A08/A09 empty blocked stale forbidden expired and rate limited", async ({ page }) => {
  let status = 200;
  let state = "empty";
  await page.route("**/api/v1/platform/operations/topology", (route) => {
    if (status !== 200)
      return route.fulfill({
        status,
        json: {
          error: { action_hint: "按权限或频率门恢复。" },
          request_id: "m08-01-state",
          trace_id: "m08-01-state",
        },
      });
    return route.fulfill({
      json: envelope({
        ...base,
        state,
        active_api_instances: state === "empty" ? 0 : 1,
        stale_node_count: state === "stale" ? 1 : 0,
        nodes: state === "empty" ? [] : [node],
        blockers: [{ code: `runtime_${state}`, actionHint: "通过宝塔恢复当前单机 API。" }],
      }),
    });
  });
  await page.goto("/platform-admin/topology");
  await expect(page.getByText("尚无当前 API 心跳")).toBeVisible();
  for (const [next, label] of [
    ["blocked", "单机运行条件未满足"],
    ["stale", "运行心跳已过期"],
  ]) {
    state = next;
    await page.reload();
    await expect(page.getByText(label)).toBeVisible();
  }
  for (const [nextStatus, label] of [
    [403, "没有平台运维权限"],
    [401, "登录已失效"],
    [429, "刷新过于频繁"],
    [503, "运行状态暂不可用"],
  ] as const) {
    status = nextStatus;
    await page.reload();
    await expect(page.getByText(label)).toBeVisible();
  }
});
