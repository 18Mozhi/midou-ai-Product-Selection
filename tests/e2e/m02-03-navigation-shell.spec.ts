import { expect, test } from "@playwright/test";

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
    await expect(page.getByRole("navigation", { name: "面包屑" })).toHaveCount(1);
    await expect(page.locator(".role-content > nav").first()).toHaveAttribute(
      "aria-label",
      "面包屑",
    );
    await expect(page.locator(".role-topbar nav")).toHaveCount(0);
    const mobile = (page.viewportSize()?.width ?? 1000) <= 840;
    if (mobile) await page.getByRole("button", { name: "打开导航菜单" }).click();
    const nav = page.locator(mobile ? ".role-sidebar" : ".commerce-sidebar");
    await expect(nav).toBeVisible();
    if (!mobile && page.viewportSize()!.width >= 1101) {
      const tabs = nav.getByRole("navigation", { name: "工作台类型" });
      await expect(tabs.locator("[aria-current='page']")).toHaveCount(1);
      const cells = await tabs.locator(":scope > *").evaluateAll((items) =>
        items.map((item) => ({
          width: item.getBoundingClientRect().width,
          divider: getComputedStyle(item, "::before").content,
        })),
      );
      expect(cells).toHaveLength(3);
      expect(Math.max(...cells.map((item) => item.width)) - Math.min(...cells.map((item) => item.width))).toBeLessThan(1);
      expect(cells.filter((item) => item.divider === '""')).toHaveLength(shell === "organization_admin" ? 0 : 1);
    }
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

test("desktop platform sidebar fits grouped navigation and footer at reference size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await allow(page, "platform_admin");
  await page.goto("/platform-admin");
  const sidebar = page.getByRole("complementary", { name: "工作区导航" });
  const context = page.locator(".role-topbar").getByRole("link", { name: "切换组织与工作区" });
  const sidebarContext = sidebar.getByRole("link", { name: "选择组织与工作区后进入用户工作台" });
  await expect(sidebarContext).toHaveText("选择组织与工作区");
  await expect(sidebarContext.locator("svg")).toHaveCount(2);
  await expect(sidebarContext).toHaveCSS("min-height", "40px");
  await expect(context).toBeVisible();
  await expect(context).toHaveText("选择组织与工作区");
  await expect(context).toHaveAttribute("href", await sidebarContext.getAttribute("href") ?? "");
  await expect(context).toHaveAttribute("href", /from=%2Fplatform-admin$/);
  const top = page.locator(".role-topbar");
  const controls = await Promise.all(
    [
      top.getByRole("button", { name: "搜索后台功能" }),
      top.getByLabel("导航帮助"),
      top.getByRole("button", { name: "切换界面主题" }),
      top.getByLabel("账号菜单"),
    ].map((control) => control.boundingBox()),
  );
  expect(controls.every(Boolean)).toBe(true);
  for (let i = 1; i < controls.length; i++)
    expect(controls[i - 1]!.x + controls[i - 1]!.width).toBeLessThanOrEqual(controls[i]!.x);
  expect(controls[2]!.width).toBe(44);
  await expect(sidebar.locator("section a").first()).toHaveCSS("min-height", "32px");
  await expect(sidebar.getByRole("button", { name: "帮助", exact: true })).toBeInViewport();
  await expect(
    sidebar.getByRole("link", { name: "选择组织与工作区后进入用户工作台" }),
  ).toBeInViewport();
  await sidebar.getByRole("link", { name: "组织管理", exact: true }).click();
  await expect(context).toHaveAttribute("href", /from=%2Fplatform-admin%2Forganizations$/);
  const create = top.getByRole("link", { name: "新建组织" });
  const search = top.getByRole("button", { name: "搜索后台功能" });
  await expect(create).toBeVisible();
  await expect(search).toBeVisible();
  const after = (await search.boundingBox())!;
  expect(after.x).toBeCloseTo(controls[0]!.x, 0);
  expect(after.width).toBeCloseTo(controls[0]!.width, 0);
  const action = (await create.boundingBox())!;
  expect(action.x + action.width).toBeLessThanOrEqual(after.x);
  await expect(sidebar.locator("section a").first()).toHaveCSS("min-height", "32px");
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
});

test("platform top search finds only available navigation without a member search request", async ({
  page,
}) => {
  await allow(page, "platform_admin");
  const searches: string[] = [];
  await page.route("**/api/v1/me/global-search?**", (route) => {
    searches.push(route.request().url());
    return route.abort();
  });
  await page.goto("/platform-admin");
  const trigger = page.getByRole("button", { name: "搜索后台功能" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "搜索后台功能" });
  const input = dialog.getByRole("searchbox");
  await expect(input).toBeFocused();
  await input.fill("候选商品");
  await expect(dialog.getByRole("status")).toHaveText("没有匹配的后台功能。");
  await input.press("Enter");
  await input.fill("组织管理");
  await dialog.getByRole("link", { name: /组织管理/ }).click();
  await expect(page).toHaveURL(/\/platform-admin\/organizations$/);
  await expect(dialog).toBeHidden();
  expect(searches).toEqual([]);
});

test("core member titles and breadcrumbs use the current navigation names", async ({ page }) => {
  await allow(page, "member");
  for (const [path, title, heading = title] of [
    ["/trends", "市场情报"],
    ["/opportunities", "选品库"],
    ["/sourcing", "1688 找货", "供应链找货"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
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

async function allow(
  page: any,
  shell: "member" | "organization_admin" | "platform_admin",
  names?: { organization_name: string; workspace_name: string },
) {
  await page.route("**/api/v1/me/navigation?**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { ...summary(shell), ...names },
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
    if (item.shell === "member") {
      await page.clock.setFixedTime(new Date("2026-08-08T00:00:00.000Z"));
      await page.route("**/api/v1/opportunities?**", (route) =>
        route.fulfill({ json: { data: [], meta: { total: 0 }, request_id: "shell-empty-results" } }),
      );
    }
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
      const search = page.locator(".role-topbar [data-navigation-search]");
      await expect(search.locator("kbd")).toBeHidden();
      const [buttonBox, iconBox] = await Promise.all([
        search.boundingBox(),
        search.locator("svg").boundingBox(),
      ]);
      expect(buttonBox!.width).toBe(44);
      expect(Math.abs(buttonBox!.x + buttonBox!.width / 2 - iconBox!.x - iconBox!.width / 2)).toBeLessThan(1);
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
  await expect(page.getByRole("link", { name: "米兜智能选品", exact: true })).toBeFocused();
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
  const compact = (page.viewportSize()?.width ?? 1000) <= 840;
  const sidebar = page.locator(compact ? ".role-sidebar" : ".commerce-sidebar");
  if (compact)
    await page.getByRole("button", { name: "更多" }).click();
  await expect(page.getByRole("button", { name: "全局搜索", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "搜索后台功能", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "通知中心" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: /通知运营/ })).toHaveAttribute(
    "href",
    "/platform-admin/notifications",
  );
  if (!compact) await page.getByLabel("账号菜单", { exact: true }).click();
  await expect(
    (compact ? sidebar : page.locator(".midou-account-menu")).getByRole("link", {
      name: "个人中心",
      exact: true,
    }),
  ).toHaveAttribute("href", "/me");
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
  if ((page.viewportSize()?.width ?? 1000) <= 840)
    await page.getByRole("link", { name: "进入管理后台" }).click();
  else
    await page
      .getByRole("navigation", { name: "工作台类型" })
      .getByRole("link", { name: "平台", exact: true })
      .click();
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

for (const shell of ["member", "organization_admin", "platform_admin"] as const) {
  test("midou reference shell smoke " + shell, async ({ page }) => {
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
  await allow(page, "member");
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "session", trace_id: "session" },
    }),
  );
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({
      json: {
        data: { theme: "deep-ocean", version: 1 },
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
        font: s.fontFamily,
        background: s.backgroundColor,
        density: document.documentElement.dataset.density,
      };
    });
  const baseline = await metrics();
  if ((page.viewportSize()?.width ?? 1000) <= 840) {
    await page.getByRole("button", { name: "打开导航菜单" }).click();
    await page.locator('.role-sidebar-utility a[href="/me"]').click();
    await expect(page.getByRole("dialog", { name: "工作台导航" })).toBeHidden();
  } else {
    await page.locator('.role-topbar summary[aria-label="账号菜单"]').click();
    await page.locator('.role-topbar a[href="/me"]').click();
  }
  const directory = page.getByRole("navigation", { name: "个人中心分区" });
  await expect(directory).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) >= 1440) {
    await expect(directory.locator('a[aria-current="page"] > b')).toHaveCSS("font-size", "17px");
  }
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

test("desktop reference geometry and navigation help stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({
      json: { data: { authenticated: true }, request_id: "session", trace_id: "session" },
    }),
  );
  await allow(page, "member", {
    organization_name: "组织名称".repeat(8),
    workspace_name: "工作区名称".repeat(8),
  });
  await page.goto("/home");
  const sidebar = page.getByRole("complementary", { name: "工作区导航" });
  await expect(sidebar).toBeVisible();
  const header = await page.locator(".role-topbar").boundingBox();
  const bounds = await sidebar.boundingBox();
  const row = await sidebar.getByRole("link", { name: "选品工作台", exact: true }).boundingBox();
  expect(header?.height).toBe(61);
  const topbarDividers = await page
    .locator(".role-topbar :is(.midou-navigation-help, .midou-account-menu)")
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node, "::before").height));
  expect(topbarDividers).toEqual(["22px", "22px"]);
  expect(Math.round(bounds!.width)).toBe(261);
  expect(row?.y).toBe(153);
  expect(row?.height).toBe(44);
  const context = page.getByRole("link", { name: "切换组织与工作区" });
  await expect(context).toHaveCSS("border-top-style", "solid");
  await expect(context).toHaveCSS("min-height", "40px");
  expect(await context.evaluate((el) => getComputedStyle(el).borderTopColor)).not.toBe(
    "rgba(0, 0, 0, 0)",
  );
  const contextBounds = await context.boundingBox();
  const workspace = sidebar.getByRole("link", { name: "侧栏切换工作区" });
  const workspaceLabel = workspace.locator("span");
  await expect(workspaceLabel).toHaveCSS("text-overflow", "ellipsis");
  expect(await workspaceLabel.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const arrow = (await workspace.locator("svg").last().boundingBox())!;
  const workspaceBounds = (await workspace.boundingBox())!;
  expect(arrow.width).toBe(14);
  expect(arrow.x + arrow.width).toBeLessThan(workspaceBounds.x + workspaceBounds.width);
  const topHelp = page.getByLabel("导航帮助");
  await expect(topHelp.locator("svg")).toHaveAttribute("width", "22");
  await expect(topHelp).toHaveCSS("min-height", "44px");
  const search = page.getByRole("button", { name: "全局搜索", exact: true });
  const segments = sidebar.locator(".midou-area-tabs");
  const [searchBounds, segmentBounds] = await Promise.all([
    search.boundingBox(),
    segments.boundingBox(),
  ]);
  expect(searchBounds!.height).toBe(44);
  expect(await search.evaluate((node) => getComputedStyle(node, "::before").height)).toBe("37px");
  await search.click({ position: { x: 12, y: 1 } });
  await expect(page.getByRole("dialog").getByRole("textbox", { name: "搜索关键词" })).toBeVisible();
  await page.keyboard.press("Escape");
  for (const [label, path] of [
    ["市场情报", "/trends"],
    ["选品库", "/opportunities"],
    ["1688 找货", "/sourcing"],
    ["通知中心", "/notifications"],
    ["个人中心", "/me"],
    ["选品工作台", "/home"],
  ]) {
    await sidebar.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
    expect(await context.boundingBox()).toEqual(contextBounds);
    expect(await search.boundingBox()).toEqual(searchBounds);
    expect(await segments.boundingBox()).toEqual(segmentBounds);
  }
  const sidebarHelp = sidebar.getByRole("button", { name: "帮助", exact: true });
  await expect(sidebarHelp.locator("svg")).toHaveAttribute("width", "18");
  await sidebarHelp.click();
  await expect(page.locator(".midou-navigation-help")).toHaveAttribute("open", "");
  await expect(page.getByText("使用侧栏顶部切换工作台，在个人中心调整外观。")).toBeVisible();
  await page.setViewportSize({ width: 1120, height: 900 });
  const icon = search.locator("svg");
  const shortcut = search.locator("kbd");
  const text = search.locator("span");
  await expect(icon).toHaveCSS("flex-shrink", "0");
  await expect(shortcut).toHaveCSS("flex-shrink", "0");
  await expect(text).toHaveCSS("text-overflow", "ellipsis");
  const [trigger, iconBox, shortcutBox] = await Promise.all(
    [search, icon, shortcut].map((part) => part.boundingBox()),
  );
  expect(iconBox!.width).toBe(18);
  expect(shortcutBox!.x + shortcutBox!.width).toBeLessThan(trigger!.x + trigger!.width);
  await search.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
