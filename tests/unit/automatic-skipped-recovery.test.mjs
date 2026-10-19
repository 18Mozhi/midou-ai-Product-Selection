import test from "node:test";
import assert from "node:assert/strict";
import {
  recoverSkippedSelectionEvaluations,
  skippedSelectionRecoveryCandidatesSql,
  skippedSelectionRecoveryUpdateSql,
} from "../../apps/worker/dist/automatic-selection-skipped-recovery.js";
import { selectionCandidateSql } from "../../packages/database/dist/index.js";
import {
  skippedRecoveryScenarios,
  skippedRecoveryProbe,
} from "../fixtures/skipped-selection-recovery-sql.mjs";

test("read-only derived probes cover both guards without creating tables or jobs", () => {
  for (const scenario of skippedRecoveryScenarios)
    for (const point of [false, true]) {
      const probe = skippedRecoveryProbe({
        candidateSql: skippedSelectionRecoveryCandidatesSql,
        updateSql: skippedSelectionRecoveryUpdateSql,
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

test("skipped recovery uses a bounded consistent read and atomic scoped point rechecks", async () => {
  const calls = [],
    now = new Date("2026-10-20T00:00:00Z");
  const rows = [
    { opportunity_id: "a", organization_id: "org", workspace_id: "ws" },
    { opportunity_id: "b", organization_id: "other", workspace_id: "other-ws" },
  ];
  const count = await recoverSkippedSelectionEvaluations(
    {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return calls.length === 1 ? [rows] : [{ affectedRows: calls.length === 2 ? 1 : 0 }];
      },
    },
    now,
  );
  assert.equal(count, 1);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].sql, skippedSelectionRecoveryCandidatesSql);
  assert.doesNotMatch(calls[0].sql, /FOR UPDATE|UPDATE |INSERT /);
  for (let i = 0; i < rows.length; i++) {
    assert.equal(calls[i + 1].sql, skippedSelectionRecoveryUpdateSql);
    assert.deepEqual(calls[i + 1].params, [
      now,
      now,
      rows[i].opportunity_id,
      rows[i].organization_id,
      rows[i].workspace_id,
    ]);
  }
});
test("both recovery guards require exact skipped successes, active matching tenant and current primary evidence", () => {
  for (const sql of [skippedSelectionRecoveryCandidatesSql, skippedSelectionRecoveryUpdateSql]) {
    for (const clause of [
      "e.status='succeeded'",
      "IN ('not_rule_candidate','primary_product_missing_or_not_pending')",
      "g.status='active'",
      "w.status='active'",
      "w.organization_id=o.organization_id",
      "o.organization_id=e.organization_id",
      "o.workspace_id=e.workspace_id",
      "o.decision_status='pending'",
      "o.lifecycle_status NOT IN ('archived','deleted')",
      selectionCandidateSql,
    ])
      assert.ok(sql.includes(clause), clause);
    assert.doesNotMatch(sql, /OR e.status|waiting_evidence|failed_terminal|dead_letter/);
  }
  assert.match(skippedSelectionRecoveryCandidatesSql, /LIMIT 100$/);
  assert.match(
    skippedSelectionRecoveryUpdateSql,
    /WHERE e.opportunity_id=\? AND e.organization_id=\? AND e.workspace_id=\?/,
  );
  assert.match(skippedSelectionRecoveryUpdateSql, /result_json=NULL,last_error_code=NULL/);
  assert.doesNotMatch(
    skippedSelectionRecoveryUpdateSql,
    /SET[^]*lease_owner=|opportunity_events|purchase_price|score_runs/,
  );
});
test("no recovery candidate means no write", async () => {
  let calls = 0;
  assert.equal(
    await recoverSkippedSelectionEvaluations(
      {
        query: async () => {
          calls++;
          return [[]];
        },
      },
      new Date(),
    ),
    0,
  );
  assert.equal(calls, 1);
});
