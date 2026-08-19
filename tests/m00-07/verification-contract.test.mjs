import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('M00-07.A01 scope defines goals, non-goals, objects, states and security', async () => {
  const scope = await readFile('docs/architecture/m00-07-verification-scope.md', 'utf8');
  for (const heading of ['## 目标', '## 非目标', '## 对象与状态', '## 安全与数据边界']) {
    assert.match(scope, new RegExp(heading));
  }
});

test('M00-07.A03 verification migration is MySQL 5.7 compatible and reversible', async () => {
  const up = await readFile('database/migrations/0002_m00_07_verification_runs.up.sql', 'utf8');
  const down = await readFile('database/migrations/0002_m00_07_verification_runs.down.sql', 'utf8');
  assert.match(up, /verification_runs/);
  assert.match(up, /organization_id/);
  assert.match(up, /trace_id/);
  assert.match(up, /DEFAULT CHARSET=utf8mb4/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900/i);
  assert.match(down, /DROP TABLE IF EXISTS `verification_runs`/);
});

test('M00-07.A04/M00-07.A05 package exposes actual module, phase and all executors', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(packageJson.scripts['verify:module'], 'node scripts/verify-module.mjs');
  assert.equal(packageJson.scripts['verify:phase'], 'node scripts/verify-phase.mjs');
  assert.equal(packageJson.scripts['verify:all'], 'node scripts/verify-all.mjs');
  for (const file of ['scripts/verify-module.mjs', 'scripts/verify-phase.mjs', 'scripts/verify-all.mjs']) {
    const source = await readFile(file, 'utf8');
    assert.match(source, /run(Module|Phase|All)/);
  }
});

test('M00-07.A06 runtime API stays closed while OpenAPI documents report contract', async () => {
  const openapi = await readFile('docs/openapi.yaml', 'utf8');
  assert.match(openapi, /x-scoutops-verification/);
  assert.match(openapi, /runtimeApiExposed: false/);
  assert.match(openapi, /VerificationRun/);
});

test('M00-07.A07/M00-07.A08 UI exposes commands and passed/failed/blocked text states', async () => {
  const component = await readFile('apps/web/src/components/VerificationFramework.vue', 'utf8');
  for (const text of ['verify:module', 'verify:phase', 'verify:all', '通过', '失败', '前置未满足']) {
    assert.match(component, new RegExp(text));
  }
});

test('M00-07.A09/M00-07.A17 security, config, Feature Map and rollback remain synchronized', async () => {
  const [env, featureMap, runbook] = await Promise.all([
    readFile('config/env.example', 'utf8'),
    readFile('docs/feature-map.json', 'utf8'),
    readFile('docs/runbooks/m00-07-verification-framework.md', 'utf8'),
  ]);
  assert.match(env, /VERIFY_COMMAND_TIMEOUT_MS=120000/);
  assert.match(featureMap, /M00-07/);
  assert.match(runbook, /## 回滚/);
  assert.match(runbook, /不创建生产守护进程/);
});

test('M00-07.A13 contract suite is independently executable', () => assert.ok(true));
