import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlProfitRepository } from "../../apps/api/dist/mysql-profit-repository.js";
import { ProfitService } from "../../apps/api/dist/profit-service.js";

const id = "00000000-0000-4000-8000-000000000123";
const date = new Date("2026-01-01T00:00:00Z");

test("account profit analysis keeps historic review identity but grants no review action", async () => {
  const queries = [];
  let invalidSealedOwner = true;
  const pool = {
    async query(sql, params) {
      queries.push(sql);
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      if (sql.includes("SELECT slot FROM account_ownership_cutover"))
        return [[{ slot: "current" }]];
      assert.match(sql, /cut\.contract_version=25/);
      assert.match(
        sql,
        /reason='exclusive_owner' OR \([a-z]+\.reason IN \('shared','unassigned'\) AND [a-z]+\.account_id=cut\.primary_account_id/,
      );
      if (sql.includes("FROM opportunities o")) {
        assert.match(sql, /ao.source_table='opportunities'/);
        assert.equal(params[0], id);
        return [params[1] === "primary" && !invalidSealedOwner ? [{ id }] : []];
      }
      if (sql.includes("FROM opportunity_cost_inputs WHERE")) {
        assert.deepEqual(params, [id, "primary"]);
        assert.match(sql, /ra.source_table='opportunity_cost_inputs'/);
        return [
          [{ amount_value: 19, currency: "CNY", evidence_id: "owned-evidence", observed_at: date }],
        ];
      }
      if (sql.includes("FROM opportunity_profit_runs")) {
        assert.deepEqual(params, [id, "primary"]);
        assert.match(sql, /ra.source_table='opportunity_profit_runs'/);
        return [[{ id: "owned-run", missing_fields_json: [], calculated_at: date }]];
      }
      if (sql.includes("opportunity_cost_input_reviews r JOIN")) {
        assert.deepEqual(params, [id, "primary", "primary"]);
        assert.match(sql, /ra.source_table='opportunity_cost_input_reviews'/);
        assert.match(sql, /ra.source_table='opportunity_cost_inputs'/);
        assert.match(sql, /i.opportunity_id=r.opportunity_id/);
        return [
          [
            {
              id: "owned-review",
              reviewer_id: "primary",
              submitter_id: "original-submitter",
              status: "pending",
              observed_at: date,
              due_at: date,
              created_at: date,
            },
          ],
        ];
      }
      assert.match(sql, /FROM opportunity_profit_components/);
      assert.match(
        sql,
        /ra.source_table='opportunity_profit_components' AND ra.source_id=opportunity_profit_components.id/,
      );
      assert.deepEqual(params, ["owned-run", "primary"]);
      return [[{ component_type: "purchase_price", source_amount: 19 }]];
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
          return { user: { id, email_verified_at: date }, session: { id: "s" } };
        },
      },
      authorization: {
        async resolveSession() {
          assert.fail("legacy scope called");
        },
      },
    },
  });
  const get = (actor) =>
    app.inject({
      url: `/api/v1/opportunities/${id}/profit-analysis?account_id=primary`,
      headers: { cookie: `scoutops_session=${actor}` },
    });
  try {
    const denied = await get("alice");
    assert.equal(denied.statusCode, 404, denied.body);
    assert.equal(queries.length, 2);
    const misassigned = await get("primary");
    assert.equal(misassigned.statusCode, 404, misassigned.body);
    assert.equal(queries.length, 4);
    invalidSealedOwner = false;
    const allowed = await get("primary");
    assert.equal(allowed.statusCode, 200, allowed.body);
    assert.equal(allowed.headers["cache-control"], "private, no-store");
    const { latest_run, current_inputs, cost_input_reviews } = allowed.json().data;
    assert.equal(latest_run.components[0].source_amount, 19);
    assert.equal(current_inputs[0].evidence_id, "owned-evidence");
    assert.equal(cost_input_reviews[0].submitter_id, "original-submitter");
    assert.equal(cost_input_reviews[0].can_review, false);
  } finally {
    await app.close();
  }
});
