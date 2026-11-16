import test from "node:test";
import assert from "node:assert/strict";
import { MySqlOpportunityRefreshWorker } from "../../apps/worker/dist/opportunity-refresh-worker.js";

for (const mode of ["owned", "native", "wrong_native_owner", "wrong_native_topic", "wrong_job_owner", "missing_parent_owner",
  "wrong_link_owner", "stale_lease", "expired_before_completion", "outbox_failure", "manual", "manual_wrong_owner"]) {
  test(`opportunity refresh: ${mode}`, async () => {
    const calls = [], transactions = [];
    const now = new Date("2026-11-01T00:00:00Z");
    const manual = mode.startsWith("manual");
    const parent = { source_type: manual ? "manual" : "trend_topic", source_ref_id: manual ? null : "topic" };
    const native = manual || ["native", "wrong_native_owner", "wrong_native_topic", "expired_before_completion"].includes(mode);
    const succeeds = mode === "owned" || mode === "native";
    const connection = {
      beginTransaction: async () => transactions.push("begin"), commit: async () => transactions.push("commit"),
      rollback: async () => transactions.push("rollback"), release: () => {},
      query: async (sql, params = []) => {
        calls.push({sql, params});
        assert.equal((sql.match(/\?/g) ?? []).length, params.length);
        if (sql.startsWith("SELECT j.*")) return [[{...parent,id:"job",opportunity_id:"opp",attempt_count:1,request_id:"request",trace_id:"trace"}]];
        if (sql.startsWith("SELECT o.source_type")) return [mode === "stale_lease" ? [] : [parent]];
        if (sql.startsWith("SHOW COLUMNS FROM opportunities")) return [(native ? ["account_id"] : ["organization_id","workspace_id"]).map(Field=>({Field}))];
        if (sql.startsWith("SELECT account_id FROM opportunities"))
          return [[{account_id:mode==="wrong_native_owner"?"other":"account"}]];
        if (sql.startsWith("SELECT id FROM trend_topics WHERE")) {
          assert.deepEqual(params,["topic","account"]);
          return [mode === "wrong_native_topic" ? [] : [{id:"topic"}]];
        }
        if (sql.startsWith("SELECT cut.primary_account_id")) return [[{primary_account_id:"account",account_id:mode === "missing_parent_owner" ? null : "account",reason:"shared"}]];
        if (sql.startsWith("SELECT account_id FROM account_owned_records")) {
          assert.deepEqual(params[0], [["opportunity_refresh_jobs","job"], ...(manual ? [] : [["trend_topics","topic"]])]);
          return [params[0].map(([table])=>({account_id:table==="opportunity_refresh_jobs" &&
            ["wrong_job_owner","manual_wrong_owner"].includes(mode) ? "other" : "account"}))];
        }
        if (sql.startsWith("SELECT s.id")) return [[{id:"signal",provider_id:"provider",raw_evidence_id:"raw",observed_at:now,link_id:null}]];
        if (sql.startsWith("SELECT l.id")) {
          assert.match(sql,/ot.source_table='trend_topics' AND ot.source_id=t.id AND ot.account_id=\?/);
          assert.equal(sql.includes("t.account_id<=>ot.account_id"),native);
          return [mode === "wrong_link_owner" ? [{id:"bad"}] : []];
        }
        if (sql.startsWith("SELECT COUNT")) return [[{evidence_count:1,source_count:1}]];
        if (sql.startsWith("SELECT o.recommendation_status")) return [[{decision_status:"pending",recommendation_status:"insufficient_data"}]];
        if (sql.startsWith("SHOW COLUMNS FROM opportunity_events")) return [[]];
        if (sql.startsWith("SHOW COLUMNS FROM opportunity_outbox")) return [[{Field:"event_id"}]];
        if (mode === "outbox_failure" && sql.startsWith("INSERT INTO opportunity_outbox")) throw new Error("outbox_fault");
        if (sql.startsWith("UPDATE opportunity_refresh_jobs SET status=?") && sql.includes("last_error_code=NULL")) {
          assert.match(sql,/status='leased' AND lease_expires_at>UTC_TIMESTAMP\(3\)/);
          return [{affectedRows:mode==="expired_before_completion"?0:1}];
        }
        return [{affectedRows:1}];
      },
    };
    const worker = new MySqlOpportunityRefreshWorker({getConnection:async () => connection, query:connection.query}, "worker", 30, () => now);
    const result = await worker.processOnce();
    assert.equal(result.status, succeeds ? "succeeded" : mode === "manual" ? "succeeded_empty" :
      mode === "outbox_failure" ? "scheduled" : "failed_terminal", result.diagnostic);
    assert.ok(calls.some(({sql,params}) => sql.includes("lease_owner=? AND attempt_count=?") && params.at(-1) === 2));
    const inserted = calls.find(({sql}) => sql.startsWith("INSERT INTO opportunity_evidence_links"));
    if (mode === "outbox_failure" || mode === "expired_before_completion") {
      assert.ok(inserted);
      assert.deepEqual(transactions, ["begin","commit","begin","rollback"]);
      if(mode==="expired_before_completion") assert.ok(!calls.some(({sql})=>sql.startsWith("INSERT INTO opportunity_events")));
      return;
    }
    if (!succeeds) {
      assert.equal(inserted, undefined);
      assert.ok(!calls.some(({sql}) => sql.startsWith("INSERT INTO opportunity_events")));
      return;
    }
    const read = calls.find(({sql}) => sql.startsWith("SELECT s.id"));
    for (const {sql} of calls) if (!sql.startsWith("SHOW COLUMNS")) assert.doesNotMatch(sql, /workspace_id|organization_id/);
    if (native) {
      assert.match(read.sql,/r.account_id=so.account_id|r.account_id=ro.account_id/);
      assert.ok(calls.some(({sql})=>sql.startsWith("UPDATE opportunities") && sql.includes("opportunities.account_id=?")));
    }
    const requeue = calls.find(({sql}) => sql.startsWith("INSERT INTO automatic_selection_evaluations"));
    assert.match(requeue.sql,/a.source_id=o.id AND a.account_id=\?/);
    assert.equal(requeue.sql.includes("o.account_id=a.account_id"),native);
    assert.deepEqual(requeue.params,[now,now,now,"account","opp"]);
    const event = calls.find(({sql}) => sql.startsWith("INSERT INTO opportunity_events"));
    const delivery = calls.find(({sql}) => sql.startsWith("INSERT INTO opportunity_outbox"));
    assert.deepEqual(delivery.params.slice(0,4), [event.params[0],event.params[0],"opportunity.evidence.refreshed","opp"]);
    assert.doesNotMatch(read.sql, /workspace_id|organization_id/);
    assert.deepEqual(read.params, ["account","account","opp","topic"]);
    assert.deepEqual(inserted.params.slice(1,5), ["opp","signal","provider","raw"]);
    const owners = calls.filter(({sql}) => sql.startsWith("INSERT INTO account_owned_records")).flatMap(({params}) => params[0]);
    assert.deepEqual(owners.map(row => [row[0], row[2]]), [["opportunity_evidence_links","account"],["opportunity_events","account"],["opportunity_outbox","account"]]);
  });
}
