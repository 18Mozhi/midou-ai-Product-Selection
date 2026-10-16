import test from "node:test";
import assert from "node:assert/strict";
import { MySqlHomeDashboardRepository } from "../../apps/api/dist/mysql-home-dashboard-repository.js";

for (const [problems, expected] of [
  [0, "running"],
  [1, "attention"],
  [4, "attention"],
]) {
  test(`home reports ${expected} for ${problems} latest rule task problems`, async () => {
    let captured;
    const repository = new MySqlHomeDashboardRepository({
      query: async (sql, parameters) => {
        if (sql.includes("FROM automatic_source_schedules s")) return [[], []];
        captured = { sql, parameters };
        return [
          [
            {
              enabled_rule_count: 2,
              next_collection_at: "2026-10-16T12:00:00Z",
              last_task_problem_count: problems,
            },
          ],
        ];
      },
    });
    const result = await repository.automaticSelection({
      organizationId: "organization-a",
      workspaceId: "workspace-a",
    });
    assert.equal(result.state, expected);
    assert.equal(
      captured.parameters.length,
      captured.sql.replace(/'(?:''|[^'])*'/gu, "''").split("?").length - 1,
    );
    assert.match(
      captured.sql,
      /t\.organization_id=r\.organization_id AND t\.workspace_id=r\.workspace_id/,
    );
    for (let i = 0; i < captured.parameters.length; i += 2)
      assert.deepEqual(captured.parameters.slice(i, i + 2), ["organization-a", "workspace-a"]);
  });
}

for (const [source_available, task_status, expected] of [
  [1, "succeeded", "running"],
  [1, "blocked", "attention"],
  [0, "succeeded", "attention"],
]) {
  test(`full intelligence collection without keyword rules reports ${expected} for source ${source_available} task ${task_status}`, async () => {
    const repository = new MySqlHomeDashboardRepository({
      query: async (sql, parameters) => {
        if (sql.includes("FROM automatic_source_schedules s")) {
          assert.deepEqual(parameters, ["org", "workspace"]);
          return [
            [
              {
                source_available,
                task_status,
                last_task_id: "task",
                last_scheduled_at: "2026-10-17T00:00:00Z",
                next_scheduled_at: "2026-10-17T00:10:00Z",
              },
            ],
          ];
        }
        assert.doesNotMatch(sql, /JOIN opportunity_rule_matches/);
        return [
          [
            {
              enabled_rule_count: 0,
              candidate_count: 7,
              rule_candidate_count: 5,
              recommended_count: 2,
            },
          ],
        ];
      },
    });
    const result = await repository.automaticSelection({
      organizationId: "org",
      workspaceId: "workspace",
    });
    assert.equal(result.state, expected);
    assert.equal(result.rule_candidate_count, 5);
    assert.equal(result.recommended_count, 2);
    assert.equal(result.next_collection_at, "2026-10-17T00:10:00.000Z");
  });
}
