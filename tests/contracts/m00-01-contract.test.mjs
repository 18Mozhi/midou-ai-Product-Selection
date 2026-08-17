import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildApp } from '../../apps/api/dist/app.js';

test('M00-01.A01 scope freezes goals, non-goals, inputs, outputs and failures', async () => {
  const scope = await readFile('docs/architecture/m00-01-scope.md', 'utf8');
  for (const heading of ['## 目标', '## 非目标', '## 输入、输出与失败条件', '## 数据与权限']) {
    assert.match(scope, new RegExp(heading));
  }
});

test('M00-01.A03 migration is MySQL 5.7 utf8mb4, scoped, indexed and reversible', async () => {
  const up = await readFile('database/migrations/0001_m00_01_foundation.up.sql', 'utf8');
  const down = await readFile('database/migrations/0001_m00_01_foundation.down.sql', 'utf8');
  assert.match(up, /organization_id/);
  assert.match(up, /workspace_id/);
  assert.match(up, /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/);
  assert.match(up, /idx_outbox_org_status_available/);
  assert.doesNotMatch(up, /CHECK\s*\(|GENERATED ALWAYS|utf8mb4_0900/i);
  assert.match(down, /DROP TABLE IF EXISTS `outbox_events`/);
});

test('M00-01.A06/M00-01.A11 health DTO matches OpenAPI and carries request/trace IDs', async () => {
  const openapi = await readFile('docs/openapi.yaml', 'utf8');
  assert.match(openapi, /\/health\/live:/);
  assert.match(openapi, /HealthLiveEnvelope/);
  assert.match(openapi, /trace_id/);

  const app = buildApp({ version: 'test-version', buildSha: 'test-sha' });
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/health/live',
    headers: { 'x-request-id': 'request-contract', 'x-trace-id': 'trace-contract' },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body.data, {
    status: 'ok', service: 'ai-selection-backend', version: 'test-version', build_sha: 'test-sha',
  });
  assert.equal(body.request_id, 'request-contract');
  assert.equal(body.trace_id, 'trace-contract');
  assert.match(body.meta.observed_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual({
    request_id: body.request_id,
    trace_id: body.trace_id,
  }, {
    request_id: 'request-contract',
    trace_id: 'trace-contract',
  });
  await app.close();
});

test('M00-01.A07/M00-01.A08 UI declares layout and complete runtime states', async () => {
  const app = await readFile('apps/web/src/App.vue', 'utf8');
  const shell = await readFile('apps/web/src/components/NavigationShell.vue', 'utf8');
  const styles = await readFile('apps/web/src/styles.css', 'utf8');
  for (const state of ['loading', 'ready', 'expired', 'forbidden', 'context_required', 'rate_limited', 'blocked']) {
    assert.match(shell, new RegExp(state));
  }
  assert.match(shell, /重新检查/);
  assert.match(app, /NavigationShell/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /grid-template-columns: 236px minmax\(0, 1fr\)/);
});

test('M00-01.A10 browser bundle has API-only config and no secret configuration names', async () => {
  const env = await readFile('config/env.example', 'utf8');
  const source = await readFile('apps/web/src/App.vue', 'utf8');
  for (const name of ['APP_VERSION', 'BUILD_SHA', 'WORKER_ID', 'CRAWLER_ID', 'VITE_API_BASE_URL']) {
    assert.match(env, new RegExp(`^${name}=`, 'm'));
  }
  assert.doesNotMatch(source, /DB_PASSWORD|REDIS_PASSWORD|AI_API_KEY|CREDENTIALS_MASTER_KEY/);
});

test('M00-01.A13 OpenAPI and client contract are versioned together', async () => {
  const openapi = await readFile('docs/openapi.yaml', 'utf8');
  const contract = await readFile('packages/contracts/src/index.ts', 'utf8');
  assert.match(openapi, /version: 0\.1\.0/);
  assert.match(contract, /SuccessEnvelope/);
});

test('M00-01.A17 documentation, Feature Map, configuration and rollback are linked', async () => {
  const [runbook, featureMap, env] = await Promise.all([
    readFile('docs/runbooks/m00-01-repository-foundation.md', 'utf8'),
    readFile('docs/feature-map.json', 'utf8'),
    readFile('config/env.example', 'utf8'),
  ]);
  assert.match(runbook, /## 回滚/);
  assert.match(runbook, /宝塔/);
  assert.match(featureMap, /M00-01/);
  assert.match(env, /APP_PORT=4101/);
});
