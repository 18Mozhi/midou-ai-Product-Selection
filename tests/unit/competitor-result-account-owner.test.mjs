import test from "node:test";
import assert from "node:assert/strict";
import { CoreCollectionProjectionWorker } from "../../apps/worker/dist/core-collection-projection-worker.js";
import { readCompetitorClassificationContext } from "../../apps/worker/dist/competitor-title-classification.js";
import { accountOnlyAutomaticPrimaryEvidenceSql } from "../../apps/worker/dist/automatic-selection-evidence.js";

const now=new Date("2026-10-17T12:00:00Z"),scope={organizationId:"org",workspaceId:"ws"};

test("core competitor detail dispatch inherits the original account without scope columns",async()=>{
  const writes=[];
  const c={async query(sql,args){
    if(sql.startsWith("SHOW COLUMNS FROM collection_tasks "))return [[{Field:"account_id"}]];
    if(sql.startsWith("SHOW COLUMNS FROM competitor_"))return [[]];
    writes.push([sql,args]);return [{affectedRows:1}];
  }};
  const worker=new CoreCollectionProjectionWorker({},"worker",()=>now);
  await worker.scheduleCompetitorDetail(c,{requestId:"req",traceId:"trace",actorId:"actor",resourceId:"original-op"},
    "original-competitor","provider","https://www.amazon.com/dp/B000000001",now,
    {owner:{account_id:"original-account",reason:"exclusive_owner"}});
  const main=writes[0][1], child=writes[1][1];
  assert.equal(main[1],"original-account");
  assert.equal(child.at(-1),main[0]);
  assert.equal(JSON.parse(child[3]).competitor_id,"original-competitor");
  assert.match(writes[2][0],/competitor.detail.auto_scheduled/);
  assert.equal(writes[2][1][1],main[0]);
  for(const [sql] of writes)assert.doesNotMatch(sql,/organization_id|workspace_id/);
  const [ledger]=writes.at(-1)[1];
  assert.equal(ledger.length,5);
  assert.ok(ledger.every(row=>row[2]==="original-account"&&row[3]==="exclusive_owner"));
});

test("0195 discovery projection locks the native opportunity and only reads the same-account classification event", async () => {
  const events = [];
  const c = { async beginTransaction(){events.push("begin");},async commit(){events.push("commit");},
    async rollback(){events.push("rollback");},release(){},
    async query(sql,args) {
      if (sql.startsWith("SHOW COLUMNS FROM")) return [[{Field:"account_id"}]];
      assert.doesNotMatch(sql,/organization_id|workspace_id/);
      if (sql.startsWith("SELECT id FROM collection_tasks")) return [[{id:"task"}]];
      if (sql.startsWith("SELECT target_json FROM collection_subqueries")) {
        assert.deepEqual(args,["sub","task"]);
        return [[{target_json:{projection_type:"opportunity_competitors",opportunity_id:"original",main_asin:"B000000001"}}]];
      }
      if (sql.startsWith("SELECT cut.primary_account_id")) return [[{account_id:"owner",reason:"exclusive_owner"}]];
      if (sql.startsWith("SELECT account_id FROM account_owned_records"))
        return [args[0].map(()=>({account_id:"owner"}))];
      if (sql.startsWith("SELECT id") && sql.includes("FROM opportunities")) {
        assert.match(sql,/account_id=\? FOR UPDATE$/);
        assert.deepEqual(args,["original","owner"]);
        return [[{id:"original",market:"US"}]];
      }
      assert.match(sql,/FROM opportunity_events e JOIN account_owned_records/);
      assert.match(sql,/p\.source_id=e\.id AND p\.account_id=\?/);
      assert.match(sql,/e\.request_id=\? AND e\.trace_id=\?/);
      assert.deepEqual(args,["owner","original","req","trace","task","sub"]);
      events.push("same-account-proof");
      return [[]]; // Other accounts' classification cannot authorize a write.
    },
  };
  const w=new CoreCollectionProjectionWorker({getConnection:async()=>c},"worker",()=>now);
  w.records=async()=>[];
  assert.equal(await w.project({projectionType:"opportunity_competitors",resourceId:"original",
    taskId:"task",subqueryId:"sub",accountId:"owner",requestId:"req",traceId:"trace",
    primaryAsin:"B000000001"}),0);
  assert.deepEqual(events,["begin","same-account-proof","commit"]);
});

for (const fresh of [false,true]) test(`0195 discovery projects the exact classification fingerprint to the original account (fresh=${fresh})`, async () => {
  const id = "original", accountId = "owner";
  const proofScope = {opportunityId:id,taskId:"task",subqueryId:"sub",
    ...(fresh ? {accountId} : {organizationId:"sealed-org",workspaceId:"sealed-ws"}),mainAsin:"B000000001"};
  const child = {id:"norm",raw_evidence_id:"raw",evidence_link_id:"link",collection_subquery_id:"sub",
    provider_id:"provider",payload_json:{asin:"B000000002",title:"Comparable storage box",
      canonical_url:"https://www.amazon.com/dp/B000000002"}};
  const active = {projectionType:"opportunity_competitors",resourceId:id,taskId:"task",subqueryId:"sub",accountId,
    nativeOpportunity:true,nativeCompetitor:true,requestId:"req",traceId:"trace",actorId:"actor",
    organizationId:"",workspaceId:"",primaryAsin:proofScope.mainAsin};
  let receipt, createdId, writes = [];
  const c = {async query(sql,args) {
    if (sql.startsWith("SHOW COLUMNS")) return [[{Field:"account_id"}]];
    if (sql.startsWith("SELECT cut.primary_account_id"))
      return [[{account_id:accountId,reason:"exclusive_owner"}]];
    if (sql.startsWith("SELECT account_id FROM account_owned_records")) return [args[0].map(()=>({account_id:accountId}))];
    if (sql.startsWith("SELECT id,market FROM opportunities")) return [[{id,market:"US"}]];
    if (sql.startsWith("SELECT e.payload_json FROM opportunity_events")) return [[{payload_json:receipt}]];
    if (sql.startsWith("SELECT r.legacy_org_id,r.legacy_workspace_id")) {
      assert.match(sql,/LOCK IN SHARE MODE$/);
      return [fresh ? [{sealed_id:null,account_after_cutover:1}] :
        [{legacy_org_id:"sealed-org",legacy_workspace_id:"sealed-ws"}]];
    }
    if (sql.startsWith("SELECT q.id FROM collection_tasks")) return [[{id:"sub"}]];
    if (sql === accountOnlyAutomaticPrimaryEvidenceSql) return [[{raw_evidence_id:"primary-raw",
      provider_status:"enabled",payload_json:{asin:"B000000001",title:"Original storage box",
        canonical_url:"https://www.amazon.com/dp/B000000001"}}]];
    if (sql.startsWith("SELECT n.raw_evidence_id,s.captured_at")) return [[]];
    if (sql.startsWith("SELECT n.id,n.raw_evidence_id")) return [[child]];
    if (sql.startsWith("INSERT INTO competitors")) {
      assert.deepEqual(args.slice(1,4),[accountId,id,"provider"]); createdId=args[0]; writes.push("competitor");
      return [{affectedRows:1}];
    }
    if (sql.startsWith("SELECT id,opportunity_id FROM competitors")) return [[{id:createdId,opportunity_id:id}]];
    if (sql.startsWith("INSERT INTO account_owned_records")) {
      assert.deepEqual(args,[[["competitors",createdId,accountId,"exclusive_owner"]]]);
      writes.push("ledger"); return [{affectedRows:1}];
    }
    if (sql.startsWith("UPDATE opportunities")) {
      assert.match(sql,/id=\? AND account_id=\?$/);
      assert.deepEqual(args,[now,id,accountId]);
      writes.push("native-parent"); return [{affectedRows:1}];
    }
    assert.fail(sql);
  }};
  const evidence = await readCompetitorClassificationContext(c,proofScope);
  receipt = {version:"competitor-title-v1",model_fingerprint:"a".repeat(64),input_fingerprint:evidence.fingerprint,
    classifications:[{source_ref:"norm",relation:"substitute",primary_excerpt:"Original storage box",
      candidate_excerpt:"Comparable storage box",rationale:"Same storage use"}]};
  const w=new CoreCollectionProjectionWorker({},"worker",()=>now);
  w.insertSnapshot=async(_c,_job,persisted,record)=>{
    assert.equal(persisted,createdId); assert.equal(record.raw_evidence_id,"raw");
    writes.push("snapshot"); return true;
  };
  w.scheduleCompetitorDetail=async()=>writes.push("detail");
  assert.equal(await w.projectCompetitorDiscovery(c,active,[child],now),1);
  assert.deepEqual(writes,["competitor","ledger","snapshot","detail","native-parent"]);
  writes=[];receipt={...receipt,input_fingerprint:"b".repeat(64)};
  assert.equal(await w.projectCompetitorDiscovery(c,active,[child],now),0);
  assert.deepEqual(writes,[]);
});

for(const [native,foreign] of [[false,false],[false,true],[true,false],[true,true]]){
  test(`collected snapshot requires same owner and records comparison job: ${native}/${foreign}`,async()=>{
    const owner="primary",writes=[],ledger=[];
    const c={query:async(sql,v=[])=>{
      if(sql.startsWith("SELECT id,external_id,product_url")) {
        if(native) {
          assert.doesNotMatch(sql,/organization_id|workspace_id/);
          assert.deepEqual(v,["competitor",owner]);
        }
        return [[{id:"competitor",external_id:"B000000001",opportunity_id:"op"}]];
      }
      if(sql.startsWith("SELECT cut.primary_account_id"))
        return [[{primary_account_id:owner,account_id:owner,reason:"unassigned"}]];
      if(sql.startsWith("SELECT account_id FROM account_owned_records"))
        return [v[0].map(([,id])=>({account_id:foreign&&id==="link"?"foreign":owner}))];
      if(sql.startsWith("INSERT INTO account_owned_records")) {
        ledger.push(...v[0]);return [{affectedRows:v[0].length}];
      }
      const table=/^INSERT (?:IGNORE )?INTO (\w+)/.exec(sql)?.[1];
      if(table){writes.push([table,v[0],v]);return [{affectedRows:1}];}
      throw Error("Unexpected SQL "+sql);
    }};
    const w=new CoreCollectionProjectionWorker({},"worker",()=>now);
    const input={...scope,...(native?{nativeCompetitor:true,accountId:owner}:{}),resourceId:"competitor",taskId:"task",subqueryId:"sub",requestId:"req",traceId:"trace"};
    const record={id:"normalized",provider_id:"provider",raw_evidence_id:"raw",evidence_link_id:"link",
      collection_subquery_id:"sub",captured_at:now,payload_json:{asin:"B000000001",
        canonical_url:"https://www.amazon.com/dp/B000000001",price:30}};
    if(foreign){
      await assert.rejects(w.projectCompetitorSnapshot(c,input,[record],now),{code:"competitor_projection_owner_mismatch"});
      assert.deepEqual(writes,[]);return;
    }
    assert.equal(await w.projectCompetitorSnapshot(c,input,[{...record,collection_subquery_id:"unrelated"},record],now),1);
    assert.deepEqual(ledger,writes.map(([t,id])=>[t,id,owner,"unassigned"]));
    assert.deepEqual(writes[1][2].slice(1,3),["competitor",writes[0][1]]);
    assert.equal(writes[0][2][11],"raw");
  });
}
