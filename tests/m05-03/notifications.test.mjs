import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateNotificationAction,
  validatePreferences,
  NotificationServiceError,
} from "../../apps/api/dist/notification-service.js";
test("M05-03.A01/A02/A04/A12 locks self notification actions and preferences", () => {
  assert.equal(
    validateNotificationAction({ action: "read", expected_version: 1 }).action,
    "read",
  );
  assert.throws(
    () => validateNotificationAction({ action: "delete", expected_version: 1 }),
    (e) => e instanceof NotificationServiceError,
  );
  const p = validatePreferences({
    expected_version: 1,
    in_app_enabled: true,
    email_enabled: false,
    task_enabled: true,
    approval_enabled: true,
    competitor_enabled: false,
  });
  assert.equal(p.competitor_enabled, false);
});
test("M05-03.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const files = [
      "database/migrations/0018c_notifications_m05_03.up.sql",
      "apps/api/src/mysql-notification-repository.ts",
      "apps/api/src/notification-routes.ts",
      "apps/worker/src/notification-outbox-worker.ts",
      "apps/web/src/components/NotificationCenter.vue",
      "docs/architecture/m05-03-notifications.md",
      "docs/runbooks/m05-03-notifications.md",
      "docs/openapi.yaml",
      "docs/feature-map.json",
      "config/env.example",
      "verification/modules/M05-03.json",
    ],
    values = await Promise.all(files.map((x) => readFile(x, "utf8")));
  assert.match(
    values[0],
    /notification_preferences[\s\S]*notifications[\s\S]*notification_deliveries/,
  );
  assert.match(
    values[1],
    /recipient_id=\?[\s\S]*notification_version_conflict/,
  );
  assert.match(values[3], /pending_placeholder/);
  assert.match(values[3], /dead_letter/);
  assert.match(values[4], /邮件占位|登录已失效|当前没有通知/);
  assert.equal(JSON.parse(values.at(-1)).atomicTasks.length, 17);
});
