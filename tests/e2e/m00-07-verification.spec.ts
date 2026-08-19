import { expect, test } from '@playwright/test';

test('M00-07.A15 verification dashboard is visually stable', async ({ page }) => {
  await page.goto('/?view=verification');
  await expect(page.getByRole('heading', { name: '自动验收框架' })).toBeVisible();
  await expect(page.getByText('通过', { exact: true })).toBeVisible();
  await expect(page.getByText('失败', { exact: true })).toBeVisible();
  await expect(page.getByText('前置未满足', { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('m00-07-verification.png', { fullPage: true });
});

test('M00-07.A07 commands and state semantics remain readable at 390px', async ({ page }) => {
  await page.goto('/?view=verification');
  if (page.viewportSize()?.width === 390) {
    await expect(page.getByText('npm run verify:all')).toBeVisible();
    await expect(page).toHaveScreenshot('m00-07-verification-390.png', { fullPage: true });
  }
});
