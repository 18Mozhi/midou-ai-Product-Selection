import { expect, test, type Page } from "@playwright/test";
const env = (data: any) => ({ data, request_id: "m07-05-e2e", trace_id: "m07-05-e2e" });
const gates = [5, 25, 100].map((percent) => ({
  id: `gate-${percent}`,
  release_id: "release-1",
  gate_kind: `canary_${percent}`,
  status: "passed",
  traffic_percent: percent,
  observe_seconds: 1800,
  sample_count: 20,
  error_rate_percent: 0,
  read_p95_ms: 100,
  write_p95_ms: 200,
  async_lag_seconds: 2,
  finished_at: "2026-08-08T14:55:00Z",
}));
const base = {
  policy: {
    percentages: [5, 25, 100],
    minimum_observation_seconds: 1800,
    maximum_evidence_age_minutes: 30,
    error_rate_stop_percent: 1,
    read_p95_stop_ms: 300,
    write_p95_stop_ms: 600,
    async_lag_stop_seconds: 60,
  },
  latest_release: {
    id: "release-1",
    app_version: "0.1.0",
    build_sha: "a".repeat(40),
    migration_version: "0026_release_rollout_m07_05.up.sql",
    status: "healthy",
    finished_at: "2026-08-08T14:55:00Z",
  },
  gates,
  automatic_stop_verified: false,
  rollback_verified: false,
  blockers: [],
  observed_at: "2026-08-08T15:00:00Z",
};
async function navigation(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (route) =>
    route.fulfill({
      json: env({
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
test("M07-05.A07/A08/A15 desktop and 390 rollout truth", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/releases", (route) =>
    route.fulfill({ json: env({ ...base, state: "verified" }) }),
  );
  await page.goto("/platform-admin/releases");
  await expect(page.getByRole("heading", { name: "发布与回滚控制台" })).toBeVisible();
  await expect(page.getByText("发布门已通过")).toBeVisible();
  await expect(page).toHaveScreenshot("m07-05-release-rollout-desktop.png", { fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("5% → 25% → 100%")).toBeVisible();
  await page.getByRole("button", { name: /^5% · 已通过/ }).click();
  const dialog = page.getByRole("dialog", { name: "5% 观察门" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("技术详情").click();
  await expect(dialog.getByText("gate-5", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "关闭详情" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("m07-05-release-rollout-mobile-390.png", { fullPage: true });
});
test("M07-05.A08/A16 empty blocked stale stopped rolled back forbidden expired", async ({
  page,
}) => {
  let status = 200,
    state = "empty";
  await page.route("**/api/v1/platform/operations/releases", (route) =>
    status === 200
      ? route.fulfill({
          json: env({
            ...base,
            state,
            latest_release: state === "empty" ? null : base.latest_release,
            gates: state === "empty" ? [] : gates,
            blockers:
              state === "blocked"
                ? [{ code: "rollout_gates_incomplete", action_hint: "由宝塔继续观察。" }]
                : [],
          }),
        })
      : route.fulfill({
          status,
          json: {
            error: { action_hint: "按权限恢复" },
            request_id: "m07-05-state",
            trace_id: "m07-05-state",
          },
        }),
  );
  await page.goto("/platform-admin/releases");
  await expect(page.getByText("尚无发布记录")).toBeVisible();
  for (const [next, label] of [
    ["blocked", "发布条件未满足"],
    ["stale", "观察证据已过期"],
    ["stopped", "发布已自动停止"],
    ["rolled_back", "已回滚到稳定版本"],
  ]) {
    state = next;
    await page.reload();
    await expect(page.getByText(label)).toBeVisible();
  }
  status = 403;
  await page.reload();
  await expect(page.getByText("你没有平台运维权限")).toBeVisible();
  status = 401;
  await page.reload();
  await expect(page.getByText("登录已失效")).toBeVisible();
});
