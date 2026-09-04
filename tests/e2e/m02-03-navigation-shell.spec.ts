import { expect, test } from "@playwright/test";

const summary = (shell: "member" | "organization_admin" | "platform_admin") => ({
  shell,
  organization_id: shell === "platform_admin" ? null : "00000000-0000-4000-8000-000000000103",
  workspace_id: shell === "platform_admin" ? null : "00000000-0000-4000-8000-000000000104",
  roles:
    shell === "organization_admin" ? ["organization_admin"] : shell === "member" ? ["member"] : [],
  capabilities:
    shell === "organization_admin"
      ? ["task:read", "organization:manage"]
      : shell === "member"
        ? [
            "task:read",
            "trend:read",
            "opportunity:read",
            "competitor:read",
            "sourcing:read",
            "notification:read",
          ]
        : [],
  platform_roles: shell === "platform_admin" ? ["platform_super_admin"] : [],
  platform_capabilities:
    shell === "platform_admin"
      ? ["platform:operate", "platform:secure", "platform:superadmin"]
      : [],
  guard_reason: `navigation_${shell}_allowed`,
});

async function allow(page: any, shell: "member" | "organization_admin" | "platform_admin") {
  await page.route("**/api/v1/me/navigation?**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: summary(shell),
        request_id: "m02-03-e2e-request",
        trace_id: "m02-03-e2e-trace",
      }),
    }),
  );
  await page.route("**/api/v1/me/home-dashboard", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          actions: [],
          changes: [],
          follows: [],
          health: [],
          scope: {
            organization_id: "00000000-0000-4000-8000-000000000103",
            workspace_id: "00000000-0000-4000-8000-000000000104",
          },
          generated_at: "2026-08-07T16:30:00.000Z",
        },
        request_id: "m02-03-home",
        trace_id: "m02-03-home",
      }),
    }),
  );
  const envelope = (data: unknown) => ({
    data,
    request_id: "m02-03-business",
    trace_id: "m02-03-business",
  });
  await page.route("**/api/v1/org/admin/summary", (route: any) =>
    route.fulfill({
      json: envelope({
        organization: {
          id: "00000000-0000-4000-8000-000000000103",
          name: "Shell Contract Org",
          timezone: "Asia/Shanghai",
          data_retention_days: 365,
          default_workspace_id: "00000000-0000-4000-8000-000000000104",
          version: 1,
        },
        members: { total: 0, active: 0 },
        workspaces: { total: 1, active: 1 },
        teams: { total: 0, active: 0 },
        pending_approvals: 0,
        active_tokens: 0,
        recent_audit_events: 0,
        observed_at: "2026-08-08T00:00:00.000Z",
      }),
    }),
  );
  await page.route("**/api/v1/org/admin/profile", (route: any) =>
    route.fulfill({
      json: envelope({
        id: "00000000-0000-4000-8000-000000000103",
        name: "Shell Contract Org",
        logo_url: null,
        slug: "shell-contract",
        status: "active",
        timezone: "Asia/Shanghai",
        data_retention_days: 365,
        default_workspace_id: "00000000-0000-4000-8000-000000000104",
        version: 1,
        updated_at: "2026-08-08T00:00:00.000Z",
      }),
    }),
  );
  await page.route("**/api/v1/org/admin/workspaces", (route: any) =>
    route.fulfill({
      json: envelope([
        {
          id: "00000000-0000-4000-8000-000000000104",
          name: "Shell Contract Workspace",
          slug: "shell-contract",
          status: "active",
          member_count: 0,
          version: 1,
        },
      ]),
    }),
  );
  await page.route("**/api/v1/platform/dashboard?**", (route: any) =>
    route.fulfill({
      json: envelope({
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
        observed_at: "2026-08-08T00:00:00.000Z",
      }),
    }),
  );
}

for (const item of [
  {
    shell: "member" as const,
    path: "/home",
    heading: "选品控制台",
    snapshot: "m02-03-member.png",
  },
  {
    shell: "organization_admin" as const,
    path: "/org-admin",
    heading: "治理概览",
    snapshot: "m02-03-org-admin.png",
  },
  {
    shell: "platform_admin" as const,
    path: "/platform-admin",
    heading: "平台运行概览",
    snapshot: "m02-03-platform-admin.png",
  },
])
  test(`M02-03.A07/A09/A15 ${item.shell} shell is isolated responsive and visual`, async ({
    page,
  }) => {
    await allow(page, item.shell);
    await page.goto(item.path);
    await expect(page.getByRole("heading", { name: item.heading, level: 2 })).toBeVisible();
    await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
    await expect(page.locator(".role-topbar .role-context")).toHaveCount(0);
    await expect(page.locator(".role-context-rail")).toBeVisible();
    await expect(page.locator(".role-sidebar")).toHaveAttribute(
      "aria-label",
      new RegExp(
        item.shell === "member" ? "成员" : item.shell === "organization_admin" ? "组织" : "平台",
      ),
    );
    await expect(page.getByRole("link", { name: /智能选品/ }).first()).toBeVisible();
    await expect(
      page.getByText(/navigation_(member|organization_admin|platform_admin)_allowed/),
    ).toHaveCount(0);
    const roleLabel =
      item.shell === "member"
        ? "普通成员"
        : item.shell === "organization_admin"
          ? "组织管理员"
          : "平台超级管理员";
    await expect(page.locator(".role-sidebar").getByText(roleLabel)).toBeVisible();
    await expect(
      page
        .locator(".role-sidebar")
        .getByText(item.shell === "platform_admin" ? "platform_super_admin" : item.shell, {
          exact: true,
        }),
    ).toHaveCount(0);
    await expect(page).toHaveScreenshot(item.snapshot, { fullPage: true });
  });

test("platform navigation searches grouped business and advanced operations menus", async ({
  page,
}) => {
  await allow(page, "platform_admin");
  await page.goto("/platform-admin");
  const sidebar = page.locator(".role-sidebar");
  const search = sidebar.getByRole("searchbox", { name: "搜索导航菜单" });
  await search.fill("高级运维");
  await expect(sidebar.getByText("高级运维", { exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "系统运维" })).toBeVisible();
  await expect(sidebar.getByText("业务运营", { exact: true })).toHaveCount(0);
  await search.fill("不存在的菜单");
  await expect(sidebar.getByText("没有匹配的菜单或分组。")).toBeVisible();
});

test("M02-03.A08 mobile drawer is keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await allow(page, "member");
  await page.goto("/home");
  const toggle = page.getByRole("button", { name: "打开导航菜单" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const drawer = page.locator("#role-navigation");
  await expect(drawer).toHaveClass(/is-open/);
  await expect(drawer.getByRole("link", { name: "今日工作" })).toBeVisible();
});

for (const item of [
  { shell: "member" as const, path: "/home" },
  { shell: "organization_admin" as const, path: "/org-admin" },
  { shell: "platform_admin" as const, path: "/platform-admin" },
])
  test(`M02-03 ${item.shell} mobile navigation is four primary items plus more`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await allow(page, item.shell);
    await page.goto(item.path);
    const navigation = page.getByRole("navigation", { name: "移动快捷导航" });
    await expect(navigation.locator(":scope > *")).toHaveCount(5);
    await expect(navigation.getByRole("link")).toHaveCount(4);
    const more = navigation.getByRole("button", { name: "更多" });
    await expect(more).toHaveCount(1);
    await expect(navigation.getByText(/创建选品|邀请成员|新建组织/)).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#role-navigation")).toHaveClass(/is-open/);
  });

for (const item of [
  { shell: "member" as const, path: "/home" },
  { shell: "organization_admin" as const, path: "/org-admin" },
  { shell: "platform_admin" as const, path: "/platform-admin" },
])
  test(`M02-03 ${item.shell} keeps readable copy and 44px controls`, async ({ page }) => {
    await allow(page, item.shell);
    await page.goto(item.path);
    await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");

    const copyViolations = await page
      .locator("#app :is(p, li, dd, td, label, input, select, textarea, button):visible")
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const size = Number.parseFloat(getComputedStyle(element).fontSize);
          return size < 16
            ? [{ tag: element.tagName, text: element.textContent?.trim().slice(0, 40) ?? "", size }]
            : [];
        }),
      );
    expect(copyViolations).toEqual([]);

    const targetViolations = await page
      .locator(
        '#app :is(button, input, select, textarea, [role="button"], .role-mobile-nav a):visible',
      )
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const box = element.getBoundingClientRect();
          return box.width < 44 || box.height < 44
            ? [
                {
                  tag: element.tagName,
                  label:
                    element.getAttribute("aria-label") ??
                    element.textContent?.trim().slice(0, 40) ??
                    "",
                  width: box.width,
                  height: box.height,
                },
              ]
            : [];
        }),
      );
    expect(targetViolations).toEqual([]);
  });

test("M02-03.A16 forbidden shell shows request id and safe recovery", async ({ page }) => {
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "navigation_shell_forbidden",
          message: "权限检查未通过。",
          action_hint: "返回有权访问的工作台。",
        },
        request_id: "m02-03-forbidden",
        trace_id: "m02-03-trace",
      }),
    }),
  );
  await page.goto("/platform-admin");
  await expect(page.getByRole("heading", { name: "无权进入此工作台" })).toBeVisible();
  await expect(page.getByText("关联编号：m02-03-forbidden")).not.toBeVisible();
  await page.getByText("故障详情", { exact: true }).click();
  await expect(page.getByText("关联编号：m02-03-forbidden")).toBeVisible();
  await expect(page.getByRole("link", { name: "返回成员工作台" })).toHaveAttribute("href", "/home");
});

test("M02-03 regression: public root resolves the authenticated landing instead of rendering a broken member shell", async ({
  page,
}) => {
  await page.route("**/api/v1/me/landing", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "session_invalid", message: "请先登录。", action_hint: "重新登录后重试。" },
        request_id: "root-anonymous",
        trace_id: "root-anonymous",
      }),
    }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "欢迎回到智能选品" })).toBeVisible();
});

test("M02-03 platform shell exposes management navigation without member-only shortcuts", async ({
  page,
}) => {
  await allow(page, "platform_admin");
  await page.goto("/platform-admin");
  const sidebar = page.locator(".role-sidebar");
  await expect(page.getByRole("button", { name: /搜索/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "通知中心" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: /通知运营/ })).toHaveAttribute(
    "href",
    "/platform-admin/notifications",
  );
  await expect(page.getByRole("link", { name: "个人中心" })).toHaveAttribute("href", "/me");
  await expect(sidebar.getByRole("link", { name: "组织管理" })).toHaveAttribute(
    "href",
    "/platform-admin/organizations",
  );
  await expect(sidebar.getByRole("link", { name: "用户管理" })).toHaveAttribute(
    "href",
    "/platform-admin/users",
  );
  await expect(sidebar.getByRole("link", { name: "管理员管理" })).toHaveAttribute(
    "href",
    "/platform-admin/admins",
  );
  await expect(page.getByRole("link", { name: /Redis|MySQL|文件韧性|容量边界/ })).toHaveCount(0);
});

test("M02-03 member shell never exposes platform administration navigation", async ({ page }) => {
  await allow(page, "member");
  await page.goto("/home");
  await expect(page.getByRole("link", { name: "组织与用户" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "热点来源" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "安全与审计" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /智能选品/ })).toBeVisible();
});

test("M02-03 explicit routes keep internal navigation reactive and unknown routes unselected", async ({
  page,
}) => {
  await allow(page, "member");
  await page.goto("/home");
  await page.evaluate(() => ((window as any).__scoutopsRouteMarker = "kept"));
  const routeLink =
    (page.viewportSize()?.width ?? 1000) <= 720
      ? page
          .getByRole("navigation", { name: "移动快捷导航" })
          .getByRole("link", { name: "今日工作" })
      : page.locator(".role-sidebar").getByRole("link", { name: "今日工作" });
  await routeLink.click();
  await expect(page).toHaveURL(/\/work$/);
  expect(await page.evaluate(() => (window as any).__scoutopsRouteMarker)).toBe("kept");

  await page.goto("/route-that-does-not-exist");
  await expect(page.getByText("没有找到这个页面")).toBeVisible();
  await expect(page.locator('[aria-current="page"]')).toHaveCount(0);
});

test("M02-03 platform return requires a target context and preserves the member route", async ({
  page,
}) => {
  await allow(page, "member");
  await page.route("**/api/v1/me/navigation?**", (route) => {
    const shell = new URL(route.request().url()).searchParams.get("shell") as
      "member" | "platform_admin";
    const data = summary(shell);
    if (shell === "member") data.platform_roles = ["platform_super_admin"];
    return route.fulfill({
      json: { data, request_id: "route-memory", trace_id: "route-memory" },
    });
  });
  await page.goto("/opportunities?status=watching");
  if ((page.viewportSize()?.width ?? 1000) <= 840)
    await page.getByRole("button", { name: "更多" }).click();
  await page.getByRole("link", { name: "进入管理后台" }).click();
  await expect(page).toHaveURL(/\/platform-admin$/);
  const switchLink = page.getByRole("link", { name: "选择组织与工作区后进入用户工作台" });
  const href = await switchLink.getAttribute("href");
  expect(href).toContain("/select-context");
  expect(href).toContain("return_to=%2Fopportunities%3Fstatus%3Dwatching");
});

test("organization administration returns to the persisted member workspace", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("scoutops:navigation:last-member-route", "/trends?market=US&page=2"),
  );
  await allow(page, "organization_admin");
  await page.goto("/org-admin");
  await expect(page.getByRole("link", { name: "返回成员工作台" })).toHaveAttribute(
    "href",
    "/trends?market=US&page=2",
  );
});

test("member landing restores the last valid member route after refresh", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "scoutops:navigation:last-member-route",
      "/opportunities?status=watching&page=3",
    ),
  );
  await allow(page, "member");
  await page.route("**/api/v1/me/landing", (route) =>
    route.fulfill({
      json: {
        data: { route: "/home" },
        request_id: "member-restore",
        trace_id: "member-restore",
      },
    }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/opportunities\?status=watching&page=3$/);
  await page.reload();
  await expect(page).toHaveURL(/\/opportunities\?status=watching&page=3$/);
});

test("real breadcrumbs are keyboard navigable and mobile secondary pages highlight More", async ({
  page,
}) => {
  await allow(page, "member");
  await page.goto("/opportunities/scoring-rules");
  const breadcrumb = page.getByRole("navigation", { name: "面包屑" });
  const parent = breadcrumb.getByRole("link", { name: "选品机会" });
  await expect(parent).toHaveAttribute("href", "/opportunities");
  await parent.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/opportunities$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/opportunities/scoring-rules");
  await expect(
    page.getByRole("navigation", { name: "移动快捷导航" }).getByRole("button", { name: "更多" }),
  ).toHaveAttribute("aria-current", "page");
});

test("theme continuity and real-height layout hold at 768, 1024 and 1440", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("scoutops:ui-theme", "aurora-purple"));
  await allow(page, "platform_admin");
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/platform-admin");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "aurora-purple");
    await expect(page.getByRole("heading", { name: "平台运行概览", level: 2 })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await expect(page).toHaveScreenshot(`m02-03-platform-${width}.png`, { fullPage: true });
  }
});

test("M02-03 personal center uses an account shell without the organization navigation guard", async ({
  page,
}) => {
  await allow(page, "member");
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: {
        data: { authenticated: true },
        request_id: "account-shell-session",
        trace_id: "account-shell-session",
      },
    }),
  );
  const envelope = (data: unknown) => ({
    data,
    request_id: "account-shell",
    trace_id: "account-shell",
  });
  await page.route("**/api/v1/me/profile", (route) =>
    route.fulfill({
      json: envelope({
        email: "member@example.com",
        email_verified_at: "2026-08-20T00:00:00.000Z",
        display_name: "选品成员",
        avatar_url: null,
        phone: null,
        phone_verified_at: null,
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
        version: 1,
      }),
    }),
  );
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({ json: envelope({ roles: [], capabilities: [], data_scopes: [] }) }),
  );
  await page.route("**/api/v1/me/sessions", (route) => route.fulfill({ json: envelope([]) }));
  await page.route("**/api/v1/me/notification-preferences", (route) =>
    route.fulfill({ json: envelope({ version: 1, in_app_enabled: true }) }),
  );
  await page.route("**/api/v1/me/assets", (route) =>
    route.fulfill({ json: envelope({ followed_trends: [], decisions: [], tasks: [] }) }),
  );
  await page.goto("/me");
  await expect(page.locator(".account-shell")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "个人中心分区" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "个人中心分区" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "选品成员" })).toBeVisible();
});
