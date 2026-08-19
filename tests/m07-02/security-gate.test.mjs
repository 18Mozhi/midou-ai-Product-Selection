import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const policy = JSON.parse(await readFile(resolve(root, 'verification/security-gate.json'), 'utf8'));

test('M07-02.A01-A05 scope is finite and runtime persistence surfaces are explicitly not applicable', () => {
  assert.equal(policy.moduleId, 'M07-02');
  assert.match(policy.scope, /no production runtime API, table, page, permission or daemon/);
  assert.deepEqual(Object.keys(policy.notApplicable).sort(), ['asyncRuntime', 'databaseMigration', 'frontendPage', 'runtimeApi'].sort());
});

test('M07-02.A06-A13 gate covers every required release security family and fails high or critical dependency findings', () => {
  assert.equal(policy.dependencyAudit.maximumHigh, 0);
  assert.equal(policy.dependencyAudit.maximumCritical, 0);
  for (const id of ['dependency-vulnerabilities','tracked-secret-files','hardcoded-secret-signatures','browser-dangerous-sinks','browser-sensitive-storage','external-link-opener','parameterized-sql-contract','csrf-origin-contract','ssrf-webhook-contract','upload-surface-contract','authorization-live','sanitized-log-live','baota-edge-headers']) assert.ok(policy.checks.includes(id), id);
});

test('M07-02.A14-A17 contracts include Baota edge hardening, operational rollback and no HSTS claim before TLS evidence', async () => {
  const nginx = await readFile(resolve(root, 'infra/baota/nginx/scoutops.conf.template'), 'utf8');
  const runbook = await readFile(resolve(root, 'docs/runbooks/m07-02-security-gate.md'), 'utf8');
  const openapi = await readFile(resolve(root, 'docs/openapi.yaml'), 'utf8');
  assert.match(nginx, /Content-Security-Policy/);
  assert.match(nginx, /X-Content-Type-Options/);
  assert.doesNotMatch(nginx, /Strict-Transport-Security/);
  assert.match(runbook, /回滚/);
  assert.match(runbook, /宝塔/);
  assert.match(openapi, /securityGate: npm run verify:security-gate/);
});

test('M07-02 browser storage gate allows only the validated non-sensitive theme preference', async () => {
  const gate = await readFile(resolve(root, 'scripts/verify-security-gate.mjs'), 'utf8');
  const theme = await readFile(resolve(root, 'apps/web/src/design/theme.ts'), 'utf8');
  assert.match(gate, /file === 'apps\/web\/src\/design\/theme\.ts'/);
  assert.match(gate, /localStorageCount === 2/);
  assert.match(gate, /argumentsText === 'themeStorageKey'/);
  assert.match(gate, /argumentsText === 'themeStorageKey,theme'/);
  assert.doesNotMatch(theme, /token|secret|session|credential/i);
});
