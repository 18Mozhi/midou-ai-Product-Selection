import { test, expect } from "@playwright/test";
import { setupRetiredTask } from "./helpers/retired-task";
test("retired task detail cannot leave a cached task surface after current navigation", async ({
  page,
}) => {
  const calls = await setupRetiredTask(page);
  await page.goto("/tasks/00000000-0000-4000-8000-000000000807?from=/work");
  await expect(page).toHaveURL(/\/opportunities$/);
  const menu = page.getByRole("button", { name: "打开导航菜单", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: "选品工作台", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: "选品库", exact: true }).first().click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.locator(".task-workspace, .task-dossier")).toHaveCount(0);
  expect(calls.some((item) => /^\/api\/v1\/tasks(?:\/|$)/.test(item.path))).toBe(false);
});
