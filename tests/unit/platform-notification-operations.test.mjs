import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("platform notification operations expose templates channels subscriptions delivery retry and alert routes", async () => {
  const [web, repository, worker] = await Promise.all(
    [
      "apps/web/src/components/PlatformManagementCenter.vue",
      "apps/api/src/mysql-platform-dashboard-repository.ts",
      "apps/worker/src/notification-outbox-worker.ts",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const label of ["系统模板", "渠道状态", "用户订阅", "告警路由", "通知与投递记录", "新增或编辑自动化路由"])
    assert.match(web, new RegExp(label));
  for (const fact of ["notification_preferences", "notification_deliveries", "automation_rules", "competitor_monitor_rules", "pending_provider_selection"])
    assert.match(repository, new RegExp(fact));
  assert.match(worker, /任务状态更新/);
  assert.match(worker, /审批状态更新/);
  assert.match(worker, /竞品监控更新/);
});
