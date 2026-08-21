import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { BusinessTaskService } from "../../apps/api/dist/business-task-service.js";
import { RealtimeService } from "../../apps/api/dist/realtime-service.js";
import { ReportService } from "../../apps/api/dist/report-service.js";

const scope = {
  organizationId: "00000000-0000-4000-8000-000000000101",
  workspaceId: "00000000-0000-4000-8000-000000000102",
  actorId: "00000000-0000-4000-8000-000000000103",
  requestId: "tenant-request",
  traceId: "tenant-trace",
  idempotencyKey: "tenant-idempotency",
};

test("tenant isolation covers business writes, exports and event replay", async () => {
  const writes = [];
  const taskService = new BusinessTaskService({
    list: async (input) => input,
    memberOptions: async (input) => input,
    detail: async (input) => input,
    create: async (input) => (writes.push(input), input),
    update: async (input) => input,
    remove: async (input) => input,
    action: async (input) => input,
    comment: async (input) => input,
    summary: async (input) => input,
  });
  await taskService.create({
    ...scope,
    value: {
      title: "验证华南新品任务",
      description: "仅当前组织可见",
      priority: "normal",
      assignee_id: scope.actorId,
      organizationId: "00000000-0000-4000-8000-000000000999",
    },
  });
  assert.equal(writes[0].organizationId, scope.organizationId);
  assert.equal(writes[0].workspaceId, scope.workspaceId);
  assert.equal("organizationId" in writes[0].value, false);

  const exports = [];
  const reportService = new ReportService(
    {
      report: async (input) => input,
      listExports: async (input) => input,
      createExport: async (input) => (exports.push(input), input),
      detail: async (input) => input,
    },
    "runtime/exports",
    24,
  );
  await reportService.createExport({
    ...scope,
    value: { report_type: "opportunity", format: "csv" },
  });
  assert.equal(exports[0].organizationId, scope.organizationId);
  assert.equal(exports[0].workspaceId, scope.workspaceId);

  const events = [];
  const realtime = new RealtimeService(
    {
      replay: async (input) => (events.push(input), []),
      auditConnect: async () => {},
    },
    100,
  );
  await realtime.replay({ ...scope, afterId: 0 });
  assert.equal(events[0].organizationId, scope.organizationId);
  assert.equal(events[0].workspaceId, scope.workspaceId);

  const [tasks, reports, eventRepository] = await Promise.all([
    readFile("apps/api/src/mysql-business-task-repository.ts", "utf8"),
    readFile("apps/worker/src/report-export-worker.ts", "utf8"),
    readFile("apps/api/src/mysql-business-task-repository.ts", "utf8"),
  ]);
  assert.match(tasks, /WHERE id=\? AND organization_id=\? AND workspace_id=\?/);
  assert.match(reports, /WHERE organization_id=\? AND workspace_id=\?/);
  assert.match(eventRepository, /INSERT INTO outbox_events \(id,organization_id,workspace_id/);
});
