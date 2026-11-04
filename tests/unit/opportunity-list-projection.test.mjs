import test from "node:test";
import assert from "node:assert/strict";
import {
  opportunityListPrimaryAsinSql,
  opportunityListPrimaryRecordsSql,
  opportunityListSelectionProjectionSql,
  reuseListPrimaryIdentitySql,
  scopedActiveVersionsSql,
} from "../../apps/api/dist/opportunity-list-projection.js";
import { opportunityPrimaryRecordsSql } from "../../apps/api/dist/opportunity-primary-product.js";
import {
  opportunityPrimaryAsinSql,
  opportunitySelectionProjectionSql,
} from "../../apps/api/dist/opportunity-selection-policy.js";
import { opportunityListSql } from "../fixtures/opportunity-list-sql.mjs";

const active = scopedActiveVersionsSql;

test("materialized payload contains every referenced fact but no unrelated review bodies", () => {
  const facts = active("n"),
    identity = active("n_primary_current");
  assert.doesNotMatch(facts, /active_version\.\*|reviews|description/);
  for (const field of [
    "asin",
    "canonical_url",
    "price",
    "currency",
    "rating_value",
    "review_count",
    "image_url",
    "sales_badge_text",
    "sales_badge_quantity_lower_bound",
    "sales_badge_period",
    "sponsored",
    "best_seller_rank",
    "best_seller_rank_text",
  ])
    assert.ok(facts.includes(`JSON_EXTRACT(active_version.payload_json,'$.${field}')`));
  assert.ok(identity.includes("'$.asin'"));
  assert.ok(identity.includes("'$.canonical_url'"));
  assert.ok(!identity.includes("'$.price'"));
  for (const sql of [facts, identity]) {
    assert.match(sql, /organization_id=\? AND active_version.workspace_id=\?/);
    assert.match(
      sql,
      /status='active' AND active_version.provider_id=\(SELECT id FROM providers WHERE code='amazon_product'\) LIMIT 18446744073709551615/,
    );
  }
});

test("list identity changes join strategy without removing any evidence, current-version or ordering proof", () => {
  const restored = opportunityListPrimaryAsinSql
    .replace(
      "FROM opportunity_evidence_links l_primary STRAIGHT_JOIN normalized_records n_primary FORCE INDEX (idx_normalized_evidence) ON",
      "FROM opportunity_evidence_links l_primary JOIN normalized_records n_primary ON",
    )
    .replace(
      "STRAIGHT_JOIN " + active("n_primary_current") + " ON",
      "JOIN normalized_records n_primary_current ON",
    );
  assert.equal(restored, opportunityPrimaryAsinSql);
  assert.equal(
    opportunityListPrimaryAsinSql.split("active_version.organization_id=?").length - 1,
    1,
  );
});

test("primary facts retain the complete original columns, detail evidence and selection order", () => {
  assert.ok(opportunityListPrimaryRecordsSql.includes(active("n")));
  assert.equal(
    opportunityListPrimaryRecordsSql.replace(
      "STRAIGHT_JOIN " + active("n") + " ON",
      "STRAIGHT_JOIN normalized_records n FORCE INDEX (uq_normalized_scope_record_version) ON",
    ),
    opportunityPrimaryRecordsSql,
  );
  assert.match(opportunityListPrimaryRecordsSql, /n_seed.status IN \('active','superseded'\)/);
});

test("all selection gates reuse the paged identity without changing their predicates", () => {
  assert.equal(
    opportunityListSelectionProjectionSql.replaceAll(
      "o.primary_fact_asin",
      () => opportunityPrimaryAsinSql,
    ),
    opportunitySelectionProjectionSql,
  );
  assert.equal(
    reuseListPrimaryIdentitySql("SELECT " + opportunityPrimaryAsinSql + " main_asin"),
    "SELECT o.primary_fact_asin main_asin",
  );
});

for (const selectionView of ["all", "recommended", "rule_candidates", "evidence_pending"])
  test(`list ${selectionView} binds both active-version sets before original filters and page`, async () => {
    const input = {
      organizationId: "org-a",
      workspaceId: "workspace-a",
      actorId: "actor",
      page: 3,
      pageSize: 20,
      selectionView,
      query: "quoted ' name",
      market: "US",
      decisionStatus: "pending",
      coverageStatus: "partial",
      lifecycleStatus: "validating",
      ownerId: "owner-a",
    };
    const [count, rows] = await opportunityListSql(input);
    const pendingIdentity = ["recommended", "rule_candidates", "evidence_pending"].includes(
      selectionView,
    );
    const prefix = pendingIdentity ? 2 : 4;
    assert.deepEqual(
      rows.params.slice(0, prefix),
      pendingIdentity
        ? [input.organizationId, input.workspaceId]
        : [input.organizationId, input.workspaceId, input.organizationId, input.workspaceId],
    );
    assert.deepEqual(rows.params.slice(prefix, -2), count.params);
    assert.deepEqual(rows.params.slice(-2), [20, 40]);
    assert.equal(rows.params.includes("%quoted ' name%"), true);
    assert.equal(rows.sql.includes("quoted ' name"), false);
    assert.ok(
      rows.sql.includes(
        (pendingIdentity ? "o.filter_primary_asin" : opportunityListPrimaryAsinSql) +
          " primary_fact_asin",
      ),
    );
    assert.ok(rows.sql.includes(reuseListPrimaryIdentitySql(opportunityListPrimaryRecordsSql)));
    assert.ok(rows.sql.endsWith("ORDER BY o.updated_at DESC,o.id DESC"));
    if (["recommended", "rule_candidates", "evidence_pending"].includes(selectionView)) {
      assert.match(count.sql, /filter_primary_asin/);
      assert.deepEqual(count.params.slice(0, 4), [
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
      ]);
    } else {
      assert.match(
        count.sql,
        /SELECT COUNT\(\*\) total FROM opportunities o WHERE o.organization_id=\? AND o.workspace_id=\?/,
      );
      assert.doesNotMatch(count.sql, /active_version/);
    }
  });
