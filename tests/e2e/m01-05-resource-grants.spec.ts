import { test, expect, type Page } from '@playwright/test';

const org = '00000000-0000-4000-8000-000000000521';
const workspace = '00000000-0000-4000-8000-000000000522';
const membership = '00000000-0000-4000-8000-000000000523';
const resource = '00000000-0000-4000-8000-000000000524';
const envelope = (data: unknown, meta?: unknown) => ({ data, ...(meta ? { meta } : {}), request_id: 'grant-e2e-request', trace_id: 'grant-e2e-trace' });
const authorization = { organization_id: org, workspace_id: workspace, roles: ['organization_admin'], capabilities: ['role:read', 'role:manage', 'membership:read'], data_scopes: [{ scope: 'organization' }] };
const grant = { id: '00000000-0000-4000-8000-000000000525', organization_id: org, workspace_id: workspace, resource_type: 'opportunity', resource_id: resource, grantee_membership_id: membership, grantor_id: '00000000-0000-4000-8000-000000000526', reason: '采购团队核对供应报价', status: 'active', effective_status: 'active', expires_at: '2026-08-20T10:00:00.000Z', revoked_at: null, revoked_by: null, revocation_reason: null, version: 1, created_at: '2026-08-07T10:00:00.000Z', updated_at: '2026-08-07T10:00:00.000Z', actions: ['opportunity:read', 'opportunity:decide'] };

async function ready(page: Page, items = [grant]) {
  await page.clock.setFixedTime(new Date('2026-08-08T10:00:00.000Z'));
  await page.route('**/api/v1/me/authorization', (route) => route.fulfill({ json: envelope(authorization) }));
  await page.route(`**/api/v1/org/${org}/resource-grant-targets`, (route) => route.fulfill({ json: envelope([{ id: membership, user_id: '00000000-0000-4000-8000-000000000527', email: 'buyer@example.test', status: 'active' }]) }));
  await page.route(`**/api/v1/org/${org}/resource-grants*`, (route) => route.fulfill({ json: envelope(items, { page: 1, limit: 100, total: items.length }) }));
}

test('M01-05.A07/A08/A15 grant list is responsive, stateful and keyboard navigable', async ({ page }) => {
  await ready(page);
  await page.goto('/?view=resource-grants');
  await expect(page.getByRole('heading', { name: '资源临时授权' })).toBeVisible();
  await page.getByRole('button', { name: /机会 · 00000000/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('采购团队核对供应报价')).toBeVisible();
  await page.getByRole('button', { name: '生效中', exact: true }).click();
  await expect(page.getByText('1 条授权')).toBeVisible();
  await expect(page).toHaveScreenshot('m01-05-resource-grants.png', { fullPage: true, maxDiffPixels: 100 });
});

test('M01-05.A07/A08 creation form exposes same-org member and safe action choices', async ({ page }) => {
  await ready(page, []);
  await page.goto('/?view=resource-grants');
  await page.getByRole('button', { name: '新建授权' }).click();
  await expect(page.getByRole('heading', { name: '授权指定资源' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'buyer@example.test' })).toBeAttached();
  await expect(page.getByText('opportunity:read')).toBeVisible();
  await expect(page.getByText('collection:replay')).toHaveCount(0);
  await expect(page.getByText('不得超过 30 天；到期自动失效。')).toBeVisible();
});

test('M01-05.A08/A16 blocked grant explains exact recovery conditions', async ({ page }) => {
  await page.route('**/api/v1/me/authorization', (route) => route.fulfill({ json: envelope(authorization) }));
  await page.route(`**/api/v1/org/${org}/resource-grants*`, (route) => route.fulfill({ status: 400, json: { error: { code: 'grant_expiry_invalid' }, request_id: 'grant-blocked', trace_id: 't' } }));
  await page.goto('/?view=resource-grants');
  await expect(page.getByText('授权条件不满足')).toBeVisible();
  await expect(page.getByText('确认目标是同组织活动成员、动作与资源匹配，且到期不超过 30 天。')).toBeVisible();
  await expect(page.getByText('请求标识：grant-blocked')).toBeVisible();
});

test('M01-05.A08 expired session requires reauthentication', async ({ page }) => {
  await page.route('**/api/v1/me/authorization', (route) => route.fulfill({ status: 401, json: { error: { code: 'session_invalid' }, request_id: 'grant-expired', trace_id: 't' } }));
  await page.goto('/?view=resource-grants');
  await expect(page.getByText('登录已过期')).toBeVisible();
  await expect(page.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', '/login');
});
