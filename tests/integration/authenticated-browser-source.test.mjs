import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { sealCredential } from "../../packages/credentials/dist/index.js";
import {
  PlaywrightCrawlerEngine,
  runWithEncryptedProfile,
} from "../../packages/playwright-crawler/dist/index.js";

const limits = {
  navigationTimeoutMs: 10_000,
  actionTimeoutMs: 5_000,
  maxPages: 1,
  maxScrolls: 0,
  maxDetails: 0,
  maxArchiveBytes: 1_000_000,
  maxExtractedBytes: 1_000_000,
  maxArchiveFiles: 20,
  headless: true,
};
const archiveLimits = {
  maxArchiveBytes: limits.maxArchiveBytes,
  maxExtractedBytes: limits.maxExtractedBytes,
  maxFiles: limits.maxArchiveFiles,
};
const masterKey = "authenticated-browser-integration-master-key";

const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
};

const close = (server) =>
  new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

const sealedCookieRecord = (origin, cookies, assetId) => {
  const context = { assetId, assetVersion: 1, kind: "cookie_bundle", keyVersion: "v1" };
  return {
    ...sealCredential(
      {
        encoding: "utf8",
        value: JSON.stringify({ format: "scoutops-cookie-bundle-v1", cookies }),
      },
      masterKey,
      context,
    ),
    ...context,
  };
};

test("encrypted logged-in source runs through real Chromium and captures evidence", async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      request.headers.cookie?.includes("session=valid")
        ? "<!doctype html><html><body><article class='item'>登录商品</article></body></html>"
        : "<!doctype html><html><body><main id='login-required'>请续期登录</main></body></html>",
    );
  });
  const tempRoot = await mkdtemp(join(tmpdir(), "scoutops-authenticated-browser-"));
  try {
    const origin = await listen(server);
    const plan = {
      start_url: `${origin}/products`,
      allowed_origins: [origin],
      item_selector: ".item",
      max_pages: 1,
      max_scrolls: 0,
      max_details: 0,
      block_signals: { login: "#login-required" },
      evidence: { parser_version: "local-authenticated-source-v1" },
    };
    const valid = await runWithEncryptedProfile(
      new PlaywrightCrawlerEngine(limits),
      sealedCookieRecord(
        origin,
        [{ name: "session", value: "valid", url: origin, httpOnly: true, sameSite: "Lax" }],
        "credential-valid-login",
      ),
      masterKey,
      tempRoot,
      archiveLimits,
      plan,
      { requestId: "request-valid-login", traceId: "trace-valid-login" },
    );
    assert.equal(valid.status, "succeeded");
    assert.equal(valid.item_count, 1);
    assert.deepEqual(
      valid.artifacts?.map((artifact) => artifact.kind),
      ["dom_fragment", "screenshot"],
    );
    assert.ok(valid.artifacts?.every((artifact) => artifact.content_base64.length > 0));
    assert.equal(valid.request_id, "request-valid-login");
    assert.equal(valid.trace_id, "trace-valid-login");

    const expired = await runWithEncryptedProfile(
      new PlaywrightCrawlerEngine(limits),
      sealedCookieRecord(
        origin,
        [{ name: "session", value: "expired", url: origin }],
        "credential-expired-login",
      ),
      masterKey,
      tempRoot,
      archiveLimits,
      plan,
      { requestId: "request-expired-login", traceId: "trace-expired-login" },
    );
    assert.equal(expired.status, "blocked_login");
    assert.equal(expired.error_code, "blocked_login");
    assert.deepEqual(await readdir(tempRoot), []);
  } finally {
    await close(server).catch(() => {});
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("real Chromium submits a dynamic search form and emits a bounded search snapshot", async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    if (request.url?.startsWith("/results")) {
      const cards = Array.from({ length: 15 }, (_, index) => {
        const offerId = String(726088471976 + index);
        return `<a class="search-offer-wrapper" href="/detail?offerId=${offerId}">
            <div class="offer-title-row"><div class="title-text">LED 桌面灯</div></div>
            <div class="offer-price-row"><div class="price-item">¥ 5 .8</div></div>
            <div class="offer-shop-row"><div class="desc-text">真实灯具供应商</div></div>
            <span>${"中".repeat(10_000)}</span>
          </a>`;
      }).join("");
      response.end(`<!doctype html><html><body>${cards}</body></html>`);
      return;
    }
    response.end(`<!doctype html><html><body>
      <input id="alisearch-input"><button class="input-button" onclick="location.href='/results'">搜索</button>
    </body></html>`);
  });
  const tempRoot = await mkdtemp(join(tmpdir(), "scoutops-search-snapshot-"));
  try {
    const origin = await listen(server),
      result = await new PlaywrightCrawlerEngine(limits).run(
        {
          start_url: origin,
          allowed_origins: [origin],
          search: {
            input_selector: "#alisearch-input",
            query: "桌面灯",
            submit_selector: ".input-button",
          },
          item_selector: 'a.search-offer-wrapper[href*="offerId="]',
          search_snapshot: {
            schema_version: "1688.search.v1",
            max_items: 15,
            offer_id_query_param: "offerId",
            canonical_url_template: `${origin}/offer/{offer_id}`,
            title_selector: ".offer-title-row .title-text",
            supplier_name_selector: ".offer-shop-row .desc-text",
            price_selector: ".offer-price-row .price-item",
          },
          max_pages: 1,
          max_scrolls: 0,
          max_details: 0,
          evidence: { parser_version: "local-search-snapshot-v1" },
        },
        tempRoot,
        { requestId: "request-search-snapshot", traceId: "trace-search-snapshot" },
      );
    assert.equal(result.status, "succeeded");
    assert.equal(result.item_count, 15);
    assert.equal(result.snapshots?.search.items.length, 15);
    assert.deepEqual(result.snapshots?.search.items[0], {
      offer_id: "726088471976",
      title: "LED 桌面灯",
      supplier_id: null,
      supplier_name: "真实灯具供应商",
      quoted_price: 5.8,
      currency: "CNY",
      moq: null,
      location: null,
      canonical_url: `${origin}/offer/726088471976`,
      dom_fragment: result.snapshots.search.items[0].dom_fragment,
      source_paths: {
        title: ".offer-title-row .title-text",
        supplier_name: ".offer-shop-row .desc-text",
        quoted_price: ".offer-price-row .price-item",
        moq: "current search card does not expose MOQ",
        location: "current search card does not expose location",
        canonical_url: 'a.search-offer-wrapper[href*="offerId="] @href query:offerId',
      },
    });
    assert.match(result.snapshots.search.items[0].dom_fragment, /真实灯具供应商/);
    assert.ok(Buffer.byteLength(result.snapshots.search.items[0].dom_fragment) <= 15_000);
    assert.ok(Buffer.byteLength(JSON.stringify(result)) < 2 * 1024 * 1024);
  } finally {
    await close(server).catch(() => {});
    await rm(tempRoot, { recursive: true, force: true });
  }
});
