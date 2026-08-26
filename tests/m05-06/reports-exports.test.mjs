import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import { ReportService, ReportServiceError } from "../../apps/api/dist/report-service.js";
import { MySqlReportRepository } from "../../apps/api/dist/mysql-report-repository.js";
import { registerReportRoutes } from "../../apps/api/dist/report-routes.js";
import { csvCell, csvBuffer } from "../../apps/worker/dist/report-export-worker.js";
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
    () => service.createExport({ value: { report_type: "trend", format: "xlsx" } }),
    (e) => e instanceof ReportServiceError && e.code === "report_format_invalid",
  );
  assert.equal(csvCell("=SUM(A1:A2)"), '"\'=SUM(A1:A2)"');
  assert.match(csvBuffer([{ name: 'a"b', missing: null }]).toString("utf8"), /"a""b",""/);
});
test("M05-06 regenerates only expired or final-failure exports as a new audited job", async () => {
  const sourceId = "00000000-0000-4000-8000-000000000568",
    now = new Date("2026-08-19T10:00:00.000Z"),
    created = [],
    repo = {
      report: async () => ({}),
      listExports: async () => [],
      detail: async ({ exportId }) => ({
        id: exportId,
        report_type: "trend",
        format: "csv",
        status: "expired",
        expires_at: "2026-08-18T10:00:00.000Z",
      }),
      createExport: async (input) => {
        created.push(input);
        return input;
      },
    },
    service = new ReportService(repo, "C:/scoutops-test", 24, () => now),
    result = await service.regenerate({
      exportId: sourceId,
      organizationId: "org",
      workspaceId: "workspace",
      actorId: "actor",
      requestId: "request",
      traceId: "trace",
      idempotencyKey: "regenerate-once",
    });
  assert.equal(created.length, 1);
  assert.equal(result.regeneratedFromExportId, sourceId);
  assert.equal(result.value.report_type, "trend");
  assert.equal(result.value.format, "csv");
  assert.equal(result.value.expires_at.toISOString(), "2026-08-20T10:00:00.000Z");
  assert.equal(result.route, `POST:/api/v1/report-exports/${sourceId}/regenerate`);

  repo.detail = async ({ exportId }) => ({
    id: exportId,
    report_type: "trend",
    format: "csv",
    status: "succeeded",
    expires_at: "2026-08-20T10:00:00.000Z",
  });
  await assert.rejects(
    () => service.regenerate({ exportId: sourceId }),
    (error) =>
      error instanceof ReportServiceError && error.code === "report_export_still_available",
  );
  assert.equal(created.length, 1);
});
test("M05-06 exposes scoped idempotent regeneration through the real route", async () => {
  const sourceId = "00000000-0000-4000-8000-000000000568",
    captured = [],
    app = Fastify();
  registerReportRoutes(app, {
    service: {
      regenerate: async (input) => {
        captured.push(input);
        return { id: "replacement", status: "queued" };
      },
    },
    auth: {
      authenticate: async () => ({
        user: { id: "actor" },
        session: { id: "session" },
      }),
    },
    authorization: {
      resolveSession: async () => ({
        context: { organization_id: "org", workspace_id: "workspace" },
      }),
      authorize: async () => undefined,
    },
    secureCookie: false,
    webOrigin: "https://scoutops.example.test",
  });
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/report-exports/${sourceId}/regenerate`,
      headers: {
        cookie: "scoutops_session=session-token",
        origin: "https://scoutops.example.test",
        "idempotency-key": "regenerate-route-once",
        "x-request-id": "route-request",
        "x-trace-id": "route-trace",
      },
    });
    assert.equal(response.statusCode, 202);
    assert.deepEqual(response.json().data, {
      id: "replacement",
      status: "queued",
    });
    assert.deepEqual(captured, [
      {
        organizationId: "org",
        workspaceId: "workspace",
        actorId: "actor",
        requestId: "route-request",
        traceId: "route-trace",
        idempotencyKey: "regenerate-route-once",
        exportId: sourceId,
      },
    ]);
  } finally {
    await app.close();
  }
});
test("M05-06 derives global queue position and ETA only from successful export history", async () => {
  const ownId = "00000000-0000-4000-8000-000000000570",
    aheadId = "00000000-0000-4000-8000-000000000571",
    now = new Date("2026-08-19T10:00:00.000Z"),
    pool = {
      query: async (sql) => {
        if (sql.startsWith("SELECT * FROM report_exports WHERE organization_id="))
          return [
            [
              {
                id: ownId,
                report_type: "opportunity",
                format: "csv",
                status: "queued",
                attempt_count: 0,
                filename: "opportunity.csv",
                row_count: null,
                byte_size: null,
                expires_at: "2026-08-20T10:00:00.000Z",
                last_error_code: null,
                version: 1,
                created_at: "2026-08-19T10:00:00.000Z",
                updated_at: "2026-08-19T10:00:00.000Z",
              },
            ],
          ];
        if (sql.includes("status IN ('queued','leased','retry_scheduled')"))
          return [
            [
              {
                id: aheadId,
                status: "leased",
                available_at: "2026-08-19T09:58:00.000Z",
                lease_expires_at: "2026-08-19T10:05:00.000Z",
                created_at: "2026-08-19T09:58:00.000Z",
                updated_at: "2026-08-19T09:59:30.000Z",
              },
              {
                id: ownId,
                status: "queued",
                available_at: "2026-08-19T10:00:00.000Z",
                lease_expires_at: null,
                created_at: "2026-08-19T10:00:00.000Z",
                updated_at: "2026-08-19T10:00:00.000Z",
              },
            ],
          ];
        if (sql.includes("TIMESTAMPDIFF(SECOND,created_at,updated_at)"))
          return [
            [{ completion_seconds: 60 }, { completion_seconds: 120 }, { completion_seconds: 180 }],
          ];
        throw new Error(`unexpected query: ${sql}`);
      },
    },
    repository = new MySqlReportRepository(pool, () => now),
    [item] = await repository.listExports({ organizationId: "org", workspaceId: "workspace" });
  assert.equal(item.queue_position, 2);
  assert.equal(item.estimate_sample_size, 3);
  assert.equal(item.median_completion_seconds, 120);
  assert.equal(item.estimated_completion_at, "2026-08-19T10:03:30.000Z");
});
test("M05-06 concurrent idempotency-key collision replays the committed export", async () => {
  const expected = {
      id: "00000000-0000-4000-8000-000000000572",
      report_type: "trend",
      format: "csv",
      status: "queued",
    },
    input = {
      id: "00000000-0000-4000-8000-000000000573",
      organizationId: "org",
      workspaceId: "workspace",
      actorId: "actor",
      requestId: "request",
      traceId: "trace",
      route: "POST:/api/v1/report-exports",
      idempotencyKey: "same-concurrent-key",
      value: {
        report_type: "trend",
        format: "csv",
        filename: "trend.csv",
        expires_at: new Date("2026-08-20T10:00:00.000Z"),
      },
    };
  let operationReads = 0,
    rolledBack = false;
  const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => {
        rolledBack = true;
      },
      release: () => undefined,
      query: async (sql) => {
        if (sql.startsWith("INSERT INTO report_export_operations"))
          throw Object.assign(new Error("duplicate operation"), { code: "ER_DUP_ENTRY" });
        return [[]];
      },
    },
    pool = {
      getConnection: async () => connection,
      query: async (sql) => {
        if (!sql.startsWith("SELECT result_json FROM report_export_operations"))
          throw new Error(`unexpected query: ${sql}`);
        operationReads += 1;
        return operationReads === 1 ? [[]] : [[{ result_json: JSON.stringify(expected) }]];
      },
    },
    repository = new MySqlReportRepository(pool);
  assert.deepEqual(await repository.createExport(input), expected);
  assert.equal(rolledBack, true);
  assert.equal(operationReads, 2);
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
  assert.match(v[1], /queue_position[\s\S]*estimated_completion_at[\s\S]*TIMESTAMPDIFF/);
  assert.match(v[2], /report:read[\s\S]*regenerate[\s\S]*text\/csv/);
  assert.match(v[3], /row_limit_exceeded[\s\S]*expired/);
  assert.match(v[4], /数据不足[\s\S]*重新生成|到期后由 Worker 清理/);
  assert.match(v[5], /全部已落库记录[\s\S]*observed_at/);
  assert.match(v[4], /结论摘要[\s\S]*在任务中心查看/);
  assert.match(v[4], /队列第[\s\S]*预计完成[\s\S]*估算依据/);
  assert.equal(JSON.parse(v.at(-1)).atomicTasks.length, 17);
});
