import { competitorFirstObservationCases } from "../fixtures/competitor-first-observation-sql.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";
import {
  competitorRefreshNoActiveDetailSql,
  competitorRefreshObservedAtSql,
  competitorRefreshOrderSql,
} from "../../apps/worker/dist/competitor-refresh-policy.js";
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
      if (sql.startsWith("SELECT cut.primary_account_id")) return [[]];
      if (sql.includes("FROM automatic_selection_evaluations e FORCE INDEX")) return [[]];
      return [[row]];
    },
  };
  assert.equal(await persistence.enqueueDueCompetitorRefresh(connection, "amazon", now), true);
  const { sql, params } = queries.find(({ sql }) => sql.includes(competitorRefreshOrderSql));
  assert.ok(sql.includes(competitorRefreshNoActiveDetailSql));
  assert.match(sql, /recent.competitor_id IS NULL/);
  assert.match(sql, /recent.workspace_id=c.workspace_id/);
  assert.ok(sql.includes(competitorRefreshObservedAtSql + "<=?"));
  assert.match(
    sql,
    /LEFT JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id AND s.competitor_id=c.id/,
  );
  assert.ok(sql.includes(competitorRefreshOrderSql));
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
for (const foreign of [false,true])
  test(`periodic competitor refresh inherits opportunity ownership: foreign=${foreign}`,async()=>{
    const now=new Date("2026-10-20T00:00:00Z");
    const row={id:"competitor",opportunity_id:"opportunity",organization_id:"org",workspace_id:"ws",
      external_id:"B0GY4ZFHKK",product_url:"https://www.amazon.com/dp/B0GY4ZFHKK",created_by:"original-actor"};
    const inserts=[],ledger=[];
    const c={query:async(sql,params=[])=>{
      if(sql.includes("FROM automatic_selection_evaluations e FORCE INDEX"))return [[]];
      if(sql.includes(competitorRefreshOrderSql))return [[row]];
      if(sql.startsWith("SELECT cut.primary_account_id")){
        assert.deepEqual(params,["opportunities","opportunity"]);
        return [[{account_id:"primary",primary_account_id:"primary",reason:"shared"}]];
      }
      if(sql.startsWith("SELECT account_id FROM account_owned_records")){
        assert.deepEqual(params,[[["competitors","competitor"]]]);
        return [[{account_id:foreign?"foreign":"primary"}]];
      }
      if(sql.startsWith("SELECT q.id FROM collection_subqueries q JOIN collection_tasks t")){
        assert.match(sql,/oq\.account_id=ot\.account_id/);
        assert.equal(params.length,4);
        assert.deepEqual(params.slice(0,3),["primary","competitor_snapshot","competitor"]);
        return [[]];
      }
      if(sql.startsWith("INSERT INTO account_owned_records")){
        ledger.push(...params[0]);return [{affectedRows:1}];
      }
      if(sql.startsWith("SHOW COLUMNS FROM collection_tasks "))
        return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      const name=/^INSERT INTO (\w+)/.exec(sql)?.[1];
      if(name){inserts.push([name,params[0],params]);return [{affectedRows:1}];}
      throw Error("Unexpected SQL "+sql);
    }};
    const p=new TrendProjectionPersistence({},"worker",()=>now);
    assert.equal(await p.enqueueDueCompetitorRefresh(c,"amazon",now),!foreign);
    assert.equal(inserts.length,foreign?0:3);
    assert.deepEqual(ledger,inserts.map(([table,id])=>[table,id,"primary","shared"]));
    if(!foreign)assert.ok(inserts[0][2].includes("original-actor"));
  });
test("derived duplicate-guard cases exercise scoped active and terminal task states with SELECT only", () => {
  const cases = competitorRefreshGuardCases();
  assert.equal(cases.length, 21);
  for (const item of cases) {
    assert.match(item.sql, /^SELECT /);
    assert.doesNotMatch(item.sql, /FOR UPDATE|INSERT |UPDATE |DELETE |CREATE |DROP /);
  }
});

test("sealed projection schedules an account-only task, subquery and event in the caller transaction", async () => {
  const now=new Date("2026-10-20T00:00:00Z");
  const writes=[];
  const p=new TrendProjectionPersistence({},"worker",()=>now);
  const c={async query(sql,args) {
    if(sql.startsWith("SHOW COLUMNS FROM collection_tasks "))return [[{Field:"account_id"}]];
    if(sql.startsWith("INSERT INTO collection_subqueries (id,task_id,organization_id"))
      assert.fail("account mode must not attempt a legacy child write");
    writes.push([sql,args]);
    return [{affectedRows:1}];
  }};
  await p.scheduleCoreCollection(c,{actorId:"actor",requestId:"request",traceId:"trace"},
    "task",[{providerId:"provider",required:true,target:{competitor_id:"original"}}],
    "competitor.collection.auto_scheduled",now,{owner:{account_id:"owner",reason:"shared"}});
  assert.match(writes[0][0],/^INSERT INTO collection_tasks \(id,account_id,/);
  assert.deepEqual(writes[0][1],["task","owner",now,now,"request","trace","actor",now,now]);
  assert.match(writes[1][0],/^INSERT INTO collection_subqueries \(id,task_id,provider_id,/);
  assert.equal(writes[1][1].at(-1),"task");
  assert.match(writes[2][0],/^INSERT INTO collection_task_events/);
  assert.deepEqual(writes[3][1][0],[
    ["collection_tasks","task","owner","shared"],
    ["collection_subqueries",writes[1][1][0],"owner","shared"],
    ["collection_task_events",writes[2][1][0],"owner","shared"],
  ]);
  for(const [sql] of writes)assert.doesNotMatch(sql,/organization_id|workspace_id/);
});

test("a mixed task schema fails before dispatching a task, query, or event", async () => {
  const p=new TrendProjectionPersistence({},"worker",()=>new Date());
  const c={async query(sql) {
    assert.match(sql,/^SHOW COLUMNS FROM collection_tasks /);
    return [[{Field:"account_id"},{Field:"workspace_id"}]];
  }};
  await assert.rejects(p.scheduleCoreCollection(c,{},"task",[{providerId:"provider",required:true,target:{}}],
    "competitor.collection.auto_scheduled",new Date(),{owner:{account_id:"owner",reason:"shared"}}),
  /invalid_collection_task_scope_schema/);
});

test("first observations retain evidence pointer boundaries and have SELECT-only cadence/order probes", () => {
  const cases = competitorFirstObservationCases();
  assert.equal(cases.length, 18);
  for (const item of cases) {
    assert.match(item.sql, /^SELECT /);
    assert.doesNotMatch(item.sql, /FOR UPDATE|INSERT |UPDATE |DELETE |CREATE |DROP /);
    assert.equal((item.sql.match(/\?/g) || []).length, item.params.length);
  }
  assert.match(
    competitorRefreshObservedAtSql,
    /CASE WHEN c.latest_snapshot_id IS NULL THEN c.created_at ELSE s.captured_at END/,
  );
  assert.match(competitorRefreshOrderSql, /ORDER BY \(c.latest_snapshot_id IS NOT NULL\),/);
});
