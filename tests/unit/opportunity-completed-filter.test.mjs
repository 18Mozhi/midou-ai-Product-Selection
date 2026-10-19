import test from "node:test";
import assert from "node:assert/strict";
import { opportunityListSql } from "../fixtures/opportunity-list-sql.mjs";
import { OpportunityService } from "../../apps/api/dist/opportunity-service.js";

const scope = {
  organizationId: "org",
  workspaceId: "workspace",
  actorId: "reader",
  page: 1,
  pageSize: 20,
};
test("completed count and page use scoped immutable first-completion proof, without recommendation gates", async () => {
  const queries = await opportunityListSql({ ...scope, selectionView: "completed" });
  assert.equal(queries.length, 2);
  for (const { sql, params } of queries) {
    assert.deepEqual(params.slice(0, 2), [scope.organizationId, scope.workspaceId]);
    for (const clause of [
      "completed.organization_id=o.organization_id",
      "completed.workspace_id=o.workspace_id",
      "completed.resource_id=o.id",
      "completed.actor_type='worker'",
      "earlier.organization_id=completed.organization_id",
      "earlier.workspace_id=completed.workspace_id",
      "earlier.occurred_at<completed.occurred_at",
      "earlier.id<completed.id",
      "selection-pipeline-v1",
      "selection-pipeline-v2",
      "^[A-Za-z0-9]{10}$",
    ])
      assert.ok(sql.includes(clause), clause);
    // Do not filter out completed low-score, adopted or archived historical records.
    const filter = sql.slice(sql.lastIndexOf("FROM opportunities o WHERE"));
    assert.doesNotMatch(filter, /decision_status='pending'|lifecycle_status<>'archived'/);
  }
});
test("explicit filters and original views retain their existing scope", async () => {
  const completed = await opportunityListSql({
    ...scope,
    selectionView: "completed",
    lifecycleStatus: "archived",
    query: "plane",
  });
  assert.ok(completed[0].sql.includes("o.lifecycle_status=?"));
  assert.ok(completed[0].params.includes("archived"));
  assert.ok(completed[0].params.includes("%plane%"));
  for (const selectionView of [
    "recommended",
    "rule_candidates",
    "evidence_pending",
    "all",
    undefined,
  ]) {
    const queries = await opportunityListSql({ ...scope, selectionView });
    assert.ok(queries[0].sql.includes("o.lifecycle_status<>'archived'"));
    assert.ok(!queries[0].sql.includes("earlier.occurred_at<completed.occurred_at"));
  }
});
test("service accepts completed but rejects unknown selection views", async () => {
  let received;
  const service = new OpportunityService({
    list: async (input) => {
      received = input;
      return { items: [], total: 0 };
    },
  });
  await service.list({ ...scope, selectionView: "completed" });
  assert.equal(received.selectionView, "completed");
  assert.throws(() => service.list({ ...scope, selectionView: "completed OR 1=1" }), {
    code: "opportunity_filter_invalid",
  });
});
