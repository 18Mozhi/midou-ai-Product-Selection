import { randomUUID } from 'node:crypto';
import { loadRuntimeConfig } from '../packages/config/dist/index.js';
import { createRedisConnection, ScopedRedisStore } from '../packages/redis/dist/index.js';

const config = loadRuntimeConfig(process.env, 'api');
const client = createRedisConnection(config);
client.on('error', () => {});
const store = new ScopedRedisStore(client);
const runId = randomUUID();
const input = { purpose: 'cache', organization_id: `verify-${runId}`, workspace_id: 'local', resource: 'live-check' };
const rateInput = { organization_id: `verify-${runId}`, workspace_id: 'local', resource: 'rate-check' };
const rateKey = { ...rateInput, purpose: 'rate' };

try {
  await store.connect();
  const health = await store.health(runId, runId);
  if (health.status !== 'available') throw new Error('Redis ping did not return PONG');
  await store.writeJson(input, { run_id: runId }, 5);
  const value = await store.readJson(input);
  if (value?.run_id !== runId) throw new Error('Redis scoped set/get mismatch');
  const rate = await store.incrementRate(rateInput, 5);
  if (rate.count !== 1 || rate.ttl_seconds < 1 || rate.ttl_seconds > 5) throw new Error('Redis atomic rate TTL mismatch');
  await store.delete(input);
  await store.delete(rateKey);
  console.log(JSON.stringify({ status: 'passed', dependency: 'redis', isolation: 'organization_and_workspace', cleanup: 'passed', request_id: runId, trace_id: runId }));
} catch (error) {
  console.error(JSON.stringify({ status: 'blocked', code: 'redis_unavailable', message: error instanceof Error ? error.message : 'unknown', request_id: runId, trace_id: runId }));
  process.exitCode = 2;
} finally {
  try { await store.delete(input); } catch {}
  try { await store.delete(rateKey); } catch {}
  await store.close();
}
