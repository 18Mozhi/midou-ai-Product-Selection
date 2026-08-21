import test from "node:test";
import assert from "node:assert/strict";

import { ProviderSourceExecutor } from "../../apps/worker/dist/provider-source-executor.js";

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
  const outcomes = await executor.execute(
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
  );
  assert.equal(reads, 2);
  assert.equal(outcomes[0].errorCode, "source_circuit_open");
  assert.equal(outcomes[1].errorCode, "permission_denied");
  assert.equal(persisted.length, 2);
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
    (error) => error?.code === "validation_failed",
  );
  const opened = statements.find((item) =>
    item.sql.startsWith("INSERT INTO provider_runtime_circuits"),
  );
  assert.ok(opened);
  assert.equal(opened.values[1], "open");
  assert.equal(opened.values[2], 3);
  assert.equal(opened.values[3], 3);
  assert.equal(opened.values[4], "validation_failed");
});
