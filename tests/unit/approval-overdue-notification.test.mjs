import assert from "node:assert/strict";
import test from "node:test";
import { NotificationOutboxWorker } from "../../apps/worker/dist/notification-outbox-worker.js";

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event = {id:uuid(1), event_type:"approval.overdue", request_id:"original-request",trace_id:"original-trace"};
const payload = {approval_request_id:uuid(2),node_run_id:uuid(3),approval_action_id:uuid(4),
  account_projection_contract:25,active_approver_id:"untrusted"};
const current = {active_approver_id:"named-manager",id:uuid(3),account_id:"owner",reason:"shared",
  template_id:"template",template_version_id:"version",resource_type:"task",resource_id:"original-task"};
const workflowRow = {...current,requester:"requester",approver:"named",pending_node_id:uuid(3),first_node_id:uuid(3)};

function readLineage(sql,args,mode="matching",node=uuid(3),workflow=false) {
  if (sql.startsWith("SHOW COLUMNS FROM approval_templates ")) return [[{Field:"account_id"},{Field:"historical_context"}]];
  if (sql.startsWith("SHOW COLUMNS FROM tasks ")) return [[{Field:"account_id"}]];
  if (sql.startsWith("SELECT d.id definition_id")) {
    assert.match(sql,/d.template_version_id=\? AND d.ordinal=r.ordinal/);
    assert.match(sql,/t.account_id=\?/);
    assert.match(sql,/v.id=d.template_version_id .*t.id=v.template_id/);
    assert.deepEqual(args,["version","template","task",node,"owner"]);
    return [mode==="template-mismatch"?[]:[{definition_id:"definition"}]];
  }
  if (sql.startsWith("SELECT p.id parent_id")) {
    assert.match(sql,/FROM tasks p WHERE p.id=\? AND p.account_id=\? LOCK IN SHARE MODE$/);
    assert.deepEqual(args,["original-task","owner"]);
    return [mode==="resource-mismatch"?[]:[{parent_id:"original-task"}]];
  }
  if (sql.startsWith("SELECT account_id FROM account_owned_records")) {
    const resources=[["approval_template_nodes","definition"],["tasks","original-task"]];
    assert.deepEqual(args[0],workflow?resources:[["approval_templates","template"],["approval_template_versions","version"],...resources]);
    return [args[0].map(([table])=>({account_id:mode==="node-mismatch"&&table==="approval_template_nodes"?"other":"owner"}))];
  }
}

test("sealed overdue delivery binds the exact action, current node and account, not the payload recipient", async () => {
  for (const count of [0, 1, 2]) {
    const worker = new NotificationOutboxWorker({},30,3);
    const c = {query:async (sql,params)=>{
      if (sql.startsWith("SELECT contract_version")) return [[{contract_version:25,primary_account_id:"owner"}]];
      const lineage=readLineage(sql,params);
      if(lineage)return lineage;
      assert.match(sql,/n.ordinal=r.current_node_ordinal/);
      assert.match(sql,/a.actor_id=n.active_approver_id AND a.created_at=n.escalated_at/);
      assert.match(sql,/u.status='active'/);
      assert.match(sql,/a.id=\? LIMIT 2 LOCK IN SHARE MODE$/);
      for (const source of ["outbox_events","approval_actions","approval_requests","approval_node_runs"])
        assert.ok(sql.includes(`source_table='${source}'`));
      assert.deepEqual(params,[uuid(2),uuid(3),"original-request","original-trace",uuid(1),"owner",uuid(4)]);
      assert.match(sql,/eo.account_id/);
      return [Array.from({length:count},()=>current)];
    }};
    assert.deepEqual(await worker.approvalOverdueRecipients(c,event,payload),count===1?["named-manager"]:[]);
  }
});

test("account overdue delivery cannot fall back before seal; unmarked legacy delivery still can", async () => {
  const worker = new NotificationOutboxWorker({},30,3);
  const c = {query:async()=>[[]]};
  assert.deepEqual(await worker.approvalOverdueRecipients(c,event,payload),[]);
  assert.deepEqual(await worker.approvalOverdueRecipients(c,event,{active_approver_id:"legacy-named"}),["legacy-named"]);
});

test("overdue publication rechecks the lease and named recipient lineage in its transaction", async () => {
  for (const mode of ["matching","lease-lost","template-mismatch","resource-mismatch","node-mismatch"]) {
    const leaseLost=mode==="lease-lost";
    const calls = [];
    const now = new Date("2026-10-15T12:00:00Z");
    const c = { beginTransaction:async()=>{}, commit:async()=>calls.push("commit"),
      rollback:async()=>calls.push("rollback"), release:()=>{},
      query:async(sql,params)=>{
        if(sql.startsWith("SELECT *")) {
          assert.deepEqual(params,[event.id,8,now]);
          return [leaseLost?[]:[{...event,payload_json:payload}]];
        }
        if(sql.startsWith("SELECT contract_version")) return [[{contract_version:25,primary_account_id:"owner"}]];
        if(sql.startsWith("SELECT n.active_approver_id")) return [[current]];
        const lineage=readLineage(sql,params,mode);
        if(lineage)return lineage;
        if(sql.startsWith("UPDATE outbox_events")) { calls.push("published"); return [{affectedRows:1}]; }
        assert.fail(sql);
      }};
    const worker = new NotificationOutboxWorker({getConnection:async()=>c},30,3,()=>now);
    worker.create = async (_event,p,category,recipient,_now,db)=>{
      assert.equal(db,c);
      assert.deepEqual(p,{resource_type:"approval",resource_id:uuid(2)});
      assert.equal(category,"approval");
      assert.equal(recipient,"named-manager");
      calls.push("created");
      return true;
    };
    const result = await worker.publishGuarded({...event,version:7});
    assert.equal(result.status,leaseLost?"lease_lost":"published");
    assert.deepEqual(calls,leaseLost?["rollback"]:mode==="matching"?["created","published","commit"]:["published","commit"]);
  }
});

test("workflow publication does not write outside the current lease transaction", async () => {
  for (const mode of ["lost", "error", "ok"]) {
    const calls = [], now = new Date("2026-10-15T12:00:00Z");
    const workflow = { ...event, event_type: "approval.request.created", schema_version: 1,
      version: 7, payload_json: { id: uuid(2), resource_type: "task", resource_id: uuid(5) } };
    const c = {
      beginTransaction: async () => {}, commit: async () => calls.push("commit"),
      rollback: async () => calls.push("rollback"), release() {},
      async query(sql, args) {
        if (sql.startsWith("SELECT *") && !sql.includes("WHERE id=?")) return [[workflow]];
        if (sql.startsWith("UPDATE outbox_events SET status='leased'")) return [{ affectedRows: 1 }];
        if (sql.startsWith("SELECT *")) {
          assert.deepEqual(args, [workflow.id, 8, now]);
          return [mode === "lost" ? [] : [workflow]];
        }
        if (sql.startsWith("SELECT contract_version")) {
          assert.match(sql, /LOCK IN SHARE MODE$/);
          return [[{ contract_version: 25, primary_account_id: "owner" }]];
        }
        if (sql.startsWith("SELECT r.requested_by requester")) return [[{...workflowRow, approver:"approver"}]];
        const lineage=readLineage(sql,args,"matching",uuid(3),true);
        if(lineage)return lineage;
        if (sql.startsWith("UPDATE outbox_events SET status='published'")) {
          calls.push("published"); return [{ affectedRows: 1 }];
        }
        assert.fail(sql);
      },
    };
    const worker = new NotificationOutboxWorker({
      getConnection: async () => c,
      async query(sql, args) {
        assert.match(sql, /AND status='leased' AND version=\?$/);
        assert.equal(args.at(-1), 8);
        calls.push("retry");
      },
    }, 30, 3, () => now);
    worker.create = async (_event, p, category, recipient, _now, db) => {
      assert.equal(db, c);
      assert.deepEqual(p, { resource_type: "approval", resource_id: uuid(2) });
      assert.equal(category, "approval");
      calls.push(recipient);
      if (recipient === "approver" && mode === "error") throw new Error("fixture delivery failure");
      return true;
    };
    const result = await worker.processOnce();
    assert.equal(result.status, { lost: "lease_lost", error: "failed", ok: "published" }[mode]);
    assert.deepEqual(calls, {
      lost: ["commit", "rollback"],
      error: ["commit", "requester", "approver", "rollback", "retry"],
      ok: ["commit", "requester", "approver", "published", "commit"],
    }[mode]);
  }
});

test("account approval delivery requires sealed ownership and an exact original job or decision", async () => {
  for (const created of [true,false]) {
    const worker = new NotificationOutboxWorker({},30,3);
    const entry = {...event, schema_version:1, event_type:created ? "approval.request.created" : "approval.node.approved"};
    const p = {id:uuid(2), account_projection_contract:25, ...(created
      ? {approval_escalation_job_id:uuid(4)} : {node_run_id:uuid(3), approval_action_id:uuid(4)})};
    const args = [uuid(2), uuid(1), "owner", ...(created ? [] : [uuid(3),"approved"]), "original-request","original-trace",uuid(4)];
    let seal = true, mode="matching";
    const c = {query:async(sql,params)=>{
      if (sql.startsWith("SELECT contract_version")) return [seal ? [{contract_version:25,primary_account_id:"owner"}] : []];
      const node=sql.startsWith("SELECT d.id definition_id")?params[3]:uuid(3);
      const lineage=readLineage(sql,params,mode==="successor-mismatch"&&node===uuid(7)?"template-mismatch":mode,node,true);
      if(lineage)return lineage;
      assert.doesNotMatch(sql,/organization_id|workspace_id|r.request_id|r.trace_id/);
      assert.match(sql,/n.ordinal=r.current_node_ordinal/);
      assert.match(sql,created ? /original_run.ordinal=1.*j.node_run_id=original_run.id.*j.id=\?/ : /a.action=\?.*a.id=\?/);
      assert.deepEqual(params,args);
      return [[{...workflowRow,pending_node_id:mode==="successor-mismatch"?uuid(7):uuid(3)}]];
    }};
    assert.deepEqual(await worker.accountApprovalRecipients(entry,p,c),["requester","named"]);
    for (const bad of ["resource-mismatch","template-mismatch","node-mismatch"]) {
      mode=bad;
      assert.deepEqual(await worker.accountApprovalRecipients(entry,p,c),[]);
    }
    mode="successor-mismatch";
    assert.deepEqual(await worker.accountApprovalRecipients(entry,p,c),["requester"]);
    assert.deepEqual(await worker.accountApprovalRecipients({...entry,organization_id:"old"},p,c),[]);
    assert.deepEqual(await worker.accountApprovalRecipients(entry,{id:p.id,account_projection_contract:25},c),[]);
    seal = false;
    assert.deepEqual(await worker.accountApprovalRecipients(entry,p,c),[]);
  }
});

test("coordinate-free overdue delivery reads the named recipient's account preferences", async () => {
  const worker = new NotificationOutboxWorker({},30,3);
  const calls=[];
  const db={async query(sql,args) {
    calls.push([sql,args]);
    if (sql.startsWith("SHOW COLUMNS FROM notification_preferences"))
      return [[{Field:"historical_context"},{Field:"user_id"}]];
    assert.equal(sql,"SELECT * FROM notification_preferences WHERE user_id=?");
    assert.deepEqual(args,["named"]);
    return [[{approval_enabled:0}]];
  }};
  assert.equal(await worker.create({...event,organization_id:null,workspace_id:null},payload,"approval","named",new Date(),db),false);
  assert.equal(calls.length,2);
});
