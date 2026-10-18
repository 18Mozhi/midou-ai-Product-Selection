import { test, expect } from "@playwright/test";
import { setupRetiredTask } from "./helpers/retired-task";

// Historical action forms are retained in Git; current routes must never mount them.
test("legacy task editor parameters and hash cannot restore forms or writes", async ({ page }) => {
  const calls = await setupRetiredTask(page);
  await page.goto("/tasks?create=1&title=old&description=old&view=exports#edit");
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".task-workspace")).toHaveCount(0);
  expect(
    calls.filter((item) => item.method !== "GET" || /^\/api\/v1\/tasks(?:\/|$)/.test(item.path)),
  ).toEqual([]);
});
