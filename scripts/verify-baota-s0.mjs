import { randomUUID } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';

const id = randomUUID();

try {
  const manifest = JSON.parse(await readFile('infra/baota/service-manifest.json', 'utf8'));
  if (
    manifest.schemaVersion !== 3
    || manifest.stage !== 'production'
    || typeof manifest.productionDeployed !== 'boolean'
    || (manifest.productionDeployed && manifest.deploymentStatus !== 'healthy')
  ) {
    throw new Error('manifest lifecycle state is invalid');
  }

  const expected = ['ai选品网站', 'ai选品', 'ai选品数据库', 'ai选品缓存', 'ai选品备份'];
  if (manifest.objects.length !== expected.length) {
    throw new Error(`expected ${expected.length} BaoTa objects, received ${manifest.objects.length}`);
  }
  for (const name of expected) {
    if (!manifest.objects.some((item) => item.name === name)) {
      throw new Error(`missing BaoTa object ${name}`);
    }
  }

  const nodeProjects = manifest.objects.filter((item) => item.kind === 'baota-node-project');
  if (nodeProjects.length !== 1) throw new Error('exactly one BaoTa Node backend is required');
  const backend = nodeProjects[0];
  if (
    backend.name !== 'ai选品'
    || backend.processMode !== 'foreground'
    || backend.startCommand !== 'node apps/backend/dist/server.js'
    || backend.launcher !== 'infra/baota/start-backend.sh'
  ) {
    throw new Error('unified backend contract is invalid');
  }
  if (manifest.objects.some((item) => item.kind === 'baota-python-project')) {
    throw new Error('separate BaoTa Python backend is forbidden');
  }

  const commands = manifest.objects
    .flatMap((item) => [item.startCommand, item.buildCommand, item.command])
    .filter(Boolean)
    .join('\n');
  if (/systemctl|\bpm2\b|crontab|docker[ -]compose|nohup|\s&\s*$/im.test(commands)) {
    throw new Error('panel-external or detached production command found');
  }

  for (const file of [
    'apps/web/dist/index.html',
    'apps/backend/dist/server.js',
    'apps/api/dist/server.js',
    'apps/worker/dist/index.js',
    'infra/baota/start-backend.sh',
    'infra/baota/nginx/scoutops.conf.template',
  ]) {
    await access(file);
  }

  console.log(JSON.stringify({
    status: 'passed',
    stage: manifest.stage,
    production_deployed: manifest.productionDeployed,
    objects: expected.length,
    backend: backend.name,
    process_mode: backend.processMode,
    request_id: id,
    trace_id: id,
  }));
} catch (error) {
  console.error(JSON.stringify({
    status: 'blocked',
    code: 'baota_s0_preflight_failed',
    message: error instanceof Error ? error.message : 'unknown',
    request_id: id,
    trace_id: id,
  }));
  process.exitCode = 2;
}
