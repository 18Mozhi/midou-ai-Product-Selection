import assert from "node:assert/strict";
import test from "node:test";
import { FixedSyndicationFeedAdapter } from "../../packages/provider-sources/dist/index.js";

const target = "https://techcrunch.com/feed/";
const rss = `<rss><channel><item><guid>rss-health-policy-example</guid><title>Portable fan</title><link>https://techcrunch.com/example</link><description>Product launch</description><pubDate>Sun, 18 Oct 2026 02:00:00 GMT</pubDate></item></channel></rss>`;
const context = {
  provider: { targetUrl: target, timeoutMs: 1000 },
  requestId: "rss-health",
  traceId: "rss-health",
};

test("public RSS health cannot declare a robots-denied feed ready", async () => {
  const calls = [];
  const adapter = new FixedSyndicationFeedAdapter(
    "feed_techcrunch",
    target,
    "TechCrunch",
    async (url) => {
      calls.push(String(url));
      return new Response(
        String(url).endsWith("robots.txt") ? "User-agent: *\nDisallow: /feed/" : rss,
      );
    },
  );
  await assert.rejects(
    adapter.healthCheck(context, AbortSignal.timeout(1000)),
    (error) => error.code === "robots_disallowed",
  );
  assert.deepEqual(calls, ["https://techcrunch.com/robots.txt"]);
});

test("public RSS health validates its target before any policy or feed request", async () => {
  let calls = 0;
  const adapter = new FixedSyndicationFeedAdapter(
    "feed_techcrunch",
    target,
    "TechCrunch",
    async () => {
      calls++;
      return new Response(rss);
    },
  );
  await assert.rejects(
    adapter.healthCheck(
      { ...context, provider: { targetUrl: "https://example.test/foreign" } },
      AbortSignal.timeout(1000),
    ),
    (error) => error.code === "source_configuration_invalid",
  );
  assert.equal(calls, 0);
});

test("public RSS health reaches the real parser only after an allowed robots result", async () => {
  const url = "https://feeds.bbci.co.uk/news/business/rss.xml",
    calls = [];
  const adapter = new FixedSyndicationFeedAdapter(
    "feed_bbc_business",
    url,
    "BBC",
    async (requested) => {
      calls.push(String(requested));
      return new Response(
        String(requested).endsWith("robots.txt") ? "User-agent: *\nAllow: /news/" : rss,
      );
    },
  );
  assert.equal(
    (
      await adapter.healthCheck(
        { ...context, provider: { targetUrl: url, timeoutMs: 1000 } },
        AbortSignal.timeout(1000),
      )
    ).status,
    "ready",
  );
  assert.deepEqual(calls, ["https://feeds.bbci.co.uk/robots.txt", url]);
});

test("public RSS health keeps policy network failure blocked from feed retrieval", async () => {
  let calls = 0;
  const url = "https://www.wired.com/feed/rss";
  const adapter = new FixedSyndicationFeedAdapter("feed_wired", url, "WIRED", async () => {
    calls++;
    throw new Error("network unavailable");
  });
  await assert.rejects(
    adapter.healthCheck(
      { ...context, provider: { targetUrl: url, timeoutMs: 1000 } },
      AbortSignal.timeout(1000),
    ),
    (error) => error.code === "network_error",
  );
  assert.equal(calls, 1);
});
