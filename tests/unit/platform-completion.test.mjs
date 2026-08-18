import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { BUILTIN_PROVIDER_SOURCES, parseStructuredCatalogPage } from '../../packages/provider-sources/dist/index.js';
import { ProviderSourceService } from '../../apps/api/dist/provider-source-service.js';

test('automatic source catalog is diversified across real source families and markets', () => {
  const automatic = BUILTIN_PROVIDER_SOURCES.filter((item) => item.availability === 'automatic');
  const googleNews = automatic.filter((item) => item.parser_version === 'google-news-fixed-rss-v1');
  const hosts = new Set(automatic.map((item) => new URL(item.target_url).hostname));
  const categories = new Set(automatic.map((item) => item.category));
  const markets = new Set(automatic.flatMap((item) => item.markets));

  assert.ok(automatic.length >= 100, 'at least 100 automatic channels must remain available');
  assert.ok(hosts.size >= 8, 'automatic channels must span at least eight real source hosts');
  assert.ok(googleNews.length / automatic.length < 0.75, 'Google News must not dominate the automatic catalog');
  assert.deepEqual([...categories].sort(), ['community', 'data', 'ecommerce', 'news']);
  assert.ok(markets.size >= 10, 'major-country market coverage must be explicit');
});

test('fixed marketplace page parser extracts structured product evidence without an API key', () => {
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', position: 1, item: { '@type': 'Product', name: 'Portable Desk Lamp', url: '/dp/B0ABCDEFGHI', offers: { price: '29.90', priceCurrency: 'USD' } } }] })}</script></head></html>`;
  const records = parseStructuredCatalogPage(html, 'https://www.amazon.com/Best-Sellers/zgbs', 'Amazon US Best Sellers', 20);
  assert.equal(records.length, 1);
  assert.equal(records[0].payload.fields.title, 'Portable Desk Lamp');
  assert.equal(records[0].payload.fields.price, 29.9);
  assert.equal(records[0].payload.fields.currency, 'USD');
  assert.match(records[0].evidenceRef, /^structured-public-page:/);
});

test('provider source configuration is editable through a validated audited service operation', async () => {
  let updateInput;
  const repository = {
    listProvisioned: async () => [],
    syncCatalog: async () => ({ inserted: 0, updated: 0, automatic_enabled: 0, status: 'synced' }),
    provision: async () => { throw new Error('not used'); },
    replay: async () => { throw new Error('not used'); },
    refresh: async () => { throw new Error('not used'); },
    updateConfiguration: async (input) => {
      updateInput = input;
      return { id: input.providerId, code: 'gnews_us_consumer_trends', status: input.status, version: 2, updated_at: input.now.toISOString() };
    },
  };
  const service = new ProviderSourceService(repository, () => new Date('2026-08-18T00:00:00.000Z'));
  const result = await service.updateConfiguration(
    '00000000-0000-4000-8000-000000000111',
    { schedule_minutes: 30, timeout_ms: 15000, retry_limit: 2, status: 'enabled', expected_version: 1, reason: '调整采集频率' },
    { actorId: '00000000-0000-4000-8000-000000000112', idempotencyKey: 'source-edit-1', requestId: 'request-source-edit', traceId: 'trace-source-edit' },
  );

  assert.equal(result.version, 2);
  assert.equal(updateInput.scheduleMinutes, 30);
  assert.equal(updateInput.reason, '调整采集频率');
});

test('platform navigation exposes complete management domains and role switching', async () => {
  const shell = await readFile(new URL('../../apps/web/src/components/NavigationShell.vue', import.meta.url), 'utf8');
  for (const label of ['账号与组织', '人员与权限', '全量数据', '规则与自动化', '内容管理', '通知管理', '套餐与续期', '邮箱管理', '系统状态', '进入用户工作台']) {
    assert.match(shell, new RegExp(label));
  }
});

test('platform management and dashboard expose operational details instead of placeholder cards', async () => {
  const management = await readFile(new URL('../../apps/web/src/components/PlatformManagementCenter.vue', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../../apps/web/src/components/PlatformDashboard.vue', import.meta.url), 'utf8');
  const theme = await readFile(new URL('../../apps/web/src/theme-compat.css', import.meta.url), 'utf8');
  for (const label of ['审核热点内容', '投递', '接收邮箱', '采集任务状态']) assert.match(management, new RegExp(label));
  assert.match(dashboard, /采集任务成功和失败趋势折线图/);
  assert.match(theme, /\[aria-label\]::after/);
});

test('collection task detail renders attempts events and dead-letter facts', async () => {
  const component = await readFile(new URL('../../apps/web/src/components/CollectionTaskCenter.vue', import.meta.url), 'utf8');
  for (const label of ['执行尝试', '状态事件', '死信记录']) {
    assert.match(component, new RegExp(label));
  }
});
