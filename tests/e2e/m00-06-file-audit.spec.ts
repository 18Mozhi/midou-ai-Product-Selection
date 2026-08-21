import { expect, test } from "@playwright/test";
test("M00-06.A07/A15 file audit foundation is visually stable", async ({ page }) => {
  await page.goto("/?view=file-audit");
  await expect(page.getByRole("heading", { name: "文件与审计基座", exact: true })).toBeVisible();
  await expect(page.getByText("PROTECTED · 已隔离")).toBeVisible();
  await expect(page).toHaveScreenshot("m00-06-file-audit.png", { fullPage: true });
});
test("M00-06.A08/A16 denied and redacted states are explicit at 390px", async ({ page }) => {
  await page.goto("/?view=file-audit&state=denied");
  await expect(page.getByText("DENIED · 默认拒绝")).toBeVisible();
  await page.getByRole("button", { name: "审计脱敏" }).click();
  await expect(page.getByText("REDACTED · 已脱敏")).toBeVisible();
  if (page.viewportSize()?.width === 390)
    await expect(page).toHaveScreenshot("m00-06-file-audit-390.png", { fullPage: true });
});
