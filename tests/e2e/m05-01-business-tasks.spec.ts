import { test, expect } from "@playwright/test";
import { setupRetiredTask } from "./helpers/retired-task";

for (const legacy of [
  "/tasks",
  "/tasks?view=exports&create=1",
  "/tasks/00000000-0000-4000-8000-000000000801?from=/work",
]) {
  test(`retired member task URL opens selection without legacy calls: ${legacy}`, async ({
    page,
  }) => {
    const calls = await setupRetiredTask(page);
    await page.goto(legacy);
    await expect(page).toHaveURL(/\/opportunities$/);
    await expect(page.locator(".task-workspace, .task-dossier, .task-export-jobs")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "选品库", exact: true }).first()).toBeVisible();
    expect(calls.filter((call) => /^\/api\/v1\/tasks(?:\/|$)/.test(call.path))).toEqual([]);
    expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test("retired task URL still requires destination selection permission", async ({ page }) => {
  const calls = await setupRetiredTask(page, false);
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByRole("heading", { name: "无权打开此页面" })).toBeVisible();
  expect(calls.some((call) => call.path === "/api/v1/opportunities")).toBe(false);
});
test("retired today work URL opens the automatic selection home", async ({ page }) => {
  const calls = await setupRetiredTask(page);
  await page.goto("/work?create=1");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator(".task-workspace")).toHaveCount(0);
  expect(calls.some((call) => /^\/api\/v1\/tasks(?:\/|$)/.test(call.path))).toBe(false);
});
