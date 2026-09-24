import { expect, test, type Page } from "@playwright/test";

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

async function openAccountRecord(page: Page, email: string) {
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    await page
      .getByRole("button", { name: new RegExp(`${email.replaceAll(".", "\\.")}.*查看详情`) })
      .click();
    await page
      .getByRole("dialog", { name: email, exact: true })
      .getByRole("button", { name: "打开账号详情" })
      .click();
  } else {
    await page
      .getByRole("row")
      .filter({ hasText: email })
      .getByRole("button", { name: "账号详情" })
      .click();
  }
}

for (const scenario of ["stale-success", "stale-error", "reopened-same-user"] as const) {
  test(`UI2-PA01 account detail ownership ${scenario}`, async ({ page }) => {
    await setup(page);
    const second = {
      ...overview.users[0],
      id: "00000000-0000-4000-8000-000000000627",
      email: "second@example.test",
    };
    const current = scenario === "reopened-same-user" ? overview.users[0] : second;
    const payload = (account: typeof second, marker: string) => ({
      user: { ...account, must_change_password: false, must_enroll_mfa: false },
      memberships: [
        {
          id: `membership-${marker}`,
          organization_id: org,
          organization_name: marker,
          roles: ["member"],
          status: "active",
        },
      ],
      sessions: [],
    });
    await page.route("**/api/v1/platform/accounts?**", (route) =>
      route.fulfill({ json: env({ ...overview, users: [overview.users[0], second] }) }),
    );
    let release!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    let reads = 0;
    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes("/api/v1/platform/accounts") &&
        !["GET", "HEAD"].includes(request.method())
      )
        writes.push(request.url());
    });
    await page.route("**/api/v1/platform/accounts/users/*", async (route) => {
      reads += 1;
      if (reads === 1) {
        await pending;
        await route.fulfill(
          scenario === "stale-error"
            ? {
                status: 404,
                json: {
                  error: {
                    code: "account_not_found",
                    message: "旧账号读取失败",
                    action_hint: "旧详情不应污染当前账号",
                  },
                  request_id: "ui2-pa-old",
                  trace_id: "ui2-pa-old",
                },
              }
            : { json: env(payload(overview.users[0], "旧读取组织")) },
        );
      } else {
        expect(new URL(route.request().url()).pathname).toBe(
          `/api/v1/platform/accounts/users/${current.id}`,
        );
        await route.fulfill({ json: env(payload(current, "当前读取组织")) });
      }
    });
    try {
      await page.goto("/platform-admin/users");
      await openAccountRecord(page, overview.users[0].email);
      await expect(
        page.getByRole("dialog", { name: overview.users[0].email, exact: true }),
      ).toContainText("正在读取账号详情");
      await expect.poll(() => reads).toBe(1);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await openAccountRecord(page, current.email);
      const dialog = page.getByRole("dialog", { name: current.email, exact: true });
      await expect(dialog).toContainText("当前读取组织");
      const staleResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/platform/accounts/users/${user}`),
      );
      release();
      await (await staleResponse).finished();
      await page.waitForTimeout(200); // Let the late handler settle before checking negative UI state.
      await expect(dialog).toContainText("当前读取组织");
      await expect(dialog).not.toContainText("旧读取组织");
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      expect(reads).toBe(2);
      expect(writes).toHaveLength(0);
    } finally {
      release();
    }
  });
}

for (const destination of ["shared-account-route", "cached-dashboard"] as const) {
  test(`UI2-PA02 account detail closes on history navigation ${destination}`, async ({ page }) => {
    await setup(page);
    await page.route("**/api/v1/platform/dashboard?**", (route) =>
      route.fulfill({
        json: env({
          window: "24h",
          summary: {
            active_organizations: 0,
            active_users: 0,
            enabled_providers: 0,
            task_success_rate: null,
            queue_backlog: 0,
            open_alerts: 0,
            storage_bytes: 0,
            file_growth_bytes: 0,
          },
          queues: [],
          provider_health: [],
          task_trend: [],
          health_signals: [],
          alerts: [],
          activity: [],
          observed_at: "2026-09-08T00:00:00Z",
        }),
      }),
    );
    let release!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    let reads = 0;
    const writes: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/v1/platform/accounts") && request.method() !== "GET")
        writes.push(request.url());
    });
    await page.route(`**/api/v1/platform/accounts/users/${user}`, async (route) => {
      reads += 1;
      const marker = reads === 1 ? "旧读取组织" : "重新打开后的组织";
      if (reads === 1) await pending;
      await route.fulfill({
        json: env({
          user: { ...overview.users[0], must_change_password: false, must_enroll_mfa: false },
          memberships: [
            {
              id: "membership-ui2-pa",
              organization_id: org,
              organization_name: marker,
              roles: ["member"],
              status: "active",
            },
          ],
          sessions: [],
        }),
      });
    });
    try {
      await page.goto("/platform-admin/users");
      await page.locator("dialog.detail-dialog").waitFor({ state: "attached" });
      const cachedDialog = await page.locator("dialog.detail-dialog").elementHandle();
      if (destination === "shared-account-route") {
        await page
          .getByRole("navigation", { name: "账号与组织二级导航" })
          .getByRole("link", { name: "管理员管理", exact: true })
          .click();
        await expect(page).toHaveURL(/\/platform-admin\/admins$/);
      } else {
        await page
          .getByRole("navigation", { name: "面包屑" })
          .getByRole("link", { name: "平台后台", exact: true })
          .click();
        await expect(page).toHaveURL(/\/platform-admin$/);
        await expect(page.getByText("平台还没有可展示的业务事实", { exact: true })).toBeVisible();
      }
      await page.goBack();
      await expect(page).toHaveURL(/\/platform-admin\/users$/);
      await openAccountRecord(page, overview.users[0].email);
      await expect(page.getByRole("dialog")).toContainText("正在读取账号详情");
      await expect.poll(() => reads).toBe(1);
      await page.goForward();
      await expect(page).toHaveURL(
        destination === "shared-account-route" ? /\/platform-admin\/admins$/ : /\/platform-admin$/,
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const staleResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/platform/accounts/users/${user}`),
      );
      release();
      await (await staleResponse).finished();
      await page.waitForTimeout(200);
      await page.goBack();
      await expect(page).toHaveURL(/\/platform-admin\/users$/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await openAccountRecord(page, overview.users[0].email);
      const dialog = page.getByRole("dialog", { name: overview.users[0].email, exact: true });
      await expect(dialog).toContainText("重新打开后的组织");
      await expect(dialog).not.toContainText("旧读取组织");
      expect(reads).toBe(2);
      expect(
        await cachedDialog?.evaluate(
          (node) => node.isConnected && node === document.querySelector("dialog.detail-dialog"),
        ),
      ).toBe(true); // A route-triggered refresh does not mean the cached Vue surface was remounted.
      expect(writes).toHaveLength(0);
    } finally {
      release();
    }
  });
}

for (const action of ["status", "platform-role", "sessions/revoke", "memberships"] as const) {
  for (const outcome of ["success", "error"] as const) {
    const destinations = [
      "second",
      "stay",
      ...(action === "memberships" ? ["closed", "reopened-same"] : []),
      ...(action === "platform-role" ? ["shared-route", "cached-dashboard"] : []),
    ];
    for (const destination of destinations) {
      test(`UI2-PA03 account write ownership ${action} ${outcome} ${destination}`, async ({
        page,
      }) => {
        await setup(page);
        const second = {
          ...overview.users[0],
          id: "00000000-0000-4000-8000-000000000627",
          email: "second@example.test",
        };
        await page.route("**/api/v1/platform/accounts?**", (route) =>
          route.fulfill({ json: env({ ...overview, users: [overview.users[0], second] }) }),
        );
        if (destination === "cached-dashboard")
          await page.route("**/api/v1/platform/dashboard?**", (route) =>
            route.fulfill({
              json: env({
                window: "24h",
                summary: {
                  active_organizations: 0,
                  active_users: 0,
                  enabled_providers: 0,
                  task_success_rate: null,
                  queue_backlog: 0,
                  open_alerts: 0,
                  storage_bytes: 0,
                  file_growth_bytes: 0,
                },
                queues: [],
                provider_health: [],
                task_trend: [],
                health_signals: [],
                alerts: [],
                activity: [],
                observed_at: "2026-09-08T00:00:00Z",
              }),
            }),
          );
        let release!: () => void;
        const pending = new Promise<void>((resolve) => (release = resolve));
        const writes: Array<{ path: string; body: any; key: string | undefined }> = [];
        const reads: string[] = [];
        await page.route("**/api/v1/platform/accounts/users/**", async (route) => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          if (request.method() !== "GET") {
            writes.push({
              path,
              body: request.postDataJSON(),
              key: request.headers()["idempotency-key"],
            });
            await pending;
            await route.fulfill(
              outcome === "success"
                ? { json: env({ id: user, status: "active" }) }
                : {
                    status: 409,
                    json: {
                      error: {
                        code: "account_operation_conflict",
                        message: "旧账号操作失败",
                        action_hint: "旧账号操作失败，不应显示在当前窗口",
                      },
                    },
                  },
            );
            return;
          }
          reads.push(path);
          const account = path.endsWith(second.id) ? second : overview.users[0];
          await route.fulfill({
            json: env({
              user: { ...account, must_change_password: false, must_enroll_mfa: false },
              memberships: [],
              sessions: [
                {
                  id: session,
                  status: "active",
                  device_label: "测试会话",
                  last_seen_at: "2026-09-08T00:00:00Z",
                },
              ],
            }),
          });
        });
        try {
          await page.goto("/platform-admin/users");
          const navigates = destination === "shared-route" || destination === "cached-dashboard";
          if (navigates) {
            if (destination === "shared-route") {
              await page
                .getByRole("navigation", { name: "账号与组织二级导航" })
                .getByRole("link", { name: "管理员管理", exact: true })
                .click();
              await expect(page).toHaveURL(/\/platform-admin\/admins$/);
            } else {
              await page
                .getByRole("navigation", { name: "面包屑" })
                .getByRole("link", { name: "平台后台", exact: true })
                .click();
              await expect(page).toHaveURL(/\/platform-admin$/);
            }
            await page.goBack();
            await expect(page).toHaveURL(/\/platform-admin\/users$/);
          }
          await openAccountRecord(page, overview.users[0].email);
          const original = page.getByRole("dialog", { name: overview.users[0].email, exact: true });
          await expect(original).toContainText("测试会话");
          const originalNode = await original.elementHandle();
          if (action === "memberships") {
            await original.getByLabel("加入组织", { exact: true }).selectOption(org);
            await original.getByLabel("组织角色", { exact: true }).selectOption("member");
            await original.getByLabel("授权原因", { exact: true }).fill("窗口归属回归");
            await original.getByRole("button", { name: "加入组织", exact: true }).click();
          } else {
            const button =
              action === "status"
                ? "停用登录"
                : action === "platform-role"
                  ? "授予运营管理员"
                  : "撤销全部会话";
            await original.getByRole("button", { name: button, exact: true }).click();
            const reason = page.getByRole("dialog").filter({
              has: page.getByRole("heading", {
                name:
                  action === "status"
                    ? "停用用户并撤销会话"
                    : action === "platform-role"
                      ? "授予运营管理员"
                      : "撤销全部活动会话",
                exact: true,
              }),
            });
            await reason.getByLabel("操作原因", { exact: true }).fill("窗口归属回归");
            await reason.getByRole("button", { name: "确认执行", exact: true }).click();
          }
          await expect.poll(() => writes.length).toBe(1);
          const currentAccount = destination === "second" ? second : overview.users[0];
          if (navigates) {
            await page.goForward();
            await expect(page).toHaveURL(
              destination === "shared-route" ? /\/platform-admin\/admins$/ : /\/platform-admin$/,
            );
            await expect(page.getByRole("dialog")).toHaveCount(0);
          } else if (destination !== "stay") {
            await original.getByRole("button", { name: "关闭账号详情", exact: true }).click();
            if (destination !== "closed") {
              await openAccountRecord(page, currentAccount.email);
              await expect(
                page.getByRole("dialog", { name: currentAccount.email, exact: true }),
              ).toContainText("测试会话");
            }
          }
          const response = page.waitForResponse((item) =>
            item.url().endsWith(`/users/${user}/${action}`),
          );
          release();
          await (await response).finished();
          await page.waitForTimeout(200); // Let both the write and follow-up account read settle.
          if (navigates) {
            await page.goBack();
            await expect(page).toHaveURL(/\/platform-admin\/users$/);
            expect(
              await originalNode?.evaluate(
                (node) =>
                  node.isConnected && node === document.querySelector("dialog.detail-dialog"),
              ),
            ).toBe(true);
          }
          if (destination === "closed" || navigates) {
            await expect(page.getByRole("dialog")).toHaveCount(0);
          } else {
            const current = page.getByRole("dialog", { name: currentAccount.email, exact: true });
            await expect(current).toContainText(currentAccount.email);
            await expect(current.getByRole("alert")).toHaveCount(
              destination === "stay" && outcome === "error" ? 1 : 0,
            );
            await expect(current.getByRole("status")).toHaveCount(
              destination === "stay" && outcome === "success" ? 1 : 0,
            );
          }
          const expectedReads = [`/api/v1/platform/accounts/users/${user}`];
          if (
            destination === "second" ||
            destination === "reopened-same" ||
            (destination === "stay" && outcome === "success")
          )
            expectedReads.push(`/api/v1/platform/accounts/users/${currentAccount.id}`);
          expect(reads).toEqual(expectedReads);
          expect(writes).toHaveLength(1);
          expect(writes[0].path).toBe(`/api/v1/platform/accounts/users/${user}/${action}`);
          expect(writes[0].key).toBeTruthy();
          expect(writes[0].body).toEqual({
            ...(action === "status"
              ? { status: "disabled" }
              : action === "platform-role"
                ? { role_code: "platform_operations_admin", enabled: true }
                : action === "sessions/revoke"
                  ? { session_id: null }
                  : { organization_id: org, role_code: "member" }),
            reason: "窗口归属回归",
          });
        } finally {
          release();
        }
      });
    }
  }
}

test("UI2-PA04 stale account reason cannot submit after route change", async ({ page }) => {
  await setup(page);
  const writes: string[] = [];
  await page.route("**/api/v1/platform/accounts/users/**", async (route) => {
    if (route.request().method() !== "GET") {
      writes.push(route.request().url());
      await route.fulfill({ json: env({ id: user }) });
      return;
    }
    await route.fulfill({
      json: env({
        user: { ...overview.users[0], must_change_password: false, must_enroll_mfa: false },
        memberships: [],
        sessions: [],
      }),
    });
  });
  await page.goto("/platform-admin/users");
  await page
    .getByRole("navigation", { name: "账号与组织二级导航" })
    .getByRole("link", { name: "管理员管理", exact: true })
    .click();
  await expect(page).toHaveURL(/\/platform-admin\/admins$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/platform-admin\/users$/);
  await openAccountRecord(page, overview.users[0].email);
  await page
    .getByRole("dialog", { name: overview.users[0].email, exact: true })
    .getByRole("button", { name: "授予运营管理员", exact: true })
    .click();
  const reason = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "授予运营管理员", exact: true }) });
  await expect(reason).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/platform-admin\/admins$/);
  // Shared reason-dialog route cleanup is a separate boundary; its obsolete action must be inert.
  await reason.getByRole("button", { name: "确认执行", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(200);
  expect(writes).toHaveLength(0);
});

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

test("P45 permission C page keeps a desktop comparison rail and stacks at 760px", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/platform-admin/permissions");

  const shell = page.locator(".account-center--permissions-c");
  const comparison = shell.locator(".role-comparison--permission-page");
  const context = comparison.locator(".role-comparison__context");
  const reading = comparison.locator(".role-comparison__reading");
  const assertColumns = async (sideBySide: boolean) => {
    const [left, right] = await Promise.all([context.boundingBox(), reading.boundingBox()]);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    if (sideBySide) expect(right!.x).toBeGreaterThanOrEqual(left!.x + left!.width - 1);
    else expect(right!.y).toBeGreaterThanOrEqual(left!.y + left!.height - 1);
  };

  await expect(comparison.getByRole("complementary")).toBeVisible();
  await expect(context.locator(".role-comparison__selectors select")).toHaveCount(2);
  await expect(context.locator(".role-comparison__summaries article")).toHaveCount(2);
  await expect(reading.locator(".role-comparison__matrix article")).toHaveCount(6);
  await assertColumns(true);

  for (const width of [1100, 1024, 761]) {
    await page.setViewportSize({ width, height: 1000 });
    await assertColumns(true);
  }
  for (const width of [760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await assertColumns(false);
    await expect
      .poll(() => shell.evaluate((element) => element.scrollWidth <= element.clientWidth))
      .toBe(true);
  }
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
  const undersizedAccountTargets = await page
    .locator(".account-center--review :is(a, button, input, select, summary)")
    .evaluateAll((controls) =>
      controls
        .filter((control) => control.getClientRects().length)
        .map((control) => ({
          label:
            control.textContent?.trim() || control.getAttribute("aria-label") || control.tagName,
          height: control.getBoundingClientRect().height,
        }))
        .filter((control) => control.height < 44),
    );
  expect(undersizedAccountTargets).toEqual([]);
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (mobile) {
    await page.getByRole("button", { name: "账号筛选" }).click();
    const filters = page.getByRole("dialog", { name: "账号筛选" });
    const undersizedFilterTargets = await filters
      .locator("button, input, select")
      .evaluateAll((controls) =>
        controls
          .filter((control) => control.getClientRects().length)
          .map((control) => ({
            label:
              control.textContent?.trim() || control.getAttribute("aria-label") || control.tagName,
            height: control.getBoundingClientRect().height,
          }))
          .filter((control) => control.height < 44),
      );
    expect(undersizedFilterTargets).toEqual([]);
    await expect(filters.getByPlaceholder("搜索组织名称或用户邮箱")).toHaveAccessibleName(
      "搜索组织名称或用户邮箱",
    );
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
    await expect(page.getByPlaceholder("搜索组织名称或用户邮箱")).toHaveAccessibleName(
      "搜索组织名称或用户邮箱",
    );
    await expect(page.getByRole("cell", { name: "米豆选品团队 midou-team" })).toBeVisible();
    const columnTools = page.locator(".table-view-controls__toolbar").first();
    await expect(columnTools.getByText("列设置", { exact: true })).toBeVisible();
    const toolbarControlHeights = await columnTools
      .locator(":is(button, summary, select)")
      .evaluateAll((controls) => controls.map((control) => control.getBoundingClientRect().height));
    expect(toolbarControlHeights.length).toBeGreaterThan(0);
    expect(toolbarControlHeights.every((height) => height >= 44)).toBe(true);
    await columnTools.getByText("列设置", { exact: true }).click();
    const columnRows = await columnTools
      .locator("fieldset > div")
      .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
    expect(columnRows.length).toBeGreaterThan(0);
    expect(columnRows.every((height) => height >= 44)).toBe(true);
  }
  await accountTabs.getByRole("link", { name: "用户管理", exact: true }).click();
  const userWorkspace = page.locator(".account-page-layout--users");
  await expect(
    userWorkspace.getByRole("complementary", { name: "全平台汇总与管理入口" }),
  ).toBeVisible();
  await expect(userWorkspace.getByRole("heading", { name: "用户目录" })).toBeVisible();
  await expect(
    userWorkspace.getByRole("navigation", { name: "账号与组织二级导航" }).getByRole("link", {
      name: "用户管理",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    mobile
      ? page.getByRole("button", { name: /buyer@example.test.*查看详情/ })
      : page.getByRole("cell", { name: /buyer@example.test/ }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("p43-user-directory.png", { fullPage: true });
  const undersizedUserTargets = await userWorkspace
    .locator(":is(a, button, input, select, summary)")
    .evaluateAll((controls) =>
      controls
        .filter((control) => control.getClientRects().length)
        .map((control) => ({
          label:
            control.textContent?.trim() || control.getAttribute("aria-label") || control.tagName,
          height: control.getBoundingClientRect().height,
        }))
        .filter((control) => control.height < 44),
    );
  expect(undersizedUserTargets).toEqual([]);
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
      ? page.getByLabel("管理员记录").getByRole("button", { name: /admin@example\.test/ })
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

test("account overview rereads the latest route filters after an older read settles", async ({
  page,
}) => {
  await setup(page);
  let releaseFirst!: () => void;
  let markFirstStarted!: () => void;
  const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
  const firstStarted = new Promise<void>((resolve) => (markFirstStarted = resolve));
  let latestRequests = 0;
  await page.route("**/api/v1/platform/accounts?**", async (route: any) => {
    const query = new URL(route.request().url()).searchParams.get("query");
    if (query === "older") {
      markFirstStarted();
      await firstGate;
    }
    if (query === "latest") latestRequests += 1;
    await route.fulfill({ json: env(overview) });
  });
  const navigation = page.goto("/platform-admin/accounts?query=older");
  await firstStarted;
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("query", "latest");
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/query=latest/);
  releaseFirst();
  await navigation;
  await expect.poll(() => latestRequests).toBe(1);
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
  await expect(
    page.locator(".account-hero").getByRole("heading", { name: "组织管理" }),
  ).toBeVisible();
  const organizationLayout = page.locator(".account-page-layout--organizations");
  await expect(organizationLayout.getByRole("complementary")).toBeVisible();
  await expect(
    organizationLayout.getByRole("navigation", { name: "账号与组织二级导航" }),
  ).toBeVisible();
  const results = organizationLayout.locator(".account-page-main");
  await expect(results.getByRole("heading", { name: "组织记录" })).toBeVisible();
  await expect(results.getByRole("button", { name: "刷新数据" })).toBeVisible();
  await expect(page.locator(".account-hero").getByRole("button", { name: /刷新/ })).toHaveCount(0);
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (mobile) await page.getByRole("button", { name: "组织筛选" }).click();
  const filters = mobile ? page.getByRole("dialog", { name: "组织筛选" }) : page;
  await expect(filters.getByPlaceholder("搜索组织名称或标识")).toBeVisible();
  await expect(filters.getByLabel("组织名称或标识")).toHaveAttribute(
    "aria-describedby",
    "organization-query-help",
  );
  await expect(filters.getByText("按组织名称或标识查询，不按成员邮箱查询。")).toBeVisible();
  await expect(filters.getByLabel("组织状态").locator("option")).toHaveText([
    "全部状态",
    "正常使用",
    "已停用组织",
  ]);
  await expect(filters.getByText("仅筛选组织状态，不代表成员账号状态。")).toBeVisible();
  if (mobile) {
    await expect(page.locator(".p40-record-counts")).toContainText("成员");
    await expect(page.locator(".p40-record-counts")).toContainText("工作区");
  }
  const undersizedTargets = await page
    .locator(".account-center--organization-review :is(a, button, input, select, summary)")
    .evaluateAll((controls) =>
      controls
        .filter((control) => control.getClientRects().length)
        .map((control) => ({
          label:
            control.textContent?.trim() || control.getAttribute("aria-label") || control.tagName,
          height: control.getBoundingClientRect().height,
        }))
        .filter((control) => control.height < 44),
    );
  expect(undersizedTargets).toEqual([]);
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
  let readAttempts = 0;
  let writeAttempts = 0;
  let writeRequest: { body: unknown; headers: Record<string, string> } | null = null;
  await page.route("**/api/v1/platform/accounts?**", async (route: any) => {
    readAttempts += 1;
    const updated = structuredClone(overview);
    updated.organizations[0].name = "米豆选品团队更新";
    await route.fulfill({ json: env(writeAttempts >= 2 ? updated : overview) });
  });
  await page.route(`**/api/v1/platform/accounts/organizations/${org}`, async (route: any) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    writeAttempts += 1;
    writeRequest = {
      body: route.request().postDataJSON(),
      headers: route.request().headers(),
    };
    if (writeAttempts === 1) {
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
    await route.fulfill({
      json: env({
        id: org,
        name: "米豆选品团队更新",
        timezone: "Asia/Shanghai",
        data_retention_days: 365,
      }),
    });
  });
  await page.goto("/platform-admin/organizations/00000000-0000-4000-8000-000000000699");
  const missing = page.getByRole("dialog", { name: "未找到组织" });
  await expect(missing.getByRole("heading", { name: "当前列表未找到该组织" })).toBeVisible();
  await expect(missing.getByRole("button", { name: "重新加载" })).toBeVisible();

  await page.goto(`/platform-admin/organizations/${org}`);
  const detail = page.locator("dialog.organization-detail-dialog");
  const technicalDetails = detail.getByText("技术详情", { exact: true });
  await expect(technicalDetails).toBeVisible();
  expect((await technicalDetails.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await detail.locator('input[aria-describedby="organization-name-help"]').fill("米豆选品团队更新");
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
  expect(writeAttempts).toBe(2);
  expect(readAttempts).toBeGreaterThanOrEqual(3);
  expect(writeRequest?.body).toMatchObject({
    name: "米豆选品团队更新",
    timezone: "Asia/Shanghai",
    data_retention_days: 365,
  });
  expect(writeRequest?.headers["idempotency-key"]).toBeTruthy();
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
  await expect(detail.getByText("资料与设置", { exact: true })).toBeVisible();
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

test("organization creation keeps a late response from taking over a newer route", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  let writes = 0;
  await page.route("**/api/v1/platform/accounts/organizations", async (route: any) => {
    writes += 1;
    await pending;
    await route.fulfill({
      status: 201,
      json: env({
        id: createdOrg,
        name: "晚到组织",
        slug: "late-org",
        status: "active",
        default_workspace_id: ws,
      }),
    });
  });
  try {
    await page.goto("/platform-admin/organizations/new");
    const dialog = page.getByRole("dialog", { name: "新建组织" });
    await dialog.getByLabel("组织名称", { exact: true }).fill("晚到组织");
    await dialog.getByLabel("组织标识").fill("late-org");
    await dialog.getByRole("button", { name: "下一步：选择管理员" }).click();
    const request = page.waitForRequest(
      (candidate) =>
        candidate.url().includes("/api/v1/platform/accounts/organizations") &&
        candidate.method() === "POST",
    );
    await dialog.getByRole("button", { name: "确认创建" }).click();
    await request;
    await expect.poll(() => writes).toBe(1);
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/\/platform-admin\/organizations$/);
    await page
      .getByLabel("账号与组织二级导航")
      .getByRole("link", { name: "用户管理", exact: true })
      .click();
    await expect(page).toHaveURL(/\/platform-admin\/users$/);
    const response = page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/api/v1/platform/accounts/organizations") &&
        candidate.request().method() === "POST",
    );
    release();
    await (await response).finished();
    await page.waitForTimeout(100);
    await expect(page).toHaveURL(/\/platform-admin\/users$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes).toBe(1);
  } finally {
    release();
  }
});

test("M06-01 account actions expose tooltips, user-panel switch, create account and session detail", async ({
  page,
}) => {
  await setup(page);
  let createRequest: any = null;
  let failListRefresh = false;
  await page.route("**/api/v1/platform/accounts?**", (route: any) =>
    failListRefresh
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: "dependency_unavailable",
              message: "账号数据暂不可用。",
              action_hint: "账号列表刷新未成功。",
            },
          },
        })
      : route.fulfill({ json: env(overview) }),
  );
  await page.route("**/api/v1/platform/accounts/users", async (route: any) => {
    createRequest = route.request().postDataJSON();
    failListRefresh = true;
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
  await expect(page.getByText(/账号已创建，但列表刷新未成功，请手动刷新核对/)).toBeVisible();
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
  const accountDetail = page.locator(".detail-dialog");
  await expect(page.getByRole("heading", { name: "buyer@example.test" })).toBeVisible();
  await expect(accountDetail.getByRole("navigation", { name: "账号详情分区" })).toBeVisible();
  await expect(accountDetail.getByRole("heading", { name: "组织关系" })).toBeVisible();
  await accountDetail.getByRole("button", { name: "平台权限" }).click();
  await expect(accountDetail.getByRole("heading", { name: "平台权限" })).toBeInViewport();
  await accountDetail.getByRole("button", { name: "登录安全" }).click();
  await expect(accountDetail.getByText("Chrome", { exact: true })).toBeVisible();
  const composition = await accountDetail.evaluate((element) => {
    const identity = element.querySelector<HTMLElement>(".user-detail-identity");
    const main = element.querySelector<HTMLElement>(".user-detail-main");
    if (!identity || !main) throw new Error("Account detail composition is incomplete");
    const identityBox = identity.getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();
    return {
      identityX: identityBox.x,
      identityY: identityBox.y,
      mainX: mainBox.x,
      mainY: mainBox.y,
    };
  });
  if ((page.viewportSize()?.width ?? 0) <= 760)
    expect(composition.mainY).toBeGreaterThan(composition.identityY);
  else expect(composition.mainX).toBeGreaterThan(composition.identityX);
  await expect(accountDetail.getByRole("button", { name: "关闭详情" })).toBeVisible();
  await expect
    .poll(() => accountDetail.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
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

test("P44 admin workspace composes the approved C directory and read-only comparison", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/platform-admin/admins");

  const shell = page.locator(".account-center--admins-c");
  const rail = shell.locator(".account-page-rail");
  const main = shell.locator(".account-page-main");
  const assertColumns = async (wide: boolean) => {
    const boxes = await Promise.all([rail.boundingBox(), main.boundingBox()]);
    expect(boxes[0]).not.toBeNull();
    expect(boxes[1]).not.toBeNull();
    if (wide) expect(boxes[0]!.x + boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x + 1);
    else expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height - 1);
  };

  await expect(shell.getByRole("heading", { name: "账号与组织" })).toBeVisible();
  await expect(shell.getByRole("heading", { name: "可授权账号" })).toBeVisible();
  await expect(rail.locator(".account-metrics article")).toHaveCount(3);
  await expect(rail.locator(".account-metrics article:last-child strong")).toHaveText("2");
  await expect(main.locator(".platform-admin-role-comparison")).toBeVisible();
  await assertColumns((page.viewportSize()?.width ?? 0) > 1200);

  await page.setViewportSize({ width: 1200, height: 900 });
  await assertColumns(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertColumns(false);
  await expect
    .poll(() => shell.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);

  await page.getByRole("button", { name: "管理员筛选" }).click();
  const filters = page.getByRole("dialog", { name: "管理员筛选" });
  const search = filters.locator(".admin-filter-field input");
  await expect(search).toHaveAttribute("aria-describedby", "admin-query-help");
  await search.fill("admin@example.test");
  await filters.getByRole("button", { name: "搜索" }).click();
  await expect(page).toHaveURL(/query=admin(?:%40|@)example\.test/);
  await expect(rail.locator(".account-metrics article:last-child strong")).toHaveText("2");

  const comparison = main.locator(".platform-admin-role-comparison");
  await comparison.getByLabel("左侧角色").selectOption("platform_security_admin");
  await expect(comparison.locator(".role-comparison__result")).toContainText("当前显示 0 项能力");
  await expect(page).toHaveURL(/query=admin(?:%40|@)example\.test$/);
  await expect(page).not.toHaveURL(
    /left_role|right_role|show_all|capability_query|capability_group/,
  );
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
