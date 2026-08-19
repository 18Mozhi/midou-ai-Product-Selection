import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateAutomationRule,
  AutomationServiceError,
} from "../../apps/api/dist/automation-service.js";
const id = "00000000-0000-4000-8000-000000000551";
test("M05-05.A01/A02/A04/A12 validates safe versioned rule boundaries", () => {
  const rule = validateAutomationRule({
    name: "审批超时提醒",
    trigger_event_type: "approval.overdue",
    condition_severity: "warning",
    action_type: "notify_owner",
    owner_id: id,
    action_title: "审批超时，请人工处理",
    rate_limit_count: 5,
    rate_limit_window_minutes: 60,
  });
  assert.equal(rule.action_type, "notify_owner");
  assert.throws(
    () =>
      validateAutomationRule({
        ...rule,
        trigger_event_type: "task.created",
        action_type: "create_task",
        action_assignee_id: id,
      }),
    (e) =>
      e instanceof AutomationServiceError &&
      e.code === "automation_cycle_forbidden",
  );
  assert.throws(
    () =>
      validateAutomationRule({ ...rule, trigger_event_type: "unknown.event" }),
    (e) =>
      e instanceof AutomationServiceError &&
      e.code === "automation_trigger_invalid",
  );
  assert.throws(
    () => validateAutomationRule({ ...rule, rate_limit_count: 0 }),
    (e) => e instanceof AutomationServiceError,
  );
});
test("M05-05.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const files = [
      "database/migrations/0018e_automation_rules_m05_05.up.sql",
      "apps/api/src/mysql-automation-repository.ts",
      "apps/api/src/automation-routes.ts",
      "apps/worker/src/automation-worker.ts",
      "apps/web/src/components/AutomationRuleCenter.vue",
      "docs/architecture/m05-05-automation-rules.md",
      "docs/runbooks/m05-05-automation-rules.md",
      "docs/openapi.yaml",
      "docs/feature-map.json",
      "config/env.example",
      "verification/modules/M05-05.json",
    ],
    v = await Promise.all(files.map((x) => readFile(x, "utf8")));
  assert.match(
    v[0],
    /automation_rules[\s\S]*automation_executions[\s\S]*automation_operations/,
  );
  assert.match(v[2], /team:manage/);
  assert.match(v[3], /rate_limited[\s\S]*dead_letter/);
  assert.match(v[4], /不会自动审批|人工暂停|创建人工任务/);
  assert.match(v[6], /宝塔[\s\S]*回滚/);
  assert.equal(JSON.parse(v.at(-1)).atomicTasks.length, 17);
});
test("automation detail can enter an audited full edit flow", async () => {
  const { AutomationService } =
    await import("../../apps/api/dist/automation-service.js");
  let input;
  const service = new AutomationService({
    update: async (value) => (
      (input = value),
      { id: value.ruleId, version: 2 }
    ),
  });
  const result = await service.update({
    ruleId: id,
    value: {
      name: "审批超时升级",
      trigger_event_type: "approval.overdue",
      condition_severity: "critical",
      action_type: "notify_owner",
      owner_id: id,
      action_title: "请立即人工处理",
      rate_limit_count: 3,
      rate_limit_window_minutes: 30,
      expected_version: 1,
      reason: "升级严重级别",
    },
  });
  assert.equal(result.version, 2);
  assert.equal(input.value.expected_version, 1);
  assert.equal(input.value.reason, "升级严重级别");
  const [route, web, openapi] = await Promise.all(
    [
      "apps/api/src/automation-routes.ts",
      "apps/web/src/components/AutomationRuleCenter.vue",
      "docs/openapi.yaml",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(route, /app\.patch/);
  assert.match(web, /编辑自动化规则/);
  assert.match(openapi, /Edit a scoped automation rule/);
});
