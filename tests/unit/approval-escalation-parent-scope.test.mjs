import assert from "node:assert/strict";
import test from "node:test";
import { MySqlApprovalRepository } from "../../apps/api/dist/mysql-approval-repository.js";
import { ApprovalEscalationWorker } from "../../apps/worker/dist/approval-escalation-worker.js";

const now = new Date("2026-10-15T12:00:00Z");
const job = {
  id: "job",
  approval_request_id: "request",
  node_run_id: "node",
  request_id: "correlation",
  trace_id: "trace",
  attempt_count: 1,
};
const run = {
  id: "node",
  status: "pending",
  request_status: "pending",
  escalation_assignee_id: "original-named-escalator",
  organization_id: "parent-org",
  workspace_id: "parent-ws",
  template_id: "template",
  template_version_id: "template-version",
  resource_type: "task",
  resource_id: "original-task",
};

test("new escalation jobs store only their exact approval request and node", async () => {
  const repository = new MySqlApprovalRepository({});
  let observed;
  await repository.insertJob(
    {
      async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM approval_templates ")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
        observed = [sql, args];
      },
    },
    {
      organizationId: "ignored",
      workspaceId: "ignored",
      requestId: "correlation",
      traceId: "trace",
    },
    job.approval_request_id,
    job.node_run_id,
    now,
    now,
  );
  const [sql, args] = observed;
  assert.match(sql, /\(id,approval_request_id,node_run_id,/);
  assert.doesNotMatch(sql, /organization_id|workspace_id/);
  assert.equal((sql.match(/\?/g) ?? []).length, args.length);
  assert.deepEqual(args.slice(1), ["request", "node", now, "correlation", "trace", now, now]);
});

for (const belongsToRequest of [true, false]) {
  test(`worker keeps the named escalator and requires the exact parent: ${belongsToRequest}`, async () => {
    const calls = [];
    const connection = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {
        assert.fail("unexpected rollback");
      },
      release() {},
      async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM approval_templates ")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
        calls.push([sql, args]);
        if (sql.startsWith("SELECT *")) return [[job]];
        if (sql.startsWith("SELECT r.")) return [belongsToRequest ? [run] : []];
        if (sql.startsWith("SELECT cut.primary_account_id")) return [[]];
        if (sql.startsWith("SELECT t.organization_id,t.workspace_id")) return [[run]];
        return [{ affectedRows: 1 }];
      },
    };
    const worker = new ApprovalEscalationWorker(
      {
        async getConnection() {
          return connection;
        },
      },
      "worker",
      30,
      () => now,
    );
    assert.deepEqual(await worker.processOnce(), {
      status: "succeeded",
      job_id: job.id,
      escalated: belongsToRequest,
    });
    const [scopeSql, args] = calls.find(([sql]) => sql.startsWith("SELECT r."));
    assert.match(
      scopeSql,
      /JOIN approval_requests q ON q.id=r.approval_request_id JOIN approval_templates t ON t.id=q.template_id AND t.resource_type=q.resource_type JOIN approval_template_versions v ON v.id=q.template_version_id AND v.template_id=t.id JOIN approval_escalation_jobs j ON j.node_run_id=r.id AND j.approval_request_id=q.id/,
    );
    assert.doesNotMatch(scopeSql, /organization_id|workspace_id/);
    assert.equal(calls.some(([sql])=>sql.startsWith("SELECT t.organization_id,t.workspace_id")),belongsToRequest);
    assert.match(scopeSql, /j.attempt_count=\? AND j.lease_expires_at>\? FOR UPDATE/);
    assert.match(scopeSql, /r.ordinal=q.current_node_ordinal/);
    assert.deepEqual(args, ["node", "request", "job", "worker", 2, now]);
    const writes = calls.filter(([sql]) => sql.startsWith("INSERT"));
    if (!belongsToRequest) {
      assert.deepEqual(writes, []);
      const [finish, finishArgs] = calls.at(-1);
      assert.match(finish, /status='leased' AND lease_owner=\? AND attempt_count=\? AND lease_expires_at>\?$/);
      assert.deepEqual(finishArgs, [now, "job", "worker", 2, now]);
      return;
    }
    const action = writes.find(([sql]) => sql.startsWith("INSERT INTO approval_actions"))[1];
    assert.deepEqual(action.slice(1), [
      "request",
      "node",
      run.escalation_assignee_id,
      "correlation",
      "trace",
      now,
    ]);
    const audit = writes.find(([sql]) => sql.startsWith("INSERT INTO audit_logs"))[1];
    const outbox = writes.find(([sql]) => sql.startsWith("INSERT INTO outbox_events"))[1];
    assert.deepEqual(audit.slice(1, 4), [
      run.organization_id,
      run.workspace_id,
      run.escalation_assignee_id,
    ]);
    assert.deepEqual(outbox.slice(1, 3), [run.organization_id, run.workspace_id]);
    assert.equal(JSON.parse(outbox[3]).active_approver_id, run.escalation_assignee_id);
  });
}

for (const mode of ["valid", "native-outbox", "partial-outbox", "owner-mismatch", "missing-cutover", "schema-not-ready", "lease-lost",
  "stale-noop-lease", "named-node-changed", "outbox-failure", "native-resource-mismatch", "native-template-mismatch",
  "node-definition-mismatch", "opportunity-decision", "opportunity-decision-mismatch"]) {
  test(`sealed escalation checks parents and records ownership: ${mode}`, async () => {
    const calls = [];
    const decision=mode.startsWith("opportunity-decision");
    let rolls=0;
    const c = {beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{rolls++;},release:()=>{},
      query:async (sql, args) => {
        calls.push([sql,args]);
        if (sql.startsWith("SELECT *")) return [[job]];
        if (sql.startsWith("SELECT r.")) {
          assert.doesNotMatch(sql,/organization_id|workspace_id/);
          if (mode==="stale-noop-lease") return [[]];
          const {organization_id,workspace_id,...accountRun}=run;
          return [[decision?{...accountRun,resource_type:"opportunity_decision",resource_id:"decision"}:accountRun]];
        }
        if (sql.startsWith("SELECT cut.primary_account_id")) {
          assert.deepEqual(args, ["approval_requests", "request"]);
          return [mode==="missing-cutover"?[]:[{primary_account_id:"owner",account_id:"owner",reason:"shared"}]];
        }
        if (sql.startsWith("SELECT account_id FROM account_owned_records")) {
          assert.deepEqual(args[0], [["approval_escalation_jobs","job"],["approval_node_runs","node"],["approval_templates","template"],["approval_template_versions","template-version"],["approval_template_nodes","definition"],...(decision?[["opportunities","original-opportunity"],["opportunity_decisions","decision"]]:[["tasks","original-task"]])]);
          return [Array.from({length:decision?7:6}, (_,i)=>({account_id:(mode==="owner-mismatch"&&i===0)||(mode==="node-definition-mismatch"&&i===4)||(mode==="opportunity-decision-mismatch"&&i===6)?"foreign":"owner"}))];
        }
        if (sql.startsWith("SHOW COLUMNS FROM approval_templates ")) return [[{Field:"account_id"},{Field:"historical_context"}]];
        if (/^SHOW COLUMNS FROM (tasks|opportunities) /.test(sql)) return [[{Field:"account_id"}]];
        if (sql.startsWith("SELECT d.id definition_id")) {
          assert.match(sql,/d.template_version_id=\? AND d.ordinal=r.ordinal/);
          assert.match(sql,/t.account_id=\?/);
          return [mode==="native-template-mismatch"?[]:[{definition_id:"definition"}]];
        }
        if (sql.startsWith("SELECT p.id parent_id FROM tasks")) {
          assert.match(sql,/p.account_id=\?/);
          assert.deepEqual(args,["original-task","owner"]);
          return [mode==="native-resource-mismatch"?[]:[{parent_id:"original-task"}]];
        }
        if (sql.startsWith("SELECT p.id parent_id FROM opportunity_decisions")) {
          assert.match(sql,/p.id=d.opportunity_id WHERE d.id=\? AND p.account_id=\?/);
          assert.deepEqual(args,["decision","owner"]);
          return [[{parent_id:"original-opportunity"}]];
        }
        if (sql.startsWith("SHOW COLUMNS FROM outbox_events"))
          return [[{Field:"organization_id",Null:mode==="schema-not-ready"?"NO":"YES"},{Field:"workspace_id",Null:"YES"}]
            .slice(0, mode==="native-outbox"?0:mode==="partial-outbox"?1:2)];
        if (args && !sql.startsWith("INSERT INTO account_owned_records"))
          assert.equal((sql.match(/\?/g)??[]).length,args.length,sql);
        if (sql.startsWith("UPDATE approval_escalation_jobs SET status='succeeded'")) {
          assert.match(sql,/lease_expires_at>\?$/);
          return [{affectedRows:mode==="lease-lost" || mode==="stale-noop-lease" ? 0 : 1}];
        }
        if (sql.startsWith("UPDATE approval_node_runs")) {
          assert.match(sql,/WHERE id=\? AND approval_request_id=\? AND status='pending' AND escalated_at IS NULL AND escalation_assignee_id=\?$/);
          assert.deepEqual(args,[now,now,"node","request",run.escalation_assignee_id]);
          return [{affectedRows:mode==="named-node-changed"?0:1}];
        }
        if (mode==="outbox-failure" && sql.startsWith("INSERT INTO outbox_events"))
          throw new Error("driver error containing private row payload");
        return [{affectedRows:1}];
      }};
    const w=new ApprovalEscalationWorker({getConnection:async()=>c,query:c.query}, "worker", 30, ()=>now);
    const succeeds = mode==="valid" || mode==="native-outbox" || mode==="opportunity-decision";
    assert.equal((await w.processOnce()).status,succeeds?"succeeded":"failed");
    const writes=calls.filter(([s])=>s.startsWith("INSERT"));
    assert.equal(rolls,succeeds?0:1);
    if(mode==="outbox-failure") {
      assert.ok(writes.some(([sql])=>sql.startsWith("INSERT INTO approval_actions")));
      assert.ok(!writes.some(([sql])=>sql.startsWith("INSERT INTO account_owned_records")));
      assert.equal(calls.at(-1)[1][1],"approval_escalation_dependency_failed");
      assert.match(calls.at(-1)[0], /lease_expires_at>\?$/);
    } else if(!succeeds && mode!=="lease-lost") {
      assert.equal(writes.length,0);
      assert.match(calls.at(-1)[0], /lease_expires_at>\?$/);
      assert.deepEqual(calls.at(-1)[1].slice(-4), ["job","worker",2,now]);
      if(mode==="named-node-changed") assert.equal(calls.at(-1)[1][1],"approval_escalation_node_changed");
      if(mode==="stale-noop-lease") assert.equal(calls.at(-1)[1][1],"approval_escalation_lease_lost");
      if(mode==="missing-cutover") assert.equal(calls.at(-1)[1][1],"approval_escalation_owner_mismatch");
    } else {
      const find=(table)=>writes.find(([s])=>s.startsWith("INSERT INTO "+table))[1];
      assert.deepEqual(find("account_owned_records")[0], [["approval_actions",find("approval_actions")[0],"owner","shared"],["outbox_events",find("outbox_events")[0],"owner","shared"]]);
      const payload = JSON.parse(find("outbox_events")[1]);
      assert.equal(payload.active_approver_id,run.escalation_assignee_id);
      assert.equal(payload.approval_action_id,find("approval_actions")[0]);
      assert.equal(payload.account_projection_contract,25);
      assert.equal(find("platform_audit_events")[1],run.escalation_assignee_id);
      assert.ok(!writes.some(([sql])=>sql.startsWith("INSERT INTO audit_logs")));
      assert.doesNotMatch(writes.find(([sql])=>sql.startsWith("INSERT INTO outbox_events"))[0],/organization_id|workspace_id/);
    }
  });
}
