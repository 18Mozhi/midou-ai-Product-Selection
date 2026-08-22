import { test, expect } from "@playwright/test";
test("M02-04.A07/A15 state library is visually stable", async ({ page }) => {
  await page.goto("/ui-states");
  await expect(page.getByRole("heading", { name: "这里还没有内容" })).toBeVisible();
  await expect(page).toHaveScreenshot("m02-04-state-library.png", { fullPage: true });
});
test("M02-04.A08/A16 blocked state recovers through an explicit action", async ({ page }) => {
  await page.goto("/ui-states");
  await page.getByRole("button", { name: "受阻" }).click();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  await page.getByRole("button", { name: "稍后重试" }).click();
  await expect(page.getByRole("heading", { name: "服务已恢复" })).toBeVisible();
});
test("M02-04.A07/A15 unknown route renders the reference-grounded 404 state", async ({ page }) => {
  await page.goto("/ui-states");
  await page.goto("/route-that-does-not-exist");
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
  await expect(page.getByText("最近有效页面：/ui-states")).toBeVisible();
  await page.getByRole("button", { name: "返回最近页面" }).click();
  await expect(page).toHaveURL(/\/ui-states$/);
  await page.goto("/route-that-does-not-exist");
  await expect(page).toHaveScreenshot("m02-04-not-found.png", { fullPage: true });
});
test("M02-04.A08/A15 high-impact confirmation is keyboard safe and fail-closed", async ({
  page,
}) => {
  await page.goto("/ui-states");
  const trigger = page.getByRole("button", { name: "查看高影响确认弹窗" });
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const submit = page.getByRole("button", { name: "确认演示" });
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByPlaceholder("确认撤销").fill("确认撤销");
  await expect(submit).toBeEnabled();
  await expect(page).toHaveScreenshot("m02-04-confirm-dialog.png", { fullPage: true });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
