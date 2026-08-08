import { expect, test } from '@playwright/test';

const summary = (shell: 'member' | 'organization_admin' | 'platform_admin') => ({ shell, organization_id: shell === 'platform_admin' ? null : '00000000-0000-4000-8000-000000000103', workspace_id: shell === 'platform_admin' ? null : '00000000-0000-4000-8000-000000000104', roles: shell === 'organization_admin' ? ['organization_admin'] : shell === 'member' ? ['member'] : [], capabilities: shell === 'organization_admin' ? ['task:read', 'organization:manage'] : shell === 'member' ? ['task:read', 'trend:read', 'opportunity:read', 'competitor:read', 'sourcing:read', 'notification:read'] : [], platform_roles: shell === 'platform_admin' ? ['platform_super_admin'] : [], platform_capabilities: shell === 'platform_admin' ? ['platform:operate', 'platform:secure', 'platform:superadmin'] : [], guard_reason: `navigation_${shell}_allowed` });

async function allow(page: any, shell: 'member' | 'organization_admin' | 'platform_admin') {
  await page.route('**/api/v1/me/navigation?**', (route: any) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: summary(shell), request_id: 'm02-03-e2e-request', trace_id: 'm02-03-e2e-trace' }) }));
  await page.route('**/api/v1/me/home-dashboard', (route: any) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { actions: [], changes: [], follows: [], health: [], scope: { organization_id: '00000000-0000-4000-8000-000000000103', workspace_id: '00000000-0000-4000-8000-000000000104' }, generated_at: '2026-08-07T16:30:00.000Z' }, request_id: 'm02-03-home', trace_id: 'm02-03-home' }) }));
  const envelope = (data: unknown) => ({ data, request_id: 'm02-03-business', trace_id: 'm02-03-business' });
  await page.route('**/api/v1/org/admin/summary', (route: any) => route.fulfill({ json: envelope({ organization: { id: '00000000-0000-4000-8000-000000000103', name: 'Shell Contract Org', timezone: 'Asia/Shanghai', data_retention_days: 365, default_workspace_id: '00000000-0000-4000-8000-000000000104', version: 1 }, members: { total: 0, active: 0 }, workspaces: { total: 1, active: 1 }, teams: { total: 0, active: 0 }, pending_approvals: 0, active_tokens: 0, recent_audit_events: 0, observed_at: '2026-08-08T00:00:00.000Z' }) }));
  await page.route('**/api/v1/org/admin/profile', (route: any) => route.fulfill({ json: envelope({ id: '00000000-0000-4000-8000-000000000103', name: 'Shell Contract Org', logo_url: null, slug: 'shell-contract', status: 'active', timezone: 'Asia/Shanghai', data_retention_days: 365, default_workspace_id: '00000000-0000-4000-8000-000000000104', version: 1, updated_at: '2026-08-08T00:00:00.000Z' }) }));
  await page.route('**/api/v1/platform/dashboard?**', (route: any) => route.fulfill({ json: envelope({ window: '24h', summary: { active_organizations: 0, active_users: 0, enabled_providers: 0, task_success_rate: null, queue_backlog: 0, open_alerts: 0, storage_bytes: 0, file_growth_bytes: 0 }, queues: [], provider_health: [], task_trend: [], health_signals: [], alerts: [], activity: [], observed_at: '2026-08-08T00:00:00.000Z' }) }));
}

for (const item of [
  { shell: 'member' as const, path: '/home', heading: '今日行动', snapshot: 'm02-03-member.png' },
  { shell: 'organization_admin' as const, path: '/org-admin', heading: '组织资料', snapshot: 'm02-03-org-admin.png' },
  { shell: 'platform_admin' as const, path: '/platform-admin', heading: '平台驾驶舱', snapshot: 'm02-03-platform-admin.png' }
]) test(`M02-03.A07/A09/A15 ${item.shell} shell is isolated responsive and visual`, async ({ page }) => {
  await allow(page, item.shell);
  await page.goto(item.path);
  await expect(page.getByRole('heading', { name: item.heading, level: 1 })).toBeVisible();
  await expect(page.locator('.role-shell')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('.role-sidebar')).toHaveAttribute('aria-label', new RegExp(item.shell === 'member' ? '成员' : item.shell === 'organization_admin' ? '组织' : '平台'));
  await expect(page).toHaveScreenshot(item.snapshot, { fullPage: true });
});

test('M02-03.A08 mobile drawer is keyboard operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await allow(page, 'member');
  await page.goto('/home');
  const toggle = page.getByRole('button', { name: '打开导航菜单' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const drawer = page.locator('#role-navigation');
  await expect(drawer).toHaveClass(/is-open/);
  await expect(drawer.getByRole('link', { name: '今日工作' })).toBeVisible();
});

test('M02-03.A16 forbidden shell shows request id and safe recovery', async ({ page }) => {
  await page.route('**/api/v1/me/navigation?**', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 'navigation_shell_forbidden', message: '权限检查未通过。', action_hint: '返回有权访问的工作台。' }, request_id: 'm02-03-forbidden', trace_id: 'm02-03-trace' }) }));
  await page.goto('/platform-admin');
  await expect(page.getByRole('heading', { name: '无权进入此工作台' })).toBeVisible();
  await expect(page.getByText('request_id: m02-03-forbidden')).toBeVisible();
  await expect(page.getByRole('link', { name: '返回成员工作台' })).toHaveAttribute('href', '/home');
});
