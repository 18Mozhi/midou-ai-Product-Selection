import test from "node:test";
import assert from "node:assert/strict";
import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";
import { OpportunityService } from "../../apps/api/dist/opportunity-service.js";

const scope = {
  organizationId: "00000000-0000-4000-8000-000000000421",
  workspaceId: "00000000-0000-4000-8000-000000000422",
  actorId: "00000000-0000-4000-8000-000000000423",
  sourceTopicId: "00000000-0000-4000-8000-000000000424",
  page: 1,
  pageSize: 5,
  selectionView: "all",
};
test("source topic filters both page and count using exact scoped provenance, never a title", async () => {
  const statements = [];
  const repository = new MySqlOpportunityRepository({
    query: async (sql, values) => {
      statements.push({ sql, values });
      return sql.startsWith("SELECT COUNT(*)") ? [[{ total: 0 }]] : [[]];
    },
  });
  await repository.list(scope);
  assert.equal(statements.length, 2);
  for (const { sql, values } of statements) {
    assert.ok(values.includes(scope.sourceTopicId));
    for (const clause of [
      "o.source_type='trend_topic'",
      "o.source_ref_id=",
      "trend_signals",
      "opportunity_evidence_links",
      "evidence_type='trend_signal'",
      "organization_id=o.organization_id",
      "workspace_id=o.workspace_id",
    ])
      assert.ok(sql.includes(clause), clause);
    assert.doesNotMatch(sql, /o\.name LIKE/);
  }
});
test("a malformed or empty source topic must fail instead of broadening to all products", () => {
  const service = new OpportunityService({
    list: () => assert.fail("invalid filter reached repository"),
  });
  for (const sourceTopicId of ["", "iphone", "x' OR 1=1", [scope.sourceTopicId]])
    assert.throws(() => service.list({ ...scope, sourceTopicId }), {
      code: "opportunity_input_invalid",
    });
});
