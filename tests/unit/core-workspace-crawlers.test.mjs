import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BUILTIN_PROVIDER_SOURCES,
  parseAmazonProductPage,
  parseEc21SupplierSearchPage,
  parseMadeInChinaSearchPage,
} from "../../packages/provider-sources/dist/index.js";

test("core workspace public crawlers are enabled without official API credentials", () => {
  const amazon = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "amazon_product");
  const supplier = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "made_in_china_search");
  assert.equal(amazon?.access_mode, "public_page");
  assert.equal(supplier?.access_mode, "public_page");
  assert.equal(supplier?.availability, "manual");
  assert.equal(BUILTIN_PROVIDER_SOURCES.find((item)=>item.code==="ec21_supplier_search")?.access_mode,"public_page");
});

test("EC21 fallback parser preserves supplier price MOQ and product URL",()=>{const html=`<html><body><li class="galleryLs positionR"><div class="front"><h2 class="pdtName"><a href="https://www.ec21.com/product-details/Foldable-Storage-Box--123.html">Foldable <strong>Storage</strong> Box</a></h2><img src="https://image.ec21.com/box.jpg" itemprop="image"><ol><li itemprop="offers"><span itemprop="priceCurrency" content="USD">US$</span><span itemprop="price">3.5</span></li><li><span class="pr5">3000</span><span class="pr5">Set</span>(Min. Order)</li><li class="pdtCompany"><a title="Ningbo Storage Co., Ltd.">Ningbo Storage Co., Ltd.</a></li></ol></div></li></body></html>`;const[record]=parseEc21SupplierSearchPage(html,"https://www.ec21.com/ec-market/storage-box.html",5);assert.equal(record.payload.fields.supplier_name,"Ningbo Storage Co., Ltd.");assert.equal(record.payload.fields.price,3.5);assert.equal(record.payload.fields.moq,3000);assert.match(record.payload.canonical_url,/ec21\.com\/product-details/);});

test("Amazon product parser preserves real listing metrics and evidence URL", () => {
  const html = `<html><body><div data-component-type="s-search-result" data-asin="B0ABCDEF12"><h2><a href="/dp/B0ABCDEF12"><span>Foldable Storage Box</span></a></h2><span class="a-price"><span class="a-offscreen">$29.99</span></span><span aria-label="4.6 out of 5 stars"></span><span aria-label="1,234 ratings"></span><img class="s-image" src="https://images.example/box.jpg"></div></body></html>`;
  const [record] = parseAmazonProductPage(html, "https://www.amazon.com/s?k=storage+box", 5);
  assert.equal(record.externalId, "B0ABCDEF12");
  assert.equal(record.payload.fields.price, 29.99);
  assert.equal(record.payload.fields.rating_value, 4.6);
  assert.equal(record.payload.fields.review_count, 1234);
  assert.equal(record.payload.canonical_url, "https://www.amazon.com/dp/B0ABCDEF12");
});

test("public supplier parser keeps missing MOQ truthful instead of inventing a value", () => {
  const product = { "@context": "https://schema.org", "@type": "Product", name: "Plastic Storage Box", image: "https://images.example/supplier-box.jpg", offers: { "@type": "AggregateOffer", lowPrice: "3.20", priceCurrency: "USD", seller: { "@type": "Organization", name: "Guangdong Box Factory" } } };
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(product)}</script></head><body><a href="https://box-factory.en.made-in-china.com/product/abc123.html">product</a></body></html>`;
  const [record] = parseMadeInChinaSearchPage(html, "https://www.made-in-china.com/products-search/hot-china-products/Storage_Box.html", 5);
  assert.equal(record.payload.fields.supplier_name, "Guangdong Box Factory");
  assert.equal(record.payload.fields.price, 3.2);
  assert.equal(record.payload.fields.moq, null);
  assert.match(record.payload.canonical_url, /made-in-china\.com\/product\//);
});

test("core workspace migration is MySQL 5.7 compatible and keeps crawler projections auditable", async () => {
  const [up, down, enable] = await Promise.all([readFile("database/migrations/0044e_core_collection_projection.up.sql", "utf8"), readFile("database/migrations/0044e_core_collection_projection.down.sql", "utf8"),readFile("database/migrations/0044f_enable_amazon_public_crawler.up.sql","utf8")]);
  assert.match(up, /core_collection_projection_runs/);
  assert.match(enable, /amazon_product/);
  assert.match(down, /DROP TABLE IF EXISTS `core_collection_projection_runs`/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|JSON_TABLE|WITH\s+RECURSIVE/i);
});

test("core list pages expose explicit detail and operational actions", async () => {
  const [tasks, opportunities, competitors, sourcing] = await Promise.all(["TaskWorkspace.vue", "OpportunityWorkspace.vue", "CompetitorMonitor.vue", "SourcingWorkspace.vue"].map((name) => readFile(`apps/web/src/components/${name}`, "utf8")));
  assert.match(tasks, /查看详情.*删除/s);
  assert.match(opportunities, /采集 Amazon 竞品.*采集公开供应商/s);
  assert.match(competitors, /立即采集.*采集快照.*删除竞品监控/s);
  assert.match(sourcing, /重新采集.*供应商报价对比历史.*删除找货记录/s);
});

test("opportunity summaries reuse crawled Amazon images and real downstream counts", async () => {
  const repository = await readFile("apps/api/src/mysql-opportunity-repository.ts", "utf8");
  assert.match(repository, /RIGHT\(s\.source_ref_id,36\)/);
  assert.match(repository, /JSON_EXTRACT\(n\.payload_json,'\$\.image_url'\)/);
  assert.match(repository, /competitor_count/);
  assert.match(repository, /supplier_candidate_count/);
});
