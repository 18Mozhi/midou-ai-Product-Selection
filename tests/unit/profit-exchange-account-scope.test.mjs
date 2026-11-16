import assert from "node:assert/strict";
import test from "node:test";
import { findProfitExchangeQuote } from "../../apps/worker/dist/opportunity-profit-worker.js";
import { exchangeRateQuoteScopeRelation, opportunityEventProbeScope, scoreRuleScopeRelation } from "../../scripts/lib/opportunity-event-scope.mjs";

test("account profit uses owned FX quotes without legacy scope; unowned jobs cannot consume them", async () => {
  const scope = { organizationId: "legacy-org", workspaceId: "legacy-workspace" };
  const date = "2026-10-15";
  for (const [sealed, account] of [[true, "primary"], [true, undefined], [false, undefined]]) {
    const row = { id: "original-rate", rate_value: "1.250000" };
    const connection = { async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS")) return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
      assert.match(sql, /p\.status='enabled'/);
      assert.match(sql, /q\.quote_date<=\? ORDER BY|q\.quote_date<=\? AND/);
      assert.match(sql, /ORDER BY q\.quote_date DESC,q\.observed_at DESC LIMIT 1$/);
      if (account) {
        assert.doesNotMatch(sql, /organization_id|workspace_id|NOT EXISTS/);
        assert.match(sql, /ao\.source_table='exchange_rate_quotes' AND ao\.source_id=q\.id AND ao\.account_id=\?/);
        assert.match(sql, /eo\.source_id=e\.id WHERE eo\.account_id=ao\.account_id/);
        assert.match(sql, /e\.id=q\.evidence_id AND e\.provider_id=q\.provider_id/);
        assert.deepEqual(args, ["EUR", "USD", date, account]);
        return [[row]];
      }
      assert.match(sql, /q\.organization_id=\? AND q\.workspace_id=\?/);
      if (sealed) assert.match(sql, /NOT EXISTS.*ao\.source_id=q\.id/);
      else assert.doesNotMatch(sql, /account_owned_records/);
      assert.deepEqual(args, ["legacy-org", "legacy-workspace", "EUR", "USD", date]);
      return [[]];
    }};
    assert.equal(await findProfitExchangeQuote(connection, scope, "EUR", "USD", date, sealed, account),
      account ? row : undefined);
  }
});

test("retired FX storage does not let a legacy job fall back to another account's quote", async () => {
  const scope = { organizationId: "legacy-org", workspaceId: "legacy-workspace" };
  const query = async sql => {
    assert.match(sql, /^SHOW COLUMNS FROM exchange_rate_quotes/);
    return [[]];
  };
  assert.equal(await findProfitExchangeQuote({ query }, scope, "EUR", "USD", "2026-10-15", true), undefined);
  await assert.rejects(findProfitExchangeQuote({ async query() {
    return [[{ Field: "organization_id" }]];
  } }, scope, "EUR", "USD", "2026-10-15", true), /partial_inherited_scope_schema:exchange_rate_quotes/);
});

test("retirement probes read original FX coordinates only as historical provenance", async () => {
  const connection = { async query(sql) {
    if (sql.startsWith("SHOW COLUMNS FROM opportunity_events")) return [[]];
    if (sql.startsWith("SHOW COLUMNS FROM score_rules")) return [[{ Field: "historical_context" }, { Field: "account_id" }]];
    if (sql.startsWith("SHOW COLUMNS FROM cost_rules")) return [[{ Field: "historical_context" }, { Field: "account_id" }]];
    assert.match(sql, /^SHOW COLUMNS FROM exchange_rate_quotes/);
    return [[{ Field: "historical_context" }]];
  } };
  const { relation, cleanup } = await opportunityEventProbeScope(connection);
  for (const sql of [relation, cleanup]) {
    assert.match(sql, /JSON_EXTRACT\(q.historical_context,'\$.organization_id'\)/);
    assert.match(sql, /BINARY ev.resource_type='exchange_rate' AND x.id=ev.resource_id/);
    assert.match(sql, /SELECT score_rules\.\*,CAST\(JSON_UNQUOTE\(JSON_EXTRACT\(historical_context,'\$\.organization_id'\)\)/);
    assert.match(sql, /BINARY ev.resource_type='score_rule' AND s.id=ev.resource_id/);
    assert.match(sql, /BINARY ev.resource_type='cost_rule' AND c.id=ev.resource_id/);
  }
  await assert.rejects(exchangeRateQuoteScopeRelation({ async query() {
    return [[{ Field: "historical_context" }, { Field: "workspace_id" }]];
  } }), /partial_inherited_scope_schema:exchange_rate_quotes/);
  await assert.rejects(scoreRuleScopeRelation({ async query() {
    return [[{ Field: "historical_context" }, { Field: "workspace_id" }]];
  } }), /partial_inherited_scope_schema:score_rules/);
});
