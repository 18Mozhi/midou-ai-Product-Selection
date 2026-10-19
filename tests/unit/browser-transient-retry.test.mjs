import test from "node:test";
import assert from "node:assert/strict";
import { MySqlAuthenticatedBrowserJobClient } from "../../apps/worker/dist/authenticated-browser-job-client.js";

const input = {
  organizationId: "org",
  workspaceId: "workspace",
  taskId: "task",
  subqueryId: "query",
  attemptCount: 2,
  leaseToken: "current-task-lease",
  provider: { id: "provider", code: "amazon_product", accessMode: "public_page", timeoutMs: 1000 },
  target: { query: "storage box" },
  requestId: "request",
  traceId: "trace",
};

test("a new authorized parent attempt must request fresh browser work after an old timeout", async () => {
  let row = { id: "job", status: "timed_out", error_code: "timeout" };
  let freshRuns = 0;
  const statements = [];
  const pool = {
    query: async (sql, values) => {
      statements.push({ sql, values });
      if (sql.startsWith("UPDATE browser_collection_jobs j")) {
        row = { id: "job", status: "queued", error_code: null };
        return [{ affectedRows: 1 }];
      }
      return sql.startsWith("SELECT") ? [[row]] : [{ affectedRows: 0 }];
    },
  };
  const client = new MySqlAuthenticatedBrowserJobClient(pool, 1, async () => {
    freshRuns++;
    row = { id: "job", status: "failed", error_code: "network_error" };
  });
  await assert.rejects(
    () => client.collect(input, async () => {}),
    (e) => e.code === "network_error",
  );
  assert.equal(
    freshRuns,
    1,
    "the old timeout must not consume this retry without browser execution",
  );
  const retry = statements.find(({ sql }) => sql.startsWith("UPDATE browser_collection_jobs j"));
  assert.ok(retry);
  for (const guard of [
    "t.organization_id=j.organization_id",
    "t.workspace_id=j.workspace_id",
    "t.status='running'",
    "t.lease_token_hash=UNHEX(?)",
    "t.lease_expires_at>NOW(3)",
    "t.attempt_count=?",
    "a.attempt_number=t.attempt_count",
    "a.started_at>j.finished_at",
    "previous.attempt_number=t.attempt_count-1",
    "previous.status IN ('retry_scheduled','rate_limited')",
    "j.status IN ('failed','timed_out')",
  ])
    assert.ok(retry.sql.includes(guard), guard);
  assert.equal(JSON.parse(retry.values[0]).purpose, "amazon_public");
  assert.match(retry.sql, /SET j\.execution_request_json=\?/);
  assert.deepEqual(retry.values.slice(1, 6), ["org", "workspace", "task", "query", "provider"]);
  assert.equal(retry.values.at(-1), 2);
  assert.doesNotMatch(
    retry.sql,
    /'(?:captcha|blocked_captcha|login_required|permission_denied|source_changed|validation_failed)'/,
  );
});

test("first attempts and calls without a parent lease never reset terminal browser rows", async () => {
  for (const change of [{ attemptCount: 1 }, { leaseToken: undefined }, { attemptCount: 5 }]) {
    const writes = [];
    const client = new MySqlAuthenticatedBrowserJobClient({
      query: async (sql) => {
        if (!sql.startsWith("SELECT")) writes.push(sql);
        return sql.startsWith("SELECT")
          ? [[{ id: "job", status: "blocked", error_code: "blocked_captcha" }]]
          : [{ affectedRows: 0 }];
      },
    });
    await assert.rejects(
      () => client.collect({ ...input, ...change }, async () => {}),
      (e) => e.code === "captcha" && !e.retryable,
    );
    assert.equal(writes.length, 1);
    assert.ok(writes[0].startsWith("INSERT"));
  }
});

test("a denied retry fence keeps blocked, parsing and stale-parent failures terminal", async () => {
  for (const errorCode of [
    "blocked_captcha",
    "permission_denied",
    "validation_failed",
    "timeout",
  ]) {
    let waits = 0;
    let fencedWrites = 0;
    const client = new MySqlAuthenticatedBrowserJobClient(
      {
        query: async (sql) => {
          if (sql.startsWith("UPDATE browser_collection_jobs j")) {
            fencedWrites++;
            return [{ affectedRows: 0 }];
          }
          return sql.startsWith("SELECT")
            ? [
                [
                  {
                    id: "job",
                    status: errorCode === "blocked_captcha" ? "blocked" : "failed",
                    error_code: errorCode,
                  },
                ],
              ]
            : [{ affectedRows: 0 }];
        },
      },
      1,
      async () => {
        waits++;
      },
    );
    await assert.rejects(
      () => client.collect(input, async () => {}),
      (e) => e.code === (errorCode === "blocked_captcha" ? "captcha" : errorCode),
    );
    assert.equal(fencedWrites, 1);
    assert.equal(waits, 0);
  }
});

test("lost parent heartbeat prevents a terminal job from being requeued", async () => {
  const writes = [];
  const client = new MySqlAuthenticatedBrowserJobClient({
    query: async (sql) => {
      writes.push(sql);
      return [{ affectedRows: 0 }];
    },
  });
  await assert.rejects(
    () =>
      client.collect(input, async () => {
        throw new Error("lease_lost");
      }),
    /lease_lost/,
  );
  assert.equal(writes.length, 1);
  assert.ok(writes[0].startsWith("INSERT"));
});

test("worker wait and shutdown retain their original retryable classification and raw row", async () => {
  for (const [status, raw, canonical] of [
    ["timed_out", "worker_wait_timeout", "timeout"],
    ["cancelled", "worker_shutdown_cancelled", "dependency_unavailable"],
  ]) {
    const row = { id: "job", status, error_code: raw };
    const client = new MySqlAuthenticatedBrowserJobClient({
      query: async (sql) => (sql.startsWith("SELECT") ? [[row]] : [{ affectedRows: 0 }]),
    });
    await assert.rejects(
      () => client.collect({ ...input, attemptCount: 1 }, async () => {}),
      (e) => e.code === canonical && e.retryable,
    );
    assert.equal(row.error_code, raw);
    assert.equal(row.status, status);
  }
});
