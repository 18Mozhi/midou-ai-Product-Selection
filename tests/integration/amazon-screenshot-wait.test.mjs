import test from "node:test";
import assert from "node:assert/strict";
import { PlaywrightCrawlerEngine } from "../../packages/playwright-crawler/dist/index.js";
import { runAmazonDetailFixture } from "../fixtures/amazon-detail-readiness.mjs";

for (const [phase, log] of [
  ["font_wait", "taking page screenshot\nwaiting for fonts to load..."],
  ["after_font_ready", "taking page screenshot\nwaiting for fonts to load...\nfonts loaded"],
  ["before_font_wait", "taking page screenshot"],
  ["unavailable", "arbitrary PRIVATE text https://private.invalid"],
]) {
  test(`Screenshot timeout retains only fixed phase ${phase}`, async (t) => {
    const events = [];
    t.mock.method(console, "warn", (line) => events.push(JSON.parse(line)));
    const { result } = await runAmazonDetailFixture(
      PlaywrightCrawlerEngine,
      "ready",
      async (context) => {
        const patch = (page) =>
          t.mock.method(page, "screenshot", async () => {
            const error = new Error(
              `page.screenshot: Timeout 3000ms exceeded. PRIVATE\nCall log:\n${log}`,
            );
            error.name = "TimeoutError";
            throw error;
          });
        context.pages().forEach(patch);
        context.on("page", patch);
      },
    );
    assert.equal(result.status, "timeout");
    assert.equal(result.artifacts, undefined);
    assert.equal(result.item_count, 1);
    const failure = events.find((event) => event.event === "amazon_browser_step_failed");
    assert.equal(failure.evidence_operation, "screenshot");
    assert.equal(failure.screenshot_wait_phase, phase);
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE|private\.invalid|page\.screenshot/);
  });
}

test("Real Chromium font stall is attributed without accepting partial evidence", async (t) => {
  const events = [];
  let fontRequests = 0;
  t.mock.method(console, "warn", (line) => events.push(JSON.parse(line)));
  const { result, requests } = await runAmazonDetailFixture(
    PlaywrightCrawlerEngine,
    "ready",
    async (context) => {
      await context.route("**/fixture-font.woff2", async (route) => {
        fontRequests += 1;
        // Hold this intercepted, owned font only until the context closes.
        await new Promise((resolve) => context.once("close", resolve));
        await route.abort().catch(() => {});
      });
      const patch = (page) => {
        const screenshot = page.screenshot.bind(page);
        t.mock.method(page, "screenshot", async (options) => {
          await page.evaluate(() => {
            const font = new FontFace(
              "OwnedFixture",
              "url(https://www.amazon.com/fixture-font.woff2)",
            );
            document.fonts.add(font);
            document.body.style.fontFamily = "OwnedFixture";
            void font.load().catch(() => {});
          });
          return screenshot({ ...options, timeout: 500 });
        });
      };
      context.pages().forEach(patch);
      context.on("page", patch);
    },
  );
  assert.equal(fontRequests, 1);
  assert.equal(requests.length, 1);
  assert.equal(result.status, "timeout");
  assert.equal(result.item_count, 1);
  assert.equal(result.artifacts, undefined);
  const failure = events.find((event) => event.event === "amazon_browser_step_failed");
  assert.equal(failure.evidence_operation, "screenshot");
  assert.equal(failure.screenshot_wait_phase, "font_wait");
  assert.doesNotMatch(JSON.stringify(events), /fixture-font|OwnedFixture|Call log:/);
});
