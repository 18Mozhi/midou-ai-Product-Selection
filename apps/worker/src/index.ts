import { randomUUID } from 'node:crypto';
import { loadRuntimeConfig } from '@scoutops/config';

const config = loadRuntimeConfig(process.env, 'worker');
const heartbeat = {
  service: 'product-scout-worker',
  status: 'idle',
  worker_id: config.identity.workerId || `worker-${randomUUID()}`,
  config_fingerprint: config.configFingerprint,
  observed_at: new Date().toISOString(),
};

process.stdout.write(`${JSON.stringify(heartbeat)}\n`);
