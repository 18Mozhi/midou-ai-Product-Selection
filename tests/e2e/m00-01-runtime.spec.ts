import { expect, test, type Page } from '@playwright/test';

const navigation = {
  shell: 'member',
  organization_id: '00000000-0000-4000-8000-000000000001',
  workspace_id: '00000000-0000-4000-8000-000000000002',
  roles: ['member'],
  capabilities: ['task:read', 'trend:read', 'opportunity:read'],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: 'navigation_member_allowed',
};

async function allowMemberNavigation(page: Page) {
  await page.route('**/api/v1/me/landing', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { shell: 'member', route: '/home', reason: 'landing_member' }, request_id: 'm00-runtime-landing', trace_id: 'm00-runtime-landing' }),
  }));
  await page.route('**/api/v1/me/navigation?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: navigation, request_id: 'm00-runtime-nav', trace_id: 'm00-runtime-nav' }),
  }));
}

test('M00-01.A15 product entry is accessible and visually stable', async ({ page }) => {
  await allowMemberNavigation(page);
  await page.route('**/api/v1/me/home-dashboard', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        actions: [], changes: [], follows: [], health: [],
        scope: { organization_id: navigation.organization_id, workspace_id: navigation.workspace_id },
        generated_at: '2026-08-07T00:00:00.000Z',
      },
      request_id: 'm00-runtime-home', trace_id: 'm00-runtime-home',
    }),
  }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今日行动' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '当前范围还没有首页数据' })).toBeVisible();
  await expect(page).toHaveScreenshot('m00-01-ready.png', { fullPage: true });
});

test('M00-01.A08/M00-01.A15 startup dependency error keeps recovery action at 390px', async ({ page }) => {
  await allowMemberNavigation(page);
  await page.route('**/api/v1/me/home-dashboard', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'dependency_unavailable', action_hint: '稍后重试。' }, request_id: 'request-e2e-offline' }),
  }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '依赖暂时受阻' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新读取' })).toBeVisible();
  if (page.viewportSize()?.width === 390) {
    await expect(page).toHaveScreenshot('m00-01-error-390.png', { fullPage: true });
  }
});
