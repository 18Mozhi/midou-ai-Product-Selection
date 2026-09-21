import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P53 review keeps metadata, leases and recovery separate", async () => {
  const source = await readFile("apps/web/src/components/CollectionRuntimeCenter.vue", "utf8");
  for (const text of ["采集运行监控", "档案与租约", "最近运行", "回收过期运行", 'method: "POST"'])
    assert.ok(source.includes(text), text);
});
