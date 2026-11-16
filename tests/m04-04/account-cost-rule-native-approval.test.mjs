import assert from "node:assert/strict";
import test from "node:test";
import { MySqlProfitRepository } from "../../apps/api/dist/mysql-profit-repository.js";

const rule = "00000000-0000-4000-8000-000000000083";

for (const actor of ["primary", "manager"]) {
  for (const action of ["approve", "reject"]) {
    test(`retired ${actor} cannot ${action} a rule with mismatched native ownership`, async () => {
      const calls = [];
      const connection = {
        async beginTransaction() {
          calls.push("begin");
        },
        async commit() {
          assert.fail("must not commit");
        },
        async rollback() {
          calls.push("rollback");
        },
        release() {
          calls.push("release");
        },
        async query(sql, args = []) {
          if (sql.startsWith("SELECT slot FROM account_ownership_cutover")) {
            assert.match(sql, /LOCK IN SHARE MODE/);
            return [[{ slot: "current" }]];
          }
          if (sql.startsWith("SELECT cut.primary_account_id")) {
            assert.equal(actor, "primary");
            assert.deepEqual(args, ["primary", "2313645627@qq.com"]);
            return [[{ primary_account_id: "primary" }]];
          }
          if (sql.startsWith("SELECT r.*, o.reason")) {
            assert.match(sql, /FOR UPDATE/);
            assert.deepEqual(args, [rule, actor]);
            assert.equal(sql.includes("account_cost_rule_manager_grants"), actor === "manager");
            return [
              [
                {
                  id: rule,
                  account_id: "different-owner",
                  ownership_account_id: "primary",
                  ownership_reason: "shared",
                  revision: 2,
                  status: "pending_approval",
                },
              ],
            ];
          }
          assert.fail(`no receipt, signature or write is allowed: ${sql}`);
        },
      };
      const repo = new MySqlProfitRepository(
        { getConnection: async () => connection },
        undefined,
        true,
      );
      await assert.rejects(
        repo.actRule({
          actorId: actor,
          accountOwnedApproval: actor === "manager" ? "manager" : true,
          action,
          approvalRole: actor === "manager" ? "selection_manager" : "primary_account",
          ruleId: rule,
          expectedRevision: 2,
          reason: "fixture",
          idempotencyKey: "possibly-already-used",
        }),
        { code: "cost_rule_not_found" },
      );
      assert.deepEqual(calls, ["begin", "rollback", "release"]);
    });
  }
}

test("retired worklist requires native owner agreement without changing exact manager grants", async () => {
  const repo = new MySqlProfitRepository(
    {
      async query(sql, args) {
        if (sql.startsWith("SELECT slot")) return [[{ slot: "current" }]];
        assert.match(sql, /ro\.account_id=r\.account_id/);
        assert.match(sql, /g\.cost_rule_id=r\.id AND g\.manager_id=\? AND g\.can_read=1/);
        assert.deepEqual(args, ["manager", "manager", "manager"]);
        return [[]];
      },
    },
    undefined,
    true,
  );
  assert.deepEqual(await repo.listRules({ accountId: "manager" }), []);
});
