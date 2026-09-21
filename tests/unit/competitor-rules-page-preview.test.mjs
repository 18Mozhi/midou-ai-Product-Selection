import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P20 keeps all rule states visible and does not invent edit actions", async () => {
  const source = await readFile("apps/web/src/components/CompetitorMonitor.vue", "utf8");
  assert.match(source, /item\.status === "enabled" \? "已生效" : "已停用"/);
  assert.match(source, /尚未配置监控规则/);
  assert.doesNotMatch(source, /编辑监控规则/);
});

test("P20 only exposes rule creation to monitoring managers", async () => {
  const source = await readFile("apps/web/src/components/CompetitorMonitor.vue", "utf8");
  assert.match(source, /v-if="canManage" class="primary" type="button" @click="openRule\(\)"/);
  assert.match(source, /competitor:manage/);
});
