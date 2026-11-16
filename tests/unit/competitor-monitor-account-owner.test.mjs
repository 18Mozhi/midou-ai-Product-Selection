import test from "node:test";
import assert from "node:assert/strict";
import { MySqlCompetitorMonitorWorker } from "../../apps/worker/dist/competitor-monitor-worker.js";

const now=new Date("2026-10-17T12:00:00Z"),scope={organizationId:"org",workspaceId:"ws"};
const job={...scope,id:"job",competitorId:"competitor",snapshotId:"next",requestId:"req",traceId:"trace",attemptCount:1};

test("0194 claim reads the native parent account without legacy columns", async () => {
  const calls = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() { assert.fail("unexpected rollback"); }, release() {},
    async query(sql, params) {
      calls.push(sql);
      if (sql.startsWith("SELECT * FROM competitor_snapshot_jobs"))
        return [[{id:"job",competitor_id:"competitor",snapshot_id:"next",request_id:"req",trace_id:"trace",attempt_count:0}]];
      if (sql.startsWith("SHOW COLUMNS FROM competitors")) return [[{Field:"account_id"}]];
      if (sql === "SELECT account_id FROM competitors WHERE id=?") {
        assert.deepEqual(params,["competitor"]); return [[{account_id:"owner"}]];
      }
      assert.match(sql,/^UPDATE competitor_snapshot_jobs SET status='leased'/);
      return [{affectedRows:1}];
    },
  };
  const worker = new MySqlCompetitorMonitorWorker({getConnection:async()=>connection},"worker",120,()=>now);
  assert.deepEqual(await worker.claim(), {id:"job",accountId:"owner",competitorId:"competitor",snapshotId:"next",
    requestId:"req",traceId:"trace",attemptCount:1});
  assert.ok(!calls.some(sql=>sql.startsWith("SELECT") && /organization_id|workspace_id/.test(sql)));
});

for(const mode of ["shared","exclusive_owner","foreign_previous","ledger_failure","native","native_mismatch",
  "native_wrong_source","native_wrong_previous_source","native_wrong_opportunity","native_missing_job_owner",
  "native_stale_attempt","native_expired_before_commit"]){
  test(`competitor comparison account: ${mode}`,async()=>{
    const owner=mode==="exclusive_owner"?"original":"primary",reason=mode==="exclusive_owner"?mode:"shared";
    const native=mode.startsWith("native");
    const input=native?{...job,organizationId:undefined,workspaceId:undefined,accountId:owner}:job;
    const calls=[],inserted=[],ledger=[];
    const c={beginTransaction:async()=>calls.push("begin"),commit:async()=>calls.push("commit"),
      rollback:async()=>calls.push("rollback"),release:()=>calls.push("release"),
      query:async(sql,v=[])=>{
        if(sql.startsWith("SELECT c.latest_snapshot_id")) {
          if(native) {
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            assert.match(sql,/c.account_id=\?/);
            assert.deepEqual(v,["next","competitor",owner]);
          }
          return [[{latest_snapshot_id:"previous",opportunity_id:"op",captured_at:now,current_price:30,
            evidence_id:"raw-new",provider_id:"snapshot-provider"}]];
        }
        if(sql.startsWith("SELECT cut.primary_account_id")){
          assert.deepEqual(v,["competitors",job.competitorId]);
          return [[{primary_account_id:mode==="native_mismatch"?"foreign":"primary",account_id:mode==="native_mismatch"?"foreign":owner,reason}]];
        }
        if(sql.startsWith("SELECT id FROM competitor_snapshot_jobs")) {
          assert.match(sql,/attempt_count=\? AND lease_expires_at>\? FOR UPDATE$/);
          assert.deepEqual(v,["job","competitor","next","worker",1,now]);
          return [mode==="native_stale_attempt"?[]:[{id:"job"}]];
        }
        if(sql.startsWith("SELECT account_id FROM account_owned_records"))
          return [v[0].filter(([t])=>!(t==="competitor_snapshot_jobs"&&mode==="native_missing_job_owner"))
            .map(([,id])=>({account_id:id==="raw-old"&&mode==="foreign_previous"?"foreign":owner}))];
        if(sql.startsWith("SELECT id FROM raw_evidence")) {
          assert.match(sql,/WHERE id=\? AND provider_id=\? AND account_id=\? LOCK IN SHARE MODE$/);
          assert.equal(v[1],v[0]==="raw-old"?"previous-provider":"snapshot-provider");
          assert.equal(v[2],owner);
          return [v[0]==="raw-new"&&mode==="native_wrong_source"||v[0]==="raw-old"&&mode==="native_wrong_previous_source"?[]:[{id:v[0]}]];
        }
        if(sql.startsWith("SHOW COLUMNS FROM opportunities")) return [native?[{Field:"account_id"}]:
          [{Field:"organization_id"},{Field:"workspace_id"}]];
        if(sql.startsWith("SELECT id FROM opportunities")) {
          assert.match(sql,/account_id=\? LOCK IN SHARE MODE$/);
          assert.deepEqual(v,["op",owner]);
          return [mode==="native_wrong_opportunity"?[]:[{id:"op"}]];
        }
        if(sql.startsWith("SELECT * FROM competitor_snapshots"))
          return [[{id:"previous",captured_at:new Date(now-1000),current_price:25,evidence_id:"raw-old",
            provider_id:"previous-provider"}]];
        if(sql.startsWith("SELECT r.* FROM competitor_monitor_rules")){
          assert.deepEqual(v,[owner,job.competitorId,"price"]);assert.match(sql,/ao\.account_id=\?/);
          assert.doesNotMatch(sql,/organization_id|workspace_id/);
          return [[{id:"rule",metric:"price",direction:"increase",threshold_value:5,workspace_id:"prior-workspace"}]];
        }
        if(sql.startsWith("SHOW COLUMNS")) return [[]];
        if(sql.startsWith("INSERT INTO account_owned_records")){
          if(mode==="ledger_failure") throw Error("fixture_ledger_failure");
          ledger.push(...v[0]);return [{affectedRows:v[0].length}];
        }
        const table=/^INSERT INTO (\w+)/.exec(sql)?.[1];
        if(table) inserted.push([table,v[0]]);
        if(native && sql.startsWith("INSERT INTO automatic_selection_evaluations")) {
          assert.doesNotMatch(sql,/organization_id|workspace_id/);
          assert.match(sql,/o\.account_id=a\.account_id/);
          assert.deepEqual(v,[now,now,now,owner,"op"]);
        }
        if(sql.startsWith("UPDATE competitor_snapshot_jobs SET status='succeeded'")) {
          assert.match(sql,/attempt_count=\? AND lease_expires_at>\?$/);
          assert.deepEqual(v,[now,"job","worker",1,now]);
          return [{affectedRows:mode==="native_expired_before_commit"?0:1}];
        }
        if(/^(INSERT|UPDATE)/.test(sql))return [{affectedRows:1}];
        throw Error("Unexpected SQL "+sql);
      }};
    const w=new MySqlCompetitorMonitorWorker({getConnection:async()=>c},"worker",120,()=>now);
    if(!["shared","exclusive_owner","native"].includes(mode)){
      const expectation=mode==="ledger_failure"?{message:"fixture_ledger_failure"}:
        {code:["native_stale_attempt","native_expired_before_commit"].includes(mode)?"competitor_snapshot_lease_lost":
          ["foreign_previous","native_wrong_previous_source"].includes(mode)?"competitor_previous_snapshot_owner_mismatch":
            "competitor_snapshot_owner_mismatch"};
      await assert.rejects(w.compare(input),expectation);
      assert.deepEqual(calls,["begin","rollback","release"]);
      if(!["ledger_failure","native_expired_before_commit"].includes(mode)) assert.deepEqual(inserted,[]);
      return;
    }
    assert.deepEqual(await w.compare(input),{change_count:1});
    const business=inserted.filter(([t])=>t.startsWith("competitor_"));
    assert.deepEqual(ledger.sort(),business.map(([t,id])=>[t,id,owner,reason]).sort());
    assert.equal(business.length,4);
    assert.deepEqual(calls,["begin","commit","release"]);
  });
}
