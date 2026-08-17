import { test, expect } from '@playwright/test';

const navigation = { shell: 'member', organization_id: '00000000-0000-4000-8000-000000000501', workspace_id: '00000000-0000-4000-8000-000000000502', roles: ['member'], capabilities: ['task:read', 'task:create', 'sourcing:read', 'notification:read'], platform_roles: [], platform_capabilities: [], guard_reason: 'navigation_member_allowed' };
async function base(page: any) {
  await page.route('**/api/v1/me/navigation?**', (route: any) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: navigation, request_id: 'm02-05-nav', trace_id: 'm02-05-nav' }) }));
  await page.route('**/api/v1/me/home-dashboard', (route: any) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { actions: [], changes: [], follows: [], health: [], scope: { organization_id: navigation.organization_id, workspace_id: navigation.workspace_id }, generated_at: '2026-08-08T00:00:00.000Z' }, request_id: 'm02-05-home', trace_id: 'm02-05-home' }) }));
}

test('M02-05.A07/A08/A15 keyboard search is responsive and visual', async ({ page }) => {
  await base(page);
  await page.route('**/api/v1/me/global-search?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [{ id: '00000000-0000-4000-8000-000000000510', resource_type: 'opportunity', resource_id: '00000000-0000-4000-8000-000000000511', title: '户外照明机会', subtitle: '当前工作区已索引记录', route: '/opportunities/00000000-0000-4000-8000-000000000511', updated_at: '2026-08-07T15:00:00.000Z' }], next_cursor: null, scope: { organization_id: navigation.organization_id, workspace_id: navigation.workspace_id } }, request_id: 'm02-05-search', trace_id: 'm02-05-search' }) }));
  await page.goto('/home');
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: '全局搜索' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('输入至少 2 个字符').fill('户外照明');
  await dialog.getByPlaceholder('输入至少 2 个字符').press('Enter');
  await expect(dialog.getByRole('link', { name: /户外照明机会/ })).toBeVisible();
  await expect(page).toHaveScreenshot('m02-05-global-search.png');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('M02-05.A07/A08/A09/A15 mobile quick create shows authorized entries only', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await base(page);
  await page.route('**/api/v1/me/quick-actions?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'task', label: '创建任务', description: '进入任务创建页', route: '/tasks?create=1', required_capability: 'task:create' }, { id: 'sourcing', label: '发起找货', description: '进入供应链搜索', route: '/sourcing?create=1', required_capability: 'sourcing:read' }], request_id: 'm02-05-actions', trace_id: 'm02-05-actions' }) }));
  await page.goto('/home');
  await page.getByRole('navigation', { name: '移动快捷导航' }).getByRole('button', { name: '创建' }).click();
  const dialog = page.getByRole('dialog', { name: '快捷创建' });
  await expect(dialog.getByRole('link', { name: /创建任务/ })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /发起找货/ })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /创建任务/ })).toHaveAttribute('href', '/tasks?create=1');
  await expect(dialog.getByRole('link', { name: /发起找货/ })).toHaveAttribute('href', '/sourcing?create=1');
  await expect(dialog.getByText('邀请成员')).toHaveCount(0);
  await expect(page).toHaveScreenshot('m02-05-quick-create.png');
});

test('M02-05.A08/A16 expired and empty states are not reported as success', async ({ page }) => {
  await base(page);
  let status = 401;
  await page.route('**/api/v1/me/global-search?**', (route) => route.fulfill(status === 401 ? { status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'session_invalid', message: '登录已失效。', action_hint: '重新登录。' }, request_id: 'm02-05-expired', trace_id: 'm02-05-expired' }) } : { status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [], next_cursor: null, scope: { organization_id: navigation.organization_id, workspace_id: navigation.workspace_id } }, request_id: 'm02-05-empty', trace_id: 'm02-05-empty' }) }));
  await page.goto('/home');
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: '全局搜索' });
  const input = dialog.getByPlaceholder('输入至少 2 个字符');
  await input.fill('无结果');
  await input.press('Enter');
  await expect(dialog.getByRole('heading', { name: '登录已失效' })).toBeVisible();
  status = 200;
  await dialog.getByRole('button', { name: '重新加载' }).click();
  await expect(dialog.getByRole('heading', { name: '这里还没有内容' })).toBeVisible();
});
