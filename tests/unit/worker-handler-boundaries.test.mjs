import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
});
