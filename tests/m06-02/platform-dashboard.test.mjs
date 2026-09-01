import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PlatformDashboardService,
  PlatformDashboardError,
} from "../../apps/api/dist/platform-dashboard-service.js";
import { MySqlPlatformDashboardRepository } from "../../apps/api/dist/mysql-platform-dashboard-repository.js";
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
test("M06-02 dashboard repository separates read queries by factual metric domain", async () => {
  const [repository, scale, collection, risk, storage] = await Promise.all(
    [
      "apps/api/src/mysql-platform-dashboard-repository.ts",
      "apps/api/src/mysql-platform-dashboard-scale-metrics.ts",
      "apps/api/src/mysql-platform-dashboard-collection-metrics.ts",
      "apps/api/src/mysql-platform-dashboard-risk-metrics.ts",
      "apps/api/src/mysql-platform-dashboard-storage-metrics.ts",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const reader of [
    "readPlatformScaleMetrics",
    "readPlatformCollectionMetrics",
    "readPlatformRiskMetrics",
    "readPlatformStorageMetrics",
  ])
    assert.match(repository, new RegExp(reader));
  assert.match(scale, /organizations[\s\S]*users[\s\S]*providers/);
  assert.doesNotMatch(scale, /collection_tasks|data_quality_issues|file_assets/);
  assert.match(collection, /collection_tasks[\s\S]*collection_subqueries/);
  assert.doesNotMatch(collection, /data_quality_issues|file_assets/);
  assert.match(risk, /data_quality_issues[\s\S]*platform_audit_events/);
  assert.doesNotMatch(risk, /file_assets/);
  assert.match(storage, /growth_bytes[\s\S]*file_assets/);
  assert.doesNotMatch(`${scale}\n${collection}\n${risk}\n${storage}`, /INSERT|UPDATE|DELETE/);
});
test("M06-02 metric modules preserve dashboard aggregation and correlated read audit", async () => {
  const writes = [],
    rows = (value) => [value, []],
    pool = {
      async query(sql) {
        const text = String(sql);
        if (text.includes("FROM organizations")) return rows([{ total: 2 }]);
        if (text.includes("FROM users")) return rows([{ total: 5 }]);
        if (text.includes("COUNT(*) total FROM providers")) return rows([{ total: 3 }]);
        if (
          text.includes("success_count") &&
          text.includes("FROM collection_tasks WHERE updated_at")
        )
          return rows([{ success_count: 3, failed_count: 1, queue_backlog: 4, expired_leases: 1 }]);
        if (text.includes("GROUP BY status ORDER BY status"))
          return rows([{ status: "running", total: 4 }]);
        if (text.includes("FROM providers p LEFT JOIN collection_subqueries"))
          return rows([
            {
              id: "provider-1",
              code: "source-1",
              name: "来源一",
              observed_count: 2,
              success_count: 2,
              failed_count: 0,
              last_observed_at: "2026-08-22T08:00:00.000Z",
            },
          ]);
        if (text.includes("DATE_FORMAT(updated_at"))
          return rows([{ bucket: "2026-08-22 08:00:00", succeeded: 3, failed: 1 }]);
        if (text.includes("critical_count FROM data_quality_issues"))
          return rows([{ open_count: 2, critical_count: 1 }]);
        if (text.includes("'quality' kind")) return rows([]);
        if (text.includes("FROM platform_audit_events ORDER BY")) return rows([]);
        if (text.includes("FROM file_assets"))
          return rows([{ total_bytes: 4096, growth_bytes: 1024 }]);
        throw new Error(`unexpected dashboard query: ${text}`);
      },
      async getConnection() {
        return {
          async beginTransaction() {},
          async query(sql, params) {
            writes.push({ sql: String(sql), params });
            return rows([]);
          },
          async commit() {},
          async rollback() {},
          release() {},
        };
      },
    },
    now = new Date("2026-08-22T10:00:00.000Z"),
    repository = new MySqlPlatformDashboardRepository(pool, 4, 20, () => now),
    result = await repository.read({
      actorId: "actor",
      window: "24h",
      windowMinutes: 1440,
      requestId: "request",
      traceId: "trace",
    });
  assert.deepEqual(result.summary, {
    active_organizations: 2,
    active_users: 5,
    enabled_providers: 3,
    task_success_rate: 75,
    queue_backlog: 4,
    open_alerts: 4,
    storage_bytes: 4096,
    file_growth_bytes: 1024,
  });
  assert.equal(result.provider_health[0].status, "healthy");
  assert.equal(result.health_signals.find((item) => item.code === "queue").status, "warning");
  assert.equal(writes.length, 2);
  assert.match(writes[0].sql, /platform_dashboard_views/);
  assert.match(writes[1].sql, /platform\.dashboard\.read/);
});
test("M06-02.A06/A07/A08/A10/A13/A17 contracts frontend config and handoff stay synchronized", async () => {
  const [openapi, web, styles, env, schema, architecture, runbook, feature] = await Promise.all(
    [
      "docs/openapi.yaml",
      "apps/web/src/components/PlatformDashboard.vue",
      "apps/web/src/styles/platform-dashboard.css",
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
test("M06-02 platform overview gives administrators clear next actions", async () => {
  const [web, styles] = await Promise.all([
    readFile("apps/web/src/components/PlatformDashboard.vue", "utf8"),
    readFile("apps/web/src/styles/platform-dashboard.css", "utf8"),
  ]);
  for (const copy of [
    "平台运行概览",
    "待办与常用入口",
    "系统会自动获取热点",
    "管理组织和用户",
    "查看热点来源",
    "查看采集进度",
    "等待处理",
    "稍后重试",
    "数据库",
    "任务队列",
    "数据质量",
    "平台事实",
    "活跃组织",
    "活跃用户",
    "启用来源",
    "任务成功率",
    "窗内文件增长",
    "过期任务租约",
    "采集任务问题",
  ])
    assert.match(web, new RegExp(copy));
  assert.match(
    web,
    /v-if="capabilities\?\.includes\(["']platform:superadmin["']\)"[\s\S]*管理组织和用户/,
  );
  for (const path of [
    "/platform-admin/organizations",
    "/platform-admin/providers/sources",
    "/platform-admin/collection/overview",
  ])
    assert.match(web, new RegExp(path.replaceAll("/", "\\/")));
  assert.match(web, /route\.query\.window/);
  assert.match(web, /router\.replace\([\s\S]*window:\s*windowCode\.value/);
  assert.match(web, /if \(pending\.value\) return/);
  assert.match(web, /刷新超过 12 秒，继续显示上一份观测结果/);
  assert.match(styles, /\.platform-facts[\s\S]*grid-template-columns:\s*repeat\(5/);
  assert.match(styles, /\.platform-refresh-feedback/);
  assert.doesNotMatch(
    web,
    /PLATFORM OPERATIONS \/ REAL FACTS|当前 active|enabled<\/small>|<span>\{\{s\.code\}\}<\/span>|<span>\{\{q\.status\}\}<\/span>/,
  );
});
test("M06-02 system status presents dependency topology and bounded propagation scope", async () => {
  const [web, statusLoad, topology, architecture, runbook, feature] = await Promise.all(
    [
      "apps/web/src/components/PlatformManagementCenter.vue",
      "apps/web/src/components/use-platform-status.ts",
      "apps/web/src/components/platform-status-topology.ts",
      "docs/architecture/m06-02-platform-dashboard.md",
      "docs/runbooks/m06-02-platform-dashboard.md",
      "docs/feature-map.json",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const copy of [
    "依赖拓扑与故障传播",
    "当前需核查的传播范围",
    "如异常持续",
    "实时连接退化",
    "SSE 重连率",
    "降级轮询次数",
    "仅统计当前浏览器标签页会话",
  ])
    assert.match(web, new RegExp(copy));
  for (const copy of ["访问入口", "共享依赖", "异步执行"]) assert.match(topology, new RegExp(copy));
  for (const serviceCode of ["api", "mysql", "redis", "files", "worker", "crawler"])
    assert.match(topology, new RegExp(`code: ["']${serviceCode}["']`));
  assert.match(web, /\["healthy", "ready"\]\.includes\(node\.status\)/);
  assert.match(web, /当前没有采集任务状态记录/);
  assert.match(web, /当前没有来源配置记录/);
  assert.match(statusLoad, /new AbortController\(\)/);
  assert.match(statusLoad, /15000/);
  assert.match(statusLoad, /if \(controller\) return true/);
  assert.match(statusLoad, /已保留上次成功数据/);
  assert.doesNotMatch(statusLoad, /options\.data\.value\s*=\s*null/);
  assert.match(architecture, /依赖拓扑与故障传播/);
  assert.match(architecture, /当前浏览器标签页会话[\s\S]*重连率[\s\S]*降级轮询次数/);
  assert.match(runbook, /当前需核查的传播范围/);
  assert.match(runbook, /当前浏览器标签页会话[\s\S]*重连率[\s\S]*降级轮询/);
  assert.match(JSON.parse(feature).implementation.platformDashboard.scope, /dependency topology/);
  assert.match(JSON.parse(feature).implementation.platformDashboard.scope, /browser-tab SSE/);
  assert.match(
    JSON.parse(feature).implementation.platformDashboard.scope,
    /preserved status snapshot/,
  );
});
test("M06-02 chain logs group exact traces and deep-link persisted task or provider relations", async () => {
  const [repository, web, sourceCenter, openapi, architecture, runbook, feature] =
    await Promise.all(
      [
        "apps/api/src/mysql-platform-dashboard-repository.ts",
        "apps/web/src/components/PlatformLogCenter.vue",
        "apps/web/src/components/ProviderSourceCenter.vue",
        "docs/openapi.yaml",
        "docs/architecture/m06-02-platform-dashboard.md",
        "docs/runbooks/m06-02-platform-dashboard.md",
        "docs/feature-map.json",
      ].map((path) => readFile(path, "utf8")),
    );
  assert.match(repository, /collection_task_id[\s\S]*browser_collection_jobs/);
  assert.match(repository, /crawler_browser_runs r JOIN providers p ON p\.id=r\.provider_id/);
  for (const copy of ["调用链", "完整 trace_id", "查看关联任务", "查看关联来源"])
    assert.match(web, new RegExp(copy));
  assert.match(web, /groups\.get\(traceId\)/);
  assert.match(web, /new Date\(left\.occurred_at\)[\s\S]*new Date\(right\.occurred_at\)/);
  assert.match(sourceCenter, /route\.query\.provider_id[\s\S]*item\.provisioned\?\.id/);
  assert.match(openapi, /exact persisted collection task and provider association/);
  assert.match(architecture, /同一 `trace_id` 分组/);
  assert.match(runbook, /过滤后的来源页/);
  assert.match(JSON.parse(feature).implementation.platformDashboard.scope, /grouped by trace_id/);
  assert.match(web, /useRoute\(\)/);
  assert.match(web, /route\.query\.query/);
  assert.match(web, /route\.query\.source/);
  assert.match(web, /router\.replace/);
  assert.match(web, /重置/);
  assert.match(web, /new AbortController\(\)/);
  assert.match(web, /15000/);
  assert.match(web, /if \(controller\) return/);
  assert.match(web, /已保留上次成功日志/);
  assert.match(web, /logStatusName\(item\.status\)/);
  assert.match(web, /timed_out["']\s*\?\s*["']已超时/);
});

test("M06-02 chain-log reads reject unsupported runtime sources", async () => {
  const service = new PlatformDashboardService({ readManagement: async () => ({}) });
  assert.throws(
    () =>
      service.management({
        actorId: "actor",
        domain: "logs",
        status: "invalid-source",
        requestId: "request",
        traceId: "trace",
      }),
    (error) =>
      error instanceof PlatformDashboardError &&
      error.code === "platform_management_filter_invalid" &&
      error.statusCode === 400,
  );
});

test("M06-02 audited log export preserves the active production filters", async () => {
  const calls = [];
  const service = new PlatformDashboardService(
    { exportLogs: async (input) => (calls.push(input), { items: [] }) },
    "24h",
    () => new Date("2026-08-22T10:00:00.000Z"),
  );
  await service.exportLogs(
    { query: "trace-1", source: "crawler", reason: "生产故障排查" },
    {
      actorId: "actor",
      idempotencyKey: "log-export-key",
      requestId: "request",
      traceId: "trace",
    },
  );
  assert.equal(calls[0].query, "trace-1");
  assert.equal(calls[0].source, "crawler");
  assert.equal(calls[0].reason, "生产故障排查");
  assert.equal(calls[0].idempotencyKey, "log-export-key");
  assert.equal(calls[0].route, "/platform/management/logs/exports");
  assert.throws(
    () =>
      service.exportLogs(
        { query: "", source: "unknown", reason: "生产故障排查" },
        {
          actorId: "actor",
          idempotencyKey: "invalid-log-export-key",
          requestId: "request",
          traceId: "trace",
        },
      ),
    (error) =>
      error instanceof PlatformDashboardError &&
      error.code === "platform_management_filter_invalid",
  );
  const [repository, routes, web] = await Promise.all(
    [
      "apps/api/src/mysql-platform-dashboard-repository.ts",
      "apps/api/src/platform-dashboard-routes.ts",
      "apps/web/src/components/PlatformLogCenter.vue",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(repository, /platform\.logs\.export[\s\S]*row_count/);
  assert.match(repository, /idempotency_signature/);
  assert.match(repository, /idempotency_key_reused/);
  assert.match(repository, /GET_LOCK/);
  assert.match(routes, /platform\/management\/logs\/exports[\s\S]*text\/csv/);
  assert.match(routes, /platform\/management\/logs\/exports[\s\S]*requireIdempotencyKey/);
  assert.match(routes, /\^\[=\+\\-@\]/);
  assert.match(web, /导出当前筛选[\s\S]*填写日志导出原因/);
});
