import { expect, test, type Page } from "@playwright/test";
const envelope = (data: unknown) => ({ data, request_id: "m08-06-e2e", trace_id: "m08-06-e2e" });
const base = {
  state: "ready",
  boundary: {
    measured_concurrency: 20,
    planning_users: 100,
    planning_concurrency_min: 5,
    planning_concurrency_max: 20,
    capacity_claim: "measured_single_host_limited",
    stop_reason: "planning_ceiling_reached",
    failed_next_concurrency: null,
    failed_next_code: null,
  },
  performance: {
    read_p95_ms: 118,
    write_p95_ms: 284,
    error_rate_basis_points: 0,
    async_lag_seconds: 2,
  },
  resource: { load_basis_points: 3260, available_memory_mb: 6144, free_disk_mb: 245760 },
  resilience: { archive_verified: true, recovery_verified: true },
  degradation: { mode: "normal", actions: [] },
  findings: [],
  single_host: true,
  load_balancing_enabled: false,
  backup_server_used: false,
  multi_node_claim: false,
  observed_at: "2026-08-15T08:00:00.000Z",
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

test("M08-06.A07/A08/A15 desktop and 390 measured single-host capacity truth", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/capacity", (route) =>
    route.fulfill({ json: envelope(base) }),
  );
  await page.goto("/platform-admin/capacity");
  await expect(page.getByRole("heading", { name: "单机容量边界" })).toBeVisible();
  await expect(page.getByText("S0 单机实测边界已满足")).toBeVisible();
  await expect(page.getByText("实测单机有限边界")).toBeVisible();
  await expect(page.getByText("规划测量上限已完成；仍仅限当前单机实测")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByText(
      "只展示惠州当前单机实测结论；规划 100 用户不等于并发承诺，不启用负载均衡、备用服务器或多节点。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/不证明 100 人同时在线、多节点、高可用或 10,000 用户能力/),
  ).toBeVisible();
});

test("M08-06.A08/A09/A16 warning blocked empty forbidden expired rate limited unavailable and verifying", async ({
  page,
}) => {
  let status = 200,
    response: unknown = {
      ...base,
      state: "warning",
      boundary: {
        ...base.boundary,
        measured_concurrency: 5,
        stop_reason: "next_stage_gate_failed",
        failed_next_concurrency: 10,
        failed_next_code: "capacity_write_latency_exceeded",
      },
      degradation: { mode: "shed_background", actions: ["不得扩大到并发 10。"] },
      findings: [
        {
          code: "capacity_next_stage_gate_failed",
          severity: "warning",
          action_hint: "不得扩大到并发 10。",
        },
      ],
    };
  await page.route("**/api/v1/platform/operations/capacity", (route) =>
    status === 200
      ? route.fulfill({ json: envelope(response) })
      : route.fulfill({
          status,
          json: {
            error: {
              code: status === 503 ? "capacity_evidence_unavailable" : "state_error",
              action_hint: "按权限或频率门恢复。",
            },
            request_id: "m08-06-state",
            trace_id: "m08-06-state",
          },
        }),
  );
  await page.goto("/platform-admin/capacity");
  await expect(page.getByText("单机有限边界已签发")).toBeVisible();
  await expect(page.getByText("并发 10 已失败；声明只限并发 5")).toBeVisible();
  response = {
    ...base,
    state: "blocked",
    boundary: { ...base.boundary, capacity_claim: "unverified" },
    degradation: { mode: "stop_new_work", actions: ["停止新增后台工作。"] },
    findings: [
      {
        code: "capacity_write_latency_exceeded",
        severity: "blocked",
        action_hint: "通过宝塔止损。",
      },
    ],
  };
  await page.reload();
  await expect(page.getByText("单机容量门已阻断")).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByText("尚无同提交容量基线")).toBeVisible();
  for (const [next, label] of [
    [403, "没有平台运维权限"],
    [401, "登录已失效"],
    [429, "刷新过于频繁"],
    [500, "容量边界事实暂不可用"],
  ] as const) {
    status = next;
    await page.reload();
    await expect(page.getByText(label)).toBeVisible();
  }
  await page.goto("/platform-admin/capacity?state=verifying");
  await expect(page.getByText("正在核验归档与恢复演练")).toBeVisible();
});
