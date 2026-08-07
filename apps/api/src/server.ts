import { buildApp } from './app.js';

const app = buildApp({ logger: true });
const host = process.env.APP_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.APP_PORT ?? '4101', 10);

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error({ error }, 'API startup failed');
  process.exitCode = 1;
}
