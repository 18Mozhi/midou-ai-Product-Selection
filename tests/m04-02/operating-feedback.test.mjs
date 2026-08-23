import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  OpportunityService,
  OpportunityServiceError,
  validateOperatingFeedback,
} from "../../apps/api/dist/opportunity-service.js";
import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";

const valid = {
  period_start: "2026-08-01",
  period_end: "2026-08-22",
  sales_units: 100,
  revenue_amount: 1000,
  ad_spend_amount: 100,
  returned_units: 5,
  purchase_lead_time_days: 12,
  actual_profit_amount: 280,
  currency: "usd",
  source_ref: "ERP-SALES-202608",
  notes: "财务与采购已核对",
  observed_at: "2026-08-23T02:00:00.000Z",
  expected_version: 3,
};

test("operating feedback validates all five fact domains and preserves losses", () => {
  const result = validateOperatingFeedback({ ...valid, actual_profit_amount: -20 });
  assert.equal(result.currency, "USD");
  assert.equal(result.actual_profit_amount, -20);
  assert.throws(
    () => validateOperatingFeedback({ ...valid, returned_units: 101 }),
    (error) =>
      error instanceof OpportunityServiceError &&
      error.code === "opportunity_operating_feedback_invalid",
  );
  assert.throws(
    () => validateOperatingFeedback({ ...valid, period_end: "2026-07-31" }),
    /opportunity_operating_feedback_invalid/,
  );
});

test("operating feedback service keeps the write scoped, versioned and idempotent", async () => {
  const calls = [];
  const repository = {
    createOperatingFeedback: async (input) => {
      calls.push(input);
      return { facts: [], calibration: null };
    },
  };
  const service = new OpportunityService(repository);
  await service.createOperatingFeedback({
    organizationId: "00000000-0000-4000-8000-000000000001",
    workspaceId: "00000000-0000-4000-8000-000000000002",
    actorId: "00000000-0000-4000-8000-000000000003",
    opportunityId: "00000000-0000-4000-8000-000000000004",
    requestId: "request-feedback",
    traceId: "trace-feedback",
    idempotencyKey: "feedback-1",
    value: valid,
  });
  assert.equal(calls[0].value.expected_version, 3);
  assert.equal(calls[0].route, "POST:/api/v1/opportunities/:id/operating-feedback");
});

test("operating feedback calculates only comparable persisted deviations", async () => {
  const pool = {
    async query(sql) {
      assert.match(sql, /opportunity_operating_facts/);
      return [
        [
          {
            id: "fact-1",
            period_start: "2026-08-01",
            period_end: "2026-08-22",
            sales_units: 100,
            revenue_amount: 1000,
            ad_spend_amount: 100,
            returned_units: 5,
            purchase_lead_time_days: 12,
            actual_profit_amount: 280,
            currency: "USD",
            source_ref: "ERP-SALES-202608",
            notes: null,
            score_rule_version_snapshot: "score-v3",
            profit_rule_version_snapshot: "profit-v2",
            decision_status_snapshot: "adopted",
            predicted_profit_amount: 300,
            predicted_currency: "USD",
            quoted_lead_time_days: 8,
            observed_at: new Date("2026-08-23T02:00:00.000Z"),
            request_id: "request-feedback",
            trace_id: "trace-feedback",
            created_at: new Date("2026-08-23T02:00:00.000Z"),
          },
        ],
      ];
    },
  };
  const result = await new MySqlOpportunityRepository(pool).operatingFeedback({
    organizationId: "organization-1",
    workspaceId: "workspace-1",
    opportunityId: "opportunity-1",
  });
  assert.equal(result.calibration.return_rate_percent, 5);
  assert.equal(result.calibration.ad_spend_ratio_percent, 10);
  assert.equal(result.calibration.profit_variance_amount, -20);
  assert.equal(result.calibration.lead_time_variance_days, 4);
  assert.equal(result.calibration.automatic_rule_update, false);
  assert.equal(result.calibration.automatic_decision, false);
});

test("operating feedback migration, API, UI and deployment remain synchronized", async () => {
  const [migration, rollback, routes, repository, web, deploy, openapi] = await Promise.all(
    [
      "database/migrations/0065_opportunity_operating_feedback.up.sql",
      "database/migrations/0065_opportunity_operating_feedback.down.sql",
      "apps/api/src/opportunity-routes.ts",
      "apps/api/src/mysql-opportunity-repository.ts",
      "apps/web/src/components/OpportunityFeedbackPanel.vue",
      "scripts/apply-deployment-migrations.mjs",
      "docs/openapi.yaml",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const field of [
    "sales_units",
    "ad_spend_amount",
    "returned_units",
    "purchase_lead_time_days",
    "actual_profit_amount",
    "request_id",
    "trace_id",
  ])
    assert.match(migration, new RegExp(field));
  assert.match(rollback, /DROP TABLE IF EXISTS opportunity_operating_facts/);
  assert.match(routes, /operating-feedback/);
  assert.match(repository, /automatic_rule_update: false/);
  assert.match(repository, /automatic_decision: false/);
  assert.match(web, /不会自动改规则或替你决策/);
  assert.match(deploy, /0065_opportunity_operating_feedback/);
  assert.match(openapi, /OpportunityOperatingFeedbackInput/);
});
