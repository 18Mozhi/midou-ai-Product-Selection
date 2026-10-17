import test from "node:test";
import assert from "node:assert/strict";
import { IntelligenceSourceRecovery } from "../../apps/worker/dist/intelligence-source-recovery.js";
import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";

const sourceId = "10000000-0000-4000-8000-000000000001";
const target = {
  query: "portable fan",
  projection_type: "intelligence_product_discovery",
  intelligence_source_record_id: sourceId,
};
const task = {
  id: "old-task",
  organization_id: "org",
  workspace_id: "workspace",
  priority: "high",
  trace_id: "original-trace",
  created_by: "actor",
};
const query = {
  provider_id: "amazon",
  status: "blocked",
  error_code: "permission_denied",
  is_required: 1,
  ordinal: 1,
  target_json: target,
};

function setup(options = {}) {
  const calls = [];
  let now = new Date("2026-10-18T00:00:00Z");
  let replay = options.replay ?? false;
  const c = {
    beginTransaction: async () => calls.push(["begin"]),
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
    query: async (sql, values = []) => {
      calls.push([sql, values]);
      assert.equal((sql.match(/\?/g) ?? []).length, values.length, sql);
      if (sql.startsWith("SELECT p.id,p.version"))
        return [
          options.provider === false
            ? []
            : [
                {
                  id: "amazon",
                  version: 13,
                  disabled_version: 12,
                  disabled_at: new Date("2026-10-17T20:00:00Z"),
                  restored_at: new Date("2026-10-17T21:00:00Z"),
                },
              ],
        ];
      if (sql.startsWith("SELECT COUNT(*) count")) return [[{ count: options.backlog ?? 0 }]];
      if (sql.startsWith("SELECT t.id,t.organization_id")) return [[task]];
      if (sql.startsWith("SELECT t.*")) return [options.lost ? [] : [task]];
      if (sql.startsWith("SELECT id FROM collection_tasks"))
        return [replay ? [{ id: "child" }] : []];
      if (sql.startsWith("SELECT * FROM collection_subqueries"))
        return [options.queries ?? [query]];
      if (sql.startsWith("SELECT n.id FROM normalized_records"))
        return [options.provenance === false ? [] : [{ id: sourceId }]];
      if (sql.startsWith("INSERT INTO collection_tasks")) {
        replay = true;
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT INTO collection_subqueries")) {
        if (options.fail)
          throw Object.assign(new Error("synthetic rollback"), { code: "ER_LOCK_DEADLOCK" });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT INTO collection_task_events")) return [{ affectedRows: 1 }];
      throw new Error(`unexpected query ${sql}`);
    },
  };
  const recovery = new IntelligenceSourceRecovery(
    { getConnection: async () => c },
    "worker",
    () => now,
    1000,
  );
  return {
    recovery,
    calls,
    advance: () => {
      now = new Date(now.getTime() + 30_000);
    },
  };
}

test("source outage recovery creates one linked search with original scope, target and trace but no facts", async () => {
  const { recovery, calls, advance } = setup();
  assert.equal(await recovery.processOnce(), 1);
  const insert = calls.find(([sql]) => sql.startsWith("INSERT INTO collection_tasks"));
  assert.deepEqual(insert[1].slice(1, 4), ["org", "workspace", "high"]);
  assert.equal(insert[1][6], "old-task");
  assert.equal(insert[1][9], "original-trace");
  assert.equal(insert[1][10], "actor");
  const subquery = calls.find(([sql]) => sql.startsWith("INSERT INTO collection_subqueries"));
  assert.deepEqual(subquery[1].slice(2, 6), ["org", "workspace", "amazon", 1]);
  assert.deepEqual(JSON.parse(subquery[1][6]), target);
  const events = calls.filter(([sql]) => sql.startsWith("INSERT INTO collection_task_events"));
  assert.deepEqual(
    events.map(([, v]) => v[4]),
    ["intelligence.product_search.auto_scheduled", "intelligence.product_search.source_recovered"],
  );
  assert.equal(JSON.parse(events[1][1][8]).provider_version, 13);
  assert.ok(
    !calls.some(([sql]) =>
      /^(UPDATE|DELETE)|raw_evidence|INSERT INTO normalized_records/.test(sql),
    ),
  );
  const count = calls.length;
  assert.equal(await recovery.processOnce(), 0);
  assert.equal(calls.length, count);
  advance();
  assert.equal(await recovery.processOnce(), 0);
  assert.equal(calls.filter(([sql]) => sql.startsWith("INSERT INTO collection_tasks")).length, 1);
});

for (const [label, options] of [
  ["provider not admitted or not restored", { provider: false }],
  ["global backlog full", { backlog: 1000 }],
  ["candidate lost", { lost: true }],
  ["another recovery already exists", { replay: true }],
  ["multiple original subqueries", { queries: [query, query] }],
  ["foreign provider", { queries: [{ ...query, provider_id: "other" }] }],
  ["not blocked", { queries: [{ ...query, status: "pending" }] }],
  ["real validation failure", { queries: [{ ...query, error_code: "captcha" }] }],
  ["optional source", { queries: [{ ...query, is_required: 0 }] }],
  ["missing current provenance", { provenance: false }],
  [
    "unexpected target URL",
    { queries: [{ ...query, target_json: { ...target, page_url: "https://example.test/" } }] },
  ],
  [
    "different projection",
    { queries: [{ ...query, target_json: { ...target, projection_type: "competitor_snapshot" } }] },
  ],
  [
    "invalid source identity",
    { queries: [{ ...query, target_json: { ...target, intelligence_source_record_id: "other" } }] },
  ],
  ["blank query", { queries: [{ ...query, target_json: { ...target, query: " " } }] }],
]) {
  test(`recovery fails closed: ${label}`, async () => {
    const { recovery, calls } = setup(options);
    assert.equal(await recovery.processOnce(), 0);
    assert.ok(!calls.some(([sql]) => sql.startsWith("INSERT")));
    assert.deepEqual(calls.at(-2), ["commit"]);
    assert.deepEqual(calls.at(-1), ["release"]);
  });
}

test("recovery respects the remaining backlog capacity and rolls back partial writes on error", async () => {
  const capacity = setup({ backlog: 999 });
  await capacity.recovery.processOnce();
  assert.equal(
    capacity.calls.find(([s]) => s.startsWith("SELECT t.id,t.organization_id"))[1][3],
    1,
  );
  const failed = setup({ fail: true });
  await assert.rejects(() => failed.recovery.processOnce(), { code: "ER_LOCK_DEADLOCK" });
  assert.ok(failed.calls.some(([s]) => s === "rollback"));
  assert.ok(
    !failed.calls.some(
      ([s]) => s === "commit" || s.startsWith("INSERT INTO collection_task_events"),
    ),
  );
});

test("repair dependency failure is logged without blocking new intelligence processing", async () => {
  const worker = new MySqlTrendProjectionWorker({}, "worker", 120);
  worker.sourceRecovery.processOnce = async () => {
    throw Object.assign(new Error("synthetic"), { code: "ER_LOCK_DEADLOCK" });
  };
  let fresh = 0;
  worker.enqueueMissing = async () => {
    fresh += 1;
  };
  worker.claim = async () => null;
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {};
  const oldWarn = console.warn,
    warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    assert.deepEqual(await worker.processOnce(), { status: "idle" });
  } finally {
    console.warn = oldWarn;
  }
  assert.equal(fresh, 1);
  assert.deepEqual(warnings, [["intelligence_source_recovery_failed", "ER_LOCK_DEADLOCK"]]);
});
