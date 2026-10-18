import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PlaywrightCrawlerEngine,
  runWithEncryptedProfile,
} from "../../packages/playwright-crawler/dist/index.js";
import { sealCredential } from "../../packages/credentials/dist/index.js";
import { anonymousAmazonArchive } from "../../packages/provider-sources/dist/index.js";
import {
  projectBrowserEvidenceNodes,
  validateBrowserPlan,
} from "../../packages/playwright-crawler/dist/index.js";
import {
  createAmazonBrowserExecutionRequest,
  parseAmazonProductPage,
} from "../../packages/provider-sources/dist/index.js";

test("real Chromium projection preserves one actual centerCol, primary image and facts without mutating page", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const source =
      '<div id="leftCol"><img id="landingImage" src="https://m.media-amazon.com/images/I/example.jpg"></div><div id="centerCol"><div id="title"><h1 id="productTitle">Observed product</h1><script>window.hiddenPrice=999</script><style>.huge{color:red}</style></div><div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">$18.99</span></span></div></div><div id="recommendations"><span class="a-price">$1.00</span></div>';
    await page.setContent(source);
    const { plan } = createAmazonBrowserExecutionRequest({
      page_url: "https://www.amazon.com/dp/B09HL7C2FP",
    });
    const before = await page.locator("body").innerHTML();
    const projected = await page
      .locator(plan.evidence.dom_selectors.join(","))
      .evaluateAll(projectBrowserEvidenceNodes, {
        ancestorIds: plan.evidence.ancestor_ids,
        strip: true,
      });
    assert.equal((projected.match(/id="centerCol"/g) || []).length, 1);
    assert.match(projected, /id="leftCol"/);
    assert.doesNotMatch(projected, /<script|<style|recommendations/);
    assert.equal(await page.locator("body").innerHTML(), before);
    const [record] = parseAmazonProductPage(
      `<html><body>${projected}</body></html>`,
      plan.start_url,
      1,
    );
    assert.equal(record.payload.fields.price, 18.99);
    assert.match(record.payload.fields.image_url, /example.jpg/);
    const limits = { maxPages: 2, maxScrolls: 1, maxDetails: 1 };
    assert.equal(validateBrowserPlan(plan, limits).fail_on_http_error, true);
    for (const evidence of [
      { ...plan.evidence, dom_selectors: [] },
      { ...plan.evidence, ancestor_ids: ["centerCol, body"] },
      { ...plan.evidence, strip_non_content: "yes" },
    ])
      assert.throws(() => validateBrowserPlan({ ...plan, evidence }, limits));
    assert.throws(() => validateBrowserPlan({ ...plan, fail_on_http_error: "yes" }, limits));
  } finally {
    await browser.close();
  }
});

test("strict browser transport rejects HTTP errors, aborts and cleans extracted empty profiles", async () => {
  const server = createServer((request, response) => {
    response.writeHead(503, { "content-type": "text/html" });
    response.end('<h1 id="title">Service unavailable</h1>');
  });
  const root = await mkdtemp(join(tmpdir(), "scoutops-amazon-browser-"));
  const context = {
    assetId: "test-public-profile",
    assetVersion: 1,
    kind: "browser_profile",
    keyVersion: "v1",
  };
  const master = "test-amazon-browser-integration-master";
  const record = {
    ...sealCredential(
      { encoding: "base64", value: anonymousAmazonArchive().toString("base64") },
      master,
      context,
    ),
    ...context,
  };
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const limits = {
      navigationTimeoutMs: 5000,
      actionTimeoutMs: 1000,
      maxPages: 1,
      maxScrolls: 0,
      maxDetails: 0,
      maxArchiveBytes: 10000,
      maxExtractedBytes: 10000,
      maxArchiveFiles: 10,
      headless: true,
    };
    const plan = {
      start_url: origin,
      allowed_origins: [origin],
      item_selector: "#title",
      max_pages: 1,
      max_scrolls: 0,
      max_details: 0,
      fail_on_http_error: true,
    };
    const run = (signal) =>
      runWithEncryptedProfile(
        new PlaywrightCrawlerEngine(limits),
        record,
        master,
        root,
        { maxArchiveBytes: 10000, maxExtractedBytes: 10000, maxFiles: 10 },
        plan,
        { requestId: "test", traceId: "test" },
        { signal },
      );
    const failed = await run();
    assert.equal(failed.error_code, "network_error");
    assert.notEqual(failed.status, "succeeded");
    assert.deepEqual(await readdir(root), []);
    const controller = new AbortController();
    controller.abort();
    const aborted = await run(controller.signal);
    assert.notEqual(aborted.status, "succeeded");
    assert.deepEqual(await readdir(root), []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
