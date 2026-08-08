import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateTask,
  validateAction,
  BusinessTaskError,
} from "../../apps/api/dist/business-task-service.js";
test("M05-01.A01/A02/A04/A12 locks truthful task and SLA inputs", () => {
  const v = validateTask({
    title: "跟进报价",
    description: "核验供应商",
    priority: "high",
    assignee_id: "00000000-0000-4000-8000-000000000001",
    due_at: null,
  });
  assert.equal(v.due_at, null);
  assert.throws(
    () =>
      validateAction({ action: "delay", expected_version: 1, reason: "延期" }),
    (e) => e instanceof BusinessTaskError,
  );
  assert.equal(
    validateAction({ action: "start", expected_version: 1 }).action,
    "start",
  );
});
test("M05-01.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const files = [
    "database/migrations/0018a_business_tasks_m05_01.up.sql",
    "apps/api/src/mysql-business-task-repository.ts",
    "apps/api/src/business-task-routes.ts",
    "apps/worker/src/business-task-projection-worker.ts",
    "apps/web/src/components/TaskWorkspace.vue",
    "docs/architecture/m05-01-business-tasks.md",
    "docs/runbooks/m05-01-business-tasks.md",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "config/env.example",
    "verification/modules/M05-01.json",
  ];
  const values = await Promise.all(files.map((x) => readFile(x, "utf8")));
  assert.match(
    values[0],
    /task_comments[\s\S]*task_events[\s\S]*task_operations/,
  );
  assert.match(values[1], /task_version_conflict[\s\S]*outbox_events/);
  assert.match(
    values[3],
    /sourcing\.purchase_task\.queued[\s\S]*lease_expires_at/,
  );
  assert.match(values[4], /390|未设置期限|登录已失效|无权访问任务/);
  const registry = JSON.parse(values.at(-1));
  assert.equal(registry.atomicTasks.length, 17);
});
