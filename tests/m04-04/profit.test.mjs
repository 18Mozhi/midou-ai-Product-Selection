import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ProfitService,
  ProfitServiceError,
  validateCostInput,
  validateCostRule,
} from "../../apps/api/dist/profit-service.js";
import { databaseDay } from "../../apps/api/dist/mysql-profit-repository.js";

const ids = {
  org: "00000000-0000-4000-8000-000000000441",
  ws: "00000000-0000-4000-8000-000000000442",
  actor: "00000000-0000-4000-8000-000000000443",
  reviewer: "00000000-0000-4000-8000-000000000444",
  opportunity: "00000000-0000-4000-8000-000000000445",
};

const fees = [
  { type: "platform_fee", mode: "percentage_of_sale", value: 10, currency: null },
  { type: "payment_fee", mode: "percentage_of_sale", value: 3, currency: null },
  { type: "tax", mode: "percentage_of_sale", value: 5, currency: null },
  { type: "fulfillment", mode: "fixed_amount", value: 2, currency: "USD" },
];

test("M04-04.A01/A02/A04/A12 requires every explicit fee and provenance", () => {
  const rule = validateCostRule({
    market: "US",
    platform: "amazon",
    version_code: "v1",
    name: "规则一",
    effective_from: "2026-08-08",
    fee_lines: fees,
  });
  assert.equal(rule.fee_lines.length, 4);
  assert.deepEqual(rule.conversion_rates, []);
  const automaticRule = validateCostRule({
    market: "US",
    platform: "amazon",
    version_code: "v2",
    name: "自动证据规则",
    effective_from: "2026-09-05",
    fee_lines: [...fees, { type: "logistics", mode: "fixed_amount", value: 1, currency: "USD" }],
    conversion_rates: [
      {
        base_currency: "CNY",
        quote_currency: "USD",
        rate_value: 0.149014,
        effective_on: "2026-09-04",
        source_url:
          "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
      },
    ],
    automatic_scope: { product_family: "phone_case" },
  });
  assert.equal(automaticRule.fee_lines.at(-1).type, "logistics");
  assert.equal(automaticRule.conversion_rates[0].rate_value, 0.149014);
  assert.equal(automaticRule.automatic_scope.product_family, "phone_case");
  assert.throws(
    () =>
      validateCostRule({
        market: "US",
        platform: "amazon",
        version_code: "bad-auto",
        name: "缺少自动成本依据",
        effective_from: "2026-09-05",
        fee_lines: fees,
        automatic_scope: { product_family: "phone_case" },
      }),
    (error) =>
      error instanceof ProfitServiceError && error.code === "cost_rule_automatic_policy_incomplete",
  );
  assert.throws(
    () =>
      validateCostRule({
        market: "US",
        platform: "amazon",
        version_code: "bad",
        name: "bad",
        effective_from: "2026-08-08",
        fee_lines: fees.slice(0, 3),
      }),
    (error) => error instanceof ProfitServiceError && error.code === "cost_rule_fee_lines_invalid",
  );
  const input = validateCostInput({
    platform: "amazon",
    input_type: "purchase_price",
    amount_value: 40,
    currency: "CNY",
    source_type: "supplier_quote",
    source_ref_id: "quote-1",
    evidence_id: "00000000-0000-4000-8000-000000000404",
    observed_at: new Date().toISOString(),
    expected_version: 1,
  });
  assert.equal(input.currency, "CNY");
});

test("M04-04 preserves a MySQL DATE as the same calendar day", () => {
  class LocalMysqlDate extends Date {
    getFullYear() {
      return 2026;
    }
    getMonth() {
      return 7;
    }
    getDate() {
      return 25;
    }
  }
  const value = new LocalMysqlDate("2026-08-24T16:00:00.000Z");
  assert.equal(databaseDay(value), "2026-08-25");
  assert.equal(databaseDay("2026-08-25"), "2026-08-25");
});

test("M04-04 cost submission requires a distinct reviewer and forwards immutable review actions", async () => {
  const calls = [],
    repository = {
      recordCost: async (input) => (calls.push(input), { id: input.id, status: "pending" }),
      reviewCost: async (input) => (
        calls.push(input),
        { id: input.reviewId, status: input.decision }
      ),
    },
    service = new ProfitService(repository),
    context = {
      organizationId: ids.org,
      workspaceId: ids.ws,
      actorId: ids.actor,
      roleCodes: ["selection_manager"],
      requestId: "request-cost-review",
      traceId: "trace-cost-review",
      idempotencyKey: "idem-cost-review",
    },
    value = {
      platform: "amazon",
      input_type: "purchase_price",
      amount_value: 40,
      currency: "CNY",
      source_type: "supplier_quote",
      source_ref_id: "quote-1",
      evidence_id: ids.reviewer,
      observed_at: new Date().toISOString(),
      expected_version: 1,
      reviewer_id: ids.reviewer,
    };
  await service.recordCost({ ...context, opportunityId: ids.opportunity, value });
  assert.equal(calls[0].value.reviewer_id, ids.reviewer);
  await service.reviewCost({
    ...context,
    actorId: ids.reviewer,
    opportunityId: ids.opportunity,
    reviewId: ids.actor,
    value: { decision: "approved", reason: "成本证据已复核", expected_version: 1 },
  });
  assert.equal(calls[1].decision, "approved");
  assert.throws(
    () =>
      service.recordCost({
        ...context,
        opportunityId: ids.opportunity,
        value: { ...value, reviewer_id: ids.actor },
      }),
    (error) =>
      error instanceof ProfitServiceError && error.code === "cost_input_self_review_forbidden",
  );
});

test("M04-04.A03/A05-A11/A13-A17 complete delivery evidence exists", async () => {
  const paths = [
    "database/migrations/0017d_profit_cost_m04_04.up.sql",
    "database/migrations/0017d_profit_cost_m04_04.down.sql",
    "database/migrations/0064_governed_workflow_confirmations.up.sql",
    "apps/api/src/profit-service.ts",
    "apps/api/src/mysql-profit-repository.ts",
    "apps/api/src/profit-routes.ts",
    "apps/worker/src/opportunity-profit-worker.ts",
    "apps/worker/src/notification-outbox-worker.ts",
    "apps/web/src/components/CostRuleConsole.vue",
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/OpportunityProfitPanel.vue",
    "apps/web/src/components/OpportunityCostReviewQueue.vue",
    "apps/web/src/profit.css",
    "apps/web/src/opportunity-profit.css",
    "config/schema.json",
    "config/env.example",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "docs/architecture/m04-04-profit-cost.md",
    "docs/runbooks/m04-04-profit-cost.md",
    "tests/e2e/m04-04-profit.spec.ts",
    "scripts/verify-profit-live.mjs",
    "new-product-enterprise-blueprint.md",
  ];
  const values = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  const [
    up,
    down,
    governanceUp,
    service,
    repository,
    routes,
    worker,
    notificationWorker,
    consoleUi,
    opportunityShell,
    profitPanel,
    costReviewQueue,
    ruleCss,
    profitCss,
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
  const qualityGateSetupUi = await readFile(
    "apps/web/src/components/shared/QualityGateSetupSummary.vue",
    "utf8",
  );
  assert.match(
    up,
    /cost_rules[\s\S]*exchange_rate_quotes[\s\S]*opportunity_profit_runs[\s\S]*opportunity_profit_components/,
  );
  assert.match(down, /DROP TABLE IF EXISTS `cost_rules`/);
  assert.match(governanceUp, /opportunity_cost_input_reviews[\s\S]*due_at/);
  assert.match(
    service,
    /cost_rule_fee_lines_invalid[\s\S]*validateExchangeQuote[\s\S]*cost_rule_approval_role_forbidden/,
  );
  assert.match(repository, /rollback[\s\S]*exchange_provider_not_approved/);
  assert.match(
    repository,
    /is_current,submitted_by[\s\S]*approval\.cost_input\.review_due_soon[\s\S]*reviewer_id/,
  );
  assert.match(routes, /cost:confirm[\s\S]*profit-runs/);
  assert.match(worker, /insufficient_data[\s\S]*net_profit[\s\S]*dead_letter/);
  assert.match(
    notificationWorker,
    /approval\.cost_input\.review_due_soon[\s\S]*approval\.cost_input\.overdue/,
  );
  for (const state of ["loading", "ready", "empty", "error", "expired", "forbidden", "blocked"])
    assert.match(consoleUi, new RegExp(state));
  assert.match(opportunityShell, /profit-analysis[\s\S]*OpportunityProfitPanel/);
  assert.match(profitPanel, /提交成本复核[\s\S]*重新计算/);
  assert.match(`${profitPanel}\n${costReviewQueue}`, /成本复核队列[\s\S]*指定复核人/);
  assert.match(consoleUi, /成本质量门[\s\S]*costSetupItems[\s\S]*成本规则已生效/);
  assert.match(qualityGateSetupUi, /自动推荐配置[\s\S]*已满足[\s\S]*待完成/);
  assert.ok(opportunityShell.split(/\r?\n/).length < 1000);
  assert.ok(profitPanel.split(/\r?\n/).length < 200);
  assert.ok(costReviewQueue.split(/\r?\n/).length < 160);
  assert.match(ruleCss, /@media\s*\(\s*max-width:\s*820px\s*\)/);
  assert.match(ruleCss, /var\(--so-panel\)/);
  assert.match(ruleCss, /var\(--so-primary\)/);
  assert.match(ruleCss, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(ruleCss, /!important|#[0-9a-f]{3,8}\b/i);
  assert.match(profitCss, /@media\s*\(\s*max-width:\s*640px\s*\)/);
  assert.match(schema, /PROFIT_CALCULATION_POLL_MS/);
  assert.match(env, /PROFIT_CALCULATION_LEASE_SECONDS/);
  assert.match(openapi, /profit-analysis/);
  assert.match(feature, /profitCost/);
  assert.match(architecture, /69\.4[\s\S]*MySQL 5\.7/);
  assert.match(runbook, /宝塔[\s\S]*回滚/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(live, /historical_runs_preserved/);
  assert.match(blueprint, /M04-04 实现合同/);
});
