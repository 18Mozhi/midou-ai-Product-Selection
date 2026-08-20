import assert from "node:assert/strict";
import test from "node:test";

import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";

const scope = {
  organizationId: "00000000-0000-4000-8000-000000000421",
  workspaceId: "00000000-0000-4000-8000-000000000422",
  actorId: "00000000-0000-4000-8000-000000000423",
  page: 1,
  pageSize: 20,
  scope: "all",
};

const row = {
  id: "00000000-0000-4000-8000-000000000424",
  name: "证据待补机会",
  image_url: null,
  market: "US",
  category: "beauty",
  source_type: "manual",
  source_ref_id: null,
  owner_id: null,
  lifecycle_status: "candidate",
  recommendation_status: "insufficient_data",
  overall_score: null,
  trend_score: null,
  competition_score: null,
  profit_status: "insufficient_data",
  risk_level: "unknown",
  confidence_status: "insufficient_data",
  confidence_score: null,
  evidence_count: 0,
  source_count: 0,
  competitor_count: 0,
  supplier_candidate_count: 0,
  coverage_status: "insufficient",
  decision_status: "pending",
  version: 1,
  updated_at: "2026-08-20T00:00:00.000Z",
};

test("opportunity blocker filters reuse the persisted adoption guard facts", async () => {
  const statements = [];
  const repository = new MySqlOpportunityRepository({
    query: async (sql, values) => {
      statements.push({ sql, values });
      return sql.startsWith("SELECT COUNT(*)") ? [[{ total: 1 }], []] : [[row], []];
    },
  });

  const result = await repository.list({ ...scope, blockingReason: "evidence_insufficient" });
  assert.deepEqual(result.items[0].blocking_reasons, [
    "evidence_insufficient",
    "recommendation_insufficient",
  ]);
  assert.ok(
    statements.every(({ sql }) =>
      sql.includes("(o.evidence_count=0 OR o.coverage_status='insufficient')"),
    ),
  );

  statements.length = 0;
  await repository.list({ ...scope, blockingReason: "recommendation_insufficient" });
  assert.ok(
    statements.every(({ sql }) => sql.includes("o.recommendation_status='insufficient_data'")),
  );
});
