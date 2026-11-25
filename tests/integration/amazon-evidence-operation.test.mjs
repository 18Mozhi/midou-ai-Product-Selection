import test from "node:test";
import assert from "node:assert/strict";
import { PlaywrightCrawlerEngine } from "../../packages/playwright-crawler/dist/index.js";
import { runAmazonDetailFixture } from "../fixtures/amazon-detail-readiness.mjs";

for (const operation of [
  "dom_fragment",
  "body_fallback",
  "delivery_header",
  "screenshot",
  "screenshot_recompress",
]) {
  test(`Amazon evidence failure identifies ${operation} without accepting partial facts or leaking content`, async (t) => {
    const events = [];
    t.mock.method(console, "warn", (line) => events.push(JSON.parse(line)));
    const fail = () => {
      const e = new Error("synthetic timeout cookie=PRIVATE https://secret.invalid/item");
      e.name = "TimeoutError";
      throw e;
    };
    const { result, requests } = await runAmazonDetailFixture(
      PlaywrightCrawlerEngine,
      "ready",
      async (context) => {
        const patchPage = (page) => {
          if (operation.startsWith("screenshot")) {
            let calls = 0;
            t.mock.method(page, "screenshot", async () => {
              if (operation === "screenshot_recompress" && calls++ === 0)
                return Buffer.alloc(800001);
              return fail();
            });
          } else {
            const locate = page.locator.bind(page);
            t.mock.method(page, "locator", (selector, ...args) => {
              const locator = locate(selector, ...args);
              if (
                (operation === "dom_fragment" || operation === "body_fallback") &&
                selector.includes("#landingImage")
              ) {
                locator.evaluateAll = async () => (operation === "body_fallback" ? "" : fail());
              }
              if (
                (operation === "body_fallback" && selector === "body") ||
                (operation === "delivery_header" && selector === "#glow-ingress-block")
              )
                locator.evaluate = async () => fail();
              return locator;
            });
          }
        };
        if (operation.startsWith("screenshot")) {
          let calls = 0;
          t.mock.method(context, "newCDPSession", async () => {
            return {
              send: async () => {
                if (operation === "screenshot_recompress" && calls++ === 0)
                  return { data: Buffer.alloc(800001).toString("base64") };
                return fail();
              },
              detach: async () => {},
            };
          });
        }
        context.pages().forEach(patchPage);
        context.on("page", patchPage);
      },
    );
    assert.equal(result.status, "timeout");
    assert.equal(result.error_code, "timeout");
    assert.equal(result.item_count, 1);
    assert.equal(result.artifacts, undefined);
    assert.equal(requests.length, 1);
    const failure = events.find((e) => e.event === "amazon_browser_step_failed");
    assert.equal(failure.stage, "extract_items");
    assert.equal(failure.evidence_operation, operation);
    assert.equal("request_id" in failure, false);
    assert.equal("trace_id" in failure, false);
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE|secret\.invalid|synthetic timeout/);
  });
}
