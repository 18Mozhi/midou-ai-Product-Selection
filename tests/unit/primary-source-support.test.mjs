import assert from "node:assert/strict";
import test from "node:test";
import { format } from "mysql2";
import {
  readPrimarySourceContext,
  readPrimarySourceVerdict,
  classifyPrimarySource,
  primarySourceSupportStatus,
  primarySourceOriginSql,
  primarySourceNewsSql,
  primarySourceAuditSql,
  accountPrimarySourceOriginSql,
  accountPrimarySourceNewsSql,
  accountPrimarySourceAuditSql,
  PRIMARY_SOURCE_SUPPORT_REVISION,
} from "../../apps/worker/dist/primary-source-support.js";
import {
  primarySourceRecoveryCandidatesSql,
  primarySourceRecoveryUpdateSql,
  recoverPrimarySourceEvaluations,
} from "../../apps/worker/dist/primary-source-support-recovery.js";
import {
  automaticPrimaryEvidenceSql,
  accountAutomaticPrimaryEvidenceSql,
  nativeAccountAutomaticPrimaryEvidenceSql,
  accountOnlyAutomaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
  readAutomaticPrimaryEvidence,
} from "../../apps/worker/dist/automatic-selection-evidence.js";
import { MySqlAutomaticSelectionEvaluationWorker } from "../../apps/worker/dist/automatic-selection-evaluation-worker.js";
import { MySqlOpportunityScoringWorker } from "../../apps/worker/dist/opportunity-scoring-worker.js";

const scope = { opportunityId: "op", organizationId: "org", workspaceId: "ws" };
test("0195 primary proof binds parameters before URL regexes and locks identity to the original owned references", async () => {
  const calls = [];
  const proof = await readAutomaticPrimaryEvidence({ async query(sql, args) {
    if (sql.startsWith("SHOW COLUMNS")) return [[{ Field: "account_id" }]];
    calls.push(sql);
    const rendered = format(sql, args);
    assert.doesNotMatch(sql, /organization_id|workspace_id/);
    assert.match(rendered, /\(\[\^\?#\]\*\/\)\?/);
    if (calls.length === 1) {
      assert.equal(sql, accountOnlyAutomaticPrimaryEvidenceSql);
      assert.match(sql, /^SELECT STRAIGHT_JOIN n\.raw_evidence_id/);
      assert.match(sql, /ORDER BY l_first\.created_at,n_first_seed\.created_at DESC LIMIT 1\) o JOIN account_owned_records owner/);
      assert.match(sql, /\)=BINARY o\.primary_asin ORDER BY l\.observed_at/);
      assert.doesNotMatch(sql, /\)=BINARY \(SELECT STRAIGHT_JOIN/);
      assert.match(sql, /opportunity_evidence_links l FORCE INDEX \(uq_opportunity_evidence\) ON l\.opportunity_id=o\.id/);
      assert.match(rendered, /o\.id='op' AND owner\.account_id='account'/);
      assert.match(sql, /o\.account_id=owner\.account_id/);
      assert.match(sql, /n_current_task\.account_id=owner\.account_id/);
      assert.match(sql, /n_origin_task\.account_id=owner\.account_id/);
      assert.match(sql, /STRAIGHT_JOIN account_owned_records l_own_link FORCE INDEX \(PRIMARY\) ON l_own_link\.source_table='opportunity_evidence_links' AND l_own_link\.source_id=l\.id AND l_own_link\.account_id=n_seed\.account_id/);
      assert.match(sql, /STRAIGHT_JOIN account_owned_records n_own_seed_task FORCE INDEX \(PRIMARY\).*n_origin_task\.id/);
      assert.doesNotMatch(sql, /EXISTS \(SELECT 1 FROM account_owned_records/);
      return [[{ raw_evidence_id: "original-linked", payload_json: { asin: "B0COUNT000" } }]];
    }
    assert.match(sql, /c\.account_id=owner\.account_id/);
    assert.match(sql, /t\.account_id=owner\.account_id/);
    assert.match(sql, /l\.raw_evidence_id=s\.evidence_id/);
    assert.match(rendered, /BINARY 'B0COUNT000'/);
    return [[{ raw_evidence_id: "original-detail" }]];
  } }, { ...scope, accountId: "account" });
  assert.deepEqual([proof.linked.raw_evidence_id, proof.detail.raw_evidence_id], ["original-linked", "original-detail"]);
});
test("account primary prices require the owned linked identity and exact snapshot evidence", async () => {
  const owned = { ...scope, accountId: "account" };
  for (const native of [false, true]) for (const hasLinked of [false, true]) {
    const calls = [];
    const linked = { raw_evidence_id: "original-linked", payload_json: { asin: "B0COUNT000" } };
    const detail = { raw_evidence_id: "original-detail" };
    const result = await readAutomaticPrimaryEvidence({ async query(sql, params) {
      if (sql.startsWith("SHOW COLUMNS FROM normalized_records")) return [(native
        ? ["account_id"] : ["organization_id", "workspace_id"]).map(Field => ({Field}))];
      if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
        return [[{Field: "organization_id"}, {Field: "workspace_id"}]];
      calls.push(sql);
      if (calls.length === 1) {
        assert.equal(sql, native ? nativeAccountAutomaticPrimaryEvidenceSql : accountAutomaticPrimaryEvidenceSql);
        assert.deepEqual(params, ["op", "account"]);
        for (const ref of ["l.id", "n.id", "n_seed.id", "n.raw_evidence_id", "n_seed.raw_evidence_id"])
          assert.ok(sql.includes(`a.source_id=${ref} AND a.account_id=owner.account_id`));
        assert.match(sql, /l_first\.created_at/);
        if (native) {
          assert.match(sql, /n_current_task\.workspace_id=n_origin_task\.workspace_id/);
          assert.doesNotMatch(sql, /(?:n|n_seed|n_first|n_first_seed)\.(?:organization_id|workspace_id)|uq_normalized_scope_record_version/);
        } else assert.match(sql, /l_primary\.created_at/);
        return [hasLinked ? [linked] : []];
      }
      assert.deepEqual(params, ["op", "account", "B0COUNT000"]);
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      assert.match(sql, /n\.id=CONVERT\(RIGHT\(s\.source_ref_id,36\) USING ascii\) AND n\.raw_evidence_id=s\.evidence_id/);
      assert.match(sql, /n\.provider_id=l\.provider_id/);
      assert.match(sql, /q\.task_id=CONVERT\(SUBSTRING\(s\.source_ref_id,12,36\) USING ascii\)/);
      return [[detail]];
    } }, owned);
    assert.equal(calls.length, hasLinked ? 2 : 1);
    assert.deepEqual(result, hasLinked ? { linked, detail } : { linked: undefined, detail: undefined });
  }
});
test("sealed source proofs retain the historical fingerprint but never borrow another account's verdict", async () => {
  const f = fixture();
  const original = await readPrimarySourceContext(f.reader,scope);
  f.state.audit = await classifyPrimarySource(f.reader,scope,f.classifier);
  let foreign = false;
  const reader = { async query(sql,args) {
    if (sql === accountPrimarySourceOriginSql) {
      assert.doesNotMatch(sql,/organization_id|workspace_id/);
      assert.match(sql,/e.resource_id=o.source_ref_id/);
      assert.match(sql,/a.source_table='trend_topics'.+a.account_id=owner.account_id/);
      assert.deepEqual(args,["account","op"]);
      return f.reader.query(primarySourceOriginSql,["org","ws","op"]);
    }
    if (sql === accountPrimarySourceNewsSql) {
      assert.doesNotMatch(sql,/organization_id|workspace_id/);
      assert.match(sql,/s.raw_evidence_id=n.raw_evidence_id AND s.provider_id=n.provider_id/);
      assert.deepEqual(args,["original-news","account",f.state.query]);
      return f.reader.query(primarySourceNewsSql,["original-news","org","ws",f.state.query]);
    }
    if (sql === accountPrimarySourceAuditSql) {
      assert.doesNotMatch(sql,/organization_id|workspace_id/);
      assert.match(sql,/owner.source_id=e.id.*owner.account_id=\?/);
      assert.equal(args[0],"account");
      return foreign ? [[]] : f.reader.query(primarySourceAuditSql,["org","ws",...args.slice(1)]);
    }
    return f.reader.query(sql,args);
  }};
  const owned = {...scope,accountId:"account"};
  const context = await readPrimarySourceContext(reader,owned);
  assert.equal(context.fingerprint,original.fingerprint);
  assert.deepEqual(await readPrimarySourceVerdict(reader,owned,context),f.state.audit);
  foreign = true;
  assert.equal(await readPrimarySourceVerdict(reader,owned,context),null);
});
function fixture(options = {}) {
  const state = {
    origin: true,
    news: true,
    title: "Student Driver Magnet for Car 2 Pack",
    query: "car cover for learner drivers",
    asin: "B0GWJTQBNM",
    price: 8.99,
    newsTitle: "Driving test waits fall to two-year low - but still average 20 weeks",
    newsSummary: "Learner drivers had to wait around five months for a practical test.",
    audit: null,
    ...options,
  };
  const calls = [],
    modelCalls = [];
  const reader = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql === primarySourceOriginSql) {
        assert.deepEqual(parameters, ["org", "ws", "op"]);
        return [
          state.origin
            ? [
                {
                  source_type: state.sourceType ?? "trend_topic",
                  id: state.eventMissing ? null : "old-selection",
                  payload_json: state.eventMissing
                    ? null
                    : {
                        query: state.query,
                        intelligence_source_record_id: "original-news",
                      },
                },
              ]
            : [],
        ];
      }
      if (sql === primarySourceNewsSql) {
        assert.deepEqual(parameters, ["original-news", "org", "ws", state.query]);
        return [
          state.news
            ? [
                {
                  id: "original-news",
                  payload_json: {
                    title: state.newsTitle,
                    summary: state.newsSummary,
                  },
                },
              ]
            : [],
        ];
      }
      if (sql.startsWith("SELECT n.raw_evidence_id,s.captured_at observed_at") && sql.includes("JOIN account_owned_records owner")) {
        assert.deepEqual(parameters, ["op", "account", state.asin]);
        return [[]];
      }
      if (sql.startsWith("SHOW COLUMNS FROM normalized_records"))
        return [[{Field:"organization_id"},{Field:"workspace_id"}]];
      if ([automaticPrimaryEvidenceSql, automaticPrimaryDetailEvidenceSql, accountAutomaticPrimaryEvidenceSql].includes(sql)) {
        assert.deepEqual(parameters, sql === accountAutomaticPrimaryEvidenceSql ? ["op", "account"] : ["op", "org", "ws"]);
        return [
          sql !== automaticPrimaryDetailEvidenceSql
            ? [
                {
                  payload_json: {
                    asin: state.asin,
                    title: state.title,
                    price: state.price,
                    currency: "USD",
                  },
                },
              ]
            : [],
        ];
      }
      if (sql === primarySourceAuditSql) {
        assert.deepEqual(parameters.slice(0, 4), [
          "org",
          "ws",
          "op",
          "opportunity.primary_source_support_checked",
        ]);
        return [state.audit ? [{ payload_json: state.audit }] : []];
      }
      throw new Error("unexpected SQL: " + sql);
    },
  };
  const classifier = {
    async selectPrimary(...args) {
      modelCalls.push(args);
      return { source_ref: state.selected ?? null, rationale: "test-only causal/type verdict" };
    },
  };
  return { state, calls, modelCalls, reader, classifier };
}

test("persisted main is checked against its actual originating news and physical query", async () => {
  const f = fixture();
  const verdict = await classifyPrimarySource(f.reader, scope, f.classifier);
  assert.equal(verdict.supported, false);
  assert.equal(verdict.revision, PRIMARY_SOURCE_SUPPORT_REVISION);
  assert.deepEqual(f.modelCalls, [
    [
      f.state.query,
      [{ source_ref: "primary", asin: f.state.asin, title: f.state.title }],
      {
        source_ref: "original-news",
        title: f.state.newsTitle,
        summary: f.state.newsSummary,
      },
    ],
  ]);
  assert.equal(
    f.calls.some(({ sql }) => /INSERT|UPDATE|FOR UPDATE/.test(sql)),
    false,
  );
});

test("positive proof is scoped, reusable and independent of price refresh", async () => {
  const f = fixture({ selected: "primary" });
  f.state.audit = await classifyPrimarySource(f.reader, scope, f.classifier);
  assert.equal(f.state.audit.supported, true);
  f.state.price = 10.99;
  assert.deepEqual(await classifyPrimarySource(f.reader, scope, f.classifier), f.state.audit);
  assert.equal(f.modelCalls.length, 1);
  assert.equal(
    (
      await readPrimarySourceContext(f.reader, {
        ...scope,
        attemptCount: 7,
        requestId: "another-run",
      })
    ).fingerprint,
    f.state.audit.fingerprint,
    "lease attempt and scorer request metadata are not evidence identity",
  );
  assert.deepEqual(await primarySourceSupportStatus(f.reader, scope), {
    applicable: true,
    supported: true,
  });
});

for (const [field, value] of [
  ["title", "Car cover for learner drivers"],
  ["asin", "B000000001"],
  ["query", "student driver magnet"],
  ["newsTitle", "Different news"],
  ["newsSummary", "Different summary"],
])
  test(`changed ${field} cannot reuse a prior approval`, async () => {
    const f = fixture({ selected: "primary" });
    f.state.audit = await classifyPrimarySource(f.reader, scope, f.classifier);
    f.state[field] = value;
    const context = await readPrimarySourceContext(f.reader, scope);
    assert.equal(await readPrimarySourceVerdict(f.reader, scope, context), null);
    assert.equal((await primarySourceSupportStatus(f.reader, scope)).supported, false);
  });

for (const change of [
  { news: false },
  { newsTitle: "", newsSummary: "" },
  { asin: "invalid" },
  { title: "" },
])
  test(`incomplete provenance fails closed without model work: ${JSON.stringify(change)}`, async () => {
    const f = fixture(change);
    assert.equal((await classifyPrimarySource(f.reader, scope, f.classifier)).supported, false);
    assert.equal(f.modelCalls.length, 0);
  });

test("unconfigured model and absent audit never establish automatic source support", async () => {
  const f = fixture();
  assert.equal(await classifyPrimarySource(f.reader, scope), null);
  assert.deepEqual(await primarySourceSupportStatus(f.reader, scope), {
    applicable: true,
    supported: false,
  });
  f.state.origin = false;
  assert.deepEqual(await primarySourceSupportStatus(f.reader, scope), {
    applicable: false,
    supported: false,
  });
});

test("model exceptions propagate; foreign references cannot approve the primary", async () => {
  const f = fixture({ selected: "other-primary" });
  assert.equal((await classifyPrimarySource(f.reader, scope, f.classifier)).supported, false);
  await assert.rejects(
    classifyPrimarySource(f.reader, scope, {
      async selectPrimary() {
        throw new Error("timeout");
      },
    }),
    /timeout/,
  );
});

test("an automatic trend product with a missing selection event fails closed, while manual records remain separate", async () => {
  const f = fixture({ eventMissing: true });
  assert.equal((await classifyPrimarySource(f.reader, scope, f.classifier)).supported, false);
  assert.equal(f.modelCalls.length, 0);
  assert.deepEqual(await primarySourceSupportStatus(f.reader, scope), {
    applicable: true,
    supported: false,
  });
  f.state.sourceType = "manual";
  assert.deepEqual(await primarySourceSupportStatus(f.reader, scope), {
    applicable: false,
    supported: false,
  });
});

for (const supported of [false, true])
  test(`queued scoring keeps numeric facts but requires current source proof to recommend, supported=${supported}`, async () => {
    const f = fixture({ selected: supported ? "primary" : null });
    f.state.audit = await classifyPrimarySource(f.reader, scope, f.classifier);
    const writes = [],
      dimensions = ["market_demand", "competition", "profit", "risk", "data_quality"].map(
        (code) => ({
          code,
          required: true,
          weight: 20,
          evidence_group:
            code === "profit"
              ? "cost"
              : code === "competition"
                ? "competition"
                : code === "market_demand"
                  ? "market"
                  : "other",
        }),
      );
    const c = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async query(sql, params) {
        if (sql.startsWith("SELECT version_code,dimensions_json"))
          return [
            [
              {
                version_code: "v1",
                dimensions_json: dimensions,
                thresholds_json: { recommend_min: 70, observe_min: 50 },
              },
            ],
          ];
        if (sql.startsWith("SELECT id,owner_id")) return [[{ id: "op", owner_id: null }]];
        if (sql.startsWith("SELECT cut.primary_account_id")) return [[]];
        if (sql.startsWith("SHOW COLUMNS FROM score_rules"))
          return [[{Field:"organization_id"},{Field:"workspace_id"}]];
        if (sql.startsWith("SHOW COLUMNS FROM opportunity_outbox")) return [[{Field:"event_id"}]];
        if (sql.startsWith("SHOW COLUMNS FROM opportunity_events")) return [[]];
        if (sql.startsWith("SELECT * FROM opportunity_score_inputs"))
          return [
            dimensions.map((d) => ({
              id: d.code,
              input_version: 1,
              dimension_code: d.code,
              evidence_group: d.evidence_group,
              score_value: 95,
              evidence_ids_json: [d.code + "-evidence"],
              missing_fields_json: [],
            })),
          ];
        if (sql.includes("reconciliation_status")) return [[]];
        if (
          sql === primarySourceOriginSql ||
          sql === primarySourceNewsSql ||
          sql === primarySourceAuditSql ||
          sql === automaticPrimaryEvidenceSql ||
          sql === automaticPrimaryDetailEvidenceSql
        )
          return f.reader.query(sql, params);
        if (sql.startsWith("SELECT")) return [[]]; // Completion proof deliberately absent in this isolated scorer test.
        writes.push({ sql, params });
        return [{ affectedRows: 1 }];
      },
    };
    const worker = new MySqlOpportunityScoringWorker(
      { getConnection: async () => c },
      "worker",
      120,
    );
    await worker.calculate({
      ...scope,
      id: "score-job",
      ruleId: "score-rule",
      triggerTaskId: null,
      requestId: "req",
      traceId: "trace",
      attemptCount: 1,
    });
    const update = writes.find(({ sql }) =>
      sql.startsWith("UPDATE opportunities SET overall_score"),
    );
    assert.equal(update.params[0], 95);
    assert.equal(update.params[3], supported ? "recommend" : "insufficient_data");
    const scoreRun = writes.find(({ sql }) => sql.startsWith("INSERT INTO opportunity_score_runs"));
    assert.match(scoreRun.sql, /\(id,opportunity_id,score_rule_id,rule_version_code,/);
    const [, opportunityId, ruleId, , , overallScore, , , recommendation] = scoreRun.params;
    assert.equal(opportunityId, scope.opportunityId);
    assert.equal(ruleId, "score-rule");
    assert.equal(overallScore, 95);
    assert.equal(recommendation, supported ? "recommend" : "insufficient_data");
  });

test("revision recovery is bounded, scope rechecked, and never takes a live lease or terminal failure", async () => {
  const calls = [],
    now = new Date("2026-10-20T00:00:00Z");
  const recovered = await recoverPrimarySourceEvaluations(
    {
      async query(sql, parameters) {
        calls.push({ sql, parameters });
        return sql === primarySourceRecoveryCandidatesSql
          ? [[{ opportunity_id: "op", organization_id: "org", workspace_id: "ws" }]]
          : [{ affectedRows: 1 }];
      },
    },
    now,
  );
  assert.equal(recovered, 1);
  assert.deepEqual(calls[1].parameters, [
    PRIMARY_SOURCE_SUPPORT_REVISION,
    now,
    now,
    "op",
    "org",
    "ws",
    PRIMARY_SOURCE_SUPPORT_REVISION,
  ]);
  for (const sql of [primarySourceRecoveryCandidatesSql, primarySourceRecoveryUpdateSql]) {
    assert.match(sql, /status IN \('succeeded','waiting_evidence','waiting_profit'\)/);
    assert.match(sql, /o.decision_status='pending'/);
    assert.match(sql, /WHERE o.id=e.opportunity_id/);
    assert.doesNotMatch(sql, /FOR UPDATE|failed_terminal|dead_letter|lease_owner/);
  }
  assert.match(primarySourceRecoveryCandidatesSql, /LIMIT 100$/);
});

for (const stale of [false, true])
  test(`source rejection blocks writes and changed source rolls back, stale=${stale}`, async () => {
    const f = fixture();
    const verdict = await classifyPrimarySource(f.reader, scope, f.classifier);
    if (stale) f.state.title = "Changed product";
    let commits = 0,
      rollbacks = 0;
    const writes = [];
    const c = {
      async beginTransaction() {},
      async commit() {
        commits++;
      },
      async rollback() {
        rollbacks++;
      },
      release() {},
      async query(sql, params) {
        if (sql.startsWith("SELECT o.*")) return [[{ market: "US" }]];
        if (sql.startsWith("SHOW COLUMNS FROM normalized_records")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
        if (sql.startsWith("SELECT cut.primary_account_id")) return [[]];
        if (sql.startsWith("SELECT opportunity_id FROM automatic_selection_evaluations"))
          return [[{ opportunity_id: "op" }]];
        if (sql.startsWith("SELECT id,version_code,dimensions_json")) return [[{ id: "score" }]];
        if (sql.startsWith("SELECT id,version_code,fee_lines_json")) return [[]];
        if (sql.startsWith("SELECT")) return f.reader.query(sql, params);
        writes.push({ sql, params });
        return [{ affectedRows: 1 }];
      },
    };
    const worker = new MySqlAutomaticSelectionEvaluationWorker(
      { getConnection: async () => c },
      "worker",
      "actor",
      120,
    );
    if (stale) {
      await assert.rejects(
        worker.evaluate({ ...scope, attemptCount: 1 }, undefined, undefined, verdict),
        /automatic_primary_source_changed/,
      );
      assert.equal(rollbacks, 1);
      assert.equal(commits, 0);
      assert.equal(writes.length, 0);
    } else {
      const result = await worker.evaluate(
        { ...scope, attemptCount: 1 },
        undefined,
        undefined,
        verdict,
      );
      assert.equal(result.payload.error_code, "automatic_primary_source_unsupported");
      assert.equal(commits, 1);
      assert.equal(rollbacks, 0);
      assert.equal(
        writes.some(({ sql }) => /opportunity_cost_inputs|opportunity_score_inputs/.test(sql)),
        false,
      );
      assert.equal(
        writes.some(({ sql, params }) => sql.startsWith("INSERT INTO opportunity_events") &&
          params?.includes("opportunity.primary_source_support_checked")),
        true,
      );
    }
  });
