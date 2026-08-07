import { expect, test } from '@playwright/test';

test('M00-01.A15 ready runtime is accessible and visually stable', async ({ page }) => {
  await page.route('**/api/v1/health/live', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { status: 'ok', service: 'product-scout-api', version: '0.1.0', build_sha: 'visual-test' },
        meta: { observed_at: '2026-08-07T00:00:00.000Z' },
        request_id: 'request-visual',
        trace_id: 'trace-visual',
      }),
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('ready-state')).toBeVisible();
  await expect(page.getByRole('heading', { name: '运行基座' })).toBeVisible();
  await expect(page).toHaveScreenshot('m00-01-ready.png', { fullPage: true });
});

test('M00-01.A08/M00-01.A15 error state keeps recovery action at 390px', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: () => 'request-e2e-offline',
    });
  });
  await page.route('**/api/v1/health/live', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'dependency_unavailable' } }),
  }));
  await page.goto('/');
  await expect(page.getByTestId('error-state')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新检查' })).toBeVisible();
  if (page.viewportSize()?.width === 390) {
    await expect(page).toHaveScreenshot('m00-01-error-390.png', { fullPage: true });
  }
});
