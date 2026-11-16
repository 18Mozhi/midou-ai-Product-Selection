import assert from "node:assert/strict";
import test from "node:test";
import { serveAccountCutover } from "../../scripts/serve-account-production-cutover.mjs";

const lock = "scoutops:account-retirement:production";
const digest = "a".repeat(64);
const run = "13d91868-1392-4f9b-9393-de21a56c62bf";
const prepare = { action: "prepare", plan_sha256: digest };
const apply = { action: "apply", run_id: run, review_sha256: digest };

function testConnection() {
  let held = false;
  return {
    isHeld: () => held,
    async query(sql, args) {
      if (sql.startsWith("SELECT DATABASE()"))
        return [
          [{ db: "product_scout", version: "5.7.44", authenticated_as: "product_scout@localhost" }],
        ];
      if (sql.startsWith("SELECT GET_LOCK")) {
        assert.deepEqual(args, [lock]);
        held = true;
        return [[{ acquired: 1 }]];
      }
      if (sql.startsWith("SELECT IS_USED_LOCK"))
        return [[{ locked: Number(held), other_sessions: 0 }]];
      if (sql.startsWith("SELECT RELEASE_LOCK")) {
        assert.deepEqual(args, [lock]);
        held = false;
        return [[{ released: 1 }]];
      }
      assert.fail(sql);
    },
  };
}

test("the same session holds the lock through prepare, exact review, apply and install fence", async () => {
  const connection = testConnection();
  const observed = [];
  await serveAccountCutover(
    connection,
    [prepare, apply, { action: "assert_fence" }, { action: "release" }],
    (value) => {
      assert.equal(connection.isHeld(), true);
      observed.push(value.status);
    },
    async (db, options) => {
      assert.equal(db, connection);
      assert.equal(connection.isHeld(), true);
      if (options.phase === "prepare")
        return { status: "review_required", run_id: run, review: { review_sha256: digest } };
      assert.deepEqual(options, {
        phase: "apply",
        expectedPlanSha256: digest,
        runId: run,
        expectedReviewSha256: digest,
      });
      return { status: "database_verified", run_id: run, forward: {} };
    },
  );
  assert.equal(connection.isHeld(), false);
  assert.deepEqual(observed, ["fenced", "review_required", "database_verified", "fenced"]);
});

test("a different review digest cannot trigger SQL", async () => {
  const connection = testConnection();
  await assert.rejects(
    serveAccountCutover(
      connection,
      [prepare, { ...apply, review_sha256: "b".repeat(64) }],
      () => {},
      async (_, options) => {
        assert.equal(options.phase, "prepare");
        return { status: "review_required", run_id: run, review: { review_sha256: digest } };
      },
    ),
    /unexpected_command/,
  );
  assert.equal(connection.isHeld(), false);
});
