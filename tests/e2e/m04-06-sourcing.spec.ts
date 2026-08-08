import { test, expect, type Page } from '@playwright/test';

const searchId = '00000000-0000-4000-8000-000000000601';
const envelope = (data: unknown) => ({
  data,
  request_id: 'm04-06-e2e-request',
  trace_id: 'm04-06-e2e-trace',
});

const readyCandidate = {
  id: '00000000-0000-4000-8000-000000000602',
  supplier_name: '宁波澄净户外用品厂',
  product_title: '500ml 便携滤芯净水杯',
  specification: '500ml / 蓝色 / 单只彩盒',
  moq: 100,
  quoted_price: 12.8,
  currency: 'CNY',
  lead_time_days: 7,
  location: '浙江宁波',
  original_url: 'https://example.test/supply/ready',
  observed_at: '2026-08-08T12:00:00.000Z',
  evidence_id: '00000000-0000-4000-8000-000000000603',
  confidence_value: 88,
  status: 'ready',
  missing_fields: [],
  quote: {
    id: '00000000-0000-4000-8000-000000000604',
    version: 2,
    stability_status: 'stable',
    risk_level: 'low',
  },
};

const incompleteCandidate = {
  id: '00000000-0000-4000-8000-000000000605',
  supplier_name: '广州清流供应链',
  product_title: '户外过滤水杯基础款',
  specification: null,
  moq: 200,
  quoted_price: 10.6,
  currency: 'CNY',
  lead_time_days: null,
  location: null,
  original_url: 'https://example.test/supply/incomplete',
  observed_at: '2026-08-08T12:05:00.000Z',
  evidence_id: '00000000-0000-4000-8000-000000000606',
  confidence_value: null,
  status: 'incomplete',
  missing_fields: ['specification', 'lead_time_days', 'location', 'confidence_value', 'stability_status', 'risk_level'],
  quote: null,
};

async function setup(page: Page) {
  await page.route('**/api/v1/me/navigation?shell=member', route => route.fulfill({
    json: envelope({
      shell: 'member',
      organization_id: '00000000-0000-4000-8000-000000000607',
      workspace_id: '00000000-0000-4000-8000-000000000608',
      roles: ['selection_manager'],
      capabilities: ['task:read', 'sourcing:read', 'supplier_quote:manage'],
      platform_roles: [],
      platform_capabilities: [],
      guard_reason: 'navigation_member_allowed',
    }),
  }));
  const summary = {
    id: searchId,
    input_type: 'keyword',
    input_ref: '便携净水杯',
    status: 'completed_with_warnings',
    candidate_count: 2,
    missing_fields: ['specification', 'lead_time_days', 'location', 'confidence_value', 'stability_status', 'risk_level'],
    created_at: '2026-08-08T12:00:00.000Z',
  };
  await page.route(`**/api/v1/sourcing/searches/${searchId}`, route => route.fulfill({
    json: envelope({ ...summary, candidates: [readyCandidate, incompleteCandidate] }),
  }));
  await page.route('**/api/v1/sourcing/searches', route => route.fulfill({ json: envelope([summary]) }));
}

test('M04-06.A07/A08/A09/A15 renders source-backed suppliers, missing fields and responsive actions', async ({ page }) => {
  await setup(page);
  await page.goto('/sourcing');
  await expect(page.getByRole('heading', { name: '供应链找货', level: 2 })).toBeVisible();
  await expect(page.getByText('宁波澄净户外用品厂')).toBeVisible();
  await expect(page.getByText('当前候选仍缺：规格、交期、所在地、可信度、稳定性、风险。')).toBeVisible();
  await expect(page.getByText(/evidence 00000000-0000-4000-8000-000000000603/)).toBeVisible();
  await page.getByRole('button', { name: '确认报价' }).click();
  await expect(page.getByRole('heading', { name: '确认完整供应商报价' })).toBeVisible();
  await page.getByRole('button', { name: '×' }).click();
  await expect(page).toHaveScreenshot('m04-06-sourcing.png', { fullPage: true });
});
