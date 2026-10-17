import { test, expect, type Page } from "@playwright/test";

// The member journey UI is retired. Backend journey contracts remain in M05-05 tests.
async function setup(page: Page, canReadSelection = true) {
  const calls: Array<{ path: string; method: string }> = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    calls.push({ path, method: request.method() });
    const envelope = (data: unknown, meta?: unknown) => ({
      data,
      meta,
      request_id: "retired-journey",
      trace_id: "retired-journey",
    });
    if (path === "/api/v1/me/navigation")
      return route.fulfill({
        json: envelope({
          shell: "member",
          organization_id: "00000000-0000-4000-8000-000000000561",
          workspace_id: "00000000-0000-4000-8000-000000000562",
          roles: ["selection_manager"],
          capabilities: canReadSelection ? ["opportunity:read", "team:manage"] : ["team:manage"],
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
        request_id: "retired-journey",
        trace_id: "retired-journey",
      },
    });
  });
  return calls;
}

for (const address of [
  "/opportunities/start",
  "/opportunities/start?rule=00000000-0000-4000-8000-000000000553&action=edit#history",
]) {
  test(`retired member journey link opens selection without journey reads or writes: ${address}`, async ({
    page,
  }) => {
    const calls = await setup(page);
    await page.goto(address);
    await expect(page).toHaveURL(/\/opportunities(?:\?|$)/);
    await expect(page.locator(".opportunity-workspace")).toBeVisible();
    await expect(page.locator(".selection-journey")).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe("");
    await expect(page.getByRole("button", { name: "创建选品", exact: true })).toHaveCount(0);
    expect(calls.some(({ path }) => /\/selection-journeys(?:\/|$)/.test(path))).toBe(false);
    expect(calls.every(({ method }) => method === "GET")).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("retired journey link retains target permission checks", async ({ page }) => {
  const calls = await setup(page, false);
  await page.goto("/opportunities/start");
  await expect(page).toHaveURL(/\/opportunities(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "无权打开此页面" })).toBeVisible();
  expect(calls.some(({ path }) => path === "/api/v1/opportunities")).toBe(false);
  expect(calls.some(({ path }) => /\/selection-journeys(?:\/|$)/.test(path))).toBe(false);
});
