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
  lifecycle_entered_at: "2026-08-19T20:00:00.000Z",
  lifecycle_dwell_seconds: 14400,
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
  assert.equal(result.items[0].lifecycle_dwell_seconds, 14400);
  assert.match(statements[1].sql, /lifecycle_entered_at[\s\S]*lifecycle_dwell_seconds/);
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

test("opportunity detail centralizes persisted blocker release progress", async () => {
  const repository = new MySqlOpportunityRepository({
    query: async (sql) => {
      if (sql.includes("FROM opportunities o")) return [[row], []];
      if (sql.includes("FROM tasks WHERE"))
        return [
          [
            {
              id: "00000000-0000-4000-8000-000000000425",
              status: "completed",
              progress_percent: 100,
            },
          ],
          [],
        ];
      if (sql.includes("FROM opportunity_score_jobs"))
        return [
          [
            {
              id: "00000000-0000-4000-8000-000000000426",
              status: "queued",
              trigger_task_id: "00000000-0000-4000-8000-000000000425",
            },
          ],
          [],
        ];
      return [[], []];
    },
  });
  const detail = await repository.get({
    organizationId: scope.organizationId,
    workspaceId: scope.workspaceId,
    actorId: scope.actorId,
    opportunityId: row.id,
  });
  assert.equal(detail.adoption_blockers[0].status, "in_progress");
  assert.equal(detail.adoption_blockers[0].progress_percent, 100);
  assert.equal(detail.adoption_blockers[1].status, "in_progress");
  assert.equal(detail.adoption_blockers[1].score_job_status, "queued");
  assert.equal(detail.adoption_blockers[1].next_action, "评分任务处理中，完成后会提醒重新决策。");
  assert.equal(detail.redecision_ready, false);
});

test("opportunity detail explains the persisted rule source threshold", async () => {
  const ruleRow = {
    matched_rule_count: 2,
    enabled_rule_count: 2,
    minimum_source_count: 3,
  };
  const repository = new MySqlOpportunityRepository({
    query: async (sql) => {
      if (sql.includes("COUNT(DISTINCT m.monitoring_rule_id)")) return [[ruleRow], []];
      if (sql.includes("FROM opportunities o")) return [[{ ...row, source_count: 1 }], []];
      return [[], []];
    },
  });
  const detail = await repository.get({
    organizationId: scope.organizationId,
    workspaceId: scope.workspaceId,
    actorId: scope.actorId,
    opportunityId: row.id,
  });
  assert.equal(
    detail.adoption_blockers[1].next_action,
    "已命中 2 条运行规则；当前 1 个独立来源，达到 3 个后进入推荐。系统会继续自动补证。",
  );
});
