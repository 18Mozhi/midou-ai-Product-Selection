import test from "node:test";
import assert from "node:assert/strict";
import { CoreCollectionProjectionWorker } from "../../apps/worker/dist/core-collection-projection-worker.js";

const resourceId = "00000000-0000-4000-8000-000000000001";
const candidate = {
  id: "task",
  organization_id: "org",
  workspace_id: "workspace",
  classification_subquery_id: "query",
  request_id: "stale-request",
  trace_id: "stale-trace",
  created_by: "stale-actor",
  target_json: { projection_type: "sourcing_search", search_id: resourceId },
};
function harness({
  empty = false,
  taskGone = false,
  queryGone = false,
  alreadyClaimed = false,
  failInsert = false,
} = {}) {
  const calls = [];
  let commits = 0,
    rollbacks = 0,
    releases = 0;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {
      commits += 1;
    },
    rollback: async () => {
      rollbacks += 1;
    },
    release() {
      releases += 1;
    },
    query: async (sql, args = []) => {
      calls.push({ sql, args });
      if (sql.includes("FROM collection_tasks t")) return [empty ? [] : [candidate]];
      if (sql.startsWith("SELECT id,organization_id"))
        return [
          taskGone
            ? []
            : [
                {
                  ...candidate,
                  request_id: "current-request",
                  trace_id: "current-trace",
                  created_by: "current-actor",
                },
              ],
        ];
      if (sql.startsWith("SELECT target_json"))
        return [
          queryGone
            ? []
            : [
                {
                  classification_subquery_id: "query",
                  target_json: {
                    projection_type: "competitor_snapshot",
                    competitor_id: resourceId,
                  },
                },
              ],
        ];
      if (sql.startsWith("SELECT id FROM core_collection_projection_runs"))
        return [alreadyClaimed ? [{ id: "other-run" }] : []];
      if (sql.startsWith("INSERT INTO core_collection_projection_runs")) {
        if (failInsert) throw new Error("insert-failed");
        return [{ affectedRows: 1 }];
      }
      throw new Error("unexpected-query");
    },
  };
  return {
    worker: new CoreCollectionProjectionWorker({ getConnection: async () => connection }, "worker"),
    calls,
    counters: () => ({ commits, rollbacks, releases }),
  };
}

test("empty core projection backlog never takes a sorting or row lock", async () => {
  const h = harness({ empty: true });
  assert.equal(await h.worker.claim(), null);
  assert.equal(h.calls.length, 1);
  assert.doesNotMatch(h.calls[0].sql, /FOR UPDATE/);
  assert.deepEqual(h.counters(), { commits: 1, rollbacks: 0, releases: 1 });
});
for (const option of ["taskGone", "queryGone", "alreadyClaimed"]) {
  test(`core claim rechecks concurrent ${option} and never writes a projection`, async () => {
    const h = harness({ [option]: true });
    assert.equal(await h.worker.claim(), null);
    assert.equal(
      h.calls.some(({ sql }) => sql.startsWith("INSERT")),
      false,
    );
    assert.deepEqual(h.counters(), { commits: 1, rollbacks: 0, releases: 1 });
  });
}
test("core claim locks task then scoped query then unique run and uses current fields", async () => {
  const h = harness();
  const job = await h.worker.claim();
  assert.equal(job.requestId, "current-request");
  assert.equal(job.traceId, "current-trace");
  assert.equal(job.actorId, "current-actor");
  assert.equal(job.projectionType, "competitor_snapshot");
  assert.equal(job.resourceId, resourceId);
  assert.match(h.calls[0].sql, /ORDER BY t.finished_at,t.id LIMIT 1$/);
  assert.doesNotMatch(h.calls[0].sql, /FOR UPDATE/);
  assert.match(
    h.calls[1].sql,
    /WHERE id=\? AND organization_id=\? AND workspace_id=\?.*status IN.* FOR UPDATE$/,
  );
  assert.deepEqual(h.calls[1].args, ["task", "org", "workspace"]);
  assert.match(
    h.calls[2].sql,
    /WHERE id=\? AND task_id=\? AND organization_id=\? AND workspace_id=\?.*FOR UPDATE$/,
  );
  assert.deepEqual(h.calls[2].args, ["query", "task", "org", "workspace"]);
  assert.match(h.calls[3].sql, /WHERE collection_task_id=\? FOR UPDATE$/);
  assert.deepEqual(h.calls[3].args, ["task"]);
  assert.equal(h.calls.filter(({ sql }) => sql.startsWith("INSERT")).length, 1);
  assert.equal(h.calls[4].args[4], "competitor_snapshot");
  assert.deepEqual(h.counters(), { commits: 1, rollbacks: 0, releases: 1 });
});
test("core claim rolls back failed inserts and releases its connection", async () => {
  const h = harness({ failInsert: true });
  await assert.rejects(h.worker.claim(), /insert-failed/);
  assert.deepEqual(h.counters(), { commits: 0, rollbacks: 1, releases: 1 });
});
