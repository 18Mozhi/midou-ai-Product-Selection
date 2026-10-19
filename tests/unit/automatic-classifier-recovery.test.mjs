import test from "node:test";
import assert from "node:assert/strict";
import {
  recoverSupplyClassifierEvaluations,
  SUPPLY_TITLE_CLASSIFIER_REVISION,
  supplyClassifierRecoveryCandidatesSql,
  supplyClassifierRecoveryUpdateSql,
} from "../../apps/worker/dist/automatic-selection-classifier-recovery.js";
import { MySqlAutomaticSelectionEvaluationWorker } from "../../apps/worker/dist/automatic-selection-evaluation-worker.js";
import { selectionCandidateSql } from "../../packages/database/dist/index.js";
import {
  classifierRecoveryScenarios,
  buildClassifierRecoveryProbe,
} from "../fixtures/supply-classifier-recovery-sql.mjs";

test("production SQL probe fixtures remain SELECT-only for both admission and current-row guards", () => {
  for (const scenario of classifierRecoveryScenarios)
    for (const point of [false, true]) {
      const probe = buildClassifierRecoveryProbe({
        candidateSql: supplyClassifierRecoveryCandidatesSql,
        updateSql: supplyClassifierRecoveryUpdateSql,
        revision: SUPPLY_TITLE_CLASSIFIER_REVISION,
        scope: ["item", "org", "workspace"],
        scenario,
        point,
      });
      assert.match(probe.sql, /^SELECT /);
      assert.doesNotMatch(probe.sql, /UPDATE |INSERT |DELETE |CREATE |DROP |FOR UPDATE/);
      assert.equal(
        (probe.sql.replace(/'(?:[^']|'')*'/g, "").match(/\?/g) ?? []).length,
        probe.params.length,
      );
    }
});

test("classifier recovery scans consistently then atomically rechecks each original tenant scope", async () => {
  const now = new Date("2026-10-20T00:00:00Z"),
    calls = [];
  const rows = [
    { opportunity_id: "a", organization_id: "org-a", workspace_id: "ws-a" },
    { opportunity_id: "b", organization_id: "org-b", workspace_id: "ws-b" },
  ];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return calls.length === 1 ? [rows] : [{ affectedRows: calls.length === 2 ? 1 : 0 }];
    },
  };
  assert.equal(await recoverSupplyClassifierEvaluations(pool, now), 1);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].sql, supplyClassifierRecoveryCandidatesSql);
  assert.doesNotMatch(calls[0].sql, /FOR UPDATE|INSERT|DELETE/);
  assert.deepEqual(calls[0].params, [SUPPLY_TITLE_CLASSIFIER_REVISION]);
  for (let i = 0; i < rows.length; i++)
    assert.deepEqual(calls[i + 1].params, [
      SUPPLY_TITLE_CLASSIFIER_REVISION,
      now,
      now,
      rows[i].opportunity_id,
      rows[i].organization_id,
      rows[i].workspace_id,
      SUPPLY_TITLE_CLASSIFIER_REVISION,
    ]);
  assert.match(supplyClassifierRecoveryCandidatesSql, /LIMIT 100$/);
  assert.match(
    supplyClassifierRecoveryUpdateSql,
    /WHERE e.opportunity_id=\? AND e.organization_id=\? AND e.workspace_id=\?/,
  );
  for (const sql of [supplyClassifierRecoveryCandidatesSql, supplyClassifierRecoveryUpdateSql]) {
    assert.ok(sql.includes(selectionCandidateSql));
    for (const fragment of [
      "e.status='waiting_evidence'",
      "supply_title_classification_failed",
      "supply_title_classifier_revision",
      "<>?",
      "g.status='active'",
      "w.status='active'",
      "w.organization_id=o.organization_id",
      "o.organization_id=e.organization_id",
      "o.workspace_id=e.workspace_id",
      "o.decision_status='pending'",
      "NOT IN ('archived','deleted')",
    ])
      assert.ok(sql.includes(fragment), fragment);
  }
  assert.doesNotMatch(
    supplyClassifierRecoveryUpdateSql,
    /lease_owner=|lease_expires_at=|UPDATE opportunities|collection_tasks|INSERT INTO opportunity_events/,
  );
});

test("only a configured classifier enables recovery; enqueue never invokes the model", async () => {
  for (const configured of [false, true]) {
    const queries = [];
    let modelCalls = 0;
    const classifier = configured
      ? {
          classifySupplies: async () => {
            modelCalls++;
            return [];
          },
        }
      : undefined;
    const worker = new MySqlAutomaticSelectionEvaluationWorker(
      {
        query: async (sql) => {
          queries.push(sql);
          return [[]];
        },
      },
      "worker",
      "actor",
      120,
      () => new Date(),
      classifier,
    );
    await worker.enqueueEligibleCandidates();
    assert.equal(queries.includes(supplyClassifierRecoveryCandidatesSql), configured);
    assert.equal(modelCalls, 0);
  }
});

test("evaluation results stamp the executing classifier revision without replacing existing facts", async () => {
  const calls = [];
  const worker = new MySqlAutomaticSelectionEvaluationWorker(
    {},
    "worker",
    "actor",
    120,
    () => new Date(),
    { classifySupplies: async () => [] },
  );
  await worker.complete(
    { query: async (sql, params) => calls.push({ sql, params }) },
    { opportunityId: "item" },
    "waiting_evidence",
    null,
    {
      error_code: "automatic_cost_scope_mismatch",
      supply_title_classification_error: "supply_title_classification_failed",
      supply_title_classifier_revision: "untrusted-old",
    },
    new Date(),
  );
  const result = JSON.parse(calls[0].params[4]);
  assert.equal(result.supply_title_classifier_revision, SUPPLY_TITLE_CLASSIFIER_REVISION);
  assert.equal(result.supply_title_classification_error, "supply_title_classification_failed");
  assert.equal(result.error_code, "automatic_cost_scope_mismatch");
  assert.equal(calls.length, 1);
});
