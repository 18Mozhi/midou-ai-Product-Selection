import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P51 review keeps task facts and separates the replay write", async () => {
  const source = await readFile("apps/web/src/components/CollectionTaskCenter.vue", "utf8");
  for (const text of ["采集任务监控", "覆盖不足不会自动给出推荐结论", "人工重放", 'method: "POST"'])
    assert.ok(source.includes(text), text);
});
