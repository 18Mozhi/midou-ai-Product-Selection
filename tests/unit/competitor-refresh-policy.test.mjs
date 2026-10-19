import test from "node:test";
import assert from "node:assert/strict";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";
import { competitorRefreshNoActiveDetailSql } from "../../apps/worker/dist/competitor-refresh-policy.js";
import { competitorRefreshGuardCases } from "../fixtures/competitor-refresh-sql.mjs";

test("refresh keeps cadence, cooldown, backlog, original task payload and scoped resource lock", async () => {
  const now = new Date("2026-10-20T00:00:00Z"),
    queries = [],
    scheduled = [];
  const persistence = new TrendProjectionPersistence({}, "worker", () => now, 3600, 1000);
  persistence.scheduleCoreCollection = async (...args) => scheduled.push(args);
  const row = {
    id: "competitor",
    organization_id: "org",
    workspace_id: "ws",
    created_by: "actor",
    external_id: "B0GY4ZFHKK",
    product_url: "https://www.amazon.com/dp/B0GY4ZFHKK",
  };
  const connection = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return [[row]];
    },
  };
  assert.equal(await persistence.enqueueDueCompetitorRefresh(connection, "amazon", now), true);
  const { sql, params } = queries[0];
  assert.ok(sql.includes(competitorRefreshNoActiveDetailSql));
  assert.match(sql, /recent.competitor_id IS NULL/);
  assert.match(sql, /recent.workspace_id=c.workspace_id/);
  assert.match(sql, /s.captured_at<=\?/);
  assert.match(sql, /ORDER BY s.captured_at,c.id LIMIT 1 FOR UPDATE/);
  assert.doesNotMatch(sql, /busy.active_count|GROUP BY organization_id\) busy/);
  assert.deepEqual(params, [
    new Date(now.getTime() - 3600000),
    new Date(now.getTime() - 3600000),
    1000,
  ]);
  assert.equal(scheduled.length, 1);
  assert.deepEqual(scheduled[0][3], [
    {
      providerId: "amazon",
      required: true,
      target: {
        page_url: row.product_url,
        asin: row.external_id,
        projection_type: "competitor_snapshot",
        competitor_id: row.id,
      },
    },
  ]);
  assert.equal(scheduled[0][4], "competitor.collection.auto_scheduled");
});
test("no eligible row or invalid Amazon identity never schedules a refresh", async () => {
  for (const row of [
    null,
    { external_id: "wrong", product_url: "https://www.amazon.com/dp/B0GY4ZFHKK" },
  ]) {
    const persistence = new TrendProjectionPersistence({}, "worker", () => new Date());
    persistence.scheduleCoreCollection = async () => assert.fail("unexpected task");
    assert.equal(
      await persistence.enqueueDueCompetitorRefresh(
        { query: async () => [row ? [row] : []] },
        "amazon",
        new Date(),
      ),
      false,
    );
  }
});
test("derived duplicate-guard cases exercise scoped active and terminal task states with SELECT only", () => {
  const cases = competitorRefreshGuardCases();
  assert.equal(cases.length, 21);
  for (const item of cases) {
    assert.match(item.sql, /^SELECT /);
    assert.doesNotMatch(item.sql, /FOR UPDATE|INSERT |UPDATE |DELETE |CREATE |DROP /);
  }
});
