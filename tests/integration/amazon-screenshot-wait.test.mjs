import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
        t.mock.method(context, "newCDPSession", async () => ({
          send: async () => {
            const error = new Error(
              `page.screenshot: Timeout 3000ms exceeded. PRIVATE\nCall log:\n${log}`,
            );
            error.name = "TimeoutError";
            throw error;
          },
          detach: async () => {},
        }));
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

test("Real Chromium font stall retains genuine viewport evidence without altering the page", async (t) => {
  const events = [];
  const fontStates = [];
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
      const cdp = context.newCDPSession.bind(context);
      t.mock.method(context, "newCDPSession", async (page) => {
        await page.evaluate(() => {
          const font = new FontFace(
            "OwnedFixture",
            "url(https://www.amazon.com/fixture-font.woff2)",
          );
          document.fonts.add(font);
          document.body.style.fontFamily = "OwnedFixture";
          void font.load().catch(() => {});
        });
        const session = await cdp(page);
        const send = session.send.bind(session);
        t.mock.method(session, "send", async (...args) => {
          const result = await send(...args);
          fontStates.push(
            await page.evaluate(() => ({
              state: document.fonts.status,
              family: document.body.style.fontFamily,
              title: document.querySelector("#productTitle")?.textContent,
            })),
          );
          return result;
        });
        return session;
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
  assert.equal(result.status, "succeeded");
  assert.deepEqual(fontStates, [
    { state: "loading", family: "OwnedFixture", title: "Fixture product" },
  ]);
  assert.equal(result.item_count, 1);
  const image = result.artifacts.find((a) => a.kind === "screenshot");
  const bytes = Buffer.from(image.content_base64, "base64");
  assert.equal(bytes.subarray(0, 2).toString("hex"), "ffd8");
  assert.ok(bytes.length > 0 && bytes.length <= 800000);
  assert.equal(image.content_sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.ok(result.artifacts.some((a) => a.kind === "dom_fragment"));
  assert.equal(
    events.some((e) => e.event === "amazon_browser_step_failed"),
    false,
  );
  assert.doesNotMatch(JSON.stringify(events), /fixture-font|OwnedFixture|Call log:/);
});
