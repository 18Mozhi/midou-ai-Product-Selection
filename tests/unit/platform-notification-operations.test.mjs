import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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
        "apps/web/src/components/PlatformNotificationManagement.vue",
        "apps/web/src/components/PlatformNotificationCenter.vue",
        "apps/web/src/components/PlatformNotificationFacts.vue",
        "apps/web/src/components/PlatformNotificationActionDialog.vue",
        "apps/web/src/components/PlatformNotificationPagination.vue",
        "apps/web/src/components/use-platform-notification-list.ts",
        "apps/web/src/components/use-platform-message-editor.ts",
        "apps/web/src/components/use-platform-notification-action.ts",
      ],
      "apps/web/src/styles/platform-operations.css",
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
    "前往规则总览",
  ])
    assert.match(web, new RegExp(label));
  assert.match(web, /message_page_size/);
  assert.match(web, /读取超时，当前仍显示上次成功快照/);
  assert.match(web, /label="通知与投递记录"/);
  assert.match(web, /:aria-label="`\$\{label\}分页`"/);
  assert.match(web, /邮件服务未接入，管理入口保持关闭/);
  assert.doesNotMatch(web, /href="\/platform-admin\/email"/);
  assert.doesNotMatch(web, /to="\/automations"/);
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
  for (const label of ["新建草稿", "编辑草稿", "取消草稿"]) assert.match(web, new RegExp(label));
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

test("notification management validates both factual and draft pagination", async () => {
  let captured = null;
  const service = new PlatformDashboardService({
    readManagement: async (input) => {
      captured = input;
      return { items: [], messages: [] };
    },
  });
  await service.management({
    actorId: "actor",
    domain: "notifications",
    status: "task",
    page: "2",
    pageSize: "20",
    messagePage: "3",
    messagePageSize: "10",
    requestId: "request",
    traceId: "trace",
  });
  assert.equal(captured.page, 2);
  assert.equal(captured.pageSize, 20);
  assert.equal(captured.messagePage, 3);
  assert.equal(captured.messagePageSize, 10);
  for (const value of [{ status: "invalid" }, { page: 0 }, { messagePageSize: 101 }])
    assert.throws(
      () =>
        service.management({
          actorId: "actor",
          domain: "notifications",
          requestId: "request",
          traceId: "trace",
          ...value,
        }),
      (error) => error instanceof PlatformDashboardError && error.statusCode === 400,
    );
});

test("notification repository counts before paging and keeps stable ordering", async () => {
  const repository = await readFile("apps/api/src/mysql-platform-dashboard-repository.ts", "utf8");
  assert.match(repository, /SELECT COUNT\(\*\) total,SUM\(n\.read_at IS NULL\) unread/);
  assert.match(repository, /ORDER BY n\.created_at DESC,n\.id DESC LIMIT \? OFFSET \?/);
  assert.match(repository, /message_pagination/);
  assert.doesNotMatch(repository, /n\.created_at DESC LIMIT 100/);
});

test("platform notification styles keep operational metadata readable", async () => {
  const paths = [
    "apps/web/src/platform-notifications.css",
    "apps/web/src/platform-notification-operations.css",
    "apps/web/src/components/platform-message-editor.css",
    "apps/web/src/components/PlatformNotificationPagination.vue",
  ];
  for (const path of paths) {
    const source = await readFile(path, "utf8"),
      undersized = [...source.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/gu)].filter(
        (match) => Number(match[1]) < 13,
      );
    assert.deepEqual(undersized, [], `${path} must not use text below 13px`);
  }
});

test("platform management keeps orchestration and message views in bounded components", async () => {
  const baseline = "699ac3f3d8832a78232030f07859122978dcfa4b";
  const prior = (file) =>
    execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
  const parent = "apps/web/src/components/PlatformManagementCenter.vue";
  // The inherited 1050-line cap already failed at the 1068-line takeover baseline.
  // P57 extraction must reduce that parent, not silently raise the old cap to 1100.
  assert.equal(prior(parent).split("\n").length, 1068);
  assert.ok((await readFile(parent, "utf8")).split(/\r?\n/).length < 1068);
  const unrelatedList = "apps/web/src/components/PlatformManagementRecordList.vue";
  assert.equal(
    (await readFile(unrelatedList, "utf8")).replaceAll("\r\n", "\n"),
    prior(unrelatedList),
  );
  const limits = new Map([
    ["apps/web/src/components/PlatformManagementFilter.vue", 100],
    ["apps/web/src/components/platform-management-presentation.ts", 100],
    ["apps/web/src/components/PlatformNotificationCenter.vue", 260],
    ["apps/web/src/components/PlatformNotificationManagement.vue", 120],
    ["apps/web/src/components/PlatformNotificationFacts.vue", 140],
    ["apps/web/src/components/PlatformNotificationActionDialog.vue", 140],
    ["apps/web/src/components/PlatformMessageWorkbench.vue", 260],
    ["apps/web/src/components/PlatformMessageEditor.vue", 200],
    ["apps/web/src/components/PlatformNotificationOperations.vue", 160],
    ["apps/web/src/components/PlatformNotificationPagination.vue", 100],
    ["apps/web/src/components/use-platform-notification-list.ts", 240],
    ["apps/web/src/components/use-platform-message-editor.ts", 140],
    ["apps/web/src/components/use-platform-notification-action.ts", 150],
  ]);
  for (const [path, limit] of limits) {
    const source = await readFile(path, "utf8");
    assert.ok(source.split(/\r?\n/u).length < limit, `${path} must remain below ${limit} lines`);
  }
});
