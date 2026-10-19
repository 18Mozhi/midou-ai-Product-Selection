import test from "node:test";
import assert from "node:assert/strict";
import { readOpportunityPurchasePrices } from "../../apps/api/dist/opportunity-purchase-price.js";

test("empty catalogue does not scan cost inputs", async () => {
  const result = await readOpportunityPurchasePrices(
    { query: async () => assert.fail("empty page must not query") },
    { organizationId: "org", workspaceId: "ws" },
    [],
  );
  assert.equal(result.size, 0);
});

test("a page reads only current automatic evidence-backed 1688 purchase inputs in one scoped query", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [
        [
          {
            opportunity_id: "one",
            id: "selected",
            amount_value: "8.800000",
            currency: "CNY",
            observed_at: new Date("2026-08-08T12:00:00Z"),
            evidence_id: "evidence",
            source_ref_id: "1688:123:p75:5",
          },
          { opportunity_id: "one", id: "older", amount_value: 99, observed_at: new Date() },
        ],
      ];
    },
  };
  const result = await readOpportunityPurchasePrices(
    pool,
    { organizationId: "org", workspaceId: "ws" },
    ["one", "two"],
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ["org", "ws", "one", "two"]);
  const joinedProof = calls[0].sql.split("AND EXISTS (")[1].split("WHERE")[0];
  assert.doesNotMatch(
    joinedProof,
    /\bci\./,
    "MySQL 5.7 outer references belong in subquery WHERE, not JOIN ON",
  );
  for (const proof of [
    "ci.platform='amazon'",
    "ci.input_type='purchase_price'",
    "ci.is_current=1",
    "ci.confirmation_mode='automatic_evidence'",
    "ci.amount_value>0",
    "ci.currency='CNY'",
    "p.code='1688_search'",
    "n.status='active'",
    "ss.input_ref=ci.opportunity_id",
    "ss.deleted_at IS NULL",
    "l.raw_evidence_id=n.raw_evidence_id",
    "n.organization_id=ci.organization_id",
    "n.workspace_id=ci.workspace_id",
  ])
    assert.ok(calls[0].sql.includes(proof), proof);
  assert.deepEqual(result.get("one"), {
    id: "selected",
    amount_value: 8.8,
    currency: "CNY",
    observed_at: "2026-08-08T12:00:00.000Z",
    evidence_id: "evidence",
    source_ref_id: "1688:123:p75:5",
  });
  assert.equal(
    result.has("two"),
    false,
    "missing procurement is unknown, never a minimum candidate price",
  );
});
