import test from "node:test";
import assert from "node:assert/strict";
import { PlaywrightCrawlerEngine } from "../../packages/playwright-crawler/dist/index.js";
import { runAmazonDetailFixture } from "../fixtures/amazon-detail-readiness.mjs";

for (const mode of ["empty", "oversize", "capture_failure"]) {
  test(`Amazon native viewport ${mode} never accepts partial evidence`, async (t) => {
    t.mock.method(console, "warn", () => {});
    const calls = [];
    let detached = 0;
    const { result } = await runAmazonDetailFixture(
      PlaywrightCrawlerEngine,
      "ready",
      async (context) => {
        t.mock.method(context, "newCDPSession", async () => ({
          send: async (method, options) => {
            calls.push([method, options]);
            if (mode === "capture_failure") throw new Error("native capture failed");
            return { data: Buffer.alloc(mode === "empty" ? 0 : 800001).toString("base64") };
          },
          detach: async () => {
            detached += 1;
          },
        }));
      },
    );
    assert.notEqual(result.status, "succeeded");
    assert.equal(result.item_count, 1);
    assert.equal(result.artifacts, undefined);
    assert.equal(detached, mode === "oversize" ? 2 : 1);
    assert.deepEqual(
      calls.map(([method, options]) => [method, options.quality]),
      mode === "oversize"
        ? [
            ["Page.captureScreenshot", 35],
            ["Page.captureScreenshot", 15],
          ]
        : [["Page.captureScreenshot", 35]],
    );
    assert.ok(
      calls.every(
        ([, o]) =>
          o.format === "jpeg" && o.fromSurface === true && o.captureBeyondViewport === false,
      ),
    );
  });
}
