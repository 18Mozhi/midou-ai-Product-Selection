import assert from "node:assert/strict";
import test from "node:test";
import {
  dailySelectionWindow,
  dailySelectionProductionSql,
  dailySelectionCompletedSql,
} from "../../apps/api/dist/home-daily-selection.js";
import { MySqlHomeDashboardRepository } from "../../apps/api/dist/mysql-home-dashboard-repository.js";
import {
  opportunityQualityGateSql,
  opportunityPrimaryAsinSql,
} from "../../apps/api/dist/opportunity-selection-policy.js";
for (const [instant, day, start, end] of [
  [
    "2026-10-16T15:59:59.999Z",
    "2026-10-16",
    "2026-10-15T16:00:00.000Z",
    "2026-10-16T16:00:00.000Z",
  ],
  [
    "2026-10-16T16:00:00.000Z",
    "2026-10-17",
    "2026-10-16T16:00:00.000Z",
    "2026-10-17T16:00:00.000Z",
  ],
  [
    "2026-12-31T16:00:00.000Z",
    "2027-01-01",
    "2026-12-31T16:00:00.000Z",
    "2027-01-01T16:00:00.000Z",
  ],
])
  test(`Beijing daily window is half-open and independent of host timezone: ${instant}`, () => {
    const result = dailySelectionWindow(new Date(instant));
    assert.equal(result.date, day);
    assert.equal(result.start.toISOString(), start);
    assert.equal(result.end.toISOString(), end);
  });
test("daily metrics reuse real primary identity and all quality gates while excluding earlier identities", () => {
  assert.equal(dailySelectionProductionSql.includes(opportunityQualityGateSql), true);
  assert.equal(dailySelectionProductionSql.split(opportunityPrimaryAsinSql).length >= 3, true);
  assert.match(dailySelectionProductionSql, /COUNT\(DISTINCT daily.main_asin\)/);
  assert.match(
    dailySelectionProductionSql,
    /COUNT\(DISTINCT CASE WHEN daily.quality_passed=1 THEN daily.main_asin END\)/,
  );
  assert.match(dailySelectionProductionSql, /o.created_at>=\? AND o.created_at<\?/);
  assert.match(
    dailySelectionProductionSql,
    /NOT EXISTS[\s\S]*o.organization_id=\? AND o.workspace_id=\? AND o.created_at<\?/,
  );
  assert.match(dailySelectionProductionSql, /lifecycle_status NOT IN \('archived','deleted'\)/);
  assert.doesNotMatch(dailySelectionProductionSql, /CURDATE|NOW\(|COUNT\(DISTINCT o.id\)/);
});
test("repository binds current tenant and UTC boundaries and forwards measured counts without inventing progress", async () => {
  const now = new Date("2026-10-17T00:00:00Z"),
    calls = [];
  const repository = new MySqlHomeDashboardRepository(
    {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql === dailySelectionCompletedSql) return [[{ completed_count: "93" }]];
        if (sql === dailySelectionProductionSql)
          return [[{ discovered_count: "120", qualified_count: "87" }]];
        if (sql.includes("FROM automatic_source_schedules s")) return [[]];
        return [[{}]];
      },
    },
    () => now,
  );
  const result = await repository.automaticSelection({
    organizationId: "org",
    workspaceId: "workspace",
  });
  assert.deepEqual(result.daily_production, {
    date: "2026-10-17",
    timezone: "Asia/Shanghai",
    completed_count: 93,
    discovered_count: 120,
    qualified_count: 87,
    target_minimum: 100,
    measured_at: now.toISOString(),
  });
  const read = calls.find((call) => call.sql === dailySelectionProductionSql);
  assert.deepEqual(read.params, [
    "org",
    "workspace",
    new Date("2026-10-16T16:00:00Z"),
    new Date("2026-10-17T16:00:00Z"),
    "org",
    "workspace",
    new Date("2026-10-16T16:00:00Z"),
  ]);
  const completedRead = calls.find((call) => call.sql === dailySelectionCompletedSql);
  assert.deepEqual(completedRead.params, [
    "org",
    "workspace",
    new Date("2026-10-16T16:00:00Z"),
    new Date("2026-10-17T16:00:00Z"),
  ]);
  assert.equal(calls.length, 4);
});

test("missing completion measurement remains unknown instead of using discovery or recommendation counts", async () => {
  const repository = new MySqlHomeDashboardRepository(
    {
      query: async (sql) =>
        sql === dailySelectionProductionSql
          ? [[{ discovered_count: 120, qualified_count: 87 }]]
          : [[]],
    },
    () => new Date("2026-10-17T00:00:00Z"),
  );
  const result = await repository.automaticSelection({
    organizationId: "org",
    workspaceId: "workspace",
  });
  assert.equal(result.daily_production.completed_count, null);
  assert.equal(result.daily_production.discovered_count, 120);
  assert.equal(result.daily_production.qualified_count, 87);
});
