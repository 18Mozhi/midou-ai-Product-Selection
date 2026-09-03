import { test, expect, type Page } from "@playwright/test";

const organization = {
  id: "00000000-0000-4000-8000-000000000321",
  name: "华南增长中心",
  slug: "south-growth",
  status: "active",
  timezone: "Asia/Shanghai",
  default_workspace_id: "00000000-0000-4000-8000-000000000322",
  membership_status: "active",
};
const workspace = {
  id: "00000000-0000-4000-8000-000000000322",
  organization_id: organization.id,
  name: "新品决策工作区",
  slug: "new-products",
  status: "active",
  version: 1,
};
const envelope = (data: unknown) => ({
  data,
  request_id: "e2e-request-m01-03",
  trace_id: "e2e-trace-m01-03",
});
async function mockReady(page: Page) {
  await page.route("**/api/v1/org/memberships", (route) =>
    route.fulfill({ json: envelope([organization]) }),
  );
  await page.route(`**/api/v1/org/${organization.id}/workspaces`, (route) =>
    route.fulfill({
      json: envelope([
        workspace,
        {
          ...workspace,
          id: "00000000-0000-4000-8000-000000000323",
          name: "历史归档区",
          slug: "archive",
          status: "archived",
        },
      ]),
    }),
  );
  await page.route(`**/api/v1/org/${organization.id}/teams`, (route) =>
    route.fulfill({
      json: envelope([
        {
          id: "00000000-0000-4000-8000-000000000324",
          organization_id: organization.id,
          name: "趋势研究组",
          status: "active",
          version: 1,
        },
      ]),
    }),
  );
  await page.route("**/api/v1/auth/context", (route) =>
    route.fulfill({
      json: envelope({ organization: { id: organization.id, name: organization.name }, workspace }),
    }),
  );
}

test("M01-03.A07/A08/A15 organization and workspace chooser is responsive and keyboard operable", async ({
  page,
}) => {
  await mockReady(page);
  await page.goto("/select-context");
  await expect(page.getByRole("heading", { name: "选择组织" })).toBeVisible();
  await expect(page.locator('[aria-label="可用工作区"]')).toHaveCount(0);
  await expect(page.getByText("组织团队")).toHaveCount(0);
  await page.getByRole("button", { name: /华南增长中心/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "选择工作区" })).toBeVisible();
  await expect(page.locator('[aria-label="可用工作区"]')).toBeVisible();
  await expect(page.getByText("组织团队")).toBeVisible();
  await page.getByRole("button", { name: /新品决策工作区/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("工作范围已就绪")).toBeVisible();
});

test("M01-03.A08/A16 empty state gives a next action", async ({ page }) => {
  await page.route("**/api/v1/org/memberships", (route) => route.fulfill({ json: envelope([]) }));
  let provisioned = false;
  await page.route("**/api/v1/me/personal-workspace", (route) => {
    provisioned = true;
    return route.fulfill({
      status: 201,
      json: envelope({
        organization: { id: organization.id, name: "我的选品空间" },
        workspace: { ...workspace, name: "默认工作区", slug: "default" },
        created: true,
      }),
    });
  });
  await page.goto("/select-context");
  await expect(page.getByText("暂无可用组织")).toBeVisible();
  await expect(page.getByText("创建个人选品空间后即可直接开始使用。")).toBeVisible();
  await expect(page.getByRole("link", { name: "进入个人中心" })).toHaveAttribute("href", "/me");
  await expect(page.getByRole("link", { name: "管理 MFA" })).toHaveAttribute(
    "href",
    "/security/mfa",
  );
  await page.getByRole("button", { name: "创建并进入选品空间" }).click();
  await expect.poll(() => provisioned).toBe(true);
  await expect(page).toHaveURL(/\/home$/);
});

test("M01-03.A08/A16 forbidden state does not expose another organization", async ({ page }) => {
  await page.route("**/api/v1/org/memberships", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: { code: "organization_forbidden" },
        request_id: "forbidden-request",
        trace_id: "forbidden-trace",
      },
    }),
  );
  await page.goto("/select-context");
  await expect(page.getByText("无权访问该组织")).toBeVisible();
  await expect(page.getByText("请求标识：forbidden-request")).toBeVisible();
});

test("M01-03.A08 expired session offers only reauthentication", async ({ page }) => {
  await page.route("**/api/v1/org/memberships", (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: { code: "session_invalid" },
        request_id: "expired-request",
        trace_id: "expired-trace",
      },
    }),
  );
  await page.goto("/select-context");
  await expect(page.getByText("登录已过期")).toBeVisible();
  await expect(page.getByRole("link", { name: "重新登录" })).toHaveAttribute("href", "/login");
});
