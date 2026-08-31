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
  restart_trend: [
    {
      process_name: "api",
      status: "running",
      restart_count: 0,
      restart_delta: 0,
      counter_reset: false,
      observed_at: "2026-08-14T01:55:00.000Z",
    },
    {
      process_name: "worker",
      status: "running",
      restart_count: 1,
      restart_delta: 0,
      counter_reset: false,
      observed_at: "2026-08-14T01:55:00.000Z",
    },
    {
      process_name: "worker",
      status: "running",
      restart_count: 3,
      restart_delta: 2,
      counter_reset: false,
      observed_at: "2026-08-14T02:00:00.000Z",
    },
  ],
  health_probes: {
    status: "ready",
    interval_ms: 30000,
    timeout_ms: 5000,
    window_minutes: 60,
    retention_hours: 72,
    observed_at: "2026-08-14T02:00:06.000Z",
    endpoints: [
      {
        endpoint: "live",
        sample_count: 120,
        success_count: 120,
        http_error_count: 0,
        timeout_count: 0,
        network_error_count: 0,
        availability_basis_points: 10000,
        latency_p50_ms: 4,
        latency_p95_ms: 9,
        latency_p99_ms: 13,
        latency_max_ms: 18,
        last_status_code: 200,
        last_outcome: "succeeded",
        last_observed_at: "2026-08-14T02:00:05.000Z",
      },
      {
        endpoint: "ready",
        sample_count: 120,
        success_count: 119,
        http_error_count: 0,
        timeout_count: 1,
        network_error_count: 0,
        availability_basis_points: 9917,
        latency_p50_ms: 18,
        latency_p95_ms: 44,
        latency_p99_ms: 181,
        latency_max_ms: 5000,
        last_status_code: 200,
        last_outcome: "succeeded",
        last_observed_at: "2026-08-14T02:00:05.000Z",
      },
      {
        endpoint: "available",
        sample_count: 120,
        success_count: 118,
        http_error_count: 2,
        timeout_count: 0,
        network_error_count: 0,
        availability_basis_points: 9833,
        latency_p50_ms: 26,
        latency_p95_ms: 73,
        latency_p99_ms: 214,
        latency_max_ms: 281,
        last_status_code: 200,
        last_outcome: "succeeded",
        last_observed_at: "2026-08-14T02:00:05.000Z",
      },
    ],
  },
  supervisor_pid: 1200,
  worker_scheduler: {
    status: "running",
    max_concurrency: 4,
    active_runs: 3,
    due_queue_count: 2,
    backpressure: true,
    max_queue_delay_ms: 68000,
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
        aging_interval_ms: 30000,
        maximum_aging_boost: 100,
        max_concurrency: 1,
        timeout_ms: 300000,
        max_retries: 0,
        active_runs: 1,
        running: true,
        due: false,
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
        last_result_at: "2026-08-14T02:00:04.000Z",
        last_result_status: "failed_terminal",
        last_result_error_code: "source_changed",
        last_business_objects: [
          {
            type: "collection_task",
            id: "00000000-0000-4000-8000-000000000801",
            label: "采集任务",
            href: "/platform-admin/collection?task=00000000-0000-4000-8000-000000000801",
          },
        ],
      },
      {
        name: "notification_outbox",
        priority: 80,
        effective_priority: 82,
        aging_interval_ms: 30000,
        maximum_aging_boost: 2,
        max_concurrency: 1,
        timeout_ms: 60000,
        max_retries: 2,
        active_runs: 0,
        running: false,
        due: true,
        queue_delay_ms: 68000,
        longest_running_ms: 0,
        suspected_stuck: false,
        circuit_state: "closed",
        circuit_open_until: null,
        consecutive_failures: 1,
        failed_total: 1,
        timed_out_total: 0,
        retry_total: 1,
        deferred_total: 4,
        last_result_at: null,
        last_result_status: null,
        last_result_error_code: null,
        last_business_objects: [],
      },
    ],
  },
  alerts: [
    {
      code: "worker_scheduler_backpressure",
      severity: "warning",
      actionHint: "优先处理高优先级积压。",
      root_cause_code: null,
      queues: ["notification_outbox"],
      business_objects: [],
      occurred_at: "2026-08-14T02:00:05.000Z",
    },
    {
      code: "worker_business_result_failed",
      severity: "warning",
      actionHint: "打开关联业务对象核对失败事实。",
      root_cause_code: "source_changed",
      queues: ["collection_tasks"],
      business_objects: [
        {
          type: "collection_task",
          id: "00000000-0000-4000-8000-000000000801",
          label: "采集任务",
          href: "/platform-admin/collection?task=00000000-0000-4000-8000-000000000801",
        },
      ],
      occurred_at: "2026-08-14T02:00:04.000Z",
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
  await expect(page.getByRole("heading", { name: "队列老化与实际调度延迟" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "健康接口耗时分位数" })).toBeVisible();
  await expect(page.getByText("P99", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("99.17%")).toBeVisible();
  await expect(page.getByText("超时门 5000 ms", { exact: false })).toBeVisible();
  await expect(page.getByText("任务调度发生背压")).toBeVisible();
  const businessAlert = page.locator(".topology-alerts article").filter({
    hasText: "业务处理返回失败",
  });
  await expect(businessAlert).toContainText("采集任务");
  await expect(businessAlert.getByRole("link", { name: /采集任务/ })).toHaveAttribute(
    "href",
    /\/platform-admin\/collection\?task=/,
  );
  await expect(businessAlert.getByText("source_changed", { exact: false })).toBeHidden();
  await expect(page.getByText("5.56%")).toBeVisible();
  await expect(page.getByText("新增重启 2")).toBeVisible();
  await expect(page.getByText("2 个真实观测")).toBeVisible();
  await expect(page.getByText("运行 15200 ms")).toBeVisible();
  await expect(page.getByText("实际调度延迟 68000 ms")).toBeVisible();
  await expect(page.locator('.topology-queue-aging[data-risk="true"]')).toContainText("饥饿风险");
  await expect(page.getByText("优先级已提升 2 / 2")).toBeVisible();
  await expect(page.getByText("worker_scheduler_backpressure")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page).toHaveScreenshot("m08-01-single-server-desktop.png", { fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("huizhou-single-host")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page).toHaveScreenshot("m08-01-single-server-mobile-390.png", { fullPage: true });
});

test("M08-01 refresh is single-flight, keeps the snapshot and labels idle queues truthfully", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/v1/platform/operations/topology", async (route) => {
    calls += 1;
    if (calls > 1) await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      json: envelope({
        ...base,
        worker_scheduler: {
          ...base.worker_scheduler,
          due_queue_count: 0,
          backpressure: false,
          max_queue_delay_ms: 0,
          failed_last_minute: 0,
          failure_rate_percent: 0,
          queues: base.worker_scheduler.queues.map((queue) => ({
            ...queue,
            running: false,
            due: false,
            queue_delay_ms: 87,
            active_runs: 0,
            longest_running_ms: 0,
            consecutive_failures: 0,
            failed_total: 0,
            retry_total: 0,
            deferred_total: 0,
          })),
        },
        alerts: [],
      }),
    });
  });
  await page.goto("/platform-admin/topology");
  await expect(page.getByText("单机运行门已满足")).toBeVisible();
  const refresh = page.getByRole("button", { name: "刷新运行事实" });
  await refresh.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(page.getByRole("button", { name: "正在刷新…" })).toBeDisabled();
  await expect(page.getByText("单机运行门已满足")).toBeVisible();
  await expect(page.getByText("当前没有等待、运行或异常队列")).toBeVisible();
  await expect(page.locator(".topology-queue-list article")).toHaveCount(0);
  await expect.poll(() => calls).toBe(2);
  await page.getByRole("button", { name: "查看全部 2 个队列策略" }).click();
  await expect(page.locator(".topology-queue-list article")).toHaveCount(2);
  await expect(page.getByText("空闲", { exact: true })).toHaveCount(2);
  await expect(page.getByText("未进入等待队列", { exact: true })).toHaveCount(2);
  await expect(page.getByText("等待中", { exact: true })).toHaveCount(0);
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
