import test from "node:test";
import assert from "node:assert/strict";
import {
  opportunityRecommendedListSourceSql,
  reuseRecommendedFilterIdentitySql,
} from "../../apps/api/dist/opportunity-recommended-list-scope.js";
import {
  opportunityRecommendationFactsSql,
  opportunityQualityGateSql,
  opportunityRecommendedSql,
  opportunityPrimaryAsinSql,
} from "../../apps/api/dist/opportunity-selection-policy.js";
import { opportunityListPrimaryAsinSql } from "../../apps/api/dist/opportunity-list-projection.js";
import { opportunityListSql } from "../fixtures/opportunity-list-sql.mjs";

const scope = {
  organizationId: "org",
  workspaceId: "ws",
  actorId: "actor",
  page: 2,
  pageSize: 20,
  selectionView: "recommended",
};
test("recommended source materializes original scoped identity after necessary scalar facts only", () => {
  assert.ok(
    opportunityRecommendedListSourceSql.includes(
      opportunityListPrimaryAsinSql + " filter_primary_asin",
    ),
  );
  assert.ok(opportunityRecommendedListSourceSql.includes(opportunityRecommendationFactsSql));
  assert.equal(
    (opportunityRecommendedListSourceSql.match(/LIMIT 18446744073709551615/g) || []).length,
    3,
  );
  assert.match(
    opportunityRecommendedListSourceSql,
    /WHERE o.organization_id=\? AND o.workspace_id=\? AND o.decision_status='pending'/,
  );
  assert.doesNotMatch(
    opportunityRecommendedListSourceSql,
    /lifecycle_status|FOR UPDATE|INSERT|UPDATE /,
  );
  assert.ok(
    opportunityQualityGateSql.startsWith("(" + opportunityRecommendationFactsSql + " AND "),
  );
});
test("count and page retain the entire original eligibility filter with one scoped cached identity", async () => {
  const [count, page] = await opportunityListSql(scope);
  const prefix = "SELECT COUNT(*) total FROM " + opportunityRecommendedListSourceSql + " WHERE ";
  assert.ok(count.sql.startsWith(prefix));
  const filter = count.sql.slice(prefix.length);
  const restored = filter.replaceAll("o.filter_primary_asin", () => opportunityPrimaryAsinSql);
  assert.equal(
    restored,
    "o.organization_id=? AND o.workspace_id=? AND o.decision_status='pending' AND " +
      opportunityRecommendedSql +
      " AND o.lifecycle_status<>'archived'",
  );
  assert.ok(
    page.sql.includes(
      "FROM " +
        opportunityRecommendedListSourceSql +
        " WHERE " +
        filter +
        " ORDER BY o.updated_at DESC,o.id DESC LIMIT ? OFFSET ?",
    ),
  );
  assert.deepEqual(count.params, ["org", "ws", "org", "ws", "org", "ws"]);
  assert.deepEqual(page.params.slice(4, -2), count.params);
  assert.deepEqual(page.params.slice(-2), [20, 20]);
  for (const q of [count, page])
    assert.equal((q.sql.replace(/'(?:''|[^'])*'/g, "").match(/\?/g) || []).length, q.params.length);
});
test("explicit archived status and bound filters remain outer predicates instead of becoming silently excluded", async () => {
  const [count] = await opportunityListSql({
    ...scope,
    lifecycleStatus: "archived",
    query: "quoted ' value",
    market: "US",
    decisionStatus: "pending",
    sourceTopicId: "topic",
  });
  assert.match(count.sql, /o.lifecycle_status=\?/);
  assert.doesNotMatch(count.sql, /o.lifecycle_status<>'archived'/);
  assert.ok(count.params.includes("archived"));
  assert.ok(count.params.includes("%quoted ' value%"));
  assert.ok(!count.sql.includes("quoted ' value"));
});
for (const selectionView of [undefined, "completed", "all", "rule_candidates", "evidence_pending"])
  test(`other view stays outside recommended materialization: ${selectionView}`, async () => {
    const [count] = await opportunityListSql({ ...scope, selectionView });
    assert.ok(!count.sql.includes("filter_primary_asin"));
    assert.deepEqual(count.params, ["org", "ws"]);
  });
test("identity substitution preserves literal regexp suffixes instead of expanding JavaScript replacement tokens", () => {
  const restored = reuseRecommendedFilterIdentitySql(opportunityRecommendedSql).replaceAll(
    "o.filter_primary_asin",
    () => opportunityPrimaryAsinSql,
  );
  assert.equal(restored, opportunityRecommendedSql);
});
