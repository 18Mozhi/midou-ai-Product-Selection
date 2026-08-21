import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ProfitServiceError,
  validateCostInput,
  validateCostRule,
} from "../../apps/api/dist/profit-service.js";

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

test("M04-04.A03/A05-A11/A13-A17 complete delivery evidence exists", async () => {
  const paths = [
    "database/migrations/0017d_profit_cost_m04_04.up.sql",
    "database/migrations/0017d_profit_cost_m04_04.down.sql",
    "apps/api/src/profit-service.ts",
    "apps/api/src/mysql-profit-repository.ts",
    "apps/api/src/profit-routes.ts",
    "apps/worker/src/opportunity-profit-worker.ts",
    "apps/web/src/components/CostRuleConsole.vue",
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/OpportunityProfitPanel.vue",
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
    service,
    repository,
    routes,
    worker,
    consoleUi,
    opportunityShell,
    profitPanel,
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
  assert.match(
    up,
    /cost_rules[\s\S]*exchange_rate_quotes[\s\S]*opportunity_profit_runs[\s\S]*opportunity_profit_components/,
  );
  assert.match(down, /DROP TABLE IF EXISTS `cost_rules`/);
  assert.match(
    service,
    /cost_rule_fee_lines_invalid[\s\S]*validateExchangeQuote[\s\S]*cost_rule_approval_role_forbidden/,
  );
  assert.match(repository, /rollback[\s\S]*exchange_provider_not_approved/);
  assert.match(routes, /cost:confirm[\s\S]*profit-runs/);
  assert.match(worker, /insufficient_data[\s\S]*net_profit[\s\S]*dead_letter/);
  for (const state of ["loading", "ready", "empty", "error", "expired", "forbidden", "blocked"])
    assert.match(consoleUi, new RegExp(state));
  assert.match(opportunityShell, /profit-analysis[\s\S]*OpportunityProfitPanel/);
  assert.match(profitPanel, /确认成本输入[\s\S]*重新计算/);
  assert.ok(opportunityShell.split(/\r?\n/).length < 1000);
  assert.ok(profitPanel.split(/\r?\n/).length < 200);
  assert.match(ruleCss, /@media\s*\(\s*max-width:\s*820px\s*\)/);
  assert.match(ruleCss, /var\(--so-panel\)/);
  assert.match(ruleCss, /var\(--so-primary\)/);
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
