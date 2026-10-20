import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { opportunityAnalysisCompletedAtSql } from "../../apps/api/dist/opportunity-completed-filter.js";
import { completionReceiptCases } from "../fixtures/opportunity-completion-receipt-sql.mjs";

test("completion receipt binds scope, opportunity, worker contract and current primary without recommendation gates", () => {
  for (const clause of [
    "receipt.organization_id=?",
    "receipt.workspace_id=?",
    "receipt.resource_id=?",
    "receipt.actor_type='worker'",
    "selection-pipeline-v1",
    "selection-pipeline-v2",
    "BINARY UPPER(?)",
    "ORDER BY receipt.occurred_at,receipt.id LIMIT 1",
  ])
    assert.ok(opportunityAnalysisCompletedAtSql.includes(clause), clause);
  assert.doesNotMatch(
    opportunityAnalysisCompletedAtSql,
    /quality_gates|recommendation_status|profit_status/,
  );
  assert.equal(completionReceiptCases().length, 14);
});

test("only a valid API completion timestamp enables completed presentation", async () => {
  const source = await readFile(
    "apps/web/src/components/opportunity-decision-presentation.ts",
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  });
  const { opportunityAnalysisCompletedAt, opportunityQualityGatesPassed } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
  const time = "2026-10-19T18:01:19.130Z";
  assert.equal(opportunityAnalysisCompletedAt(time), time);
  for (const value of [
    null,
    undefined,
    "",
    "0",
    "completed",
    "/opportunities?view=completed",
    "2026-99-99T00:00:00Z",
    100,
    { status: "completed" },
  ])
    assert.equal(opportunityAnalysisCompletedAt(value), null);
  assert.equal(
    opportunityQualityGatesPassed({
      score: false,
      market: true,
      competition: true,
      cost: false,
      risk: true,
      all_passed: false,
    }),
    false,
  );
});
