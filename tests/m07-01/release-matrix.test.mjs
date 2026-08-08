import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const matrix = JSON.parse(await readFile(resolve(root, 'verification/release-matrix.json'), 'utf8'));

test('M07-01.A01/A02/A11/A12 release matrix has frozen scope, dimensions and observable ids', () => {
  assert.equal(matrix.moduleId, 'M07-01');
  assert.equal(matrix.browserWorkers, 4);
  assert.match(matrix.scope, /no production runtime API, table, page, permission or daemon/);
  assert.deepEqual(Object.keys(matrix.dimensions).sort(), ['dataQuality', 'mobileVisual', 'performance', 'roleScope', 'securityFailClosed', 'sourceCollection', 'taskQueue'].sort());
  assert.equal(new Set(matrix.liveScenarios.map(({ id }) => id)).size, matrix.liveScenarios.length);
});

test('M07-01.A03/A04/A05/A14/A16 matrix invokes existing reversible MySQL Redis Worker and failure drills', async () => {
  for (const scenario of matrix.liveScenarios) {
    assert.equal(scenario.program, 'node');
    assert.equal(scenario.args.length, 1);
    await access(resolve(root, scenario.args[0]));
  }
  const migrations = await readdir(resolve(root, 'database/migrations'));
  const ups = migrations.filter((name) => name.endsWith('.up.sql'));
  assert.ok(ups.length >= 24);
  for (const up of ups) assert.ok(migrations.includes(up.replace('.up.sql', '.down.sql')), `${up} lacks rollback`);
});

test('M07-01.A06/A09/A10/A13 contracts guards and existing configuration stay synchronized', async () => {
  const openapi = await readFile(resolve(root, 'docs/openapi.yaml'), 'utf8');
  const env = await readFile(resolve(root, 'config/env.example'), 'utf8');
  const docs = await readFile(resolve(root, 'docs/architecture/m07-01-release-matrix.md'), 'utf8');
  assert.match(openapi, /releaseMatrix: node scripts\/verify-release-matrix\.mjs --validate/);
  assert.match(openapi, /releaseMatrixRuntimeApiExposed: false/);
  assert.match(env, /VERIFY_COMMAND_TIMEOUT_MS=120000/);
  assert.match(env, /VERIFY_REPORT_DIR=\.artifacts\/verification/);
  assert.match(docs, /不新增生产 API、数据库表、页面、权限或常驻进程/);
});

test('M07-01.A07/A08/A15 every prior browser contract is assigned exactly once', async () => {
  const assigned = Object.values(matrix.browserGroups).flat();
  const actual = (await readdir(resolve(root, 'tests/e2e'))).filter((name) => name.endsWith('.spec.ts') && name !== 'm07-01-performance.spec.ts');
  assert.equal(assigned.length, 46);
  assert.equal(new Set(assigned).size, assigned.length);
  assert.deepEqual([...assigned].sort(), actual.sort());
  assert.ok(assigned.some((name) => name.includes('ui-states')));
  assert.ok(assigned.some((name) => name.includes('home-mobile')));
});

test('M07-01.A17 blueprint performance budgets are immutable matrix values', () => {
  assert.deepEqual(matrix.performanceTargets, {
    newMemberJourneyMs: 180000,
    taskCreateP95Ms: 3000,
    queuedVisibilityMs: 15000,
    firstOutcomeP95Ms: 180000,
    lcpMs: 2500,
    inpMs: 200,
    cls: 0.1,
    coreReadP95Ms: 300,
    coreWriteP95Ms: 600
  });
});
