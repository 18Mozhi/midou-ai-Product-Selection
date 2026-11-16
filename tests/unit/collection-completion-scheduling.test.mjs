import test from "node:test";
import assert from "node:assert/strict";
import { accountCompletionReadySourcingTaskSql, completionReadySourcingTaskSql } from "../../apps/worker/dist/completion-sourcing-policy.js";
import { completionReadyCompetitorTaskSql } from "../../apps/worker/dist/completion-competitor-policy.js";
import { MySqlCollectionTaskWorkerRepository } from "../../apps/worker/dist/collection-task-state-machine.js";
import {
  activeCollectionScopeSql,
  automaticCompletionTaskSql,
  automaticProductSearchTaskSql,
  collectionScopeFairnessJoinSql,
  collectionReadyOrderSql,
  collectionAccountCandidateSql,
  collectionAccountFairnessJoinSql,
  collectionAccountLockSql,
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
  assert.match(automaticCompletionTaskSql, /completion_event.task_id=collection_tasks.id/);
  assert.match(automaticCompletionTaskSql,/completion_query.task_id=completion_event.task_id/);
  assert.doesNotMatch(automaticCompletionTaskSql,/completion_query\.(organization_id|workspace_id)/);
});

const isTaskRead = (sql) => /^SELECT (?:collection_tasks\.\*(?:,.* queue_account_id)?|\*) FROM collection_tasks/.test(sql);

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
      if (sql.startsWith("SELECT slot FROM account_ownership_cutover"))
        return [options.sealed ? [{slot:"current"}] : []];
      if (sql.startsWith("SELECT cut.primary_account_id")) return [options.native ?
        [{primary_account_id:"sealed-account",account_id:"sealed-account",reason:"shared"}] : []];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
        return [options.native ? [{Field:"account_id"}] : [{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM opportunities"))
        return [options.nativeParent ? [{Field:"account_id"}] : [{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM competitors"))
        return [options.nativeCompetitor ? [{Field:"account_id"}] : [{Field:"organization_id"},{Field:"workspace_id"}]];
      if (sql.startsWith("SHOW COLUMNS FROM crawler_scheduler_leases"))
        return [options.native && !options.legacyLease ? [] : [{Field:"organization_id"},{Field:"workspace_id"}]];
      if (isTaskRead(sql))
        return [
          options.noCandidate ||
          (sql.includes(activeCollectionScopeSql("collection_tasks")) && options.scopeInactive) ||
          (sql.includes(collectionAccountCandidateSql) && options.noAccountOwner) ||
          (sql.includes(collectionRequiredSourcesReadySql) &&
            (options.sourceOpen || options.sourceDisabled)) ||
          (sql.endsWith("FOR UPDATE") &&
            (options.lost ||
              (sql.includes(collectionAccountLockSql) && options.ownerChanged) ||
              options.sourceOpenedAfterSelection ||
              options.sourceDisabledAfterSelection ||
              options.scopeArchivedAfterSelection))
            ? []
            : [options.native ? {id: row.id, status: row.status, attempt_count: row.attempt_count,
                trace_id: row.trace_id, request_id: row.request_id, account_id: "sealed-account", queue_account_id: "sealed-account"} :
                options.sealed ? {...row, queue_account_id: "sealed-account"} : row],
        ];
      if (sql.startsWith("SELECT id,provider_id") || sql.startsWith("SELECT q.id,q.provider_id"))
        return [
          [
            {
              id: "query",
              provider_id: "provider",
              ordinal: 1,
              is_required: 1,
              target_json: { query: "product" },
              subquery_owner: options.foreignSubquery ? "other" : "sealed-account",
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

test("foreign subquery cannot consume an account attempt or write a lease", async () => {
  const {repository,calls}=setup({native:true,sealed:true,foreignSubquery:true});
  assert.equal(await repository.claim("worker",now,120),null);
  const scopes=calls.filter(([sql])=>isTaskRead(sql));
  assert.equal(scopes.length,2);
  for (const [sql] of scopes) assert.match(sql,/NOT \(a.account_id<=>collection_tasks.account_id\)/);
  assert.ok(calls.some(([sql])=>sql.startsWith("SELECT q.id,q.provider_id") && sql.endsWith("FOR UPDATE")));
  assert.ok(!calls.some(([sql])=>sql.startsWith("INSERT") || sql.startsWith("UPDATE collection_tasks")));
});

test("queue and claim retain completion ranks after competitor and opportunity scope columns are removed", async () => {
  for (const nativeParent of [false, true]) {
    for (const method of ["queueReady", "claim"]) {
      const { repository, calls } = setup({ sealed: true, native: true, nativeCompetitor: true, nativeParent, noCandidate: true });
      if (method === "claim") await repository.claim("worker", now, 60);
      else await repository.queueReady(now);
      const [sql] = calls.find(([query]) => isTaskRead(query));
      assert.match(sql, /close_sourcing/);
      if (method === "claim") assert.match(sql, /close_competitor/);
      assert.match(sql, /COUNT\(DISTINCT UPPER\(c_sample.external_id\)\)/);
      assert.match(sql, /c_sample\.account_id=o\.account_id/);
      assert.doesNotMatch(sql, /\b(?:c|c_sample|c_detail|source_news)\.(?:organization_id|workspace_id)\b/);
      if (nativeParent) {
        assert.doesNotMatch(sql, /\b(?:organization_id|workspace_id)\b|JOIN (?:organizations|workspaces)\b/);
        assert.match(sql, /sealed\.legacy_org_id/);
        if (method === "claim") {
          assert.match(sql, /SELECT o\.id,o\.market,o\.source_ref_id,o\.created_at,sealed\.legacy_org_id/);
          assert.doesNotMatch(sql, /SELECT o\.\*,sealed\.legacy_org_id/);
        }
        assert.match(sql, /o\.sealed_source_id IS NULL AND o\.created_at>o\.cut_created_at/);
        assert.match(sql, /proof_owner.source_table='opportunity_events'/);
      } else assert.match(sql, /o\.organization_id/);
    }
  }
});

test("account collection tasks read trend events directly before competitors and opportunities migrate", async () => {
  const { repository, calls } = setup({ sealed: true, native: true, noCandidate: true });
  await repository.claim("worker", now, 60);
  const [sql] = calls.find(([query]) => isTaskRead(query));
  assert.match(sql, /JOIN trend_events source_origin/);
  assert.match(sql, /proof_owner.source_table='trend_events'/);
  assert.doesNotMatch(sql, /\b(?:source_origin|newer_origin)\.(?:organization_id|workspace_id)\b/);
  const originJoin = sql.slice(sql.indexOf("JOIN trend_events source_origin"), sql.indexOf("JOIN normalized_records source_news"));
  assert.doesNotMatch(originJoin, /o\.account_id/, "MySQL 5.7 cannot resolve the outer account inside a nested JOIN ON");
  assert.match(sql, /WHERE source_approval\.organization_id=o\.organization_id[\s\S]+source_table='trend_events' AND proof_owner.source_id=source_origin.id AND proof_owner.account_id=o.account_id/);
  assert.match(sql, /o\.organization_id/);
});

for (const method of ["queueReady", "claim"]) {
  const invoke = (repo) =>
    method === "queueReady" ? repo.queueReady(now) : repo.claim("worker", now, 120);
  test(`${method} checks native and sealed ownership at selection and lock, without scope on leases`, async () => {
    const { repository, calls } = setup({native: true, sealed: true});
    assert.equal((await invoke(repository)).accountId, "sealed-account");
    const selections = calls.filter(([sql]) => isTaskRead(sql));
    assert.ok(selections[0][0].includes("collection_tasks.account_id=" + collectionAccountCandidateSql));
    assert.match(selections[1][0], /AND account_id=\?.* FOR UPDATE$/);
    assert.deepEqual(selections[1][1].slice(-2), ["sealed-account", "sealed-account"]);
    for (const [sql] of selections)
      assert.doesNotMatch(sql, /\b(?:collection_tasks|t|t_detail|t_relation|n_detail|n_relation|n_primary|n_primary_current)\.(?:organization_id|workspace_id)\b/);
    const leases = calls.filter(([sql]) => sql.startsWith("INSERT INTO crawler_scheduler_leases"));
    assert.equal(leases.length, method === "claim" ? 2 : 0);
    for (const [sql] of leases) assert.doesNotMatch(sql, /organization_id|workspace_id/);
  });
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
      selections[1][0]
        .slice(selections[1][0].indexOf(" ORDER BY"))
        .replace("CASE WHEN " + completionReadyCompetitorTaskSql + " THEN 0 ELSE 1 END,", ""),
    );
    assert.ok(!selections[0][0].includes(completionReadyCompetitorTaskSql));
    assert.equal(
      selections[1][0].includes(completionReadyCompetitorTaskSql),
      turn !== 20 && turn % 2 === 0,
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

test("sealed scheduler uses the account sourcing preference on queue and claim", async () => {
  const {repository,calls}=setup({sealed:true,noCandidate:true});
  await repository.queueReady(now);
  await repository.claim("worker",now,120);
  const selected=calls.filter(([sql])=>isTaskRead(sql));
  assert.equal(selected.length,2);
  for (const [sql] of selected) {
    assert.ok(sql.includes(accountCompletionReadySourcingTaskSql));
    assert.ok(!sql.includes(completionReadySourcingTaskSql));
  }
});

test("product search priority requires the scoped real Worker producer and its Amazon discovery target", () => {
  assert.match(automaticProductSearchTaskSql, /product_search_event.task_id=collection_tasks.id/);
  assert.match(automaticProductSearchTaskSql,/product_search_query.task_id=product_search_event.task_id/);
  assert.doesNotMatch(automaticProductSearchTaskSql,/product_search_query\.(organization_id|workspace_id)/);
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
  assert.match(collectionRequiredSourcesReadySql,/required_source_query.task_id=collection_tasks.id/);
  assert.doesNotMatch(collectionRequiredSourcesReadySql,/required_source_query\.(organization_id|workspace_id)/);
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
  assert.match(collectionScopeFairnessJoinSql, /MAX\(e\.occurred_at\) last_claim_at/);
  assert.match(collectionScopeFairnessJoinSql, /JOIN collection_tasks t ON t\.id=e\.task_id/);
  assert.match(
    collectionScopeFairnessJoinSql,
    /e\.event_type='collection.task.leased' AND e\.actor_type='worker'/,
  );
  assert.match(collectionScopeFairnessJoinSql, /GROUP BY t\.organization_id,t\.workspace_id/);
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
  assert.match(pendingBrowserResultSql,/result_job.provider_id=result_query.provider_id/);
  assert.doesNotMatch(pendingBrowserResultSql,/(?:result_job|result_query)\.(organization_id|workspace_id)/);
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

for (const method of ["queueReady", "claim"]) {
  test(`sealed ${method} orders by committed account claims and rechecks the selected owner under lock`, async () => {
    const {repository,calls}=setup({sealed:true});
    const task = await (method === "queueReady" ? repository.queueReady(now) : repository.claim("worker",now,120));
    assert.equal(task.accountId, "sealed-account");
    const [selection, locked] = calls.filter(([sql]) => isTaskRead(sql));
    assert.ok(selection[0].includes(collectionAccountFairnessJoinSql));
    assert.match(collectionAccountFairnessJoinSql, /event_type='collection.task.leased'.*actor_type='worker'.*GROUP BY claim_owner.account_id/);
    assert.match(collectionAccountCandidateSql, /task_account.status='active'.*contract_version=25.*source_table='collection_tasks'.*task_cut.primary_account_id/);
    assert.ok(locked[0].includes(collectionAccountLockSql));
    assert.doesNotMatch(locked[0], /organization_id|workspace_id|organizations|workspaces/);
    assert.deepEqual(locked[1], method === "queueReady" ? ["task", now, "sealed-account"] : ["task", "sealed-account"]);
  });
  for (const options of [{noAccountOwner:true}, {ownerChanged:true}])
    test(`sealed ${method} makes no task transition when ownership is unavailable or changes: ${JSON.stringify(options)}`, async () => {
      const {repository,calls}=setup({sealed:true,...options});
      const result = await (method === "queueReady" ? repository.queueReady(now) : repository.claim("worker",now,120));
      assert.equal(result,null);
      assert.ok(!calls.some(([sql]) => /^(UPDATE collection_tasks|INSERT INTO collection_task)/.test(sql)));
    });
}
