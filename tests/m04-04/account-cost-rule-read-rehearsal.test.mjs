import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlProfitRepository } from "../../apps/api/dist/mysql-profit-repository.js";
import { ProfitService } from "../../apps/api/dist/profit-service.js";

test("the account cost-rule list binds owned rules and readable pending manager grants to the session", async () => {
  let boundPrimary = true;
  const pool = {
    async query(sql, args) {
      if (sql.startsWith("SELECT cut.primary_account_id")) {
        assert.deepEqual(args, ["primary", "2313645627@qq.com"]);
        assert.match(
          sql,
          /cut\.primary_account_id=\?.*u\.status='active'.*u\.email_verified_at IS NOT NULL/,
        );
        assert.doesNotMatch(sql, /LOCK IN SHARE MODE|FOR UPDATE/);
        return [boundPrimary ? [{ primary_account_id: "primary" }] : []];
      }
      if (sql.includes("FROM account_ownership_cutover")) return [[{ slot: "current" }]];
      assert.match(sql, /ro.source_table='cost_rules'/);
      assert.match(
        sql,
        /ro.reason IN \('shared','unassigned'\) AND ro.account_id=ownership_receipt.primary_account_id/,
      );
      assert.match(
        sql,
        /ra.source_table='cost_rule_approvals'\s+AND ra.source_id=a.id AND ra.account_id=ro.account_id AND ra.reason=ro.reason/,
      );
      assert.match(sql, /a.cost_rule_id=r.id/);
      assert.match(sql, /g\.manager_id=\? AND g\.can_read=1 AND r\.status='pending_approval'/);
      assert.match(sql, /manager_user.id=g.manager_id AND manager_user.status='active'/);
      assert.match(
        sql,
        /signed\.cost_rule_id=r\.id AND \(signed\.approval_role='selection_manager' OR signed\.actor_id=g\.manager_id\)/,
      );
      assert.match(sql, /WHERE ro\.account_id=\? OR g\.manager_id IS NOT NULL/);
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      assert.deepEqual(args, [args[0], args[0], args[0]]);
      return [
        [
          {
            id: `rule-${args[0]}`,
            approvals: args[0] === "primary" ? "selection_manager,primary_account" : "",
            fee_lines_json: [],
            effective_from: "2026-01-01",
            updated_at: new Date("2026-01-01T00:00:00Z"),
            owned_by_session: args[0] === "primary" ? 1 : 0,
            can_decide_as_manager: args[0] === "primary" ? 0 : 1,
          },
        ],
      ];
    },
  };
  const app = buildApp({
    profit: {
      accountReadRehearsal: true,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
      service: new ProfitService(new MySqlProfitRepository(pool)),
      auth: {
        async authenticate(id) {
          return {
            user: {
              id,
              email_normalized: id === "primary" ? "2313645627@qq.com" : "alice@example.invalid",
              email_verified_at: new Date(),
            },
            session: { id: "s" },
          };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy scope called");
        },
      },
    },
  });
  try {
    for (const id of ["alice", "primary"]) {
      const response = await app.inject({
        url: "/api/v1/cost-rules?account_id=primary",
        headers: { cookie: `scoutops_session=${id}` },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().data[0].id, `rule-${id}`);
      assert.deepEqual(
        response.json().data[0].approvals,
        id === "primary" ? ["selection_manager", "primary_account"] : [],
      );
      assert.equal(response.json().meta.is_primary_approver, id === "primary");
      assert.equal(response.json().data[0].owned_by_session, id === "primary");
      assert.equal(response.json().data[0].can_decide_as_manager, id === "alice");
    }
    boundPrimary = false;
    const stale = await app.inject({
      url: "/api/v1/cost-rules",
      headers: { cookie: "scoutops_session=primary" },
    });
    assert.equal(stale.statusCode, 200, stale.body);
    assert.equal(stale.json().meta.is_primary_approver, false);
    assert.equal(stale.json().data[0].owned_by_session, true);
  } finally {
    await app.close();
  }
});
