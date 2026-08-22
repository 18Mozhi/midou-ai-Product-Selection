import { expect, test, type Page } from "@playwright/test";
import { expectAboveMobileNavigation, markOcclusionProbe } from "./helpers/mobile-occlusion";
const envelope = (data: unknown) => ({ data, request_id: "m08-05-e2e", trace_id: "m08-05-e2e" }),
  base = {
    state: "ready",
    topology: {
      mode: "single_host",
      worker_instances: 1,
      crawler_instances: 1,
      maximum_workers: 1,
      maximum_crawlers: 1,
    },
    leases: { active_worker: 0, active_crawler: 0, duplicate_count: 0 },
    expired_leases: {
      total: 3,
      task_count: 1,
      worker: 1,
      crawler: 1,
      provider: 1,
      oldest_expired_at: "2026-08-15T07:55:00.000Z",
    },
    active_leases: [],
    providers: [
      {
        id: "00000000-0000-4000-8000-000000000851",
        code: "google_news_search",
        configured_concurrency: 3,
        effective_concurrency: 1,
        active_leases: 0,
        queued_tasks: 3,
        longest_queue_wait_seconds: 180,
        queue_wait_p50_seconds: 45,
        queue_wait_p95_seconds: 125,
        sample_count_24h: 20,
        success_rate_basis_points_24h: 9500,
        duration_p95_ms_24h: 1800,
        circuit_state: "closed",
        circuit_failure_threshold: 5,
        consecutive_failures: 0,
        last_error_code: null,
      },
      {
        id: "00000000-0000-4000-8000-000000000852",
        code: "authorized_market",
        configured_concurrency: 1,
        effective_concurrency: 1,
        active_leases: 0,
        queued_tasks: 0,
        longest_queue_wait_seconds: 0,
        queue_wait_p50_seconds: 0,
        queue_wait_p95_seconds: 0,
        sample_count_24h: 0,
        success_rate_basis_points_24h: null,
        duration_p95_ms_24h: null,
        circuit_state: "closed",
        circuit_failure_threshold: 5,
        consecutive_failures: 0,
        last_error_code: null,
      },
    ],
    profiles: [{ id: "00000000-0000-4000-8000-000000000853", active_leases: 0 }],
    trend: [],
    resource: {
      load_basis_points: 3240,
      available_memory_mb: 6144,
      free_disk_mb: 245760,
      observed_at: "2026-08-15T08:00:00.000Z",
    },
    findings: [],
    observed_at: "2026-08-15T08:00:00.000Z",
    capacity_claim: "unverified",
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
test("M08-05.A07/A08/A15 desktop and 390 single-host scheduler truth", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) =>
    route.fulfill({ json: envelope(base) }),
  );
  await page.goto("/platform-admin/crawler-scheduler");
  await expect(page.getByRole("heading", { level: 1, name: "采集调度" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "运行与配额" })).toBeVisible();
  await expect(page.getByText("采集调度已就绪")).toBeVisible();
  await expect(page.getByText("1 / 1")).toHaveCount(2);
  await expect(page.getByText("等待 3 个任务 · 最长 3 分钟")).toBeVisible();
  await expect(page.getByText("等待 0 个任务 · 最长 0 秒")).toBeVisible();
  await expect(page.getByRole("region", { name: "采集排队摘要" })).toContainText(
    "待领取任务3最老等待3 分钟饥饿风险来源1",
  );
  await expect(page.getByText("最长等待已高于近 24 小时 P95，存在饥饿风险")).toBeVisible();
  await page.getByRole("button", { name: "回收过期租约" }).click();
  await expect(page.getByRole("heading", { name: "回收过期调度租约？" })).toBeVisible();
  await expect(page.getByText(/将回收 3 个过期槽位.*Worker 1.*Crawler 1.*来源 1/)).toBeVisible();
  await expect(page.getByText(/关联 1 个采集任务/)).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByText(
      "惠州单机由 ai选品 Worker 领取采集任务，宝塔 Python 3.12 项目提供采集心跳与 Playwright 桥接；来源并发上限 1。",
      { exact: true },
    ),
  ).toBeVisible();
});
test("M08-05.A08/A09/A16 warning blocked empty forbidden expired rate limited unavailable and recovering", async ({
  page,
}) => {
  let status = 200,
    response: unknown = {
      ...base,
      state: "warning",
      findings: [
        { code: "crawler_resource_warning", severity: "warning", action_hint: "持续观察。" },
      ],
    };
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) =>
    status === 200
      ? route.fulfill({ json: envelope(response) })
      : route.fulfill({
          status,
          json: {
            error: { action_hint: "按权限或频率门恢复。" },
            request_id: "m08-05-state",
            trace_id: "m08-05-state",
          },
        }),
  );
  await page.goto("/platform-admin/crawler-scheduler");
  await expect(page.getByText("采集调度需要关注")).toBeVisible();
  response = {
    ...base,
    state: "blocked",
    findings: [
      { code: "crawler_lease_duplicate", severity: "blocked", action_hint: "通过宝塔回收。" },
    ],
  };
  await page.reload();
  await expect(page.getByText("采集调度已阻断")).toBeVisible();
  response = null;
  await page.reload();
  await expect(page.getByText("尚无调度观测")).toBeVisible();
  for (const [next, label] of [
    [403, "没有平台运维权限"],
    [401, "登录已失效"],
    [429, "刷新过于频繁"],
    [503, "采集调度事实暂不可用"],
  ] as const) {
    status = next;
    await page.reload();
    await expect(page.getByText(label)).toBeVisible();
  }
  await page.goto("/platform-admin/crawler-scheduler?state=recovering");
  await expect(page.getByText("正在回收过期租约")).toBeVisible();
});

test("M08-05 active lease links process role and collection task without exposing technical IDs by default", async ({
  page,
}) => {
  const taskId = "00000000-0000-4000-8000-000000000861";
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) =>
    route.fulfill({
      json: envelope({
        ...base,
        active_leases: [
          {
            slot_type: "provider",
            provider_name: "Google 新闻检索",
            task_id: taskId,
            task_status: "running",
            run_id: null,
            process_role: "node_worker",
            process_ref: "worker-main",
            heartbeat_at: "2026-08-15T08:00:00.000Z",
            expires_at: "2026-08-15T08:01:00.000Z",
          },
        ],
      }),
    }),
  );
  await page.goto("/platform-admin/crawler-scheduler");
  await expect(page.getByRole("heading", { name: "租约、进程与采集任务" })).toBeVisible();
  await expect(page.getByText("Node Worker", { exact: true })).toBeVisible();
  await expect(page.getByText("Google 新闻检索")).toBeVisible();
  await expect(page.getByText(/采集任务：执行中/)).toBeVisible();
  await expect(page.getByText(`任务 UUID ${taskId}`)).toBeHidden();
  await page.getByText("查看技术详情").click();
  await expect(page.getByText(`任务 UUID ${taskId}`)).toBeVisible();
  await expect(page.getByText("进程标识 worker-main")).toBeVisible();
});

test("M08-05 mobile bottom navigation does not cover the scheduler handoff", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) =>
    route.fulfill({ json: envelope(base) }),
  );
  await page.goto("/platform-admin/crawler-scheduler");
  const handoff = page.locator(".crawler-scheduler footer");
  await markOcclusionProbe(handoff);
  await expectAboveMobileNavigation(page, handoff);
});
