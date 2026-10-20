import assert from "node:assert/strict";
import test from "node:test";
import {
  readPrimarySourceContext,
  readPrimarySourceVerdict,
  classifyPrimarySource,
  primarySourceSupportStatus,
  primarySourceOriginSql,
  primarySourceNewsSql,
  primarySourceAuditSql,
  PRIMARY_SOURCE_SUPPORT_REVISION,
} from "../../apps/worker/dist/primary-source-support.js";
import {
  primarySourceRecoveryCandidatesSql,
  primarySourceRecoveryUpdateSql,
  recoverPrimarySourceEvaluations,
} from "../../apps/worker/dist/primary-source-support-recovery.js";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";
import { MySqlAutomaticSelectionEvaluationWorker } from "../../apps/worker/dist/automatic-selection-evaluation-worker.js";
import { MySqlOpportunityScoringWorker } from "../../apps/worker/dist/opportunity-scoring-worker.js";

const scope = { opportunityId: "op", organizationId: "org", workspaceId: "ws" };
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
      if ([automaticPrimaryEvidenceSql, automaticPrimaryDetailEvidenceSql].includes(sql)) {
        assert.deepEqual(parameters, ["op", "org", "ws"]);
        return [
          sql === automaticPrimaryEvidenceSql
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
    assert.equal(scoreRun.params[7], 95);
    assert.equal(scoreRun.params[10], supported ? "recommend" : "insufficient_data");
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
    assert.match(sql, /workspace_id=e.workspace_id/);
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
        writes.some(({ params }) => params[3] === "opportunity.primary_source_support_checked"),
        true,
      );
    }
  });
