import test from "node:test";
import assert from "node:assert/strict";
import {
  selectionCompetitorRelevanceSql,
  selectionPrimaryAsinSql,
} from "../../packages/database/dist/index.js";
import {
  optimizeSelectionReadSql,
  selectionReadRelevanceSql,
} from "../../apps/api/dist/selection-read-query-plan.js";
import { MySqlHomeDashboardRepository } from "../../apps/api/dist/mysql-home-dashboard-repository.js";

test("receipt-first plan retains every old join and WHERE proof in all three identity modes", () => {
  const from = "EXISTS (SELECT 1 FROM collection_subqueries q_relation ";
  const event = "JOIN opportunity_events e_relation ON ";
  const eventAt = selectionCompetitorRelevanceSql.indexOf(event);
  const whereAt = selectionCompetitorRelevanceSql.indexOf("WHERE e_relation.resource_id");
  assert.ok(
    selectionReadRelevanceSql.includes(
      selectionCompetitorRelevanceSql
        .slice(from.length, eventAt)
        .replaceAll("JOIN ", "STRAIGHT_JOIN "),
    ),
  );
  assert.ok(
    selectionReadRelevanceSql.includes(
      selectionCompetitorRelevanceSql.slice(eventAt + event.length, whereAt),
    ),
  );
  assert.ok(
    selectionReadRelevanceSql.endsWith(
      selectionCompetitorRelevanceSql.slice(whereAt + "WHERE ".length),
    ),
  );
  assert.match(selectionReadRelevanceSql, /q_relation.id=CONVERT.*subquery_id/);
  assert.match(selectionReadRelevanceSql, /AND BINARY JSON_UNQUOTE.*subquery_id/);
  for (const identity of [null, "o.primary_fact_asin", "o.filter_primary_asin"]) {
    const a = identity
      ? selectionCompetitorRelevanceSql.replaceAll(selectionPrimaryAsinSql, identity)
      : selectionCompetitorRelevanceSql;
    const b = identity
      ? selectionReadRelevanceSql.replaceAll(selectionPrimaryAsinSql, identity)
      : selectionReadRelevanceSql;
    assert.equal(optimizeSelectionReadSql("SELECT " + a), "SELECT " + b);
  }
  assert.equal(optimizeSelectionReadSql("SELECT ? FROM unrelated"), "SELECT ? FROM unrelated");
});

test("no same-day opportunity skips identity history, not actual completion receipts", async () => {
  const calls = [];
  const repo = new MySqlHomeDashboardRepository(
    {
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes("home_counts.*"))
          return [
            [
              {
                daily_has_opportunities: 0,
                candidate_count: 17,
                rule_candidate_count: 3,
                recommended_count: 2,
                awaiting_evidence_count: 12,
                adopted_count: 4,
              },
            ],
          ];
        if (sql.includes("completed_count")) return [[{ completed_count: 5 }]];
        return [[]];
      },
    },
    () => new Date("2026-11-04T00:00:00Z"),
  );
  const result = await repo.automaticSelection({ organizationId: "org", workspaceId: "ws" });
  assert.equal(calls.length, 3);
  assert.equal(result.daily_production.discovered_count, 0);
  assert.equal(result.daily_production.qualified_count, 0);
  assert.equal(result.daily_production.completed_count, 5);
  assert.equal(result.rule_candidate_count, 3);
  assert.equal(result.recommended_count, 2);
  assert.equal(result.awaiting_evidence_count, 12);
  assert.ok(!calls.some((c) => c.sql.startsWith("SELECT COUNT(DISTINCT daily.main_asin)")));
  const bindings = calls[0].values;
  assert.equal(bindings[8], "org");
  assert.equal(bindings[9], "ws");
  assert.equal(bindings[10].toISOString(), "2026-11-03T16:00:00.000Z");
});
