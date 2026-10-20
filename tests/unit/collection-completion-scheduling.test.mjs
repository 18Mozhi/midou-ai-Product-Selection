import test from "node:test";
import assert from "node:assert/strict";
import { completionReadySourcingTaskSql } from "../../apps/worker/dist/completion-sourcing-policy.js";
import { MySqlCollectionTaskWorkerRepository } from "../../apps/worker/dist/collection-task-state-machine.js";
import {
  activeCollectionScopeSql,
  automaticCompletionTaskSql,
  automaticProductSearchTaskSql,
  collectionScopeFairnessJoinSql,
  collectionReadyOrderSql,
  collectionRequiredSourcesReadySql,
  pendingBrowserResultSql,
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

const isTaskRead = (sql) => /^SELECT (?:collection_tasks\.)?\* FROM collection_tasks/.test(sql);

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
      assert.equal((sql.replace(/'(?:''|\\.|[^'])*'/g, "").match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("SELECT slot_key"))
        return [options.activeLease ? [{ slot_key: "single-host" }] : []];
      if (isTaskRead(sql))
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
    const selections = calls.filter(([sql]) => isTaskRead(sql));
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

test("twenty alternating committed stage claims retain the shared FIFO escape and resume rotation", async () => {
  const { repository, calls } = setup();
  for (let turn = 0; turn < 22; turn += 1) {
    const start = calls.length;
    await repository.queueReady(now);
    await repository.claim("worker", now, 120);
    const selections = calls
      .slice(start)
      .filter(([sql]) => sql.includes("ORDER BY") && isTaskRead(sql));
    assert.equal(selections.length, 2);
    for (const [sql] of selections)
      assert.ok(sql.includes(activeCollectionScopeSql("collection_tasks")));
    assert.equal(
      selections[0][0].slice(selections[0][0].indexOf(" ORDER BY")),
      selections[1][0].slice(selections[1][0].indexOf(" ORDER BY")),
    );
    for (const [sql] of selections) {
      assert.equal(sql.includes("completion_event"), turn !== 20);
      assert.equal(sql.includes("product_search_event"), turn !== 20);
      assert.equal(sql.includes(completionReadySourcingTaskSql), turn !== 20 && turn % 4 === 0);
      if (turn !== 20) {
        assert.ok(
          sql.includes("WHEN " + automaticCompletionTaskSql + " THEN " + (turn % 2 ? 2 : 1)),
        );
        assert.ok(
          sql.includes("WHEN " + automaticProductSearchTaskSql + " THEN " + (turn % 2 ? 1 : 2)),
        );
      }
      assert.match(sql, /'critical','high','normal','low'/);
      assert.match(sql, /hotspot\.automatic\.scheduled/);
      assert.doesNotMatch(sql, /request_id LIKE/);
    }
  }
  assert.equal(repository.successfulClaims, 22);
});

test("product search priority requires the scoped real Worker producer and its Amazon discovery target", () => {
  for (const field of ["organization_id", "workspace_id"])
    assert.ok(
      automaticProductSearchTaskSql.includes(
        `product_search_event.${field}=collection_tasks.${field}`,
      ),
    );
  assert.match(automaticProductSearchTaskSql, /product_search_event.actor_type='worker'/);
  assert.match(automaticProductSearchTaskSql, /intelligence\.product_search\.auto_scheduled/);
  assert.match(automaticProductSearchTaskSql, /product_search_provider.code='amazon_product'/);
  assert.match(
    automaticProductSearchTaskSql,
    /projection_type'\)\)='intelligence_product_discovery'/,
  );
  assert.doesNotMatch(automaticProductSearchTaskSql, /request_id|UPDATE|INSERT|DELETE/);
});

test("an active single-host lease or rolled-back claim never advances the fairness turn", async () => {
  const active = setup({ activeLease: true });
  assert.equal(await active.repository.claim("worker", now, 120), null);
  assert.ok(!active.calls.some(([sql]) => isTaskRead(sql)));
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
  const candidates = calls.filter(([sql]) => isTaskRead(sql) && sql.includes("ORDER BY"));
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

test("scope fairness is after effective priority and before the existing local lanes", () => {
  for (const completionFirst of [true, false]) {
    const order = collectionReadyOrderSql(completionFirst);
    assert.ok(
      order.indexOf("'critical','high','normal','low'") <
        order.indexOf("collection_scope_turn.last_claim_at"),
    );
    assert.ok(order.indexOf("collection_scope_turn.last_claim_at") < order.indexOf(" THEN 0 "));
    assert.match(order, /available_at,id LIMIT 1$/);
  }
  assert.match(collectionScopeFairnessJoinSql, /MAX\(occurred_at\) last_claim_at/);
  assert.match(
    collectionScopeFairnessJoinSql,
    /event_type='collection.task.leased' AND actor_type='worker'/,
  );
  assert.match(collectionScopeFairnessJoinSql, /GROUP BY organization_id,workspace_id/);
  for (const field of ["organization_id", "workspace_id"])
    assert.ok(
      collectionScopeFairnessJoinSql.includes(
        `collection_scope_turn.${field}=collection_tasks.${field}`,
      ),
    );
  assert.doesNotMatch(
    collectionScopeFairnessJoinSql,
    /FOR UPDATE|UPDATE |INSERT |DELETE |LIMIT|occurred_at FROM/,
  );
});

test("durable result consumption preserves scoped provenance and the FIFO escape turn", () => {
  const preferred = collectionReadyOrderSql(true),
    fifo = collectionReadyOrderSql(false);
  assert.ok(
    preferred.indexOf(pendingBrowserResultSql) > preferred.indexOf(automaticCompletionTaskSql),
  );
  assert.ok(preferred.indexOf(pendingBrowserResultSql) < preferred.indexOf("available_at,id"));
  assert.ok(!fifo.includes(pendingBrowserResultSql));
  for (const field of ["organization_id", "workspace_id", "provider_id"])
    assert.ok(pendingBrowserResultSql.includes(`result_job.${field}=result_query.${field}`));
  assert.match(pendingBrowserResultSql, /collection_task_id=result_query.task_id/);
  assert.match(pendingBrowserResultSql, /collection_subquery_id=result_query.id/);
  assert.match(pendingBrowserResultSql, /result_query.status='pending'/);
  assert.match(pendingBrowserResultSql, /result_query.status='failed'/);
  assert.match(pendingBrowserResultSql, /result_query.error_code='validation_failed'/);
  assert.match(
    pendingBrowserResultSql,
    /collection_tasks.status IN \('queued','retry_scheduled'\)/,
  );
  assert.match(pendingBrowserResultSql, /result_job.result_json IS NOT NULL/);
  assert.doesNotMatch(pendingBrowserResultSql, /UPDATE |INSERT |DELETE |request_id/);
});

test("validation retries remain a result preference below existing stage order, never a FIFO or lease override", () => {
  const preferred = collectionReadyOrderSql(true, false, false);
  assert.ok(preferred.includes(pendingBrowserResultSql));
  assert.ok(
    preferred.indexOf("collection_scope_turn.last_claim_at") <
      preferred.indexOf(pendingBrowserResultSql),
  );
  assert.match(pendingBrowserResultSql, /result_job.status IN \('succeeded','succeeded_empty'\)/);
  assert.doesNotMatch(
    pendingBrowserResultSql,
    /attempt_count|lease_token|lease_expires|status='dead_letter'/,
  );
  assert.ok(!collectionReadyOrderSql(false).includes(pendingBrowserResultSql));
});
test("both admission readers join scope history exactly once and expose only the original task row", async () => {
  const { repository, calls } = setup();
  await repository.queueReady(now);
  await repository.claim("worker", now, 120);
  const selections = calls.filter(([sql]) => isTaskRead(sql) && sql.includes("ORDER BY"));
  assert.equal(selections.length, 2);
  for (const [sql] of selections) {
    assert.ok(sql.startsWith("SELECT collection_tasks.* FROM collection_tasks"));
    assert.equal(sql.split(collectionScopeFairnessJoinSql).length, 2);
  }
});
