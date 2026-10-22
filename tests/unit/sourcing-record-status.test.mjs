import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformSync } from "esbuild";
const source = await readFile("apps/web/src/components/sourcing-record-status.ts", "utf8");
const { sourcingRecordStatusText } = await import(
  `data:text/javascript;base64,${Buffer.from(transformSync(source, { loader: "ts", format: "esm" }).code).toString("base64")}`
);
test("sourcing record labels preserve queued, blocked, failed, partial and empty distinctions", () => {
  for (const [status, label] of Object.entries({
    queued: "等待采集",
    running: "采集中",
    blocked_captcha: "验证受阻",
    failed_terminal: "采集失败",
    completed_with_warnings: "已完成但有缺失",
    succeeded_empty: "未找到可用候选",
    cancelled: "已取消",
  }))
    assert.equal(sourcingRecordStatusText(status), label);
  assert.equal(sourcingRecordStatusText("future_status"), "future_status");
});
test("sourcing workbench and product detail share one status mapping", async () => {
  const workbench = await readFile("apps/web/src/composables/useSourcingWorkspace.ts", "utf8");
  const detail = await readFile("apps/web/src/components/OpportunitySupplyPanel.vue", "utf8");
  assert.match(workbench, /statusText = sourcingRecordStatusText/);
  assert.doesNotMatch(workbench, /blocked_captcha: "验证受阻"/);
  assert.match(detail, /sourcingRecordStatusText\(selected.status\)/);
  assert.match(detail, /sourcingRecordStatusText\(selected.collection_progress.status\)/);
});
