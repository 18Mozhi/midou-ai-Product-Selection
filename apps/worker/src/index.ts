import { randomUUID } from 'node:crypto';

const heartbeat = {
  service: 'product-scout-worker',
  status: 'idle',
  worker_id: process.env.WORKER_ID ?? `worker-${randomUUID()}`,
  observed_at: new Date().toISOString(),
};

process.stdout.write(`${JSON.stringify(heartbeat)}\n`);
