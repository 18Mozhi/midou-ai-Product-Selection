import test from "node:test";
import assert from "node:assert/strict";
import { MySqlSourcingProjectionWorker } from "../../apps/worker/dist/sourcing-projection-worker.js";
import { CoreCollectionProjectionWorker } from "../../apps/worker/dist/core-collection-projection-worker.js";

const now=new Date("2026-10-15T12:00:00Z"), source={external_id:"offer",title:"Fixture",supplier_name:"Supplier",
  canonical_url:"https://detail.1688.com/offer/123.html",price:8,currency:"CNY",moq:5,observed_at:now.toISOString()};
const record={id:"norm",provider_id:"provider",raw_evidence_id:"raw",evidence_link_id:"link",
  collection_subquery_id:"sub",captured_at:now,payload_json:source};

for (const path of ["leased","collection"]) for(const mode of ["new","foreign_source","foreign_duplicate","replay"]) {
  test(`owned sourcing projection ${path}: ${mode}`,async()=>{
    const calls=[],rows=[],ledger=[];
    const c={beginTransaction:async()=>calls.push("begin"),commit:async()=>calls.push("commit"),
      rollback:async()=>calls.push("rollback"),release:()=>calls.push("release"),
      query:async(sql,v=[])=>{
        if(sql.startsWith("SELECT collection_task_id,input_type")||sql.startsWith("SELECT id,collection_task_id,input_type")) {
          assert.deepEqual(v,["search"]);
          assert.doesNotMatch(sql,/organization_id|workspace_id/);
          return [[{id:"search",collection_task_id:"task",input_type:"opportunity",input_ref:"opportunity"}]];
        }
        if(sql.startsWith("SELECT cut.primary_account_id")){
          assert.deepEqual(v,["sourcing_searches","search"]);return [[{primary_account_id:"primary",account_id:"primary",reason:"shared"}]];
        }
        if(sql.startsWith("SELECT id FROM sourcing_projection_jobs"))return [[{id:"job"}]];
        if(sql.startsWith("SELECT n.*,e.canonical_url")){
          assert.deepEqual(v,["task"]);
          assert.doesNotMatch(sql,/organization_id|workspace_id/);
          assert.match(sql,/sq.task_id=link_task.id AND sq.provider_id=l.provider_id/);
          assert.match(sql,/n.raw_evidence_id=l.raw_evidence_id AND n.provider_id=l.provider_id/);
          assert.match(sql,/e.id=l.raw_evidence_id AND e.provider_id=l.provider_id/);
          return [[{...record,workspace_id:"prior-workspace"}]];
        }
        if(sql.startsWith("SELECT account_id FROM account_owned_records"))
          return [v[0].map(([,id])=>({account_id:mode==="foreign_source"&&id==="raw"||
            mode==="foreign_duplicate"&&id==="existing"?"foreign":"primary"}))];
        if(sql.startsWith("SELECT id FROM sourcing_candidates")){
          assert.deepEqual(v,["search","norm","raw","provider"]);return [[{id:"existing"}]];
        }
        if(sql.startsWith("SELECT COUNT(*) count FROM sourcing_candidates")){
          assert.deepEqual(v,["search","primary"]);return [[{count:1}]];
        }
        if(sql.startsWith("SHOW COLUMNS"))return [[]];
        if(sql.startsWith("INSERT INTO account_owned_records")){
          ledger.push(...v[0]);return [{affectedRows:v[0].length}];
        }
        const table=/^INSERT (?:IGNORE )?INTO (\w+)/.exec(sql.trim())?.[1];
        if(table){
          rows.push([table,v[0],v]);return [{affectedRows:table==="sourcing_candidates"&&mode.endsWith("duplicate")||
            table==="sourcing_candidates"&&mode==="replay"?0:1}];
        }
        if(sql.startsWith("UPDATE"))return [{affectedRows:1}];
        throw Error("Unexpected SQL "+sql);
      }};
    const pool={getConnection:async()=>c};
    const execute=path==="leased"?()=>new MySqlSourcingProjectionWorker(pool,"worker",120,()=>now)
      .project({id:"job",search:"search",scope:null,accountId:"primary",request:"req",trace:"trace",attempt:1}):
      ()=>new CoreCollectionProjectionWorker(pool,"worker",()=>now)
        .projectSourcing(c,{resourceId:"search",taskId:"task",subqueryId:"sub",organizationId:"org",workspaceId:"ws"},[record],now);
    if(mode.startsWith("foreign")){
      await assert.rejects(execute(),{code:"sourcing_projection_owner_mismatch"});
      if(path==="leased")assert.deepEqual(calls,["begin","rollback","release"]);
      assert.deepEqual(ledger,[]);
      if(mode==="foreign_source")assert.deepEqual(rows,[]);
      return;
    }
    const result=await execute();
    assert.equal(path==="leased"?result.candidate_count:result,mode==="replay"&&path==="collection"?0:1);
    assert.deepEqual(rows[0][2].slice(1,5),["search","provider","norm","raw"]);
    assert.deepEqual(ledger,rows.filter(([t])=>t!=="sourcing_candidates"||mode!=="replay")
      .map(([t,id])=>[t,id,"primary","shared"]));
  });
}

for (const mode of ["legacy", "native", "foreign", "retargeted", "foreign-opportunity"]) test(`owned collection projection preserves exact evidence and refuses foreign targets: ${mode}`, async()=>{
  const queries=[];
  const native=mode!=="legacy";
  const c={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},
    async query(sql,args=[]){
      queries.push([sql,args]);
      if(!sql.startsWith("SHOW COLUMNS")) assert.doesNotMatch(sql,/organization_id|workspace_id/);
      if(sql.startsWith("SELECT id FROM collection_tasks")) {
        assert.match(sql,/request_id=\? AND trace_id=\?.*FOR UPDATE$/);
        assert.deepEqual(args,["task","primary","req","trace"]);
        return [[{id:"task"}]];
      }
      if(sql.startsWith("SELECT target_json FROM collection_subqueries")) {
        assert.deepEqual(args,["sub","task"]);
        return [[{target_json:{projection_type:"sourcing_search",search_id:mode==="retargeted"?"other":"search"}}]];
      }
      if(sql.startsWith("SHOW COLUMNS FROM opportunities")) return [native?[{Field:"account_id"}]:
        [{Field:"organization_id"},{Field:"workspace_id"}]];
      if(sql.startsWith("SELECT id FROM opportunities")) {
        assert.match(sql,/account_id=\? LOCK IN SHARE MODE$/);
        assert.deepEqual(args,["opportunity","primary"]);
        return [mode==="foreign-opportunity"?[]:[{id:"opportunity"}]];
      }
      if(sql.startsWith("SELECT cut.primary_account_id"))
        return [[{primary_account_id:"primary",account_id:mode==="foreign"?"foreign":"primary",reason:mode==="foreign"?"exclusive_owner":"shared"}]];
      if(sql.startsWith("SELECT n.id")) {
        assert.deepEqual(args,native?["task","sub","primary"]:["task","sub"]);
        assert.match(sql,/sq.task_id=l.collection_task_id AND sq.provider_id=l.provider_id/);
        assert.match(sql,/n.provider_id=l.provider_id/);
        assert.match(sql,/e.provider_id=l.provider_id/);
        if(native) assert.match(sql,/origin.account_id=e.account_id/);
        return [[record]];
      }
      if(sql.startsWith("SELECT id,collection_task_id"))return [[{id:"search",collection_task_id:"task",input_type:"opportunity",input_ref:"opportunity"}]];
      if(sql.startsWith("SELECT account_id FROM account_owned_records"))return [args[0].map(()=>({account_id:"primary"}))];
      if(sql.startsWith("SELECT COUNT(*)"))return [[{count:1}]];
      if(sql.startsWith("SELECT input_ref")){
        assert.deepEqual(args,["search","task"]);
        return [[{input_ref:"opportunity"}]];
      }
      assert.match(sql,/^(?:INSERT|UPDATE)/);
      return [{affectedRows:1}];
    }};
  const worker=new CoreCollectionProjectionWorker({getConnection:async()=>c},"worker",()=>now);
  const result=worker.project({projectionType:"sourcing_search",resourceId:"search",taskId:"task",subqueryId:"sub",
    requestId:"req",traceId:"trace",...(native?{accountId:"primary"}:{})});
  if(["foreign","retargeted","foreign-opportunity"].includes(mode)){
    await assert.rejects(result,{code:mode==="retargeted"?"core_projection_target_changed":
      mode==="foreign-opportunity"?"sourcing_projection_owner_mismatch":"core_projection_owner_mismatch"});
    assert.ok(!queries.some(([sql])=>/^(?:INSERT|UPDATE)/.test(sql)));
    if(mode!=="foreign-opportunity") assert.ok(!queries.some(([sql])=>sql.startsWith("SELECT n.id")));
    return;
  }
  assert.equal(await result,1);
  const [sql,args]=queries.find(([sql])=>sql.startsWith("INSERT INTO automatic_selection_evaluations"));
  assert.match(sql,/a.source_id=o.id AND a.account_id=\?/);
  assert.equal(sql.includes("o.account_id=a.account_id"),native);
  assert.deepEqual(args.slice(-2),["primary","opportunity"]);
});

for (const mode of ["owned","owner_missing","owner_changed","lease_reclaimed"]) {
  test(`account sourcing lease from claim to finish without old scope: ${mode}`, async()=>{
    const calls=[], writes=[], ledger=[];
    let reads=0;
    const c={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
      query:async(sql,args=[])=>{
        calls.push(sql);
        if(sql.startsWith("SELECT * FROM sourcing_projection_jobs"))
          return [[{id:"job",search_id:"search",attempt_count:4,request_id:"req",trace_id:"trace"}]];
        if(sql.startsWith("SELECT cut.primary_account_id")) {
          const account=mode==="owner_missing" ? null : (++reads===2&&mode==="owner_changed" ? "other" : "primary");
          return [[{primary_account_id:"primary",account_id:account,reason:account==="other"?"exclusive_owner":"shared"}]];
        }
        if(sql.startsWith("SELECT id FROM sourcing_projection_jobs")){
          assert.match(sql,/attempt_count=\?/);
          assert.equal(args.at(-1),5);
          return [mode==="lease_reclaimed"?[]:[{id:"job"}]];
        }
        if(sql.startsWith("SELECT collection_task_id")){
          assert.deepEqual(args,["search"]);
          return [[{collection_task_id:"task",input_type:"keyword",input_ref:"fixture"}]];
        }
        if(sql.startsWith("SELECT account_id FROM account_owned_records"))
          return [args[0].map(()=>({account_id:"primary"}))];
        if(sql.startsWith("SELECT n.*"))return [[record]];
        if(sql.startsWith("SHOW COLUMNS"))return [[]];
        assert.doesNotMatch(sql,/organization_id|workspace_id/);
        if(sql.startsWith("INSERT INTO account_owned_records"))ledger.push(...args[0]);
        else writes.push([sql,args]);
        return [{affectedRows:1}];
      }};
    const worker=new MySqlSourcingProjectionWorker({getConnection:async()=>c,query:c.query},"worker",120,()=>now);
    const result=await worker.processOnce();
    assert.equal(calls.some(sql=>!sql.startsWith("SHOW COLUMNS")&&/organization_id|workspace_id/.test(sql)),false);
    if(mode==="owned"){
      assert.equal(result.status,"succeeded");
      assert.equal(result.candidate_count,1);
      const candidate=writes.find(([sql])=>sql.startsWith("INSERT IGNORE INTO sourcing_candidates"));
      assert.deepEqual(candidate[1].slice(1,5),["search","provider","norm","raw"]);
      assert.deepEqual(ledger.map(([table,,account])=>[table,account]),[
        ["sourcing_candidates","primary"],["sourcing_events","primary"],["sourcing_outbox","primary"]]);
    }else{
      assert.equal(result.error_code,mode==="lease_reclaimed"?"sourcing_projection_lease_lost":"sourcing_projection_owner_mismatch");
      assert.equal(writes.length,2);
      assert.match(writes[1][0],/AND attempt_count=\?/);
      assert.equal(writes[1][1].at(-1),5);
      assert.deepEqual(ledger,[]);
    }
  });
}
