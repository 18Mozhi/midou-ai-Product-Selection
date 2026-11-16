import assert from "node:assert/strict";
import test from "node:test";
import { planAccountRetirementProduction } from "../../scripts/plan-account-retirement-production.mjs";
import { runAccountProductionCutover } from "../../scripts/run-account-production-cutover.mjs";

const plan = await planAccountRetirementProduction();
const runId = "c4dcbe8b-7e76-4760-9874-17bc1c889f6c";
const valid = {
  phase: "apply",
  expectedPlanSha256: plan.plan_sha256,
  runId,
  expectedReviewSha256: "0".repeat(64),
};

function connection({ locked = 1, receipts = plan.prerequisites, runs = [], crawler = null } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith("SELECT DATABASE()"))
        return [
          [{ db: "product_scout", version: "5.7.44", authenticated_as: "product_scout@localhost" }],
        ];
      if (sql.startsWith("SELECT IS_USED_LOCK")) return [[{ locked, other_sessions: 0 }]];
      if (sql.startsWith("SELECT name,checksum"))
        return [receipts.map((r) => ({ name: r.name, checksum: r.candidate_sha256 }))];
      if (sql.startsWith("SELECT id FROM account_retirement_runs")) return [runs];
      if (sql.includes(" standalone_running,")) return [[crawler]];
      assert.fail(`unexpected SQL: ${sql}`);
    },
  };
}

test("cutover requires reviewed inputs and a verified plan before touching the connection", async () => {
  const db = connection();
  await assert.rejects(
    runAccountProductionCutover(db, { ...valid, expectedReviewSha256: undefined }),
    /invalid_phase_or_review/,
  );
  await assert.rejects(
    runAccountProductionCutover(db, { ...valid, expectedPlanSha256: "f".repeat(64) }),
    /plan_digest_mismatch/,
  );
  assert.deepEqual(db.calls, []);
});

test("prepare and apply refuse to write without the same-session stop-writer fence", async () => {
  for (const options of [valid, { phase: "prepare", expectedPlanSha256: plan.plan_sha256 }]) {
    const db = connection({ locked: 0 });
    await assert.rejects(runAccountProductionCutover(db, options), /requires_stopped_writers/);
    assert.equal(db.calls.length, 2);
  }
});

test("apply refuses missing prerequisites, multiple staging runs and a review for another run", async () => {
  const cases = [
    [{ receipts: [] }, /requires_exact_prerequisites/],
    [{ runs: [{ id: runId }, { id: runId }] }, /ambiguous_staged_run/],
    [{ runs: [{ id: "c5dcbe8b-7e76-4760-9874-17bc1c889f6c" }] }, /expected_staged_run/],
  ];
  for (const [options, expected] of cases) {
    const db = connection(options);
    await assert.rejects(runAccountProductionCutover(db, valid), expected);
    assert.ok(db.calls.every((sql) => sql.startsWith("SELECT ")));
  }
});

test("prepare stops before prerequisite work if a forward receipt already exists or has a gap", async () => {
  for (const receipts of [[...plan.prerequisites, plan.forward[0]], [plan.forward[0]]]) {
    const db = connection({ receipts });
    await assert.rejects(
      runAccountProductionCutover(db, { phase: "prepare", expectedPlanSha256: plan.plan_sha256 }),
      /prepare_receipt_boundary_invalid/,
    );
    assert.equal(db.calls.length, 3);
    assert.ok(db.calls.every((sql) => sql.startsWith("SELECT ")));
  }
});

test("legacy crawler states that would reject the new runtime stop prepare and apply before writes", async () => {
  for (const crawler of [
    { standalone_running: "4", standalone_active_leases: 0 },
    { standalone_running: 0, standalone_active_leases: "1" },
  ]) {
    for (const options of [valid, { phase: "prepare", expectedPlanSha256: plan.plan_sha256 }]) {
      const db = connection({ crawler, runs: [{ id: runId }] });
      await assert.rejects(
        runAccountProductionCutover(db, options),
        /standalone_crawler_not_drained/,
      );
      assert.ok(db.calls.every((sql) => /^SELECT\s/.test(sql)));
    }
  }
});
