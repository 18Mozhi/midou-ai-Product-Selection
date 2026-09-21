import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P56 review retains fact-ledger reads and separates review writes", async () => {
  const source = await readFile("apps/web/src/components/PlatformContentCenter.vue", "utf8");
  for (const text of ["内容管理", "热点内容", "当前查询统计", "审核表单", "@review"])
    assert.ok(source.includes(text), text);
});
