import test from "node:test";
import assert from "node:assert/strict";
import {
  selectionPrimaryAsinSql,
  selectionCandidateExistsSql,
} from "../../packages/database/dist/index.js";
import {
  homeCandidateSql,
  homeQualityGateSql,
  homeRecommendedSql,
  homeCompetitorUpperBoundSql,
} from "../../apps/api/dist/home-selection-sql.js";
import { opportunityQualityGateSql } from "../../apps/api/dist/opportunity-selection-policy.js";
import { MINIMUM_SELECTION_COMPETITORS } from "../../packages/contracts/dist/index.js";
import { MySqlHomeDashboardRepository } from "../../apps/api/dist/mysql-home-dashboard-repository.js";

test("presence reuses every scoped identity proof without sorting or choosing a different identity", () => {
  const from = selectionPrimaryAsinSql.slice(
    selectionPrimaryAsinSql.indexOf("FROM "),
    selectionPrimaryAsinSql.lastIndexOf("ORDER BY "),
  );
  assert.equal(selectionCandidateExistsSql, `EXISTS (SELECT 1 ${from})`);
  assert.doesNotMatch(selectionCandidateExistsSql, /ORDER BY|LIMIT/);
  assert.match(
    selectionPrimaryAsinSql,
    /ORDER BY l_primary.created_at,n_primary.created_at DESC LIMIT 1/,
  );
  assert.equal(homeCandidateSql, `(${selectionCandidateExistsSql})`);
});

test("upper bound cannot grant a recommendation and preserves the full original quality gate", () => {
  assert.equal(
    homeQualityGateSql,
    `(CASE WHEN ${homeCompetitorUpperBoundSql}>=${MINIMUM_SELECTION_COMPETITORS} THEN ${opportunityQualityGateSql} ELSE 0 END)`,
  );
  assert.equal(homeRecommendedSql, `(${homeCandidateSql} AND ${homeQualityGateSql})`);
  assert.match(homeCompetitorUpperBoundSql, /COUNT\(DISTINCT UPPER\(c_bound.external_id\)\)/);
  for (const scope of ["organization_id", "workspace_id"]) {
    assert.ok(homeCompetitorUpperBoundSql.includes(`s_bound.${scope}=c_bound.${scope}`));
    assert.ok(homeCompetitorUpperBoundSql.includes(`c_bound.${scope}=o.${scope}`));
  }
  assert.match(homeCompetitorUpperBoundSql, /c_bound.opportunity_id=o.id/);
  for (const field of ["current_price", "currency", "review_count", "rating_value"])
    assert.ok(homeCompetitorUpperBoundSql.includes(`s_bound.${field} IS NOT NULL`));
  // Historical or unrelated snapshots may inflate the bound; they must still be
  // rejected by the original detail, current identity and relation proofs.
  assert.ok(homeQualityGateSql.includes(opportunityQualityGateSql));
});

test("home summary and recommendation rows both use the bounded full proof", async () => {
  const calls = [];
  const repository = new MySqlHomeDashboardRepository({
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[]];
    },
  });
  await repository.automaticSelection({ organizationId: "org", workspaceId: "ws" });
  await repository.list({
    organizationId: "org",
    workspaceId: "ws",
    actorId: "actor",
    capabilities: ["opportunity:read"],
  });
  assert.ok(calls[0].sql.includes(homeCandidateSql));
  assert.ok(calls[0].sql.includes(homeQualityGateSql));
  const recommendation = calls.find((c) => c.sql.startsWith("SELECT o.id,o.name"));
  assert.ok(recommendation.sql.includes(homeRecommendedSql));
  assert.deepEqual(recommendation.params, ["org", "ws", "actor"]);
});
