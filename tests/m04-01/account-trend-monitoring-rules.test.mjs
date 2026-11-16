import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { MySqlTrendRepository } from "../../apps/api/dist/mysql-trend-repository.js";
import { TrendService } from "../../apps/api/dist/trend-service.js";
import { registerTrendRoutes } from "../../apps/api/dist/trend-routes.js";

const now = new Date("2026-10-15T00:00:00Z");
const base = {
  name: "Original rule",
  include_keywords_json: '["tool"]',
  negative_keywords_json: '["toy"]',
  market: "US",
  language: "zh-CN",
  collection_interval_minutes: 60,
  recommendation_min_source_count: 3,
  status: "enabled",
  version: 4,
  created_at: now,
  updated_at: now,
};
test("account rule status update writes owned recommendation events without legacy coordinates", async () => {
  const statements = [];
  const c = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, args) {
      statements.push(sql);
      if (sql.startsWith("SELECT slot FROM account_ownership_cutover"))
        return [[{ slot: "current" }]];
      if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules"))
        return [[{ Field: "historical_context" }]];
      assert.doesNotMatch(sql, /organization_id|workspace_id|historical_context/);
      if (
        sql.includes("FROM trend_monitoring_rules r") &&
        sql.includes("FOR UPDATE") &&
        !sql.startsWith("SELECT o.id")
      )
        return [[{ reason: "shared" }]];
      if (sql.startsWith("SELECT result_json")) return [[]];
      if (sql.startsWith("SELECT o.id")) {
        assert.deepEqual(args, ["primary", "rule", "primary", "primary"]);
        assert.match(
          sql,
          /source_table='opportunity_rule_matches' AND ra.source_id=m.id AND ra.account_id=r.account_id/,
        );
        return [
          [
            {
              id: "opportunity",
              recommendation_status: "recommended",
              source_count: 4,
              matched_threshold: 3,
            },
          ],
        ];
      }
      if (sql.startsWith("SELECT * FROM trend_monitoring_rules"))
        return [[{ ...base, id: "rule", status: "paused", version: 5 }]];
      if (/^(INSERT INTO |UPDATE )/.test(sql)) {
        assert.equal((sql.match(/\?/g) ?? []).length, args.length);
        if (sql.startsWith("UPDATE trend_monitoring_rules")) {
          assert.match(
            sql,
            /collection_interval_minutes=COALESCE\(\?,collection_interval_minutes\)/,
          );
          assert.match(
            sql,
            /recommendation_min_source_count=COALESCE\(\?,recommendation_min_source_count\)/,
          );
          assert.deepEqual(args.slice(0, 3), ["paused", null, null]);
        }
        return [{ affectedRows: 1 }];
      }
      assert.fail(sql);
    },
  };
  const repo = new MySqlTrendRepository({ getConnection: async () => c }, () => now);
  const result = await repo.updateRule({
    accountOwnedRule: true,
    actorId: "primary",
    ruleId: "rule",
    route: "status",
    idempotencyKey: "fixture",
    requestId: "req",
    traceId: "trace",
    expectedVersion: 4,
    status: "paused",
  });
  assert.equal(result.status, "paused");
  assert.equal(result.collection_interval_minutes, 60);
  assert.equal(result.recommendation_min_source_count, 3);
  for (const table of [
    "opportunity_events",
    "opportunity_outbox",
    "trend_events",
    "trend_outbox",
    "trend_operations",
  ])
    assert.ok(statements.some((sql) => sql.startsWith("INSERT INTO " + table)));
});
async function fixture({
  ready = true,
  verified = true,
  rehearsal = true,
  nativeOwner = false,
} = {}) {
  const calls = [];
  const pool = {
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.includes("FROM account_ownership_cutover"))
        return [ready ? [{ slot: "current" }] : []];
      if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules"))
        return [nativeOwner ? [{ Field: "account_id" }] : []];
      if (sql.includes(" AS owned_last_task")) {
        assert.match(sql, /ro.source_table='trend_monitoring_rules' AND ro.source_id=r.id/);
        assert.equal(sql.includes("r.account_id=ro.account_id"), nativeOwner);
        assert.match(sql, /ra.source_table='collection_tasks'/);
        assert.match(sql, /ra.source_table='collection_task_events'/);
        assert.match(sql, /e.event_type='trend.rule.collection.scheduled'/);
        assert.match(
          sql,
          /BINARY e.request_id=BINARY t.request_id AND BINARY e.trace_id=BINARY t.trace_id/,
        );
        assert.match(sql, /metadata_json,'\$.monitoring_rule_id'\)\)=BINARY r.id/);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        return [
          args[0] === "primary"
            ? [
                { ...base, id: "shared", last_collection_task_id: "task", owned_last_task: 1 },
                {
                  ...base,
                  id: "unassigned",
                  last_collection_task_id: "foreign-task",
                  owned_last_task: 0,
                },
              ]
            : [{ ...base, id: "exclusive", last_collection_task_id: null, owned_last_task: 0 }],
        ];
      }
      if (sql.includes("SELECT r.id rule_id,s.task_id")) {
        assert.equal(sql.includes("r.account_id=ro.account_id"), nativeOwner);
        assert.deepEqual(args, ["primary", ["shared"]]);
        assert.match(sql, /ra.source_table='collection_subqueries'/);
        assert.match(sql, /ra.source_table='collection_task_events'/);
        assert.match(sql, /target_json,'\$.monitoring_rule_id'\)\)=BINARY r.id/);
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        return [
          [
            { rule_id: "shared", task_id: "task", name: "Owned provider" },
            { rule_id: "shared", task_id: "changed-task", name: "Must not leak" },
          ],
        ];
      }
      if (!rehearsal) {
        assert.match(
          sql,
          /FROM trend_monitoring_rules WHERE organization_id=\? AND workspace_id=\?/,
        );
        assert.deepEqual(args, ["org", "ws"]);
        return [[{ ...base, id: "legacy", last_collection_task_id: null }]];
      }
      throw Error(sql);
    },
  };
  const auth = {
    async authenticate(token) {
      return {
        user: { id: token, email_verified_at: verified ? now : null },
        session: { id: "session" },
      };
    },
  };
  const authorization = {
    async resolveSession() {
      assert.equal(rehearsal, false, "account reading must not resolve a legacy session");
      return { context: { organization_id: "org", workspace_id: "ws" } };
    },
    async authorize(value) {
      assert.equal(value.capability, "trend:read");
    },
  };
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) =>
    reply.code(error.statusCode ?? 500).send({ code: error.code }),
  );
  registerTrendRoutes(app, {
    auth,
    authorization,
    secureCookie: false,
    webOrigin: "http://127.0.0.1",
    service: new TrendService(new MySqlTrendRepository(pool)),
    accountReadRehearsal: rehearsal,
  });
  return {
    app,
    calls,
    get: (token) =>
      app.inject({
        url: "/api/v1/trends/monitoring-rules?accountId=someone-else&workspace_id=foreign",
        headers: { cookie: "scoutops_session=" + token, "x-request-id": "r", "x-trace-id": "t" },
      }),
  };
}

test("account PATCH preserves omitted tuning fields and validates explicit values", async () => {
  const calls = [];
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) =>
    reply.code(error.statusCode ?? 500).send({ code: error.code }),
  );
  registerTrendRoutes(app, {
    accountReadRehearsal: true,
    secureCookie: false,
    webOrigin: "http://127.0.0.1",
    auth: {
      async authenticate() {
        return { user: { id: "primary", email_verified_at: now } };
      },
    },
    authorization: {
      async resolveSession() {
        assert.fail("unexpected old session");
      },
    },
    service: new TrendService({
      async updateRule(input) {
        calls.push(input);
        return base;
      },
    }),
  });
  const request = (payload) =>
    app.inject({
      method: "PATCH",
      url: "/api/v1/trends/monitoring-rules/00000000-0000-4000-8000-000000000001",
      headers: {
        origin: "http://127.0.0.1",
        cookie: "scoutops_session=primary",
        "idempotency-key": "rule-test-omitted",
        "x-request-id": "request",
        "x-trace-id": "trace",
      },
      payload: { status: "paused", expected_version: 4, ...payload },
    });
  try {
    assert.equal((await request({})).statusCode, 200);
    assert.deepEqual(
      calls.map((x) => [x.collectionIntervalMinutes, x.recommendationMinSourceCount]),
      [[undefined, undefined]],
    );
    assert.equal((await request({ collection_interval_minutes: 90 })).statusCode, 200);
    assert.deepEqual(
      [calls[1].collectionIntervalMinutes, calls[1].recommendationMinSourceCount],
      [90, undefined],
    );
    assert.equal((await request({ recommendation_min_source_count: null })).statusCode, 400);
    assert.equal(calls.length, 2);
  } finally {
    await app.close();
  }
});

for (const nativeOwner of [false, true]) {
  test(`account rule list preserves values and checks ownership (native=${nativeOwner})`, async () => {
    const f = await fixture({ nativeOwner });
    try {
      const primary = await f.get("primary");
      assert.equal(primary.statusCode, 200, primary.body);
      assert.equal(primary.headers["cache-control"], "private, no-store");
      const [shared, unassigned] = primary.json().data;
      assert.deepEqual(
        [
          shared.id,
          shared.collection_interval_minutes,
          shared.recommendation_min_source_count,
          shared.last_collection_task_id,
          shared.last_failed_sources,
        ],
        ["shared", 60, 3, "task", ["Owned provider"]],
      );
      assert.deepEqual(
        [unassigned.id, unassigned.last_collection_task_id, unassigned.last_failed_sources],
        ["unassigned", null, []],
      );
      const other = await f.get("other");
      assert.equal(other.statusCode, 200, other.body);
      assert.deepEqual(
        other.json().data.map((rule) => rule.id),
        ["exclusive"],
      );
    } finally {
      await f.app.close();
    }
  });
}

test("account rule list fails closed before reading data if verification or backfill is absent", async () => {
  for (const [options, status, code, expectedQueries] of [
    [{ verified: false }, 403, "account_verification_required", 0],
    [{ ready: false }, 503, "account_ownership_not_ready", 1],
  ]) {
    const f = await fixture(options);
    try {
      const response = await f.get("primary");
      assert.equal(response.statusCode, status, response.body);
      assert.equal(response.json().code, code);
      assert.equal(f.calls.length, expectedQueries);
    } finally {
      await f.app.close();
    }
  }
});

test("normal mode still uses its existing session and capability", async () => {
  const f = await fixture({ rehearsal: false });
  try {
    const response = await f.get("primary");
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(
      response.json().data.map((rule) => rule.id),
      ["legacy"],
    );
  } finally {
    await f.app.close();
  }
});

test("native rule creation rejects an unmapped old scope instead of guessing an owner", async () => {
  const statements = [],
    transitions = [];
  const connection = {
    async beginTransaction() {
      transitions.push("begin");
    },
    async commit() {
      transitions.push("commit");
    },
    async rollback() {
      transitions.push("rollback");
    },
    release() {
      transitions.push("release");
    },
    async query(sql, args) {
      statements.push(sql);
      if (sql.startsWith("SELECT result_json")) return [[]];
      if (sql.startsWith("SHOW COLUMNS")) return [[{ Field: "account_id" }]];
      if (sql.startsWith("SELECT slot FROM account_ownership_cutover"))
        return [[{ slot: "current" }]];
      if (sql.startsWith("SELECT s.account_id,s.reason")) {
        assert.match(sql, /s.run_id=cut.source_run_id/);
        assert.match(sql, /s.reason='exclusive_owner' OR s.account_id=cut.primary_account_id/);
        assert.deepEqual(args, ["unknown-org", "unknown-workspace"]);
        return [[]];
      }
      throw Error("Unexpected write: " + sql);
    },
  };
  const repo = new MySqlTrendRepository({ getConnection: async () => connection });
  await assert.rejects(
    repo.createRule({
      ruleId: "rule",
      actorId: "legacy-actor",
      organizationId: "unknown-org",
      workspaceId: "unknown-workspace",
      route: "test",
      idempotencyKey: "key",
      requestId: "request",
      traceId: "trace",
      rule: { name: "name" },
    }),
    { code: "account_ownership_not_ready", statusCode: 503 },
  );
  assert.deepEqual(transitions, ["begin", "rollback", "release"]);
  assert.ok(statements.every((sql) => /^(SELECT|SHOW)/.test(sql)));
});
