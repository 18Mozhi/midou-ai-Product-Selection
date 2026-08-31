import { expect, test, type Page } from "@playwright/test";
const env = (data: any) => ({ data, request_id: "m07-04-e2e", trace_id: "m07-04-e2e" });
const base = {
  policy: {
    primary_region: "惠州",
    recovery_region: "惠州",
    rpo_minutes: 15,
    rto_minutes: 240,
    maximum_drill_age_days: 90,
  },
  latest_backup: { actual_rpo_minutes: 5, finished_at: "2026-08-08T13:00:00Z" },
  latest_drill: null,
  drill_age_days: null,
  drill_expires_at: null,
  days_until_drill_expiry: null,
  recovery_copy_verified: false,
  targets: [
    {
      asset_kind: "mysql_full",
      region: "惠州",
      storage_role: "primary_backup",
      bundle_count: 1,
      size_bytes: 1048576,
      encrypted: true,
      integrity_verified: true,
    },
  ],
  blockers: [
    {
      code: "recovery_copy_unverified",
      action_hint: "由宝塔生成同机独立加密恢复副本并完成完整性校验。",
    },
  ],
  observed_at: "2026-08-08T13:30:00Z",
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
test("M07-04.A07/A08/A15 desktop and 390 recovery truth", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/backup-recovery", (route) =>
    route.fulfill({ json: env({ ...base, state: "blocked" }) }),
  );
  await page.goto("/platform-admin/operations");
  await expect(page.getByRole("heading", { name: "备份与恢复控制台" })).toBeVisible();
  await expect(page.getByText("恢复链路受阻")).toBeVisible();
  await expect(page.getByText("同机副本未核验")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("恢复副本尚未核验")).toBeVisible();
  await page.getByRole("button", { name: /数据库完整备份/ }).click();
  const dialog = page.getByRole("dialog", { name: "数据库完整备份" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("技术详情").click();
  await expect(dialog.getByText("mysql_full", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "关闭详情" }).click();
  await page.locator(".blockers summary").click();
  await expect(page.getByText("recovery_copy_unverified", { exact: true })).toBeVisible();
  await page.locator(".blockers summary").click();
  await page.evaluate(() => window.scrollTo(0, 0));
});
test("M07-04.A07/A11 reminds before restore drill evidence expires", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/backup-recovery", (route) =>
    route.fulfill({
      json: env({
        ...base,
        state: "verified",
        latest_drill: { finished_at: "2026-05-16T13:30:00Z" },
        drill_age_days: 84,
        drill_expires_at: "2026-08-14T13:30:00Z",
        days_until_drill_expiry: 6,
        recovery_copy_verified: true,
        blockers: [],
      }),
    }),
  );
  await page.goto("/platform-admin/operations");
  await expect(page.getByText("还剩 6 天到期")).toBeVisible();
  await expect(page.getByText("演练证据到期")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("还剩 6 天到期")).toBeVisible();
});
test("backup refresh is single-flight and preserves the last verified snapshot on failure", async ({
  page,
}) => {
  let calls = 0;
  let releaseRefresh: (() => void) | undefined;
  const verified = {
    ...base,
    state: "verified",
    recovery_copy_verified: true,
    blockers: [],
  };
  await page.route("**/api/v1/platform/operations/backup-recovery", async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({ json: env(verified) });
      return;
    }
    if (calls === 2) await new Promise<void>((resolve) => (releaseRefresh = resolve));
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: "backup_recovery_dependency_unavailable",
          message: "备份与恢复事实暂不可用。",
          action_hint: "在宝塔检查 Node API 与 MySQL 后重新核验。",
        },
        request_id: "m07-04-refresh-failure",
        trace_id: "m07-04-refresh-failure",
      },
    });
  });
  await page.goto("/platform-admin/operations");
  await expect(page.getByText("同机恢复链路已验证")).toBeVisible();
  const refresh = page.getByRole("button", { name: "刷新事实" });
  await refresh.click();
  await expect(page.getByRole("button", { name: "正在刷新…" })).toBeDisabled();
  await page.getByRole("button", { name: "正在刷新…" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  expect(calls).toBe(2);
  await expect(page.getByText("同机恢复链路已验证")).toBeVisible();
  await expect(page.getByText("5 min", { exact: true })).toBeVisible();
  releaseRefresh?.();
  await expect(page.getByText("刷新未完成")).toBeVisible();
  await expect(page.getByText(/已保留上次成功的备份恢复事实/)).toBeVisible();
  await expect(page.getByText("同机恢复链路已验证")).toBeVisible();
});
test("M07-04.A08/A16 loading empty stale verified forbidden and expired states", async ({
  page,
}) => {
  let status = 200,
    state = "empty";
  await page.route("**/api/v1/platform/operations/backup-recovery", (route) =>
    status === 200
      ? route.fulfill({
          json: env({ ...base, state, targets: [], latest_backup: null, blockers: [] }),
        })
      : route.fulfill({
          status,
          json: {
            error: { action_hint: "按权限恢复" },
            request_id: "m07-04-state",
            trace_id: "m07-04-state",
          },
        }),
  );
  await page.goto("/platform-admin/operations");
  await expect(page.getByText("尚无备份记录")).toBeVisible();
  state = "stale";
  await page.reload();
  await expect(page.getByText("恢复演练已过期")).toBeVisible();
  state = "verified";
  await page.reload();
  await expect(page.getByText("同机恢复链路已验证")).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.getByText("你没有平台运维权限")).toBeVisible();
  status = 401;
  await page.reload();
  await expect(page.getByText("登录已失效")).toBeVisible();
  await expect(page.getByRole("link", { name: "重新登录" })).toBeVisible();
  status = 429;
  await page.reload();
  await expect(page.getByText("刷新过于频繁")).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByText("备份与恢复事实暂不可用")).toBeVisible();
});
