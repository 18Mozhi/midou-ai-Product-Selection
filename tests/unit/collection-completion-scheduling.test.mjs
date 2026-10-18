import test from "node:test";
import assert from "node:assert/strict";
import { MySqlCollectionTaskWorkerRepository } from "../../apps/worker/dist/collection-task-state-machine.js";
import {
  activeCollectionScopeSql,
  automaticCompletionTaskSql,
  collectionRequiredSourcesReadySql,
} from "../../apps/worker/dist/collection-source-scheduling-policy.js";

test("projected competitor detail tasks use their actual Worker producer in the completion lane", () => {
  assert.ok(
    automaticCompletionTaskSql.includes(
      "event_type IN ('competitor.collection.auto_scheduled','competitor.detail.auto_scheduled')",
    ),
  );
  assert.match(automaticCompletionTaskSql, /completion_provider.code='amazon_product'/);
  assert.match(automaticCompletionTaskSql, /projection_type'\)\)='competitor_snapshot'/);
  for (const field of ["task_id", "organization_id", "workspace_id"])
    assert.ok(
      automaticCompletionTaskSql.includes(
        `completion_event.${field}=collection_tasks.${field === "task_id" ? "id" : field}`,
      ),
    );
});

const now = new Date("2026-10-18T00:00:00Z");
const row = {
  id: "task",
  organization_id: "org",
  workspace_id: "workspace",
  status: "scheduled",
  attempt_count: 0,
  request_id: "request",
  trace_id: "trace",
};
function setup(options = {}) {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push(["begin"]),
    commit: async () => {
      if (options.failCommit) throw new Error("commit failed");
      calls.push(["commit"]);
    },
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
    query: async (sql, args = []) => {
      calls.push([sql, args]);
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("SELECT slot_key"))
        return [options.activeLease ? [{ slot_key: "single-host" }] : []];
      if (sql.startsWith("SELECT * FROM collection_tasks"))
        return [
          options.noCandidate ||
          (sql.includes(activeCollectionScopeSql("collection_tasks")) && options.scopeInactive) ||
          (sql.includes(collectionRequiredSourcesReadySql) &&
            (options.sourceOpen || options.sourceDisabled)) ||
          (sql.endsWith("FOR UPDATE") &&
            (options.lost ||
              options.sourceOpenedAfterSelection ||
              options.sourceDisabledAfterSelection ||
              options.scopeArchivedAfterSelection))
            ? []
            : [row],
        ];
      if (sql.startsWith("SELECT id,provider_id"))
        return [
          [
            {
              id: "query",
              provider_id: "provider",
              ordinal: 1,
              is_required: 1,
              target_json: { query: "product" },
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  return {
    repository: new MySqlCollectionTaskWorkerRepository(
      { getConnection: async () => connection },
      () => 0,
      options.taskId,
    ),
    calls,
  };
}

for (const method of ["queueReady", "claim"]) {
  const invoke = (repo) =>
    method === "queueReady" ? repo.queueReady(now) : repo.claim("worker", now, 120);
  test(`${method} sorts without locking and locks only the selected scoped identity`, async () => {
    const { repository, calls } = setup();
    assert.equal((await invoke(repository)).id, "task");
    const selections = calls.filter(([sql]) => sql.startsWith("SELECT * FROM collection_tasks"));
    assert.equal(selections.length, 2);
    for (const [sql] of selections)
      assert.ok(sql.includes(activeCollectionScopeSql("collection_tasks")));
    assert.match(selections[0][0], /ORDER BY/);
    assert.doesNotMatch(selections[0][0], /FOR UPDATE/);
    assert.match(selections[1][0], /WHERE id=\? AND organization_id=\? AND workspace_id=\?/);
    assert.doesNotMatch(selections[1][0], /ORDER BY/);
    assert.deepEqual(selections[1][1].slice(0, 3), ["task", "org", "workspace"]);
    if (method === "queueReady") {
      assert.match(selections[1][0], /status IN .*available_at<=\?.* FOR UPDATE$/);
      assert.equal(selections[1][1][3], now);
    } else {
      for (const [sql] of selections) assert.ok(sql.includes(collectionRequiredSourcesReadySql));
      assert.match(selections[1][0], /status='queued' AND attempt_count<4/);
      assert.match(selections[1][0], / FOR UPDATE$/);
    }
  });
  for (const options of [
    { lost: true },
    { noCandidate: true },
    { scopeInactive: true },
    { scopeArchivedAfterSelection: true },
  ]) {
    test(`${method} does not overwrite a missing or changed candidate: ${JSON.stringify(options)}`, async () => {
      const { repository, calls } = setup(options);
      assert.equal(await invoke(repository), null);
      assert.ok(
        !calls.some(
          ([sql]) => sql.startsWith("UPDATE collection_tasks") || sql.startsWith("INSERT"),
        ),
      );
      assert.equal(repository.successfulClaims, 0);
    });
  }
}

test("twenty committed claims are followed by one shared FIFO turn then completion preference resumes", async () => {
  const { repository, calls } = setup();
  for (let turn = 0; turn < 22; turn += 1) {
    const start = calls.length;
    await repository.queueReady(now);
    await repository.claim("worker", now, 120);
    const selections = calls
      .slice(start)
      .filter(
        ([sql]) => sql.includes("ORDER BY") && sql.startsWith("SELECT * FROM collection_tasks"),
      );
    assert.equal(selections.length, 2);
    for (const [sql] of selections)
      assert.ok(sql.includes(activeCollectionScopeSql("collection_tasks")));
    assert.equal(
      selections[0][0].slice(selections[0][0].indexOf(" ORDER BY")),
      selections[1][0].slice(selections[1][0].indexOf(" ORDER BY")),
    );
    for (const [sql] of selections) {
      assert.equal(sql.includes("completion_event"), turn !== 20);
      assert.match(sql, /'critical','high','normal','low'/);
      assert.match(sql, /hotspot\.automatic\.scheduled/);
      assert.doesNotMatch(sql, /request_id LIKE/);
    }
  }
  assert.equal(repository.successfulClaims, 22);
});

test("an active single-host lease or rolled-back claim never advances the fairness turn", async () => {
  const active = setup({ activeLease: true });
  assert.equal(await active.repository.claim("worker", now, 120), null);
  assert.ok(!active.calls.some(([sql]) => sql.startsWith("SELECT * FROM collection_tasks")));
  assert.equal(active.repository.successfulClaims, 0);
  const failed = setup({ failCommit: true });
  await assert.rejects(() => failed.repository.claim("worker", now, 120), /commit failed/);
  assert.equal(failed.repository.successfulClaims, 0);
  assert.ok(failed.calls.some(([sql]) => sql === "rollback"));
});

test("targeted verification keeps its explicit task restriction before scoped locking", async () => {
  const { repository, calls } = setup({ taskId: "task" });
  await repository.queueReady(now);
  await repository.claim("worker", now, 120);
  const candidates = calls.filter(
    ([sql]) => sql.startsWith("SELECT * FROM collection_tasks") && sql.includes("ORDER BY"),
  );
  assert.deepEqual(candidates[0][1], [now, "task"]);
  assert.deepEqual(candidates[1][1], ["task"]);
});

for (const options of [
  { sourceOpen: true },
  { sourceOpenedAfterSelection: true },
  { sourceDisabled: true },
  { sourceDisabledAfterSelection: true },
]) {
  test(`required-source hold creates no attempt, lease, event or fairness advance: ${JSON.stringify(options)}`, async () => {
    const { repository, calls } = setup(options);
    assert.equal(await repository.claim("worker", now, 120), null);
    assert.equal(repository.successfulClaims, 0);
    assert.ok(!calls.some(([sql]) => /^(INSERT|UPDATE)/.test(sql)));
    assert.ok(calls.some(([sql]) => sql === "commit"));
    assert.ok(calls.some(([sql]) => sql === "release"));
  });
}

test("source hold is scoped to required queries and retains only the existing typed LAN acceptance exception", () => {
  assert.match(collectionRequiredSourcesReadySql, /LEFT JOIN provider_runtime_circuits/);
  assert.match(collectionRequiredSourcesReadySql, /required_source_provider\.status<>'enabled'/);
  for (const [left, right] of [
    ["task_id", "id"],
    ["organization_id", "organization_id"],
    ["workspace_id", "workspace_id"],
  ])
    assert.ok(
      collectionRequiredSourcesReadySql.includes(
        `required_source_query.${left}=collection_tasks.${right}`,
      ),
    );
  for (const fragment of [
    "required_source_query.is_required=1",
    "required_source_circuit.state='open'",
    "required_source_provider.code='1688_search'",
    "COALESCE(JSON_TYPE(",
    "='BOOLEAN'",
    "COALESCE(JSON_UNQUOTE(",
    "='true'",
  ])
    assert.ok(collectionRequiredSourcesReadySql.includes(fragment));
  assert.doesNotMatch(collectionRequiredSourcesReadySql, /request_id|UPDATE|DELETE|INSERT/);
});
