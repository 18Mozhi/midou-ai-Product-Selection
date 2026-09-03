import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeTrendTitle,
  TrendService,
  TrendServiceError,
  validateMonitoringRuleInput,
} from "../../apps/api/dist/trend-service.js";
import {
  buildSupplierSearchQuery,
  isAutomaticProductDiscoveryProvider,
  normalizeProjectedTrendTitle,
  projectedTrendProviderContext,
  TrendProjectionError,
} from "../../apps/worker/dist/trend-projection-worker.js";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlTrendRepository } from "../../apps/api/dist/mysql-trend-repository.js";

const ids = {
  org: "00000000-0000-4000-8000-000000000401",
  ws: "00000000-0000-4000-8000-000000000402",
  actor: "00000000-0000-4000-8000-000000000403",
  topic: "00000000-0000-4000-8000-000000000404",
  rule: "00000000-0000-4000-8000-000000000405",
};
const ruleInput = {
  name: "AI 护肤观察",
  include_keywords: ["AI skincare"],
  negative_keywords: [],
  market: "US",
  language: "en-US",
  category: "beauty",
  notification_channel: "in_app",
};

test("M04-01.A02/A12 title and monitoring contracts normalize without inventing metrics", () => {
  assert.equal(normalizeTrendTitle("  AI  Skin Care  "), "ai skin care");
  assert.equal(normalizeProjectedTrendTitle("  AI  Skin Care  "), "ai skin care");
  assert.deepEqual(validateMonitoringRuleInput(ruleInput).include_keywords, ["ai skincare"]);
  assert.equal(validateMonitoringRuleInput(ruleInput).collection_interval_minutes, 60);
  assert.equal(validateMonitoringRuleInput(ruleInput).recommendation_min_source_count, 1);
  assert.throws(
    () => validateMonitoringRuleInput({ ...ruleInput, collection_interval_minutes: 5 }),
    (error) => error instanceof TrendServiceError && error.code === "trend_rule_interval_invalid",
  );
  assert.throws(
    () => validateMonitoringRuleInput({ ...ruleInput, recommendation_min_source_count: 0 }),
    (error) =>
      error instanceof TrendServiceError && error.code === "trend_rule_source_threshold_invalid",
  );
  assert.throws(
    () => validateMonitoringRuleInput({ ...ruleInput, include_keywords: [] }),
    (error) => error instanceof TrendServiceError && error.code === "trend_rule_keywords_invalid",
  );
  assert.throws(
    () => validateMonitoringRuleInput({ ...ruleInput, notification_channel: "email" }),
    (error) =>
      error instanceof TrendServiceError && error.code === "trend_rule_channel_unavailable",
  );
  assert.throws(
    () => normalizeProjectedTrendTitle(""),
    (error) =>
      error instanceof TrendProjectionError &&
      error.code === "trend_title_invalid" &&
      !error.retryable,
  );
});

test("M04-01 automatic hotspot channels project real markets and only product channels discover candidates", () => {
  assert.deepEqual(projectedTrendProviderContext("gnews_jp_amazon"), {
    accepted: true,
    automatic: true,
    market: "JP",
    language: "ja-JP",
    category: "ecommerce",
  });
  assert.deepEqual(projectedTrendProviderContext("gnews_gb_consumer_trends"), {
    accepted: true,
    automatic: true,
    market: "GB",
    language: "en-GB",
    category: "news",
  });
  assert.deepEqual(projectedTrendProviderContext("google_news_search"), {
    accepted: true,
    automatic: false,
    market: "US",
    language: "en-US",
    category: null,
  });
  assert.deepEqual(projectedTrendProviderContext("amazon_product"), {
    accepted: true,
    automatic: true,
    market: "US",
    language: "en-US",
    category: "ecommerce",
  });
  assert.deepEqual(projectedTrendProviderContext("page_amazon_bestsellers_us"), {
    accepted: true,
    automatic: true,
    market: "US",
    language: "en-US",
    category: "ecommerce",
  });
  assert.equal(projectedTrendProviderContext("feed_reddit_buyitforlife").accepted, true);
  assert.equal(isAutomaticProductDiscoveryProvider("page_amazon_bestsellers_us"), true);
  assert.equal(isAutomaticProductDiscoveryProvider("page_ebay_deals_us"), true);
  assert.equal(isAutomaticProductDiscoveryProvider("feed_reddit_buyitforlife"), false);
  assert.equal(isAutomaticProductDiscoveryProvider("gnews_us_viral_products"), true);
  assert.equal(isAutomaticProductDiscoveryProvider("gnews_jp_amazon"), true);
  assert.equal(isAutomaticProductDiscoveryProvider("gnews_gb_new_products"), true);
  assert.equal(isAutomaticProductDiscoveryProvider("gnews_us_consumer_trends"), false);
  assert.equal(isAutomaticProductDiscoveryProvider("gnews_us_retail_data"), false);
  assert.equal(isAutomaticProductDiscoveryProvider("google_news_search"), false);
});

test("M04-01 supplier discovery derives auditable generic product keywords", () => {
  assert.equal(
    buildSupplierSearchQuery("Amazon Basics 2-Ply Soft Toilet Paper, 30 Rolls"),
    "toilet paper",
  );
  assert.equal(
    buildSupplierSearchQuery("Apple AirPods Pro 3 Wireless Earbuds with Active Noise Cancellation"),
    "wireless earbuds",
  );
  assert.equal(
    buildSupplierSearchQuery("Mighty Patch Original Hydrocolloid Acne Patches, 36 Ct"),
    "hydrocolloid acne patches",
  );
  assert.equal(
    buildSupplierSearchQuery("Generic Foldable Storage Organizer, Large Blue"),
    "Generic Foldable Storage Organizer",
  );
});

test("M04-01 source timeline groups real provider points without client attribution", async () => {
  const at = "2026-08-07T14:00:00.000Z",
    source = "00000000-0000-4000-8000-000000000407",
    responses = [
      [
        [
          {
            id: ids.topic,
            title: "AI skincare",
            category: "beauty",
            market: "US",
            language: "en-US",
            status: "active",
            signal_count: 2,
            source_count: 1,
            heat_value: 2,
            momentum_percent: null,
            confidence_score: null,
            confidence_status: "insufficient_data",
            first_seen_at: at,
            last_seen_at: at,
            source_fresh_at: at,
            followed: 0,
            version: 1,
          },
        ],
        [],
      ],
      [[], []],
      [[], []],
      [[{ at, signal_count: 2, source_count: 1 }], []],
      [[{ provider_id: source, source_label: "Example News", at, signal_count: 2 }], []],
      [
        [
          {
            actor_id: ids.actor,
            payload_json: JSON.stringify({
              status: "irrelevant",
              reason: "与当前品类无关",
              version: 2,
            }),
            occurred_at: at,
          },
        ],
        [],
      ],
    ],
    pool = { query: async () => responses.shift() };
  const result = await new MySqlTrendRepository(pool).get({
    organizationId: ids.org,
    workspaceId: ids.ws,
    actorId: ids.actor,
    topicId: ids.topic,
  });
  assert.deepEqual(result.timeline_sources, [
    { source_id: source, source_label: "Example News", points: [{ at, signal_count: 2 }] },
  ]);
  assert.deepEqual(result.timeline, [{ at, signal_count: 2, source_count: 1 }]);
  assert.deepEqual(result.relevance_history, [
    {
      status: "irrelevant",
      reason: "与当前品类无关",
      actor_id: ids.actor,
      version: 2,
      occurred_at: at,
    },
  ]);
});

test("M04-01.A04/A06/A09 service validates pagination versions and scoped writes", async () => {
  const calls = [];
  const repository = {
    async list(input) {
      calls.push(["list", input]);
      return { items: [], total: 0 };
    },
    async get() {
      return null;
    },
    async listRules() {
      return [];
    },
    async listChangeRequests(input) {
      calls.push(["listChangeRequests", input]);
      return [];
    },
    async proposeTopicChange(input) {
      calls.push(["proposeTopicChange", input]);
      return { id: input.requestIdValue, status: "pending", version: 1 };
    },
    async decideTopicChange(input) {
      calls.push(["decideTopicChange", input]);
      return { id: input.changeRequestId, status: `${input.decision}ed`, version: 2 };
    },
    async setFollow(input) {
      calls.push(["follow", input]);
      return { topic_id: input.topicId, followed: input.followed };
    },
    async setRelevance(input) {
      calls.push(["relevance", input]);
      return { topic_id: input.topicId, status: input.status, version: input.expectedVersion + 1 };
    },
    async createRule(input) {
      calls.push(["createRule", input]);
      return {
        id: input.ruleId,
        ...input.rule,
        status: "enabled",
        last_evaluated_at: null,
        version: 1,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      };
    },
    async updateRule(input) {
      calls.push(["updateRule", input]);
      return {
        id: input.ruleId,
        ...ruleInput,
        include_keywords: ["ai skincare"],
        status: input.status,
        last_evaluated_at: null,
        version: input.expectedVersion + 1,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      };
    },
  };
  const service = new TrendService(repository),
    scope = { organizationId: ids.org, workspaceId: ids.ws, actorId: ids.actor },
    write = {
      ...scope,
      requestId: "request-m04",
      traceId: "trace-m04",
      idempotencyKey: "idem-m04",
    };
  await service.list({ ...scope, page: 1, pageSize: 20, query: " AI " });
  assert.equal(calls[0][1].query, "AI");
  await service.follow({ ...write, topicId: ids.topic, followed: true });
  assert.match(calls[1][1].route, /PUT:.*follow/);
  await service.relevance({
    ...write,
    topicId: ids.topic,
    status: "irrelevant",
    reason: "not relevant",
    expectedVersion: 2,
  });
  assert.equal(calls[2][1].expectedVersion, 2);
  const created = await service.createRule({ ...write, rule: ruleInput });
  assert.equal(created.status, "enabled");
  await service.updateRule({ ...write, ruleId: ids.rule, status: "paused", expectedVersion: 1 });
  await service.listChangeRequests({ ...scope, status: "pending" });
  await service.proposeTopicChange({
    ...write,
    value: {
      operation: "split",
      target_topic_id: ids.topic,
      source_topic_ids: [],
      signal_ids: [ids.rule],
      new_title: "AI 护肤设备",
      new_category: "beauty",
      expected_versions: { [ids.topic]: 2 },
      reason: "证据属于不同商品方向",
    },
  });
  await service.decideTopicChange({
    ...write,
    changeRequestId: ids.rule,
    value: { decision: "confirm", reason: "证据边界已复核", expected_version: 1 },
  });
  assert.equal(calls.at(-2)[1].signalIds[0], ids.rule);
  assert.equal(calls.at(-1)[1].decision, "confirm");
  assert.throws(
    () =>
      service.proposeTopicChange({
        ...write,
        value: {
          operation: "split",
          target_topic_id: ids.topic,
          source_topic_ids: [],
          signal_ids: [ids.rule],
          expected_versions: { [ids.topic]: 2 },
          reason: "缺少新主题名",
        },
      }),
    (error) => error instanceof TrendServiceError && error.code === "trend_input_invalid",
  );
  assert.throws(
    () => service.list({ ...scope, page: 0, pageSize: 20 }),
    /trend_pagination_invalid/,
  );
  await assert.rejects(
    () => service.get({ ...scope, topicId: ids.topic }),
    (error) => error instanceof TrendServiceError && error.code === "trend_topic_not_found",
  );
});

test("M04-01.A06/A09/A13 API derives tenant scope and enforces origin plus idempotency", async () => {
  const calls = [],
    service = {
      list: async (input) => (calls.push(["list", input]), { items: [], total: 0 }),
      listRules: async (input) => (calls.push(["rules", input]), []),
      listChangeRequests: async (input) => (calls.push(["changeRequests", input]), []),
      get: async () => ({}),
      follow: async (input) => (
        calls.push(["follow", input]),
        { topic_id: input.topicId, followed: true }
      ),
      relevance: async () => ({}),
      createRule: async () => ({}),
      updateRule: async () => ({}),
    },
    authorization = {
      resolveSession: async () => ({ context: { organization_id: ids.org, workspace_id: ids.ws } }),
      authorize: async (input) => calls.push(["authorize", input]),
    },
    auth = { authenticate: async () => ({ user: { id: ids.actor }, session: { id: "session" } }) },
    app = buildApp({
      trends: {
        service,
        authorization,
        auth,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
      },
    });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/trends?page=1&page_size=20",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "trend-read",
      "x-trace-id": "trend-trace",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().request_id, "trend-read");
  assert.equal(calls[0][1].capability, "trend:read");
  assert.equal(calls[1][1].organizationId, ids.org);
  assert.equal(calls[1][1].workspaceId, ids.ws);
  response = await app.inject({
    method: "GET",
    url: "/api/v1/trends/monitoring-rules",
    headers: { cookie: "scoutops_session=test" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.filter(([name]) => name === "authorize").at(-1)[1].capability, "trend:read");
  response = await app.inject({
    method: "GET",
    url: "/api/v1/trends/change-requests",
    headers: { cookie: "scoutops_session=test" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.filter(([name]) => name === "authorize").at(-1)[1].capability, "trend:manage");
  response = await app.inject({
    method: "PUT",
    url: `/api/v1/trends/${ids.topic}/follow`,
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "follow-api",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.at(-1)[1].idempotencyKey, "follow-api");
  const forbidden = await app.inject({
    method: "PUT",
    url: `/api/v1/trends/${ids.topic}/follow`,
    headers: {
      cookie: "scoutops_session=test",
      origin: "https://evil.test",
      "idempotency-key": "blocked",
    },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "origin_forbidden");
  const missing = await app.inject({
    method: "PUT",
    url: `/api/v1/trends/${ids.topic}/follow`,
    headers: { cookie: "scoutops_session=test", origin: "http://127.0.0.1:5173" },
  });
  assert.equal(missing.statusCode, 400);
  await app.close();
});

test("M04-01.A03/A05-A11/A13-A17 delivery evidence covers the complete module", async () => {
  const paths = [
    "database/migrations/0017a_trends_m04_01.up.sql",
    "database/migrations/0017a_trends_m04_01.down.sql",
    "database/migrations/0064_governed_workflow_confirmations.up.sql",
    "apps/worker/src/trend-projection-worker.ts",
    "apps/worker/src/trend-projection-calculation.ts",
    "apps/worker/src/trend-projection-persistence.ts",
    "apps/worker/src/trend-projection-alerts.ts",
    "apps/api/src/trend-service.ts",
    "apps/api/src/mysql-trend-repository.ts",
    "apps/api/src/trend-routes.ts",
    "apps/web/src/components/TrendDashboard.vue",
    "apps/web/src/components/TrendFilterPanel.vue",
    "apps/web/src/components/TrendDetailPanel.vue",
    "apps/web/src/components/TrendEvidenceTimeline.vue",
    "apps/web/src/components/TrendChangeQueue.vue",
    "apps/web/src/components/trend-workspace-types.ts",
    "config/schema.json",
    "config/env.example",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "docs/architecture/m04-01-trends-monitoring.md",
    "docs/runbooks/m04-01-trends-monitoring.md",
    "tests/e2e/m04-01-trends.spec.ts",
    "scripts/verify-trends-live.mjs",
    "new-product-enterprise-blueprint.md",
  ];
  const values = await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    [
      up,
      down,
      governanceUp,
      worker,
      calculation,
      persistence,
      alerts,
      service,
      repository,
      routes,
      web,
      filterPanel,
      detailPanel,
      evidenceTimeline,
      changeQueue,
      webTypes,
      schema,
      env,
      openapi,
      feature,
      architecture,
      runbook,
      e2e,
      live,
      blueprint,
    ] = values;
  const projectionSurface = `${calculation}\n${persistence}\n${alerts}\n${worker}`;
  assert.match(
    up,
    /trend_topics[\s\S]*trend_projection_jobs[\s\S]*trend_events[\s\S]*trend_outbox[\s\S]*trend:manage/,
  );
  assert.match(governanceUp, /trend_topic_change_requests[\s\S]*opportunity_cost_input_reviews/);
  assert.match(down, /DROP TABLE IF EXISTS `trend_topics`/);
  assert.match(worker, /succeeded_empty[\s\S]*failed_terminal[\s\S]*dead_letter/);
  assert.match(service, /timeline_sources[\s\S]*insufficient_data/);
  assert.match(repository, /GROUP BY provider_id[\s\S]*timeline_sources/);
  assert.match(repository, /organization_id=\?[\s\S]*workspace_id=\?/);
  assert.match(
    repository,
    /trend_change_self_confirmation_forbidden[\s\S]*trend_change_opportunity_conflict/,
  );
  assert.match(routes, /trend:read[\s\S]*trend:manage/);
  const webSurface = `${webTypes}\n${web}\n${filterPanel}\n${detailPanel}\n${evidenceTimeline}\n${changeQueue}`;
  assert.match(
    webSurface,
    /loading[\s\S]*ready[\s\S]*empty[\s\S]*error[\s\S]*expired[\s\S]*forbidden[\s\S]*blocked/,
  );
  assert.match(webSurface, /来源筛选[\s\S]*timeline_sources/);
  assert.match(webSurface, /相关性回溯/);
  assert.match(webSurface, /合并主题[\s\S]*拆分主题[\s\S]*待确认/);
  assert.match(web, /变更原因/);
  assert.match(web, /下次采集[\s\S]*上次失败来源/);
  assert.match(webSurface, /个来源[\s\S]*新鲜度[\s\S]*可信度/);
  assert.match(schema, /TREND_PROJECTION_POLL_MS/);
  assert.match(env, /TREND_PROJECTION_LEASE_SECONDS/);
  assert.match(openapi, /\/trends\/\{topicId\}\/follow:[\s\S]*timeline_sources/);
  assert.match(
    openapi,
    /\/trends\/change-requests:[\s\S]*\/trends\/change-requests\/\{requestId\}\/decisions:/,
  );
  assert.match(feature, /trendDomain[\s\S]*timelineFilter/);
  assert.match(architecture, /heat[\s\S]*signals/);
  assert.match(runbook, /宝塔[\s\S]*回滚/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(live, /MySqlTrendProjectionWorker/);
  assert.match(blueprint, /M04-01 实现合同/);
  assert.match(
    projectionSurface,
    /isAutomaticProductDiscoveryProvider[\s\S]*opportunity\.candidate\.discovered/,
  );
  assert.match(
    persistence,
    /enqueueMissingAutomaticDownstream[\s\S]*competitor_snapshot[\s\S]*sourcing_search/,
  );
  assert.match(
    persistence,
    /competitor\.collection\.auto_scheduled[\s\S]*sourcing\.collection\.auto_scheduled/,
  );
  assert.match(persistence, /CONVERT\(o\.id USING utf8mb4\) COLLATE utf8mb4_bin/);
  assert.match(persistence, /CONVERT\(c\.id USING utf8mb4\) COLLATE utf8mb4_bin/);
  assert.match(
    persistence,
    /supplierTaskId = supplierProviderIds\.length \? randomUUID\(\) : job\.collectionTaskId[\s\S]*scheduleCoreCollection[\s\S]*INSERT INTO sourcing_searches/,
  );
  assert.match(
    persistence,
    /const ruleRecommendation = await refreshRuleRecommendation[\s\S]*recommendation_status: ruleRecommendation\.changed[\s\S]*ruleRecommendation\.recommendationStatus/,
  );
  assert.doesNotMatch(
    persistence,
    /INSERT INTO sourcing_searches[\s\S]{0,800}job\.workspaceId,\s*null,\s*opportunityId/,
  );
  assert.match(
    persistence,
    /page_url: String\(row\.product_url\)[\s\S]*query: buildSupplierSearchQuery\(String\(row\.name\)\)/,
  );
  assert.match(persistence, /page_url: canonicalUrl/);
  assert.match(persistence, /query: buildSupplierSearchQuery\(title\)/);
  assert.match(
    persistence,
    /CHAR_LENGTH\(JSON_UNQUOTE\(JSON_EXTRACT\(q\.target_json,'\$\.query'\)\)\) BETWEEN 1 AND 300/,
  );
  assert.match(persistence, /query_contract[\s\S]*supplier-keywords-v2/);
  assert.match(persistence, /input_ref,status[\s\S]*'opportunity'[\s\S]*'queued'/);
  assert.match(
    alerts,
    /evaluateMonitoringRules[\s\S]*trend\.monitoring_rule\.matched[\s\S]*last_evaluated_at/,
  );
  assert.match(calculation, /calculateTrendProjection[\s\S]*topicKey/);
  assert.match(persistence, /class TrendProjectionPersistence[\s\S]*beginTransaction/);
  assert.match(alerts, /class TrendProjectionAlerts[\s\S]*trend_outbox/);
  assert.match(worker, /class MySqlTrendProjectionWorker[\s\S]*this\.persistence\.project\(job\)/);
  assert.match(openapi, /商品型自动热点频道[\s\S]*待评估选品/);
  assert.match(feature, /automaticProductDiscovery/);
  assert.match(architecture, /商品型热点频道[\s\S]*待评估选品/);
  assert.match(runbook, /自动发现选品[\s\S]*回滚/);
  assert.match(web, /route\.query\.topic[\s\S]*saveViewLink[\s\S]*清除筛选并恢复/);
  assert.match(feature, /navigationState[\s\S]*layoutBoundary/);
  assert.match(architecture, /sort[\s\S]*topic[\s\S]*section/);
  assert.match(runbook, /复制后的视图链接[\s\S]*清除筛选并恢复/);
});
