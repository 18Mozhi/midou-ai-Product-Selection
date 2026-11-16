import test from "node:test";
import assert from "node:assert/strict";
import {
  refreshStaleAutomaticSourcing,
  automaticSourcingRefreshCandidateSql,
  automaticSourcingRefreshPrimarySql,
  accountSourcingRefreshCandidateSql,
} from "../../apps/worker/dist/automatic-sourcing-refresh.js";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";
import { nativeAccountAutomaticPrimaryEvidenceSql } from "../../apps/worker/dist/automatic-selection-evidence.js";

const row = {
  search_id: "old-search",
  organization_id: "org",
  workspace_id: "ws",
  previous_task_id: "old-task",
  opportunity_id: "op",
  created_by: "actor",
  provider_id: "provider",
  subquery_id: "sub",
  account_id: "primary",
};
function fixture(options = {}) {
  const calls = [],
    scheduled = [];
  const query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT slot FROM account_ownership_cutover")) return [options.owned ? [{slot:"current"}] : []];
    if (sql.startsWith("SELECT cut.primary_account_id"))
      return [options.owned ? [{primary_account_id:"primary",account_id:"primary",reason:"shared"}] : []];
    if (sql.startsWith("SELECT account_id FROM account_owned_records"))
      return [params[0].map(([table])=>({account_id:options.foreign&&table==="collection_tasks"?"foreign":"primary"}))];
    if (sql.startsWith("SHOW COLUMNS FROM sourcing_events"))
      return [options.owned ? [] : [{ Field: "organization_id" }, { Field: "workspace_id" }]];
    if (sql.startsWith("SHOW COLUMNS FROM sourcing_searches"))
      return [(options.columns ?? []).map(Field=>({Field}))];
    if (sql.startsWith("SHOW COLUMNS FROM opportunities")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
    if (sql.startsWith("SHOW COLUMNS FROM normalized_records"))
      return [(options.native ? ["account_id"] : ["organization_id","workspace_id"]).map(Field=>({Field}))];
    if (sql === automaticSourcingRefreshCandidateSql || sql === accountSourcingRefreshCandidateSql) return [options.empty ? [] : [row]];
    if (sql === automaticSourcingRefreshPrimarySql || sql.includes("AND ss.id=? AND q.id=? AND so.account_id=?"))
      return [options.lost && calls.includes("begin") ? [] : [row]];
    if (sql.startsWith("SELECT collection_task_id"))
      return [[{ collection_task_id: options.changed ? "new" : "old-task" }]];
    if (sql.startsWith("SELECT id FROM opportunities")) return [[{ id: "op" }]];
    if (sql === nativeAccountAutomaticPrimaryEvidenceSql)
      return [[{payload_json:{asin:"B000000001",title:"Router cooling fan"}}]];
    if (sql.startsWith("SELECT n.raw_evidence_id,s.captured_at"))
      return [options.noDetail || (options.detailChanged && calls.includes("begin")) ? [] : [
        {payload_json:{asin:"B000000001",image_url:options.badImage ? "https://example.test/a" : "https://m.media-amazon.com/images/I/primary.jpg"}},
      ]];
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
test("account refresh selects only matching owned search, task and subquery",async()=>{
  const f=fixture({owned:true});
  assert.equal(await f.run(),true);
  assert.doesNotMatch(accountSourcingRefreshCandidateSql,/(?:ss|newer|running_search)\.(organization_id|workspace_id)|JOIN organizations org |JOIN workspaces ws /);
  assert.match(accountSourcingRefreshCandidateSql,/qo.source_id=q.id AND qo.account_id=so.account_id/);
  assert.match(accountSourcingRefreshCandidateSql,/ro.source_id=running_search.id AND ro.account_id=so.account_id/);
  const lock=f.calls.find(x=>x.sql?.startsWith("SELECT collection_task_id"));
  assert.deepEqual(lock.params,[row.search_id]);
  const recheck=f.calls.filter(x=>x.sql?.startsWith("SELECT o.*")).at(-1);
  assert.deepEqual(recheck.params.slice(-3),[row.search_id,"sub","primary"]);
});
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
  assert.deepEqual(inserts[1].params.slice(3, 5), ["sourcing.search.seeded_from_opportunity", target.search_id]);
  assert.equal(JSON.parse(inserts[1].params[6]).previous_search_id, row.search_id);
  assert.equal(
    f.calls.some((x) => /^UPDATE|^DELETE/.test(x.sql ?? "")),
    false,
  );
  assert.deepEqual(f.calls.slice(-2), ["commit", "release"]);
});
test("0190 refresh proves the account primary and exact detail twice without using old evidence indexes", async () => {
  const f = fixture({owned:true,native:true});
  assert.equal(await f.run(), true);
  assert.equal(f.scheduled[0][3].image_url, "https://m.media-amazon.com/images/I/primary.jpg");
  const reads = f.calls.filter(x=>x.sql === nativeAccountAutomaticPrimaryEvidenceSql || x.sql?.startsWith("SELECT n.raw_evidence_id,s.captured_at"));
  assert.equal(reads.length,4);
  assert.ok(reads.every(x=>!x.sql.includes("uq_normalized_scope_record_version") &&
    !/\b(?:n|e|n_seed)\.(?:organization_id|workspace_id)/.test(x.sql)));
  assert.match(reads[1].sql,/n\.id=CONVERT\(RIGHT\(s\.source_ref_id,36\) USING ascii\)/);
  for (const option of ["noDetail", "detailChanged", "badImage"]) {
    const g = fixture({owned:true,native:true,[option]:true});
    assert.equal(await g.run(), false);
    assert.equal(g.scheduled.length,0);
  }
});
test("owned sourcing refresh keeps new search and audit under the parent owner",async()=>{
  const f=fixture({owned:true});
  assert.equal(await f.run(),true);
  assert.deepEqual(f.scheduled[0][6],{owner:{account_id:"primary",reason:"shared"}});
  const search=f.calls.find(x=>x.sql?.startsWith("INSERT INTO sourcing_searches"));
  assert.doesNotMatch(search.sql,/organization_id|workspace_id/);
  assert.deepEqual(search.params.slice(0,3),[f.scheduled[0][3].search_id,f.scheduled[0][2],row.opportunity_id]);
  assert.equal(search.sql.match(/\?/g).length,search.params.length);
  const ledger=f.calls.find(x=>x.sql?.startsWith("INSERT INTO account_owned_records"));
  assert.deepEqual(ledger.params[0].map(([table,,owner,reason])=>[table,owner,reason]),
    [["sourcing_searches","primary","shared"],["sourcing_events","primary","shared"]]);
});
test("partial search scope removal aborts refresh before scheduling",async()=>{
  const f=fixture({owned:true,columns:["workspace_id"]});
  await assert.rejects(f.run(),/partial_inherited_scope_schema:sourcing_searches/);
  assert.deepEqual(f.scheduled,[]);
  assert.deepEqual(f.calls.slice(-2),["rollback","release"]);
});
test("foreign old collection cannot be used for sourcing refresh",async()=>{
  const f=fixture({owned:true,foreign:true});
  assert.equal(await f.run(),false);
  assert.equal(f.scheduled.length,0);
  assert.ok(!f.calls.some(x=>x.sql?.startsWith("INSERT")));
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

test("account sourcing admission counts unfinished owned work instead of old scope", async () => {
  const { accountSourcingRefreshCandidateSql } = await import("../../apps/worker/dist/automatic-sourcing-refresh.js");
  const { accountCollectionBacklogCountSql } = await import("../../apps/worker/dist/collection-source-scheduling-policy.js");
  assert.ok(accountSourcingRefreshCandidateSql.includes(accountCollectionBacklogCountSql + "<?"));
  assert.doesNotMatch(accountCollectionBacklogCountSql,/organization_id|workspace_id/);
  assert.match(accountCollectionBacklogCountSql,/backlog.status IN \('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited'\)/);
});
