import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile("apps/web/src/components/opportunity-catalogue-facts.ts", "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const facts = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("shared catalogue facts preserve actual prices, observed lower bounds and missing values", () => {
  const item = {
    primary_product: {
      price: 19.95,
      currency: "USD",
      rating_value: 4.3,
      review_count: 125,
      public_signals: {
        sales_badge: { period: "past_month", quantity_lower_bound: 100 },
        best_seller_rank: { rank: 42 },
      },
    },
    automatic_purchase_price: { amount_value: 3.25, observed_at: "2026-10-20T00:00:00Z" },
  };
  const result = Object.fromEntries(
    facts.catalogueProductFacts(item).map((x) => [x.label, x.value]),
  );
  assert.equal(result.售价, "USD 19.95");
  assert.equal(result["1688进货价"], "CNY 3.25");
  assert.equal(result.购买提示, "近月 ≥ 100");
  assert.equal(result.类目排名, "#42");
  assert.equal(result["评分 / 评价"], "4.3 / 125 条");
  assert.equal(
    result.采价时间,
    facts.catalogueFreshness(item.automatic_purchase_price.observed_at),
  );
  const missing = Object.fromEntries(
    facts.catalogueProductFacts({}).map((x) => [x.label, x.value]),
  );
  assert.equal(missing.售价, "未采集");
  assert.equal(missing["1688进货价"], "未取得");
  assert.equal(missing.购买提示, "未采集");
  assert.equal(missing.采价时间, "未取得");
});
test("explicit observed zero is distinct from missing and original source labels remain unchanged", () => {
  const result = facts.catalogueProductFacts({
    primary_product: { price: 0, currency: "USD", rating_value: 0, review_count: 0 },
  });
  assert.equal(result[0].value, "USD 0.00");
  assert.equal(result[2].value, "0.0 / 0 条");
  assert.equal(facts.catalogueSourceLabel({ source_type: "trend_topic" }), "情报发现");
  assert.equal(facts.catalogueSourceLabel({ source_type: "manual" }), "手工添加");
});
