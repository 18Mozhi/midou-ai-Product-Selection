import test from "node:test";
import assert from "node:assert/strict";
import {
  selectionCompetitionGateSql,
  selectionCompletedCompetitorsSql,
  selectionCompetitorRelevanceSql,
  competitorDetailEvidenceSql,
} from "../../packages/database/dist/index.js";
import { competitorRelevanceCases } from "../fixtures/competitor-relevance-sql.mjs";

test("recommendation and pipeline completion require the same relatedness proof", () => {
  assert.ok(selectionCompetitionGateSql(5).includes(selectionCompetitorRelevanceSql));
  assert.ok(selectionCompletedCompetitorsSql.includes(selectionCompetitorRelevanceSql));
  assert.ok(selectionCompletedCompetitorsSql.includes(competitorDetailEvidenceSql("s_sample")));
  // Detail collection remains a separate historical fact, not a claim of relatedness.
  assert.ok(!competitorDetailEvidenceSql("s").includes("competitors_classified"));
});
test("the original source, classification scope and latest event are inseparable", () => {
  for (const term of [
    "l_relation.collection_subquery_id=q_relation.id",
    "n_relation.raw_evidence_id=l_relation.raw_evidence_id",
    "q_relation.organization_id=o.organization_id",
    "q_relation.workspace_id=o.workspace_id",
    "'$.scope'",
    "'candidate_excerpt'",
    "'primary_excerpt'",
    "'relation','substitute'",
    "ORDER BY latest_relation.occurred_at DESC,latest_relation.id DESC LIMIT 1",
  ])
    assert.ok(selectionCompetitorRelevanceSql.includes(term), term);
  assert.doesNotMatch(selectionCompetitorRelevanceSql, /JSON_TABLE|WITH RECURSIVE|JSON_SEARCH/i);
});
test("read-only MySQL cases cover positive, foreign-scope, cross-array and historical audit cases", () => {
  assert.ok(competitorRelevanceCases.length >= 30);
  assert.equal(
    new Set(competitorRelevanceCases.map((c) => c.name)).size,
    competitorRelevanceCases.length,
  );
  assert.equal(competitorRelevanceCases.filter((c) => c.expected === 1).length, 6);
  for (const c of competitorRelevanceCases) {
    assert.ok(c.sql.startsWith("SELECT EXISTS"), c.name);
    assert.doesNotMatch(c.sql, /\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)\b/i);
  }
});
