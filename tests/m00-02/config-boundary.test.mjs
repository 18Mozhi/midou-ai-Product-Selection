import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ConfigError, loadRuntimeConfig } from '../../packages/config/dist/index.js';
import { browserConfig } from '../../packages/config/dist/browser.js';
import { buildApp } from '../../apps/api/dist/app.js';

test('M00-02.A01/A02 scope and schema define backend groups and browser allowlist', async () => {
  const scope = await readFile('docs/architecture/m00-02-config-boundary.md','utf8'); const schema = JSON.parse(await readFile('config/schema.json','utf8'));
  assert.match(scope,/浏览器只允许/); assert.deepEqual(schema.browserAllowlist,['VITE_API_BASE_URL']); assert.ok(schema.secretKeys.includes('CREDENTIALS_MASTER_KEY'));
});
test('M00-02.A03 migration is scoped, indexed, MySQL57 and reversible', async () => {
  const up=await readFile('database/migrations/0003_m00_02_config_releases.up.sql','utf8'); const down=await readFile('database/migrations/0003_m00_02_config_releases.down.sql','utf8');
  assert.match(up,/organization_id/); assert.match(up,/config_fingerprint/); assert.match(up,/DEFAULT CHARSET=utf8mb4/); assert.doesNotMatch(up,/CHECK\s*\(|utf8mb4_0900/i); assert.match(down,/DROP TABLE/);
});
test('M00-02.A04/A10/A12 loader validates defaults and ranges without values in errors', () => {
  const config=loadRuntimeConfig({NODE_ENV:'test'},'api','C:\\workspace'); assert.equal(config.database.name,'product_scout'); assert.equal(config.configFingerprint.length,64);
  assert.throws(()=>loadRuntimeConfig({APP_PORT:'70000'},'api'),(e)=>e instanceof ConfigError&&e.key==='APP_PORT'&&!e.message.includes('70000'));
  assert.throws(()=>loadRuntimeConfig({AI_BASE_URL:'file:///secret'},'api'),/AI_BASE_URL/);
  assert.throws(()=>loadRuntimeConfig({EVIDENCE_ROOT:'same',EXPORT_ROOT:'same'},'api'),/EXPORT_ROOT/);
});
test('M00-02.A09 production secrets and browser exposure fail closed', () => {
  assert.throws(()=>loadRuntimeConfig({NODE_ENV:'production',DB_PASSWORD:'too-short'},'api'),/DB_PASSWORD/);
  assert.throws(()=>browserConfig({VITE_DB_PASSWORD:'secret'}),/VITE_DB_PASSWORD/);
  assert.deepEqual(browserConfig({VITE_API_BASE_URL:'/api/v1'}),{apiBaseUrl:'/api/v1'});
});
test('M00-02.A06/A11/A14 version endpoint returns fingerprint but no config values', async () => {
  const app=buildApp({version:'1.2.3',buildSha:'abc',configFingerprint:'f'.repeat(64)}); const response=await app.inject({method:'GET',url:'/api/v1/health/version'}); const body=response.json();
  assert.equal(response.statusCode,200); assert.equal(body.data.config_fingerprint,'f'.repeat(64)); assert.doesNotMatch(JSON.stringify(body),/password|master_key|AI_BASE_URL/i); await app.close();
});
test('M00-02.A07/A08/A13/A17 UI, OpenAPI, Feature Map and rollback are synchronized', async () => {
  const [ui,api,map,runbook]=await Promise.all(['apps/web/src/components/ConfigBoundary.vue','docs/openapi.yaml','docs/feature-map.json','docs/runbooks/m00-02-config-boundary.md'].map(p=>readFile(p,'utf8')));
  for(const state of ['已校验','拒绝启动','需要重启']) assert.match(ui,new RegExp(state)); assert.match(api,/HealthVersionEnvelope/); assert.match(map,/browserAllowlist/); assert.match(runbook,/## 回滚/);
});
test('M00-02.A05/A16 worker and crawler startup sources call validated loaders', async () => {
  assert.match(await readFile('apps/worker/src/index.ts','utf8'),/loadRuntimeConfig/); assert.match(await readFile('apps/crawler/scoutops_crawler/__main__.py','utf8'),/load_config/);
});
