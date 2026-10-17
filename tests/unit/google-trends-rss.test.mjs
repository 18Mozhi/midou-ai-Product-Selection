import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILTIN_PROVIDER_SOURCES,
  createBuiltinSourceAdapters,
  parseSyndicationFeed,
  sourceEvidencePayload,
} from "../../packages/provider-sources/dist/index.js";

// Synthetic values; shared link, missing guid and ht:news_item are from the real RSS shape.
const item = (title, date = "Sat, 17 Oct 2026 13:50:00 -0700") =>
  `<item><title>${title}</title><description/><link>https://trends.google.com/trending/rss?geo=US</link>` +
  `${date ? `<pubDate>${date}</pubDate>` : ""}<ht:approx_traffic>5000+</ht:approx_traffic>` +
  `<ht:news_item><ht:news_item_title>News about ${title}</ht:news_item_title>` +
  `<ht:news_item_url>https://example.test/news</ht:news_item_url></ht:news_item></item>`;
const feed = (...items) =>
  `<rss xmlns:ht="https://trends.google.com/trending/rss"><channel>${items.join("")}</channel></rss>`;
const source = BUILTIN_PROVIDER_SOURCES.find((s) => s.code === "feed_google_trends_us");
const provider = {
  id: "00000000-0000-4000-8000-000000000001",
  code: source.code,
  accessMode: source.access_mode,
  targetUrl: source.target_url,
  parserVersion: source.parser_version,
  timeoutMs: source.timeout_ms,
  fields: source.fields,
};
function adapterFor(xml) {
  return createBuiltinSourceAdapters(async () => new Response(xml)).find(
    (a) => a.key === source.code,
  );
}
const collect = (xml) =>
  adapterFor(xml).collect(
    { provider, requestId: "test", traceId: "test", limit: 20, cursor: null },
    new AbortController().signal,
  );

test("shared Trends links preserve separate terms and retain original news context", async () => {
  const { records } = await collect(feed(item("portable fan"), item("solar lantern")));
  assert.equal(records.length, 2);
  assert.equal(new Set(records.map((r) => r.externalId)).size, 2);
  const payload = sourceEvidencePayload(records[0]);
  assert.equal(payload.fields.summary, "News about portable fan");
  assert.match(payload.source_paths.summary, /ht:news_item_title/);
  assert.equal(payload.fields.publisher, source.name);
  assert.equal(payload.fields.price, undefined);
  assert.equal(payload.fields.ad_spend, undefined);
});

test("Trends identity is independent of feed ordering and observation time", async () => {
  const before = Date.now();
  const a = await collect(feed(item("portable fan"), item("solar lantern")));
  const b = await collect(feed(item("solar lantern"), item("portable fan")));
  assert.equal(a.records[0].externalId, b.records[1].externalId);
  assert.notEqual(a.records[0].externalId, a.records[1].externalId);
  assert.ok(Date.parse(a.records[0].observedAt) >= before);
  assert.ok(Date.parse(a.records[0].observedAt) <= Date.now());
});

test("content revisions retain the term key and later trend starts get a different key", async () => {
  const original = await collect(feed(item("portable fan")));
  const revised = await collect(
    feed(item("portable fan").replace("News about", "Updated news about")),
  );
  const later = await collect(feed(item("portable fan", "Sun, 18 Oct 2026 13:50:00 -0700")));
  const duplicate = await collect(feed(item("portable fan"), item("portable fan")));
  assert.equal(original.records[0].externalId, revised.records[0].externalId);
  assert.notEqual(original.records[0].externalId, later.records[0].externalId);
  assert.equal(duplicate.records.length, 1);
});

test("every registered Trends country uses the dedicated parser and adapter", () => {
  const sources = BUILTIN_PROVIDER_SOURCES.filter((s) => s.code.startsWith("feed_google_trends_"));
  const adapters = createBuiltinSourceAdapters(
    async () => new Response(feed(item("portable fan"))),
  );
  assert.equal(sources.length, 10);
  for (const s of sources) {
    assert.equal(s.parser_version, "google-trends-rss-v1");
    assert.equal(adapters.find((a) => a.key === s.code).version, "google-trends-rss-adapter-v1");
  }
});

test("missing published time anywhere in the sampled feed fails the Trends health check", async () => {
  await assert.rejects(
    () =>
      adapterFor(feed(item("portable fan"), item("solar lantern", ""))).healthCheck(
        { provider, requestId: "test", traceId: "test" },
        new AbortController().signal,
      ),
    { code: "source_changed" },
  );
});

test("Trends has a dedicated version while ordinary RSS identity remains unchanged", () => {
  assert.equal(source.parser_version, "google-trends-rss-v1");
  assert.equal(adapterFor(feed(item("portable fan"))).version, "google-trends-rss-adapter-v1");
  const ordinary = parseSyndicationFeed(
    "<rss><channel><item><title>News</title><guid>stable</guid><link>https://example.test/news</link><pubDate>Sat, 17 Oct 2026 20:50:00 GMT</pubDate></item></channel></rss>",
    "News",
  );
  assert.equal(ordinary.length, 1);
  assert.equal(ordinary[0].evidenceRef.startsWith("syndication-feed:"), true);
});
