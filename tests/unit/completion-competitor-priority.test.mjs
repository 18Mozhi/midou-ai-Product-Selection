import test from "node:test";
import assert from "node:assert/strict";
import {
  selectionPrimaryAsinSql,
  selectionCompetitionGateSql,
  selectionCompetitorRelevanceSql,
  latestCompetitorDetailSnapshotSql,
} from "../../packages/database/dist/index.js";
import {
  completionReadyCompetitorRowsSql as rows,
  completionReadyCompetitorTaskSql as preferred,
} from "../../apps/worker/dist/completion-competitor-policy.js";
import * as policy from "../../apps/worker/dist/collection-source-scheduling-policy.js";
import { collectionScopeFairnessSqlCases } from "../fixtures/collection-scope-fairness-sql.mjs";
import { completionReadySourcingTaskSql } from "../../apps/worker/dist/completion-sourcing-policy.js";

test("competitor preference retains actual primary, current relevance and original five-detail gate", () => {
  assert.ok(rows.includes(selectionPrimaryAsinSql));
  assert.ok(rows.includes(selectionCompetitionGateSql(5, "materialized")));
  assert.ok(
    rows.includes(
      selectionCompetitorRelevanceSql.replaceAll(selectionPrimaryAsinSql, "o.primary_asin"),
    ),
  );
  for (const alias of ["c", "c_sample"])
    assert.ok(rows.includes(latestCompetitorDetailSnapshotSql(alias)));
  for (const field of ["current_price", "currency", "review_count", "rating_value"])
    assert.ok(rows.includes(`s_main.${field} IS NOT NULL`));
  for (const fragment of [
    "SELECT STRAIGHT_JOIN",
    "SELECT DISTINCT pending.opportunity_id",
    "e.actor_type='worker'",
    "competitor.detail.auto_scheduled",
    "p.id=c.provider_id",
    "p.code='amazon_product'",
    "p.terms_review_status='approved'",
    "c_sample.market=o.market",
    "UPPER(c_sample.external_id)<>BINARY o.primary_asin",
    "ws.organization_id=o.organization_id",
    "t.status='queued'",
    "t.attempt_count<4",
    "q.status='pending'",
  ])
    assert.ok(rows.includes(fragment), fragment);
  assert.doesNotMatch(rows, /FOR UPDATE|\b(?:INSERT|UPDATE|DELETE)\b/);
});

test("only completion preference follows cached results, without changing the FIFO escape", () => {
  const order = policy.collectionReadyOrderSql(true, false, false);
  assert.ok(order.indexOf(policy.pendingBrowserResultSql) < order.indexOf(preferred));
  assert.ok(order.endsWith("available_at,id LIMIT 1"));
  assert.ok(!policy.collectionReadyOrderSql(false).includes(preferred));
  assert.ok(!policy.collectionReadyOrderSql(true, true).includes(preferred));
  assert.equal(
    policy.collectionReadyOrderSql(true, false, false, false),
    order.replace("CASE WHEN " + preferred + " THEN 0 ELSE 1 END,", ""),
  );
  assert.equal(
    policy.collectionReadyOrderSql(false, true, true),
    policy.collectionReadyOrderSql(false),
  );
});

test("ordering scenarios cover independent details, cache, source turns, priority and FIFO without real tables", () => {
  const cases = collectionScopeFairnessSqlCases(policy, completionReadySourcingTaskSql);
  for (const item of cases) {
    assert.ok(!item.sql.includes(preferred), item.name);
    assert.doesNotMatch(
      item.sql,
      /\b(?:FROM|JOIN) (?:opportunities|competitors|competitor_snapshots)\b|FOR UPDATE/,
      item.name,
    );
  }
  for (const name of [
    "independent competitor detail precedes older primary detail within completion",
    "already collected browser result precedes independent detail preference",
    "competitor preference preserves shared FIFO escape",
    "competitor preference preserves critical priority",
  ])
    assert.ok(
      cases.some((item) => item.name === name),
      name,
    );
});
