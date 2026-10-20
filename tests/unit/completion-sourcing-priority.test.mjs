import test from "node:test";
import assert from "node:assert/strict";
import {
  selectionCompetitionGateSql,
  latestCompetitorDetailSnapshotSql,
} from "../../packages/database/dist/index.js";
import {
  completionReadySourcingRowsSql,
  completionReadySourcingTaskSql,
} from "../../apps/worker/dist/completion-sourcing-policy.js";
import {
  collectionReadyOrderSql,
  pendingBrowserResultSql,
} from "../../apps/worker/dist/collection-source-scheduling-policy.js";
import * as schedulingPolicy from "../../apps/worker/dist/collection-source-scheduling-policy.js";
import { collectionScopeFairnessSqlCases } from "../fixtures/collection-scope-fairness-sql.mjs";

test("source preference reuses original five-competitor and formal primary proof", () => {
  assert.ok(
    completionReadySourcingRowsSql.includes(selectionCompetitionGateSql(5, "materialized")),
  );
  assert.ok(completionReadySourcingRowsSql.includes(latestCompetitorDetailSnapshotSql("c")));
  for (const field of ["current_price", "currency", "review_count", "rating_value"])
    assert.ok(completionReadySourcingRowsSql.includes(`s_main.${field} IS NOT NULL`));
  assert.match(completionReadySourcingTaskSql, /close_sourcing.task_id=collection_tasks.id/);
});
test("only the source completion preference precedes browser-result reuse and leaves the other turn unchanged", () => {
  const source = collectionReadyOrderSql(true, false, true),
    original = collectionReadyOrderSql(true, false, false);
  assert.ok(
    source.indexOf(completionReadySourcingTaskSql) < source.indexOf(pendingBrowserResultSql),
  );
  assert.equal(
    source.replace("CASE WHEN " + completionReadySourcingTaskSql + " THEN 0 ELSE 1 END,", ""),
    original,
  );
  assert.equal(
    collectionReadyOrderSql(false, false, true),
    collectionReadyOrderSql(false, false, false),
  );
});
test("source task, search, worker event, scope, quote and active-state bindings remain explicit", () => {
  for (const fragment of [
    "q.status='pending'",
    "p.code='1688_search'",
    "source_circuit.state='open'",
    "p.access_mode='authenticated_browser'",
    "p.terms_review_status='approved'",
    "a.actor_type='worker'",
    "a.event_type='sourcing.collection.auto_scheduled'",
    "ss.status='queued'",
    "ci.is_current=1 AND ci.amount_value>0",
    "newer.workspace_id=ss.workspace_id",
    "ws.organization_id=o.organization_id",
    "org.status='active'",
    "ws.status='active'",
    "s_main.freshness='fresh'",
    "s_main.source_status='healthy'",
    "supplier-keywords-v2",
  ])
    assert.ok(completionReadySourcingRowsSql.includes(fragment), fragment);
  assert.doesNotMatch(completionReadySourcingRowsSql, /FOR UPDATE|UPDATE |INSERT |DELETE /);
});

test("ordering-only fixtures replace the separately verified readiness predicate and cannot read real opportunity tables", () => {
  const cases = collectionScopeFairnessSqlCases(schedulingPolicy, completionReadySourcingTaskSql);
  for (const item of cases) {
    assert.ok(!item.sql.includes(completionReadySourcingTaskSql), item.name);
    assert.doesNotMatch(item.sql, /\b(?:FROM|JOIN) opportunities\b|FOR UPDATE/, item.name);
  }
  assert.ok(
    cases.some(
      (item) => item.name === "eligible sourcing turn precedes a ready Amazon browser result",
    ),
  );
  assert.ok(
    cases.some((item) => item.name === "other completion turn preserves browser result preference"),
  );
});
