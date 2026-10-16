import assert from "node:assert/strict";
import test from "node:test";

import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";

const scope = {
  organizationId: "00000000-0000-4000-8000-000000000421",
  workspaceId: "00000000-0000-4000-8000-000000000422",
  actorId: "00000000-0000-4000-8000-000000000423",
  page: 1,
  pageSize: 20,
};

async function statementsFor(selectionView) {
  const statements = [];
  const repository = new MySqlOpportunityRepository({
    query: async (sql, values) => {
      statements.push({ sql, values });
      return sql.startsWith("SELECT COUNT(*)") ? [[{ total: 0 }], []] : [[], []];
    },
  });
  await repository.list({ ...scope, selectionView });
  return statements;
}

test("recommended view requires a real primary and all five quality gates without monitoring rules", async () => {
  const statements = await statementsFor("recommended");
  for (const { sql } of statements) {
    assert.match(sql, /n_primary.payload_json/);
    assert.doesNotMatch(sql, /orm_gate|orm_view/);
    assert.match(sql, /o\.decision_status='pending'/);
    assert.match(sql, /o\.recommendation_status='recommend'/);
    assert.match(sql, /o\.trend_score IS NOT NULL/);
    assert.match(sql, /o\.competition_score IS NOT NULL/);
    assert.match(sql, /o\.profit_status='calculated'/);
    assert.match(sql, /sc_gate\.dimension_code='risk'/);
  }
});

test("candidate view contains identified products that have not passed every quality gate", async () => {
  const statements = await statementsFor("rule_candidates");
  for (const { sql } of statements) {
    assert.match(sql, /n_primary.payload_json/);
    assert.match(sql, /o\.decision_status='pending'/);
    assert.match(sql, /NOT \(o\.recommendation_status='recommend'/);
  }
});

test("evidence-pending view retains products without a verified primary identity", async () => {
  const statements = await statementsFor("evidence_pending");
  for (const { sql } of statements) {
    assert.doesNotMatch(sql, /orm_view/);
    assert.match(sql, /o\.decision_status='pending'/);
    assert.match(sql, /NOT \(\(SELECT UPPER/);
  }
});

test("all view preserves access to manual, imported and non-recommended opportunities", async () => {
  const statements = await statementsFor("all");
  for (const { sql } of statements) {
    assert.doesNotMatch(sql, /orm_view/);
    assert.doesNotMatch(sql, /o\.source_type='manual'/);
  }
});
