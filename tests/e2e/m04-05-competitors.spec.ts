import { test, expect } from "@playwright/test";
import { setupRetiredCompetitor, isStandaloneCompetitorRead } from "./helpers/retired-competitor";
// Standalone monitoring is retired. Current product comparisons are verified in M04-02.
for (const address of [
  "/competitors",
  "/competitors?create=1&competitor=old#rules",
  "/competitors/monitoring-rules",
  "/competitors/monitoring-rules?create=1",
]) {
  test(`retired competitor bookmark opens selection without old reads or writes: ${address}`, async ({
    page,
  }) => {
    const calls = await setupRetiredCompetitor(page);
    await page.goto(address);
    await expect(page).toHaveURL(/\/opportunities$/);
    await expect(page.locator(".opportunity-workspace")).toBeVisible();
    await expect(page.locator(".competitor-monitor")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(calls.some((call) => isStandaloneCompetitorRead(call.path))).toBe(false);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
for (const path of ["/competitors", "/competitors/monitoring-rules"]) {
  test(`retired competitor target keeps selection permission boundary: ${path}`, async ({
    page,
  }) => {
    const calls = await setupRetiredCompetitor(page, false);
    await page.goto(path);
    await expect(page).toHaveURL(/\/opportunities$/);
    await expect(page.getByRole("heading", { name: "无权打开此页面" })).toBeVisible();
    expect(
      calls.some(
        (call) => call.path === "/api/v1/opportunities" || isStandaloneCompetitorRead(call.path),
      ),
    ).toBe(false);
  });
}
