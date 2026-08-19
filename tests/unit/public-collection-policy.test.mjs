import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPublicCollectionPolicy,
  robotsAllows,
} from "../../packages/provider-sources/dist/index.js";

test("robots policy uses the most specific matching allow or disallow rule", () => {
  const robots = [
    "User-agent: *",
    "Disallow: /private/",
    "User-agent: ScoutOpsPublicCrawler",
    "Disallow: /catalog/",
    "Allow: /catalog/public/",
  ].join("\n");
  assert.equal(robotsAllows(robots, "https://example.test/private/item"), true);
  assert.equal(robotsAllows(robots, "https://example.test/catalog/secret"), false);
  assert.equal(robotsAllows(robots, "https://example.test/catalog/public/item"), true);
});

test("public collection preflight blocks a robots-disallowed target before collection", async () => {
  const calls = [];
  await assert.rejects(
    () =>
      assertPublicCollectionPolicy({
        providerTargetUrl: "https://example.test/catalog/private",
        fetcher: async (url) => {
          calls.push(url);
          return new Response("User-agent: *\nDisallow: /catalog/", { status: 200 });
        },
        timeoutMs: 1000,
        cacheTtlMs: 0,
      }),
    (error) => error?.name === "ProviderAdapterFailure" && error.code === "robots_disallowed",
  );
  assert.deepEqual(calls, ["https://example.test/robots.txt"]);
});

test("public collection preflight treats a missing robots file as allowed", async () => {
  await assert.doesNotReject(() =>
    assertPublicCollectionPolicy({
      providerTargetUrl: "https://example.test/catalog/public",
      fetcher: async () => new Response("", { status: 404 }),
      timeoutMs: 1000,
      cacheTtlMs: 0,
    }),
  );
});

test("public collection preflight keeps robots throttling distinct from prohibition", async () => {
  await assert.rejects(
    () =>
      assertPublicCollectionPolicy({
        providerTargetUrl: "https://example.test/catalog/public",
        fetcher: async () => new Response("", { status: 429 }),
        timeoutMs: 1000,
        cacheTtlMs: 0,
      }),
    (error) =>
      error?.name === "ProviderAdapterFailure" &&
      error.code === "rate_limited" &&
      error.retryable === true,
  );
});
