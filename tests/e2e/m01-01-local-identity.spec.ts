import { test, expect } from '@playwright/test';

test('M01-01.A07/A15 local identity login and registration are visually stable', async ({ page }) => {
  await page.goto('/?view=local-identity');
  await expect(page.getByRole('heading', { name: '欢迎回到 ScoutOps' })).toBeVisible();
  await expect(page).toHaveScreenshot('m01-01-login.png', { fullPage: true });
  await page.getByRole('button', { name: '创建本地账号' }).click();
  await expect(page.getByRole('heading', { name: '创建本地账号' })).toBeVisible();
  await expect(page).toHaveScreenshot('m01-01-register.png', { fullPage: true });
});

test('M01-01.A08/A15 recovery and session states remain accessible at 390px', async ({ page }) => {
  await page.goto('/?view=local-identity&state=expired');
  await expect(page.getByText('链接已过期')).toBeVisible();
  await page.getByRole('button', { name: '查看安全会话' }).click();
  await expect(page.getByRole('heading', { name: '我的设备会话' })).toBeVisible();
  await expect(page).toHaveScreenshot('m01-01-sessions.png', { fullPage: true });
});
