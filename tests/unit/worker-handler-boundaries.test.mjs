import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WorkerSchedulerStateWriter } from "../../apps/worker/dist/worker-scheduler-state.js";

const handlers = [
  ["auth-delivery-worker.ts", /processAuthDeliveryOnce/],
  ["collection-task-worker.ts", /processCollectionTaskOnce/],
  ["trend-projection-worker.ts", /async processOnce/],
  ["opportunity-refresh-worker.ts", /async processOnce/],
  ["opportunity-scoring-worker.ts", /async processOnce/],
  ["opportunity-profit-worker.ts", /async processOnce/],
  ["competitor-monitor-worker.ts", /async processOnce/],
  ["sourcing-projection-worker.ts", /async processOnce/],
  ["ai-analysis-worker.ts", /async processOnce/],
  ["business-task-projection-worker.ts", /projectBusinessTaskOnce/],
  ["approval-escalation-worker.ts", /async processOnce/],
  ["notification-outbox-worker.ts", /async processOnce/],
  ["automation-worker.ts", /async processOnce/],
  ["report-export-worker.ts", /async processOnce/],
  ["webhook-delivery-worker.ts", /class WebhookDeliveryWorker/],
  ["automatic-source-scheduler.ts", /async processOnce/],
  ["core-collection-projection-worker.ts", /async processOnce/],
];

test("worker entrypoint only orchestrates independently implemented queue handlers", async () => {
  const index = await readFile("apps/worker/src/index.ts", "utf8");
  const sources = await Promise.all(
    handlers.map(([file]) => readFile(`apps/worker/src/${file}`, "utf8")),
  );

  handlers.forEach(([file, entryPoint], indexPosition) => {
    assert.match(index, new RegExp(`from ["']\\./${file.replace(".ts", ".js")}["']`));
    assert.match(sources[indexPosition], entryPoint);
  });
  assert.doesNotMatch(index, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/iu);
  assert.doesNotMatch(index, /class\s+\w*(?:Worker|Repository)\b/u);
  // Bound executable composition rather than charging readable blank separators.
  assert.ok(index.split(/\r?\n/u).filter((line) => line.trim()).length < 400);
  assert.match(index, /WorkerPollers/);
  assert.match(await readFile("apps/worker/src/worker-pollers.ts", "utf8"), /activeQueues/);
});

test("best-effort scheduler persistence keeps the original safe failure diagnostic", async () => {
  const writer = new WorkerSchedulerStateWriter("");
  const messages = [];
  const original = console.error;
  let writes = 0;
  writer.write = async () => {
    if (++writes === 1) throw new Error("private-payload");
  };
  console.error = (value) => messages.push(JSON.parse(value));
  try {
    await writer.writeBestEffort({});
    await writer.writeBestEffort({});
  } finally {
    console.error = original;
  }
  assert.equal(writes, 2);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, "scheduler_state_write_failed");
  assert.equal(messages[0].service, "product-scout-worker");
  assert.deepEqual(Object.keys(messages[0]).sort(), ["observed_at", "service", "status"]);
});
