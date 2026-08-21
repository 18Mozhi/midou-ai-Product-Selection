import { test, expect, type Page } from "@playwright/test";
const org = "00000000-0000-4000-8000-000000000421",
  workspace = "00000000-0000-4000-8000-000000000422";
const envelope = (data: unknown) => ({
  data,
  request_id: "rbac-e2e-request",
  trace_id: "rbac-e2e-trace",
});
const roles = [
  {
    code: "organization_admin",
    name: "组织管理员",
    category: "organization",
    description: "管理当前组织，不可访问平台全局数据。",
    capabilities: [
      "organization:manage",
      "membership:read",
      "membership:manage",
      "workspace:manage",
      "team:manage",
      "role:read",
      "role:manage",
      "audit:read",
    ],
  },
  {
    code: "selection_manager",
    name: "选品经理",
    category: "organization",
    description: "分配任务、审核机会并管理团队视图。",
    capabilities: [
      "task:read",
      "task:assign",
      "opportunity:read",
      "opportunity:approve",
      "team:manage",
    ],
  },
  {
    code: "auditor",
    name: "审计员",
    category: "organization",
    description: "只读业务、报告与授权审计，不可写入。",
    capabilities: ["task:read", "opportunity:read", "audit:read", "report:read", "role:read"],
  },
];
async function ready(page: Page) {
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({
      json: envelope({
        organization_id: org,
        workspace_id: workspace,
        roles: ["organization_admin"],
        capabilities: roles[0].capabilities,
        data_scopes: [{ scope: "organization" }],
      }),
    }),
  );
  await page.route(`**/api/v1/org/${org}/roles`, (route) =>
    route.fulfill({ json: envelope(roles) }),
  );
}
test("M01-04.A07/A08/A15 role matrix is responsive and keyboard navigable", async ({ page }) => {
  await ready(page);
  await page.goto("/?view=authorization");
  await expect(page.getByRole("heading", { name: "角色与权限" })).toBeVisible();
  await page.getByRole("button", { name: /选品经理/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "选品经理" })).toBeVisible();
  await expect(page.getByText("opportunity:approve")).toBeVisible();
});
test("M01-04.A08 empty catalog keeps management denied", async ({ page }) => {
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({
      json: envelope({
        organization_id: org,
        workspace_id: workspace,
        roles: [],
        capabilities: [],
        data_scopes: [],
      }),
    }),
  );
  await page.route(`**/api/v1/org/${org}/roles`, (route) => route.fulfill({ json: envelope([]) }));
  await page.goto("/?view=authorization");
  await expect(page.getByText("暂无活动角色")).toBeVisible();
  await expect(page.getByText("管理动作保持默认拒绝")).toBeVisible();
});
test("M01-04.A08/A16 forbidden catalog names the missing capability", async ({ page }) => {
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({
      json: envelope({
        organization_id: org,
        workspace_id: workspace,
        roles: ["member"],
        capabilities: ["task:read"],
        data_scopes: [{ scope: "own" }],
      }),
    }),
  );
  await page.route(`**/api/v1/org/${org}/roles`, (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: "permission_denied" }, request_id: "rbac-forbidden", trace_id: "t" },
    }),
  );
  await page.goto("/?view=authorization");
  await expect(page.getByText("缺少 role:read 权限")).toBeVisible();
  await expect(page.getByText("请求标识：rbac-forbidden")).toBeVisible();
});
test("M01-04.A08 expired session directs reauthentication", async ({ page }) => {
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "session_invalid" }, request_id: "rbac-expired", trace_id: "t" },
    }),
  );
  await page.goto("/?view=authorization");
  await expect(page.getByText("登录已过期")).toBeVisible();
  await expect(page.getByRole("link", { name: "重新登录" })).toHaveAttribute("href", "/login");
});
