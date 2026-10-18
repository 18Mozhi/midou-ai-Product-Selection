import test from "node:test";
import assert from "node:assert/strict";
import { MySqlCrawlerRuntimeRepository } from "../../apps/api/dist/mysql-crawler-runtime-repository.js";

const input = {
  actorId: "actor",
  organizationId: "org",
  workspaceId: "workspace",
  profileId: "profile",
  leaseOwner: "amazon-public-health",
  now: new Date("2026-10-18T12:00:00Z"),
  expiresAt: new Date("2026-10-18T12:03:00Z"),
  runId: "run",
  leaseId: "lease",
  leaseTokenHash: "hash",
  idempotencyKey: "operation",
  requestId: "request",
  traceId: "trace",
};
function fixture(options = {}) {
  const events = [],
    committed = [],
    runIds = [];
  let attempts = 0;
  const pool = {
    getConnection: async () => {
      const attempt = ++attempts,
        pending = [];
      return {
        beginTransaction: async () => events.push([attempt, "begin"]),
        commit: async () => {
          committed.push(...pending);
          events.push([attempt, "commit"]);
        },
        rollback: async () => {
          pending.length = 0;
          events.push([attempt, "rollback"]);
          if (options.rollbackError) throw options.rollbackError;
        },
        release: () => events.push([attempt, "release"]),
        query: async (sql, values) => {
          if (sql.startsWith("SELECT p.provider_id"))
            return [[{ updated_by: "actor", expires_at: null }]];
          if (sql.startsWith("SELECT slot_key") && options.conflict)
            return [[{ slot_key: "single-host" }]];
          if (sql.startsWith("INSERT INTO crawler_browser_runs")) {
            pending.push(values[0]);
            runIds.push(values[0]);
          }
          if (
            sql.startsWith("INSERT INTO crawler_profile_leases") &&
            attempt <= (options.failures ?? 1)
          )
            throw (
              options.error ?? Object.assign(new Error("deadlock"), { code: "ER_LOCK_DEADLOCK" })
            );
          return [[]];
        },
      };
    },
    query: async () => {
      if (options.readbackError) throw options.readbackError;
      return [
        [
          {
            id: input.runId,
            organization_id: "org",
            workspace_id: "workspace",
            provider_id: "provider",
            crawler_profile_id: input.profileId,
            status: "running",
            page_count: 0,
            item_count: 0,
            detail_count: 0,
            started_at: input.now,
            request_id: input.requestId,
            trace_id: input.traceId,
          },
        ],
      ];
    },
  };
  return {
    repository: new MySqlCrawlerRuntimeRepository(pool),
    events,
    committed,
    runIds,
    attempts: () => attempts,
  };
}

test("rolled-back lease deadlock retries the same operation only after releasing its connection", async () => {
  const f = fixture();
  const result = await f.repository.acquire(input);
  assert.equal(result.run.id, input.runId);
  assert.deepEqual(f.runIds, [input.runId, input.runId]);
  assert.deepEqual(f.committed, [input.runId]);
  assert.equal(f.attempts(), 2);
  assert.ok(
    f.events.findIndex((e) => e[0] === 1 && e[1] === "release") <
      f.events.findIndex((e) => e[0] === 2 && e[1] === "begin"),
  );
  assert.ok(!f.events.some((e) => e[0] === 1 && e[1] === "commit"));
});

test("persistent deadlock is bounded to three transactions and preserves the original error", async () => {
  const error = Object.assign(new Error("deadlock"), { code: "ER_LOCK_DEADLOCK" });
  const f = fixture({ failures: 10, error });
  await assert.rejects(f.repository.acquire(input), (e) => e === error);
  assert.equal(f.attempts(), 3);
  assert.deepEqual(f.committed, []);
  assert.equal(f.events.filter((e) => e[1] === "release").length, 3);
});

test("lock timeouts and business lease conflicts are never retried", async () => {
  const error = Object.assign(new Error("wait timeout"), { code: "ER_LOCK_WAIT_TIMEOUT" });
  const f = fixture({ error });
  await assert.rejects(f.repository.acquire(input), (e) => e === error);
  assert.equal(f.attempts(), 1);
  const conflict = fixture({ conflict: true });
  await assert.rejects(
    conflict.repository.acquire(input),
    (e) => e.code === "crawler_global_lease_conflict",
  );
  assert.equal(conflict.attempts(), 1);
});

test("rollback failure and post-commit read failure cannot replay a lease transaction", async () => {
  const rollbackError = new Error("rollback failed"),
    f = fixture({ rollbackError });
  await assert.rejects(f.repository.acquire(input), (e) => e === rollbackError);
  assert.equal(f.attempts(), 1);
  const readbackError = Object.assign(new Error("read failed"), { code: "ER_LOCK_DEADLOCK" });
  const committed = fixture({ failures: 0, readbackError });
  await assert.rejects(committed.repository.acquire(input), (e) => e === readbackError);
  assert.equal(committed.attempts(), 1);
  assert.deepEqual(committed.committed, [input.runId]);
});
