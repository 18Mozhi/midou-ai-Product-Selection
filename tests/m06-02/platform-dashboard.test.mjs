import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PlatformDashboardService,
  PlatformDashboardError,
} from "../../apps/api/dist/platform-dashboard-service.js";
test("M06-02.A01/A02/A04/A12 validates factual dashboard windows", async () => {
  const calls = [],
    service = new PlatformDashboardService(
      { read: async (i) => (calls.push(i), { ok: true }) },
      "24h",
    );
  await service.read({ actorId: "actor", requestId: "req", traceId: "trace" });
  assert.equal(calls[0].window, "24h");
  assert.equal(calls[0].windowMinutes, 1440);
  await service.read({
    actorId: "actor",
    window: "7d",
    requestId: "req",
    traceId: "trace",
  });
  assert.equal(calls[1].windowMinutes, 10080);
  assert.throws(
    () =>
      service.read({
        actorId: "actor",
        window: "1y",
        requestId: "req",
        traceId: "trace",
      }),
    (e) => e instanceof PlatformDashboardError && e.code === "platform_dashboard_window_invalid",
  );
});
test("M06-02.A03/A05/A09/A11/A16 migration read audit and async ownership are explicit", async () => {
  const [up, down, repo, route] = await Promise.all(
    [
      "database/migrations/0020_platform_dashboard_m06_02.up.sql",
      "database/migrations/0020_platform_dashboard_m06_02.down.sql",
      "apps/api/src/mysql-platform-dashboard-repository.ts",
      "apps/api/src/platform-dashboard-routes.ts",
    ].map((p) => readFile(p, "utf8")),
  );
  assert.match(up, /platform_dashboard_views/);
  assert.match(up, /DEFAULT CHARSET=utf8mb4/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|GENERATED ALWAYS/i);
  assert.match(down, /DROP TABLE IF EXISTS `platform_dashboard_views`/);
  assert.match(repo, /platform\.dashboard\.read/);
  assert.match(repo, /task_success_rate\s*:\s*terminal\s*\?/);
  assert.match(repo, /status\s*:\s*!observed\s*\?\s*["']unknown["']/);
  assert.match(route, /capability\s*:\s*["']platform:operate["']/);
  assert.doesNotMatch(repo, /cookie|credential/i);
  assert.match(repo, /INSERT INTO trend_events[\s\S]*payload_json/);
  assert.doesNotMatch(repo, /eventDataColumn|\$\{eventDataColumn\}/);
});
test("M06-02.A06/A07/A08/A10/A13/A17 contracts frontend config and handoff stay synchronized", async () => {
  const [openapi, web, styles, env, schema, architecture, runbook, feature] = await Promise.all(
    [
      "docs/openapi.yaml",
      "apps/web/src/components/PlatformDashboard.vue",
      "apps/web/src/styles.css",
      "config/env.example",
      "config/schema.json",
      "docs/architecture/m06-02-platform-dashboard.md",
      "docs/runbooks/m06-02-platform-dashboard.md",
      "docs/feature-map.json",
    ].map((p) => readFile(p, "utf8")),
  );
  assert.match(openapi, /\/platform\/dashboard:/);
  for (const state of ["loading", "empty", "expired", "forbidden", "rate_limited", "blocked"])
    assert.match(web, new RegExp(state));
  assert.match(styles, /@media\s*\(\s*max-width:\s*700px\s*\)/);
  assert.match(env, /PLATFORM_DASHBOARD_QUEUE_WARNING=1000/);
  assert.ok(
    JSON.parse(schema).backendGroups.platformDashboard.includes(
      "PLATFORM_DASHBOARD_DEFAULT_WINDOW",
    ),
  );
  assert.match(architecture, /不代表多节点或 10,000/);
  assert.match(runbook, /宝塔重启 Node API/);
  assert.equal(JSON.parse(feature).implementation.platformDashboard.module, "M06-02");
});
test("M06-02 platform overview gives novice administrators clear next actions", async () => {
  const web = await readFile("apps/web/src/components/PlatformDashboard.vue", "utf8");
  for (const copy of [
    "今天先做什么",
    "系统会自动获取热点",
    "管理组织和用户",
    "查看热点来源",
    "查看采集进度",
    "等待处理",
    "稍后重试",
    "数据库",
    "任务队列",
    "数据质量",
  ])
    assert.match(web, new RegExp(copy));
  for (const path of [
    "/platform-admin/accounts",
    "/platform-admin/providers/sources",
    "/platform-admin/collection/overview",
  ])
    assert.match(web, new RegExp(path.replaceAll("/", "\\/")));
  assert.doesNotMatch(
    web,
    /PLATFORM OPERATIONS \/ REAL FACTS|当前 active|enabled<\/small>|<span>\{\{s\.code\}\}<\/span>|<span>\{\{q\.status\}\}<\/span>/,
  );
});
