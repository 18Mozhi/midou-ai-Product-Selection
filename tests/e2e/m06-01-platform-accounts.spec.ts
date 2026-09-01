import { expect, test } from "@playwright/test";

const user = "00000000-0000-4000-8000-000000000621";
const org = "00000000-0000-4000-8000-000000000622";
const ws = "00000000-0000-4000-8000-000000000623";
const session = "00000000-0000-4000-8000-000000000625";
const createdOrg = "00000000-0000-4000-8000-000000000626";
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
const platformRoles = [
  {
    code: "platform_operations_admin",
    name: "平台运营管理员",
    category: "platform",
    description: "管理平台运营，不可读取密钥明文。",
    capabilities: ["platform:operate", "collection:replay", "report:read"],
  },
  {
    code: "platform_security_admin",
    name: "平台安全管理员",
    category: "platform",
    description: "安全治理，对业务数据只读。",
    capabilities: ["platform:secure", "audit:read", "session:manage"],
  },
  {
    code: "platform_super_admin",
    name: "平台超级管理员",
    category: "platform",
    description: "初始化、授权和紧急处置，全部操作审计。",
    capabilities: [
      "platform:operate",
      "platform:secure",
      "platform:superadmin",
      "collection:replay",
      "report:read",
      "audit:read",
      "session:manage",
    ],
  },
];

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
  await page.route("**/api/v1/platform/roles", (route: any) =>
    route.fulfill({ json: env(platformRoles) }),
  );
}

test("platform permission page reads only the real role catalog and preserves comparison state", async ({
  page,
}) => {
  await setup(page);
  let accountRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/platform/accounts")) accountRequests += 1;
  });
  await page.goto("/platform-admin/permissions");
  await expect(page).toHaveTitle("角色权限 · 智能选品");
  await expect(page.getByRole("heading", { name: "核对角色与能力边界" })).toBeVisible();
  await expect(page.getByText("roles + role_capabilities", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(accountRequests).toBe(0);

  await page.getByLabel("右侧角色").selectOption("platform_super_admin");
  await page.getByPlaceholder("搜索权限名称").fill("平台角色");
  await expect(page.getByRole("heading", { name: /管理平台角色与账号/ })).toBeVisible();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("right_role"))
    .toBe("platform_super_admin");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("capability_query"))
    .toBe("平台角色");
  await page.reload();
  await expect(page.getByLabel("右侧角色")).toHaveValue("platform_super_admin");
  await expect(page.getByPlaceholder("搜索权限名称")).toHaveValue("平台角色");
});

test("platform permission page exposes empty and recoverable role catalog states", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/platform/roles", (route: any) => route.fulfill({ json: env([]) }));
  await page.goto("/platform-admin/permissions");
  await expect(page.getByText("角色目录为空", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新检查" })).toBeVisible();
});

test("failed permission refresh keeps the last successful matrix", async ({ page }) => {
  await setup(page);
  let failRefresh = false;
  await page.route("**/api/v1/platform/roles", (route: any) =>
    failRefresh
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: "dependency_unavailable",
              message: "角色目录暂不可用。",
              action_hint: "稍后重试。",
            },
          },
        })
      : route.fulfill({ json: env(platformRoles) }),
  );
  await page.goto("/platform-admin/permissions");
  await expect(page.getByText("仅平台运营管理员").first()).toBeVisible();
  failRefresh = true;
  await page.getByRole("button", { name: "刷新角色目录" }).click();
  await expect(page.getByText(/已保留上次成功读取的权限矩阵/)).toBeVisible();
  await expect(page.getByText("仅平台运营管理员").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "刷新角色目录" })).toBeEnabled();
});

test("permission catalog timeout exposes a retry action instead of an endless loader", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/platform/roles", async (route: any) => {
    await new Promise((resolve) => setTimeout(resolve, 13_000));
    await route.fulfill({ json: env(platformRoles) }).catch(() => undefined);
  });
  await page.goto("/platform-admin/permissions");
  await expect(page.getByText("角色目录读取超过 12 秒，请稍后重试。", { exact: true })).toBeVisible(
    {
      timeout: 15_000,
    },
  );
  await expect(page.getByRole("button", { name: "重新加载" })).toBeEnabled();
});

test("M06-01.A07/A08/A15 novice platform account center separates organizations users and admins", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/platform-admin/accounts");
  await expect(page.getByRole("heading", { name: "查看平台账号使用概况" })).toBeVisible();
  const accountTabs = page.getByRole("navigation", { name: "账号与组织二级导航" });
  await expect(accountTabs.getByRole("link", { name: "组织管理", exact: true })).toBeVisible();
  await expect(accountTabs.getByRole("link", { name: "用户管理", exact: true })).toBeVisible();
  await expect(accountTabs.getByRole("link", { name: "管理员管理", exact: true })).toBeVisible();
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (mobile) {
    await page.getByRole("button", { name: "账号筛选" }).click();
    const filters = page.getByRole("dialog", { name: "账号筛选" });
    await filters.getByPlaceholder("搜索组织名称或用户邮箱").fill("米豆");
    await filters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /账号筛选.*1 项已选/ }).click();
    await expect(filters.getByPlaceholder("搜索组织名称或用户邮箱")).toHaveValue("米豆");
    await filters.getByRole("button", { name: "关闭筛选条件" }).click();
    await page.getByRole("button", { name: /米豆选品团队.*查看详情/ }).click();
    const organizationDetail = page.getByRole("dialog", { name: "米豆选品团队" });
    await expect(organizationDetail.getByText(org, { exact: true })).not.toBeVisible();
    await organizationDetail.getByText("技术详情").click();
    await expect(organizationDetail.getByText(org, { exact: true })).toBeVisible();
    await organizationDetail.getByRole("button", { name: "关闭详情" }).click();
  } else {
    await expect(page.getByRole("cell", { name: "米豆选品团队 midou-team" })).toBeVisible();
  }
  await accountTabs.getByRole("link", { name: "用户管理", exact: true }).click();
  await expect(
    mobile
      ? page.getByRole("button", { name: /buyer@example.test.*查看详情/ })
      : page.getByRole("cell", { name: /buyer@example.test/ }),
  ).toBeVisible();
  await accountTabs.getByRole("link", { name: "管理员管理", exact: true }).click();
  await expect(
    mobile
      ? page.getByRole("button", { name: /admin@example.test.*查看详情/ })
      : page.getByRole("cell", { name: /admin@example.test/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "角色权限差异" })).toBeVisible();
  await expect(page.getByText("仅平台运营管理员").first()).toBeVisible();
  await page.getByLabel("右侧角色").selectOption("platform_super_admin");
  await expect(page.getByText("管理平台角色与账号")).toBeVisible();
  await expect(page.getByText(/platform:operate|platform:superadmin/)).toHaveCount(0);
  await expect(
    mobile
      ? page.getByLabel("管理员记录").getByText("admin@example.test", { exact: true })
      : page.getByRole("table").getByText("admin@example.test", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".account-table-wrap")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("account overview remains usable when the role catalog is unavailable", async ({ page }) => {
  await setup(page);
  let roleRequests = 0;
  await page.route("**/api/v1/platform/roles", (route: any) => {
    roleRequests += 1;
    return route.fulfill({
      status: 503,
      json: {
        error: {
          code: "dependency_unavailable",
          message: "角色目录暂不可用。",
          action_hint: "稍后重试。",
        },
      },
    });
  });
  await page.goto("/platform-admin/accounts");
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  await expect(
    mobile
      ? page.getByRole("button", { name: /米豆选品团队.*查看详情/ })
      : page.getByRole("cell", { name: "米豆选品团队 midou-team" }),
  ).toBeVisible();
  expect(roleRequests).toBe(0);

  await page
    .getByRole("navigation", { name: "账号与组织二级导航" })
    .getByRole("link", { name: "管理员管理", exact: true })
    .click();
  await expect(
    mobile
      ? page.getByRole("button", { name: /admin@example.test.*查看详情/ })
      : page.getByRole("cell", { name: /admin@example.test/ }),
  ).toBeVisible();
  await expect(page.getByText(/账号记录仍可继续使用/)).toBeVisible();
  await expect.poll(() => roleRequests).toBe(3);
});

test("failed duplicate refresh keeps the last successful account facts", async ({ page }) => {
  await setup(page);
  let failRefresh = false;
  let accountRequests = 0;
  await page.route("**/api/v1/platform/accounts?**", (route: any) => {
    accountRequests += 1;
    return failRefresh
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: "dependency_unavailable",
              message: "账号数据暂不可用。",
              action_hint: "稍后重试。",
            },
          },
        })
      : route.fulfill({ json: env(overview) });
  });
  await page.goto("/platform-admin/accounts");
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  const organizationRecord = mobile
    ? page.getByRole("button", { name: /米豆选品团队.*查看详情/ })
    : page.getByRole("cell", { name: "米豆选品团队 midou-team" });
  await expect(organizationRecord).toBeVisible();
  failRefresh = true;
  await page.getByRole("button", { name: "刷新数据" }).evaluate((button: HTMLElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByText(/已保留上次成功读取的数据/)).toBeVisible();
  await expect(organizationRecord).toBeVisible();
  await expect(page.getByRole("button", { name: "刷新数据" })).toBeEnabled();
  expect(accountRequests).toBe(4);
});

test("account overview exposes a recoverable empty filter state", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/platform/accounts?**", (route: any) => {
    const query = new URL(route.request().url()).searchParams.get("query");
    return route.fulfill({
      json: env(query ? { ...overview, organizations: [] } : overview),
    });
  });
  await page.goto("/platform-admin/accounts");
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (mobile) {
    await page.getByRole("button", { name: "账号筛选" }).click();
  }
  const filters = mobile ? page.getByRole("dialog", { name: "账号筛选" }) : page;
  await filters.getByPlaceholder("搜索组织名称或用户邮箱").fill("不存在的组织");
  await filters.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByText("没有符合当前条件的组织", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  if (mobile) {
    await page.getByRole("button", { name: "账号筛选", exact: true }).click();
  }
  await expect(filters.getByRole("button", { name: "重置" })).toBeDisabled();
  await expect(
    (page.viewportSize()?.width ?? 0) <= 760
      ? page.getByRole("button", { name: /米豆选品团队.*查看详情/ })
      : page.getByRole("cell", { name: "米豆选品团队 midou-team" }),
  ).toBeVisible();
});

test("organization list uses organization-specific filters and a recoverable empty state", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/platform/accounts?**", (route: any) => {
    const query = new URL(route.request().url()).searchParams.get("query");
    return route.fulfill({ json: env(query ? { ...overview, organizations: [] } : overview) });
  });
  await page.goto("/platform-admin/organizations");
  await expect(page.getByRole("heading", { name: "管理组织状态与隔离边界" })).toBeVisible();
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (mobile) await page.getByRole("button", { name: "组织筛选" }).click();
  const filters = mobile ? page.getByRole("dialog", { name: "组织筛选" }) : page;
  await expect(filters.getByPlaceholder("搜索组织名称或标识")).toBeVisible();
  await expect(filters.getByLabel("组织状态").locator("option")).toHaveText([
    "全部状态",
    "正常使用",
    "已停用组织",
  ]);
  await filters.getByPlaceholder("搜索组织名称或标识").fill("不存在的组织");
  await filters.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByText("没有符合当前条件的组织", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(
    mobile
      ? page.getByRole("button", { name: /米豆选品团队.*查看详情/ })
      : page.getByRole("cell", { name: "米豆选品团队 midou-team" }),
  ).toBeVisible();
});

test("platform organization list, create and detail are independently deep-linkable", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/platform-admin/organizations/new");
  await expect(page).toHaveURL(/\/platform-admin\/organizations\/new$/);
  const wizard = page.getByRole("dialog", { name: "新建组织" });
  await expect(wizard.getByRole("heading", { name: "新建组织" })).toBeVisible();
  await wizard.getByRole("button", { name: "取消" }).click();
  await expect(page).toHaveURL(/\/platform-admin\/organizations$/);

  await page.goto(`/platform-admin/organizations/${org}`);
  const detail = page.getByRole("dialog", { name: "米豆选品团队" });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "关闭组织详情" }).click();
  await expect(page).toHaveURL(/\/platform-admin\/organizations$/);
});

test("organization detail exposes missing, inline failure, retry success and touch-safe details", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/platform-admin/organizations/00000000-0000-4000-8000-000000000699");
  const missing = page.getByRole("dialog", { name: "未找到组织" });
  await expect(missing.getByRole("heading", { name: "未找到该组织" })).toBeVisible();
  await expect(missing.getByRole("button", { name: "重新加载" })).toBeVisible();

  let attempts = 0;
  await page.route(`**/api/v1/platform/accounts/organizations/${org}`, async (route: any) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        json: {
          error: {
            code: "internal_error",
            message: "内部错误。",
            action_hint: "携带 request_id 联系管理员。",
          },
          request_id: "m06-01-detail-failure",
          trace_id: "m06-01-detail-failure",
        },
      });
      return;
    }
    await route.fulfill({ json: env({ id: org, name: "米豆选品团队" }) });
  });
  await page.goto(`/platform-admin/organizations/${org}`);
  const detail = page.getByRole("dialog", { name: "米豆选品团队" });
  const technicalDetails = detail.getByText("技术详情", { exact: true });
  await expect(technicalDetails).toBeVisible();
  expect((await technicalDetails.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await detail.getByLabel("组织名称", { exact: true }).fill("米豆选品团队更新");
  await detail.getByRole("button", { name: "保存组织资料" }).click();
  await page
    .getByRole("dialog", { name: "保存组织资料" })
    .getByRole("button", { name: "确认执行" })
    .click();
  await expect(detail.getByRole("alert")).toContainText("携带 request_id 联系管理员。");
  await detail.getByRole("button", { name: "保存组织资料" }).click();
  await page
    .getByRole("dialog", { name: "保存组织资料" })
    .getByRole("button", { name: "确认执行" })
    .click();
  await expect(detail.getByRole("status")).toContainText("组织资料已更新。");
  expect(attempts).toBe(2);
});

test("M06-01.A06/A09 creates organization with audited idempotent request", async ({
  page,
}, testInfo) => {
  await setup(page);
  let request: any = null;
  await page.route("**/api/v1/platform/accounts/organizations", async (route: any) => {
    request = {
      body: route.request().postDataJSON(),
      headers: route.request().headers(),
    };
    await route.fulfill({
      status: 201,
      json: env({
        id: createdOrg,
        name: "新团队",
        slug: "new-team",
        status: "active",
        default_workspace_id: ws,
      }),
    });
  });
  await page.goto("/platform-admin/accounts");
  const createOrganizationButton = page.getByRole("button", { name: "新建组织" });
  await createOrganizationButton.click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "新建组织" }) });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(createOrganizationButton).toBeFocused();
  await createOrganizationButton.click();
  const progress = dialog.getByRole("list", { name: "创建组织步骤" });
  await expect(progress.locator('[aria-current="step"]')).toContainText("组织资料");
  await dialog.getByRole("button", { name: "下一步：选择管理员" }).click();
  await expect(progress.locator('[aria-current="step"]')).toContainText("组织资料");
  expect(request).toBeNull();
  await dialog.getByLabel("组织名称", { exact: true }).fill("新团队");
  await dialog.getByLabel("组织标识").fill("bad slug!");
  await dialog.getByRole("button", { name: "下一步：选择管理员" }).click();
  await expect(progress.locator('[aria-current="step"]')).toContainText("组织资料");
  await expect(dialog.getByLabel("组织标识")).toHaveJSProperty("validity.patternMismatch", true);
  expect(request).toBeNull();
  await dialog.getByLabel("组织标识").fill("new-team");
  await dialog.getByRole("button", { name: "下一步：选择管理员" }).click();
  await expect(progress.locator('[aria-current="step"]')).toContainText("管理员与确认");
  await expect(dialog.getByText("同时创建默认工作区和组织级数据范围")).toBeVisible();
  expect(request).toBeNull();
  if (process.platform === "win32" && testInfo.project.name === "mobile-390") {
  }
  await dialog.getByRole("button", { name: "确认创建" }).click();
  await expect.poll(() => request?.body).toEqual({ name: "新团队", slug: "new-team" });
  expect(request.headers["idempotency-key"]).toBeTruthy();
  const detail = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "新团队" }),
  });
  await expect(detail.getByText("组织详情", { exact: true })).toBeVisible();
  await expect(detail.getByRole("button", { name: "保存组织资料" })).toBeVisible();
});

test("organization creation keeps API failures inside the wizard and supports retry", async ({
  page,
}) => {
  await setup(page);
  let attempts = 0;
  await page.route("**/api/v1/platform/accounts/organizations", async (route: any) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 400,
        json: {
          error: {
            code: "organization_slug_invalid",
            message: "组织标识不合法。",
            action_hint: "组织标识使用 2–63 位小写字母、数字或连字符。",
          },
          request_id: "m06-01-create-failure",
          trace_id: "m06-01-create-failure",
        },
      });
      return;
    }
    await route.fulfill({
      status: 201,
      json: env({
        id: createdOrg,
        name: "失败重试团队",
        slug: "retry-team",
        status: "active",
        default_workspace_id: ws,
      }),
    });
  });
  await page.goto("/platform-admin/organizations/new");
  const dialog = page.getByRole("dialog", { name: "新建组织" });
  await dialog.getByLabel("组织名称", { exact: true }).fill("失败重试团队");
  await dialog.getByLabel("组织标识").fill("retry-team");
  await dialog.getByRole("button", { name: "下一步：选择管理员" }).click();
  await dialog.getByRole("button", { name: "确认创建" }).click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText("创建未完成");
  await expect(alert).toContainText("组织标识使用 2–63 位小写字母、数字或连字符。");
  await expect(page).toHaveURL(/\/platform-admin\/organizations\/new$/);
  await dialog.getByRole("button", { name: "确认创建" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform-admin/organizations/${createdOrg}$`));
  expect(attempts).toBe(2);
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
  const switchLink = page.getByRole("link", {
    name: "选择组织与工作区后进入用户工作台",
  });
  await expect(switchLink).toHaveAttribute("href", /\/select-context\?/);
  await expect(switchLink).toHaveAttribute("href", /return_to=%2Fhome/);
  await expect(page.getByRole("link", { name: "个人中心" })).toHaveAttribute("title", "个人中心");
  await page.getByRole("button", { name: "新建用户" }).click();
  const createDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "新建用户或平台管理员" }),
  });
  await createDialog.getByLabel("邮箱", { exact: true }).fill("new@example.test");
  await createDialog.getByLabel("临时密码", { exact: true }).fill("temporary-password");
  await createDialog.getByRole("button", { name: "确认创建" }).click();
  await expect
    .poll(() => createRequest)
    .toMatchObject({
      email: "new@example.test",
      temporary_password: "temporary-password",
      platform_role_code: null,
      organization_id: null,
    });
  await page
    .getByRole("navigation", { name: "账号与组织二级导航" })
    .getByRole("link", { name: "用户管理", exact: true })
    .click();
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    await page.getByRole("button", { name: /buyer@example.test.*查看详情/ }).click();
    const responsiveDetail = page.getByRole("dialog", { name: "buyer@example.test" });
    await responsiveDetail.getByRole("button", { name: "账号详情" }).click();
  } else {
    await page.getByRole("button", { name: "账号详情" }).click();
  }
  await expect(page.getByRole("heading", { name: "buyer@example.test" })).toBeVisible();
  await expect(page.getByText("Chrome", { exact: true })).toBeVisible();
});

test("administrator list persists filters and exposes a desktop and mobile empty state", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/platform/accounts?**", (route: any) => {
    const query = new URL(route.request().url()).searchParams.get("query");
    return route.fulfill({ json: env(query ? { ...overview, admins: [] } : overview) });
  });
  await page.goto("/platform-admin/admins");
  await expect(page.getByRole("heading", { name: "授权、会话与登录状态，一处管理" })).toBeVisible();
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (mobile) await page.getByRole("button", { name: "管理员筛选" }).click();
  const filters = mobile ? page.getByRole("dialog", { name: "管理员筛选" }) : page;
  const search = filters.getByPlaceholder("搜索管理员邮箱");
  await search.fill("missing-admin@example.test");
  await filters.getByRole("button", { name: "搜索" }).click();
  await expect(page).toHaveURL(/query=missing-admin(?:%40|@)example\.test/);
  await expect(page.getByText("没有符合当前条件的管理员", { exact: true })).toBeVisible();
  await page.reload();
  if (mobile) await page.getByRole("button", { name: /管理员筛选.*1 项已选/ }).click();
  const reloadedFilters = mobile ? page.getByRole("dialog", { name: "管理员筛选" }) : page;
  await expect(reloadedFilters.getByPlaceholder("搜索管理员邮箱")).toHaveValue(
    "missing-admin@example.test",
  );
  if (mobile) await reloadedFilters.getByRole("button", { name: "关闭筛选条件" }).click();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page).toHaveURL(/\/platform-admin\/admins$/);
  await expect(
    mobile
      ? page.getByRole("button", { name: /admin@example\.test.*查看详情/ })
      : page.getByRole("cell", { name: /admin@example\.test/ }),
  ).toBeVisible();
});

test("administrator write failures stay inside their active dialogs", async ({ page }) => {
  await setup(page);
  const adminId = overview.admins[0].id;
  await page.route("**/api/v1/platform/accounts/users", (route: any) =>
    route.fulfill({
      status: 409,
      json: {
        error: {
          code: "email_conflict",
          message: "账号已存在。",
          action_hint: "请使用其他邮箱，或进入现有账号详情。",
        },
      },
    }),
  );
  await page.route(`**/api/v1/platform/accounts/users/${adminId}`, (route: any) =>
    route.fulfill({
      json: env({
        user: {
          id: adminId,
          email: "admin@example.test",
          status: "active",
          must_change_password: false,
          must_enroll_mfa: false,
        },
        memberships: [],
        sessions: [],
      }),
    }),
  );
  await page.route(`**/api/v1/platform/accounts/users/${adminId}/status`, (route: any) =>
    route.fulfill({
      status: 409,
      json: {
        error: {
          code: "cannot_disable_self",
          message: "不能停用当前账号。",
          action_hint: "请由另一位超级管理员执行。",
        },
      },
    }),
  );
  await page.goto("/platform-admin/admins");
  await page.getByRole("button", { name: "新建管理员" }).click();
  const createDialog = page.getByRole("dialog", { name: "新建用户或平台管理员" });
  await expect(createDialog.getByLabel("临时密码", { exact: true })).toHaveAttribute(
    "maxlength",
    "128",
  );
  await createDialog.getByLabel("邮箱", { exact: true }).fill("admin@example.test");
  await createDialog.getByLabel("临时密码", { exact: true }).fill("temporary-password");
  await createDialog.getByRole("button", { name: "确认创建" }).click();
  await expect(createDialog.getByRole("alert")).toContainText("请使用其他邮箱");
  await createDialog.getByRole("button", { name: "取消" }).click();

  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (mobile) {
    await page.getByRole("button", { name: /admin@example\.test.*查看详情/ }).click();
    await page
      .getByRole("dialog", { name: "admin@example.test" })
      .getByRole("button", { name: "打开账号详情" })
      .click();
  } else {
    await page.getByRole("button", { name: "账号详情" }).click();
  }
  const detail = page.getByRole("dialog", { name: "admin@example.test" });
  await detail.getByRole("button", { name: "停用登录" }).click();
  await page
    .getByRole("dialog", { name: "停用用户并撤销会话" })
    .getByRole("button", { name: "确认执行" })
    .click();
  await expect(detail.getByRole("alert")).toContainText("请由另一位超级管理员执行");
  await expect(detail).toBeVisible();
});
