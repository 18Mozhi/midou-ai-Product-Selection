import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

// Regression: ISSUE-001 — the production root rendered the M00 foundation harness
// Found by repository and live-browser QA on 2026-08-17.
test('production root resolves the authenticated role landing instead of the foundation harness', async () => {
  const [html, app, shell] = await Promise.all([
    read('apps/web/index.html'),
    read('apps/web/src/App.vue'),
    read('apps/web/src/components/NavigationShell.vue'),
  ]);

  assert.match(html, /<title>ai选品<\/title>/);
  assert.doesNotMatch(html, /ScoutOps|FOUNDATION|M00-01/);
  assert.match(app, /<LandingRedirect\s+v-if="routePath === '\/'"/);
  assert.doesNotMatch(app, /FOUNDATION\s*\/\s*M00-01/);
  assert.doesNotMatch(app, />自动验收</);
  assert.match(shell, /routePath\s*===\s*['"]\/['"]\s*\|\|\s*routePath\s*===\s*['"]\/home['"]/);
  assert.doesNotMatch(shell, /\{\{\s*phaseLabel\s*\}\}/);
});

// Regression: ISSUE-002 — one product was deployed as API, Worker, canary and Python projects
// Found by BaoTa topology inspection on 2026-08-17.
test('BaoTa exposes exactly one foreground backend named ai选品', async () => {
  const manifest = JSON.parse(await read('infra/baota/service-manifest.json'));
  const nodeProjects = manifest.objects.filter((item) => item.kind === 'baota-node-project');
  const pythonProjects = manifest.objects.filter((item) => item.kind === 'baota-python-project');

  assert.equal(manifest.target.deployRoot, '/www/wwwroot/ai选品');
  assert.equal(nodeProjects.length, 1);
  assert.equal(nodeProjects[0].name, 'ai选品');
  assert.equal(nodeProjects[0].startCommand, 'node apps/backend/dist/server.js');
  assert.equal(nodeProjects[0].processMode, 'foreground');
  assert.equal(pythonProjects.length, 0);
  assert.doesNotMatch(JSON.stringify(manifest.objects), /product-scout-api-canary|product-scout-worker|product-scout-crawler/);
});

// Regression: ISSUE-003 — functional verification skipped the deployment contract
// Found by verification-runner inspection on 2026-08-17.
test('full functional verification includes the production deployment contract', async () => {
  const verifier = await read('scripts/verify-functional.mjs');
  assert.doesNotMatch(verifier, /excludedNodeTests/);
  assert.doesNotMatch(verifier, /tests\/m07-03\/baota-deployment\.test\.mjs/);
});

// Regression: ISSUE-004 — BaoTa managed short-lived shell wrappers instead of one app lifecycle
// Found by live process and startup-script inspection on 2026-08-17.
test('unified backend build and lifecycle contracts are registered', async () => {
  const [packageJson, backendPackage, supervisor, server] = await Promise.all([
    read('package.json').then(JSON.parse),
    read('apps/backend/package.json').then(JSON.parse),
    read('apps/backend/src/supervisor.ts'),
    read('apps/backend/src/server.ts'),
  ]);

  assert.equal(packageJson.scripts['build:backend'], 'tsc -p apps/backend/tsconfig.json');
  assert.match(packageJson.scripts.build, /build:backend/);
  assert.equal(backendPackage.name, '@scoutops/backend');
  assert.match(supervisor, /restart/i);
  assert.match(`${supervisor}\n${server}`, /SIGTERM/);
  assert.match(`${supervisor}\n${server}`, /SIGINT/);
});

// Regression: ISSUE-005 — visible navigation linked to phase placeholders rather than features
// Found by route-to-component audit on 2026-08-17.
test('every visible production navigation entry resolves to a real feature surface', async () => {
  const [shell, identity, app] = await Promise.all([
    read('apps/web/src/components/NavigationShell.vue'),
    read('apps/web/src/components/LocalIdentity.vue'),
    read('apps/web/src/App.vue'),
  ]);

  for (const placeholder of [
    'VERIFIED NAVIGATION',
    '当前只交付导航',
    '壳层已就绪',
    'FOUNDATION / M00-01',
  ]) {
    assert.doesNotMatch(shell, new RegExp(placeholder));
  }

  for (const speculativeRoute of [
    '/platform-admin/organizations',
    '/platform-admin/admins',
    '/platform-admin/governance',
    '/platform-admin/notifications',
  ]) {
    assert.doesNotMatch(shell, new RegExp(speculativeRoute.replaceAll('/', '\\/')));
  }

  assert.match(app, /['"]\/me['"]\s*:\s*['"]local-identity['"]/);
  assert.doesNotMatch(shell, /isAccountCenter|import LocalIdentity/);
  assert.match(identity, /['"]\/me['"]\s*:\s*['"]sessions['"]/);
  assert.match(identity, /pathModes\[window\.location\.pathname\]/);
});

// Regression: ISSUE-006 — production authentication depended on internal ?view= harnesses
// Found by public-route audit on 2026-08-17.
test('production identity and onboarding use real routes while harness views stay development-only', async () => {
  const [app, shell, identity] = await Promise.all([
    read('apps/web/src/App.vue'),
    read('apps/web/src/components/NavigationShell.vue'),
    read('apps/web/src/components/LocalIdentity.vue'),
  ]);

  assert.match(app, /import\.meta\.env\.DEV/);
  assert.match(app, /['"]\/login['"]\s*:\s*['"]local-identity['"]/);
  assert.match(app, /['"]\/select-context['"]\s*:\s*['"]tenancy['"]/);
  assert.match(identity, /['"]\/register['"]\s*:\s*['"]register['"]/);
  assert.doesNotMatch(`${shell}\n${identity}`, /\?view=local-identity|\?view=tenancy/);
});
