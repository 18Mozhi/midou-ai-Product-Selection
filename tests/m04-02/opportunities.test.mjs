import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  OpportunityService,
  OpportunityServiceError,
  validateDecisionInput,
  validateOpportunityInput,
} from "../../apps/api/dist/opportunity-service.js";
import { buildApp } from "../../apps/api/dist/app.js";
const ids = {
  org: "00000000-0000-4000-8000-000000000421",
  ws: "00000000-0000-4000-8000-000000000422",
  actor: "00000000-0000-4000-8000-000000000423",
  opportunity: "00000000-0000-4000-8000-000000000424",
  topic: "00000000-0000-4000-8000-000000000425",
};
const summary = {
  id: ids.opportunity,
  name: "AI 护肤机会",
  market: "US",
  category: "beauty",
  source_type: "trend_topic",
  source_ref_id: ids.topic,
  owner_id: ids.actor,
  lifecycle_status: "candidate",
  recommendation_status: "insufficient_data",
  overall_score: null,
  trend_score: null,
  competition_score: null,
  profit_status: "insufficient_data",
  risk_level: "unknown",
  confidence: { status: "insufficient_data", score: null },
  evidence_count: 0,
  source_count: 0,
  coverage_status: "insufficient",
  decision_status: "pending",
  version: 1,
  updated_at: new Date(0).toISOString(),
};

test("M04-02.A01/A02/A12 creation and decisions validate inputs without inventing metrics", () => {
  const value = validateOpportunityInput({
    name: " AI 护肤机会 ",
    market: "us",
    category: "beauty",
    source_topic_id: ids.topic,
  });
  assert.equal(value.name, "AI 护肤机会");
  assert.equal(value.market, "US");
  assert.equal(value.source_topic_id, ids.topic);
  assert.deepEqual(
    validateDecisionInput({ action: "observe", reason: "补充成本后再判断", expected_version: 2 }),
    { action: "observe", reason: "补充成本后再判断", expected_version: 2 },
  );
  assert.throws(
    () => validateOpportunityInput({}),
    (error) =>
      error instanceof OpportunityServiceError && error.code === "opportunity_input_invalid",
  );
  assert.throws(
    () => validateDecisionInput({ action: "adopt", reason: "", expected_version: 1 }),
    (error) =>
      error instanceof OpportunityServiceError && error.code === "opportunity_input_invalid",
  );
});

test("M04-02.A04/A12 service enforces pagination, versions and scoped repository inputs", async () => {
  const calls = [],
    repository = {
      async list(input) {
        calls.push(["list", input]);
        return { items: [], total: 0 };
      },
      async get(input) {
        calls.push(["get", input]);
        return null;
      },
      async create(input) {
        calls.push(["create", input]);
        return summary;
      },
      async decide(input) {
        calls.push(["decide", input]);
        return {
          opportunity_id: input.opportunityId,
          decision_status: "observing",
          version: input.expectedVersion + 1,
          decision_id: ids.topic,
        };
      },
    },
    service = new OpportunityService(repository),
    scope = { organizationId: ids.org, workspaceId: ids.ws, actorId: ids.actor },
    write = {
      ...scope,
      requestId: "request-m0402",
      traceId: "trace-m0402",
      idempotencyKey: "idem",
    };
  await service.list({
    ...scope,
    page: 1,
    pageSize: 20,
    query: " AI ",
    selectionView: "recommended",
    coverageStatus: "partial",
    blockingReason: "evidence_insufficient",
  });
  assert.equal(calls[0][1].query, "AI");
  assert.equal(calls[0][1].selectionView, "recommended");
  assert.equal(calls[0][1].coverageStatus, "partial");
  assert.equal(calls[0][1].blockingReason, "evidence_insufficient");
  await service.create({
    ...write,
    value: { name: "AI 护肤机会", market: "US", source_topic_id: ids.topic },
  });
  assert.equal(calls[1][1].route, "POST:/api/v1/opportunities");
  await service.decide({
    ...write,
    opportunityId: ids.opportunity,
    value: { action: "observe", reason: "需要成本", expected_version: 1 },
  });
  assert.equal(calls[2][1].expectedVersion, 1);
  assert.throws(
    () => service.list({ ...scope, page: 0, pageSize: 20 }),
    /opportunity_pagination_invalid/,
  );
  assert.throws(
    () => service.list({ ...scope, page: 1, pageSize: 20, coverageStatus: "unknown" }),
    (error) =>
      error instanceof OpportunityServiceError && error.code === "opportunity_filter_invalid",
  );
  assert.throws(
    () => service.list({ ...scope, page: 1, pageSize: 20, blockingReason: "profit_unknown" }),
    (error) =>
      error instanceof OpportunityServiceError && error.code === "opportunity_filter_invalid",
  );
  assert.throws(
    () => service.list({ ...scope, page: 1, pageSize: 20, selectionView: "automatic" }),
    (error) =>
      error instanceof OpportunityServiceError && error.code === "opportunity_filter_invalid",
  );
  await assert.rejects(
    () => service.get({ ...scope, opportunityId: ids.opportunity }),
    (error) => error instanceof OpportunityServiceError && error.code === "opportunity_not_found",
  );
});

test("M04-02.A06/A09/A13 API derives scope and protects writes with origin and idempotency", async () => {
  const calls = [],
    service = {
      list: async (input) => (calls.push(["list", input]), { items: [], total: 0 }),
      get: async () => summary,
      create: async (input) => (calls.push(["create", input]), summary),
      decide: async (input) => (
        calls.push(["decide", input]),
        {
          opportunity_id: input.opportunityId,
          decision_status: "observing",
          version: 2,
          decision_id: ids.topic,
        }
      ),
    },
    authorization = {
      resolveSession: async () => ({ context: { organization_id: ids.org, workspace_id: ids.ws } }),
      authorize: async (input) => calls.push(["authorize", input]),
    },
    auth = { authenticate: async () => ({ user: { id: ids.actor }, session: { id: "session" } }) },
    app = buildApp({
      opportunities: {
        service,
        authorization,
        auth,
        secureCookie: false,
        webOrigin: "http://127.0.0.1:5173",
      },
    });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/opportunities?page=1&page_size=20&selection_view=recommended&coverage_status=partial&blocking_reason=recommendation_insufficient",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "opp-read",
      "x-trace-id": "opp-trace",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().request_id, "opp-read");
  assert.equal(calls[0][1].capability, "opportunity:read");
  assert.equal(calls[1][1].organizationId, ids.org);
  assert.equal(calls[1][1].selectionView, "recommended");
  assert.equal(calls[1][1].coverageStatus, "partial");
  assert.equal(calls[1][1].blockingReason, "recommendation_insufficient");
  response = await app.inject({
    method: "POST",
    url: "/api/v1/opportunities",
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "opp-create",
    },
    payload: { name: "AI 护肤机会", market: "US", source_topic_id: ids.topic },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(calls.at(-1)[1].idempotencyKey, "opp-create");
  const forbidden = await app.inject({
    method: "POST",
    url: "/api/v1/opportunities",
    headers: {
      cookie: "scoutops_session=test",
      origin: "https://evil.test",
      "idempotency-key": "blocked",
    },
    payload: { name: "x", market: "US" },
  });
  assert.equal(forbidden.statusCode, 403);
  const missing = await app.inject({
    method: "POST",
    url: "/api/v1/opportunities",
    headers: { cookie: "scoutops_session=test", origin: "http://127.0.0.1:5173" },
    payload: { name: "x", market: "US" },
  });
  assert.equal(missing.statusCode, 400);
  await app.close();
});

test("M04-02.A03/A05-A11/A13-A17 delivery evidence covers the complete module", async () => {
  const paths = [
    "database/migrations/0017b_opportunities_m04_02.up.sql",
    "database/migrations/0017b_opportunities_m04_02.down.sql",
    "apps/worker/src/opportunity-refresh-worker.ts",
    "apps/api/src/opportunity-service.ts",
    "apps/api/src/mysql-opportunity-repository.ts",
    "apps/api/src/opportunity-routes.ts",
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/OpportunityListPanel.vue",
    "apps/web/src/components/OpportunityDecisionPanel.vue",
    "apps/web/src/components/AutomaticSelectionReadinessPanel.vue",
    "apps/web/src/components/OpportunityEvidencePanel.vue",
    "apps/web/src/opportunities.css",
    "apps/web/src/automatic-selection.css",
    "config/schema.json",
    "config/env.example",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "docs/architecture/m04-02-opportunity-workspace.md",
    "docs/runbooks/m04-02-opportunity-workspace.md",
    "tests/e2e/m04-02-opportunities.spec.ts",
    "scripts/verify-opportunities-live.mjs",
    "new-product-enterprise-blueprint.md",
  ];
  const values = await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    [
      up,
      down,
      worker,
      service,
      repository,
      routes,
      web,
      listWeb,
      decisionWeb,
      readinessWeb,
      evidenceWeb,
      css,
      selectionCss,
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
  const detailInsightsWeb = await readFile(
    "apps/web/src/components/OpportunityDetailInsights.vue",
    "utf8",
  );
  assert.match(
    up,
    /opportunities[\s\S]*opportunity_decisions[\s\S]*opportunity_refresh_jobs[\s\S]*opportunity_events[\s\S]*opportunity_outbox/,
  );
  assert.match(down, /DROP TABLE IF EXISTS `opportunities`/);
  assert.match(worker, /succeeded_empty[\s\S]*failed_terminal[\s\S]*dead_letter/);
  assert.match(service, /coverageStatus[\s\S]*blockingReason/);
  assert.match(service, /OpportunitySelectionView[\s\S]*evidence_pending/);
  assert.match(
    repository,
    /selectionView === "recommended"[\s\S]*opportunityRecommendedSql[\s\S]*selectionView === "rule_candidates"[\s\S]*opportunityRuleCandidateSql/,
  );
  assert.match(routes, /coverage_status[\s\S]*blocking_reason/);
  assert.match(routes, /selection_view/);
  assert.match(routes, /lifecycle_status[\s\S]*owner_id/);
  assert.match(routes, /opportunities\/batch[\s\S]*evidence-completion-tasks/);
  assert.match(routes, /opportunity:decide/);
  const webContract = `${web}\n${listWeb}\n${decisionWeb}`;
  for (const state of ["loading", "ready", "empty", "error", "expired", "forbidden", "blocked"])
    assert.match(webContract, new RegExp(state));
  assert.match(webContract, /证据完整度[\s\S]*阻断原因[\s\S]*缺少可采纳证据/);
  assert.match(webContract, /待我采纳[\s\S]*规则命中候选[\s\S]*采集中[\s\S]*全部机会/);
  assert.match(listWeb, /已达到规则来源门槛，系统继续完成五项质量门校验/);
  assert.doesNotMatch(listWeb, /完成评分且结论为推荐/);
  assert.match(readinessWeb, /下一步：[\s\S]*查看五项配置状态/);
  assert.match(decisionWeb, /采纳建议[\s\S]*当前无需你处理[\s\S]*提前人工处理/);
  assert.match(decisionWeb, /补证阻断项/);
  assert.doesNotMatch(decisionWeb, /采纳前还缺/);
  assert.match(
    detailInsightsWeb,
    /达到来源门槛只进入规则命中候选[\s\S]*五项质量门全部通过后[\s\S]*建议采纳/,
  );
  assert.doesNotMatch(detailInsightsWeb, /达到来源门槛即可进入推荐/);
  assert.match(evidenceWeb, /证据新鲜度：观测于/);
  assert.match(webContract, /阶段[\s\S]*负责人[\s\S]*批量指派[\s\S]*批量复核[\s\S]*批量归档/);
  assert.match(webContract, /创建补采任务/);
  assert.match(web, /evidence-completion-tasks/);
  assert.match(webContract, /route\.query\.from[\s\S]*route\.query\.tab[\s\S]*applyListFilters/);
  assert.match(selectionCss, /opportunity-decision-actions[\s\S]*display:\s*flex/);
  assert.doesNotMatch(decisionWeb, /opportunity-decision-bar/);
  assert.match(css, /@media\s*\(\s*max-width:\s*640px\s*\)/);
  assert.match(schema, /OPPORTUNITY_REFRESH_POLL_MS/);
  assert.match(env, /OPPORTUNITY_REFRESH_LEASE_SECONDS/);
  assert.match(
    openapi,
    /name: coverage_status[\s\S]*name: blocking_reason[\s\S]*evidence_insufficient/,
  );
  assert.match(feature, /blocking_reason/);
  assert.match(feature, /navigationState[\s\S]*decisionLayout/);
  assert.match(architecture, /blocking_reasons/);
  assert.match(architecture, /opportunities\/batch[\s\S]*evidence_completion/);
  assert.match(architecture, /from[\s\S]*tab[\s\S]*人工决策区/);
  assert.match(runbook, /宝塔[\s\S]*回滚/);
  assert.match(runbook, /返回来源列表[\s\S]*tab=evidence/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(live, /MySqlOpportunityRefreshWorker/);
  assert.match(blueprint, /M04-02 实现合同/);
});

test("M04-02 live verification reuses an enabled production source without owning or deleting it", async () => {
  const live = await readFile("scripts/verify-opportunities-live.mjs", "utf8");
  assert.match(live, /sourceService\.list\(\)/);
  assert.match(live, /providerOwned/);
  assert.match(live, /created\.providerOwned\s*&&\s*created\.provider/);
  assert.match(live, /provider_source_existing_not_enabled/);
});
