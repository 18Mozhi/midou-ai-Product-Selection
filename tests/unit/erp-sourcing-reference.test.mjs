import assert from "node:assert/strict";
import test from "node:test";
import { loadErpSourcingReference } from "../../apps/api/dist/erp-sourcing-reference.js";

test("ERP sourcing reference exposes only confirmed catalog facts", async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return [[{
        normalized_record_id: "record-1",
        evidence_id: "evidence-1",
        captured_at: new Date("2026-08-19T02:00:00.000Z"),
        payload_json: JSON.stringify({
          title: "ERP 商品 A",
          image_url: "https://img.example.com/a.jpg",
          supplier_code: "SUP-001",
          cost_cny: 18.5,
          cost_usd: null,
          source_url: "https://medou.medouai.com/#/ProductList",
          observed_at: "2026-08-19T01:30:00.000Z",
        }),
      }], []];
    },
  };
  const result = await loadErpSourcingReference(pool, {
    organizationId: "org-1",
    workspaceId: "workspace-1",
    opportunityId: "opportunity-1",
  });
  assert.deepEqual(result, {
    normalized_record_id: "record-1",
    evidence_id: "evidence-1",
    title: "ERP 商品 A",
    image_url: "https://img.example.com/a.jpg",
    supplier_code: "SUP-001",
    cost_cny: 18.5,
    cost_usd: null,
    source_url: "https://medou.medouai.com/#/ProductList",
    observed_at: "2026-08-19T01:30:00.000Z",
  });
  assert.match(calls[0].sql, /p\.code='erp_product_catalog'/);
  assert.deepEqual(calls[0].values, [
    "opportunity-1",
    "org-1",
    "workspace-1",
  ]);
});

test("ERP sourcing reference rejects malformed payload URLs instead of inventing a lead", async () => {
  const pool = {
    async query() {
      return [[{
        normalized_record_id: "record-1",
        evidence_id: "evidence-1",
        captured_at: new Date("2026-08-19T02:00:00.000Z"),
        payload_json: JSON.stringify({
          title: "ERP 商品 A",
          source_url: "javascript:bad",
        }),
      }], []];
    },
  };
  assert.equal(
    await loadErpSourcingReference(pool, {
      organizationId: "org-1",
      workspaceId: "workspace-1",
      opportunityId: "opportunity-1",
    }),
    null,
  );
});
