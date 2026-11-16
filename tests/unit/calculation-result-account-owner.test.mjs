import test from "node:test";
import assert from "node:assert/strict";
import { MySqlOpportunityScoringWorker } from "../../apps/worker/dist/opportunity-scoring-worker.js";
import { MySqlOpportunityProfitWorker } from "../../apps/worker/dist/opportunity-profit-worker.js";

test("profit without an account owner still checks the original workspace", async () => {
  const calls = [];
  const c = {
    beginTransaction: async () => {},
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (sql, params) => {
      if (sql.startsWith("SELECT cut.primary_account_id"))
        return [[{ primary_account_id: "primary", account_id: null }]];
      if (sql.startsWith("SHOW COLUMNS FROM cost_rules"))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      assert.match(sql, /FROM cost_rules WHERE id=\? AND organization_id=\? AND workspace_id=\?/);
      assert.deepEqual(params, ["rule", "org", "workspace"]);
      return [[]];
    },
  };
  const worker = new MySqlOpportunityProfitWorker({ getConnection: async () => c }, "worker", 120);
  await assert.rejects(worker.calculate({ ruleId: "rule", opportunityId: "opportunity",
    organizationId: "org", workspaceId: "workspace" }), { code: "cost_rule_unavailable" });
  assert.deepEqual(calls, ["rollback", "release"]);
});

for (const [kind,Worker,ruleTable] of [
  ["score",MySqlOpportunityScoringWorker,"score_rules"],["profit",MySqlOpportunityProfitWorker,"cost_rules"],
]) {
  for (const mode of ["shared","exclusive_owner","missing_job_ledger","foreign_rule","foreign_input","ledger_error",
    "native_match","native_foreign_rule","native_foreign_opportunity",
    ...(kind === "score" ? ["owned_trigger", "wrong_trigger_source", "foreign_trigger", "cross_workspace_quality_blocked", "owned_reconciliation_failed", "missing_owned_evidence"] : [])]) {
    test(`${kind} result account: ${mode}`,async()=>{
      const actions=[],writes=[],ledger=[], reminders=[], nativeRequeues=[];
      const native=mode.startsWith("native_");
      const owner=mode==="exclusive_owner"?"other":"primary", reason=mode==="exclusive_owner"?mode:"shared";
      const now=new Date("2026-10-15T12:00:00Z"), job={id:"job",opportunityId:"opportunity",ruleId:"rule",
        organizationId:"org",workspaceId:"ws",requestId:"req",traceId:"trace",
        triggerTaskId:mode.includes("trigger")?"original-task":null,attemptCount:1};
      const c={beginTransaction:async()=>actions.push("begin"),commit:async()=>actions.push("commit"),
        rollback:async()=>actions.push("rollback"),release:()=>actions.push("release"),
        query:async(sql,v=[])=>{
          if(sql.startsWith("SELECT cut.primary_account_id")) return [[{primary_account_id:"primary",account_id:owner,reason}]];
          if(sql.startsWith(`SHOW COLUMNS FROM ${ruleTable}`))
            return [(native ? ["account_id","historical_context"] : ["organization_id","workspace_id"]).map(Field=>({Field}))];
          if(sql.startsWith("SHOW COLUMNS FROM opportunities"))
            return [(native ? ["account_id"] : ["organization_id","workspace_id"]).map(Field=>({Field}))];
          if(sql.startsWith(`SELECT id FROM opportunity_${kind}_jobs`)) {
            assert.deepEqual(v.slice(0,3),["job","opportunity","rule"]);
            assert.match(sql,/attempt_count=\? AND lease_expires_at>UTC_TIMESTAMP\(3\) FOR UPDATE$/);
            assert.equal(v.at(-1), job.attemptCount);
            return [[{id:"job"}]];
          }
          if(sql.startsWith("SELECT account_id FROM account_owned_records")) return [v[0].flatMap(([t])=>
            t.endsWith("_jobs") && mode==="missing_job_ledger" ? [] :
              [{account_id:mode==="foreign_rule"&&t===ruleTable||mode==="foreign_input"&&t.endsWith("_inputs")||
                mode==="foreign_trigger"&&t==="tasks"?"foreign":owner}])];
          if(sql.startsWith("SELECT t.assignee_id FROM tasks")){
            assert.deepEqual(v,["original-task",owner,"opportunity"]);
            assert.match(sql,/t.source_ref_id=\?/);
            assert.match(sql,/t.deleted_at IS NULL/);
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            return [mode==="owned_trigger"?[{assignee_id:"historical-assignee",workspace_id:"previous"}]:[]];
          }
          if(sql.startsWith("SELECT version_code,dimensions_json")) {
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            assert.deepEqual(v,native?["rule",owner]:["rule"]);
            if (native) assert.match(sql, /id=\? AND account_id=\?/);
            if (mode==="native_foreign_rule") return [[]];
            return [[{version_code:"v1",dimensions_json:["market_demand","competition","profit","risk","data_quality"]
              .map(code=>({code,weight:20,required:true,evidence_group:code==="profit"?"cost":code})),
              thresholds_json:{recommend_min:70,observe_min:50}}]];
          }
          if(sql.startsWith("SELECT * FROM cost_rules")) {
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            assert.deepEqual(v,native?["rule",owner]:["rule"]);
            if (native) assert.match(sql, /id=\? AND account_id=\?/);
            if (mode==="native_foreign_rule") return [[]];
            return [[{market:"US",platform:"amazon",fee_lines_json:[],conversion_rates_json:[],version_code:"v1"}]];
          }
          if(sql.startsWith("SELECT market FROM opportunities")) {
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            assert.deepEqual(v,native?["opportunity",owner]:["opportunity"]);
            if (native) assert.match(sql, /id=\? AND account_id=\?/);
            if (mode==="native_foreign_opportunity") return [[]];
            return [[{market:"US"}]];
          }
          if(sql.startsWith("UPDATE opportunities SET profit_status")) {
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            assert.deepEqual(v.slice(1),[now,"opportunity"]);
            return [{affectedRows:1}];
          }
          if(sql.startsWith("SELECT id,owner_id FROM opportunities")) {
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            assert.deepEqual(v,native?["opportunity",owner]:["opportunity"]);
            if (native) assert.match(sql, /id=\? AND account_id=\?/);
            if (mode==="native_foreign_opportunity") return [[]];
            return [[{id:"opportunity",market:"US"}]];
          }
          if(sql.startsWith("SELECT e.id evidence_id")) {
            assert.match(sql,/WHERE e.id IN \(\?\)/);
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            assert.match(sql,/ro.source_table='reconciliation_runs'.*ro.source_id=r.id AND ro.account_id=\?/);
            assert.match(sql,/i.raw_evidence_id=e.id AND i.status='open' AND i.severity='critical'/);
            assert.deepEqual(v,[owner,"raw"]);
            if(mode==="missing_owned_evidence") return [[]];
            return [[{evidence_id:"raw",reconciliation_status:mode==="owned_reconciliation_failed"?"failed":"passed",
              critical_issue_count:mode==="cross_workspace_quality_blocked"?1:0}]];
          }
          if(sql.startsWith("UPDATE opportunities SET overall_score")) {
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            assert.equal(v.at(-1),"opportunity");
            return [{affectedRows:1}];
          }
          if(sql.startsWith("SELECT * FROM opportunity_score_inputs"))
            return [[{id:"input",input_version:1,dimension_code:"market_demand",evidence_group:"market",
              score_value:80,evidence_ids_json:["raw"],missing_fields_json:[]}]];
          if(sql.startsWith("SELECT * FROM opportunity_cost_inputs"))
            return [[{id:"input",input_type:"sale_price",amount_value:25,currency:"USD",evidence_id:"raw",source_ref_id:"source"}]];
          if(sql.startsWith("SHOW COLUMNS FROM opportunity_outbox")) return [[{Field:"event_id"}]];
          if(sql.startsWith("SHOW COLUMNS FROM outbox_events")) return [[]];
          if(sql.startsWith("SHOW COLUMNS FROM normalized_records"))
            return [[{Field:"organization_id"},{Field:"workspace_id"}]];
          if(sql.startsWith("SHOW COLUMNS")||sql.startsWith("SELECT")) return [[]];
          if(sql.startsWith("INSERT INTO account_owned_records")){
            if(mode==="ledger_error"&&v[0][0][0]==="opportunity_events") throw Error("fixture_ledger_failure");
            ledger.push(...v[0]);return [{affectedRows:v[0].length}];
          }
          const name=/^INSERT INTO (\w+)/.exec(sql)?.[1];
          if(name) writes.push([name,v[0]]);
          if(name==="automatic_selection_evaluations" && native) {
            assert.match(sql,/a\.account_id=\? WHERE o\.id=\? AND o\.account_id=a\.account_id/);
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            assert.deepEqual(v,[now,now,now,owner,"opportunity"]);
            nativeRequeues.push(v);
          }
          if(name==="outbox_events" && sql.includes("task.evidence_completion.redecision_ready")) {
            assert.doesNotMatch(sql,/organization_id|workspace_id/);
            reminders.push(JSON.parse(v[1]));
          }
          if(/^(UPDATE|INSERT)/.test(sql)) return [{affectedRows:1}];
          throw Error("Unexpected query "+sql);
        }};
      const w=new Worker({getConnection:async()=>c},"worker",120,()=>now);
      if (mode.startsWith("native_foreign_")) {
        const code=mode.endsWith("_rule") ? (kind==="score"?"score_rule_unavailable":"cost_rule_unavailable")
          : (kind==="score"?"opportunity_scope_missing":"profit_scope_or_market_mismatch");
        await assert.rejects(w.calculate(job),{code});
        assert.deepEqual(actions,["begin","rollback","release"]);
        assert.deepEqual(writes,[]);
        return;
      }
      if(["cross_workspace_quality_blocked","owned_reconciliation_failed","missing_owned_evidence"].includes(mode)) {
        await assert.rejects(w.calculate(job),{code:"score_blocked_by_data_quality_regression"});
        assert.deepEqual(actions,["begin","rollback","release"]);
        assert.deepEqual(writes,[]);
        return;
      }
      if(mode.startsWith("foreign")||mode==="ledger_error"){
        await assert.rejects(w.calculate(job),mode==="ledger_error"?{message:"fixture_ledger_failure"}:
          {code:`opportunity_${kind}_${mode==="foreign_input"?"input_":""}owner_mismatch`});
        assert.deepEqual(actions,["begin","rollback","release"]);
        if(mode.startsWith("foreign")) assert.deepEqual(writes,[]);
        return;
      }
      await w.calculate(job);
      assert.equal(nativeRequeues.length,kind==="profit" && native ? 1 : 0);
      const names=[`opportunity_${kind}_runs`,`opportunity_${kind}_components`,"opportunity_events","opportunity_outbox",
        ...(mode==="owned_trigger"?["outbox_events"]:[])];
      assert.deepEqual(ledger.sort(),writes.filter(([t])=>names.includes(t)).map(([t,id])=>[t,id,owner,reason]).sort());
      assert.ok(names.every(t=>ledger.some(x=>x[0]===t)));
      assert.equal(reminders.length,mode==="owned_trigger"?1:0);
      if(reminders[0]){
        assert.equal(reminders[0].recipient_id,owner);
        assert.equal(reminders[0].opportunity_id,job.opportunityId);
        assert.equal(reminders[0].trigger_task_id,job.triggerTaskId);
        assert.ok(ledger.some(([t,,a])=>t==="outbox_events"&&a===owner));
      }
      assert.deepEqual(actions,["begin","commit","release"]);
    });
  }
}

test("a stale scoring failure does not emit a quality audit; profit failure uses the same lease guard", async () => {
  for (const [kind, Worker] of [["score", MySqlOpportunityScoringWorker], ["profit", MySqlOpportunityProfitWorker]]) {
    const statements = [];
    const c = { beginTransaction: async () => {}, commit: async () => {}, release() {},
      async query(sql, args) {
        statements.push(sql);
        assert.match(sql, new RegExp(`^UPDATE opportunity_${kind}_jobs`));
        assert.match(sql, /status='leased' AND attempt_count=\? AND lease_expires_at>UTC_TIMESTAMP\(3\)$/);
        assert.deepEqual(args.slice(-3), ["job", "worker", 1]);
        return [{ affectedRows: 0 }];
      },
    };
    const worker = new Worker({ getConnection: async () => c, query: c.query }, "worker", 120);
    await worker.finish({ id: "job", attemptCount: 1 }, "failed_terminal", "score_blocked_by_data_quality_regression");
    assert.equal(statements.length, 1);
  }
});
