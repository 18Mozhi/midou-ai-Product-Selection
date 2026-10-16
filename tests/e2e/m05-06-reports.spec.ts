import { test, expect, type Page } from "@playwright/test";

// The member report UI is retired. Backend report/export contracts remain in M05-06 tests.
async function setup(page: Page, canReadSelection = true) {
  const calls: Array<{ path: string; method: string }> = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    calls.push({ path, method: request.method() });
    const envelope = (data: unknown, meta?: unknown) => ({
      data,
      meta,
      request_id: "retired-report",
      trace_id: "retired-report",
    });
    if (path === "/api/v1/me/navigation")
      return route.fulfill({
        json: envelope({
          shell: "member",
          organization_id: "00000000-0000-4000-8000-000000000561",
          workspace_id: "00000000-0000-4000-8000-000000000562",
          roles: ["selection_manager"],
          capabilities: canReadSelection ? ["opportunity:read", "report:read"] : ["report:read"],
          platform_roles: [],
          platform_capabilities: [],
          guard_reason: "navigation_member_allowed",
        }),
      });
    if (path === "/api/v1/opportunities")
      return route.fulfill({ json: envelope([], { total: 0, page: 1, page_size: 20 }) });
    if (path === "/api/v1/opportunities/member-options")
      return route.fulfill({ json: envelope([]) });
    return route.fulfill({
      status: 503,
      json: {
        error: { code: "dependency_unavailable", action_hint: "Fixture dependency unavailable" },
        request_id: "retired-report",
        trace_id: "retired-report",
      },
    });
  });
  return calls;
}

for (const address of [
  "/reports",
  "/reports?report=team&export=00000000-0000-4000-8000-000000000563",
]) {
  test(`retired member report link opens selection without report reads or writes: ${address}`, async ({
    page,
  }) => {
    const calls = await setup(page);
    await page.goto(address);
    await expect(page).toHaveURL(/\/opportunities(?:\?|$)/);
    await expect(page.locator(".opportunity-workspace")).toBeVisible();
    await expect(page.getByRole("button", { name: "导出当前报表 CSV" })).toHaveCount(0);
    expect(calls.some(({ path }) => /\/reports(?:\/|$)|\/report-exports/.test(path))).toBe(false);
    expect(calls.every(({ method }) => method === "GET")).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("retired report link retains target permission checks", async ({ page }) => {
  const calls = await setup(page, false);
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/opportunities(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "无权打开此页面" })).toBeVisible();
  expect(calls.some(({ path }) => path === "/api/v1/opportunities")).toBe(false);
  expect(calls.some(({ path }) => /\/reports(?:\/|$)|\/report-exports/.test(path))).toBe(false);
});
