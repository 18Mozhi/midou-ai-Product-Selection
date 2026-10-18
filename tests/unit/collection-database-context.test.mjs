import test from "node:test";
import assert from "node:assert/strict";
import { collectionQueueDatabaseContext } from "../../apps/worker/dist/collection-task-database-context.js";
import { processCollectionTaskOnce } from "../../apps/worker/dist/collection-task-worker.js";

for (const code of ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"])
  test(`${code} keeps its cause and safe phase without SQL or values`, async () => {
    const cause = Object.assign(new Error("database failure"), {
      code,
      sql: "DELETE FROM crawler_scheduler_leases WHERE expires_at<='secret-value'",
    });
    await assert.rejects(
      collectionQueueDatabaseContext("claim", async () => {
        throw cause;
      }),
      (error) => {
        assert.equal(error.code, code);
        assert.equal(error.cause, cause);
        assert.equal(
          error.message,
          `collection_database:claim:${code}:expired_scheduler_leases_delete`,
        );
        assert.doesNotMatch(error.message, /secret-value|DELETE FROM/);
        return true;
      },
    );
  });

test("unknown failures retain exact identity and successful reads retain result", async () => {
  const failure = Object.assign(new Error("not a lock failure"), { code: "ER_PARSE_ERROR" });
  await assert.rejects(
    collectionQueueDatabaseContext("queue_ready", async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  const result = { id: "task" };
  assert.equal(await collectionQueueDatabaseContext("claim", async () => result), result);
});

for (const [stage, method] of [
  ["recover_expired", "recoverExpired"],
  ["queue_ready", "queueReady"],
  ["claim", "claim"],
])
  test(`actual worker reports ${stage} and never proceeds after the lock failure`, async () => {
    const calls = [];
    const repository = Object.fromEntries(
      ["recoverExpired", "queueReady", "claim"].map((name) => [
        name,
        async () => {
          calls.push(name);
          if (name === method)
            throw Object.assign(new Error("deadlock"), {
              code: "ER_LOCK_DEADLOCK",
              sql: "SELECT * FROM collection_tasks WHERE id='private-task-id' FOR UPDATE",
            });
          return name === "recoverExpired" ? 0 : null;
        },
      ]),
    );
    await assert.rejects(
      processCollectionTaskOnce({
        repository,
        workerId: "worker",
        leaseSeconds: 30,
        coordinator: {
          acquire: async () => {
            throw Error("must not acquire");
          },
        },
        executor: {
          execute: async () => {
            throw Error("must not execute");
          },
        },
      }),
      (error) => {
        assert.equal(
          error.message,
          `collection_database:${stage}:ER_LOCK_DEADLOCK:task_primary_lock`,
        );
        assert.doesNotMatch(error.message, /private-task-id/);
        return true;
      },
    );
    assert.deepEqual(
      calls,
      ["recoverExpired", "queueReady", "claim"].slice(
        0,
        ["recoverExpired", "queueReady", "claim"].indexOf(method) + 1,
      ),
    );
  });
