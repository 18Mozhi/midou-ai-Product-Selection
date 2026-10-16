import { test, expect } from "@playwright/test";
import { setupRetiredCompetitor, isStandaloneCompetitorRead } from "./helpers/retired-competitor";
// Current retirement navigation replaces obsolete manual-monitor dialog race fixtures.
test("retired competitor routes never restore the old cached monitor", async ({ page }) => {
  const calls = await setupRetiredCompetitor(page);
  await page.goto("/competitors?create=1");
  await expect(page).toHaveURL(/\/opportunities$/);
  await page.goto("/competitors/monitoring-rules?competitor=old");
  await expect(page).toHaveURL(/\/opportunities$/);
  await page.reload();
  await expect(page.locator(".opportunity-workspace")).toBeVisible();
  await expect(page.locator(".competitor-monitor")).toHaveCount(0);
  expect(calls.some((call) => isStandaloneCompetitorRead(call.path))).toBe(false);
  expect(calls.every((call) => call.method === "GET")).toBe(true);
});
