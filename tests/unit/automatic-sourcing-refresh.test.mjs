import test from "node:test";
import assert from "node:assert/strict";
import {
  refreshStaleAutomaticSourcing,
  automaticSourcingRefreshCandidateSql,
  automaticSourcingRefreshPrimarySql,
} from "../../apps/worker/dist/automatic-sourcing-refresh.js";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";

const row = {
  search_id: "old-search",
  organization_id: "org",
  workspace_id: "ws",
  previous_task_id: "old-task",
  opportunity_id: "op",
  created_by: "actor",
  provider_id: "provider",
};
function fixture(options = {}) {
  const calls = [],
    scheduled = [];
  const query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql === automaticSourcingRefreshCandidateSql) return [options.empty ? [] : [row]];
    if (sql === automaticSourcingRefreshPrimarySql)
      return [options.lost && calls.includes("begin") ? [] : [row]];
    if (sql.startsWith("SELECT collection_task_id"))
      return [[{ collection_task_id: options.changed ? "new" : "old-task" }]];
    if (sql.startsWith("SELECT id FROM opportunities")) return [[{ id: "op" }]];
    if (sql.startsWith("SELECT COALESCE"))
      return [
        [
          {
            image_url: options.badImage ? null : "https://m.media-amazon.com/images/I/primary.jpg",
            title: "Router cooling fan",
          },
        ],
      ];
    if (sql.startsWith("INSERT INTO sourcing_events") && options.auditFailed) throw Error("audit");
    if (sql.startsWith("INSERT INTO")) return [{ affectedRows: 1 }];
    throw Error("unexpected query");
  };
  const connection = {
    query,
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
  };
  return {
    calls,
    scheduled,
    pool: { query, getConnection: async () => connection },
    run() {
      return refreshStaleAutomaticSourcing(
        this.pool,
        async (...args) => {
          scheduled.push(args);
          if (options.queueFailed) throw Error("queue");
        },
        new Date("2026-10-20T00:00:00Z"),
        1000,
      );
    },
  };
}
test("refresh creates a new automatic search and preserves original history", async () => {
  const f = fixture();
  assert.equal(await f.run(), true);
  assert.equal(f.scheduled.length, 1);
  const target = f.scheduled[0][3];
  assert.notEqual(target.search_id, row.search_id);
  assert.equal(target.projection_type, "sourcing_search");
  assert.equal(target.query_contract, "supplier-keywords-v2");
  const inserts = f.calls.filter((x) => x.sql?.startsWith("INSERT INTO"));
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].params[0], target.search_id);
  assert.equal(inserts[0].params[3], f.scheduled[0][2]);
  assert.equal(JSON.parse(inserts[1].params[4]).previous_search_id, row.search_id);
  assert.equal(
    f.calls.some((x) => /^UPDATE|^DELETE/.test(x.sql ?? "")),
    false,
  );
  assert.deepEqual(f.calls.slice(-2), ["commit", "release"]);
});
for (const option of ["empty", "changed", "lost", "badImage"])
  test(`no refresh after ${option}`, async () => {
    const f = fixture({ [option]: true });
    assert.equal(await f.run(), false);
    assert.equal(f.scheduled.length, 0);
    assert.equal(
      f.calls.some((x) => x.sql?.startsWith("INSERT")),
      false,
    );
  });
for (const option of ["queueFailed", "auditFailed"])
  test(`refresh rolls back ${option}`, async () => {
    const f = fixture({ [option]: true });
    await assert.rejects(f.run());
    assert.deepEqual(f.calls.slice(-2), ["rollback", "release"]);
    assert.ok(!f.calls.includes("commit"));
  });
test("an older row without a valid current primary cannot hide a later ready row", async () => {
  const f = fixture();
  const original = f.pool.query;
  let reads = 0;
  f.pool.query = async (sql, params) =>
    sql === automaticSourcingRefreshCandidateSql
      ? [[{ ...row, search_id: "missing" }, row]]
      : sql === automaticSourcingRefreshPrimarySql && ++reads === 1
        ? [[]]
        : original(sql, params);
  assert.equal(await f.run(), true);
  assert.equal(reads, 2);
});
test("eligibility keeps cadence, scope, source, provenance, no-current-price and capacity guards", () => {
  for (const fragment of [
    "p.schedule_minutes BETWEEN 1 AND 10080",
    "TIMESTAMPADD(MINUTE,p.schedule_minutes,ss.updated_at)<=?",
    "p.terms_review_status='approved'",
    "rc.state='open'",
    "org.status='active'",
    "ws.organization_id=ss.organization_id",
    "ci.is_current=1 AND ci.amount_value>0",
    "a.actor_type='worker'",
    "sourcing.collection.auto_scheduled",
    "newer.workspace_id=ss.workspace_id",
    "running_task.workspace_id=running_search.workspace_id",
    "backlog.status IN",
  ])
    assert.ok(automaticSourcingRefreshCandidateSql.includes(fragment), fragment);
  assert.doesNotMatch(automaticSourcingRefreshCandidateSql, /FOR UPDATE/);
  assert.match(
    automaticSourcingRefreshPrimarySql,
    /ss.id=\? AND ss.organization_id=\? AND ss.workspace_id=\?/,
  );
});
test("successful existing downstream and sourcing refresh turns alternate; failed scheduling retains its turn", async () => {
  const p = new TrendProjectionPersistence({}, "worker", () => new Date());
  const calls = [];
  p.enqueueExistingAutomaticDownstream = async () => {
    calls.push("existing");
    return true;
  };
  p.enqueueSourcingRefresh = async () => {
    calls.push("refresh");
    return true;
  };
  for (let i = 0; i < 4; i++) assert.equal(await p.enqueueMissingAutomaticDownstream(), true);
  assert.deepEqual(calls, ["existing", "refresh", "existing", "refresh"]);
  await p.enqueueMissingAutomaticDownstream();
  p.enqueueSourcingRefresh = async () => {
    throw Error("rollback");
  };
  await assert.rejects(p.enqueueMissingAutomaticDownstream());
  p.enqueueSourcingRefresh = async () => {
    calls.push("recovered-refresh");
    return true;
  };
  assert.equal(await p.enqueueMissingAutomaticDownstream(), true);
  assert.equal(calls.at(-1), "recovered-refresh");
});
