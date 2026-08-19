import { expect, test } from "@playwright/test";

const user = "00000000-0000-4000-8000-000000000621";
const org = "00000000-0000-4000-8000-000000000622";
const ws = "00000000-0000-4000-8000-000000000623";
const session = "00000000-0000-4000-8000-000000000625";
const env = (data: unknown) => ({
  data,
  request_id: "m06-01-platform-e2e",
  trace_id: "m06-01-platform-e2e",
});
const overview = {
  summary: {
    organizations: 3,
    active_organizations: 2,
    users: 18,
    active_users: 16,
    platform_admins: 2,
  },
  organizations: [
    {
      id: org,
      name: "米豆选品团队",
      slug: "midou-team",
      status: "active",
      timezone: "Asia/Shanghai",
      data_retention_days: 365,
      member_count: 8,
      workspace_count: 2,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-18T00:00:00Z",
    },
  ],
  users: [
    {
      id: user,
      email: "buyer@example.test",
      status: "active",
      organization_names: "米豆选品团队",
      platform_roles: [],
      active_session_count: 1,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-18T00:00:00Z",
    },
  ],
  admins: [
    {
      id: "00000000-0000-4000-8000-000000000624",
      email: "admin@example.test",
      status: "active",
      roles: ["platform_super_admin"],
      granted_at: "2026-08-01T00:00:00Z",
    },
  ],
};

async function setup(page: any) {
  await page.route("**/api/v1/me/navigation?**", (route: any) =>
    route.fulfill({
      json: env({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_super_admin"],
        platform_capabilities: ["platform:operate", "platform:superadmin"],
        guard_reason: "navigation_platform_admin_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/platform/accounts?**", (route: any) =>
    route.fulfill({ json: env(overview) }),
  );
}

test("M06-01.A07/A08/A15 novice platform account center separates organizations users and admins", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/platform-admin/accounts");
  await expect(
    page.getByRole("heading", { name: "谁在使用智能选品，一眼看懂" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "组织管理" })).toBeVisible();
  await expect(page.getByRole("button", { name: "用户管理" })).toBeVisible();
  await expect(page.getByRole("button", { name: "管理员管理" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "米豆选品团队 midou-team" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "用户管理" }).click();
  await expect(
    page.getByRole("cell", { name: /buyer@example.test/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "管理员管理" }).click();
  await expect(
    page.getByRole("cell", { name: /admin@example.test/ }),
  ).toBeVisible();
  await expect(page.getByText("admin@example.test", { exact: true })).toHaveCSS(
    "color",
    "rgb(238, 245, 255)",
  );
  await expect(page.locator(".account-table-wrap")).toHaveCSS(
    "color",
    "rgb(238, 245, 255)",
  );
  await expect(page).toHaveScreenshot("m06-01-platform-accounts.png", {
    fullPage: true,
  });
});

test("M06-01.A06/A09 creates organization with audited idempotent request", async ({
  page,
}) => {
  await setup(page);
  let request: any = null;
  await page.route(
    "**/api/v1/platform/accounts/organizations",
    async (route: any) => {
      request = {
        body: route.request().postDataJSON(),
        headers: route.request().headers(),
      };
      await route.fulfill({
        status: 201,
        json: env({
          id: org,
          name: "新团队",
          slug: "new-team",
          status: "active",
          default_workspace_id: ws,
        }),
      });
    },
  );
  await page.goto("/platform-admin/accounts");
  await page.getByRole("button", { name: "新建组织" }).click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "新建组织" }) });
  await dialog.getByLabel("组织名称", { exact: true }).fill("新团队");
  await dialog.getByLabel("组织标识").fill("new-team");
  await dialog.getByRole("button", { name: "确认创建" }).click();
  await expect
    .poll(() => request?.body)
    .toEqual({ name: "新团队", slug: "new-team" });
  expect(request.headers["idempotency-key"]).toBeTruthy();
});

test("M06-01 account actions expose tooltips, user-panel switch, create account and session detail", async ({
  page,
}) => {
  await setup(page);
  let createRequest: any = null;
  await page.route("**/api/v1/platform/accounts/users", async (route: any) => {
    createRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: env({ id: user, email: "new@example.test", status: "active" }),
    });
  });
  await page.route(`**/api/v1/platform/accounts/users/${user}`, (route: any) =>
    route.fulfill({
      json: env({
        user: {
          id: user,
          email: "buyer@example.test",
          status: "active",
          must_change_password: false,
          must_enroll_mfa: false,
        },
        memberships: [
          {
            id: "membership",
            organization_name: "米豆选品团队",
            roles: ["member"],
            status: "active",
          },
        ],
        sessions: [
          {
            id: session,
            status: "active",
            device_label: "Chrome",
            last_seen_at: "2026-08-18T00:00:00Z",
          },
        ],
      }),
    }),
  );
  await page.goto("/platform-admin/accounts");
  await expect(
    page.getByRole("link", { name: "进入用户工作台" }),
  ).toHaveAttribute("href", "/home");
  await expect(page.getByRole("link", { name: "个人中心" })).toHaveAttribute(
    "title",
    "个人中心",
  );
  await page.getByRole("button", { name: "新建用户" }).click();
  const createDialog = page
    .getByRole("dialog")
    .filter({
      has: page.getByRole("heading", { name: "新建用户或平台管理员" }),
    });
  await createDialog
    .getByLabel("邮箱", { exact: true })
    .fill("new@example.test");
  await createDialog
    .getByLabel("临时密码", { exact: true })
    .fill("temporary-password");
  await createDialog.getByRole("button", { name: "确认创建" }).click();
  await expect
    .poll(() => createRequest)
    .toMatchObject({
      email: "new@example.test",
      temporary_password: "temporary-password",
      platform_role_code: null,
      organization_id: null,
    });
  await page.getByRole("button", { name: "用户管理" }).click();
  await page.getByRole("button", { name: "详情" }).click();
  await expect(
    page.getByRole("heading", { name: "buyer@example.test" }),
  ).toBeVisible();
  await expect(page.getByText("Chrome", { exact: true })).toBeVisible();
});
