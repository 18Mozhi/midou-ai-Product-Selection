import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('M08-06 software completion excludes server capacity and production evidence gates', async () => {
  const [registry, phasePlan, planIndex, featureMap, envExample] = await Promise.all([
    readFile('verification/modules/M08-06.json', 'utf8').then(JSON.parse),
    readFile('plans/phase-08-scale-ha.md', 'utf8'),
    readFile('plans/README.md', 'utf8'),
    readFile('docs/feature-map.json', 'utf8'),
    readFile('config/env.example', 'utf8'),
  ]);

  assert.deepEqual(registry.commands, [
    'npm run build',
    'node --test tests/m08-06/capacity-boundary-closure.test.mjs tests/m08-06/software-completion-contract.test.mjs',
    'node scripts/capture-capacity-boundary-production.mjs --self-test',
    'node scripts/verify-capacity-boundary-production.mjs --preflight',
    'npx playwright test tests/e2e/m08-06-capacity-boundary.spec.ts',
    'npm run verify:docs',
  ]);
  assert.doesNotMatch(registry.commands.join('\n'), /--production|verify-[^\s]*-live\.mjs/);
  assert.match(phasePlan, /software_complete_capacity_out_of_scope/);
  assert.doesNotMatch(phasePlan, /implementation_ready_production_pending/);
  assert.match(planIndex, /软件完成门不依赖磁盘、容量压测或生产资源证据/);
  assert.match(featureMap, /M08-06_software_complete_capacity_out_of_scope/);
  assert.match(envExample, /不作为软件完成门/);
});
