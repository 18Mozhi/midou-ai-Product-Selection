import test from "node:test";
import assert from "node:assert/strict";
import { MySqlAutomaticSourceScheduler } from "../../apps/worker/dist/automatic-source-scheduler.js";

test("rule scheduler queries the manual keyword crawler and completes all source batches before the interval", async () => {
  const now = new Date("2026-08-19T10:00:00.000Z");
  const statements = [];
  let ruleUpdate = null;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values = []) => {
      statements.push(sql);
      if (sql.includes("FROM trend_monitoring_rules WHERE"))
        return [[{
          id: "00000000-0000-4000-8000-000000004301",
          organization_id: "00000000-0000-4000-8000-000000004302",
          workspace_id: "00000000-0000-4000-8000-000000004303",
          created_by: "00000000-0000-4000-8000-000000004304",
          market: "GLOBAL",
          language: "multi",
          include_keywords_json: JSON.stringify(["portable fan"]),
          collection_interval_minutes: 60,
          source_cursor: 0,
        }], []];
      if (sql.includes("SELECT id,code,markets_json FROM providers"))
        return [Array.from({ length: 17 }, (_, index) => ({
          id: `provider-${index}`,
          code: index === 0 ? "google_news_search" : `source-${index}`,
          markets_json: JSON.stringify([index % 2 ? "US" : "JP"]),
        })), []];
      if (sql.startsWith("UPDATE trend_monitoring_rules SET source_cursor"))
        ruleUpdate = values;
      return [[], []];
    },
  };
  const pool = { getConnection: async () => connection };
  const result = await new MySqlAutomaticSourceScheduler(
    pool,
    16,
    () => now,
  ).processOnce();

  assert.equal(result.status, "scheduled");
  assert.equal(result.sourceCount, 16);
  assert.ok(
    statements.some((sql) =>
      sql.includes("next_collection_at IS NULL OR next_collection_at<=?"),
    ),
  );
  assert.ok(
    statements.some(
      (sql) =>
        sql.includes("google-news-rss-v1") &&
        sql.includes("google-news-fixed-rss-v1"),
    ),
  );
  assert.equal(ruleUpdate[0], 16);
  assert.equal(new Date(ruleUpdate[2]).toISOString(), "2026-08-19T10:01:00.000Z");
});
