import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PlatformDashboardError,
  PlatformDashboardService,
} from "../../apps/api/dist/platform-dashboard-service.js";

test("platform notification operations expose templates channels subscriptions delivery retry and alert routes", async () => {
  const [web, styles, repository, worker] = await Promise.all(
    [
      [
        "apps/web/src/components/PlatformManagementCenter.vue",
        "apps/web/src/components/PlatformMessageWorkbench.vue",
        "apps/web/src/components/PlatformMessageEditor.vue",
        "apps/web/src/components/PlatformNotificationOperations.vue",
      ],
      "apps/web/src/styles.css",
      "apps/api/src/mysql-platform-dashboard-repository.ts",
      "apps/worker/src/notification-outbox-worker.ts",
    ].map((path) =>
      Array.isArray(path)
        ? Promise.all(path.map((file) => readFile(file, "utf8"))).then((sources) =>
            sources.join("\n"),
          )
        : readFile(path, "utf8"),
    ),
  );
  for (const label of [
    "系统模板",
    "渠道状态",
    "用户订阅",
    "告警路由",
    "通知与投递记录",
    "新增或编辑自动化路由",
  ])
    assert.match(web, new RegExp(label));
  assert.match(web, /邮件服务未接入，管理入口已关闭/);
  assert.doesNotMatch(web, /href="\/platform-admin\/email"/);
  assert.match(styles, /\.role-shell\s+dialog\[open\]\s*\{\s*z-index:\s*40/);
  for (const fact of [
    "notification_preferences",
    "notification_deliveries",
    "automation_rules",
    "competitor_monitor_rules",
    "pending_provider_selection",
  ])
    assert.match(repository, new RegExp(fact));
  assert.match(worker, /任务状态更新/);
  assert.match(worker, /审批状态更新/);
  assert.match(worker, /竞品监控更新/);
});

test("platform notification drafts remain available while mail drafts fail closed", async () => {
  const [web, service, routes, migration, openapi, featureMap] = await Promise.all(
    [
      [
        "apps/web/src/components/PlatformManagementCenter.vue",
        "apps/web/src/components/PlatformMessageWorkbench.vue",
        "apps/web/src/components/PlatformMessageEditor.vue",
      ],
      "apps/api/src/platform-dashboard-service.ts",
      "apps/api/src/platform-dashboard-routes.ts",
      "database/migrations/0040_platform_messages.up.sql",
      "docs/openapi.yaml",
      "docs/feature-map.json",
    ].map((path) =>
      Array.isArray(path)
        ? Promise.all(path.map((file) => readFile(file, "utf8"))).then((sources) =>
            sources.join("\n"),
          )
        : readFile(path, "utf8"),
    ),
  );
  for (const label of ["发布通知", "编辑草稿", "取消草稿"]) assert.match(web, new RegExp(label));
  for (const operation of ["createMessage", "updateMessage", "messageAction"])
    assert.match(service, new RegExp(operation));
  assert.match(routes, /management\/messages\/:messageId\/actions/);
  assert.match(migration, /CREATE TABLE `platform_messages`/);
  assert.match(openapi, /platform\/management\/messages\/\{messageId\}\/actions/);
  assert.match(featureMap, /0040_platform_messages\.up\.sql/);
  assert.match(featureMap, /pending_provider_selection/);
  assert.match(service, /mail_provider_pending/);
});

test("platform message service rejects mail even when the UI is bypassed", () => {
  const service = new PlatformDashboardService({
    createMessage: async () => ({ status: "draft" }),
  });
  const common = {
    title: "系统通知",
    body: "仅通过站内通知发布。",
    category: "system",
    severity: "info",
    audience_type: "all_users",
    organization_id: null,
    user_id: null,
    in_app_enabled: true,
  };
  for (const value of [
    { ...common, kind: "email", email_enabled: true },
    { ...common, kind: "notification", email_enabled: true },
  ])
    assert.throws(
      () => service.createMessage(value, {}),
      (error) => error instanceof PlatformDashboardError && error.code === "mail_provider_pending",
    );
});

test("platform management keeps orchestration and message views in bounded components", async () => {
  const limits = new Map([
    ["apps/web/src/components/PlatformManagementCenter.vue", 1_000],
    ["apps/web/src/components/PlatformMessageWorkbench.vue", 200],
    ["apps/web/src/components/PlatformMessageEditor.vue", 200],
    ["apps/web/src/components/PlatformNotificationOperations.vue", 200],
  ]);
  for (const [path, limit] of limits) {
    const source = await readFile(path, "utf8");
    assert.ok(source.split(/\r?\n/u).length < limit, `${path} must remain below ${limit} lines`);
  }
});
