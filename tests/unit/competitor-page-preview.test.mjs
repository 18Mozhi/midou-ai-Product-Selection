import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P19 keeps incomplete collection facts distinct from a zero-valued snapshot", async () => {
  const source = await readFile("apps/web/src/components/CompetitorMonitor.vue", "utf8");
  assert.match(source, /snapshot\?\.current_price == null/);
  assert.match(source, /等待首次采集/);
  assert.match(source, /最近一次采集未形成快照/);
  assert.match(source, /isCollectionPending\(latestCollection\.value\)/);
});

test("P19 retains explicit permissions for monitoring and validation work", async () => {
  const source = await readFile("apps/web/src/components/CompetitorMonitor.vue", "utf8");
  assert.match(source, /competitor:manage/);
  assert.match(source, /task:create/);
  assert.match(source, /只读：无创建任务权限/);
});
