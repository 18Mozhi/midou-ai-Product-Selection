import test from "node:test";
import assert from "node:assert/strict";
import { MySqlSelectionJourneyRepository } from "../../apps/api/dist/mysql-selection-journey-repository.js";

const context = {
  journeyId: "00000000-0000-4000-8000-000000007601",
  organizationId: "00000000-0000-4000-8000-000000000001",
  workspaceId: "00000000-0000-4000-8000-000000000002",
  actorId: "00000000-0000-4000-8000-000000000003",
  requestId: "test-journey-gates",
  traceId: "test-journey-gates",
  idempotencyKey: "test-journey-gates",
  action: "adopt",
  reason: "已核对五项质量门",
  selectedRawEvidenceId: "00000000-0000-4000-8000-000000007612",
  now: new Date("2026-09-09T08:00:00.000Z"),
};
const complete = {
  id: "00000000-0000-4000-8000-000000000424",
  version: 3,
  decision_status: "pending",
  rule_candidate_ready: 1,
  recommendation_status: "recommend",
  overall_score: 82,
  score_rule_version: "score-v1",
  coverage_status: "complete",
  trend_score: 80,
  competition_score: 76,
  profit_status: "calculated",
  risk_gate_passed: 1,
};
function harness(opportunity, { replay = false } = {}) {
  const statements = [];
  let commits = 0,
    rollbacks = 0,
    releases = 0;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => commits++,
    rollback: async () => rollbacks++,
    release: () => releases++,
    query: async (sql, values) => {
      statements.push({ sql, values });
      if (sql.includes("FROM selection_journey_operations"))
        return [replay ? [{ journey_id: context.journeyId }] : []];
      if (sql.includes("FROM selection_journeys") && sql.includes("FOR UPDATE"))
        return [
          [
            {
              state: "result_ready",
              task_status: "succeeded",
              available_result_count: 1,
              task_id: "task-A",
            },
          ],
        ];
      if (sql.includes("FROM collection_task_evidence_links l"))
        return [[{ topic_id: "topic-A", title: "候选", market: "US" }]];
      if (sql.includes("FROM opportunities")) return [opportunity ? [opportunity] : []];
      if (/^(INSERT|UPDATE)/.test(sql)) return [{ affectedRows: 1 }];
      throw new Error("Unexpected query: " + sql);
    },
  };
  const repository = new MySqlSelectionJourneyRepository({ getConnection: async () => connection });
  // The transaction is real repository code; the post-commit reader is tested separately.
  repository.read = async () => ({ id: context.journeyId, state: "decided" });
  return {
    repository,
    statements,
    counts: () => ({ commits, rollbacks, releases }),
  };
}

for (const [name, row] of [
  ["no evaluated opportunity", null],
  ["score", { ...complete, overall_score: null }],
  ["market", { ...complete, trend_score: null }],
  ["competition", { ...complete, competition_score: null }],
  ["cost", { ...complete, profit_status: "insufficient_data" }],
  ["risk", { ...complete, risk_gate_passed: 0 }],
  ["coverage", { ...complete, coverage_status: "partial" }],
  ["enabled rule threshold", { ...complete, rule_candidate_ready: 0 }],
  ["already decided", { ...complete, decision_status: "adopted" }],
]) {
  test("journey adopt rejects " + name + " before any write", async () => {
    const h = harness(row);
    await assert.rejects(h.repository.decide(context), {
      code: "opportunity_adopt_evidence_insufficient",
      statusCode: 409,
    });
    assert.equal(
      h.statements.some(({ sql }) => /^(INSERT|UPDATE|DELETE)/.test(sql)),
      false,
    );
    assert.deepEqual(h.counts(), { commits: 0, rollbacks: 1, releases: 1 });
  });
}

test("journey adopt locks the scoped current opportunity and preserves assessed facts", async () => {
  const h = harness(complete);
  await h.repository.decide(context);
  const lookup = h.statements.find(({ sql }) => sql.includes("FROM opportunities"));
  assert.match(lookup.sql, /FOR UPDATE/);
  assert.match(lookup.sql, /rule_candidate_ready/);
  assert.match(lookup.sql, /risk_gate_passed/);
  assert.deepEqual(lookup.values, [context.organizationId, context.workspaceId, "topic-A"]);
  assert.equal(
    h.statements.some(({ sql }) => sql.startsWith("INSERT INTO opportunities")),
    false,
  );
  assert.equal(
    h.statements.some(({ sql }) => sql.includes("INSERT IGNORE INTO opportunity_evidence_links")),
    false,
  );
  const update = h.statements.find(({ sql }) => sql.startsWith("UPDATE opportunities"));
  assert.ok(update);
  assert.doesNotMatch(
    update.sql,
    /coverage_status|evidence_count|source_count|overall_score|profit_status/,
  );
  assert.match(update.sql, /lifecycle_entered_at/);
  assert.deepEqual(update.values.slice(-3), [
    complete.id,
    context.organizationId,
    context.workspaceId,
  ]);
  assert.ok(h.statements.some(({ sql }) => sql.startsWith("INSERT INTO opportunity_decisions")));
  assert.ok(
    h.statements.some(({ sql }) => sql.startsWith("INSERT INTO selection_journey_decisions")),
  );
  assert.ok(h.statements.some(({ sql }) => sql.startsWith("INSERT IGNORE INTO tasks")));
  assert.deepEqual(h.counts(), { commits: 1, rollbacks: 0, releases: 1 });
});

for (const action of ["observe", "reject"]) {
  test("journey " + action + " keeps its original non-adoption workflow", async () => {
    const h = harness(null);
    await h.repository.decide({ ...context, action, selectedRawEvidenceId: null });
    assert.equal(
      h.statements.some(({ sql }) => sql.includes("FROM opportunities")),
      false,
    );
    assert.equal(
      h.statements.some(({ sql }) => sql.startsWith("UPDATE opportunities")),
      false,
    );
    const decision = h.statements.find(({ sql }) =>
      sql.startsWith("INSERT INTO selection_journey_decisions"),
    );
    assert.equal(decision.values[4], null);
    assert.equal(decision.values[6], action);
    assert.deepEqual(h.counts(), { commits: 1, rollbacks: 0, releases: 1 });
  });
}

test("idempotent replay keeps a historical completed decision instead of re-adopting", async () => {
  const h = harness(null, { replay: true });
  await h.repository.decide(context);
  assert.equal(h.statements.length, 1);
  assert.deepEqual(h.counts(), { commits: 1, rollbacks: 0, releases: 1 });
});

test("candidate read model uses the same scoped opportunity policy and fails closed for missing opportunities", async () => {
  const statements = [];
  const captured = "2026-09-09T08:00:00.000Z";
  const db = {
    query: async (sql, values) => {
      statements.push({ sql, values });
      if (sql.includes("SELECT j.*,p.owner_label"))
        return [
          [
            {
              id: context.journeyId,
              task_status: "succeeded",
              created_at: captured,
              finished_at: captured,
              deadline_at: captured,
              available_result_count: 2,
            },
          ],
        ];
      if (sql.includes("SELECT e.id raw_evidence_id"))
        return [
          [
            {
              ...complete,
              opportunity_id: complete.id,
              topic_id: "topic-A",
              raw_evidence_id: "evidence-A",
              canonical_url: "https://example.test/a",
              captured_at: captured,
            },
            {
              opportunity_id: null,
              topic_id: "topic-B",
              raw_evidence_id: "evidence-B",
              canonical_url: "https://example.test/b",
              captured_at: captured,
            },
          ],
        ];
      return [[]];
    },
  };
  const repository = new MySqlSelectionJourneyRepository(db);
  const result = await repository.read(
    db,
    context.journeyId,
    context.organizationId,
    context.workspaceId,
    context.now,
  );
  assert.equal(result.results[0].opportunity_id, complete.id);
  assert.equal(result.results[0].selection_stage, "recommended");
  assert.equal(result.results[0].quality_gates.all_passed, true);
  assert.deepEqual(result.first_result, result.results[0]);
  assert.equal(result.results[1].opportunity_id, null);
  assert.equal(result.results[1].selection_stage, "not_eligible");
  assert.deepEqual(result.results[1].quality_gates, {
    score: false,
    market: false,
    competition: false,
    cost: false,
    risk: false,
    all_passed: false,
  });
  const lookup = statements.find(({ sql }) => sql.includes("SELECT e.id raw_evidence_id"));
  assert.match(
    lookup.sql,
    /LEFT JOIN opportunities o ON o.organization_id=j.organization_id AND o.workspace_id=j.workspace_id/,
  );
  assert.match(lookup.sql, /o.source_type='trend_topic' AND o.source_ref_id=s.topic_id/);
  assert.match(lookup.sql, /rule_candidate_ready/);
  assert.match(lookup.sql, /risk_gate_passed/);
  assert.deepEqual(lookup.values, [context.journeyId, context.organizationId, context.workspaceId]);
});
