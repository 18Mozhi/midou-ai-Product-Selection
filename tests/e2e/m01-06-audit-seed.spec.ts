import { test, expect, type Page } from "@playwright/test";
const org = "00000000-0000-4000-8000-000000000621",
  actor = "00000000-0000-4000-8000-000000000622";
const envelope = (data: unknown) => ({
  data,
  request_id: "audit-e2e-request",
  trace_id: "audit-e2e-trace",
});
const authorization = {
  organization_id: org,
  workspace_id: "00000000-0000-4000-8000-000000000623",
  roles: ["auditor"],
  capabilities: ["audit:read"],
  data_scopes: [{ scope: "organization" }],
  platform_roles: ["platform_security_admin"],
  platform_capabilities: ["audit:read", "platform:secure"],
};
const event = {
  id: "00000000-0000-4000-8000-000000000624",
  organization_id: null,
  workspace_id: null,
  actor_id: actor,
  action: "platform_admin.seeded",
  resource_type: "user",
  resource_id: actor,
  outcome: "succeeded",
  request_id: "seed-request-123456",
  trace_id: "seed-trace-123456",
  metadata: {
    email_hash: "7e55afe4",
    role_code: "platform_super_admin",
    forced_security_setup: true,
  },
  occurred_at: "2026-08-07T12:00:00.000Z",
  schema_version: 1,
};
async function ready(page: Page, items = [event]) {
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({ json: envelope(authorization) }),
  );
  await page.route("**/api/v1/platform/audit-events*", (route) =>
    route.fulfill({ json: envelope({ items, nextCursor: null }) }),
  );
  await page.route(`**/api/v1/organizations/${org}/audit-events*`, (route) =>
    route.fulfill({ json: envelope({ items: [], nextCursor: null }) }),
  );
}
test("M01-06.A07/A08/A15 audit view is responsive read-only and keyboard navigable", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/?view=audit-security");
  await expect(page.getByRole("heading", { name: "审计与种子管理员" })).toBeVisible();
  await page.getByRole("button", { name: /成功.*platform_admin.seeded/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("seed-trace-123456")).toBeVisible();
  await expect(page.getByRole("button", { name: /创建|删除|重放|凭证/ })).toHaveCount(0);
});
test("M01-06.A07/A08 organization auditor gets a truthful empty read-only state", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/?view=audit-security");
  await page.getByRole("button", { name: "组织审计" }).click();
  await expect(page.getByText("当前范围暂无审计记录")).toBeVisible();
  await expect(page.getByText("系统不会伪造示例记录；发生受审计行为后再刷新。")).toBeVisible();
});
test("M01-06.A08/A16 forbidden and expired responses show distinct recovery", async ({ page }) => {
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({ json: envelope(authorization) }),
  );
  await page.route("**/api/v1/platform/audit-events*", (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: "permission_denied" }, request_id: "audit-forbidden", trace_id: "t" },
    }),
  );
  await page.goto("/?view=audit-security");
  await expect(page.getByText("无权读取该范围审计")).toBeVisible();
  await expect(page.getByText("请求标识：audit-forbidden")).toBeVisible();
  await page.unroute("**/api/v1/me/authorization");
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "session_invalid" }, request_id: "audit-expired", trace_id: "t" },
    }),
  );
  await page.reload();
  await expect(page.getByText("登录已过期")).toBeVisible();
  await expect(page.getByRole("link", { name: "重新登录" })).toHaveAttribute("href", "/login");
});
test("M01-06.A08/A15 loading state does not expose seed credentials", async ({ page }) => {
  await page.route("**/api/v1/me/authorization", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: envelope(authorization) });
  });
  await page.goto("/?view=audit-security");
  await expect(page.getByText("正在读取不可变审计记录")).toBeVisible();
  await expect(page.getByText(/PLATFORM_ADMIN_SEED_PASSWORD/)).toHaveCount(0);
});
