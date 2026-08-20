import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  NotificationService,
  validateNotificationAction,
  validatePreferences,
  NotificationServiceError,
} from "../../apps/api/dist/notification-service.js";
import { MySqlNotificationRepository } from "../../apps/api/dist/mysql-notification-repository.js";
import { registerNotificationRoutes } from "../../apps/api/dist/notification-routes.js";
import { notificationBody } from "../../apps/worker/dist/notification-outbox-worker.js";
import Fastify from "fastify";
test("M05-03.A01/A02/A04/A12 locks self notification actions and preferences", () => {
  assert.equal(validateNotificationAction({ action: "read", expected_version: 1 }).action, "read");
  assert.equal(
    validateNotificationAction({ action: "start", expected_version: 2 }).action,
    "start",
  );
  assert.equal(
    validateNotificationAction({ action: "close", expected_version: 3 }).action,
    "close",
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
  assert.throws(
    () => validatePreferences({ ...p, email_enabled: true }),
    (e) => e instanceof NotificationServiceError && e.code === "mail_provider_pending",
  );
});
test("M05-03 validates and forwards workflow status filters", async () => {
  const calls = [],
    service = new NotificationService({
      list: async (input) => {
        calls.push(input);
        return { items: [], page: input.page, page_size: input.pageSize };
      },
    });
  await service.list({
    page: "2",
    pageSize: "20",
    workflowStatus: "in_progress",
  });
  await service.list({ workflowStatus: "internal_unknown" });
  assert.equal(calls[0].workflowStatus, "in_progress");
  assert.equal(calls[0].page, 2);
  assert.equal(calls[0].pageSize, 20);
  assert.equal(calls[1].workflowStatus, null);
});
test("M05-03 forwards the workflow status query through the HTTP route", async () => {
  const calls = [],
    app = Fastify();
  registerNotificationRoutes(app, {
    service: {
      list: async (input) => {
        calls.push(input);
        return { items: [], page: 1, page_size: 50, total: 0 };
      },
    },
    auth: {
      authenticate: async (token) => ({
        user: { id: "actor" },
        session: { id: `session:${token}` },
      }),
    },
    authorization: {
      resolveSession: async () => ({
        context: { organization_id: "org", workspace_id: "workspace" },
      }),
      authorize: async () => undefined,
    },
    secureCookie: false,
    webOrigin: "https://scoutops.test",
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/notifications?workflow_status=closed",
    headers: {
      cookie: "scoutops_session=route-token",
      "x-request-id": "request-route",
      "x-trace-id": "trace-route",
    },
  });
  await app.close();
  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].workflowStatus, "closed");
});
test("M05-03 keeps internal event codes out of notification copy", () => {
  const body = notificationBody("approval");
  assert.equal(body, "审批状态已变化，请查看关联记录。");
  assert.doesNotMatch(body, /approval\.overdue/);
});
test("M05-03 groups root causes before pagination and keeps the newest representative", async () => {
  const seen = [],
    row = (id, rootCause, createdAt, workflowStatus = "in_progress") => ({
      id,
      category: "system",
      severity: "warning",
      title: "来源异常",
      body: "需要处理",
      resource_type: "collection_task",
      resource_id: "00000000-0000-4000-8000-000000000945",
      root_cause_key: rootCause,
      workflow_status: workflowStatus,
      read_at: null,
      version: 1,
      created_at: createdAt,
    }),
    pool = {
      query: async (sql, args) => {
        seen.push({ sql, args });
        if (sql.includes("SELECT COUNT(*) total FROM (")) return [[{ total: 2 }]];
        if (sql.includes("GROUP BY group_key"))
          return [
            [
              {
                group_key: "cause-b",
                group_count: 2,
                latest_created_at: "2026-08-19T10:02:00.000Z",
              },
              {
                group_key: "cause-a",
                group_count: 1,
                latest_created_at: "2026-08-19T10:00:00.000Z",
              },
            ],
          ];
        return [
          [
            row("new-b", "cause-b", "2026-08-19T10:02:00.000Z"),
            row("old-b", "cause-b", "2026-08-19T10:01:00.000Z"),
            row("only-a", "cause-a", "2026-08-19T10:00:00.000Z"),
          ],
        ];
      },
    },
    repository = new MySqlNotificationRepository(pool),
    result = await repository.list({
      organizationId: "org",
      workspaceId: "workspace",
      actorId: "actor",
      page: 1,
      pageSize: 20,
      unread: false,
      category: null,
      workflowStatus: "in_progress",
    });
  assert.equal(result.total, 2);
  assert.deepEqual(
    result.items.map((item) => [item.id, item.group_count]),
    [
      ["new-b", 2],
      ["only-a", 1],
    ],
  );
  assert.equal(seen.length, 3);
  assert.ok(seen.every(({ sql }) => sql.includes("workflow_status=?")));
  assert.ok(seen.every(({ args }) => args.includes("in_progress")));
});
test("M05-03.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const files = [
      "database/migrations/0018c_notifications_m05_03.up.sql",
      "database/migrations/0046_notification_workflow_root_cause.up.sql",
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
  assert.match(values[1], /workflow_status[\s\S]*root_cause_key/);
  assert.match(
    values[2],
    /workflow_status=\?[\s\S]*GROUP BY group_key[\s\S]*notification_version_conflict/,
  );
  assert.match(values[4], /pending_placeholder/);
  assert.match(values[4], /notificationBody\(category\)/);
  assert.match(values[4], /dead_letter/);
  assert.match(
    values[5],
    /已产生新的可审计事件[\s\S]*未处理[\s\S]*处理中[\s\S]*已关闭[\s\S]*已读[\s\S]*同根因/,
  );
  assert.match(values[5], /category:[\s\S]*status:[\s\S]*unread:[\s\S]*notification:/);
  assert.match(values[5], /sourceRoute[\s\S]*返回来源/);
  assert.equal(JSON.parse(values.at(-1)).atomicTasks.length, 17);
});
