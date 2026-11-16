import test from "node:test";
import assert from "node:assert/strict";
import { MySqlSourcingRepository } from "../../apps/api/dist/mysql-sourcing-repository.js";
import { SourcingService } from "../../apps/api/dist/sourcing-service.js";

const input = {
  accountOwnedSearch: true,
  actorId: "owner",
  id: "search",
  taskId: "unused",
  searchId: "search",
  route: "account-operation",
  idempotencyKey: "key",
  requestId: "req",
  traceId: "trace",
  reason: "test",
  value: { collection_task_id: "task", input_type: "opportunity", input_ref: "parent" },
};

function setup(options = {}) {
  const writes = [],
    queries = [];
  const c = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    async query(sql, args = []) {
      queries.push([sql, args]);
      if (sql.startsWith("SELECT slot")) return [[{ slot: "current" }]];
      if (sql.startsWith("SHOW COLUMNS FROM sourcing_searches"))
        return [
          (options.columns ?? ["organization_id", "workspace_id"]).map((Field) => ({ Field })),
        ];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
        return [
          (options.nativeTask ? ["account_id"] : ["organization_id", "workspace_id"]).map(
            (Field) => ({ Field }),
          ),
        ];
      if (sql.includes("FROM collection_tasks t"))
        if (!sql.startsWith("SELECT s.id,s.deleted_at"))
          return [
            options.foreign ||
            (options.nativeMismatch && sql.includes("t.account_id=own.account_id"))
              ? []
              : [{ organization_id: "old-org", workspace_id: "old-ws" }],
          ];
      if (sql.startsWith("SELECT o.id")) return [options.foreignParent ? [] : [{ id: "parent" }]];
      if (sql.startsWith("SELECT s.id,s.deleted_at"))
        return [
          options.historical ||
          (options.nativeMismatch && sql.includes("t.account_id=own.account_id"))
            ? []
            : [{ id: "search", deleted_at: options.deleted, reason: "shared" }],
        ];
      if (sql.startsWith("SELECT result_json"))
        return [options.replay ? [{ result_json: options.replay }] : []];
      if (sql.startsWith("SELECT s.id FROM sourcing_searches"))
        return [options.replayMismatch ? [] : [{ id: "search" }]];
      if (sql.startsWith("SHOW COLUMNS")) return [[]];
      assert.match(sql, /^\s*(INSERT|UPDATE)/);
      writes.push([sql, args]);
      return [{ affectedRows: 1 }];
    },
  };
  return { repo: new MySqlSourcingRepository({ getConnection: async () => c }), writes, queries };
}

test("existing owned supply task creates owned search and projection without starting acquisition", async () => {
  const { repo, writes, queries } = setup();
  const result = await repo.createSearch(input);
  assert.equal(result.task_id, "task");
  assert.equal(result.status, "queued");
  assert.ok(!writes.some(([sql]) => sql.includes("INSERT INTO collection_tasks")));
  const search = writes.find(([sql]) => sql.includes("INSERT INTO sourcing_searches"));
  assert.deepEqual(search[1].slice(0, 6), [
    "search",
    "old-org",
    "old-ws",
    "task",
    "opportunity",
    "parent",
  ]);
  const taskSql = queries.find(([sql]) => sql.includes("FROM collection_tasks t"))[0];
  assert.match(taskSql, /p.code='1688_search'/);
  assert.match(taskSql, /NOT EXISTS \(SELECT 1 FROM sourcing_searches history/);
  const ledger = writes.find(([sql]) => sql.includes("VALUES ?"));
  assert.deepEqual(ledger[1][0], [
    ["sourcing_searches", "search", "owner", "exclusive_owner"],
    ["sourcing_projection_jobs", result.job_id, "owner", "exclusive_owner"],
  ]);
});

test("account search creation works after dropping both scope columns and rejects partial removal", async () => {
  const f = setup({ columns: [], nativeTask: true });
  const result = await f.repo.createSearch(input);
  const task = f.queries.find(([sql]) => sql.includes("FROM collection_tasks t"));
  const search = f.writes.find(([sql]) => sql.startsWith("INSERT INTO sourcing_searches"));
  assert.doesNotMatch(task[0] + search[0], /organization_id|workspace_id/);
  assert.match(task[0], /t\.account_id=own\.account_id/);
  assert.deepEqual(search[1].slice(0, 4), ["search", "task", "opportunity", "parent"]);
  assert.equal(search[0].match(/\?/g).length, search[1].length);
  assert.equal(result.task_id, "task");
  const partial = setup({ columns: ["organization_id"] });
  await assert.rejects(
    partial.repo.createSearch(input),
    /partial_inherited_scope_schema:sourcing_searches/,
  );
  assert.equal(partial.writes.length, 0);
});

test("retired search mutations refuse drift between native collection owner and sealed owner", async () => {
  const f = setup({ columns: [], nativeTask: true, nativeMismatch: true });
  await assert.rejects(f.repo.createSearch(input), { code: "sourcing_collection_task_not_ready" });
  await assert.rejects(f.repo.remove(input), { code: "sourcing_search_not_found" });
  assert.equal(f.writes.length, 0);
});

test("cross-account task, foreign opportunity and mismatched replay never write", async () => {
  for (const [options, code] of [
    [{ foreign: true }, "sourcing_collection_task_not_ready"],
    [{ foreignParent: true }, "opportunity_not_found"],
    [{ replay: { id: "other" }, replayMismatch: true }, "sourcing_search_replay_mismatch"],
  ]) {
    const { repo, writes } = setup(options);
    await assert.rejects(repo.createSearch(input), { code });
    assert.equal(writes.length, 0);
  }
  const { repo, writes } = setup({ replay: { id: "search", task_id: "task" } });
  assert.equal((await repo.createSearch(input)).id, "search");
  assert.equal(writes.length, 0);
});

test("soft deletion preserves references, is idempotent, and refuses read-only historical search", async () => {
  const { repo, writes, queries } = setup();
  assert.deepEqual(await repo.remove(input), { id: "search", deleted: true });
  const lock = queries.find(([sql]) => sql.startsWith("SELECT s.id,s.deleted_at"));
  assert.match(lock[0], /input_ref REGEXP/);
  assert.doesNotMatch(lock[0], /organization_id|workspace_id/);
  assert.match(writes[0][0], /^UPDATE sourcing_searches SET deleted_at=/);
  assert.equal(
    writes.some(([sql]) => sql.startsWith("DELETE")),
    false,
  );
  const replay = setup({ deleted: new Date(), replay: { id: "search", deleted: true } });
  assert.equal((await replay.repo.remove(input)).deleted, true);
  assert.equal(replay.writes.length, 0);
  const historical = setup({ historical: true });
  await assert.rejects(historical.repo.remove(input), { code: "sourcing_search_not_found" });
  assert.equal(historical.writes.length, 0);
});

test("account create refuses starting collection through sourcing", () => {
  const service = new SourcingService({});
  assert.throws(
    () => service.createSearch({ ...input, value: { input_type: "keyword", input_ref: "item" } }),
    { code: "sourcing_collection_task_required" },
  );
});
