import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P55 review keeps governance facts and workbench-only actions", async () => {
  const source = await readFile("apps/web/src/components/PlatformGovernanceCenter.vue", "utf8");
  for (const text of ["治理版本目录", "规则、工作流与自动化", "来源配置历史", "进入所属工作台"])
    assert.ok(source.includes(text), text);
});
