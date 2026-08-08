import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('M07-03.A01-A05 S0 manifest freezes target, eight Baota objects and signed healthy state', async () => {
  const manifest = JSON.parse(await read('infra/baota/service-manifest.json'));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.productionDeployed, true);
  assert.equal(manifest.deploymentStatus, 'healthy');
  assert.deepEqual(manifest.target, {host:'192.168.1.220',domain:'midouai.mozhiz.cn',primaryRegion:'惠州',recoveryRegion:'深圳',publicPorts:[80,443],privatePorts:[4101,3306,6379]});
  assert.equal(manifest.objects.length, 8);
  assert.equal(manifest.objects.find((item) => item.name === 'product-scout-web').buildCommand, 'npm ci && npm run build:web');
  assert.equal(manifest.objects.find((item) => item.name === 'product-scout-backup').status, 'owned-by-M07-04');
});

test('M07-03.A06-A11 site, runtime, permission, config and logging contracts fail closed', async () => {
  const manifest = JSON.parse(await read('infra/baota/service-manifest.json'));
  const nginx = await read('infra/baota/nginx/scoutops.conf.template');
  assert.match(nginx, /server_name midouai\.mozhiz\.cn/);
  assert.match(nginx, /location \/open\//);
  assert.match(nginx, /location \/api\/v1\/realtime\/events[\s\S]*proxy_buffering off/);
  for (const name of ['product-scout-api','product-scout-worker','product-scout-crawler','mysql57-product-scout','redis-product-scout']) assert.equal(manifest.objects.find((item) => item.name === name).public, false);
  assert.deepEqual(manifest.restrictedConfig.browserAllowlist, ['VITE_API_BASE_URL']);
  assert.ok(manifest.logging.forbiddenFields.includes('master_key'));
});

test('M07-03.A12-A16 preflight and same-commit production evidence pass', () => {
  const preflight = spawnSync(process.execPath, ['scripts/verify-baota-deployment.mjs', '--preflight'], {encoding:'utf8'});
  assert.equal(preflight.status, 0, preflight.stderr);
  assert.equal(JSON.parse(preflight.stdout).production_deployed, true);
  const production = spawnSync(process.execPath, ['scripts/verify-baota-deployment.mjs', '--production'], {encoding:'utf8'});
  assert.equal(production.status, 0, production.stderr);
  assert.equal(JSON.parse(production.stdout).status, 'passed');
});

test('M07-03.A17 docs, OpenAPI, Feature Map and evidence schema stay synchronized', async () => {
  const all = (await Promise.all(['docs/openapi.yaml','docs/feature-map.json','docs/architecture/m07-03-baota-deployment.md','docs/runbooks/m07-03-baota-deployment.md','verification/baota-production-evidence.schema.json'].map(read))).join('\n');
  for (const token of ['M07-03','192.168.1.220','midouai.mozhiz.cn','productionDeployed','healthy','宝塔','回滚']) assert.match(all, new RegExp(token.replaceAll('.','\\.')));
});
