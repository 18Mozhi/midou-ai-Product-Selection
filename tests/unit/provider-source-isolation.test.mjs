import test from "node:test";
import assert from "node:assert/strict";

import { ProviderSourceExecutor } from "../../apps/worker/dist/provider-source-executor.js";

test("permanent public-page approval still enforces robots and retains its matched-rule audit", async () => {
  const completed = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values = []) => {
      if (sql.startsWith("SELECT state,consecutive_failures")) return [[]];
      if (sql.startsWith("SELECT cut.primary_account_id")) return [[]];
      if (sql.includes("INSERT INTO collection_task_events")) completed.push(JSON.parse(values[6]));
      return [{ affectedRows: 1 }];
    },
  };
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("SELECT p.id"))
        return [
          [
            {
              id: "provider-robots-audit",
              code: "public-page-robots-audit",
              access_mode: "public_page",
              target_url: "https://robots-audit.test/catalog/private",
              parser_version: "public-page-v1",
              timeout_ms: 1000,
              fields_json: ["title"],
              status: "enabled",
              circuit_failure_threshold: 3,
              runtime_circuit_state: "closed",
              terms_review_status: "approved",
              terms_reference_url: "https://robots-audit.test/terms",
              terms_version: "2026-08",
              terms_expires_at: null,
              terms_permanent: 1,
              created_by: "actor-robots-audit",
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
    getConnection: async () => connection,
  };
  const executor = new ProviderSourceExecutor(
    pool,
    { collect: async () => assert.fail("robots-disallowed pages must not reach the adapter") },
    {},
    "worker-robots-audit",
    undefined,
    async () =>
      new Response("User-agent: ScoutOpsPublicCrawler\nDisallow: /catalog/private", {
        status: 200,
      }),
  );
  const [outcome] = await executor.execute(
    {
      id: "task-robots-audit",
      organizationId: "org-robots-audit",
      workspaceId: "workspace-robots-audit",
      attemptCount: 1,
      requestId: "request-robots-audit",
      traceId: "trace-robots-audit",
      leaseToken: "lease-robots-audit",
      subqueries: [
        {
          id: "query-robots-audit",
          providerId: "provider-robots-audit",
          ordinal: 1,
          required: false,
          target: {},
        },
      ],
    },
    async () => {},
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.errorCode, "robots_disallowed");
  assert.equal(outcome.robotsDecision.decision_version, "scoutops-robots-policy-v1");
  assert.equal(outcome.robotsDecision.matched_rule.directive, "disallow");
  assert.equal(outcome.robotsDecision.matched_rule.pattern_preview, "/catalog/private");
  assert.equal(completed[0].robots_policy_decision.matched_rule.directive, "disallow");
});

test("provider executor persists every subquery before applying required-source failure", async () => {
  const statements = [];
  const connection = {
    beginTransaction: async () => statements.push("begin"),
    commit: async () => statements.push("commit"),
    rollback: async () => statements.push("rollback"),
    release: () => statements.push("release"),
    query: async (sql, values) => {
      statements.push({ sql, values });
      return [{ affectedRows: 1 }];
    },
  };
  let providerReads = 0;
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("SELECT p.id")) {
        providerReads += 1;
        return [[{ id: `provider-${providerReads}`, status: "disabled" }]];
      }
      return [{ affectedRows: 1 }];
    },
    getConnection: async () => connection,
  };
  const executor = new ProviderSourceExecutor(
    pool,
    { collect: async () => assert.fail("disabled providers must not execute") },
    {},
    "worker-isolation",
  );
  let heartbeats = 0;
  await assert.rejects(
    () =>
      executor.execute(
        {
          id: "task-1",
          organizationId: "org-1",
          workspaceId: "workspace-1",
          attemptCount: 1,
          requestId: "request-1",
          traceId: "trace-1",
          leaseToken: "lease-1",
          subqueries: [
            {
              id: "query-required",
              providerId: "provider-1",
              ordinal: 1,
              required: true,
              target: {},
            },
            {
              id: "query-optional",
              providerId: "provider-2",
              ordinal: 2,
              required: false,
              target: {},
            },
          ],
        },
        async () => {
          heartbeats += 1;
        },
      ),
    (error) => error?.code === "permission_denied",
  );
  assert.equal(
    providerReads,
    2,
    "the second source must run after the first required source fails",
  );
  assert.equal(heartbeats, 2);
  assert.equal(
    statements.filter(
      (item) => typeof item === "object" && item.sql.startsWith("UPDATE collection_subqueries"),
    ).length,
    2,
  );
  assert.equal(
    statements.filter(
      (item) => typeof item === "object" && item.sql.includes("collection.subquery.completed"),
    ).length,
    2,
  );
  assert.equal(statements.filter((item) => item === "commit").length, 2);
});

test("an open provider circuit blocks only that source and preserves the remaining subquery", async () => {
  const persisted = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values) => {
      if (sql.startsWith("UPDATE collection_subqueries")) persisted.push(values);
      return [{ affectedRows: 1 }];
    },
  };
  let reads = 0;
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("SELECT p.id")) {
        reads += 1;
        return [
          [
            reads === 1
              ? {
                  id: "provider-open",
                  code: "open-source",
                  access_mode: "manual",
                  target_url: "https://example.test",
                  parser_version: "v1",
                  timeout_ms: 1000,
                  fields_json: ["title"],
                  status: "enabled",
                  circuit_failure_threshold: 3,
                  runtime_circuit_state: "open",
                }
              : { id: "provider-disabled", status: "disabled" },
          ],
        ];
      }
      return [{ affectedRows: 1 }];
    },
    getConnection: async () => connection,
  };
  const executor = new ProviderSourceExecutor(
    pool,
    { collect: async () => assert.fail("open or disabled providers must not execute") },
    {},
    "worker-circuit",
  );
  await assert.rejects(
    executor.execute(
      {
        id: "task-circuit",
        organizationId: "org-1",
        workspaceId: "workspace-1",
        attemptCount: 1,
        requestId: "request-circuit",
        traceId: "trace-circuit",
        leaseToken: "lease-circuit",
        subqueries: [
          { id: "query-open", providerId: "provider-open", ordinal: 1, required: true, target: {} },
          {
            id: "query-next",
            providerId: "provider-disabled",
            ordinal: 2,
            required: false,
            target: {},
          },
        ],
      },
      async () => {},
    ),
    { name: "CollectionExecutionError", code: "source_circuit_open" },
  );
  assert.equal(reads, 2);
  assert.equal(persisted.length, 2);
});

test("an explicit 1688 acceptance run can probe and close its existing open circuit", async () => {
  const circuitWrites = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values) => {
      if (sql.startsWith("SELECT state,consecutive_failures"))
        return [
          [
            {
              state: "open",
              consecutive_failures: 3,
              opened_at: new Date("2026-09-02T07:00:00.000Z"),
              recovered_at: null,
            },
          ],
        ];
      if (sql.startsWith("INSERT INTO provider_runtime_circuits")) circuitWrites.push(values);
      return [{ affectedRows: 1 }];
    },
  };
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("SELECT p.id"))
        return [
          [
            {
              id: "provider-1688-acceptance",
              code: "1688_search",
              access_mode: "authenticated_browser",
              target_url: "https://s.1688.com/selloffer/offer_search.htm",
              parser_version: "1688-browser-contract-v3",
              timeout_ms: 1000,
              fields_json: ["title"],
              status: "disabled",
              circuit_failure_threshold: 3,
              runtime_circuit_state: "open",
              created_by: "actor-1688-acceptance",
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
    getConnection: async () => connection,
  };
  let browserRuns = 0;
  const executor = new ProviderSourceExecutor(
    pool,
    { collect: async () => assert.fail("authenticated acceptance must use the browser job") },
    {},
    "worker-1688-acceptance",
    {
      collect: async () => {
        browserRuns += 1;
        return {
          browserJobId: "browser-job-1688-acceptance",
          records: [],
          artifacts: [],
          parseError: null,
        };
      },
    },
  );
  const [outcome] = await executor.execute(
    {
      id: "task-1688-acceptance",
      organizationId: "org-1688-acceptance",
      workspaceId: "workspace-1688-acceptance",
      attemptCount: 1,
      requestId: "request-1688-acceptance",
      traceId: "trace-1688-acceptance",
      leaseToken: "lease-1688-acceptance",
      subqueries: [
        {
          id: "query-1688-acceptance",
          providerId: "provider-1688-acceptance",
          ordinal: 1,
          required: true,
          target: { query: "桌面灯", acceptance_run: true },
        },
      ],
    },
    async () => {},
  );
  assert.equal(outcome.status, "succeeded_empty");
  assert.equal(browserRuns, 1);
  assert.equal(circuitWrites.length, 1);
  assert.equal(circuitWrites[0][1], "closed");
  assert.equal(circuitWrites[0][2], 0);
  assert.equal(circuitWrites[0][4], null);
  assert.ok(circuitWrites[0][6] instanceof Date);
});

test("a provider reaches its configured failure threshold and opens its runtime circuit", async () => {
  const statements = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values) => {
      statements.push({ sql, values });
      if (sql.startsWith("SELECT state,consecutive_failures"))
        return [
          [{ state: "closed", consecutive_failures: 2, opened_at: null, recovered_at: null }],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("SELECT p.id"))
        return [
          [
            {
              id: "provider-threshold",
              code: "threshold-source",
              access_mode: "manual",
              target_url: "https://example.test",
              parser_version: "v1",
              timeout_ms: 1000,
              fields_json: ["title"],
              status: "enabled",
              circuit_failure_threshold: 3,
              runtime_circuit_state: "closed",
              created_by: "actor-1",
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
    getConnection: async () => connection,
  };
  const executor = new ProviderSourceExecutor(
    pool,
    {
      collect: async () => {
        throw new Error("network unavailable");
      },
    },
    {},
    "worker-circuit",
  );
  await assert.rejects(
    () =>
      executor.execute(
        {
          id: "task-threshold",
          organizationId: "org-1",
          workspaceId: "workspace-1",
          attemptCount: 1,
          requestId: "request-threshold",
          traceId: "trace-threshold",
          leaseToken: "lease-threshold",
          subqueries: [
            {
              id: "query-threshold",
              providerId: "provider-threshold",
              ordinal: 1,
              required: true,
              target: {},
            },
          ],
        },
        async () => {},
      ),
    (error) => error?.code === "network_error",
  );
  const opened = statements.find((item) =>
    item.sql.startsWith("INSERT INTO provider_runtime_circuits"),
  );
  assert.ok(opened);
  assert.equal(opened.values[1], "open");
  assert.equal(opened.values[2], 3);
  assert.equal(opened.values[3], 3);
  assert.equal(opened.values[4], "network_error");
});

for (const drift of [false, true]) {
  test(`subquery completion inherits the exact task owner atomically (drift=${drift})`, async () => {
    const calls = [];
    const conn = {
      beginTransaction: async () => calls.push(["begin"]),
      commit: async () => calls.push(["commit"]),
      rollback: async () => calls.push(["rollback"]),
      release: () => calls.push(["release"]),
      query: async (sql, values) => {
        calls.push([sql, values]);
        if (sql.startsWith("SELECT cut.primary_account_id")) {
          assert.deepEqual(values, ["subquery-parent"]);
          return [[{ primary_account_id: "primary", account_id: "original",
            reason: drift ? "shared" : "exclusive_owner" }]];
        }
        return [{ affectedRows: 1 }];
      },
    };
    const executor = new ProviderSourceExecutor({
      getConnection: async () => conn,
      query: async (sql) => sql.startsWith("SELECT p.id")
        ? [[{ id: "provider", status: "disabled" }]] : [{ affectedRows: 1 }],
    }, {}, {}, "actor-not-owner");
    const execution = executor.execute({
      id: "subquery-parent", requestId: "request", traceId: "trace",
      subqueries: [{ id: "subquery", providerId: "provider", required: false, target: {} }],
    }, async () => {});
    if (drift) await assert.rejects(execution, { message: "collection_history_owner_mismatch" });
    else await execution;
    const [, event] = calls.find(([sql]) => sql.includes("'collection.subquery.completed'"));
    assert.deepEqual(event.slice(1, 6), ["subquery-parent", "blocked", "actor-not-owner", "request", "trace"]);
    assert.equal(JSON.parse(event[6]).subquery_id, "subquery");
    const writes = calls.filter(([sql]) => sql.startsWith("INSERT INTO account_owned_records"));
    assert.deepEqual(writes.map(([, values]) => values), drift
      ? [] : [["collection_task_events", event[0], "original", "exclusive_owner"]]);
    assert.deepEqual(calls.slice(-2), [[drift ? "rollback" : "commit"], ["release"]]);
  });
}

for (const mode of ["valid","stale_lease","foreign_subquery","missing_owner"]) {
  test(`account Provider completion keeps exact query and lease: ${mode}`, async()=>{
    const calls=[], transitions=[];
    const c={beginTransaction:async()=>transitions.push("begin"),commit:async()=>transitions.push("commit"),
      rollback:async()=>transitions.push("rollback"),release:()=>transitions.push("release"),
      query:async(sql,params)=> {
        calls.push([sql,params]);
        assert.doesNotMatch(sql,/organization_id|workspace_id/);
        if(sql.startsWith("SELECT t.id FROM collection_tasks")) {
          assert.match(sql,/t.attempt_count=\? AND t.status='running'/);
          assert.match(sql,/t.lease_expires_at>UTC_TIMESTAMP\(3\)/);
          assert.deepEqual(params.slice(0,3),["original-task","original-account",2]);
          assert.match(params[3],/^[a-f0-9]{64}$/);
          return [mode==="stale_lease"?[]:[{id:"original-task"}]];
        }
        if(sql.startsWith("UPDATE collection_subqueries")) {
          assert.match(sql,/provider_id=\?.*a.source_id=collection_subqueries.id AND a.account_id=\?/);
          assert.deepEqual(params.slice(-4),["original-query","original-task","original-provider","original-account"]);
          return [{affectedRows:mode==="foreign_subquery"?0:1}];
        }
        if(sql.startsWith("SELECT cut.primary_account_id")) return [mode==="missing_owner"?[]:
          [{account_id:"original-account",reason:"exclusive_owner"}]];
        return [{affectedRows:1}];
      }};
    const w=new ProviderSourceExecutor({getConnection:async()=>c},{},{},"worker");
    const task={id:"original-task",accountId:"original-account",nativeAccountScope:true,leaseToken:"private-token",
      attemptCount:2,requestId:"original-request",traceId:"original-trace"};
    const pending=w.persistSubqueryOutcome(task,"original-provider",{id:"original-query",status:"succeeded",
      availableResultCount:1,required:true,missingFields:[],errorCode:null});
    if(mode==="valid") await pending;
    else await assert.rejects(pending,{message:{stale_lease:"collection_task_lease_invalid",
      foreign_subquery:"collection_subquery_result_mismatch",missing_owner:"collection_history_owner_mismatch"}[mode]});
    assert.deepEqual(transitions,["begin",mode==="valid"?"commit":"rollback","release"]);
    assert.equal(calls.some(([s])=>s.startsWith("INSERT INTO account_owned_records")),mode==="valid");
    if(mode==="stale_lease" || mode==="foreign_subquery") assert.ok(!calls.some(([s])=>s.startsWith("INSERT")));
  });
}

test("account replay status does not advance when the original lease is gone", async()=>{
  const calls=[];
  const c={beginTransaction:async()=>{},rollback:async()=>calls.push("rollback"),release:()=>calls.push("release"),
    query:async(sql)=>{assert.match(sql,/^SELECT t.id FROM collection_tasks/);return [[]];}};
  const w=new ProviderSourceExecutor({getConnection:async()=>c},{},{},"worker");
  await assert.rejects(w.execute({id:"task",accountId:"account",nativeAccountScope:true,attemptCount:1,leaseToken:"token"},
    async()=>{}),{message:"collection_task_lease_invalid"});
  assert.deepEqual(calls,["rollback","release"]);
});
