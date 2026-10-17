import { expect, test } from "@playwright/test";

const routes = [
  ["/platform-admin", "平台运行概览", "light"],
  ["/platform-admin/accounts", "组织与用户", "light"],
  ["/platform-admin/organizations", "组织管理", "dark"],
  ["/platform-admin/users", "平台用户", "glass"],
  ["/platform-admin/admins", "平台管理员", "dark"],
  ["/platform-admin/permissions", "角色权限", "light"],
  ["/platform-admin/data", "数据中心", "glass"],
  ["/platform-admin/governance", "规则、工作流与自动化", "light"],
  ["/platform-admin/content", "内容管理", "dark"],
  ["/platform-admin/notifications", "通知管理", "glass"],
  ["/platform-admin/status", "系统状态", "dark"],
  ["/platform-admin/api-coverage", "接口覆盖证据", "light"],
  ["/platform-admin/logs", "链路日志", "glass"],
  ["/platform-admin/open-platform", "开放平台", "light"],
  ["/platform-admin/providers", "来源注册中心", "light"],
  ["/platform-admin/providers/sources", "来源频道", "glass"],
  ["/platform-admin/providers/adapters", "采集诊断目录", "dark"],
  ["/platform-admin/collection/overview", "来源与采集控制台", "light"],
  ["/platform-admin/collection", "采集任务监控", "glass"],
  ["/platform-admin/collection/browser-runtime", "采集运行监控", "dark"],
] as const;

// Deliberately failed reads exercise the real Vue boundary without fabricating platform facts.
// Functional success, writes and filtering are covered by the existing M06 browser suites.
for (const [path, title, theme] of routes)
  test(`compact platform header survives failed reads: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const envelope = (data: unknown) => ({
      data,
      request_id: "header-fixture",
      trace_id: "header-fixture",
    });
    await page.route("**/api/v1/me/navigation?**", (route) =>
      route.fulfill({
        json: envelope({
          shell: "platform_admin",
          organization_id: null,
          workspace_id: null,
          roles: [],
          capabilities: [],
          platform_roles: ["platform_super_admin"],
          platform_capabilities: [
            "platform:operate",
            "platform:secure",
            "platform:superadmin",
            "platform_token:manage",
            "audit:read",
          ],
          guard_reason: "navigation_platform_admin_allowed",
        }),
      }),
    );
    await page.route("**/api/v1/me/ui-preferences", (route) =>
      route.fulfill({
        json: envelope({ theme, density: "comfortable", motion_enabled: false, version: 1 }),
      }),
    );
    await page.route("**/api/v1/platform/**", (route) =>
      route.fulfill({
        status: 503,
        json: {
          error: { code: "platform_dependency_unavailable", message: "测试依赖暂不可用" },
          request_id: "header-fixture",
          trace_id: "header-fixture",
        },
      }),
    );
    await page.goto(path);
    const header = page.locator(".platform-page-header");
    await expect(header).toHaveCount(1);
    await expect(header.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(header).toHaveCSS("background-image", "none");
    const metrics = await header.evaluate((element) => ({
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
      height: element.getBoundingClientRect().height,
      font: parseFloat(
        getComputedStyle(element.querySelector(".platform-page-header__title")!).fontSize,
      ),
      controls: [...element.querySelectorAll("button,a,input,select")]
        .filter((control) => control.getClientRects().length)
        .map((control) => ({
          text: control.textContent?.trim() || control.tagName,
          height: control.getBoundingClientRect().height,
        })),
    }));
    expect(metrics.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    expect(metrics.height).toBeLessThanOrEqual(page.viewportSize()!.width <= 640 ? 216 : 132);
    expect(metrics.font).toBeLessThanOrEqual(22);
    expect(metrics.font).toBeGreaterThanOrEqual(20);
    for (const control of metrics.controls)
      expect(control.height, control.text).toBeGreaterThanOrEqual(43.9);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    expect(errors).toEqual([]);
    if (path === "/platform-admin/content")
      await expect(page.locator(".platform-content__rail")).toHaveCount(0);
  });
