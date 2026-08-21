import { expect, test } from "@playwright/test";

test("M00-04.A07/A15 Redis foundation is visually stable", async ({ page }) => {
  await page.goto("/?view=redis");
  await expect(page.getByRole("heading", { name: "缓存服务基座" })).toBeVisible();
  await expect(page.getByText("契约状态预览 · 非实时监控")).toBeVisible();
  await expect(page).toHaveScreenshot("m00-04-redis.png", { fullPage: true });
});

test("M00-04.A08/A16 dependency failure and recovery are explicit at 390px", async ({ page }) => {
  await page.goto("/?view=redis&state=unavailable");
  await expect(page.getByText("不可用 · 已阻塞")).toBeVisible();
  await page.getByRole("button", { name: "恢复中" }).click();
  await expect(page.getByText("恢复中 · 恢复检查")).toBeVisible();
  if (page.viewportSize()?.width === 390)
    await expect(page).toHaveScreenshot("m00-04-redis-390.png", { fullPage: true });
});
