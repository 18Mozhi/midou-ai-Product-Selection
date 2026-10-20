import test from "node:test";
import assert from "node:assert/strict";
import {
  selectionCompletionSourceNotRejectedSql,
  selectionPipelineCompletionProofSql,
} from "../../packages/database/dist/index.js";
import { dailySelectionCompletedSql } from "../../apps/api/dist/home-daily-selection.js";
import {
  opportunityAnalysisCompletedAtSql,
  opportunityCompletedFilterSql,
} from "../../apps/api/dist/opportunity-completed-filter.js";
import { completionSourceRevocationCases } from "../fixtures/selection-completion-source-sql.mjs";

test("daily count, library, detail and writer share the same definite-source-rejection proof", () => {
  for (const alias of [
    "completion_receipt",
    "receipt",
    "completed",
    "earlier",
    "completion_prior",
  ]) {
    const sql = selectionCompletionSourceNotRejectedSql(alias);
    for (const column of ["organization_id", "workspace_id", "resource_id"])
      assert.ok(sql.includes(`rejected_source.${column}=${alias}.${column}`));
    assert.ok(sql.includes(`rejected_source.occurred_at>=${alias}.occurred_at`));
    assert.ok(sql.includes(`rejected_origin.occurred_at<=${alias}.occurred_at`));
    assert.match(sql, /JSON_TYPE[\s\S]*='BOOLEAN'/);
    assert.match(sql, /original_intelligence_or_primary_missing/);
    assert.match(sql, /intelligence_record_id/);
    assert.doesNotMatch(
      sql,
      /UPDATE |DELETE |INSERT |recommendation_status|profit_status|decision_status/,
    );
  }
  assert.ok(
    dailySelectionCompletedSql.includes(
      selectionCompletionSourceNotRejectedSql("completion_receipt"),
    ),
  );
  assert.ok(
    opportunityAnalysisCompletedAtSql.includes(selectionCompletionSourceNotRejectedSql("receipt")),
  );
  for (const alias of ["completed", "earlier"])
    assert.ok(
      opportunityCompletedFilterSql.includes(selectionCompletionSourceNotRejectedSql(alias)),
    );
  assert.match(selectionPipelineCompletionProofSql, /ie.resource_id=o.source_ref_id/);
  assert.match(selectionPipelineCompletionProofSql, /newer_primary.workspace_id=ie.workspace_id/);
  assert.match(selectionPipelineCompletionProofSql, /newer_primary.occurred_at>ie.occurred_at/);
});

test("counterfactual fixtures include real consumers and remain isolated SELECT-only", () => {
  const cases = completionSourceRevocationCases();
  assert.equal(cases.length, 92);
  assert.equal(new Set(cases.map((c) => c.name)).size, cases.length);
  for (const c of cases) {
    assert.match(c.sql, /^SELECT /);
    assert.doesNotMatch(
      c.sql,
      /FROM opportunity_events|FROM trend_events|UPDATE |DELETE |INSERT |FOR UPDATE/,
    );
    assert.equal((c.sql.match(/\?/g) ?? []).length, c.params.length);
  }
});
