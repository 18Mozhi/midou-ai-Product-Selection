import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { PlaywrightCrawlerEngine } from "../../packages/playwright-crawler/dist/index.js";
import { withDailyAmazonDelivery } from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";
import { createAmazonBrowserExecutionRequest } from "../../packages/provider-sources/dist/index.js";

const head =
  '<a href="/ap/signin">Hello, sign in Account &amp; Lists</a><div id="glow-ingress-block">Deliver to San Mateo 94404</div>';
const detail =
  '<div id="centerCol"><input id="ASIN" value="B0H8GWY1HV"><div id="title"><h1 id="productTitle">Owned rotating-session product</h1></div></div><div id="leftCol"><img id="landingImage" alt="Owned"></div>';

// Owned intercepted responses only; no real Amazon request or imported state.
for (const mode of [
  "rotation",
  "challenge",
  "identity_mismatch",
  "identity_ambiguous",
  "missing_identity",
  "wrong_postal",
  "cache_error",
]) {
  test(`${mode}: next detail inherits only a verified response session`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "scoutops-daily-session-"));
    const launch = chromium.launchPersistentContext;
    const requests = [];
    let current = "seed-1";
    const events = [];
    t.mock.method(console, "warn", (line) => events.push(JSON.parse(line)));
    t.mock.method(chromium, "launchPersistentContext", async (...args) => {
      const context = await launch.apply(chromium, args);
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        assert.equal(url.origin, "https://www.amazon.com");
        if (url.pathname === "/") {
          requests.push("home");
          return route.fulfill({
            contentType: "text/html",
            headers: {
              "set-cookie": `session-id=${current}; Path=/; Secure; HttpOnly; SameSite=Lax`,
            },
            body: head,
          });
        }
        assert.equal(url.pathname, "/dp/B0H8GWY1HV");
        const cookie = (await route.request().allHeaders()).cookie ?? "";
        const accepted = cookie.includes(`session-id=${current}`);
        requests.push(accepted ? "detail-current" : "detail-stale");
        if (accepted) current = current === "seed-1" ? "seed-2" : "seed-3";
        await route.fulfill({
          contentType: "text/html",
          headers: accepted
            ? { "set-cookie": `session-id=${current}; Path=/; Secure; HttpOnly; SameSite=Lax` }
            : {},
          body:
            (mode === "wrong_postal" ? head.replace("94404", "10001") : head) +
            (mode === "challenge"
              ? '<input id="captchacharacters">'
              : accepted
                ? mode === "identity_mismatch"
                  ? detail.replace('value="B0H8GWY1HV"', 'value="B000000002"')
                  : mode === "missing_identity"
                    ? detail.replace('<input id="ASIN" value="B0H8GWY1HV">', "")
                    : mode === "identity_ambiguous"
                      ? detail + '<input id="ASIN" value="B0H8GWY1HV">'
                      : detail
                : ""),
        });
      });
      return context;
    });
    const { plan } = createAmazonBrowserExecutionRequest({
      page_url: "https://www.amazon.com/dp/B0H8GWY1HV",
    });
    const engine = new PlaywrightCrawlerEngine({
      navigationTimeoutMs: 1000,
      actionTimeoutMs: 1000,
      maxPages: 1,
      maxScrolls: 0,
      maxDetails: 0,
      maxArchiveBytes: 1024,
      maxExtractedBytes: 1024,
      maxArchiveFiles: 1,
      headless: true,
    });
    try {
      const run = (name) =>
        withDailyAmazonDelivery(
          join(root, "cache"),
          "owned-profile:1:egress",
          "94404",
          (state) =>
            engine.run(
              plan,
              join(root, name),
              { requestId: "owned", traceId: "owned" },
              {
                dailyDelivery:
                  mode === "cache_error"
                    ? {
                        ...state,
                        refresh: async () => {
                          throw new Error("private simulated disk failure");
                        },
                      }
                    : state,
              },
            ),
          undefined,
          () => new Date("2026-11-26T08:00:00Z"),
        );
      const first = await run("first");
      if (mode === "rotation") {
        assert.equal(first.status, "succeeded");
        const second = await run("second");
        assert.equal(
          second.status,
          "succeeded",
          "successful response session must not reset to the original daily seed",
        );
        assert.equal(second.item_count, 1);
        assert.deepEqual(requests, ["home", "detail-current", "detail-current"]);
      } else {
        assert.equal(
          first.status,
          mode === "challenge"
            ? "blocked_captcha"
            : mode === "wrong_postal"
              ? "timeout"
              : "succeeded",
        );
        assert.deepEqual(requests, ["home", "detail-current"]);
        if (mode === "cache_error") {
          assert.deepEqual(events, [
            { event: "amazon_delivery_session_refresh_failed", reason: "cache_unavailable" },
          ]);
          assert.doesNotMatch(JSON.stringify(events), /private simulated|disk failure/);
        }
      }
      const saved = await withDailyAmazonDelivery(
        join(root, "cache"),
        "owned-profile:1:egress",
        "94404",
        async (s) => s.cookies,
        undefined,
        () => new Date("2026-11-26T08:00:00Z"),
      );
      assert.equal(
        saved.find((c) => c.name === "session-id").value,
        mode === "rotation" ? "seed-3" : "seed-1",
      );
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
    }
  });
}
