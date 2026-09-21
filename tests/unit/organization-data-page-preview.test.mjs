import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P35 review retains read-only facts and null export rows", async () => {
  const source = await readFile("apps/web/src/components/OrganizationDataPanel.vue", "utf8");
  for (const item of ["数量不等于数据质量", "尚未生成", "前往报表工作台", "org_data_export_page"])
    assert.ok(source.includes(item), item);
});
