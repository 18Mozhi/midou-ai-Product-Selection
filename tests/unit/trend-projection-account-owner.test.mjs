import test from "node:test";
import assert from "node:assert/strict";
import { ownedTrendTopicLookupSql, TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";
import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";

const now = new Date("2026-10-15T12:00:00Z");
const job = {
  id:"job", organizationId:"org", workspaceId:"ws", providerCode:"google_news_search",
  providerId:"provider", rawEvidenceId:"raw", normalizedRecordId:"record", collectionTaskId:"task",
  actorId:"collector", requestId:"request", traceId:"trace", attemptCount:1,
  payload:{title:"Portable fan", publisher:"Test", canonical_url:"https://example.test/article",
    observed_at:now.toISOString()},
};

const evidenceColumns = native => [(native ? ["account_id"] : ["organization_id", "workspace_id"]).map(Field => ({ Field }))];
for (const mode of ["shared", "exclusive_owner", "foreign_topic", "foreign_evidence", "ledger_error", "native_reuse", "native_foreign_task", "native_new_topic"]) {
  test(`trend projection ownership: ${mode}`, async () => {
    const owner = mode === "exclusive_owner" ? "exclusive" : "primary";
    const calls = [], ledger = [];
    const c = {
      beginTransaction:async()=>calls.push(["begin"]), commit:async()=>calls.push(["commit"]),
      rollback:async()=>calls.push(["rollback"]), release:()=>calls.push(["release"]),
      query:async(sql,v=[])=>{
        if (sql.startsWith("SHOW COLUMNS FROM normalized_records")) return evidenceColumns(mode.startsWith("native_"));
        if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return evidenceColumns(mode.startsWith("native_"));
        if (sql.startsWith("SHOW COLUMNS FROM trend_topics")) return evidenceColumns(mode === "native_new_topic");
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") && sql.includes("historical_context")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        calls.push([sql,v]);
        if (sql.startsWith("SELECT id FROM trend_projection_jobs")) {
          assert.deepEqual(v, [job.id, "leased-record", "worker", job.attemptCount, now]); return [[{id:job.id}]];
        }
        if (sql.startsWith("SELECT cut.primary_account_id")) {
          if (mode.startsWith("native_")) {
            assert.doesNotMatch(sql, /\bn\.(organization_id|workspace_id)/);
            assert.match(sql, /tor.source_id=t.id AND tor.account_id=r.account_id/);
            assert.match(sql, /WHERE lo.account_id=r.account_id AND l.collection_task_id=t.id AND l.normalized_record_id=n.id AND l.raw_evidence_id=r.id AND l.provider_id=r.provider_id/);
            assert.match(sql, /t.account_id=r.account_id/);
            assert.doesNotMatch(sql, /\bt\.(organization_id|workspace_id)/);
            assert.deepEqual(v,["record","raw","provider","task"]);
          }
          return [[{record_id:job.normalizedRecordId,account_id:owner,primary_account_id:"primary",
            evidence_account_id:mode==="foreign_evidence"?"other":owner,
            native_task_owned:mode==="native_foreign_task"?0:1, reason:mode==="exclusive_owner"?mode:"shared"}]];
        }
        if (sql === ownedTrendTopicLookupSql) {
          assert.equal(v[0],owner);
          assert.equal(v[1],job.normalizedRecordId);
          assert.doesNotMatch(sql,/organization_id|workspace_id/);
          assert.match(sql,/ORDER BY \(existing.id IS NOT NULL\) DESC/);
          return [[{id:"original-topic"}]];
        }
        if (sql.startsWith("SELECT id FROM users WHERE id=? FOR UPDATE")) {
          assert.deepEqual(v,[owner]);
          return [[{id:owner}]];
        }
        if (sql.includes("WHERE t.account_id=o.account_id")) {
          assert.equal(mode,"native_new_topic");
          assert.equal(v[0],owner);
          return [[]];
        }
        if (sql.startsWith("INSERT INTO trend_topics") && mode === "native_new_topic") {
          assert.match(sql,/\(id,account_id,topic_key/);
          assert.equal(v[1],owner);
          assert.equal(sql.match(/\?/g).length,v.length);
          assert.ok(calls.some(([s])=>s.startsWith("SELECT id FROM users")));
        }
        if (sql.startsWith("SELECT id FROM trend_topics")) return [mode==="foreign_topic"?[{id:"foreign"}]:[]];
        if (sql.startsWith("SELECT account_id FROM account_owned_records"))
          return [[{account_id:v[1]==="foreign"?"other":owner}]];
        if (sql.startsWith("SELECT r.* FROM trend_monitoring_rules")) {
          assert.deepEqual(v,[owner]);
          assert.doesNotMatch(sql,/organization_id|workspace_id/);
          assert.match(sql,/WHERE o.account_id=\?/);
          const rule = { include_keywords_json:["portable"], negative_keywords_json:[], created_by:"creator" };
          return [[{...rule,id:"own-rule",account_id:owner,workspace_id:"previous-workspace"},{...rule,id:"diverged-rule",account_id:"other"}]];
        }
        if (sql.startsWith("SHOW COLUMNS")) return [[]];
        if (sql.startsWith("INSERT INTO account_owned_records")) {
          if (mode==="ledger_error" && v[0][0][0]==="trend_events") throw Error("fixture_ledger_error");
          ledger.push(...v[0]);
        }
        if (/^(INSERT|UPDATE)/.test(sql)) return [{affectedRows:1}];
        throw Error("Unexpected query "+sql);
      },
    };
    const repo = new TrendProjectionPersistence({getConnection:async()=>c},"worker",()=>now);
    const input = {...job,leasedNormalizedRecordId:"leased-record"};
    if (mode.startsWith("foreign") || mode === "ledger_error" || mode === "native_foreign_task") {
      await assert.rejects(repo.project(input), mode === "ledger_error" ? /fixture_ledger_error/ :
        {code:mode==="foreign_topic"?"trend_projection_destination_owner_mismatch":"trend_projection_evidence_owner_mismatch"});
      assert.deepEqual(calls.slice(-2),[["rollback"],["release"]]);
      if(mode!=="ledger_error") assert.equal(calls.some(([s])=>/^(INSERT|UPDATE)/.test(s)),false);
      return;
    }
    const topicId = await repo.project(input);
    if (mode === "native_reuse") {
      assert.equal(topicId,"original-topic");
      assert.equal(calls.some(([s])=>s.startsWith("INSERT INTO trend_topics")),false);
      const signal=calls.find(([s])=>s.startsWith("INSERT IGNORE INTO trend_signals"));
      assert.deepEqual(signal[1].slice(1,5),["original-topic","record","raw","provider"]);
    }
    assert.deepEqual(calls.slice(-2),[["commit"],["release"]]);
    assert.deepEqual(ledger.map(x=>x[0]).sort(),
      [...(mode === "native_reuse" ? [] : ["trend_topics"]),"trend_signals","trend_topic_keywords","trend_events","trend_outbox","trend_events","trend_outbox"].sort());
    assert.ok(ledger.every(x=>x[2]===owner && x[3]===(mode==="exclusive_owner"?mode:"shared")));
    assert.deepEqual(calls.find(([s])=>s.startsWith("INSERT IGNORE INTO account_trend_topic_follows"))[1].slice(1,3),[owner,topicId]);
    assert.deepEqual(calls.find(([s])=>s.startsWith("UPDATE trend_monitoring_rules"))[1].at(-1),["own-rule"]);
  });
}

for (const foreign of [true, false]) test(`owned intelligence model input: ${foreign ? "foreign recheck rejects" : "exact original reaches model"}`, async () => {
  let modelCalls=0;
  const pool={query:async(sql)=>{
    if (sql.startsWith("SHOW COLUMNS FROM normalized_records")) return evidenceColumns(false);
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") && sql.includes("historical_context")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
    if(sql.startsWith("SELECT cut.primary_account_id"))
      return [[{record_id:"record",account_id:"primary",evidence_account_id:"primary",reason:"shared",primary_account_id:"primary"}]];
    if(sql.startsWith("SELECT n.id,n.payload_json FROM normalized_records")) {
      assert.doesNotMatch(sql,/organization_id|workspace_id/);
      assert.match(sql,/e.resource_id=s.topic_id/);
      assert.match(sql,/s.raw_evidence_id=n.raw_evidence_id AND s.provider_id=n.provider_id/);
      assert.match(sql,/eo.source_table='trend_events'.+eo.account_id=o.account_id/);
      assert.match(sql,/association.queries/);
      return [[{id:"news",payload_json:{title:"Original news"}}]];
    }
    if(sql.startsWith("SELECT n.id,n.provider_id")) {
      assert.doesNotMatch(sql,/organization_id|workspace_id/);
      assert.match(sql,/n.provider_id=l.provider_id/);
      assert.match(sql,/lo.source_table='collection_task_evidence_links'.+lo.account_id=o.account_id/);
      return [[{id:"foreign",raw_evidence_id:"foreign-raw",payload_json:{title:"Foreign candidate",
        asin:"B000000001",canonical_url:"https://www.amazon.com/dp/B000000001"}}]];
    }
    if(sql.startsWith("SELECT account_id FROM account_owned_records"))
      return [[{account_id:"primary"},{account_id:foreign?"other":"primary"},{account_id:foreign?"other":"primary"}]];
    throw Error("Unexpected query "+sql);
  }};
  const worker=new MySqlTrendProjectionWorker(pool,"worker",120,()=>now,
    {model:"fixture",selectPrimary:async(query,candidates,origin)=>{
      modelCalls++;
      assert.equal(query,"fan");
      assert.equal(origin.title,"Original news");
      return {source_ref:candidates[0].source_ref,rationale:"Exact original"};
    }});
  const input = {...job,intelligenceSourceRecordId:"news",intelligenceQuery:"fan"};
  if (foreign) {
    await assert.rejects(worker.prepareIntelligence(input),{code:"trend_projection_model_input_owner_mismatch"});
    assert.equal(modelCalls,0);
  } else {
    assert.equal(await worker.prepareIntelligence(input),true);
    assert.equal(input.intelligenceSourceRecordId,"news");
    assert.equal(input.rawEvidenceId,"foreign-raw");
    assert.equal(modelCalls,1);
  }
});

for (const mode of ["shared", "exclusive_owner", "native_competitor", "native_opportunity", "native_replay", "foreign_existing_opportunity", "original_intelligence", "foreign_original_evidence"]) {
  test(`owned opportunity discovery keeps every derived identity: ${mode}`, async () => {
    const owner=mode==="exclusive_owner"?"exclusive":"primary", reason=mode==="exclusive_owner"?mode:"shared";
    const calls=[], ledger=[], writes=new Map();
    const c={query:async(sql,v=[])=>{
        if (sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") && sql.includes("historical_context")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      calls.push([sql,v]);
      if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
        return [(["native_opportunity","native_replay"].includes(mode) ? ["account_id"] : ["organization_id","workspace_id"]).map(Field=>({Field}))];
      if (sql.startsWith("SELECT id FROM trend_topics WHERE id=? AND account_id=?")) {
        assert.deepEqual(v,["topic",owner]);return [[{id:"topic"}]];
      }
      if (sql.startsWith("SELECT id FROM opportunities"))
        return [[{id:mode==="native_replay" ? "existing-opportunity" : writes.get("opportunities")[0]}]];
      if (sql.startsWith("SELECT account_id FROM account_owned_records"))
        return [[{account_id:mode==="foreign_existing_opportunity" || (mode==="foreign_original_evidence" && v[1]==="original-raw") ? "foreign" : owner}]];
      if (sql.startsWith("SELECT s.id,s.topic_id")) {
        assert.doesNotMatch(sql,/organization_id|workspace_id/);
        assert.match(sql,/n.raw_evidence_id=s.raw_evidence_id AND n.provider_id=s.provider_id/);
        assert.deepEqual(v,[owner,"news"]);
        return [[{id:"original-signal",topic_id:"original-topic",provider_id:"original-provider",raw_evidence_id:"original-raw",observed_at:now}]];
      }
      if (sql.startsWith("SELECT o.recommendation_status")) return [[{recommendation_status:"insufficient_data",decision_status:"pending"}]];
      if (sql.startsWith("SELECT id FROM competitors")) return [[{id:writes.get("competitors")[0]}]];
      if (sql.startsWith("SELECT id,code FROM providers")) return [[{id:"amazon",code:"amazon_product"},{id:"alibaba",code:"1688_search"}]];
      if (sql.startsWith("SELECT id FROM score_rules")) {
        assert.doesNotMatch(sql,/organization_id|workspace_id/);
        assert.match(sql,/o\.account_id=\?/);
        assert.deepEqual(v,[owner]);return [[{id:"score-rule"}]];
      }
      if (sql.startsWith("SHOW COLUMNS FROM opportunity_outbox")) return [[{Field:"event_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks ")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM competitors"))
        return [(["native_competitor","native_opportunity"].includes(mode) ? ["account_id"] : ["organization_id","workspace_id"]).map(Field=>({Field}))];
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      if (sql.startsWith("INSERT INTO account_owned_records")) {
        ledger.push(...v[0]);return [{affectedRows:v[0].length}];
      }
      const insert=/^INSERT (?:IGNORE )?INTO (\w+)/.exec(sql);
      if(insert){
        const ids=writes.get(insert[1])??[];ids.push(v[0]);writes.set(insert[1],ids);
        return [{affectedRows:insert[1]==="opportunities"&&mode==="foreign_existing_opportunity"?0:1}];
      }
      if(sql.startsWith("UPDATE")) return [{affectedRows:1}];
      throw Error("Unexpected query "+sql);
    }};
    const repo=new TrendProjectionPersistence({},"worker",()=>now);
    const intelligence = mode==="original_intelligence" || mode==="foreign_original_evidence";
    const run=repo.discoverOpportunity(c,{...job,payload:{image_url:"https://example.test/image.jpg"},
      ...(intelligence ? { intelligenceSourceRecordId:"news",primarySelectionRationale:"original" } : {})},
      "topic","signal","Portable Fan","https://www.amazon.com/dp/B000000001","US",null,["rule"],now,now,
      {owner:{account_id:owner,reason}});
    if(mode==="foreign_existing_opportunity"){
      await assert.rejects(run,{code:"trend_projection_destination_owner_mismatch"});
      assert.deepEqual([...writes.keys()],["opportunities"]);assert.deepEqual(ledger,[]);return;
    }
    if (mode==="foreign_original_evidence") {
      await assert.rejects(run,{code:"trend_projection_destination_owner_mismatch"});
      assert.equal(calls.filter(([sql])=>sql.startsWith("INSERT IGNORE INTO opportunity_evidence_links")).length,1);
      return;
    }
    await run;
    if (mode === "native_replay") {
      assert.ok(!writes.has("competitors") && !writes.has("opportunity_outbox") && !writes.has("collection_tasks"));
      assert.ok(!ledger.some(row=>row[0]==="opportunities"));
      assert.deepEqual(calls.find(([sql])=>sql.startsWith("UPDATE opportunities o SET evidence_count"))[1],[0,now,"existing-opportunity"]);
      return;
    }
    if (mode === "native_opportunity") {
      for (const [sql] of calls.filter(([sql])=>/^(INSERT (?:IGNORE )?INTO (opportunities|opportunity_events|opportunity_outbox|automatic_selection_evaluations)|SELECT id FROM opportunities)/.test(sql)))
        assert.doesNotMatch(sql,/organization_id|workspace_id/);
      assert.equal(calls.find(([sql])=>sql.startsWith("INSERT INTO opportunities"))[1][1],owner);
      const event = calls.find(([sql])=>sql.startsWith("INSERT INTO opportunity_events"))[1];
      const delivery = calls.find(([sql])=>sql.startsWith("INSERT INTO opportunity_outbox"))[1];
      assert.notEqual(delivery[0],event[0]);
      assert.equal(delivery[1],event[0]);
    }
    const [competitorSql, competitorArgs] = calls.find(([sql])=>/^INSERT (?:IGNORE )?INTO competitors/.test(sql));
    if (["native_competitor","native_opportunity"].includes(mode)) {
      assert.doesNotMatch(competitorSql,/organization_id|workspace_id/);
      assert.equal(competitorArgs[1],owner);
      assert.match(competitorSql,/ON DUPLICATE KEY UPDATE id=id/);
    }
    assert.equal((competitorSql.match(/\?/g)??[]).length,competitorArgs.length);
    const expected=["opportunities","opportunity_rule_matches","opportunity_evidence_links","opportunity_events",
      "opportunity_outbox","competitors","sourcing_searches","sourcing_events","collection_tasks",
      "collection_subqueries","collection_task_events","opportunity_score_jobs"];
    if (intelligence) expected.push("trend_events","trend_outbox");
    assert.deepEqual(ledger.sort(),expected.flatMap(t=>writes.get(t).map(id=>[t,id,owner,reason])).sort());
    assert.equal(writes.get("collection_tasks").length,3);
    assert.equal(writes.get("automatic_selection_evaluations").length,1);
    const search=calls.find(([sql])=>sql.startsWith("INSERT INTO sourcing_searches"));
    assert.doesNotMatch(search[0],/organization_id|workspace_id/);
    assert.equal(search[0].match(/\?/g).length,search[1].length);
    assert.equal(search[1][1],writes.get("collection_tasks")[0]);
    assert.equal(search[1][2],writes.get("opportunities")[0]);
    const evidence=calls.find(([sql])=>sql.startsWith("INSERT IGNORE INTO opportunity_evidence_links"));
    assert.deepEqual(evidence[1].slice(2,5),["signal","provider","raw"]);
    if (intelligence) assert.ok(calls.some(([sql,args])=>sql.startsWith("INSERT IGNORE INTO opportunity_evidence_links") &&
      args.slice(2,5).join() === "original-signal,original-provider,original-raw"));
  });
}
