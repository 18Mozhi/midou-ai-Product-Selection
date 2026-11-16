import test from "node:test";
import assert from "node:assert/strict";
import { IntelligenceSourceRecovery } from "../../apps/worker/dist/intelligence-source-recovery.js";
import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";

const sourceId = "10000000-0000-4000-8000-000000000001";
const target = {
  query: "portable fan",
  projection_type: "intelligence_product_discovery",
  intelligence_source_record_id: sourceId,
};
const task = {
  id: "old-task",
  organization_id: "org",
  workspace_id: "workspace",
  priority: "high",
  trace_id: "original-trace",
  created_by: "actor",
};
const query = {
  id: "original-subquery",
  provider_id: "amazon",
  status: "blocked",
  error_code: "permission_denied",
  is_required: 1,
  ordinal: 1,
  target_json: target,
};

function setup(options = {}) {
  const calls = [];
  let now = new Date("2026-10-18T00:00:00Z");
  let replay = options.replay ?? false;
  const original = options.accountOnly
    ? {id:task.id, account_id:"owner", priority:task.priority, trace_id:task.trace_id, created_by:task.created_by}
    : task;
  const c = {
    beginTransaction: async () => calls.push(["begin"]),
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
    query: async (sql, values = []) => {
      calls.push([sql, values]);
      assert.equal((sql.match(/\?/g) ?? []).length, values.length, sql);
      if (sql.startsWith("SELECT p.id,p.version"))
        return [
          options.provider === false
            ? []
            : [
                {
                  id: "amazon",
                  version: options.currentVersion ?? 13,
                  disabled_version: 12,
                  disabled_at: new Date("2026-10-17T20:00:00Z"),
                  restored_at: new Date("2026-10-17T21:00:00Z"),
                },
              ],
        ];
      if (sql.startsWith("SELECT COUNT(*) count") || sql.startsWith("SELECT (SELECT COUNT(*) FROM collection_tasks backlog")) return [[{ count: options.backlog ?? 0 }]];
      if (sql.startsWith("SHOW COLUMNS FROM normalized_records"))
        return [(options.native ? ["account_id"] : ["organization_id","workspace_id"]).map(Field => ({ Field }))];
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
        return [(options.accountOnly ? ["account_id"] : ["organization_id","workspace_id"]).map(Field => ({ Field }))];
      if (sql.startsWith("SHOW COLUMNS FROM trend_topics"))
        return [(options.topicFields ?? ["account_id"]).map(Field => ({ Field }))];
      if (sql.startsWith("SELECT t.id,t.organization_id") || sql.startsWith("SELECT t.id,t.account_id"))
        return [
          [
            {
              ...original,
              disabled_version: 12,
              restored_version: 13,
              disabled_at: new Date("2026-10-17T20:00:00Z"),
              restored_at: new Date("2026-10-17T21:00:00Z"),
            },
          ],
        ];
      if (sql.startsWith("SELECT t.*")) return [options.lost ? [] : [original]];
      if (sql.startsWith("SELECT id FROM collection_tasks"))
        return [replay ? [{ id: "child" }] : []];
      if (sql.startsWith("SELECT * FROM collection_subqueries"))
        return [options.queries ?? [query]];
      if (sql.startsWith("SELECT s.source_id FROM account_owned_records"))
        return [options.foreignSubqueryOrEvent ? [] : [{source_id:query.id}]];
      if (sql.startsWith("SELECT n.id"))
        return [options.provenance === false ? [] : [{ id: sourceId, account_id: "owner", reason: "exclusive_owner" }]];
      if (sql.startsWith("INSERT INTO collection_tasks")) {
        replay = true;
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT INTO collection_subqueries")) {
        if (options.fail)
          throw Object.assign(new Error("synthetic rollback"), { code: "ER_LOCK_DEADLOCK" });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("INSERT INTO collection_task_events")) return [{ affectedRows: 1 }];
      if (sql.startsWith("INSERT INTO account_owned_records")) return [{ affectedRows: 4 }];
      throw new Error(`unexpected query ${sql}`);
    },
  };
  const recovery = new IntelligenceSourceRecovery(
    { getConnection: async () => c },
    "worker",
    () => now,
    1000,
  );
  return {
    recovery,
    calls,
    advance: () => {
      now = new Date(now.getTime() + 30_000);
    },
  };
}

test("account-only recovery keeps the original task reference and rejects foreign audit lineage", async () => {
  for (const foreignSubqueryOrEvent of [false,true]) {
    const {recovery,calls}=setup({native:true,accountOnly:true,foreignSubqueryOrEvent});
    assert.equal(await recovery.processOnce(),foreignSubqueryOrEvent?0:1);
    const [candidate]=calls.find(([sql])=>sql.startsWith("SELECT t.id,t.account_id"));
    assert.match(candidate,/sub_owner.account_id=t.account_id/);
    assert.match(candidate,/event_owner.account_id=t.account_id/);
    assert.match(candidate,/BINARY origin.request_id=BINARY t.request_id AND BINARY origin.trace_id=BINARY t.trace_id/);
    assert.match(candidate,/origin.account_id=n.account_id AND t.account_id=n.account_id/);
    const [checkSql,args]=calls.find(([sql])=>sql.startsWith("SELECT s.source_id FROM account_owned_records"));
    assert.match(checkSql,/a.account_id=s.account_id/);
    assert.match(checkSql,/BINARY original.request_id=BINARY e.request_id AND BINARY original.trace_id=BINARY e.trace_id/);
    assert.deepEqual(args,[task.id,query.id,"owner"]);
    const writes=calls.filter(([sql])=>sql.startsWith("INSERT"));
    if(foreignSubqueryOrEvent)assert.equal(writes.length,0);
    else {
      assert.match(writes[0][0],/^INSERT INTO collection_tasks \(id,account_id,/);
      assert.deepEqual(writes[0][1].slice(1,3),["owner",task.priority]);
      assert.equal(writes[0][1][5],task.id);
      assert.equal(writes[0][1][8],task.trace_id);
      const [ledger]=writes.at(-1)[1];
      assert.equal(ledger.length,4);
      assert.ok(ledger.every(row=>row[2]==="owner"&&row[3]==="exclusive_owner"));
    }
    for(const [sql] of calls.filter(([s])=>!s.startsWith("SHOW COLUMNS")))
      assert.doesNotMatch(sql,/organization_id|workspace_id|JOIN organizations|JOIN workspaces/);
  }
});

test("0190 and 0191 recover only a proven owner and register the child graph atomically", async () => {
  for (const topicFields of [["account_id"], ["organization_id","workspace_id"]]) {
    const { recovery, calls } = setup({ native: true, topicFields });
    assert.equal(await recovery.processOnce(), 1);
    const candidate = calls.find(([sql]) => sql.startsWith("SELECT t.id,t.organization_id"));
    const recheck = calls.find(([sql]) => sql.startsWith("SELECT n.id"));
    for (const [sql] of [candidate, recheck]) {
      assert.match(sql, /re.account_id=n.account_id/);
      assert.match(sql, /recovery_owner.account_id=n.account_id/);
      assert.match(sql, /WHERE recovery_owner.source_id=t.id AND /);
      assert.match(sql, /proof5.source_table='trend_events'.*proof5.account_id=n.account_id/);
      if (topicFields.length === 1) {
        assert.match(sql, /st.account_id=n.account_id/);
        assert.doesNotMatch(sql, /st.organization_id|st.workspace_id/);
      } else assert.match(sql, /st.organization_id=origin.organization_id/);
    }
    assert.match(recheck[0], /JOIN collection_tasks t ON t.id=\?.*JOIN account_owned_records recovery_owner/);
    assert.deepEqual(recheck[1], [task.id, sourceId, task.organization_id, task.workspace_id, target.query]);
    const ownerWrite = calls.find(([sql]) => sql.startsWith("INSERT INTO account_owned_records"));
    const insertIds = calls.filter(([sql]) => /^INSERT INTO collection_(tasks|subqueries|task_events)/.test(sql)).map(([, values]) => values[0]);
    assert.deepEqual(ownerWrite[1][0], ["collection_tasks","collection_subqueries","collection_task_events","collection_task_events"]
      .map((table, i) => [table, insertIds[i], "owner", "exclusive_owner"]));
  }
});

test("native recovery does not write on a foreign proof or an incomplete topic layout", async () => {
  const foreign = setup({ native: true, provenance: false });
  assert.equal(await foreign.recovery.processOnce(), 0);
  assert.ok(!foreign.calls.some(([s]) => s.startsWith("INSERT")));
  const partial = setup({ native: true, topicFields: ["organization_id"] });
  await assert.rejects(() => partial.recovery.processOnce(), /trend_topic_scope_schema_invalid/);
  assert.deepEqual(partial.calls.at(-2), ["rollback"]);
});

test("source outage recovery creates one linked search with original scope, target and trace but no facts", async () => {
  const { recovery, calls, advance } = setup();
  assert.equal(await recovery.processOnce(), 1);
  const insert = calls.find(([sql]) => sql.startsWith("INSERT INTO collection_tasks"));
  assert.deepEqual(insert[1].slice(1, 4), ["org", "workspace", "high"]);
  assert.equal(insert[1][6], "old-task");
  assert.equal(insert[1][9], "original-trace");
  assert.equal(insert[1][10], "actor");
  const subquery = calls.find(([sql]) => sql.startsWith("INSERT INTO collection_subqueries"));
  assert.match(subquery[0], /t.id,t.organization_id,t.workspace_id/);
  assert.deepEqual(subquery[1].slice(1, 3), ["amazon", 1]);
  assert.equal(subquery[1].at(-1), insert[1][0]);
  assert.deepEqual(JSON.parse(subquery[1][3]), target);
  const events = calls.filter(([sql]) => sql.startsWith("INSERT INTO collection_task_events"));
  assert.deepEqual(
    events.map(([, v]) => v[2]),
    ["intelligence.product_search.auto_scheduled", "intelligence.product_search.source_recovered"],
  );
  assert.equal(JSON.parse(events[1][1][6]).provider_version, 13);
  assert.ok(
    !calls.some(([sql]) =>
        /^(UPDATE|DELETE)|INSERT(?: IGNORE)? INTO (?:raw_evidence|normalized_records)/.test(sql),
    ),
  );
  const count = calls.length;
  assert.equal(await recovery.processOnce(), 0);
  assert.equal(calls.length, count);
  advance();
  assert.equal(await recovery.processOnce(), 0);
  assert.equal(calls.filter(([sql]) => sql.startsWith("INSERT INTO collection_tasks")).length, 1);
});

for (const [label, options] of [
  ["provider not admitted or not restored", { provider: false }],
  ["global backlog full", { backlog: 1000 }],
  ["completion headroom starts", { backlog: 997 }],
  ["last completion slot stays available", { backlog: 999 }],
  ["candidate lost", { lost: true }],
  ["another recovery already exists", { replay: true }],
  ["multiple original subqueries", { queries: [query, query] }],
  ["foreign provider", { queries: [{ ...query, provider_id: "other" }] }],
  ["not blocked", { queries: [{ ...query, status: "pending" }] }],
  ["real validation failure", { queries: [{ ...query, error_code: "captcha" }] }],
  ["optional source", { queries: [{ ...query, is_required: 0 }] }],
  ["missing current provenance", { provenance: false }],
  [
    "unexpected target URL",
    { queries: [{ ...query, target_json: { ...target, page_url: "https://example.test/" } }] },
  ],
  [
    "different projection",
    { queries: [{ ...query, target_json: { ...target, projection_type: "competitor_snapshot" } }] },
  ],
  [
    "invalid source identity",
    { queries: [{ ...query, target_json: { ...target, intelligence_source_record_id: "other" } }] },
  ],
  ["blank query", { queries: [{ ...query, target_json: { ...target, query: " " } }] }],
]) {
  test(`recovery fails closed: ${label}`, async () => {
    const { recovery, calls } = setup(options);
    assert.equal(await recovery.processOnce(), 0);
    assert.ok(!calls.some(([sql]) => sql.startsWith("INSERT")));
    assert.deepEqual(calls.at(-2), ["commit"]);
    assert.deepEqual(calls.at(-1), ["release"]);
  });
}

test("recovery respects the remaining backlog capacity and rolls back partial writes on error", async () => {
  const capacity = setup({ backlog: 996 });
  await capacity.recovery.processOnce();
  assert.equal(
    capacity.calls.find(([s]) => s.startsWith("SELECT t.id,t.organization_id"))[1][2],
    1,
  );
  const failed = setup({ fail: true });
  await assert.rejects(() => failed.recovery.processOnce(), { code: "ER_LOCK_DEADLOCK" });
  assert.ok(failed.calls.some(([s]) => s === "rollback"));
  assert.ok(
    !failed.calls.some(
      ([s]) => s === "commit" || s.startsWith("INSERT INTO collection_task_events"),
    ),
  );
});

test("repair dependency failure is logged without blocking new intelligence processing", async () => {
  const worker = new MySqlTrendProjectionWorker({}, "worker", 120);
  worker.sourceRecovery.processOnce = async () => {
    throw Object.assign(new Error("synthetic"), { code: "ER_LOCK_DEADLOCK" });
  };
  let fresh = 0;
  worker.enqueueMissing = async () => {
    fresh += 1;
  };
  worker.claim = async () => null;
  worker.hasReadyCollectedResult = async () => false;
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {};
  const oldWarn = console.warn,
    warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    assert.deepEqual(await worker.processOnce(), { status: "idle" });
  } finally {
    console.warn = oldWarn;
  }
  assert.equal(fresh, 1);
  assert.deepEqual(warnings, [["intelligence_source_recovery_failed", "ER_LOCK_DEADLOCK"]]);
});

test("source recovery backlog counts only existing active organization and workspace scopes", async () => {
  const { recovery, calls } = setup({ backlog: 1000 });
  assert.equal(await recovery.processOnce(), 0);
  const sql = calls.find(([sql]) =>
    sql.startsWith("SELECT COUNT(*) count FROM collection_tasks"),
  )[0];
  assert.match(sql, /collection_scope_org.id=collection_tasks.organization_id/);
  assert.match(sql, /collection_scope_workspace.organization_id=collection_scope_org.id/);
  assert.match(sql, /collection_scope_workspace.id=collection_tasks.workspace_id/);
  assert.match(sql, /collection_scope_org.status='active'/);
  assert.match(sql, /collection_scope_workspace.status='active'/);
});

test("later restoration still recovers an older audited outage with its original version and time window", async () => {
  const { recovery, calls, advance } = setup({ currentVersion: 19 });
  assert.equal(await recovery.processOnce(), 1);
  const candidates = calls.find(([sql]) => sql.startsWith("SELECT t.id,t.organization_id"));
  assert.deepEqual(candidates[1], ["amazon", 19, 20]);
  assert.match(candidates[0], /recovery_restored.version=recovery_disabled.version\+1/);
  assert.match(candidates[0], /recovery_restored.action='configuration_updated'/);
  assert.match(candidates[0], /recovery_restored.version<=\?/);
  assert.match(candidates[0], /t.finished_at>=recovery_disabled.created_at/);
  assert.match(candidates[0], /t.finished_at<recovery_restored.created_at/);
  const locked = calls.find(([sql]) => sql.startsWith("SELECT t.*"));
  assert.deepEqual(locked[1].slice(-2), [
    new Date("2026-10-17T20:00:00Z"),
    new Date("2026-10-17T21:00:00Z"),
  ]);
  const metadata = JSON.parse(
    calls.find(
      ([sql, values]) =>
        sql.startsWith("INSERT INTO collection_task_events") &&
        values[2] === "intelligence.product_search.source_recovered",
    )[1][6],
  );
  assert.equal(metadata.provider_version, 13);
  assert.equal(metadata.disabled_version, 12);
  advance();
  assert.equal(await recovery.processOnce(), 0);
});

test("native source recovery stops at the unchanged global capacity boundary without a workspace lookup", async () => {
  const { recovery, calls } = setup({ native:true, backlog:997 });
  assert.equal(await recovery.processOnce(),0);
  const [sql] = calls.find(([sql]) => sql.startsWith("SELECT (SELECT COUNT(*) FROM collection_tasks backlog"));
  assert.match(sql,/task_owner.source_id=backlog.id/);
  assert.doesNotMatch(sql,/organization_id|workspace_id/);
  assert.ok(!calls.some(([sql])=>sql.startsWith("INSERT")));
});
