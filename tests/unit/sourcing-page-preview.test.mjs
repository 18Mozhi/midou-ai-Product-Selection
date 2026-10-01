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
  const [workspace, logic] = await Promise.all([
    readFile("apps/web/src/components/SourcingWorkspace.vue", "utf8"),
    readFile("apps/web/src/composables/useSourcingWorkspace.ts", "utf8"),
  ]);
  assert.match(workspace, /selectedQuotes\.length < 2 \|\| busy/);
  assert.match(workspace, /至少再选一家才能对比/);
  assert.match(logic, /if \(!candidate\.quote\) return;/);
  assert.match(logic, /selectedQuotes\.value\.length < 5/);
  assert.match(logic, /quote_id: candidate\.quote\.id/);
});
