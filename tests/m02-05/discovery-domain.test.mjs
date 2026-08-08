import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DiscoveryService } from '../../apps/api/dist/discovery-service.js';
import { buildApp } from '../../apps/api/dist/app.js';

const org = '00000000-0000-4000-8000-000000000501';
const workspace = '00000000-0000-4000-8000-000000000502';
const actor = '00000000-0000-4000-8000-000000000503';
const session = '00000000-0000-4000-8000-000000000504';
const read = (path) => readFile(path, 'utf8');

test('M02-05.A01/A02/A04/A12 trims and validates scoped search inputs', async () => {
  let captured;
  const service = new DiscoveryService({ search: async (input) => { captured = input; return { items: [], nextCursor: null }; } });
  const result = await service.search({ organizationId: org, workspaceId: workspace, query: '  机会  ', capabilities: ['task:read'], limit: 20 });
  assert.equal(captured.query, '机会');
  assert.equal(captured.organizationId, org);
  assert.equal(captured.workspaceId, workspace);
  assert.deepEqual(result.scope, { organization_id: org, workspace_id: workspace });
  await assert.rejects(() => service.search({ organizationId: org, workspaceId: workspace, query: 'x', capabilities: [] }), (error) => error.code === 'search_query_invalid' && error.statusCode === 400);
  await assert.rejects(() => service.search({ organizationId: org, workspaceId: workspace, query: '机会', capabilities: [], limit: 21 }), (error) => error.code === 'search_limit_invalid');
});

test('M02-05.A04/A08/A09/A12 quick entries expose routes only after capability filtering', () => {
  const service = new DiscoveryService({ search: async () => ({ items: [], nextCursor: null }) });
  assert.deepEqual(service.quickActions(['task:create']).map((item) => item.id), ['task']);
  assert.deepEqual(service.quickActions(['membership:manage', 'workspace:manage']).map((item) => item.id), ['member', 'workspace']);
  assert.equal(service.quickActions([]).length, 0);
  assert.ok(service.quickActions(['task:create']).every((item) => item.route.startsWith('/') && !('method' in item) && !('payload' in item)));
});

test('M02-05.A06/A09/A11/A13 API preserves authenticated scope and correlation envelope', async () => {
  const calls = [];
  const service = { search: async (input) => { calls.push(input); return { items: [], next_cursor: null, scope: { organization_id: org, workspace_id: workspace } }; }, quickActions: () => [] };
  const authorization = { resolveSession: async () => ({ context: { organization_id: org, workspace_id: workspace }, subject: { capabilities: ['task:read'], platform_capabilities: [] } }), authorize: async (input) => calls.push(input) };
  const auth = { authenticate: async () => ({ user: { id: actor }, session: { id: session } }) };
  const app = buildApp({ discovery: { service, authorization, auth, secureCookie: false } });
  const response = await app.inject({ method: 'GET', url: '/api/v1/me/global-search?q=%E6%9C%BA%E4%BC%9A', headers: { cookie: 'scoutops_session=test', 'x-request-id': 'm02-05-request', 'x-trace-id': 'm02-05-trace' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().request_id, 'm02-05-request');
  assert.equal(calls[0].capability, 'task:read');
  assert.equal(calls[1].organizationId, org);
  assert.equal(calls[1].workspaceId, workspace);
  const invalid = await app.inject({ method: 'GET', url: '/api/v1/me/global-search?q=x', headers: { cookie: 'scoutops_session=test' } });
  assert.equal(invalid.statusCode, 400);
  await app.close();
});

test('M02-05.A03/A05/A06/A07/A10/A13/A15/A16/A17 delivery contracts are explicit', async () => {
  const [up, down, repo, overlay, shell, openapi, env, architecture, runbook, feature, e2e] = await Promise.all(['database/migrations/0015a_search_documents_m02_05.up.sql', 'database/migrations/0015a_search_documents_m02_05.down.sql', 'apps/api/src/mysql-discovery-repository.ts', 'apps/web/src/components/DiscoveryOverlay.vue', 'apps/web/src/components/NavigationShell.vue', 'docs/openapi.yaml', 'config/env.example', 'docs/architecture/m02-05-discovery.md', 'docs/runbooks/m02-05-discovery.md', 'docs/feature-map.json', 'tests/e2e/m02-05-discovery.spec.ts'].map(read));
  assert.match(up, /organization_id.*workspace_id/);
  assert.match(up, /CHAR\(36\) CHARACTER SET ascii/);
  assert.match(up, /utf8mb4/);
  assert.match(down, /DROP TABLE/);
  assert.match(repo, /organization_id=\?/);
  assert.match(repo, /required_capability IN/);
  assert.match(openapi, /\/me\/global-search:/);
  assert.match(openapi, /\/me\/quick-actions:/);
  assert.match(overlay, /credentials\s*:\s*["']include["']/);
  for (const state of ['loading', 'empty', 'expired', 'forbidden', 'blocked']) assert.match(overlay, new RegExp(state));
  assert.match(shell, /event\.metaKey\s*\|\|\s*event\.ctrlKey/);
  assert.match(shell, /role-mobile-nav/);
  assert.match(e2e, /toHaveScreenshot/);
  assert.match(e2e, /Control\+K/);
  assert.doesNotMatch(env, /SEARCH_INDEX_|QUICK_CREATE_/);
  assert.match(architecture, /同步|synchronous/i);
  assert.match(runbook, /宝塔.*Node API/s);
  assert.match(feature, /globalDiscovery/);
  const migrations = await readdir('database/migrations');
  assert.ok(migrations.includes('0015a_search_documents_m02_05.up.sql'));
});
