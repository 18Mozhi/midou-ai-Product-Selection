import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const id = randomUUID();
const production = process.argv.includes('--production');
const fail = (code, message, status = 'failed') => {
  console.error(JSON.stringify({ module: 'M07-03', status, code, message, request_id: id, trace_id: id }, null, 2));
  process.exit(status === 'blocked' ? 2 : 1);
};

let manifest;
try { manifest = JSON.parse(await readFile(resolve(root, 'infra/baota/service-manifest.json'), 'utf8')); }
catch { fail('manifest_invalid', 'infra/baota/service-manifest.json is missing or invalid JSON'); }

if (manifest.schemaVersion !== 2 || manifest.stage !== 'S0') fail('manifest_contract_invalid', 'S0 schemaVersion 2 is required');
if (manifest.target?.host !== '192.168.1.220' || manifest.target?.domain !== 'midouai.mozhiz.cn') fail('target_contract_invalid', 'locked production host or domain is missing');
if (manifest.capacityClaim !== 'S0 single host; 100 users and 5-20 concurrent business users; no multi-node or 10000-user claim') fail('capacity_claim_invalid', 'S0 capacity boundary drifted');
const expected = ['product-scout-web','product-scout-api','product-scout-api-canary','product-scout-worker','product-scout-crawler','mysql57-product-scout','redis-product-scout','product-scout-release-gate','product-scout-release-rollout','product-scout-backup'];
for (const name of expected) if (!manifest.objects.some((item) => item.name === name)) fail('panel_object_missing', name);
const rolloutTask = manifest.objects.find((item) => item.name === 'product-scout-release-rollout');
if (rolloutTask?.kind !== 'baota-scheduled-task' || rolloutTask.schedule !== 'manual-only-disabled-schedule' || rolloutTask.concurrentRuns !== 1 || rolloutTask.lock !== 'mysql_session_named_lock' || rolloutTask.lockName !== 'scoutops:m07-05:release-rollout') fail('release_task_concurrency_invalid', 'release rollout must remain a manual-only single-instance Baota task');
const commands = manifest.objects.flatMap((item) => [item.startCommand, item.buildCommand, item.command]).filter(Boolean).join('\n');
if (/systemctl|\bpm2\b|crontab|docker[ -]compose/i.test(commands)) fail('external_manager_forbidden', 'panel-external production manager found');
for (const item of manifest.objects.filter((object) => !object.public && object.port)) if (item.bind !== '127.0.0.1') fail('private_bind_invalid', item.name);
if (manifest.restrictedConfig?.secretValuesInManifest !== false || manifest.restrictedConfig?.browserAllowlist?.join(',') !== 'VITE_API_BASE_URL') fail('restricted_config_invalid', 'restricted configuration boundary is missing');
if (!manifest.logging?.managedInBaota || manifest.logging.forbiddenFields.length < 6) fail('logging_contract_invalid', 'Baota logging and secret exclusions are required');
const nginx = await readFile(resolve(root, 'infra/baota/nginx/scoutops.conf.template'), 'utf8');
for (const token of ['server_name midouai.mozhiz.cn', 'location /api/', 'location /open/', 'location /api/v1/realtime/events', 'proxy_buffering off', '127.0.0.1:4101']) if (!nginx.includes(token)) fail('nginx_contract_invalid', token);
for (const file of ['apps/web/dist/index.html','apps/api/dist/server.js','apps/worker/dist/index.js','apps/crawler/scoutops_crawler/__main__.py','config/env.example','config/schema.json']) await access(resolve(root, file));
const crawler = spawnSync('python', ['-m', 'scoutops_crawler', '--once'], { cwd: resolve(root, 'apps/crawler'), encoding: 'utf8', timeout: 10000 });
if (crawler.status !== 0 || !crawler.stdout.includes('product-scout-crawler')) fail('crawler_preflight_failed', 'Python Crawler --once did not emit a heartbeat');

if (!production) {
  console.log(JSON.stringify({ module: 'M07-03', status: 'preflight_passed', production_deployed: manifest.productionDeployed === true, objects: expected.length, request_id: id, trace_id: id }, null, 2));
  process.exit(0);
}

const evidencePath = resolve(root, manifest.productionEvidence.path);
let evidence;
try { evidence = JSON.parse(await readFile(evidencePath, 'utf8')); }
catch { fail('production_evidence_missing', `Run the Baota deployment and write sanitized evidence to ${manifest.productionEvidence.path}`, 'blocked'); }
if (manifest.productionDeployed !== true || manifest.deploymentStatus !== 'healthy') fail('production_not_signed', 'manifest is not signed as a healthy production deployment', 'blocked');
if (evidence.schemaVersion !== 1 || evidence.target?.host !== manifest.target.host || evidence.target?.domain !== manifest.target.domain) fail('production_evidence_target_invalid', 'production evidence target mismatch');
const gitHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (gitHead.status !== 0 || evidence.release?.commit !== gitHead.stdout.trim()) fail('production_release_mismatch', 'production evidence must identify the current Git commit', 'blocked');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (evidence.release?.appVersion !== packageJson.version || !/^[a-f0-9]{64}$/.test(evidence.release?.configFingerprint ?? '') || typeof evidence.release?.migrationVersion !== 'string' || !evidence.release.migrationVersion.endsWith('.up.sql')) fail('production_release_identity_invalid', 'version, config fingerprint or migration identity is invalid');
if (!Array.isArray(evidence.panelObjects) || expected.some((name) => !evidence.panelObjects.includes(name))) fail('production_panel_objects_incomplete', 'Baota object inventory is incomplete');
if (evidence.dependencies?.mysqlVersion !== '5.7' || evidence.dependencies?.mysqlCharset !== 'utf8mb4' || evidence.dependencies?.redisLocalOnly !== true) fail('production_dependencies_invalid', 'MySQL 5.7/utf8mb4 or local Redis evidence missing');
if (![evidence.health?.live, evidence.health?.ready, evidence.health?.version, evidence.heartbeats?.worker, evidence.heartbeats?.crawler, evidence.logging?.panelVisible, evidence.logging?.rotationConfigured, evidence.logging?.secretScanPassed].every(Boolean)) fail('production_health_incomplete', 'health heartbeat or logging evidence is incomplete');
if (!Number.isFinite(Date.parse(evidence.capturedAt))) fail('production_evidence_time_invalid', 'capturedAt must be an ISO date-time');
console.log(JSON.stringify({ module: 'M07-03', status: 'passed', production_deployed: true, release: evidence.release, request_id: id, trace_id: id }, null, 2));
