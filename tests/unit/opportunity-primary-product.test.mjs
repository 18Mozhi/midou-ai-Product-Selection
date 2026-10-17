import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  readOpportunityPrimaryProduct,
  opportunityPrimaryRecordsSql,
} from "../../apps/api/dist/opportunity-primary-product.js";
import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";
const at = "2026-10-17T00:00:00.000000Z";

test("local SQL DATETIME facts become UTC once, including seasonal offsets", () => {
  assert.doesNotMatch(opportunityPrimaryRecordsSql, /%fZ/);
  const module = new URL("../../apps/api/dist/opportunity-primary-product.js", import.meta.url)
    .href;
  const code = `import {readOpportunityPrimaryProduct} from ${JSON.stringify(module)};console.log(JSON.stringify(['2026-10-17T18:38:13.720000','2026-01-17T18:38:13.720000'].map(captured_at=>readOpportunityPrimaryProduct({captured_at},null).facts.captured_at)));`;
  const values = JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", code], {
      encoding: "utf8",
      env: { ...process.env, TZ: "America/New_York" },
    }),
  );
  assert.deepEqual(values, ["2026-10-17T22:38:13.720Z", "2026-01-17T23:38:13.720Z"]);
});
const record = (extra = {}) => ({
  captured_at: at,
  price: 29,
  currency: "USD",
  rating_value: 4.7,
  review_count: 1200,
  image_url: "https://m.media-amazon.com/images/I/product.jpg",
  sales_badge_text: "100+ bought in past month",
  sales_badge_quantity_lower_bound: 100,
  sales_badge_period: "past_month",
  best_seller_rank: 123,
  best_seller_rank_text: "#123 in Kitchen",
  sponsored: 1,
  ...extra,
});
test("primary list facts whitelist numeric and public signals without review bodies", () => {
  const r = readOpportunityPrimaryProduct(
    null,
    JSON.stringify(
      record({
        private_ads_spend: 999,
        review_samples_json: JSON.stringify([{ review_id: "x", title: "title", text: "private" }]),
      }),
    ),
  );
  assert.equal(r.facts.price, 29);
  assert.equal(r.facts.public_signals.sales_badge.quantity_lower_bound, 100);
  assert.equal(r.facts.public_signals.sponsored, true);
  assert.equal(r.facts.captured_at, "2026-10-17T00:00:00.000Z");
  assert.equal(r.imageUrl, "https://m.media-amazon.com/images/I/product.jpg");
  assert.equal(JSON.stringify(r).includes("private"), false);
  assert.equal(r.facts.public_signals.review_samples, undefined);
});
test("latest actual capture wins, with detail on ties and no stale field borrowing", () => {
  assert.equal(
    readOpportunityPrimaryProduct(
      record({ price: 35, captured_at: "2026-10-18T00:00:00Z" }),
      record(),
    ).facts.price,
    35,
  );
  assert.equal(
    readOpportunityPrimaryProduct(record({ price: 35 }), record({ price: null })).facts.price,
    null,
  );
  assert.equal(readOpportunityPrimaryProduct(record({ price: 35 }), null).facts.price, 35);
});
test("missing or malformed primary data stays unknown", () => {
  for (const raw of [null, undefined, "broken", [], { captured_at: "invalid" }])
    assert.deepEqual(readOpportunityPrimaryProduct(raw, null), { facts: null, imageUrl: null });
  const f = readOpportunityPrimaryProduct(
    null,
    record({
      price: -1,
      currency: "usd",
      rating_value: 6,
      review_count: 2.5,
      sponsored: 0,
      sales_badge_quantity_lower_bound: 0,
    }),
  ).facts;
  assert.equal(f.price, null);
  assert.equal(f.currency, null);
  assert.equal(f.rating_value, null);
  assert.equal(f.review_count, null);
  assert.equal(f.public_signals.sponsored, null);
  assert.equal(f.public_signals.sales_badge, null);
});
test("only known Amazon image hosts can supply the selected primary image", () => {
  for (const image_url of [
    "http://m.media-amazon.com/x",
    "https://other.example/x",
    "https://user:pass@m.media-amazon.com/x",
    null,
  ])
    assert.equal(readOpportunityPrimaryProduct(null, record({ image_url })).imageUrl, null);
});
test("record SQL binds evidence, snapshots, primary identity and tenants", () => {
  const sql = opportunityPrimaryRecordsSql;
  for (const fragment of [
    "n_seed.organization_id=l.organization_id",
    "n_seed.workspace_id=l.workspace_id",
    "n.organization_id=n_seed.organization_id",
    "n.workspace_id=n_seed.workspace_id",
    "n.provider_id=n_seed.provider_id",
    "n.record_key=n_seed.record_key",
    "n.status='active'",
    "n_seed.status IN ('active','superseded')",
    "l.organization_id=o.organization_id",
    "l.workspace_id=o.workspace_id",
    "s.organization_id=c.organization_id",
    "s.workspace_id=c.workspace_id",
    "n_seed.raw_evidence_id=s.evidence_id",
    "c.organization_id=o.organization_id",
    "c.workspace_id=o.workspace_id",
    "c.deleted_at IS NULL",
    "p.code='amazon_product'",
    "BINARY UPPER(c.external_id)=BINARY",
    "ORDER BY s.captured_at DESC",
  ])
    assert.ok(sql.includes(fragment), fragment);
  assert.doesNotMatch(sql, /review_samples_json|RIGHT\(s.source_ref_id/);
});
test("list repository exposes only selected primary facts and keeps counts", async () => {
  const calls = [];
  const now = new Date(at);
  const pool = {
    query: async (sql, params) => {
      calls.push([sql, params]);
      if (sql.startsWith("SELECT COUNT(*) total")) return [[{ total: 1 }]];
      return [
        [
          {
            id: "item",
            name: "Product",
            market: "US",
            source_type: "trend_topic",
            updated_at: now,
            lifecycle_entered_at: now,
            primary_linked_record: record(),
            primary_detail_record: null,
            competitor_count: 5,
            supplier_candidate_count: 10,
            evidence_count: 3,
            source_count: 1,
            main_asin: "B000000001",
          },
        ],
      ];
    },
  };
  const r = await new MySqlOpportunityRepository(pool).list({
    organizationId: "org",
    workspaceId: "ws",
    actorId: "user",
    page: 1,
    pageSize: 20,
    scope: "all",
  });
  assert.match(calls[1][0], /primary_fact_asin FROM \(SELECT o\.\* FROM opportunities/);
  assert.match(calls[1][0], /LIMIT 18446744073709551615/);
  assert.equal(r.items[0].primary_product.price, 29);
  assert.equal(r.items[0].competitor_count, 5);
  assert.equal(r.items[0].image_url, "https://m.media-amazon.com/images/I/product.jpg");
  assert.equal(r.items[0].primary_linked_record, undefined);
  assert.deepEqual(calls[1][1].slice(0, 2), ["org", "ws"]);
});
