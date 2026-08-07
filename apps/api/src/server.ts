import { buildApp } from './app.js';
import { loadRuntimeConfig } from '@scoutops/config';

const config = loadRuntimeConfig(process.env, 'api');
const app = buildApp({ logger: true, version: config.app.version, buildSha: config.app.buildSha, configFingerprint: config.configFingerprint });
const { host, port } = config.app;

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error({ error }, 'API startup failed');
  process.exitCode = 1;
}
