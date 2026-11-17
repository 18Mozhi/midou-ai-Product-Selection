import { expect, test, type Page } from "@playwright/test";

async function mockRetiredNavigation(page: Page) {
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    const platform =
      url.searchParams.get("shell") === "platform_admin" ||
      route.request().headers().referer?.includes("/platform-admin");
    const data = url.pathname.endsWith("/me/navigation")
      ? {
          shell: platform ? "platform_admin" : "member",
          account_rehearsal: true,
          organization_id: null,
          workspace_id: null,
          roles: [],
          capabilities: [],
          platform_roles: ["platform_super_admin"],
          platform_capabilities: ["platform:operate", "platform:superadmin", "collection:replay"],
          guard_reason: platform
            ? "navigation_platform_admin_allowed"
            : "navigation_account_rehearsal",
        }
      : { authenticated: true, account_rehearsal: true };
    return route.fulfill({
      json: { data, request_id: "sidebar-layout", trace_id: "sidebar-layout" },
    });
  });
}

test("retired account sidebar never overlaps links and keeps Help visible on Windows-sized windows", async ({
  page,
}) => {
  await mockRetiredNavigation(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const path of ["/home", "/opportunities", "/platform-admin"]) {
    await page.goto(path);
    const sidebar = page.getByRole("complementary", { name: "账号导航" });
    await expect(sidebar).toBeVisible();
    for (const [width, height] of [
      [960, 650],
      [1366, 768],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(sidebar.getByRole("button", { name: "帮助" })).toBeInViewport({ ratio: 1 });
      const { collisions, pageFits } = await sidebar.evaluate((rail) => {
        const rects = [...rail.querySelectorAll("a, button, h2")]
          .filter((node) => node.getClientRects().length)
          .map((node) => {
            const { top, bottom, left, right } = node.getBoundingClientRect();
            const scroll = node.closest(".commerce-sidebar-menu");
            const clip =
              scroll && getComputedStyle(scroll).overflowY === "auto"
                ? scroll.getBoundingClientRect()
                : rail.getBoundingClientRect();
            return {
              label: node.textContent?.trim(),
              rect: {
                top: Math.max(top, clip.top),
                bottom: Math.min(bottom, clip.bottom),
                left,
                right,
              },
            };
          })
          .filter(({ rect }) => rect.bottom > rect.top);
        return {
          collisions: rects.flatMap((a, i) =>
            rects
              .slice(i + 1)
              .filter(
                ({ rect: b }) =>
                  Math.min(a.rect.bottom, b.bottom) - Math.max(a.rect.top, b.top) > 1 &&
                  Math.min(a.rect.right, b.right) - Math.max(a.rect.left, b.left) > 1,
              )
              .map((b) => [a.label, b.label]),
          ),
          pageFits: document.documentElement.scrollWidth <= innerWidth,
        };
      });
      expect(collisions, `${path} at ${width}×${height}`).toEqual([]);
      expect(pageFits).toBe(true);
    }
    if (path === "/platform-admin") {
      await page.setViewportSize({ width: 960, height: 480 });
      const lastLink = sidebar.locator(".commerce-sidebar-menu a").last();
      await lastLink.focus();
      await expect(lastLink).toBeInViewport({ ratio: 1 });
      await expect(sidebar.getByRole("button", { name: "帮助" })).toBeInViewport({ ratio: 1 });
    }
  }
});

test("the narrow-window drawer keeps its existing navigation and focus return", async ({
  page,
}) => {
  await mockRetiredNavigation(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/home");
  const opener = page.getByRole("button", { name: "打开导航菜单" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "工作台导航" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "选品库", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
