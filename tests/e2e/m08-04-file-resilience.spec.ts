import { expect, test, type Page } from "@playwright/test";
const envelope = (data: unknown) => ({ data, request_id: "m08-04-e2e", trace_id: "m08-04-e2e" });
const base = {
  state: "ready",
  mode: "local_managed_directories",
  directories: [
    {
      kind: "evidence",
      available: true,
      writable: true,
      used_bytes: 10737418240,
      total_bytes: 429496729600,
      usage_basis_points: 250,
      active_files: 132,
      indexed_bytes: 9663676416,
    },
    {
      kind: "export",
      available: true,
      writable: true,
      used_bytes: 21474836480,
      total_bytes: 429496729600,
      usage_basis_points: 500,
      active_files: 26,
      indexed_bytes: 19327352832,
    },
    {
      kind: "temp",
      available: true,
      writable: true,
      used_bytes: 32212254720,
      total_bytes: 429496729600,
      usage_basis_points: 750,
      active_files: 0,
      indexed_bytes: 0,
    },
  ],
  integrity: { sampled_files: 20, verified_files: 20, mismatch_files: 0, missing_files: 0 },
  recovery: {
    status: "verified",
    encrypted_same_host_copy: true,
    isolated_restore_verified: true,
    drill_age_days: 1,
  },
  findings: [],
  organization_scoped: true,
  public_access_enabled: false,
  shared_storage_enabled: false,
  backup_server_used: false,
  capacity_claim: "unverified",
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
test("M08-04.A07/A08/A15 desktop and 390 local-file truth", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/files", (route) =>
    route.fulfill({ json: envelope(base) }),
  );
  await page.goto("/platform-admin/files");
  await expect(page.getByRole("heading", { name: "本机文件韧性" })).toBeVisible();
  await expect(page.getByText("本机文件韧性门已满足")).toBeVisible();
  await expect(page.getByText("20 / 20")).toBeVisible();
  await expect(page.getByText("临时目录", { exact: true })).toBeVisible();
  await expect(page.getByText("不建立持久索引")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByText(
      "证据、导出与临时文件只写入惠州当前主机的宝塔受控目录；不使用共享存储或备用服务器。",
    ),
  ).toBeVisible();
});
test("M08-04.A08/A09/A16 warning blocked empty forbidden expired rate limited unavailable and recovering", async ({
  page,
}) => {
  let status = 200;
  let response: unknown = {
    ...base,
    state: "warning",
    findings: [
      { code: "file_capacity_warning", severity: "warning", action_hint: "按保留策略归档。" },
    ],
  };
  await page.route("**/api/v1/platform/operations/files", (route) =>
    status === 200
      ? route.fulfill({ json: envelope(response) })
      : route.fulfill({
          status,
          json: {
            error: { action_hint: "按权限或频率门恢复。" },
            request_id: "m08-04-state",
            trace_id: "m08-04-state",
          },
        }),
  );
  await page.goto("/platform-admin/files");
  await expect(page.getByText("本机文件接近预警线")).toBeVisible();
  response = {
    ...base,
    state: "blocked",
    findings: [
      { code: "file_checksum_mismatch", severity: "blocked", action_hint: "通过宝塔隔离。" },
    ],
  };
  await page.reload();
  await expect(page.getByText("本机文件韧性门已阻断")).toBeVisible();
  response = null;
  await page.reload();
  await expect(page.getByText("尚无本机文件观测")).toBeVisible();
  for (const [next, label] of [
    [403, "没有平台运维权限"],
    [401, "登录已失效"],
    [429, "刷新过于频繁"],
    [503, "本机文件事实暂不可用"],
  ] as const) {
    status = next;
    await page.reload();
    await expect(page.getByText(label)).toBeVisible();
  }
  await page.goto("/platform-admin/files?state=recovering");
  await expect(page.getByRole("heading", { name: "本机文件韧性" })).toBeVisible();
});
