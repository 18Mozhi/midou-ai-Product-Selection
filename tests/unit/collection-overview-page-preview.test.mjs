import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P52 review preserves source-health facts and leaves replay as a separate write", async () => {
  const source = await readFile("apps/web/src/components/CollectionOperationsConsole.vue", "utf8");
  for (const text of [
    "来源与采集控制台",
    "来源与健康",
    "错误根因",
    "批量安全重放",
    'method: "POST"',
  ])
    assert.ok(source.includes(text), text);
});
