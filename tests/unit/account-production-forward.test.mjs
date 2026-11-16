import assert from "node:assert/strict";
import test from "node:test";
import { applyAccountProductionForward } from "../../scripts/apply-account-production-forward.mjs";
import { planAccountRetirementProduction } from "../../scripts/plan-account-retirement-production.mjs";

const plan = await planAccountRetirementProduction();
const run = "9d361a44-aee0-4f48-b2f0-e40fca158f7e";

const mock = ({ db = "product_scout", sessions = 0, applied = 3, partial = false } = {}) => {
  const reads = [];
  return {
    reads,
    async query(sql) {
      reads.push(sql);
      if (sql.startsWith("SELECT DATABASE()"))
        return [[{ db, version: "5.7.44", authenticated_as: "product_scout@localhost" }]];
      if (sql.startsWith("SELECT IS_USED_LOCK")) return [[{ locked: 1, other_sessions: sessions }]];
      if (sql.startsWith("SELECT name,checksum"))
        return [[...plan.prerequisites, ...plan.forward].slice(0, applied).map((step) => ({
          name: step.name,
          checksum: step.candidate_sha256,
        }))];
      if (sql.startsWith("SELECT COLUMN_TYPE"))
        return [[{ column_type: partial
          ? "enum('selection_manager','organization_admin','primary_account')"
          : "enum('selection_manager','organization_admin')" }]];
      assert.fail(`unexpected statement: ${sql}`);
    },
  };
};

test("production forward stops before SQL when the compiled plan differs", async () => {
  const db = mock();
  await assert.rejects(applyAccountProductionForward(db, "0".repeat(64), run), /plan_digest_mismatch/);
  assert.deepEqual(db.reads, []);
});

test("production forward refuses nonproduction targets, live writers, and partially applied migrations", async () => {
  for (const [options, error, reads] of [
    [{ db: "product_scout_rehearsal" }, /legacy_schema_target_invalid/, 1],
    [{ sessions: 1 }, /forward_requires_stopped_writers/, 2],
    [{ applied: 4 }, /forward_requires_fresh_prefix/, 3],
    [{ partial: true }, /first_migration_not_pristine/, 4],
  ]) {
    const db = mock(options);
    await assert.rejects(applyAccountProductionForward(db, plan.plan_sha256, run), error);
    assert.equal(db.reads.length, reads);
    assert.ok(db.reads.every((sql) => sql.startsWith("SELECT ")));
  }
});
