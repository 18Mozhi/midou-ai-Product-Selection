import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("P28 review skin retains report and export contracts", async () => {
  const source = await readFile("apps/web/src/components/ReportCenter.vue", "utf8");
  for (const contract of [
    "/reports/${selectedType}",
    '"/report-exports"',
    "/regenerate",
    "/download",
  ])
    assert.ok(source.includes(contract), contract);
});
