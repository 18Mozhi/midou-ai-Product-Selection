import { expect, test } from "@playwright/test";

// Layout and navigation resilience only. Controlled read failures do not certify
// source health, authorization, collection or any production write.
const navigation = {
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
    "provider:configure",
    "collection:replay",
  ],
  guard_reason: "navigation_platform_admin_allowed",
};
const routes = [
  "/platform-admin/providers",
  "/platform-admin/providers/adapters",
  "/platform-admin/providers/sources",
  "/platform-admin/providers/sources/1688-acceptance",
  "/platform-admin/credentials",
  "/platform-admin/collection/overview",
  "/platform-admin/collection",
  "/platform-admin/collection/browser-runtime",
];
for (const path of routes) {
  test(`runtime navigation stays above full-width content on ${path}`, async ({
    page,
    baseURL,
  }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/") && !["GET", "HEAD"].includes(request.method()))
        writes.push(request.url());
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL!).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const isNavigation = url.pathname === "/api/v1/me/navigation";
      return route.fulfill({
        status: isNavigation ? 200 : 503,
        contentType: "application/json",
        body: JSON.stringify({
          ...(isNavigation
            ? { data: navigation }
            : {
                error: {
                  code: "dependency_unavailable",
                  message: "暂时无法读取",
                  action_hint: "请稍后重试",
                },
              }),
          request_id: "runtime-navigation-layout",
          trace_id: "runtime-navigation-layout",
        }),
      });
    });
    await page.goto(path);
    const surface = page.locator(".provider-runtime-surface"),
      nav = surface.locator(".provider-runtime-tabs");
    await expect(nav).toBeVisible();
    await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute("href", path);
    await expect(surface.locator(":scope > :not(nav)").first()).toBeVisible();
    const layout = await surface.evaluate((element) => {
      const nav = element.querySelector("nav")!,
        content = Array.from(element.children).find((node) => node !== nav)!;
      const n = nav.getBoundingClientRect(),
        c = content.getBoundingClientRect();
      return {
        nav: { x: n.x, y: n.y, bottom: n.bottom, width: n.width },
        content: { x: c.x, y: c.y, width: c.width },
        background: getComputedStyle(nav).backgroundColor,
        links: Array.from(nav.querySelectorAll("a")).map((link) => ({
          height: link.getBoundingClientRect().height,
          width: link.getBoundingClientRect().width,
        })),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(layout.nav.bottom).toBeLessThanOrEqual(layout.content.y + 1);
    expect(Math.abs(layout.nav.x - layout.content.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.nav.width - layout.content.width)).toBeLessThanOrEqual(1);
    expect(layout.background).toBe("rgba(0, 0, 0, 0)");
    expect(layout.overflow).toBe(false);
    for (const link of layout.links) expect(link.height).toBeGreaterThanOrEqual(44);
    const current = nav.locator('a[aria-current="page"]');
    await current.focus();
    expect(await current.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
      "none",
    );
    expect(writes).toEqual([]);
  });
}
