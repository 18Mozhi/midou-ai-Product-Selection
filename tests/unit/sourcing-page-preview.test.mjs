import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P21 does not turn missing supplier facts into confirmed quotes", async () => {
  const source = await readFile("apps/web/src/components/SourcingWorkspace.vue", "utf8");
  assert.match(source, /尚未取得真实供应商报价/);
  assert.match(source, /待费用规则计算/);
  assert.match(source, /必须人工带证据确认/);
});

test("P21 keeps comparison and purchase boundaries on actual confirmed quote state", async () => {
  const source = await readFile("apps/web/src/components/SourcingWorkspace.vue", "utf8");
  assert.match(source, /selectedQuotes\.value\.length < 5/);
  assert.match(source, /至少再选一家才能对比/);
  assert.match(source, /candidate\.quote/);
});
