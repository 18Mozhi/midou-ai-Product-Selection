import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPublicCollectionPolicy,
  evaluateRobotsPolicy,
  publicCollectionPolicyDecision,
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
  const decision = evaluateRobotsPolicy(robots, "https://example.test/catalog/public/item");
  assert.equal(decision.matched_user_agent, "ScoutOpsPublicCrawler");
  assert.deepEqual(
    {
      directive: decision.matched_rule.directive,
      pattern_preview: decision.matched_rule.pattern_preview,
    },
    { directive: "allow", pattern_preview: "/catalog/public/" },
  );
  assert.match(decision.matched_rule.pattern_sha256, /^[a-f0-9]{64}$/);
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
    (error) => {
      const decision = publicCollectionPolicyDecision(error);
      return (
        error?.name === "ProviderAdapterFailure" &&
        error.code === "robots_disallowed" &&
        decision?.decision_version === "scoutops-robots-policy-v1" &&
        decision.allowed === false &&
        decision.matched_rule?.directive === "disallow" &&
        decision.matched_rule.pattern_preview === "/catalog/"
      );
    },
  );
  assert.deepEqual(calls, ["https://example.test/robots.txt"]);
});

test("public collection preflight treats a missing robots file as allowed", async () => {
  const decision = await assertPublicCollectionPolicy({
    providerTargetUrl: "https://example.test/catalog/public",
    fetcher: async () => new Response("", { status: 404 }),
    timeoutMs: 1000,
    cacheTtlMs: 0,
  });
  assert.deepEqual(
    {
      allowed: decision.allowed,
      decision_basis: decision.decision_basis,
      robots_http_status: decision.robots_http_status,
      matched_rule: decision.matched_rule,
    },
    {
      allowed: true,
      decision_basis: "missing_robots",
      robots_http_status: 404,
      matched_rule: null,
    },
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

test("robots cache evicts the least recently used origin at its configured capacity", async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    return new Response("User-agent: *\nAllow: /", { status: 200 });
  };
  for (const origin of ["cache-a.test", "cache-b.test", "cache-c.test", "cache-a.test"])
    await assertPublicCollectionPolicy({
      providerTargetUrl: `https://${origin}/catalog`,
      fetcher,
      timeoutMs: 1000,
      cacheTtlMs: 60_000,
      cacheMaxEntries: 2,
      now: () => 123_000,
    });
  assert.deepEqual(calls, [
    "https://cache-a.test/robots.txt",
    "https://cache-b.test/robots.txt",
    "https://cache-c.test/robots.txt",
    "https://cache-a.test/robots.txt",
  ]);
});
