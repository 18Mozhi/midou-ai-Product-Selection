import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('M01-01.A01/A03 identity migration is MySQL57, indexed, scoped and reversible', async () => {
  const suffixes = ['a_users', 'b_sessions', 'c_action_tokens', 'd_security_events', 'e_delivery_outbox', 'f_idempotency'];
  const up = (await Promise.all(suffixes.map((suffix) => readFile(`database/migrations/0008${suffix}_m01_01.up.sql`, 'utf8')))).join('\n');
  const down = (await Promise.all(suffixes.map((suffix) => readFile(`database/migrations/0008${suffix}_m01_01.down.sql`, 'utf8')))).join('\n');
  for (const table of ['users', 'user_sessions', 'auth_action_tokens', 'auth_security_events', 'auth_delivery_outbox', 'auth_idempotency_records']) assert.match(up, new RegExp('CREATE TABLE `' + table + '`'));
  assert.match(up, /email_normalized/);
  assert.match(up, /token_hash/);
  assert.match(up, /utf8mb4/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|GENERATED\s+ALWAYS/i);
  assert.match(down, /DROP TABLE `users`/);
});

test('M01-01.A06/A09/A13 OpenAPI freezes local email account and own-session contracts', async () => {
  const [api, contracts] = await Promise.all([readFile('docs/openapi.yaml', 'utf8'), readFile('packages/contracts/src/index.ts', 'utf8')]);
  for (const route of ['/auth/register:', '/auth/email-verification/confirm:', '/auth/login:', '/auth/logout:', '/auth/password-reset/request:', '/auth/password-reset/confirm:', '/me/password:', '/me/sessions:']) assert.match(api, new RegExp(route.replaceAll('/', '\\/')));
  for (const schema of ['LocalAccountRegistration', 'LocalLoginRequest', 'SessionSummary', 'PasswordResetConfirm']) assert.match(api, new RegExp(schema));
  assert.match(api, /HttpOnlySession/);
  assert.doesNotMatch(api, /\/auth\/(google|microsoft|saml|scim)/i);
  for (const dto of ['LocalAccountSummary', 'LocalAccountRegistration', 'LocalLoginRequest', 'LocalSessionSummary', 'PasswordResetConfirm']) assert.match(contracts, new RegExp(`interface ${dto}`));
});

test('M01-01.A07/A08/A10/A11/A17 UI, config, docs, map and evidence are synchronized', async () => {
  const [ui, env, schema, map, architecture, runbook, registry] = await Promise.all([
    'apps/web/src/components/LocalIdentity.vue', 'config/env.example', 'config/schema.json', 'docs/feature-map.json',
    'docs/architecture/m01-01-local-identity.md', 'docs/runbooks/m01-01-local-identity.md', 'verification/modules/M01-01.json',
  ].map((path) => readFile(path, 'utf8')));
  for (const state of ['login', 'register', 'forgot', 'verify', 'reset', 'sessions', 'loading', 'error', 'expired']) assert.match(ui, new RegExp(state));
  for (const key of ['AUTH_PASSWORD_MIN_LENGTH', 'AUTH_SESSION_TTL_MINUTES', 'AUTH_MAX_FAILED_ATTEMPTS', 'AUTH_OUTBOX_POLL_MS']) assert.match(env, new RegExp(key));
  assert.match(schema, /AUTH_ARGON2_MEMORY_KIB/);
  assert.match(map, /localIdentity/);
  for (const image of ['02_scoutops霓虹科技登录页.png', '03_scoutops_深海蓝注册向导.png', '21_安全设置.jpg']) assert.match(architecture, new RegExp(image));
  assert.match(runbook, /## 回滚/);
  const parsed = JSON.parse(registry);
  assert.equal(parsed.atomicTasks.length, 17);
  assert.deepEqual(parsed.atomicTasks.map((item) => item.id), Array.from({ length: 17 }, (_, index) => `M01-01.A${String(index + 1).padStart(2, '0')}`));
});

test('M01-01 login waits for a real MFA code and explains the 30-day session', async () => {
  const ui = await readFile('apps/web/src/components/LocalIdentity.vue', 'utf8');
  assert.match(ui, /mfa_required[\s\S]*?mode\.value='mfa-challenge'[\s\S]*?return;/);
  assert.match(ui, /security_setup\?\.required[\s\S]*?mode\.value='security-setup'[\s\S]*?return;/);
  assert.match(ui, /登录状态最长保留 30 天/);
  assert.doesNotMatch(ui, /会话关闭浏览器后失效/);
});
