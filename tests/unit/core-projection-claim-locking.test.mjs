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
  native = false,
  foreignOwner = false,
  scopeColumns = ["organization_id", "workspace_id"],
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
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [native
        ? [{Field:"account_id"}] : [{Field:"organization_id"},{Field:"workspace_id"}]];
      calls.push({ sql, args });
      if (sql.includes("FROM collection_tasks t")) return [empty ? [] : [{...candidate, account_id:"owner"}]];
      if (sql.startsWith("SELECT cut.primary_account_id"))
        return [[{primary_account_id:"owner", account_id:foreignOwner ? "foreign" : "owner", reason:"exclusive_owner"}]];
      if (sql.startsWith("SELECT account_id FROM account_owned_records")) return [[{account_id:"owner"}]];
      if (sql.startsWith("SELECT id,organization_id") || sql.startsWith("SELECT id,account_id"))
        return [
          taskGone
            ? []
            : [
                {
                  ...candidate,
                  account_id:"owner",
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
      if (sql.startsWith("SHOW COLUMNS FROM core_collection_projection_runs"))
        return [scopeColumns.map((Field) => ({ Field }))];
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
    /WHERE id=\? AND task_id=\?.*FOR UPDATE$/,
  );
  assert.deepEqual(h.calls[2].args, ["query", "task"]);
  assert.match(h.calls[3].sql, /WHERE collection_task_id=\? FOR UPDATE$/);
  assert.deepEqual(h.calls[3].args, ["task"]);
  assert.equal(h.calls.filter(({ sql }) => sql.startsWith("INSERT")).length, 1);
  const insert = h.calls.find(({ sql }) => sql.startsWith("INSERT"));
  assert.match(insert.sql, /id,organization_id,workspace_id,collection_task_id/);
  assert.equal(insert.args[4], "competitor_snapshot");
  assert.deepEqual(h.counters(), { commits: 1, rollbacks: 0, releases: 1 });
});
test("normalized run stores the same task and resource without any old scope fields", async () => {
  const h = harness({ scopeColumns: [] });
  const job = await h.worker.claim();
  const insert = h.calls.find(({ sql }) => sql.startsWith("INSERT"));
  assert.doesNotMatch(insert.sql, /organization_id|workspace_id/);
  assert.deepEqual(insert.args.slice(0, 4), [job.runId, job.taskId, "competitor_snapshot", resourceId]);
  assert.deepEqual(h.counters(), { commits: 1, rollbacks: 0, releases: 1 });
});
test("0192 claim locks native ownership and creates only an inherited projection run", async () => {
  const h = harness({ native:true, scopeColumns:[] });
  const job = await h.worker.claim();
  assert.equal(job.accountId, "owner");
  assert.doesNotMatch(h.calls[0].sql, /\b(?:t|backlog)\.(?:organization_id|workspace_id)\b/);
  assert.match(h.calls[0].sql, /ot.account_id=t.account_id/);
  assert.match(h.calls[0].sql, /task_owner.account_id=backlog.account_id/);
  assert.match(h.calls[1].sql, /WHERE id=\? AND account_id=\?.*FOR UPDATE/);
  assert.deepEqual(h.calls[1].args, ["task","owner"]);
  const insert = h.calls.find(({sql}) => sql.startsWith("INSERT"));
  assert.doesNotMatch(insert.sql, /organization_id|workspace_id/);
  const foreign = harness({native:true, foreignOwner:true, scopeColumns:[]});
  assert.equal(await foreign.worker.claim(), null);
  assert.ok(!foreign.calls.some(({sql}) => sql.startsWith("INSERT")));
});
test("partial projection-run migration never writes", async () => {
  const h = harness({ scopeColumns: ["organization_id"] });
  await assert.rejects(h.worker.claim(), /partial_inherited_scope_schema/);
  assert.equal(h.calls.some(({ sql }) => sql.startsWith("INSERT")), false);
  assert.deepEqual(h.counters(), { commits: 0, rollbacks: 1, releases: 1 });
});
test("core claim rolls back failed inserts and releases its connection", async () => {
  const h = harness({ failInsert: true });
  await assert.rejects(h.worker.claim(), /insert-failed/);
  assert.deepEqual(h.counters(), { commits: 0, rollbacks: 1, releases: 1 });
});
