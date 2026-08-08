import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ReportService,
  ReportServiceError,
} from "../../apps/api/dist/report-service.js";
import {
  csvCell,
  csvBuffer,
} from "../../apps/worker/dist/report-export-worker.js";
test("M05-06.A01/A02/A04/A12 locks report and CSV truth boundaries", async () => {
  const repo = {
      report: async (i) => i,
      listExports: async () => [],
      createExport: async (i) => i.value,
      detail: async () => ({}),
    },
    service = new ReportService(repo, "C:/scoutops-test", 24);
  assert.throws(
    () => service.report({ reportType: "forecast" }),
    (e) => e instanceof ReportServiceError && e.code === "report_type_invalid",
  );
  assert.throws(
    () =>
      service.createExport({ value: { report_type: "trend", format: "xlsx" } }),
    (e) =>
      e instanceof ReportServiceError && e.code === "report_format_invalid",
  );
  assert.equal(csvCell("=SUM(A1:A2)"), '"\'=SUM(A1:A2)"');
  assert.match(
    csvBuffer([{ name: 'a"b', missing: null }]).toString("utf8"),
    /"a""b",""/,
  );
});
test("M05-06.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const files = [
      "database/migrations/0018f_reports_m05_06.up.sql",
      "apps/api/src/mysql-report-repository.ts",
      "apps/api/src/report-routes.ts",
      "apps/worker/src/report-export-worker.ts",
      "apps/web/src/components/ReportCenter.vue",
      "docs/architecture/m05-06-reports-exports.md",
      "docs/runbooks/m05-06-reports-exports.md",
      "docs/openapi.yaml",
      "docs/feature-map.json",
      "config/env.example",
      "verification/modules/M05-06.json",
    ],
    v = await Promise.all(files.map((x) => readFile(x, "utf8")));
  assert.match(v[0], /report_exports[\s\S]*report_export_operations/);
  assert.match(v[1], /organization_id=\?[\s\S]*workspace_id=\?/);
  assert.match(v[2], /report:read[\s\S]*text\/csv/);
  assert.match(v[3], /row_limit_exceeded[\s\S]*expired/);
  assert.match(v[4], /数据不足|到期后由 Worker 清理/);
  assert.equal(JSON.parse(v.at(-1)).atomicTasks.length, 17);
});
