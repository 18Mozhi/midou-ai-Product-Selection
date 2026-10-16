import test from "node:test";
import assert from "node:assert/strict";
import { MySqlSourcingRepository } from "../../apps/api/dist/mysql-sourcing-repository.js";

const now = "2026-10-17T00:00:00Z";
const candidate = {
  id: "candidate-1",
  supplier_name: "Supplier",
  product_title: "Product",
  quoted_price: 3.8,
  currency: "CNY",
  observed_at: now,
  raw_evidence_id: "evidence-1",
  missing_fields_json: "[]",
};

test("candidate detail preserves the actual source price condition without exposing its payload", async () => {
  const calls = [];
  const repository = new MySqlSourcingRepository({
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT s.*"))
        return [
          [
            {
              id: "search-1",
              input_type: "image",
              input_ref: "image",
              missing_fields_json: "[]",
              created_at: now,
              updated_at: now,
              collection_task_id: "task-1",
            },
          ],
        ];
      if (sql.startsWith("SELECT c.*"))
        return [
          [
            {
              ...candidate,
              source_offer_payload: JSON.stringify({
                price_description: "新人价",
                private_field: "hidden",
              }),
            },
          ],
        ];
      if (sql.startsWith("SELECT t.status")) return [[]];
      throw new Error("unexpected query");
    },
  });
  const result = await repository.detail({
    searchId: "search-1",
    organizationId: "org-1",
    workspaceId: "ws-1",
  });
  assert.equal(result.candidates[0].source_price_description, "新人价");
  assert.equal(result.candidates[0].quoted_price, 3.8);
  assert.equal(JSON.stringify(result).includes("private_field"), false);
  const query = calls.find((call) => call.sql.startsWith("SELECT c.*"));
  assert.deepEqual(query.values, ["search-1", "org-1", "ws-1"]);
  for (const binding of [
    "id=c.normalized_record_id",
    "raw_evidence_id=c.raw_evidence_id",
    "provider_id=c.provider_id",
    "organization_id=c.organization_id",
    "workspace_id=c.workspace_id",
  ])
    assert.ok(query.sql.includes(`n_offer.${binding}`));
  assert.match(query.sql, /n_offer.status='active'/);
  assert.match(query.sql, /p_offer.code='1688_search'/);
});

test("missing and non-string price descriptions remain unknown", () => {
  const repository = new MySqlSourcingRepository({});
  for (const source of [
    null,
    "null",
    "{}",
    { price_description: 0 },
    { fields: { price_description: null } },
  ])
    assert.equal(
      repository.candidate({ ...candidate, source_offer_payload: source }).source_price_description,
      null,
    );
});

test("nested normalized fields retain bounded price text and leave confirmed numeric quotes intact", () => {
  const repository = new MySqlSourcingRepository({});
  const result = repository.candidate({
    ...candidate,
    quote_price: 7.2,
    source_offer_payload: { fields: { price_description: " 新人价 " } },
  });
  assert.equal(result.source_price_description, "新人价");
  assert.equal(result.quoted_price, 7.2);
  assert.equal(
    repository.candidate({
      ...candidate,
      source_offer_payload: { price_description: "a".repeat(500) },
    }).source_price_description.length,
    200,
  );
});
