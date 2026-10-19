import test from "node:test";
import assert from "node:assert/strict";
import { MySqlAutomaticSourceScheduler } from "../../apps/worker/dist/automatic-source-scheduler.js";
import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";
import { validateProductAssociation } from "../../apps/worker/dist/intelligence-product-association.js";
import { automaticIntakeHeadroomCases } from "../fixtures/automatic-fanout-admission-sql.mjs";

for (const method of ["processFullOnce", "processRuleOnce"]) {
  for (const backlog of [996, 997, 999, 1000]) {
    test(`${method} backlog ${backlog} preserves completion admission space`, async () => {
      const statements = [];
      const c = {
        beginTransaction: async () => {},
        commit: async () => {},
        release: () => {},
        rollback: async () => {},
        query: async (sql) => {
          statements.push(sql);
          return sql.startsWith("SELECT COUNT(*) count FROM collection_tasks")
            ? [[{ count: backlog }]]
            : [[]];
        },
      };
      const scheduler = new MySqlAutomaticSourceScheduler(
        { getConnection: async () => c },
        16,
        () => new Date(),
        { systemActorId: "actor", tenantActiveTaskBudget: 2, queueBacklogLimit: 1000 },
      );
      const result = await scheduler[method]();
      assert.equal(result.status, backlog >= 997 ? "backpressure" : "idle");
      if (backlog >= 997) assert.equal(statements.length, 1);
      else
        assert.ok(
          statements.some((sql) =>
            sql.includes(
              method === "processFullOnce"
                ? "automatic_source_schedules"
                : "trend_monitoring_rules",
            ),
          ),
        );
    });
  }
}

test("fresh projection uses 997 while periodic completion still binds the original 1000", async () => {
  const reads = [];
  const c = {
    beginTransaction: async () => {},
    commit: async () => {},
    release: () => {},
    rollback: async () => {},
    query: async (sql, params) => {
      reads.push({ sql, params });
      return [[]];
    },
  };
  const now = () => new Date();
  await new MySqlTrendProjectionWorker(
    { getConnection: async () => c },
    "worker",
    120,
    now,
  ).claim();
  await new TrendProjectionPersistence({}, "worker", now).enqueueDueCompetitorRefresh(
    c,
    "amazon",
    now(),
  );
  assert.equal(reads[0].params.at(-1), 997);
  assert.equal(reads[1].params.at(-1), 1000);
  assert.ok(reads.every((r) => r.sql.startsWith("SELECT ")));
});

test("one admitted intelligence item preserves its existing three-query contract", () => {
  const input = { title: "Heatwave", summary: "Fans needed", source_ref: "source" };
  const value = {
    relation: "demand_driver",
    rationale: "Demand hypothesis",
    excerpt: "Heatwave",
    queries: ["desk fan", "portable fan", "cooling fan"],
  };
  assert.deepEqual(validateProductAssociation(value, input).queries, value.queries);
  assert.throws(() =>
    validateProductAssociation({ ...value, queries: [...value.queries, "fourth"] }, input),
  );
  // Maximum accepted intake backlog is996; the existing full fanout leaves999.
  assert.equal(996 + value.queries.length, 999);
  assert.ok(999 < 1000);
});

test("read-only MySQL cases cover the reserved band and tiny configured budgets", () => {
  const cases = automaticIntakeHeadroomCases();
  assert.ok(
    cases.every(
      (c) => c.sql.startsWith("SELECT ") && !/INSERT|DELETE|UPDATE|FOR UPDATE/.test(c.sql),
    ),
  );
  assert.ok(
    cases.some(
      (c) =>
        c.expected.backlog === 999 &&
        c.expected.intake_allowed === 0 &&
        c.expected.completion_allowed === 1,
    ),
  );
  for (const limit of [1, 2, 3])
    assert.ok(
      cases.some((c) => c.name === `limit-${limit}-backlog-0` && c.expected.intake_allowed === 1),
    );
});
