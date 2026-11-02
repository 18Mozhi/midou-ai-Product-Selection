import test from "node:test";
import assert from "node:assert/strict";
import { PlaywrightCrawlerEngine } from "../../packages/playwright-crawler/dist/index.js";
import { runAmazonDetailFixture } from "../fixtures/amazon-detail-readiness.mjs";

for (const [mode, status, error] of [
  ["missing", "timeout", "timeout"],
  ["delayed", "succeeded", null],
  ["ready", "succeeded", null],
  ["captcha", "blocked_captcha", "blocked_captcha"],
  ["search", "succeeded_empty", null],
]) {
  test(`Amazon ${mode} fixture retains bounded readiness and original guards`, async () => {
    const { result, requests } = await runAmazonDetailFixture(PlaywrightCrawlerEngine, mode);
    assert.equal(result.status, status);
    assert.equal(result.error_code, error);
    assert.equal(requests.length, 1, "no navigation retry or external resource requests");
    if (status === "succeeded") {
      assert.equal(result.item_count, 1);
      const dom = result.artifacts.find((a) => a.kind === "dom_fragment");
      assert.match(Buffer.from(dom.content_base64, "base64").toString(), /Fixture product/);
    } else if (mode !== "search") {
      assert.equal(result.item_count, 0);
      assert.equal(result.artifacts, undefined, "incomplete detail is not successful evidence");
    }
  });
}
