import assert from "node:assert/strict";
import test from "node:test";
import { MySqlCompetitorMonitorWorker } from "../../apps/worker/dist/competitor-monitor-worker.js";
const now = new Date("2026-10-17T02:00:00Z");
const job = {
  id: "job",
  organizationId: "org",
  workspaceId: "workspace",
  competitorId: "product",
  snapshotId: "b",
  requestId: "request",
  traceId: "trace",
  attemptCount: 1,
};
function fixture({
  latest = "a",
  currentAt = "2026-10-17T01:00:00Z",
  previousAt = "2026-10-17T00:00:00Z",
  failQueue = false,
} = {}) {
  const calls = [];
  const c = {
    beginTransaction: async () => calls.push(["begin"]),
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
    query: async (sql, params) => {
      calls.push([sql, params]);
      if (sql.startsWith("SELECT c.latest_snapshot_id"))
        return [
          [
            {
              id: "b",
              latest_snapshot_id: latest,
              opportunity_id: "opportunity",
              captured_at: new Date(currentAt),
              current_price: 30,
              evidence_id: "new-evidence",
            },
          ],
        ];
      if (sql.startsWith("SELECT * FROM competitor_snapshots"))
        return [[{ id: latest, captured_at: new Date(previousAt), current_price: 25 }]];
      if (sql.startsWith("SELECT * FROM competitor_monitor_rules")) return [[]];
      if (failQueue && sql.startsWith("INSERT INTO automatic_selection_evaluations"))
        throw Error("queue unavailable");
      if (sql.startsWith("SELECT")) throw Error("unexpected read");
      return [{ affectedRows: 1 }];
    },
  };
  return {
    calls,
    worker: new MySqlCompetitorMonitorWorker(
      { getConnection: async () => c },
      "worker",
      120,
      () => now,
    ),
  };
}
for (const [label, options] of [
  ["delayed older snapshot", { currentAt: "2026-10-16T00:00:00Z" }],
  ["already current snapshot", { latest: "b" }],
  ["equal timestamp lower ID", { latest: "c", previousAt: "2026-10-17T01:00:00Z" }],
]) {
  test(`${label} completes without moving the pointer or producing changes`, async () => {
    const { worker, calls } = fixture(options);
    assert.deepEqual(await worker.compare(job), { change_count: 0 });
    assert.equal(
      calls.some(
        ([sql]) =>
          sql.startsWith("UPDATE competitors SET") ||
          sql.startsWith("INSERT INTO competitor_") ||
          sql.startsWith("INSERT INTO automatic_selection_evaluations"),
      ),
      false,
    );
    assert.ok(
      calls.some(([sql]) =>
        sql.startsWith("UPDATE competitor_snapshot_jobs SET status='succeeded'"),
      ),
    );
    assert.deepEqual(calls.slice(-2), [["commit"], ["release"]]);
  });
}
for (const previousAt of ["2026-10-17T00:00:00Z", "2026-10-17T01:00:00Z"]) {
  test(`newer snapshot by capture time or stable ID advances and requeues scoring: ${previousAt}`, async () => {
    const { worker, calls } = fixture({ previousAt });
    assert.deepEqual(await worker.compare(job), { change_count: 1 });
    assert.deepEqual(calls.find(([sql]) => sql.startsWith("UPDATE competitors SET"))[1], [
      "b",
      now,
      "product",
    ]);
    assert.ok(calls.some(([sql]) => sql.startsWith("INSERT INTO automatic_selection_evaluations")));
    const previous = calls.find(([sql]) => sql.startsWith("SELECT * FROM competitor_snapshots"));
    assert.deepEqual(previous[1], ["a", "product", "org", "workspace"]);
    assert.deepEqual(calls.slice(-2), [["commit"], ["release"]]);
  });
}
test("scoring requeue failure rolls back the pointer and change transaction", async () => {
  const { worker, calls } = fixture({ failQueue: true });
  await assert.rejects(worker.compare(job), /queue unavailable/);
  assert.equal(
    calls.some(([sql]) => sql === "commit"),
    false,
  );
  assert.deepEqual(calls.slice(-2), [["rollback"], ["release"]]);
});

test("first snapshot establishes the pointer and triggers evaluation without fabricated changes", async () => {
  const { worker, calls } = fixture({ latest: null });
  assert.deepEqual(await worker.compare(job), { change_count: 0 });
  assert.ok(calls.some(([sql]) => sql.startsWith("UPDATE competitors SET")));
  assert.ok(calls.some(([sql]) => sql.startsWith("INSERT INTO automatic_selection_evaluations")));
  assert.equal(
    calls.some(([sql]) => sql.startsWith("INSERT INTO competitor_changes")),
    false,
  );
  assert.deepEqual(calls.slice(-2), [["commit"], ["release"]]);
});
