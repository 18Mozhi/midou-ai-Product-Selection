import assert from "node:assert/strict";
import test from "node:test";
import { AutomationWorker } from "../../apps/worker/dist/automation-worker.js";
import { MySqlAutomationRepository } from "../../apps/api/dist/mysql-automation-repository.js";

test("0181 discovers account-owned deliveries only and atomically assigns executions", async()=>{
  const now=new Date("2026-11-14T01:00:00Z"), calls=[];
  const c={async beginTransaction(){},async commit(){calls.push("commit")},async rollback(){assert.fail("rollback")},release(){},
    async query(sql,args=[]){
      assert.equal((sql.match(/\?/g)??[]).length,args.length);
      if(sql.startsWith("SHOW COLUMNS FROM notifications"))return [[{Field:"recipient_id"},{Field:"source_event_id"}]];
      if(sql.startsWith("SELECT r.id rule_id")) {
        assert.match(sql,/n.recipient_id=r.account_id/);
        assert.match(sql,/o.reason IN \('shared','unassigned'\) AND o.account_id=cut.primary_account_id/);
        assert.match(sql,/n.created_at>=cut.created_at/);
        assert.match(sql,/d.recipient_id=n.recipient_id.*d.status='delivered'/);
        return [[{rule_id:"rule",version:5,notification_id:"new",request_id:"r",trace_id:"t",account_id:"primary",reason:"shared"}]];
      }
      if(sql.startsWith("INSERT INTO automation_executions")){calls.push(args);return [{affectedRows:1}]}
      if(sql.startsWith("INSERT INTO account_owned_records")){calls.push(args);return [{affectedRows:1}]}
      if(sql.startsWith("SELECT x.*")){
        assert.match(sql,/xo.account_id=r.account_id/);
        assert.match(sql,/n.created_at>=cut.created_at/);
        return [[]];
      }
      assert.fail(sql);
    }};
  const db={async getConnection(){return c},async query(sql){
    if(sql.startsWith("SHOW COLUMNS FROM automation_rules"))return [[{Field:"account_id"},{Field:"historical_context"}]];
    if(sql.startsWith("SHOW COLUMNS FROM automation_executions"))return [[]];
    if(sql.startsWith("SHOW COLUMNS FROM outbox_events"))return [[{Field:"organization_id"},{Field:"workspace_id"}]];
    return c.query(sql);
  }};
  assert.deepEqual(await new AutomationWorker(db,"worker",30,3,()=>now).processOnce(),{status:"idle"});
  assert.deepEqual(calls[0].slice(1,4),["rule",5,"new"]);
  assert.deepEqual(calls[1],[calls[0][0],"primary","shared"]);
  assert.deepEqual(calls.slice(2),["commit","commit"]);
});

test("0196 discovers and claims only account-owned published triggers without projecting deleted outbox fields", async()=>{
  const reads=[];
  const query=async(sql)=>{
    if(sql.startsWith("SHOW COLUMNS FROM automation_rules"))return [[{Field:"account_id"},{Field:"historical_context"}]];
    if(sql.startsWith("SHOW COLUMNS FROM automation_executions") || sql.startsWith("SHOW COLUMNS FROM outbox_events"))return [[]];
    reads.push(sql);return [[]];
  };
  const c={query,async beginTransaction(){},async commit(){},async rollback(){},release(){}};
  assert.deepEqual(await new AutomationWorker({query,async getConnection(){return c}},"worker",30,3).processOnce(),{status:"idle"});
  assert.equal(reads.length,2);
  for(const sql of reads){
    assert.match(sql,/event_owner.account_id=r.account_id/);
    assert.match(sql,/e.status='published'/);
    assert.match(sql,/e.created_at>=cut.created_at/);
    assert.match(sql,/n.recipient_id=r.account_id/);
    assert.match(sql,/scope_history.legacy_workspace_id=r.workspace_id/);
    assert.doesNotMatch(sql,/\b(?:n|e|parent)\.(?:organization_id|workspace_id)\b/);
  }
});

test("0181 pauses only a verified account-owned rule; retries do not emit another audit", async()=>{
  let receipt, count=0;
  const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},
    async query(sql,args=[]){
      assert.equal((sql.match(/\?/g)??[]).length,args.length);
      if(sql.startsWith("SELECT slot"))return [[{slot:"current"}]];
      if(sql.startsWith("SHOW COLUMNS"))return [[{Field:"account_id"},{Field:"historical_context"}]];
      if(sql.startsWith("SELECT id FROM users"))return [[{id:args[0]}]];
      if(sql.startsWith("SELECT r.*")){
        assert.match(sql,/owner.reason IN \('shared','unassigned'\) AND owner.account_id=cut.primary_account_id/);
        assert.match(sql,/owner.account_id=r.account_id/);
        return [args[1]==="owner"?[{status:"active",version:1}]:[]];
      }
      if(sql.startsWith("SELECT rule_id"))return [receipt?[{rule_id:"rule",result_json:receipt}]:[]];
      if(sql.startsWith("INSERT INTO platform_audit_events")) count++;
      else if(sql.startsWith("INSERT INTO automation_operations")) receipt=args[5];
      else assert.match(sql,/^UPDATE automation_rules SET status/);
      return [{affectedRows:1}];
    }};
  const repo=new MySqlAutomationRepository({async getConnection(){return c}});
  const input={accountId:"owner",ruleId:"rule",route:"POST:status",idempotencyKey:"key",requestId:"r",traceId:"t",
    value:{action:"pause",expected_version:1,reason:"pause review"}};
  await assert.rejects(repo.changeStatus({...input,accountId:"other"}),/automation_rule_not_found/);
  assert.deepEqual(await repo.changeStatus(input),{id:"rule",status:"paused",version:2});
  assert.deepEqual(await repo.changeStatus(input),{id:"rule",status:"paused",version:2});
  await assert.rejects(repo.changeStatus({...input,value:{...input.value,reason:"other"}}),/automation_idempotency_conflict/);
  assert.equal(count,1);
});

for (const mode of ["limited","native","notify","owner-changed"]) test(`owned automation execution under lock: ${mode}`, async()=>{
  const calls=[], now=new Date("2026-11-14T01:00:00Z");
  const job={id:"job",rule_id:"rule",rule_version:5,attempt_count:0,account_id:"owner",ownership_reason:"shared",
    organization_id:"original-org",workspace_id:"original-ws",request_id:"r",trace_id:"t"};
  const c={async beginTransaction(){},async commit(){},async rollback(){assert.equal(mode,"owner-changed")},release(){},
    async query(sql,args=[]){
      assert.equal((sql.match(/\?/g)??[]).length,args.length);
      calls.push([sql,args]);
      if(sql.startsWith("SHOW COLUMNS FROM notifications"))return [[{Field:"recipient_id"},{Field:"source_event_id"}]];
      if(sql.startsWith("SHOW COLUMNS FROM tasks"))return [[{Field:"account_id"}]];
      if(sql.startsWith("SELECT r.id rule_id"))return [[]];
      if(sql.startsWith("SELECT x.*"))return [[job]];
      if(sql.startsWith("SELECT x.id")) {
        assert.match(sql,/xo.account_id=ro.account_id AND xo.reason=ro.reason/);
        assert.match(sql,/ro.reason IN \('shared','unassigned'\) AND ro.account_id=cut.primary_account_id/);
        assert.deepEqual(args,["job","worker",1,now,"rule","owner",5,"shared"]);
        return [mode === "owner-changed" ? [] : [{id:"job"}]];
      }
      if(sql.startsWith("SELECT COUNT(*)"))return [[{total:mode==="limited"?2:0}]];
      return [{affectedRows:1}];
    }};
  const db={async getConnection(){return c},async query(sql,args){
    if(sql.startsWith("SHOW COLUMNS FROM automation_rules"))return [[{Field:"account_id"},{Field:"historical_context"}]];
    if(sql.startsWith("SHOW COLUMNS FROM automation_executions"))return [[]];
    if(sql.startsWith("SHOW COLUMNS FROM outbox_events"))return [[]];
    if(sql.startsWith("SELECT * FROM automation_rules")) {
      assert.deepEqual(args,["rule","owner"]);
      return [[{id:"rule",owner_id:"original-actor",status:"active",version:5,rate_limit_count:2,rate_limit_window_minutes:30,
        action_type:mode==="notify"?"notify_owner":"create_task",action_assignee_id:"owner",action_title:"Review",name:"fixture"}]];
    }
    return c.query(sql,args);
  }};
  const result=await new AutomationWorker(db,"worker",30,3,()=>now).processOnce();
  const outgoing=calls.filter(([sql])=>sql.startsWith("INSERT INTO outbox_events"));
  if (mode==="owner-changed") {
    assert.equal(result.status,"retry_scheduled");
    assert.match(result.error,/automation_execution_lease_or_rule_changed/);
    assert.equal(outgoing.length,0);
    assert.ok(calls.every(([sql])=>!sql.startsWith("INSERT INTO tasks")));
    return;
  }
  for(const [sql] of outgoing) assert.doesNotMatch(sql,/organization_id|workspace_id/);
  if (mode==="notify"){
    assert.equal(result.status,"succeeded",JSON.stringify(result));
    assert.equal(outgoing.length,2);
    const [,args]=outgoing[0];
    assert.equal(result.action_resource_id,args[0]);
    assert.deepEqual(JSON.parse(args[1]),{resource_type:"automation_rule",resource_id:"rule",recipient_id:"original-actor",
      title:"Review",automation_execution_id:"job",automation_account_contract:25});
    assert.ok(calls.some(([sql,params])=>sql.startsWith("INSERT INTO account_owned_records")&&params.join()===["outbox_events",args[0],"owner","shared"].join()));
    return;
  }
  if (mode==="native") {
    assert.equal(result.status,"succeeded",JSON.stringify(result));
    const [taskSql,task]=calls.find(([s])=>s.startsWith("INSERT INTO tasks"));
    assert.match(taskSql,/id,account_id,title/);
    assert.doesNotMatch(taskSql,/organization_id|workspace_id/);
    assert.deepEqual([task[1],task[4],task[5],task[6]],["owner","owner","job","original-actor"]);
    const [,event]=calls.find(([s])=>s.startsWith("INSERT INTO task_events"));
    const [deliverySql,delivery]=calls.find(([s])=>s.startsWith("INSERT INTO outbox_events"));
    assert.doesNotMatch(deliverySql,/organization_id|workspace_id/);
    assert.equal(delivery[0],event[0]);
    assert.equal(JSON.parse(delivery[1]).task_account_contract,25);
    for (const [table,id] of [["tasks",task[0]],["task_events",event[0]],["outbox_events",event[0]]])
      assert.ok(calls.some(([s,a])=>s.startsWith("INSERT INTO account_owned_records")&&a.join() === [table,id,"owner","shared"].join()));
    return;
  }
  assert.equal(result.status,"rate_limited");
  assert.ok(calls.some(([s,args])=>s.startsWith("UPDATE automation_executions SET status=?")&&args[0]==="rate_limited"));
  assert.ok(calls.some(([s,args])=>s.startsWith("INSERT INTO account_owned_records")&&args[1]==="owner"));
  assert.equal(calls.some(([s])=>s.startsWith("INSERT INTO tasks")),false);
});
