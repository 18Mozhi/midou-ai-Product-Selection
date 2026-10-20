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
  completionCompetitorApprovedSourceSql as sourceProof,
} from "../../apps/worker/dist/completion-competitor-policy.js";
import {
  PRIMARY_SOURCE_SUPPORT_EVENT,
  PRIMARY_SOURCE_SUPPORT_REVISION,
} from "../../apps/worker/dist/primary-source-support-contract.js";
import * as policy from "../../apps/worker/dist/collection-source-scheduling-policy.js";
import { collectionScopeFairnessSqlCases } from "../fixtures/collection-scope-fairness-sql.mjs";
import { completionReadySourcingTaskSql } from "../../apps/worker/dist/completion-sourcing-policy.js";
import { completionCompetitorGateCases } from "../fixtures/completion-competitor-priority-sql.mjs";

test("competitor preference retains actual primary, current relevance and original five-detail gate", () => {
  assert.ok(rows.includes(sourceProof));
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

test("competitor preference binds the latest worker approval to current primary and original source", () => {
  for (const fragment of [
    PRIMARY_SOURCE_SUPPORT_EVENT,
    PRIMARY_SOURCE_SUPPORT_REVISION,
    "source_approval.organization_id=o.organization_id",
    "source_approval.workspace_id=o.workspace_id",
    "source_approval.resource_id=o.id",
    "source_approval.actor_type='worker'",
    "source_origin.resource_id=o.source_ref_id",
    "source_news.status IN ('active','superseded')",
    "JSON_TYPE(JSON_EXTRACT(source_approval.payload_json,'$.supported'))='BOOLEAN'",
    "UPPER(JSON_UNQUOTE(JSON_EXTRACT(source_approval.payload_json,'$.primary_asin')))=BINARY o.primary_asin",
    "newer_source.actor_type='worker'",
    "newer_origin.occurred_at>source_origin.occurred_at",
  ])
    assert.ok(sourceProof.includes(fragment), fragment);
  assert.doesNotMatch(sourceProof, /FOR UPDATE|\b(?:INSERT|UPDATE|DELETE)\b/);
});

test("source proof counterfactuals retain literal JSON boolean SQL and only produce reads", () => {
  const cases = completionCompetitorGateCases(rows);
  assert.equal(cases.length, 44);
  assert.equal(new Set(cases.map((c) => c.name)).size, cases.length);
  assert.ok(
    cases
      .find((c) => c.name === "rejected original source cannot retain preference")
      .sql.includes(
        "JSON_SET(payload_json,'$.supported',JSON_EXTRACT('false','$')) payload_json FROM opportunity_events) source_approval",
      ),
  );
  for (const c of cases) {
    assert.match(c.sql, /^SELECT /);
    assert.doesNotMatch(c.sql, /FOR UPDATE|\b(?:INSERT INTO|DELETE FROM|UPDATE [a-z_]+ SET)\b/i);
  }
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
