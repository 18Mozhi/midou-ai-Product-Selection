import assert from "node:assert/strict";
import test from "node:test";
import { MySqlAuthorizationRepository } from "../../apps/api/dist/mysql-authorization-repository.js";

const base = {
  id: "event", actor_id: "actor", capability: "audit:read", surface: "api",
  outcome: "denied", reason: "test", request_id: "request", trace_id: "trace",
  occurred_at: new Date("2026-10-15T00:00:00Z"), schema_version: 1,
};
const scope = { organization_id: "organization", workspace_id: null, team_id: "team" };
const old = Object.keys(scope);
function repository(fields) {
  const writes = [];
  const repo = new MySqlAuthorizationRepository({
    async query(sql, params) {
      if (sql.includes("information_schema.COLUMNS")) return [fields.map(COLUMN_NAME => ({ COLUMN_NAME }))];
      writes.push({ sql, params });
    },
  });
  return { repo, writes };
}

test("authorization audit preserves original context without using it as a scope column", async () => {
  const { repo, writes } = repository(["historical_context"]);
  await repo.appendDecision({ ...base, ...scope });
  assert.match(writes[0].sql, /actor_id,historical_context,capability/);
  assert.doesNotMatch(writes[0].sql, /organization_id|workspace_id|team_id/);
  assert.deepEqual(JSON.parse(writes[0].params[2]), scope);
  await repo.appendDecision({ ...base, organization_id: null, workspace_id: null, team_id: null });
  assert.equal(writes[1].params[2], null);
});

test("authorization audit writes the legacy row after rollback and refuses partial schema", async () => {
  const restored = repository(old);
  await restored.repo.appendDecision({ ...base, ...scope });
  assert.deepEqual(restored.writes[0].params.slice(2, 5), Object.values(scope));
  for (const fields of [[], ["historical_context", ...old], ["organization_id"]]) {
    const partial = repository(fields);
    await assert.rejects(partial.repo.appendDecision({ ...base, ...scope }), /authorization_decision_schema_incomplete/);
    assert.equal(partial.writes.length, 0);
  }
});
