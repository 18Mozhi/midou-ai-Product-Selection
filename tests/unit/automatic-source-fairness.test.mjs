import test from "node:test";
import assert from "node:assert/strict";
import { MySqlAutomaticSourceScheduler } from "../../apps/worker/dist/automatic-source-scheduler.js";
import { MySqlCollectionTaskWorkerRepository } from "../../apps/worker/dist/collection-task-state-machine.js";

const now = new Date("2026-10-18T00:00:00Z");
function connectionFor(statements) {
  return {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    async query(sql) {
      statements.push(sql);
      return sql.startsWith("SELECT COUNT(*)") ? [[{ count: 0 }], []] : [[], []];
    },
  };
}

test("full-source tenant budget reserves intake capacity using durable system events", async () => {
  const statements = [];
  const connection = connectionFor(statements);
  await new MySqlAutomaticSourceScheduler(
    { getConnection: async () => connection },
    16,
    () => now,
    { systemActorId: "system-actor", tenantActiveTaskBudget: 2, queueBacklogLimit: 1000 },
  ).processFullOnce();
  const selection = statements.find((sql) => sql.includes("SELECT s.*"));
  assert.match(selection, /ct\.organization_id=s\.organization_id/);
  assert.match(selection, /source_event\.task_id=ct\.id/);
  assert.match(selection, /source_event\.event_type='hotspot\.automatic\.scheduled'/);
  assert.match(selection, /source_event\.actor_type='system'/);
  assert.doesNotMatch(selection, /request_id LIKE/);
  assert.ok(
    statements.some((sql) => sql.startsWith("SELECT COUNT(*) count FROM collection_tasks")),
  );
});

for (const method of ["queueReady", "claim"]) {
  test(`${method} gives intake precedence inside its priority tier without trusting a request header`, async () => {
    const statements = [];
    const connection = connectionFor(statements);
    const repository = new MySqlCollectionTaskWorkerRepository({
      getConnection: async () => connection,
    });
    if (method === "claim") await repository.claim("worker", now, 120);
    else await repository.queueReady(now);
    const selection = statements.find((sql) => sql.startsWith("SELECT * FROM collection_tasks"));
    assert.match(
      selection,
      /ORDER BY FIELD\(CASE WHEN .* AND priority='normal' THEN 'high' ELSE priority END,'critical','high','normal','low'\),CASE WHEN EXISTS/,
    );
    assert.match(selection, /source_event\.task_id=collection_tasks\.id/);
    assert.match(selection, /source_event\.actor_type='system'/);
    assert.match(selection, /THEN 0 ELSE 1 END,available_at,id LIMIT 1 FOR UPDATE$/);
    assert.doesNotMatch(selection, /request_id LIKE/);
  });
}
