import { chromium, expect, test } from "@playwright/test";

for (const shell of ["member", "organization_admin", "platform_admin"] as const) {
  test(`commerce navigation retains ${shell} access and a usable responsive menu`, async ({
    page,
  }) => {
    await allow(page, shell);
    await page.goto(
      shell === "member"
        ? "/home"
        : shell === "organization_admin"
          ? "/org-admin"
          : "/platform-admin",
    );
    const mobile = (page.viewportSize()?.width ?? 1000) <= 840;
    if (mobile) await page.getByRole("button", { name: "打开导航菜单" }).click();
    const nav = page.locator(mobile ? ".role-sidebar" : ".commerce-sidebar");
    await expect(nav).toBeVisible();
    if (shell === "member") {
      await expect(nav.locator(mobile ? ".role-nav-menu a" : "section a")).toHaveCount(
        mobile ? 4 : 6,
      );
      await expect(nav.getByRole("link", { name: "选品库", exact: true })).toHaveAttribute(
        "href",
        "/opportunities",
      );
      await expect(nav.getByRole("link", { name: "1688 找货", exact: true })).toHaveAttribute(
        "href",
        "/sourcing",
      );
      await expect(nav.locator('a[href^="/platform-admin"]')).toHaveCount(0);
    } else if (shell === "platform_admin") {
      await expect(nav.locator('a[href="/platform-admin/organizations"]')).toHaveCount(1);
      await expect(nav.locator('a[href="/platform-admin/users"]')).toHaveCount(1);
      await expect(nav.locator('a[href="/platform-admin/providers"]')).toHaveCount(1);
    } else {
      await expect(nav.locator('a[href="/org-admin/members"]')).toHaveCount(1);
    }
    if (mobile) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "工作台导航" })).toBeHidden();
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
}

for (const area of [
  {
    shell: "platform_admin",
    home: "/platform-admin",
    label: "组织管理",
    target: "/platform-admin/organizations",
  },
  {
    shell: "organization_admin",
    home: "/org-admin",
    label: "成员与邀请",
    target: "/org-admin/members",
  },
] as const) {
  test(`admin top bar stays stable and searches only its visible navigation: ${area.shell}`, async ({
    page,
  }) => {
    const desktop = page.viewportSize()!.width > 840;
    if (desktop) await page.setViewportSize({ width: 1672, height: 941 });
    await allow(page, area.shell);
    const reads: string[] = [];
    await page.route(/\/api\/v1\/me\/(?:global-search|quick-actions)/, (route) => {
      reads.push(route.request().url());
      return route.abort();
    });
    await page.goto(area.home);
    const top = page.locator(".role-topbar");
    const trigger = top.getByRole("button", { name: "搜索后台功能" });
    await expect(trigger).toBeVisible();
    const before = (await trigger.boundingBox())!;
    const topbar = await top.elementHandle();
    if (desktop) {
      await expect(top.getByRole("link", { name: "切换组织与工作区" })).toBeVisible();
      await top.getByLabel("导航帮助").click();
      await expect(top.getByText("使用侧栏切换工作台，在个人中心调整外观。")).toBeVisible();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+k");
    } else await trigger.click();
    const dialog = page.getByRole("dialog", { name: "搜索后台功能" });
    const input = dialog.getByRole("searchbox");
    await expect(input).toBeFocused();
    await input.fill("候选商品");
    await expect(dialog.getByRole("status")).toHaveText("没有匹配的后台功能。");
    await input.fill(area.label);
    const match = dialog.getByRole("link", { name: new RegExp(area.label) });
    await expect(match).toHaveAttribute("href", area.target);
    await match.click();
    await expect(page).toHaveURL(new RegExp(`${area.target}$`));
    await expect(dialog).toBeHidden();
    expect(await topbar?.evaluate((el) => el.isConnected)).toBe(true);
    const after = (await trigger.boundingBox())!;
    expect(after.width).toBe(before.width);
    if (desktop) expect(after.x).toBe(before.x);
    await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    expect(reads).toEqual([]);
  });
}

test("core member titles and breadcrumbs use the current navigation names", async ({ page }) => {
  await allow(page, "member");
  for (const [path, title, heading, level] of [
    ["/trends", "市场情报", /^市场情报/, 2],
    ["/opportunities", "选品库", /^选品库$/, 2],
    ["/sourcing", "1688 找货", /^供应链找货$/, 1],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level })).toBeVisible();
    const breadcrumb = page.getByRole("navigation", { name: "面包屑" });
    await expect(breadcrumb).toContainText(title);
    await expect(breadcrumb.getByRole("link", { name: "选品工作区", exact: true })).toHaveAttribute(
      "href",
      "/home",
    );
  }
  await page
    .getByRole("navigation", { name: "面包屑" })
    .getByRole("link", { name: "选品工作区", exact: true })
    .click();
  await expect(page).toHaveURL(/\/home$/);
});

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
          automatic_selection: {
            state: "not_configured",
            enabled_rule_count: 0,
            candidate_count: 0,
            rule_candidate_count: 0,
            recommended_count: 0,
            awaiting_evidence_count: 0,
            adopted_count: 0,
            recommended_items: [],
            last_collection_at: null,
            next_collection_at: null,
          },
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
  await page.route("**/api/v1/trends/monitoring-rules", (route: any) =>
    route.fulfill({ json: envelope([]) }),
  );
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
    heading: "选品工作台",
    snapshot: "m02-03-member-commerce-20261017.png",
  },
  {
    shell: "organization_admin" as const,
    path: "/org-admin",
    heading: "治理概览",
    snapshot: "m02-03-org-admin-commerce-20261017.png",
  },
  {
    shell: "platform_admin" as const,
    path: "/platform-admin",
    heading: "平台运行概览",
    snapshot: "m02-03-platform-admin-commerce-20261017.png",
  },
])
  test(`M02-03.A07/A09/A15 ${item.shell} shell is isolated responsive and visual`, async ({
    page,
  }, testInfo) => {
    await allow(page, item.shell);
    await page.goto(item.path);
    await expect(page.getByRole("heading", { name: item.heading }).first()).toBeVisible();
    await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
    if (item.shell === "platform_admin") {
      await expect(
        page.getByText("先检查来源配置与采集任务，或创建组织。", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/系统仍会继续自动获取热点/)).toHaveCount(0);
    }
    await expect(page.locator(".role-nav-groups details[open]")).not.toHaveCount(0);
    await expect(page.locator(".role-topbar .role-context")).toHaveCount(0);
    if (testInfo.project.name === "mobile-390") {
      await expect(page.locator(".role-context-rail")).toBeHidden();
      await expect(page.locator(".role-context-drawer")).toHaveCount(0);
    } else {
      await expect(page.locator(".role-workspace-identity")).toBeVisible();
      await expect(page.locator(".role-context-drawer")).toBeHidden();
    }
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
    await expect(page.locator(".role-shell")).not.toContainText(/已连接\s*·\s*可复核/);
    if (testInfo.project.name === "mobile-390") {
      const toggle = page.getByRole("button", { name: "打开导航菜单" });
      await toggle.click();
      await expect(page.locator(".role-navigation-frame")).toBeVisible();
      await expect(page.locator(".role-nav-groups details[open]").first()).toBeVisible();
      await expect(page.locator(".role-nav-menu").first()).toBeVisible();
      await expect(page.locator(".role-sidebar").getByText(roleLabel)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await toggle.evaluate((element: HTMLButtonElement) => element.blur());
    } else {
      await expect(page.locator(".commerce-sidebar")).toBeVisible();
      await expect(page.locator(".role-desktop-navigation, .role-page-tabs")).toHaveCount(0);
      await expect(page.locator(".role-navigation-frame")).toBeHidden();
    }
    await expect(
      page
        .locator(".role-sidebar")
        .getByText(item.shell === "platform_admin" ? "platform_super_admin" : item.shell, {
          exact: true,
        }),
    ).toHaveCount(0);
    await expect(page).toHaveScreenshot(item.snapshot, { fullPage: true });
  });

test("platform navigation exposes grouped menus on desktop and searchable mobile drawer", async ({
  page,
}) => {
  await allow(page, "platform_admin");
  await page.goto("/platform-admin");
  if ((page.viewportSize()?.width ?? 1000) <= 840) {
    await page.getByRole("button", { name: "打开导航菜单" }).click();
    const sidebar = page.locator(".role-sidebar");
    await sidebar.getByRole("searchbox", { name: "搜索导航菜单" }).fill("高级运维");
    await expect(sidebar.getByRole("link", { name: "系统运维" })).toBeVisible();
    await sidebar.getByRole("searchbox", { name: "搜索导航菜单" }).fill("不存在的菜单");
    await expect(sidebar.getByText("没有匹配的菜单或分组。")).toBeVisible();
  } else {
    const desktop = page.locator(".commerce-sidebar");
    await expect(desktop.getByRole("heading", { name: "高级运维", exact: true })).toBeVisible();
    await expect(desktop.getByRole("link", { name: "系统运维" })).toBeVisible();
    await expect(desktop.getByRole("heading", { name: "业务运营", exact: true })).toBeVisible();
    await expect(desktop.getByRole("link", { name: "组织管理" })).toBeVisible();
    await expect(desktop.getByRole("link", { name: "系统运维" })).toBeVisible();
  }
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
  const dialog = page.locator(".role-navigation-frame");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty("open", true);
  await expect(dialog.locator(".role-navigation-close")).toBeFocused();
  await expect(drawer.getByRole("link", { name: "选品工作台" })).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  const lastControl = dialog
    .locator("a[href]:visible, button:visible, input:visible, summary:visible, [tabindex]:visible")
    .last();
  await expect(lastControl).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.locator(".role-navigation-close")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("mobile navigation closes and restores focus when crossing to desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await allow(page, "member");
  await page.goto("/home");
  const toggle = page.getByRole("button", { name: "打开导航菜单" });
  await toggle.click();
  await expect(page.locator(".role-navigation-frame")).toBeVisible();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(page.locator(".role-navigation-frame")).toBeHidden();
  await expect(page.locator(".role-navigation-frame")).toHaveJSProperty("open", false);
  await expect(page.locator(".commerce-sidebar")).toBeVisible();
  await expect(toggle).toBeHidden();
  await expect(page.getByRole("link", { name: "米兜智能选品" })).toBeFocused();
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
    const themeButton = page.getByRole("button", { name: "切换界面主题" });
    if (item.shell === "member") await expect(themeButton).toHaveCount(0);
    else {
      await expect(themeButton).toBeVisible();
      await expect(themeButton).toBeInViewport();
    }
    await expect(page.locator(".role-context-rail")).toHaveCount(0);
    await expect(page.locator(".role-context-drawer")).toHaveCount(0);
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
    await expect(page.locator(".role-navigation-frame")).toHaveJSProperty("open", true);
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
          return size < 13
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
          // DOMRect can represent an exact 44 CSS pixels as 43.99998.
          return Math.round(box.width * 100) / 100 < 44 || Math.round(box.height * 100) / 100 < 44
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
  await expect(page.getByRole("heading", { name: "安全登录" })).toBeVisible();
});

test("M02-03 platform shell exposes management navigation without member-only shortcuts", async ({
  page,
}) => {
  await allow(page, "platform_admin");
  await page.goto("/platform-admin");
  const sidebar = page.locator(
    (page.viewportSize()?.width ?? 1000) <= 840 ? ".role-sidebar" : ".commerce-sidebar",
  );
  if ((page.viewportSize()?.width ?? 1000) <= 840)
    await page.getByRole("button", { name: "更多" }).click();
  await expect(page.getByRole("button", { name: "全局搜索", exact: true })).toHaveCount(0);
  await expect(
    page.locator(".role-topbar").getByRole("button", { name: "搜索后台功能" }),
  ).toHaveCount(1);
  await expect(page.getByRole("link", { name: "通知中心" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: /通知运营/ })).toHaveAttribute(
    "href",
    "/platform-admin/notifications",
  );
  if ((page.viewportSize()?.width ?? 1000) > 840) {
    await page.getByLabel("账号菜单", { exact: true }).click();
    await expect(
      page.locator(".midou-account-menu").getByRole("link", { name: "个人中心" }),
    ).toHaveAttribute("href", "/me");
  }
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
    (page.viewportSize()?.width ?? 1000) <= 840
      ? page
          .getByRole("navigation", { name: "移动快捷导航" })
          .getByRole("link", { name: "选品库", exact: true })
      : page.locator(".commerce-sidebar").getByRole("link", { name: "选品库", exact: true });
  await routeLink.click();
  await expect(page).toHaveURL(/\/opportunities$/);
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
  if ((page.viewportSize()?.width ?? 1000) <= 840)
    await page.getByRole("button", { name: "更多" }).click();
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
  if ((page.viewportSize()?.width ?? 1000) <= 840)
    await page.getByRole("button", { name: "更多" }).click();
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
  const parent = breadcrumb.getByRole("link", { name: "选品库" });
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

test("desktop masthead search keeps icon and shortcut inside the field at narrow widths", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop topbar controls");
  await page.setViewportSize({ width: 1101, height: 900 });
  await allow(page, "member");
  await page.goto("/home");
  const bar = page.locator(".role-topbar");
  const search = bar.getByRole("button", { name: "全局搜索", exact: true });
  await expect(search).toBeVisible();
  for (const width of [1101, 1200, 1280, 1440, 1600, 1717]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await search.evaluate((node) => {
      const icon = node.querySelector("svg")!.getBoundingClientRect();
      const label = node.querySelector("span")!.getBoundingClientRect();
      const key = node.querySelector("kbd")!.getBoundingClientRect();
      const help = node
        .parentElement!.querySelector(".midou-top-help > summary")!
        .getBoundingClientRect();
      const field = node.getBoundingClientRect();
      return {
        iconVisible: icon.width >= 16 && icon.left >= field.left,
        labelRoom: label.width > 0 && label.right <= key.left + 1,
        shortcutInside: key.right <= field.right + 1 && key.right <= help.left + 1,
      };
    });
    expect(bounds, `width=${width}`).toEqual({
      iconVisible: true,
      labelRoom: true,
      shortcutInside: true,
    });
  }
  await search.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("long workspace names preserve the current desktop breadcrumb", async ({ page }) => {
  await page.setViewportSize({ width: 1101, height: 850 });
  await allow(page, "platform_admin");
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      json: {
        data: {
          ...summary("platform_admin"),
          organization_name: "跨境选品业务数据与供应链管理组织".repeat(4),
          workspace_name: "北美业务线年度商品研究工作区".repeat(4),
        },
        request_id: "long-context-reference",
        trace_id: "long-context-reference",
      },
    }),
  );
  await page.goto("/platform-admin/providers/sources/1688-acceptance");
  const breadcrumb = page.getByRole("navigation", { name: "面包屑", exact: true });
  await expect(breadcrumb).toHaveCount(1);
  const current = breadcrumb.locator('[aria-current="page"]');
  await expect(current).toHaveText("1688 启用检查");
  const measure = () =>
    current.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      const nav = node.closest("nav")!.getBoundingClientRect();
      return {
        available: node.clientWidth,
        needed: node.scrollWidth,
        visible: text.right <= nav.right + 1,
      };
    });
  const widths = await measure();
  expect(widths.available).toBeGreaterThanOrEqual(widths.needed);
  expect(widths.visible).toBe(true);
  const context = page.locator(".midou-top-context");
  await expect(context).toBeVisible();
  const label = await context
    .locator("span")
    .evaluate((node) => [node.clientWidth, node.scrollWidth]);
  expect(label[0]).toBeGreaterThan(0);
  expect(label[0]).toBeLessThan(label[1]!);
  const sidebarContext = page.getByRole("link", { name: "选择组织与工作区后进入用户工作台" });
  await expect(sidebarContext).toHaveAttribute(
    "title",
    "北美业务线年度商品研究工作区".repeat(4) + " · " + "跨境选品业务数据与供应链管理组织".repeat(4),
  );
  await breadcrumb.getByRole("link", { name: "平台后台", exact: true }).click();
  await expect(page).toHaveURL(/\/platform-admin$/);
  await expect(current).toHaveText("平台概览");
  expect((await measure()).visible).toBe(true);
  await expect(page.getByRole("button", { name: "搜索后台功能", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
    await expect(page).toHaveScreenshot(`m02-03-platform-${width}-commerce-20261017.png`, {
      fullPage: true,
    });
  }
});

test("M02-03 personal center shares chrome without depending on organization navigation approval", async ({
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
  let accountGuardReads = 0;
  page.on("request", (request) => {
    if (request.url().includes("/me/navigation?")) accountGuardReads++;
  });
  await page.goto("/me");
  await expect(page.locator(".account-shell")).toBeVisible();
  const accountDirectory = page.getByRole("navigation", { name: "个人中心分区" });
  await expect(accountDirectory).toBeVisible();
  for (const name of [
    "基本资料：账号信息",
    "我的权限：角色与范围",
    "安全与设备：密码与会话",
    "通知偏好：五项通知设置",
    "我的资产：关注、决策与任务",
    "外观偏好：主题与密度",
  ]) {
    await expect(accountDirectory.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("complementary", { name: "个人中心分区" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "选品成员" })).toBeVisible();
  await expect(page.locator(".midou-profile-grid")).toBeVisible();
  expect(accountGuardReads).toBe(1);
});

test("commerce organization overview fits phone tablet and desktop widths", async ({ page }) => {
  await allow(page, "organization_admin");
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/org-admin");
    await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
    await expect
      .poll(() =>
        page.evaluate(() => {
          if (document.documentElement.scrollWidth <= innerWidth) return [];
          return Array.from(document.querySelectorAll("#app *"))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.right > innerWidth + 1;
            })
            .slice(0, 8)
            .map((el) => ({
              element: el.tagName + "." + el.className,
              width: Math.round(el.getBoundingClientRect().width),
              viewport: innerWidth,
            }));
        }),
      )
      .toEqual([]);
    const form = page.locator("form.organization-profile-editor");
    const box = await form.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  }
});

test("wide masthead height stays constant across member organization and platform routes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide masthead geometry");
  await page.setViewportSize({ width: 1672, height: 900 });
  await allow(page, "member");
  await page.route("**/api/v1/me/navigation?**", (route) => {
    const role = new URL(route.request().url()).searchParams.get("shell") as
      "member" | "organization_admin" | "platform_admin";
    const data = summary(role);
    if (role !== "platform_admin") {
      data.platform_roles = ["platform_super_admin"];
      data.roles = ["organization_admin"];
    }
    return route.fulfill({ json: { data, request_id: "wide-shell", trace_id: "wide-shell" } });
  });
  await page.goto("/home");
  const tabs = page.getByRole("navigation", { name: "工作台类型" });
  const masthead = page.locator(".role-topbar");
  const rail = page.getByRole("complementary", { name: "工作区导航" });
  const check = async (expectedRole: "member" | "organization_admin" | "platform_admin") => {
    const member = expectedRole === "member";
    await expect(page.locator(".role-shell")).toHaveAttribute("data-shell", expectedRole);
    await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
    expect((await masthead.boundingBox())!.height).toBe(64);
    await expect(rail).toHaveCSS("top", "64px");
    const surfaces = await page.locator(".role-shell").evaluate((shell) => {
      const color = (selector: string) =>
        getComputedStyle(shell.querySelector(selector)!).backgroundColor;
      return [color(".role-topbar"), color(".commerce-sidebar"), color(".role-content")];
    });
    expect(surfaces[0]).toMatch(/^color\(srgb /);
    expect(surfaces[0]).toBe(surfaces[1]);
    expect(surfaces[2]).not.toBe(surfaces[0]);
    await expect(rail).toHaveCSS("font-family", /DengXian/);
    await expect(masthead.locator("[data-navigation-search]")).toHaveCSS("font-family", /DengXian/);
    await expect(masthead.getByRole("link", { name: "切换组织与工作区" })).toHaveCSS(
      "min-height",
      "40px",
    );
    const help = masthead.getByLabel("导航帮助", { exact: true });
    await expect(help).toHaveCSS("min-height", "44px");
    await expect(help.locator("svg")).toHaveAttribute("aria-hidden", "true");
    const memberBell = masthead.getByRole("link", { name: "通知中心", exact: true });
    if (member) {
      await expect(memberBell).toHaveAttribute("href", "/notifications");
      await expect(memberBell.locator("svg")).toHaveAttribute("aria-hidden", "true");
    } else {
      await expect(memberBell).toHaveCount(0);
    }
    const settings = rail.getByRole("link", { name: "设置", exact: true });
    await expect(settings).toHaveAttribute("href", "/me?section=appearance");
    const account = masthead.locator(".midou-account-menu > summary");
    await expect(account).toHaveCSS("column-gap", "9px");
    const chevron = account.locator(":scope > svg");
    await expect(chevron).toHaveCSS("rotate", "90deg");
    await account.focus();
    await page.keyboard.press("Enter");
    await expect(chevron).toHaveCSS("rotate", "-90deg");
    await page.keyboard.press("Escape");
    await expect(chevron).toHaveCSS("rotate", "90deg");
    const switcher = rail.getByRole("link", { name: "侧栏切换工作区", exact: true });
    if (await switcher.count()) {
      await expect(switcher).toHaveText("切换工作区");
      await expect(switcher).toHaveCSS("padding-inline-start", "14px");
      await expect(switcher).toHaveCSS("padding-inline-end", "14px");
      await expect(switcher.locator("small")).toHaveCount(0);
      await expect(switcher.locator("svg").first().locator("path")).toHaveAttribute(
        "d",
        /^m12 2 10 5/,
      );
      await expect(switcher).toHaveAttribute("href", "/select-context");
    }
    await expect(tabs).toHaveCSS("border-radius", member ? "999px" : "9px");
    const activeTab = tabs.locator('a[aria-current="page"]');
    await expect(activeTab).toHaveCount(1);
    await expect(activeTab).toHaveCSS("border-radius", member ? "999px" : "6px");
    await expect(activeTab).toHaveCSS("font-weight", "600");
    for (const tab of await tabs.locator("a, span").all()) {
      await expect(tab).toHaveCSS("font-size", member ? "16px" : "15px");
    }
    for (const tab of await tabs.locator('a:not([aria-current="page"])').all()) {
      await expect(tab).toHaveCSS("font-weight", "500");
    }
    await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  };
  await check("member");
  await tabs.getByRole("link", { name: "组织", exact: true }).click();
  await expect(page).toHaveURL(/\/org-admin$/);
  await check("organization_admin");
  const tools = masthead.locator(".role-top-actions");
  const adminTools = async () => {
    await expect(tools).toHaveCSS("gap", "24px");
    return Promise.all([
      tools.locator(".midou-top-help > summary").boundingBox(),
      tools.getByRole("button", { name: "切换界面主题", exact: true }).boundingBox(),
      tools.locator(".midou-account-menu > summary").boundingBox(),
    ]);
  };
  const organizationTools = await adminTools();
  await tabs.getByRole("link", { name: "平台", exact: true }).click();
  await expect(page).toHaveURL(/\/platform-admin$/);
  await check("platform_admin");
  const platformTools = await adminTools();
  for (const [index, tool] of platformTools.entries())
    expect(tool!.x).toBeCloseTo(organizationTools[index]!.x, 0);
  await page.setViewportSize({ width: 1672, height: 941 });
  await check("platform_admin");
});

test("mid-width admin mastheads keep search geometry stable across roles and routes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop masthead geometry");
  await allow(page, "organization_admin");
  await page.route("**/api/v1/me/navigation?**", (route) => {
    const shell = new URL(route.request().url()).searchParams.get("shell") as
      "member" | "organization_admin" | "platform_admin";
    const data = summary(shell);
    data.roles = ["organization_admin"];
    data.platform_roles = ["platform_super_admin"];
    return route.fulfill({
      json: { data, request_id: "admin-mid-width", trace_id: "admin-mid-width" },
    });
  });
  const masthead = page.locator(".role-topbar");
  const rail = page.getByRole("complementary", { name: "工作区导航" });
  const search = masthead.getByRole("button", { name: "搜索后台功能", exact: true });
  const measure = async () => {
    await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
    await expect(search).toBeVisible();
    await expect(masthead.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    return search.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return {
        width: Math.round(box.width),
        x: Math.round(box.x),
        height: box.height,
        radius: getComputedStyle(node).borderRadius,
        gap: getComputedStyle(node.parentElement!).columnGap,
      };
    });
  };
  for (const width of [1560, 1599]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/org-admin");
    const baseline = await measure();
    expect(baseline).toMatchObject({
      width: Math.round(width * 0.21),
      height: 38,
      radius: "8px",
      gap: "20px",
    });
    await rail.getByRole("link", { name: "成员与邀请", exact: true }).click();
    await expect(page).toHaveURL(/\/org-admin\/members$/);
    expect(await measure()).toEqual(baseline);
    await rail.getByRole("link", { name: "平台", exact: true }).click();
    await expect(page).toHaveURL(/\/platform-admin$/);
    expect(await measure()).toEqual(baseline);
    await rail.getByRole("link", { name: "组织管理", exact: true }).click();
    await expect(page).toHaveURL(/\/platform-admin\/organizations$/);
    expect(await measure()).toEqual(baseline);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test("native document scrollbar does not move shared navigation between short and long routes", async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Native desktop scrollbar");
  const browser = await chromium.launch({
    ...testInfo.project.use.launchOptions,
    ignoreDefaultArgs: ["--hide-scrollbars"],
  });
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 1672, height: 1000 } });
    await allow(page, "organization_admin");
    await page.goto("/org-admin");
    const shell = page.locator(".role-shell");
    const rail = page.getByRole("complementary", { name: "工作区导航" });
    const top = page.locator(".role-topbar");
    const read = () =>
      page.evaluate(() => {
        const root = document.documentElement;
        const rect = (selector: string) => {
          const { x, width } = document.querySelector(selector)!.getBoundingClientRect();
          return { x, width };
        };
        return {
          overflow: root.scrollHeight > innerHeight,
          overflowsX: root.scrollWidth > root.clientWidth + 1,
          nativeScrollbar: innerWidth - root.clientWidth,
          gutter: innerWidth - rect(".role-shell").width,
          top: rect(".role-topbar"),
          search: rect("[data-navigation-search]"),
          rail: rect(".commerce-sidebar"),
          content: rect(".role-content"),
        };
      });
    await expect(shell).toHaveAttribute("data-state", "ready");
    await expect(page.getByRole("heading", { name: "更新组织资料", exact: true })).toBeVisible();
    const short = await read();
    await rail.getByRole("link", { name: "工作区管理", exact: true }).click();
    await expect(page).toHaveURL(/\/org-admin\/workspaces$/);
    await expect(
      page.locator(".role-content").getByText("Shell Contract Workspace", { exact: true }).first(),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight))
      .toBeGreaterThan(1000);
    const long = await read();
    console.log("native route geometry", JSON.stringify({ short, long }));
    expect(short.overflow).toBe(false);
    expect(long.overflow).toBe(true);
    expect(short.nativeScrollbar).toBe(0);
    expect(long.nativeScrollbar).toBeGreaterThan(0);
    expect(long.gutter).toBe(long.nativeScrollbar);
    expect(short.gutter).toBe(long.gutter);
    for (const key of ["top", "search", "rail", "content"] as const) {
      expect(short[key].x, key + " x").toBeCloseTo(long[key].x, 0);
      expect(short[key].width, key + " width").toBeCloseTo(long[key].width, 0);
    }
    await expect(top.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    await page.setViewportSize({ width: 1024, height: 1800 });
    await rail.getByRole("link", { name: "治理概览", exact: true }).click();
    await expect(page.getByRole("heading", { name: "更新组织资料", exact: true })).toBeVisible();
    for (const width of [841, 1024, 1100]) {
      await page.setViewportSize({ width, height: 1800 });
      const tall = await read();
      await page.setViewportSize({ width, height: 760 });
      const short = await read();
      console.log("native narrow desktop geometry", width, JSON.stringify({ tall, short }));
      expect(tall.overflow).toBe(false);
      expect(short.nativeScrollbar).toBeGreaterThan(0);
      expect([tall.overflowsX, short.overflowsX]).toEqual([false, false]);
      expect(tall.gutter).toBe(short.gutter);
      for (const key of ["top", "search", "rail", "content"] as const) {
        expect(tall[key].x, key + " x").toBeCloseTo(short[key].x, 0);
        expect(tall[key].width, key + " width").toBeCloseTo(short[key].width, 0);
      }
      await expect(top.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    }
  } finally {
    await browser.close();
  }
});

test("narrow desktop admin keeps workspace tools pinned while opening the last route", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop rail breakpoint");
  await page.setViewportSize({ width: 1024, height: 760 });
  await allow(page, "platform_admin");
  await page.goto("/platform-admin");
  const rail = page.getByRole("complementary", { name: "工作区导航" });
  const menu = rail.locator(".commerce-sidebar-menu");
  const operation = menu.getByRole("link", { name: "系统运维", exact: true });
  const footer = rail.locator("footer");
  const settings = footer.getByRole("link", { name: "设置", exact: true });
  await expect(operation).toBeAttached();
  const measure = () =>
    rail.evaluate((node) => {
      const list = node.querySelector(".commerce-sidebar-menu")!;
      return {
        railOverflow: getComputedStyle(node).overflowY,
        menuDisplay: getComputedStyle(list).display,
        menuOverflow: list.scrollHeight > list.clientHeight,
        footerBottom: node.querySelector("footer")!.getBoundingClientRect().bottom,
      };
    });
  const before = await measure();
  console.log("narrow desktop navigation", JSON.stringify(before));
  expect(before.footerBottom).toBeLessThanOrEqual(760);
  expect(before.menuDisplay).toBe("flex");
  expect(before.menuOverflow).toBe(true);
  const anchor = (await settings.boundingBox())!.y;
  await operation.focus();
  await expect(operation).toBeInViewport({ ratio: 1 });
  expect(await menu.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(operation).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  await expect(settings).toBeInViewport({ ratio: 1 });
  expect((await settings.boundingBox())!.y).toBeCloseTo(anchor, 0);
  const help = footer.locator(".midou-organization-help > summary");
  await expect(help).toBeInViewport({ ratio: 1 });
  await help.click();
  const helpText = footer.getByText("从侧栏进入组织、采集和审计管理。", { exact: false });
  await expect(helpText).toBeInViewport({ ratio: 1 });
  await help.press("Escape");
  await expect(helpText).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 941 });
  await expect(settings).toBeInViewport({ ratio: 1 });
  await expect(menu).toHaveCSS("display", "flex");
  await page.setViewportSize({ width: 840, height: 760 });
  await expect(rail).toBeHidden();
  await expect(page.getByRole("button", { name: "打开导航菜单", exact: true })).toBeVisible();
});

test("short desktop platform navigation keeps workspace tools pinned across routes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Short desktop rail uses desktop CSS");
  await page.setViewportSize({ width: 1366, height: 900 });
  await allow(page, "platform_admin");
  await page.goto("/platform-admin");
  const rail = page.getByRole("complementary", { name: "工作区导航" });
  const settings = rail.getByRole("link", { name: "设置", exact: true });
  const help = rail.getByText("帮助", { exact: true });
  const switcher = rail.getByRole("link", { name: "选择组织与工作区后进入用户工作台" });
  for (const control of [switcher, settings, help]) {
    await expect(control).toBeInViewport({ ratio: 1, timeout: 2000 });
  }
  await page.setViewportSize({ width: 1366, height: 760 });
  await expect(switcher).toBeInViewport({ ratio: 1 });
  const anchor = (await settings.boundingBox())!.y;
  const operation = rail.getByRole("link", { name: "系统运维", exact: true });
  const routeMenu = rail.locator(".commerce-sidebar-menu");
  expect(await routeMenu.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await operation.focus();
  await expect(operation).toBeInViewport({ ratio: 1 });
  expect(await routeMenu.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(operation).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  await expect(settings).toBeInViewport({ ratio: 1 });
  expect((await settings.boundingBox())!.y).toBeCloseTo(anchor, 0);
});

for (const shell of ["member", "organization_admin", "platform_admin"] as const) {
  test("midou reference shell smoke " + shell, async ({ page }, testInfo) => {
    const wideHome = shell === "member" && testInfo.project.name === "desktop-chromium";
    if (wideHome) await page.setViewportSize({ width: 1672, height: 941 });
    await allow(page, shell);
    if (shell === "member") {
      await page.route("**/api/v1/opportunities?**", (r) =>
        r.fulfill({
          json: {
            data: [],
            meta: { page: 1, page_size: 5, total: 0 },
            request_id: "reference-empty-catalogue",
            trace_id: "reference-empty-catalogue",
          },
        }),
      );
      await page.route("**/api/v1/me/home-dashboard", (r) =>
        r.fulfill({
          json: {
            data: {
              actions: [],
              changes: [],
              follows: [],
              health: [],
              automatic_selection: {
                state: "running",
                enabled_rule_count: 1,
                candidate_count: 0,
                rule_candidate_count: 0,
                recommended_count: 0,
                awaiting_evidence_count: 0,
                adopted_count: 0,
                recommended_items: [],
                last_collection_at: null,
                next_collection_at: null,
                daily_production: {
                  date: "2026-11-03",
                  timezone: "Asia/Shanghai",
                  completed_count: 0,
                  discovered_count: 0,
                  qualified_count: 0,
                  target_minimum: 100,
                  measured_at: "2026-11-03T00:00:00Z",
                },
              },
              scope: {
                organization_id: "00000000-0000-4000-8000-000000000103",
                workspace_id: "00000000-0000-4000-8000-000000000104",
              },
              generated_at: "2026-11-03T00:00:00Z",
            },
            request_id: "reference-home-not-production",
            trace_id: "reference-home-not-production",
          },
        }),
      );
    }
    if (shell === "platform_admin")
      await page.route("**/api/v1/platform/dashboard?**", (r) =>
        r.fulfill({
          json: {
            data: {
              window: "24h",
              summary: {
                active_organizations: 1,
                active_users: 1,
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
              observed_at: "2026-11-03T00:00:00Z",
            },
            request_id: "reference-fixture-not-production",
            trace_id: "reference-fixture-not-production",
          },
        }),
      );
    await page.goto(
      shell === "member"
        ? "/home"
        : shell === "organization_admin"
          ? "/org-admin"
          : "/platform-admin",
    );
    await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
    if (shell === "member") {
      await expect(page.locator(".home-command-bar")).toBeVisible();
      await expect(page.locator(".home-daily-production dl > div")).toHaveCount(3);
      const iconContentWidth = await page
        .locator(".home-daily-production dt svg")
        .first()
        .evaluate((svg) => {
          const style = getComputedStyle(svg);
          return (
            svg.getBoundingClientRect().width -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight)
          );
        });
      if (page.viewportSize()!.width <= 640) {
        // The approved compact phone layout prioritizes results and hides KPI artwork.
        await expect(page.locator(".home-daily-production dt svg").first()).not.toBeVisible();
      } else {
        expect(iconContentWidth).toBeGreaterThanOrEqual(18);
      }
      await expect(page.getByRole("region", { name: "选品任务流程", exact: true })).toBeVisible();
      await expect(page.locator(".midou-home-flow li")).toHaveCount(5);
      await expect(page.locator(".midou-member-utility a")).toHaveCount(2);
      await expect(
        page.locator(".home-quiet-empty").getByText("暂无已完成分析的商品", { exact: true }),
      ).toBeVisible();
      if (wideHome) {
        const stats = page.locator(".home-status-facts");
        await expect(stats.getByRole("link")).toHaveCount(4);
        await expect(stats.getByRole("link").first()).toHaveCSS("border-right-width", "0px");
      }
    } else if (shell === "organization_admin") {
      await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
      await expect(
        page.getByRole("complementary", { name: "治理快捷入口与组织状态" }),
      ).toBeVisible();
      await expect(page.locator(".midou-governance-side a")).toHaveCount(4);
    } else await expect(page.locator(".platform-facts")).toBeVisible();
    const account = page.getByLabel("账号菜单", { exact: true });
    await expect(account).toBeVisible();
    const logout = page.getByRole("button", { name: "退出登录", exact: true });
    await expect(logout).toBeHidden();
    await account.click();
    await expect(logout).toBeVisible();
    await account.press("Escape");
    await expect(logout).toBeHidden();
    await expect(account).toBeFocused();
    await expect(page.getByRole("navigation", { name: "面包屑" })).toHaveCount(1);
    await expect(page.locator(".role-brand")).toHaveAccessibleName("米兜智能选品");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("member navigation survives account appearance and back without replacing chrome", async ({
  page,
}) => {
  const wide = (page.viewportSize()?.width ?? 0) > 840;
  if (wide) await page.setViewportSize({ width: 1717, height: 916 });
  await allow(page, "member");
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "session", trace_id: "session" },
    }),
  );
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({
      json: {
        data: {
          theme: "deep-ocean",
          source: "saved",
          organization_id: "org-1",
          workspace_id: "workspace-1",
          version: 1,
          updated_at: null,
        },
        request_id: "preference",
        trace_id: "preference",
      },
    }),
  );
  await page.goto("/home");
  await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
  const header = await page.locator(".role-topbar").elementHandle();
  const sidebar = await page.locator(".commerce-sidebar").elementHandle();
  const metrics = () =>
    page.locator(".role-topbar").evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        height: el.getBoundingClientRect().height,
        brandFont: getComputedStyle(el.querySelector(".role-brand > b")!).fontSize,
        brandMarkWidth: el.querySelector(".midou-brand-mark")!.getBoundingClientRect().width,
        railWidth: document.querySelector(".commerce-sidebar")?.getBoundingClientRect().width,
        workspaceTabs: document.querySelector(".midou-area-tabs")
          ? (() => {
              const tabs = document.querySelector(".midou-area-tabs")!;
              const current = tabs.querySelector('[aria-current="page"]')!;
              return {
                radius: getComputedStyle(tabs).borderTopLeftRadius,
                background: getComputedStyle(tabs).backgroundColor,
                activeRadius: getComputedStyle(current).borderTopLeftRadius,
                activeFontSize: getComputedStyle(current).fontSize,
              };
            })()
          : null,
        font: s.fontFamily,
        background: s.backgroundColor,
        density: document.documentElement.dataset.density,
      };
    });
  const baseline = await metrics();
  if (wide) {
    expect(baseline).toMatchObject({
      height: 64,
      railWidth: 246,
      brandFont: "24px",
      brandMarkWidth: 40,
    });
    expect(baseline.workspaceTabs).toMatchObject({
      radius: "999px",
      activeRadius: "999px",
      activeFontSize: "16px",
    });
    const workspaceTabs = page.getByRole("navigation", { name: "工作台类型", exact: true });
    await expect(workspaceTabs).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(workspaceTabs.getByRole("link", { name: "选品", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator(".midou-top-avatar")).toHaveCSS("width", "36px");
    await expect(
      page.getByRole("button", { name: "全局搜索", exact: true }).locator("svg"),
    ).toHaveCSS("width", "18px");
    const rail = (await page.locator(".commerce-sidebar").boundingBox())!;
    expect(rail.y + rail.height).toBe(page.viewportSize()!.height);
    const active = page.locator('.commerce-sidebar section a[aria-current="page"]');
    await expect(active).toHaveCSS("font-size", "16px");
    await expect(active).toHaveCSS("font-weight", "650");
    const help = page.locator(".commerce-sidebar footer details");
    await help.locator("summary").click();
    await expect(help.locator("p")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help.locator("p")).toBeHidden();
  }
  if ((page.viewportSize()?.width ?? 1000) <= 840) {
    await page.getByRole("button", { name: "打开导航菜单" }).click();
    await page.locator('.role-sidebar-utility a[href="/me"]').click();
    await expect(page.getByRole("dialog", { name: "工作台导航" })).toBeHidden();
  } else {
    await page.getByLabel("账号菜单", { exact: true }).click();
    await page.locator(".midou-account-menu").getByRole("link", { name: "个人中心" }).click();
  }
  await expect(page.getByRole("navigation", { name: "个人中心分区" })).toBeVisible();
  expect(await header?.evaluate((el) => el.isConnected)).toBe(true);
  expect(await sidebar?.evaluate((el) => el.isConnected)).toBe(true);
  expect(await metrics()).toEqual(baseline);
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "外观偏好：主题与密度", exact: true }).click();
  await expect(page.getByRole("heading", { name: "界面外观", exact: true })).toBeVisible();
  expect(await header?.evaluate((el) => el.isConnected)).toBe(true);
  expect(await metrics()).toEqual(baseline);
  expect(
    await page.evaluate(() => localStorage.getItem("scoutops:navigation:last-member-route")),
  ).toBe("/home");
  await page.locator(".role-brand").click();
  await expect(page).toHaveURL(/\/home$/);
  expect(await header?.evaluate((el) => el.isConnected)).toBe(true);
  expect(await metrics()).toEqual(baseline);
});

test("session-only account does not bypass a forbidden member destination", async ({ page }) => {
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "session", trace_id: "session" },
    }),
  );
  let reads = 0;
  await page.route("**/api/v1/me/navigation?**", (route) => {
    reads++;
    return route.fulfill({
      status: 403,
      json: {
        error: { code: "forbidden", message: "forbidden" },
        request_id: "denied",
        trace_id: "denied",
      },
    });
  });
  await page.goto("/me");
  await expect(page.getByRole("navigation", { name: "个人中心分区" })).toBeVisible();
  await expect.poll(() => reads).toBe(1);
  await page.locator(".role-brand").click();
  await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "forbidden");
  expect(reads).toBe(2);
  await expect(page.locator(".account-shell")).toHaveCount(0);
});

test("platform source settings preserve the shared navigation styling", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= 840, "Desktop shared navigation");
  await page.setViewportSize({ width: 1672, height: 941 });
  await allow(page, "platform_admin");
  await page.goto("/platform-admin");
  const bar = page.locator(".role-topbar");
  const navigationSearch = bar.locator("[data-navigation-search]");
  const menu = page.locator(".commerce-sidebar");
  const styles = () =>
    navigationSearch.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        background: style.backgroundColor,
        border: style.borderColor,
        radius: style.borderRadius,
        font: style.fontFamily,
        height: element.getBoundingClientRect().height,
      };
    });
  const railStyle = () =>
    menu.evaluate((element) => {
      const tabs = element.querySelector(".midou-area-tabs")!;
      const context = element.querySelector(".midou-platform-return")!;
      const help = element.querySelector(".midou-organization-help")!;
      return {
        tabsSurface: getComputedStyle(tabs).backgroundColor,
        tabsTop: tabs.getBoundingClientRect().y,
        contextHeight: context.getBoundingClientRect().height,
        contextInset: getComputedStyle(context).paddingInlineStart,
        footerTop: context.closest("footer")!.getBoundingClientRect().top,
        railWidth: element.getBoundingClientRect().width,
        helpAlignment: getComputedStyle(help).justifySelf,
      };
    });
  const baseline = await styles();
  const railBaseline = await railStyle();
  await menu.locator('a[href="/platform-admin/providers"]').click();
  await expect(page.locator(".provider-registry")).toBeVisible();
  expect(await styles()).toEqual(baseline);
  expect(await railStyle()).toEqual(railBaseline);
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  await menu.getByRole("link", { name: "平台概览", exact: true }).click();
  await expect(page).toHaveURL(/\/platform-admin$/);
  expect(await styles()).toEqual(baseline);
  expect(await railStyle()).toEqual(railBaseline);
});

test("admin appearance panel opens directly below the masthead and remains operable", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Check the desktop and mobile widths in Chromium",
  );
  await allow(page, "organization_admin");
  await page.goto("/org-admin");
  const masthead = page.locator(".role-topbar");
  const button = masthead.getByRole("button", { name: "切换界面主题", exact: true });
  const menu = page.locator(".role-theme-menu");
  for (const width of [1672, 1024, 390]) {
    await page.setViewportSize({ width, height: 941 });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toBeVisible();
    const [headerBox, panelBox] = await Promise.all([masthead.boundingBox(), menu.boundingBox()]);
    const gap = panelBox!.y - (headerBox!.y + headerBox!.height);
    console.log(
      "appearance panel geometry",
      JSON.stringify({
        width,
        headerBottom: headerBox!.y + headerBox!.height,
        menuTop: panelBox!.y,
        gap,
      }),
    );
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(24);
    await expect(menu).toBeInViewport({ ratio: 1 });
    await expect(menu.getByRole("link", { name: "更多外观设置" })).toHaveAttribute(
      "href",
      "/me?section=appearance",
    );
    await expect(menu.getByRole("button").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  }
});

test("platform route changes clear appearance and keep open-platform colors inside its page", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Use desktop sidebar navigation");
  await page.setViewportSize({ width: 1672, height: 941 });
  await allow(page, "platform_admin");
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (route) => {
    const data = summary("platform_admin");
    data.platform_capabilities.push("platform_token:manage");
    return route.fulfill({
      json: { data, request_id: "platform-chrome", trace_id: "platform-chrome" },
    });
  });
  await page.goto("/platform-admin");
  const header = page.locator(".role-topbar");
  const sidebar = page.getByRole("complementary", { name: "工作区导航" });
  const appearance = header.getByRole("button", { name: "切换界面主题", exact: true });
  const read = () =>
    header.evaluate((bar) => {
      const search = bar.querySelector("[data-navigation-search]")!;
      const style = getComputedStyle(search);
      const rail = document.querySelector(".commerce-sidebar")!;
      return {
        legacyPalette: ["--text", "--surface", "--bg", "--border", "--primary"].map((key) =>
          style.getPropertyValue(key).trim(),
        ),
        search: [
          search.getBoundingClientRect().x,
          search.getBoundingClientRect().width,
          style.color,
          style.backgroundColor,
        ],
        sidebar: [rail.getBoundingClientRect().width, getComputedStyle(rail).backgroundColor],
      };
    });
  await expect(appearance).toBeVisible();
  const before = await read();
  await appearance.click();
  await expect(appearance).toHaveAttribute("aria-expanded", "true");
  await sidebar.getByRole("link", { name: "开放平台", exact: true }).click();
  const surface = page.locator(".open-platform--c");
  await expect(surface).toBeVisible();
  const after = await read();
  console.log(
    "open platform shared navigation",
    JSON.stringify({ before, after, expanded: await appearance.getAttribute("aria-expanded") }),
  );
  expect.soft(await appearance.getAttribute("aria-expanded")).toBe("false");
  expect.soft(after).toEqual(before);
  expect(
    await surface.evaluate((el) => getComputedStyle(el).getPropertyValue("--p60-primary").trim()),
  ).not.toBe("");
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  await sidebar.getByRole("link", { name: "平台概览", exact: true }).click();
  await expect(page).toHaveURL(/\/platform-admin$/);
  expect(await read()).toEqual(before);
});

test("wide masthead aligns utility glyphs without moving navigation controls", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide masthead glyphs");
  await page.setViewportSize({ width: 1672, height: 900 });
  await allow(page, "member");
  await page.route("**/api/v1/me/navigation?**", (route) => {
    const shell = new URL(route.request().url()).searchParams.get("shell") as
      "member" | "organization_admin" | "platform_admin";
    const data = summary(shell);
    if (shell !== "platform_admin") {
      data.platform_roles = ["platform_super_admin"];
      data.roles = ["organization_admin"];
    }
    return route.fulfill({
      json: { data, request_id: "masthead-glyph", trace_id: "masthead-glyph" },
    });
  });
  await page.goto("/home");

  const masthead = page.locator(".role-topbar");
  const tabs = page.getByRole("navigation", { name: "工作台类型" });
  const avatar = masthead.locator(".midou-top-avatar");
  const help = masthead.getByLabel("导航帮助", { exact: true });
  for (const [role, label] of [
    ["member", null],
    ["organization_admin", "组织"],
    ["platform_admin", "平台"],
  ] as const) {
    if (label) await tabs.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator(".role-shell")).toHaveAttribute("data-shell", role);
    await expect(help).toHaveCSS("min-height", "44px");
    await expect(help.locator("svg")).toHaveCSS("translate", "0px -2px");
    await expect(masthead.locator("[data-navigation-search] > svg")).toHaveCSS(
      "translate",
      "0px -1px",
    );
    await expect(avatar).toHaveCSS("translate", role === "member" ? "none" : "-3px -1px");
    await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  }
  await page.setViewportSize({ width: 1599, height: 900 });
  await expect(help.locator("svg")).toHaveCSS("translate", "none");
  await expect(avatar).toHaveCSS("translate", "none");
});

test("wide member rail keeps its icon and label track between routes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide member rail");
  await page.setViewportSize({ width: 1672, height: 941 });
  await allow(page, "member");
  await page.goto("/home");
  const rail = page.getByRole("complementary", { name: "工作区导航" });
  const links = rail.locator(".commerce-sidebar-menu > section > a");
  const workbench = rail.getByRole("link", { name: "选品工作台", exact: true });
  const catalogue = rail.getByRole("link", { name: "选品库", exact: true });
  await expect(workbench).toHaveAttribute("aria-current", "page");
  console.log(
    "SHARED_RAIL_LINK_GAP",
    await links.first().evaluate((node) => getComputedStyle(node).columnGap),
  );
  await expect(links.first()).toHaveCSS("column-gap", "20px");
  const searchLabel = page.locator(".role-topbar [data-navigation-search] > span");
  const wideRailSize = await links.first().evaluate((node) => getComputedStyle(node).fontSize);
  console.log("wide member navigation type", wideRailSize);
  expect(wideRailSize).toBe("16px");
  await expect(searchLabel).toHaveCSS("font-size", "14px");
  await expect(searchLabel).toHaveCSS("letter-spacing", "0.2px");
  await expect(links.first().locator("svg")).toHaveCSS("width", "20px");
  const before = (await rail.boundingBox())!;
  const iconBefore = (await workbench.locator("svg").boundingBox())!;
  await catalogue.click();
  await expect(catalogue).toHaveAttribute("aria-current", "page");
  await expect(catalogue).toHaveCSS("column-gap", "20px");
  await expect(catalogue).toHaveCSS("font-size", "16px");
  await expect(searchLabel).toHaveCSS("font-size", "14px");
  expect((await rail.boundingBox())!.width).toBe(before.width);
  expect((await workbench.locator("svg").boundingBox())!.x).toBe(iconBefore.x);
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);

  await page.setViewportSize({ width: 1599, height: 941 });
  await expect(links.first()).not.toHaveCSS("column-gap", "20px");
});

test("release rail keeps navigation groups and pins footer during keyboard route changes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop rail breakpoints");
  await page.setViewportSize({ width: 1672, height: 941 });
  await allow(page, "organization_admin");
  await page.goto("/org-admin");
  const rail = page.getByRole("complementary", { name: "工作区导航" });
  const menu = rail.locator(":scope > .commerce-sidebar-menu");
  await expect(rail).toBeVisible();
  const org = await rail.evaluate((node) => ({
    grouped: node.querySelectorAll(":scope > .commerce-sidebar-menu > section").length,
    direct: node.querySelectorAll(":scope > section").length,
  }));
  console.log("RELEASE_RAIL_GROUPS_BASE", JSON.stringify(org));
  expect(org.grouped).toBeGreaterThan(1);
  expect(org.direct).toBe(0);
  await expect(menu).toHaveCSS("display", "contents");
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);

  await allow(page, "platform_admin");
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.goto("/platform-admin");
  await expect(menu.locator(":scope > section")).toHaveCount(4);
  await expect(menu).toHaveCSS("display", "flex");
  await expect(menu).toHaveCSS("overflow-y", "auto");
  const settings = rail.locator(":scope > footer").getByRole("link", { name: "设置", exact: true });
  const lastRoute = menu.getByRole("link", { name: "系统运维", exact: true });
  await expect(settings).toBeInViewport({ ratio: 1 });
  const y = (await settings.boundingBox())!.y;
  await lastRoute.focus();
  await expect(lastRoute).toBeInViewport({ ratio: 1 });
  const scroll = await menu.evaluate((node) => node.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(lastRoute).toHaveAttribute("aria-current", "page");
  await expect(settings).toBeInViewport({ ratio: 1 });
  expect((await settings.boundingBox())!.y).toBeCloseTo(y, 0);
  await expect(
    page.locator(".role-topbar").getByRole("navigation", { name: "面包屑", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  console.log("RELEASE_RAIL_KEYBOARD", JSON.stringify({ footerY: y, scroll, active: "系统运维" }));
});

test("wide platform rail keeps its label and utility hierarchy when changing routes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide platform navigation");
  await page.setViewportSize({ width: 1672, height: 941 });
  await allow(page, "platform_admin");
  await page.goto("/platform-admin");
  const rail = page.locator(".commerce-sidebar");
  const label = rail.locator(".commerce-sidebar-menu > section:first-child > h2");
  const overview = rail.getByRole("link", { name: "平台概览", exact: true });
  const context = rail.locator(".midou-platform-return");

  await expect(label).toHaveCSS("translate", "0px -4px");
  const activeRow = await overview.boundingBox();
  const contextSurface = await context.evaluate((item) => getComputedStyle(item).backgroundColor);
  const panelSoft = await context.evaluate((item) => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--so-panel-soft)";
    item.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  expect(contextSurface).toBe(panelSoft);

  await rail.locator('a[href="/platform-admin/providers"]').click();
  await expect(page.locator(".provider-registry")).toBeVisible();
  await expect(label).toHaveCSS("translate", "0px -4px");
  await expect(context).toHaveCSS("background-color", contextSurface);
  expect(await overview.boundingBox()).toEqual(activeRow);
  await expect(
    page.locator(".role-topbar").getByRole("navigation", { name: "面包屑", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);

  await page.setViewportSize({ width: 1672, height: 900 });
  await expect(label).not.toHaveCSS("translate", "0px -4px");
});

test("wide member footer stays anchored when navigating between member destinations", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide desktop member navigation");
  await allow(page, "member");
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "session", trace_id: "session" },
    }),
  );
  await page.setViewportSize({ width: 1717, height: 916 });
  await page.goto("/home");
  const rail = page.getByRole("complementary", { name: "工作区导航" });
  const footer = rail.locator("footer");
  const switcher = footer.getByRole("link", { name: "侧栏切换工作区", exact: true });
  const settings = footer.getByRole("link", { name: "设置", exact: true });
  const help = footer.locator("details");
  const geometry = async () => {
    const [r, f, w, s, h] = await Promise.all(
      [rail, footer, switcher, settings, help.locator("summary")].map((item) => item.boundingBox()),
    );
    const top = await page.locator(".role-topbar").boundingBox();
    const search = await page.locator(".role-topbar [data-navigation-search]").boundingBox();
    return {
      gutter: r!.y + r!.height - f!.y - f!.height,
      rail: r,
      footer: f,
      switcher: w,
      settings: s,
      help: h,
      top,
      search,
    };
  };
  await expect(switcher).toBeVisible();
  await expect(rail).toHaveCSS("padding-block-end", "10px");
  await expect(footer).toHaveCSS("padding-block-end", "0px");
  const baseline = await geometry();
  expect(baseline.gutter).toBeCloseTo(10, 0);
  expect(baseline.switcher!.height).toBeGreaterThanOrEqual(50);
  expect(baseline.settings!.height).toBeGreaterThanOrEqual(44);
  expect(baseline.help!.height).toBeGreaterThanOrEqual(44);
  console.log(
    "SHARED_RAIL_ROUTE_GEOMETRY",
    JSON.stringify({
      gap: await rail
        .locator(".commerce-sidebar-menu > section > a")
        .first()
        .evaluate((node) => getComputedStyle(node).columnGap),
      top: baseline.top,
      rail: baseline.rail,
      search: baseline.search,
      footer: baseline.footer,
    }),
  );
  for (const route of [
    "/trends",
    "/opportunities",
    "/sourcing",
    "/notifications",
    "/me",
    "/home",
  ]) {
    await rail.locator(`.commerce-sidebar-menu a[href="${route}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    expect(await geometry()).toEqual(baseline);
    await expect(
      page.locator(".role-topbar").getByRole("navigation", { name: "面包屑", exact: true }),
    ).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  }
  await help.locator("summary").click();
  await expect(help.locator("p")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help.locator("p")).toBeHidden();
  await page.setViewportSize({ width: 1717, height: 600 });
  expect((await geometry()).gutter).toBeCloseTo(10, 0);
  await expect(switcher).toBeInViewport();
  await expect(rail.locator(".commerce-sidebar-menu")).toHaveCSS("overflow-y", "auto");
  await page.setViewportSize({ width: 1599, height: 916 });
  await expect(rail).not.toHaveCSS("padding-block-end", "10px");
});

for (const [role, path, width] of [
  ["platform_admin", "/platform-admin", 1672],
  ["organization_admin", "/org-admin", 1560],
] as const) {
  test(`wide admin permission check reserves chrome without exposing protected navigation: ${role}`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Wide desktop shell");
    await page.setViewportSize({ width, height: 941 });
    await allow(page, role);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/me/navigation?**", async (route) => {
      await held;
      await route.fulfill({
        json: {
          data: summary(role),
          request_id: "pending-shell",
          trace_id: "pending-shell",
        },
      });
    });
    const root = page.locator(".role-shell");
    const header = root.locator(".role-topbar");
    const slot = header.locator(".midou-pending-search");
    const placeholder = root.locator(".midou-pending-rail");
    const rail = page.getByRole("complementary", { name: "工作区导航" });
    const search = header.getByRole("button", { name: "搜索后台功能" });
    const before = async () => ({
      search: (await slot.count()) ? await slot.boundingBox() : null,
      rail: (await placeholder.count()) ? await placeholder.boundingBox() : null,
      help: await header.locator(".midou-top-help > summary").boundingBox(),
      account: await header.locator(".midou-account-menu > summary").boundingBox(),
    });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(root).toHaveAttribute("data-state", "loading");
    await expect(rail).toHaveCount(0);
    await expect(search).toHaveCount(0);
    await expect(placeholder.locator("a, button")).toHaveCount(0);
    const pending = await before();
    console.log("SHELL_PENDING_CHROME", JSON.stringify(pending));
    release();
    await expect(root).toHaveAttribute("data-state", "ready");
    const ready = {
      search: await search.boundingBox(),
      rail: await rail.boundingBox(),
      help: await header.locator(".midou-top-help > summary").boundingBox(),
      account: await header.locator(".midou-account-menu > summary").boundingBox(),
    };
    expect(pending).toEqual(ready);
    await expect(placeholder).toHaveCount(0);
    await expect(header.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  });
}

for (const [shell, path, theme] of [
  ["member", "/home", "deep-ocean"],
  ["organization_admin", "/org-admin", "aurora-purple"],
  ["platform_admin", "/platform-admin", "cloud-white"],
] as const) {
  test(
    "workspace canvas keeps its theme across desktop widths: " + shell,
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium", "Desktop workspace canvas");
      await page.addInitScript((id) => localStorage.setItem("scoutops:ui-theme", id), theme);
      await allow(page, shell);
      await page.route("**/api/v1/me/ui-preferences", (route) =>
        route.fulfill({
          json: { data: { theme, version: 1 }, request_id: "canvas", trace_id: "canvas" },
        }),
      );
      await page.goto(path);
      const root = page.locator(".role-shell");
      await expect(root).toHaveAttribute("data-shell", shell);
      await expect(root).toHaveAttribute("data-state", "ready");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const surfaces = [];
      for (const width of [1599, 1600, 1717]) {
        await page.setViewportSize({ width, height: 941 });
        surfaces.push(
          await root.evaluate((node) => {
            const shell = getComputedStyle(node);
            return {
              shell: shell.backgroundColor,
              token: shell.getPropertyValue("--so-bg").trim(),
              content: getComputedStyle(node.querySelector(".role-content")!).backgroundColor,
            };
          }),
        );
      }
      console.log("WORKSPACE_CANVAS", shell, theme, JSON.stringify(surfaces));
      for (const surface of surfaces) {
        expect(surface).toEqual({
          shell: "color(srgb 0.944039 0.956196 0.976588)",
          token: "#f3f6fb",
          content: "rgba(0, 0, 0, 0)",
        });
      }
    },
  );
}

test("wide masthead shares action tracks across all three workspaces", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide desktop action geometry");
  await page.setViewportSize({ width: 1672, height: 900 });
  await allow(page, "member");
  await page.route("**/api/v1/me/navigation?**", (route) => {
    const shell = new URL(route.request().url()).searchParams.get("shell") as
      "member" | "organization_admin" | "platform_admin";
    const data = summary(shell);
    if (shell !== "platform_admin") {
      data.platform_roles = ["platform_super_admin"];
      data.roles = ["organization_admin"];
    }
    return route.fulfill({
      json: { data, request_id: "shared-masthead", trace_id: "shared-masthead" },
    });
  });
  await page.goto("/home");
  const root = page.locator(".role-shell");
  const header = root.locator(".role-topbar");
  const tools = header.locator(".role-top-actions");
  const tabs = page.getByRole("navigation", { name: "工作台类型" });
  const read = async (role: string) => {
    await expect(root).toHaveAttribute("data-shell", role);
    await expect(root).toHaveAttribute("data-state", "ready");
    await expect(header.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    const result = await tools.evaluate((group) => {
      const geometry = (selector: string) => {
        const { x, y, width, height } = group.querySelector(selector)!.getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        search: geometry("[data-navigation-search]"),
        help: geometry(".midou-top-help > summary"),
        account: geometry(".midou-account-menu > summary"),
        gap: getComputedStyle(group).columnGap,
      };
    });
    console.log("SHARED_MASTHEAD", role, JSON.stringify(result));
    return result;
  };
  const member = await read("member");
  expect(member.search.width).toBeCloseTo(334.4, 1);
  expect(member.gap).toBe("24px");
  await expect(header.getByRole("link", { name: "通知中心", exact: true })).toBeVisible();
  await tabs.getByRole("link", { name: "组织", exact: true }).click();
  expect(await read("organization_admin")).toEqual(member);
  await expect(header.getByRole("link", { name: "通知中心", exact: true })).toHaveCount(0);
  await tabs.getByRole("link", { name: "平台", exact: true }).click();
  expect(await read("platform_admin")).toEqual(member);
  await expect(header.getByRole("link", { name: "通知中心", exact: true })).toHaveCount(0);
  for (const width of [1600, 1717]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await read("platform_admin");
    expect(layout.search.width).toBeCloseTo(Math.max(324, width * 0.2), 1);
    expect(layout.gap).toBe("24px");
  }
});

test("mid-desktop masthead keeps the same action grid across all roles", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop action grid");
  await allow(page, "member");
  await page.route("**/api/v1/me/navigation?**", (route) => {
    const role = new URL(route.request().url()).searchParams.get("shell") as
      "member" | "organization_admin" | "platform_admin";
    const data = summary(role);
    data.roles = ["organization_admin"];
    data.platform_roles = ["platform_super_admin"];
    return route.fulfill({
      json: { data, request_id: "mid-action-grid", trace_id: "mid-action-grid" },
    });
  });
  const shell = page.locator(".role-shell");
  const header = shell.locator(".role-topbar");
  const rail = page.getByRole("complementary", { name: "工作区导航" });
  const tabs = rail.getByRole("navigation", { name: "工作台类型" });
  const read = async (role: string) => {
    await expect(shell).toHaveAttribute("data-shell", role);
    await expect(shell).toHaveAttribute("data-state", "ready");
    await expect(header.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    return header.evaluate((node) => {
      const box = (selector: string) => {
        const { x, y, width, height } = node.querySelector(selector)!.getBoundingClientRect();
        return [x, y, width, height].map((v) => Math.round(v * 10) / 10);
      };
      return {
        height: node.getBoundingClientRect().height,
        search: box("[data-navigation-search]"),
        help: box(".midou-top-help > summary"),
        account: box(".midou-account-menu > summary"),
        gap: getComputedStyle(node.querySelector(".role-top-actions")!).columnGap,
        railTop: document.querySelector(".commerce-sidebar")!.getBoundingClientRect().top,
        pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      };
    });
  };
  const observed = [];
  for (const [width, height] of [
    [1101, 900],
    [1280, 900],
    [1440, 900],
    [1560, 900],
    [1599, 900],
    [1560, 941],
    [1599, 941],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/home");
    const member = await read("member");
    await tabs.getByRole("link", { name: "组织", exact: true }).click();
    const organization = await read("organization_admin");
    await tabs.getByRole("link", { name: "平台", exact: true }).click();
    const platform = await read("platform_admin");
    observed.push({ width, height, member, organization, platform });
    if (height === 941) {
      await rail.getByRole("link", { name: "组织管理", exact: true }).click();
      await expect(page).toHaveURL(/\/platform-admin\/organizations$/);
      expect(await read("platform_admin")).toEqual(platform);
    }
  }
  console.log("MID_ACTION_GRID", JSON.stringify(observed));
  for (const item of observed) {
    expect(item.member.pageFits, "member viewport " + item.width).toBe(true);
    if (item.width >= 1536) {
      expect(item.member.search[2]).toBeCloseTo(item.width * 0.21, 1);
      expect(item.member.search[3]).toBe(38);
      expect(item.member.gap).toBe("20px");
      expect(item.member.height).toBe(item.height >= 921 ? 64 : 56);
      expect(item.member.railTop).toBe(item.member.height);
    }
    expect(item.organization, "organization viewport " + item.width).toEqual(item.member);
    expect(item.platform, "platform viewport " + item.width).toEqual(item.member);
  }
});
