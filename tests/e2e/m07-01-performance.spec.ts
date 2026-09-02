import { test, expect } from "@playwright/test";

const organizationId = "00000000-0000-4000-8000-000000000701";
const workspaceId = "00000000-0000-4000-8000-000000000702";

test("M07-01.A07/A08/A15 representative home meets browser budgets on desktop and 390px", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const metrics = { cls: 0, lcp: 0 };
    Object.defineProperty(window, "__m0701Metrics", { value: metrics });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!(entry as any).hadRecentInput) metrics.cls += (entry as any).value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length) metrics.lcp = entries.at(-1)?.startTime ?? 0;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          shell: "member",
          organization_id: organizationId,
          workspace_id: workspaceId,
          roles: ["member"],
          capabilities: ["task:read", "opportunity:read"],
          platform_roles: [],
          platform_capabilities: [],
          guard_reason: "m07_01_member_scope",
        },
        request_id: "m07-01-nav",
        trace_id: "m07-01-nav",
      }),
    }),
  );
  await page.route("**/api/v1/me/home-dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          actions: [],
          changes: [],
          follows: [],
          health: [],
          scope: { organization_id: organizationId, workspace_id: workspaceId },
          generated_at: "2026-08-08T00:00:00.000Z",
        },
        request_id: "m07-01-home",
        trace_id: "m07-01-home",
      }),
    }),
  );
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "选品控制台" })).toBeVisible();
  await expect(page.getByText("自动选品未配置", { exact: true })).toBeVisible();
  await page.waitForTimeout(250);
  const resourceBudget = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return {
      requestCount: resources.length,
      transferredBytes: resources.reduce((sum, resource) => sum + resource.transferSize, 0),
    };
  });
  const metrics = await page.evaluate(
    () => (window as any).__m0701Metrics as { cls: number; lcp: number },
  );
  expect(resourceBudget.requestCount).toBeLessThanOrEqual(80);
  expect(resourceBudget.transferredBytes).toBeLessThanOrEqual(2_500_000);
  expect(metrics.cls).toBeLessThan(0.1);
  expect(metrics.lcp).toBeGreaterThan(0);
  expect(metrics.lcp).toBeLessThan(2500);
  if ((await page.viewportSize())?.width === 390) {
    const menu = page.getByRole("button", { name: "打开导航菜单" });
    const started = performance.now();
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(performance.now() - started).toBeLessThan(200);
  }
});
