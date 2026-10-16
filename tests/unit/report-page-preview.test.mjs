import { readArchivedReportSource } from "../../scripts/lib/retired-report-surface.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("P28 archived review skin retains historical report and export contracts", async () => {
  const source = readArchivedReportSource("apps/web/src/components/ReportCenter.vue");
  for (const contract of [
    "/reports/${selectedType}",
    '"/report-exports"',
    "/regenerate",
    "/download",
  ])
    assert.ok(source.includes(contract), contract);
});
