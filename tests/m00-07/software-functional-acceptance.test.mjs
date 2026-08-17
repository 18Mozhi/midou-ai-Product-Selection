import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('M00-07 exposes a software-only P00-P08 functional acceptance entrypoint', async () => {
  const [packageJson, verifier, featureMap, plan, blueprint, runbook] = await Promise.all([
    readFile('package.json', 'utf8').then(JSON.parse),
    readFile('scripts/verify-functional.mjs', 'utf8'),
    readFile('docs/feature-map.json', 'utf8'),
    readFile('plans/README.md', 'utf8'),
    readFile('new-product-enterprise-blueprint.md', 'utf8'),
    readFile('docs/runbooks/m00-07-verification-framework.md', 'utf8'),
  ]);

  assert.equal(packageJson.scripts['verify:functional'], 'node scripts/verify-functional.mjs');
  for (const required of ['npm run build', 'node-tests', 'python-tests', 'playwright-e2e', 'verify:docs', 'verify:plans', 'verify:release-matrix', 'verify:security-gate']) {
    assert.match(verifier, new RegExp(required.replaceAll(':', '\\:')));
  }
  assert.match(verifier, /--experimental-strip-types/);
  assert.match(verifier, /tests\/m07-03\/baota-deployment\.test\.mjs/);
  assert.doesNotMatch(verifier, /verify-capacity-boundary-live|--production/);
  assert.match(featureMap, /"functionalCommand": "npm run verify:functional"/);
  assert.match(plan, /verify:functional/);
  assert.match(blueprint, /verify:functional/);
  assert.match(runbook, /verify:functional/);
});
