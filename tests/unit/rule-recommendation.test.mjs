import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { refreshRuleRecommendation } from "../../apps/worker/dist/rule-recommendation.js";
import { MySqlTrendRepository } from "../../apps/api/dist/mysql-trend-repository.js";

const input = {
  organizationId: "00000000-0000-4000-8000-000000000691",
  workspaceId: "00000000-0000-4000-8000-000000000692",
  opportunityId: "00000000-0000-4000-8000-000000000693",
  actorType: "worker",
  actorId: "trend-projection-test",
  requestId: "rule-recommendation-request",
  traceId: "rule-recommendation-trace",
  now: new Date("2026-09-03T00:00:00Z"),
};

test("rule recommendation promotes only a pending unscored opportunity that reaches an enabled rule threshold", async () => {
  const calls = [];
  const connection = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT o.recommendation_status"))
        return [
          [
            {
              recommendation_status: "insufficient_data",
              score_rule_version: null,
              decision_status: "pending",
              source_count: 2,
              matched_threshold: 2,
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  const result = await refreshRuleRecommendation(connection, input);
  assert.deepEqual(result, { changed: true, recommendationStatus: "recommend" });
  assert.match(calls[1].sql, /UPDATE opportunities SET recommendation_status=/);
  assert.equal(calls[1].params[0], "recommend");
  assert.match(calls[2].sql, /opportunity_events/);
  assert.match(calls[3].sql, /opportunity_outbox/);
  assert.match(String(calls[2].params[10]), /monitoring_rule_source_threshold/);
});

test("rule recommendation never overrides a versioned scoring conclusion", async () => {
  let writes = 0;
  const connection = {
    query: async (sql) => {
      if (!sql.startsWith("SELECT ")) writes += 1;
      return [
        [
          {
            recommendation_status: "observe",
            score_rule_version: "score-v1",
            decision_status: "pending",
            source_count: 3,
            matched_threshold: 1,
          },
        ],
      ];
    },
  };
  assert.deepEqual(await refreshRuleRecommendation(connection, input), { changed: false });
  assert.equal(writes, 0);
});

test("rule status changes recalculate matching recommendations with an auditable event", async () => {
  const calls = [];
  const now = new Date("2026-09-03T01:00:00Z");
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params = []) => {
      assert.equal((sql.match(/\?/g) ?? []).length, params.length, sql);
      calls.push({ sql, params });
      if (sql.startsWith("SELECT result_json")) return [[]];
      if (sql.startsWith("UPDATE trend_monitoring_rules")) return [{ affectedRows: 1 }];
      if (sql.startsWith("SELECT o.id,o.recommendation_status"))
        return [
          [
            {
              id: input.opportunityId,
              recommendation_status: "insufficient_data",
              source_count: 2,
              matched_threshold: 2,
            },
          ],
        ];
      if (sql.startsWith("SELECT * FROM trend_monitoring_rules"))
        return [
          [
            {
              id: "00000000-0000-4000-8000-000000000694",
              name: "Rule",
              include_keywords_json: '["desk lamp"]',
              negative_keywords_json: "[]",
              market: "US",
              language: "en-US",
              category: null,
              collection_interval_minutes: 60,
              recommendation_min_source_count: 2,
              status: "enabled",
              last_evaluated_at: null,
              last_collection_at: null,
              next_collection_at: now,
              last_collection_task_id: null,
              version: 2,
              created_at: now,
              updated_at: now,
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new MySqlTrendRepository({ getConnection: async () => connection }, () => now);
  const result = await repository.updateRule({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    requestId: input.requestId,
    traceId: input.traceId,
    idempotencyKey: "rule-update",
    ruleId: "00000000-0000-4000-8000-000000000694",
    status: "enabled",
    collectionIntervalMinutes: 60,
    recommendationMinSourceCount: 2,
    expectedVersion: 1,
    route: "PATCH:/api/v1/trends/monitoring-rules/00000000-0000-4000-8000-000000000694",
  });
  assert.equal(result.recommendation_min_source_count, 2);
  assert.ok(calls.some(({ sql }) => sql.startsWith("UPDATE opportunities")));
  assert.ok(calls.some(({ sql }) => sql.includes("INSERT INTO opportunity_events")));
  assert.ok(calls.some(({ sql }) => sql.includes("INSERT INTO opportunity_outbox")));
});

test("0069 migration adds a MySQL 5.7 compatible explicit source threshold and reversible backfill", async () => {
  const [up, down] = await Promise.all([
    readFile("database/migrations/0069_rule_based_recommendations.up.sql", "utf8"),
    readFile("database/migrations/0069_rule_based_recommendations.down.sql", "utf8"),
  ]);
  assert.match(up, /recommendation_min_source_count/);
  assert.match(up, /score_rule_version IS NULL/);
  assert.match(up, /r\.status='enabled'/);
  assert.doesNotMatch(up, /CHECK\s*\(|JSON_TABLE|WITH\s+RECURSIVE/i);
  assert.match(down, /DROP COLUMN `recommendation_min_source_count`/);
});
