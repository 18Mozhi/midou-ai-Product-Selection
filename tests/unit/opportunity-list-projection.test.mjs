import test from "node:test";
import assert from "node:assert/strict";
import {
  opportunityListPrimaryAsinSql,
  opportunityListPrimaryRecordsSql,
  opportunityListSelectionProjectionSql,
  reuseListPrimaryIdentitySql,
} from "../../apps/api/dist/opportunity-list-projection.js";
import { opportunityPrimaryRecordsSql } from "../../apps/api/dist/opportunity-primary-product.js";
import {
  opportunityPrimaryAsinSql,
  opportunitySelectionProjectionSql,
} from "../../apps/api/dist/opportunity-selection-policy.js";
import { opportunityListSql } from "../fixtures/opportunity-list-sql.mjs";

const active = (alias) =>
  "(SELECT active_version.* FROM normalized_records active_version FORCE INDEX (idx_normalized_scope_status) WHERE active_version.organization_id=? AND active_version.workspace_id=? AND active_version.status='active' LIMIT 18446744073709551615) " +
  alias;

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
    assert.deepEqual(rows.params.slice(0, 4), [
      input.organizationId,
      input.workspaceId,
      input.organizationId,
      input.workspaceId,
    ]);
    assert.deepEqual(rows.params.slice(4, -2), count.params);
    assert.deepEqual(rows.params.slice(-2), [20, 40]);
    assert.equal(rows.params.includes("%quoted ' name%"), true);
    assert.equal(rows.sql.includes("quoted ' name"), false);
    assert.ok(rows.sql.includes(opportunityListPrimaryAsinSql + " primary_fact_asin"));
    assert.ok(rows.sql.includes(opportunityListPrimaryRecordsSql));
    assert.ok(rows.sql.endsWith("ORDER BY o.updated_at DESC,o.id DESC"));
    if (selectionView === "recommended") {
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
