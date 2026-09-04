import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateTask,
  validateAction,
  BusinessTaskError,
  BusinessTaskService,
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
    () => validateAction({ action: "delay", expected_version: 1, reason: "延期" }),
    (e) => e instanceof BusinessTaskError,
  );
  assert.equal(validateAction({ action: "start", expected_version: 1 }).action, "start");
  assert.equal(
    validateAction({
      action: "transfer",
      expected_version: 1,
      reason: "调整负责人",
      assignee_id: "00000000-0000-4000-8000-000000000002",
    }).assignee_id,
    "00000000-0000-4000-8000-000000000002",
  );
  assert.deepEqual(
    validateAction({
      action: "progress",
      expected_version: 2,
      progress_percent: 45,
      progress_note: "已完成亚马逊竞品初筛",
    }),
    {
      action: "progress",
      expected_version: 2,
      reason: null,
      due_at: null,
      assignee_id: null,
      progress_percent: 45,
      progress_note: "已完成亚马逊竞品初筛",
    },
  );
});
test("task list keeps paused, query and whitelisted sort as server-side filters", async () => {
  let received;
  const service = new BusinessTaskService({
    list: async (input) => {
      received = input;
      return { items: [], total: 0, page: input.page, page_size: input.pageSize };
    },
  });
  await service.list({
    page: "2",
    pageSize: "10",
    status: "paused",
    query: "  亚马逊报价  ",
    sort: "updated_desc",
    mine: "true",
  });
  assert.deepEqual(
    {
      page: received.page,
      pageSize: received.pageSize,
      status: received.status,
      query: received.query,
      sort: received.sort,
      mine: received.mine,
    },
    {
      page: 2,
      pageSize: 10,
      status: "paused",
      query: "亚马逊报价",
      sort: "updated_desc",
      mine: true,
    },
  );
  assert.throws(
    () => service.list({ status: "unknown" }),
    (error) => error instanceof BusinessTaskError && error.code === "task_status_invalid",
  );
  assert.throws(
    () => service.list({ query: "x".repeat(201) }),
    (error) => error instanceof BusinessTaskError && error.code === "task_query_invalid",
  );
  assert.throws(
    () => service.list({ sort: "title_asc" }),
    (error) => error instanceof BusinessTaskError && error.code === "task_sort_invalid",
  );
});
test("M05-01.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const files = [
    "database/migrations/0018a_business_tasks_m05_01.up.sql",
    "database/migrations/0041_member_workspace_tasks.up.sql",
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
  const taskUi = (
    await Promise.all(
      [
        "apps/web/src/components/TaskWorkspace.vue",
        "apps/web/src/components/TaskListPanel.vue",
        "apps/web/src/components/TaskBatchActions.vue",
        "apps/web/src/components/TaskDetailPanel.vue",
      ].map((x) => readFile(x, "utf8")),
    )
  ).join("\n");
  assert.match(values[0], /task_comments[\s\S]*task_events[\s\S]*task_operations/);
  assert.match(values[1], /progress_percent[\s\S]*deleted_at/);
  assert.match(values[2], /task_version_conflict[\s\S]*outbox_events/);
  assert.match(values[2], /FOR UPDATE[\s\S]*this\.operation\(i, c\)/);
  assert.match(values[2], /task\.\$\{i\.value\.action\}[\s\S]*progress_note/);
  assert.match(values[4], /sourcing\.purchase_task\.queued[\s\S]*lease_expires_at/);
  assert.match(values[4], /CONVERT\(p\.id USING utf8mb4\)/);
  assert.match(values[4], /status='published',leased_by=NULL,leased_at=NULL,lease_expires_at=NULL/);
  assert.doesNotMatch(values[4], /sourcing_outbox SET status='published',published_at/);
  assert.match(taskUi, /更新进度|编辑|删除任务|任务活动/);
  assert.match(taskUi, /task-row-actions[\s\S]*删除任务/);
  assert.match(taskUi, /status:[\s\S]*page:[\s\S]*from:[\s\S]*slaNext/);
  assert.match(taskUi, /events[\s\S]*comments[\s\S]*sort/);
  assert.doesNotMatch(taskUi, /task-row-delete/);
  assert.match(taskUi, /当前阶段[\s\S]*phase\(task\)/);
  assert.match(taskUi, /member-options[\s\S]*接收成员[\s\S]*datetime-local/);
  assert.match(taskUi, /progress_percent[\s\S]*本次进展说明/);
  assert.match(taskUi, /批量延期[\s\S]*批量调整负责人/);
  assert.match(taskUi, /阻塞原因[\s\S]*下一负责人/);
  assert.match(taskUi, /task\.pause[\s\S]*payload\?\.reason/);
  assert.match(taskUi, /assigneeLabel[\s\S]*负责人目录暂不可用/);
  assert.match(taskUi, /canUpdate[\s\S]*canAssign[\s\S]*busy/);
  assert.match(taskUi, /任务不存在或已删除[\s\S]*重新加载/);
  assert.match(taskUi, /当前角色仅可查看任务事实与活动记录/);
  assert.match(taskUi, /TaskListPanel[\s\S]*TaskBatchActions[\s\S]*TaskDetailPanel/);
  assert.match(
    taskUi,
    /capabilities\?: string\[\][\s\S]*canCreate[\s\S]*canUpdate[\s\S]*canAssign/,
  );
  assert.match(taskUi, /搜索标题或说明/);
  assert.match(taskUi, /最近更新/);
  assert.match(taskUi, /已取消/);
  assert.doesNotMatch(taskUi, /window\.prompt/);
  assert.match(values[3], /\/api\/v1\/tasks\/member-options/);
  assert.match(values[2], /membership_data_scopes[\s\S]*scope_type='workspace'/);
  assert.match(values[2], /evidence_completion[\s\S]*opportunity_score_jobs[\s\S]*trigger_task_id/);
  assert.match(values[9], /\/tasks\/\{taskId\}/);
  assert.match(values[9], /\/tasks\/member-options/);
  const registry = JSON.parse(values.at(-1));
  assert.equal(registry.atomicTasks.length, 17);
});
