import assert from "node:assert/strict";
import test from "node:test";
import { MySqlCollectionTaskRepository } from "../../apps/api/dist/mysql-collection-task-repository.js";

const input = {
  taskId: "original",
  newTaskId: "child",
  actorId: "operator",
  idempotencyKey: "key",
  reason: "verified recovery",
  requestId: "request",
  traceId: "trace",
  now: new Date(0),
};
const row = {
  id: "original",
  organization_id: "old-org",
  workspace_id: "old-workspace",
  status: "dead_letter",
  priority: "normal",
};

function fixture({ reason = "shared", account = "primary", mode = "normal", native = false } = {}) {
  const calls = [],
    writes = [];
  const scoped = native
    ? { id: row.id, status: row.status, priority: row.priority, account_id: account }
    : row;
  const connection = {
    async beginTransaction() {
      calls.push("begin");
    },
    async commit() {
      calls.push("commit");
    },
    async rollback() {
      calls.push("rollback");
    },
    release() {
      calls.push("release");
    },
    async query(sql, args = []) {
      if (!sql.includes(" IN (?)") && !sql.endsWith("VALUES ?"))
        assert.equal((sql.match(/\?/g) ?? []).length, args.length, sql);
      if (sql.startsWith("SELECT result_task_id")) {
        assert.equal(args.at(-1), "original");
        if (mode === "concurrent-retry")
          return [sql.endsWith("FOR UPDATE") ? [{ result_task_id: "child" }] : []];
        return [mode.startsWith("receipt-") ? [{ result_task_id: "child" }] : []];
      }
      if (sql.includes("replay_of_task_id=? LOCK"))
        return [
          mode === "receipt-broken"
            ? []
            : [
                {
                  id: "child",
                  ...(native
                    ? { account_id: mode === "receipt-native-foreign" ? "foreign" : account,
                        replay_reason: mode === "receipt-reason-changed" ? "different reason" : input.reason }
                    : {}),
                },
              ],
        ];
      if (sql.startsWith("SELECT account_id FROM collection_tasks"))
        return [[{ account_id: account }]];
      if (sql.startsWith("SELECT * FROM collection_tasks")) {
        if (mode === "concurrent-retry" && args[0] === "child" && !sql.endsWith("LOCK IN SHARE MODE"))
          return [[]]; // Repeatable-read snapshot predates the first commit.
        return [
          [
            {
              ...scoped,
              id: args[0],
              scheduled_at: 0,
              available_at: 0,
              ...(mode === "native-source-foreign" ? { account_id: "foreign" } : {}),
              ...(mode === "concurrent-retry" && args[0] === "original" ? {status:"manually_replayed"} : {}),
            },
          ],
        ];
      }
      if (sql.startsWith("SELECT cut.contract_version")) {
        assert.equal(args[0], "collection_tasks");
        const id = args[1] === "child" && mode === "receipt-foreign" ? "foreign" : account;
        return mode === "legacy"
          ? [[]]
          : [
              [
                {
                  contract_version: 25,
                  primary_account_id: "primary",
                  account_id: mode === "missing-owner" ? null : id,
                  owner_user_id: id,
                  reason,
                },
              ],
            ];
      }
      if (sql.startsWith("SELECT * FROM collection_subqueries"))
        return [
          [{ id: "sub", provider_id: "provider", ordinal: 1, is_required: 1, target_json: "{}" }],
        ];
      if (sql.startsWith("SELECT source_id"))
        return [mode === "foreign-query" || mode === "receipt-query-foreign" ? [] : [{ source_id: "sub" }]];
      if (sql.startsWith("SELECT id FROM collection_subqueries"))
        return [mode === "receipt-query-missing" ? [] : [{id:"sub"}]];
      if (sql.startsWith("SELECT d.id")) {
        assert.match(sql, /a.id=d.attempt_id AND a.task_id=d.task_id/);
        return [mode === "missing-dead-letter" ? [] : [{ id: "dead" }]];
      }
      if (sql.startsWith("SELECT ")) return [[]];
      writes.push([sql, args]);
      if (sql.startsWith("UPDATE collection_dead_letters") && mode === "lost-dead-letter") {
        assert.match(sql, /task_id=\? AND status='open' AND id=\?$/);
        assert.deepEqual(args.slice(-2), ["original","dead"]);
        return [{ affectedRows:0 }];
      }
      if (sql.startsWith("INSERT INTO account_owned_records") && mode === "ledger-error")
        throw new Error("ledger-write-error");
      return [{ affectedRows: 1 }];
    },
  };
  const repo = new MySqlCollectionTaskRepository({
    async getConnection() {
      return connection;
    },
    async query(sql, [id]) {
      return [
        sql.startsWith("SELECT * FROM collection_tasks")
          ? [{ ...row, id, scheduled_at: 0, available_at: 0 }]
          : [],
      ];
    },
  });
  return { repo, calls, writes };
}

for (const [reason, account] of [
  ["shared", "primary"],
  ["unassigned", "primary"],
  ["exclusive_owner", "original-account"],
]) {
  test(`replay inherits ${reason} and records exact new IDs, not the platform operator`, async () => {
    const f = fixture({ reason, account });
    assert.equal((await f.repo.replay(input)).task.id, "child");
    const ids = f.writes
      .filter(([sql]) =>
        /^INSERT INTO collection_(tasks|subqueries|task_events|task_outbox)/.test(sql),
      )
      .map(([sql, args]) => [sql.match(/^INSERT INTO (\w+)/)[1], args[0], account, reason]);
    assert.equal(ids.length, 5);
    assert.deepEqual(
      f.writes.find(([sql]) => sql.startsWith("INSERT INTO account_owned_records"))[1][0],
      ids,
    );
    assert.deepEqual(f.calls, ["begin", "commit", "release"]);
  });
}

for (const mode of [
  "foreign-query",
  "missing-owner",
  "missing-dead-letter",
  "receipt-broken",
  "receipt-foreign",
  "ledger-error",
]) {
  test(`replay fails without a committed graph on ${mode}`, async () => {
    const f = fixture({ mode, reason: mode === "receipt-foreign" ? "exclusive_owner" : "shared" });
    await assert.rejects(
      f.repo.replay(input),
      mode === "ledger-error" ? /ledger-write-error/ : /collection_replay_conflict/,
    );
    assert.deepEqual(f.calls, ["begin", "rollback", "release"]);
    assert.ok(!f.writes.some(([sql]) => sql.startsWith("INSERT INTO collection_task_operations")));
    if (mode !== "ledger-error") assert.equal(f.writes.length, 0);
  });
}

test("valid idempotent replay verifies parent and owner without another write", async () => {
  const f = fixture({ mode: "receipt-valid" });
  assert.equal((await f.repo.replay(input)).task.id, "child");
  assert.deepEqual(f.writes, []);
});

test("pre-cutover replay preserves the legacy contract without an ownership write", async () => {
  const f = fixture({ mode: "legacy" });
  assert.equal((await f.repo.replay(input)).task.id, "child");
  assert.ok(!f.writes.some(([sql]) => sql.startsWith("INSERT INTO account_owned_records")));
});

test("account task replay writes only the original account and returns no legacy coordinates", async () => {
  const f = fixture({ native: true, account: "owner", reason: "exclusive_owner" });
  const result = await f.repo.replay(input);
  assert.equal(result.task.account_id, "owner");
  assert.equal(Object.hasOwn(result.task, "workspace_id"), false);
  assert.equal(Object.hasOwn(result.task, "organization_id"), false);
  const [sql, args] = f.writes[0];
  assert.match(sql, /^INSERT INTO collection_tasks \(id,account_id,/);
  assert.deepEqual(args.slice(0, 3), ["child", "owner", "normal"]);
  assert.equal(args[5], "original");
  for (const [write] of f.writes) assert.doesNotMatch(write, /organization_id|workspace_id/);
  assert.deepEqual(f.calls, ["begin", "commit", "release"]);
});

test("account task list returns account identity and rejects retired filters before querying tasks", async () => {
  const reads = [];
  const repo = new MySqlCollectionTaskRepository({
    async query(sql) {
      reads.push(sql);
      if (sql.startsWith("SHOW COLUMNS")) return [[{ Field: "account_id" }]];
      assert.match(sql, /own.account_id=t.account_id/);
      assert.match(sql, /own.account_id=cut.primary_account_id/);
      if (sql.startsWith("SELECT COUNT")) return [[{ total: 1 }]];
      return [[{ id: "original", account_id: "owner", scheduled_at: 0, available_at: 0 }]];
    },
  });
  await assert.rejects(repo.list({ organizationId: "legacy", page: 1, pageSize: 20 }), {
    code: "collection_scope_invalid",
    statusCode: 400,
  });
  assert.equal(reads.length, 1);
  const result = await repo.list({ page: 1, pageSize: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].account_id, "owner");
  assert.equal(Object.hasOwn(result.items[0], "organization_id"), false);
  assert.equal(Object.hasOwn(result.items[0], "workspace_id"), false);
});

test("native platform task detail verifies ownership before reading original child history", async () => {
  const task = { id: "original", account_id: "owner", scheduled_at: 0, available_at: 0 };
  let valid = false,
    childReads = 0;
  const repo = new MySqlCollectionTaskRepository({
    async query(sql, args) {
      if (sql.startsWith("SELECT * FROM collection_tasks")) return [[task]];
      if (sql.startsWith("SELECT cut.contract_version")) {
        assert.deepEqual(args, ["collection_tasks", "original"]);
        return [
          [
            {
              contract_version: 25,
              primary_account_id: "primary",
              reason: "exclusive_owner",
              account_id: valid ? "owner" : "other",
              owner_user_id: valid ? "owner" : "other",
            },
          ],
        ];
      }
      childReads++;
      if (sql.includes("FROM collection_subqueries")) {
        assert.match(
          sql,
          /child.source_table='collection_subqueries'.*child.source_id=q.id.*child.account_id=\?/,
        );
        assert.deepEqual(args, ["original", "owner"]);
      } else if (sql.includes("FROM collection_task_events")) {
        assert.match(
          sql,
          /child.source_table='collection_task_events'.*child.source_id=collection_task_events.id.*child.account_id=\?/,
        );
        assert.deepEqual(args, ["original", "owner"]);
      } else if (sql.includes("FROM collection_dead_letters")) {
        assert.match(sql, /a.id=d.attempt_id AND a.task_id=d.task_id/);
        assert.deepEqual(args, ["original"]);
      }
      return [[]];
    },
  });
  assert.equal(await repo.detail("original"), null);
  assert.equal(childReads, 0);
  valid = true;
  assert.equal((await repo.detail("original")).task.account_id, "owner");
  assert.equal(childReads, 4);
});

for (const mode of ["native-source-foreign", "receipt-native-foreign", "receipt-valid",
  "receipt-query-foreign", "receipt-query-missing", "receipt-reason-changed", "concurrent-retry"]) {
  test(`account task replay validates the stamped account: ${mode}`, async () => {
    const f = fixture({ native: true, mode });
    if (mode === "receipt-valid" || mode === "concurrent-retry")
      assert.equal((await f.repo.replay(input)).task.account_id, "primary");
    else await assert.rejects(f.repo.replay(input), /collection_replay_conflict/);
    assert.deepEqual(f.writes, []);
  });
}

test("lost exact dead letter rolls back replay before events and receipt", async () => {
  const f=fixture({native:true,mode:"lost-dead-letter"});
  await assert.rejects(f.repo.replay(input), {code:"collection_replay_conflict"});
  assert.deepEqual(f.calls, ["begin", "rollback", "release"]);
  assert.ok(f.writes.every(([sql]) => !/^INSERT INTO (collection_task_(?:operations|events|outbox)|account_owned_records)/.test(sql)));
});
