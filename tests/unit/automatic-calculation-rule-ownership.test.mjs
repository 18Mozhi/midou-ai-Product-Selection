import assert from "node:assert/strict";
import test from "node:test";
import { readAutomaticCalculationRules, queueAutomaticCalculationJob, MySqlAutomaticSelectionEvaluationWorker } from "../../apps/worker/dist/automatic-selection-evaluation-worker.js";

test("owned evaluation without a classifier rejects a stale attempt before reading or writing inputs", async () => {
  const now = new Date(0);
  const steps = [];
  const connection = {
    beginTransaction: async () => steps.push("begin"),
    rollback: async () => steps.push("rollback"),
    release: () => steps.push("release"),
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM normalized_records "))
        return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      if (sql.startsWith("SELECT o.*")) return [[{ id: "original" }]];
      if (sql.startsWith("SELECT cut.primary_account_id"))
        return [[{ account_id: "owner", primary_account_id: "owner", reason: "shared" }]];
      assert.match(sql, /status='leased' AND lease_owner=\? AND lease_expires_at>\? AND attempt_count=\? FOR UPDATE$/);
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      assert.match(sql, /a.source_id=p.id AND a.account_id=\?/);
      assert.deepEqual(args, ["original", "owner", "worker", now, 1]);
      steps.push("lease");
      return [[]];
    },
  };
  const worker = new MySqlAutomaticSelectionEvaluationWorker({ getConnection: async () => connection }, "worker", "system", 120, () => now);
  await assert.rejects(worker.evaluate({ opportunityId: "original", organizationId: "org",
    workspaceId: "workspace", attemptCount: 1 }), { code: "automatic_selection_lease_expired" });
  assert.deepEqual(steps, ["begin", "lease", "rollback", "release"]);
});

test("native evaluation cannot renew a lease when the actual parent account no longer agrees", async () => {
  const now = new Date(0);
  const worker = new MySqlAutomaticSelectionEvaluationWorker({
    async query(sql, args) {
      assert.match(sql,/a.source_id=p.id AND a.account_id=\? AND p.account_id=a.account_id/);
      assert.match(sql,/lease_expires_at>\? AND attempt_count=\?$/);
      assert.deepEqual(args.slice(2),["original","owner","worker",now,3]);
      return [{affectedRows:0}];
    },
  },"worker","system",120,()=>now);
  await assert.rejects(worker.renewClassificationLease({opportunityId:"original",attemptCount:3,nativeParent:true,
    executionOwnership:{owner:{account_id:"owner",reason:"exclusive_owner"}}}),
  {code:"automatic_selection_lease_expired"});
});

test("owned evaluation audit preserves the original reference and rejects a foreign parent before ledger write", async () => {
  const worker = new MySqlAutomaticSelectionEvaluationWorker({}, "worker", "system", 120);
  const now = new Date(0);
  for (const affectedRows of [0, 1]) {
    const calls = [];
    const task = worker.event({ async query(sql,args) {
      calls.push([sql,args]);
      assert.doesNotMatch(sql,/organization_id|workspace_id|outbox/);
      return [{affectedRows}];
    } }, { opportunityId:"original", executionOwnership:{owner:{account_id:"owner",reason:"shared"}} },
    "opportunity.automatic_quality_evaluated", { evidence_id:"original-evidence" }, "request", "trace", now);
    if (!affectedRows) {
      await assert.rejects(task,{code:"automatic_selection_event_owner_mismatch"});
      assert.equal(calls.length,1);
    } else {
      await task;
      const [[sql,args],[ledger,owners]] = calls;
      assert.match(sql,/a.source_id=o.id WHERE o.id=\? AND a.account_id=\?/);
      assert.equal((sql.match(/\?/g)??[]).length,args.length);
      assert.deepEqual(args.slice(2),["worker","request","trace",'{"evidence_id":"original-evidence"}',now,"original","owner"]);
      assert.match(ledger,/^INSERT INTO account_owned_records/);
      assert.deepEqual(owners,[[["opportunity_events",args[0],"owner","shared"]]]);
    }
  }
});

test("owned 1688 evidence wait updates only its original selection and completes the lease", async () => {
  const now = new Date(0), writes = [];
  const worker = new MySqlAutomaticSelectionEvaluationWorker({}, "worker", "system", 120, () => now);
  const result = await worker.waiting({
    async query(sql,args) { writes.push([sql,args]); return [{affectedRows:1}]; },
    async commit() { writes.push(["commit"]); },
  }, { opportunityId:"original", attemptCount:3, executionOwnership:{owner:{account_id:"owner",reason:"shared"}} },
  "high_confidence_1688_match_missing", {}, now);
  assert.equal(result.status,"waiting_evidence");
  const [[sql,args],[lease],commit] = writes;
  assert.doesNotMatch(sql,/organization_id|workspace_id/);
  assert.match(sql,/a.source_id=o.id AND a.account_id=\?/);
  assert.match(sql,/ci.confirmation_mode='automatic_evidence'/);
  assert.deepEqual(args,[now,"original","owner"]);
  assert.match(lease,/attempt_count=\?/);
  assert.deepEqual(commit,["commit"]);
});

test("automatic dispatch selects active rules by account after sealing, without changing ranking", async () => {
  const job = { opportunityId: "original", organizationId: "org", workspaceId: "old-workspace" };
  for (const [receipt, owner, migrated, costMigrated] of [[true, "primary"], [true, "primary", true, true], [true, null], [false, null], [true, null, true], [true, null, true, true]]) {
    const connection = { async query(sql, params) {
      if (sql.startsWith("SELECT cut.primary_account_id")) {
        assert.deepEqual(params, ["opportunities", "original"]);
        return [receipt ? [{ primary_account_id: "primary", account_id: owner, reason: "shared" }] : []];
      }
      if (sql.startsWith("SHOW COLUMNS FROM score_rules")) {
        return [(migrated ? ["account_id", "historical_context"] : ["organization_id", "workspace_id"]).map(Field => ({ Field }))];
      }
      if (sql.startsWith("SHOW COLUMNS FROM cost_rules"))
        return [(costMigrated ? ["account_id", "historical_context"] : ["organization_id", "workspace_id"]).map(Field => ({ Field }))];
      const table = sql.includes("FROM score_rules") ? "score_rules" : "cost_rules";
      if (costMigrated && !owner) assert.fail("an unowned opportunity must not use a migrated cost rule");
      if (migrated && !owner) assert.equal(table, "cost_rules");
      assert.match(sql, table === "score_rules" ? /ORDER BY activated_at DESC,id DESC LIMIT 1 LOCK IN SHARE MODE$/ : /market=\? AND platform='amazon'.*ORDER BY published_at DESC,id DESC LIMIT 1 LOCK IN SHARE MODE$/);
      assert.match(sql, /status='active'/);
      if (owner) {
        assert.doesNotMatch(sql, /organization_id|workspace_id|NOT EXISTS/);
        assert.match(sql, new RegExp(`a.source_table='${table}' AND a.source_id=r.id AND a.account_id=\\?`));
        assert.equal(sql.includes("r.account_id=a.account_id"),!!(table==="score_rules"?migrated:costMigrated));
      } else {
        assert.match(sql, /r.organization_id=\? AND r.workspace_id=\?/);
        if (receipt) assert.match(sql, /NOT EXISTS .*account_owned_records/);
        else assert.doesNotMatch(sql, /account_owned_records/);
      }
      assert.deepEqual(params, [...(owner ? [owner] : ["org", "old-workspace"]), ...(table === "cost_rules" ? ["US"] : [])]);
      return [[{ id: table }]];
    }};
    assert.deepEqual(await readAutomaticCalculationRules(connection, job, "US"), {
      scoreRules: migrated && !owner ? [] : [{ id: "score_rules" }], costRules: costMigrated && !owner ? [] : [{ id: "cost_rules" }],
      ownership: receipt ? { owner: owner ? { account_id: owner, reason: "shared" } : null } : null,
    });
  }
});

for (const type of ["Score", "Cost"]) {
  test(`automatic ${type} input keeps source and registers its owner before returning`, async () => {
    const table = `opportunity_${type.toLowerCase()}_inputs`;
    const worker = new MySqlAutomaticSelectionEvaluationWorker({}, "worker", "system", 120);
    for (const mode of ["new", "foreign-input", "foreign-evidence", ...(type === "Cost" ? ["human"] : [])]) {
      let id;
      const writes = [];
      const c = { async query(sql, params) {
        if (sql.startsWith("SELECT *")) {
          assert.match(sql, /FOR UPDATE$/);
          return [[{ id: "previous", confirmation_mode: mode === "human" ? "human_review" : "automatic_evidence" }]];
        }
        if (sql.startsWith("SELECT account_id")) {
          const [source] = params[0][0];
          assert.deepEqual(params, [source === table ? [[table, "previous"]] : [["raw_evidence", "evidence"]]]);
          return [[{ account_id: mode === (source === table ? "foreign-input" : "foreign-evidence") ? "other" : "owner" }]];
        }
        if (sql.startsWith("SELECT COALESCE")) return [[{ next_version: 2 }]];
        if (sql.startsWith(`UPDATE ${table}`)) writes.push("retire");
        else if (sql.startsWith(`INSERT INTO ${table}`)) {
          [id] = params;
          assert.equal(params[1], "original");
          assert.ok(params.includes(type === "Score" ? '["evidence"]' : "evidence"));
          writes.push("insert");
        } else {
          assert.match(sql, /^INSERT INTO account_owned_records/);
          assert.deepEqual(params, [[[table, id, "owner", "shared"]]]);
          writes.push("ledger");
        }
        return [{}];
      }};
      const now = new Date(0);
      const result = worker[`upsert${type}Input`](c, {
        job: { opportunityId: "original" }, ownership: { owner: { account_id: "owner", reason: "shared" } },
        dimension: { code: "profit", evidence_group: "cost" }, score: 50, evidenceIds: ["evidence"], missingFields: [],
        platform: "amazon", type: "sale_price", amount: 8, currency: "USD", evidenceId: "evidence",
        sourceRef: "original-reference", observedAt: now, requestId: "request", traceId: "trace", now,
      });
      if (mode.startsWith("foreign"))
        await assert.rejects(result, { code: mode === "foreign-input"
          ? `automatic_${type.toLowerCase()}_input_owner_mismatch` : "automatic_input_evidence_owner_mismatch" });
      else assert.equal(await result, mode === "new");
      assert.deepEqual(writes, mode === "new" ? ["retire", "insert", "ledger"] : []);
    }
  });
}

for (const kind of ["score", "profit"]) {
  test(`automatic ${kind} queue retains the original rule and owner, rejecting incompatible reuse`, async () => {
    const table = `opportunity_${kind}_jobs`;
    const ruleTable = kind === "score" ? "score_rules" : "cost_rules";
    const now = new Date(0);
    for (const mode of ["new", "repeat", "foreign-job", "foreign-rule", "native-foreign-rule", "ledger-error"]) {
      let id;
      let writes = 0;
      let lookup = 0;
      const c = { async query(sql, args) {
        if (sql.startsWith("SHOW COLUMNS"))
          return [(mode==="native-foreign-rule"?["account_id","historical_context"]:["organization_id","workspace_id"]).map(Field=>({Field}))];
        if (sql.startsWith(`SELECT id FROM ${ruleTable}`)) {
          assert.match(sql,/WHERE id=\? AND account_id=\? LOCK IN SHARE MODE$/);
          assert.deepEqual(args,["original-rule","owner"]);
          return [[]];
        }
        if (sql.startsWith("SELECT account_id")) {
          assert.deepEqual(args, [++lookup === 1 ? [[ruleTable, "original-rule"]] : [[table, "existing"]]]);
          assert.match(sql, /LOCK IN SHARE MODE/);
          return [[{ account_id: mode === (lookup === 1 ? "foreign-rule" : "foreign-job") ? "other" : "owner" }]];
        }
        if (sql.startsWith(`SELECT id FROM ${table}`)) {
          assert.deepEqual(args, ["original-opportunity", "original-rule"]);
          return [mode === "repeat" || mode === "foreign-job" ? [{ id: "existing" }] : []];
        }
        if (sql.startsWith(`INSERT INTO ${table}`)) {
          [id] = args;
          assert.deepEqual(args.slice(1), ["original-opportunity", "original-rule", now, "request", "trace", now, now]);
          writes++;
          return [{}];
        }
        assert.match(sql, /^INSERT INTO account_owned_records/);
        assert.deepEqual(args, [[[table, id, "owner", "shared"]]]);
        if (mode === "ledger-error") throw Error("ledger_fixture_failed");
        writes++;
        return [{}];
      }};
      const result = queueAutomaticCalculationJob(c, kind, { owner: { account_id: "owner", reason: "shared" } },
        "original-opportunity", "original-rule", "request", "trace", now);
      if (mode === "foreign-job" || mode === "foreign-rule")
        await assert.rejects(result, { code: `automatic_calculation_${mode.slice(8)}_owner_mismatch` });
      else if (mode === "native-foreign-rule") await assert.rejects(result,{code:"automatic_calculation_rule_owner_mismatch"});
      else if (mode === "ledger-error") await assert.rejects(result, /ledger_fixture_failed/);
      else await result;
      assert.equal(writes, mode === "new" ? 2 : mode === "ledger-error" ? 1 : 0);
    }
  });
}
