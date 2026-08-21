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
      if (sql.startsWith("SELECT COUNT(*) count FROM collection_tasks"))
        return [[{ count: 0 }], []];
      if (sql.includes("FROM trend_monitoring_rules r WHERE"))
        return [
          [
            {
              id: "00000000-0000-4000-8000-000000004301",
              organization_id: "00000000-0000-4000-8000-000000004302",
              workspace_id: "00000000-0000-4000-8000-000000004303",
              created_by: "00000000-0000-4000-8000-000000004304",
              market: "GLOBAL",
              language: "multi",
              include_keywords_json: JSON.stringify(["portable fan"]),
              collection_interval_minutes: 60,
              source_cursor: 0,
            },
          ],
          [],
        ];
      if (sql.includes("SELECT id FROM users WHERE id=?")) return [[{ id: values[0] }], []];
      if (sql.includes("SELECT id,code,markets_json FROM providers"))
        return [
          Array.from({ length: 17 }, (_, index) => ({
            id: `provider-${index}`,
            code: index === 0 ? "google_news_search" : `source-${index}`,
            markets_json: JSON.stringify([index % 2 ? "US" : "JP"]),
          })),
          [],
        ];
      if (sql.startsWith("UPDATE trend_monitoring_rules SET source_cursor")) ruleUpdate = values;
      return [[], []];
    },
  };
  const pool = { getConnection: async () => connection };
  const result = await new MySqlAutomaticSourceScheduler(pool, 16, () => now, {
    systemActorId: "00000000-0000-4000-8000-000000004399",
    tenantActiveTaskBudget: 2,
    queueBacklogLimit: 1000,
  }).processRuleOnce();

  assert.equal(result.status, "scheduled");
  assert.equal(result.sourceCount, 16);
  assert.ok(
    statements.some((sql) => sql.includes("next_collection_at IS NULL OR r.next_collection_at<=?")),
  );
  assert.ok(
    statements.some(
      (sql) => sql.includes("google-news-rss-v1") && sql.includes("google-news-fixed-rss-v1"),
    ),
  );
  assert.equal(ruleUpdate[0], 16);
  assert.equal(new Date(ruleUpdate[2]).toISOString(), "2026-08-19T10:01:00.000Z");
  assert.ok(
    statements.some(
      (sql) =>
        sql.includes("ct.organization_id=r.organization_id") &&
        sql.includes("COALESCE(r.last_collection_at") &&
        sql.includes("r.organization_id,r.id"),
    ),
  );
  assert.ok(statements.some((sql) => sql.includes("SELECT id FROM users WHERE id=?")));
});

test("automatic source scheduler blocks new work at the global backlog gate", async () => {
  const statements = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      statements.push(sql);
      if (sql.startsWith("SELECT COUNT(*) count FROM collection_tasks"))
        return [[{ count: 20 }], []];
      return [[], []];
    },
  };
  const scheduler = new MySqlAutomaticSourceScheduler(
    { getConnection: async () => connection },
    16,
    () => new Date("2026-08-19T10:00:00.000Z"),
    {
      systemActorId: "00000000-0000-4000-8000-000000004399",
      tenantActiveTaskBudget: 2,
      queueBacklogLimit: 20,
    },
  );
  const result = await scheduler.processFullOnce();
  assert.deepEqual(result, {
    status: "backpressure",
    reason: "queue_backlog_limit",
  });
  assert.equal(
    statements.some((sql) => sql.startsWith("INSERT INTO collection_tasks")),
    false,
  );
});
