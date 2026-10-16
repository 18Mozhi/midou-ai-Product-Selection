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
    assert.equal(captured.parameters.length, captured.sql.split("?").length - 1);
    assert.match(
      captured.sql,
      /t\.organization_id=r\.organization_id AND t\.workspace_id=r\.workspace_id/,
    );
    for (let i = 0; i < captured.parameters.length; i += 2)
      assert.deepEqual(captured.parameters.slice(i, i + 2), ["organization-a", "workspace-a"]);
  });
}
