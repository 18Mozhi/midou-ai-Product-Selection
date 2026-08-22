import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CompetitorServiceError,
  validateCompetitor,
  validateRule,
  validateSnapshot,
} from "../../apps/api/dist/competitor-service.js";

const snapshot = {
  current_price: 29.99,
  currency: "usd",
  rank_value: 124,
  review_count: 802,
  rating_value: 4.6,
  availability: "in_stock",
  captured_at: new Date().toISOString(),
  freshness: "fresh",
  source_status: "healthy",
  source_ref_id: "amazon-us:B0TEST:20260808T1200",
  evidence_id: "00000000-0000-4000-8000-000000000505",
};
test("M04-05.A01/A02/A04/A12 requires identity provenance metrics and explicit thresholds", () => {
  const value = validateCompetitor({
    provider_id: "00000000-0000-4000-8000-000000000501",
    market: "us",
    source_site: "Amazon US",
    external_id: "B0TEST",
    product_url: "https://example.test/product/B0TEST",
    title: "来源商品",
    snapshot,
  });
  assert.equal(value.market, "US");
  assert.equal(value.snapshot.currency, "USD");
  assert.throws(
    () => validateSnapshot({ ...snapshot, evidence_id: "" }),
    (e) => e instanceof CompetitorServiceError && e.code === "competitor_input_invalid",
  );
  assert.equal(
    validateRule({ metric: "price", direction: "decrease", threshold_value: 2 }).threshold_value,
    2,
  );
  assert.equal(
    validateRule({ metric: "availability", direction: "became_unavailable" }).threshold_value,
    null,
  );
  assert.throws(
    () => validateRule({ metric: "availability", direction: "increase" }),
    (e) => e instanceof CompetitorServiceError && e.code === "competitor_rule_invalid",
  );
});
test("M04-05.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const paths = [
    "database/migrations/0017e_competitor_monitoring_m04_05.up.sql",
    "database/migrations/0017e_competitor_monitoring_m04_05.down.sql",
    "apps/api/src/competitor-service.ts",
    "apps/api/src/mysql-competitor-repository.ts",
    "apps/api/src/competitor-routes.ts",
    "apps/worker/src/competitor-monitor-worker.ts",
    "apps/web/src/components/CompetitorMonitor.vue",
    "apps/web/src/competitor.css",
    "config/schema.json",
    "config/env.example",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "docs/architecture/m04-05-competitor-monitoring.md",
    "docs/runbooks/m04-05-competitor-monitoring.md",
    "tests/e2e/m04-05-competitors.spec.ts",
    "scripts/verify-competitors-live.mjs",
    "new-product-enterprise-blueprint.md",
  ];
  const v = await Promise.all(paths.map((p) => readFile(p, "utf8"))),
    [
      up,
      down,
      service,
      repository,
      routes,
      worker,
      ui,
      css,
      schema,
      env,
      openapi,
      feature,
      architecture,
      runbook,
      e2e,
      live,
      blueprint,
    ] = v;
  assert.match(
    up,
    /competitors[\s\S]*competitor_snapshots[\s\S]*competitor_changes[\s\S]*competitor_alerts/,
  );
  assert.match(down, /DROP TABLE IF EXISTS `competitors`/);
  assert.match(service, /validateSnapshot[\s\S]*validateRule/);
  assert.match(repository, /competitor_snapshot_jobs[\s\S]*competitor_provider_not_approved/);
  assert.match(routes, /competitor:manage[\s\S]*monitor-rules/);
  assert.match(worker, /impact_explanation[\s\S]*dead_letter/);
  for (const state of ["loading", "ready", "empty", "error", "expired", "forbidden", "blocked"])
    assert.match(ui, new RegExp(state));
  assert.match(ui, /基线快照[\s\S]*当前快照[\s\S]*生效阈值/);
  assert.match(ui, /changeCurrency[\s\S]*changed_at/);
  assert.match(ui, /添加竞品步骤[\s\S]*商品链接[\s\S]*市场信息[\s\S]*确认采集/);
  assert.match(ui, /价格与库存时间轴/);
  assert.match(ui, /当前竞品规则[\s\S]*删除竞品监控/);
  assert.match(ui, /告警、任务与结论时间轴[\s\S]*系统告警[\s\S]*系统任务[\s\S]*结论/);
  assert.match(repository, /change_id:[\s\S]*rule_id:[\s\S]*notification_status/);
  assert.match(ui, /createValidationTask/);
  assert.match(ui, /生成验证任务/);
  assert.match(ui, /打开验证任务/);
  assert.match(css, /competitor-comparison[\s\S]*@media\s*\(\s*max-width:\s*820px\s*\)/);
  assert.match(schema, /COMPETITOR_MONITOR_POLL_MS/);
  assert.match(env, /COMPETITOR_MONITOR_LEASE_SECONDS/);
  assert.match(openapi, /competitor-monitor-rules/);
  assert.match(feature, /competitorMonitoring[\s\S]*pageFlow/);
  assert.match(architecture, /不可变快照[\s\S]*MySQL 5\.7/);
  assert.match(runbook, /宝塔[\s\S]*回滚/);
  assert.match(e2e, /基线、变动与阈值[\s\S]*toBeVisible/);
  assert.match(live, /threshold_alert/);
  assert.match(blueprint, /M04-05 实现合同/);
});
