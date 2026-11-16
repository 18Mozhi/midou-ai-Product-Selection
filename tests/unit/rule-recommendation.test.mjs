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

test("rule threshold only marks candidacy and corrects a legacy unscored recommendation", async () => {
  const calls = [];
  const connection = {
    query: async (sql, params) => {
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") && sql.includes("historical_context")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM opportunity_events"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      calls.push({ sql, params });
      if (sql.startsWith("SHOW COLUMNS FROM opportunity_outbox")) return [[{ Field: "event_id" }]];
      if (sql.startsWith("SELECT o.recommendation_status"))
        return [
          [
            {
              recommendation_status: "recommend",
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
  assert.deepEqual(result, { changed: true, recommendationStatus: "insufficient_data" });
  assert.match(calls[1].sql, /UPDATE opportunities SET recommendation_status=/);
  assert.equal(calls[1].params[0], "insufficient_data");
  assert.match(calls[2].sql, /opportunity_events/);
  assert.match(calls[4].sql, /INSERT INTO opportunity_outbox \(id,event_id,/);
  assert.equal(calls[4].params[1], calls[2].params[0]);
  assert.match(String(calls[2].params[10]), /monitoring_rule_candidate_threshold/);
});

test("rule recommendation never overrides a versioned scoring conclusion", async () => {
  let writes = 0;
  const connection = {
    query: async (sql) => {
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") && sql.includes("historical_context")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
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

test("account recommendation joins both owned rule and match without requiring the same legacy scope", async () => {
  for (const native of [true, false]) {
  const calls = [];
  const connection = {
    query: async (sql, params) => {
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") && sql.includes("historical_context")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      calls.push({ sql, params });
      if (sql.startsWith("SHOW COLUMNS FROM opportunities")) return [native ? [{ Field: "account_id" }] :
        [{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS")) return [native ? [{ Field: "account_id" }] : []];
      return [[{ recommendation_status: "insufficient_data", score_rule_version: null, decision_status: "pending" }]];
    },
  };
  assert.deepEqual(await refreshRuleRecommendation(connection, {
    ...input, ownership: { owner: { account_id: "account", reason: "shared" } },
  }), { changed: false });
  assert.equal(calls.length, 3);
  calls.splice(0, 2);
  assert.doesNotMatch(calls[0].sql, /r\.(organization_id|workspace_id)/);
  assert.match(calls[0].sql, /source_table='opportunity_rule_matches' AND a.source_id=m.id AND a.account_id=\?/);
  assert.match(calls[0].sql, /source_table='trend_monitoring_rules' AND a.source_id=r.id AND a.account_id=\?/);
  assert.equal(calls[0].sql.includes("r.account_id=a.account_id"), native);
  assert.match(calls[0].sql, /source_table='opportunities' AND a.source_id=o.id AND a.account_id=\?/);
  assert.equal(calls[0].sql.includes("o.account_id=a.account_id"), native);
  assert.doesNotMatch(calls[0].sql, /o\.(organization_id|workspace_id)=\?/);
  assert.deepEqual(calls[0].params, ["account", "account", input.opportunityId, "account"]);
  }
});

test("owned recommendation writes events and outbox without reading legacy coordinates", async () => {
  const calls = [];
  const connection = { query: async (sql, params) => {
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") && sql.includes("historical_context")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
    calls.push({ sql, params });
    if (sql.startsWith("SHOW COLUMNS FROM opportunities")) return [[{ Field: "account_id" }]];
    if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules")) return [[{ Field: "account_id" }]];
    if (sql.startsWith("SELECT o.recommendation_status")) return [[{
      recommendation_status: "recommend", score_rule_version: null, decision_status: "pending",
      source_count: 2,
      matched_threshold: 2,
    }]];
    return [{ affectedRows: 1 }];
  }};
  assert.equal((await refreshRuleRecommendation(connection, {
    ...input, ownership: { owner: { account_id: "account", reason: "shared" } },
  })).changed, true);
  const update = calls.find(({sql}) => sql.startsWith("UPDATE opportunities"));
  assert.match(update.sql, /source_table='opportunities' AND a.source_id=o.id AND a.account_id=\?/);
  assert.match(update.sql, /o\.account_id=a\.account_id/);
  assert.deepEqual(update.params, ["insufficient_data", input.now, input.opportunityId, "account"]);
  const event = calls.find(({sql}) => sql.startsWith("INSERT INTO opportunity_events"));
  const outbox = calls.find(({sql}) => sql.startsWith("INSERT INTO opportunity_outbox"));
  for (const {sql, params} of calls) {
    if (!sql.startsWith("SHOW COLUMNS")) assert.doesNotMatch(sql, /organization_id|workspace_id/);
  }
  for (const {sql, params} of [update, event, outbox])
    assert.equal((sql.match(/\?/g) ?? []).length, params.length);
  assert.deepEqual(outbox.params.slice(0, 4), [event.params[0], event.params[0],
    "opportunity.rule_recommendation.changed", input.opportunityId]);
  const ownership = calls.find(({sql}) => sql.startsWith("INSERT INTO account_owned_records"));
  assert.deepEqual(ownership.params[0].map(row => [row[0], ...row.slice(2)]),
    [["opportunity_events", "account", "shared"], ["opportunity_outbox", "account", "shared"]]);
});

test("missing or foreign owner does not write or fall back to old workspace", async () => {
  for (const ownership of [{ owner: { account_id: "other", reason: "exclusive_owner" } }, { owner: null }]) {
    let count = 0;
    const connection = { query: async (sql) => {
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") && sql.includes("historical_context")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM opportunities")) return [[{ Field: "account_id" }]];
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      count++;
      assert.match(sql, /source_table='opportunities' AND a.source_id=o.id/);
      if (!ownership.owner) assert.match(sql, /NOT EXISTS \(SELECT 1 FROM account_owned_records a WHERE a.source_table='opportunities'/);
      return [[]];
    }};
    assert.deepEqual(await refreshRuleRecommendation(connection, {...input, ownership}), { changed: false });
    assert.equal(count, 1);
  }
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
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") && sql.includes("historical_context")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SHOW COLUMNS FROM opportunity_events"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      assert.equal((sql.match(/\?/g) ?? []).length, params.length, sql);
      calls.push({ sql, params });
      if (sql.startsWith("SHOW COLUMNS FROM opportunity_outbox")) return [[{ Field: "event_id" }]];
      if (sql.startsWith("SELECT result_json")) return [[]];
      if (sql.startsWith("UPDATE trend_monitoring_rules")) return [{ affectedRows: 1 }];
      if (sql.startsWith("SELECT o.id,o.recommendation_status"))
        return [
          [
            {
              id: input.opportunityId,
              recommendation_status: "recommend",
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

test("0070 migration restores legacy unscored recommendations to truthful rule candidates", async () => {
  const [up, down] = await Promise.all([
    readFile("database/migrations/0070_rule_candidates_quality_gate.up.sql", "utf8"),
    readFile("database/migrations/0070_rule_candidates_quality_gate.down.sql", "utf8"),
  ]);
  assert.match(up, /recommendation_status`='insufficient_data'/);
  assert.match(up, /score_rule_version` IS NULL/);
  assert.match(down, /opportunity_rule_matches/);
  assert.match(down, /recommendation_min_source_count/);
  assert.doesNotMatch(`${up}\n${down}`, /CHECK\s*\(|JSON_TABLE|WITH\s+RECURSIVE/i);
});
