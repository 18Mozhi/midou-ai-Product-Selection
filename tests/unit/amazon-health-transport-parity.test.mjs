import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as healthModule from "../../apps/api/dist/amazon-public-browser-health.js";
const {
  AmazonPublicBrowserHealth,
  AMAZON_HEALTH_PYTHON_TRANSPORT,
  verifyAmazonHealthTransportParity,
} = healthModule;
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sealCredential } from "../../packages/credentials/dist/index.js";
import { anonymousAmazonArchive } from "../../packages/provider-sources/dist/index.js";
import { PlaywrightCrawlerEngine } from "../../packages/playwright-crawler/dist/index.js";
import { CrawlerRuntimeService } from "../../apps/api/dist/crawler-runtime-service.js";
import { MySqlCredentialAssetRepository } from "../../apps/api/dist/mysql-credential-asset-repository.js";
import { loadRuntimeConfig } from "../../packages/config/dist/index.js";
import { ProviderAdapterFailure } from "../../packages/provider-adapters/dist/index.js";

const first = "B000000001",
  shared = "B000000002";
const record = (externalId) => ({ externalId });
test("both searches and both details must prove one common product", async () => {
  const calls = [];
  await verifyAmazonHealthTransportParity(async (target, transport) => {
    calls.push({ target, transport });
    return target.query
      ? transport === "browser"
        ? [record(first), record(shared)]
        : [record(shared)]
      : [record(shared)];
  }, new AbortController().signal);
  assert.deepEqual(calls, [
    { target: { query: "storage box" }, transport: "browser" },
    { target: { query: "storage box" }, transport: "python" },
    { target: { page_url: `https://www.amazon.com/dp/${shared}` }, transport: "browser" },
    { target: { page_url: `https://www.amazon.com/dp/${shared}` }, transport: "python" },
  ]);
});

test("an empty or disjoint Python search cannot inherit browser health", async () => {
  for (const python of [[], [record(shared)]]) {
    const calls = [];
    await assert.rejects(
      verifyAmazonHealthTransportParity(async (target, transport) => {
        calls.push(transport);
        assert.ok(target.query);
        return transport === "browser" ? [record(first)] : python;
      }, new AbortController().signal),
      (error) => error.code === "invalid_payload",
    );
    assert.deepEqual(calls, ["browser", "python"]);
  }
});

test("either detail with missing or wrong product prevents ready without a fallback", async () => {
  for (const failed of ["browser", "python"])
    for (const detail of [[], [record(shared)]]) {
      const calls = [];
      await assert.rejects(
        verifyAmazonHealthTransportParity(async (target, transport) => {
          calls.push({ target, transport });
          return target.query || transport !== failed ? [record(first)] : detail;
        }, new AbortController().signal),
        (error) => error.code === "invalid_payload",
      );
      assert.equal(calls.length, failed === "browser" ? 3 : 4);
    }
});

test("Python verification errors remain blocked and cancellation prevents the next operation", async () => {
  const calls = [];
  await assert.rejects(
    verifyAmazonHealthTransportParity(async (_target, transport) => {
      calls.push(transport);
      if (transport === "python") throw new ProviderAdapterFailure("blocked_captcha", false);
      return [record(first)];
    }, new AbortController().signal),
    (error) => error.code === "blocked_captcha" && !error.retryable,
  );
  assert.deepEqual(calls, ["browser", "python"]);
  const controller = new AbortController();
  let count = 0;
  await assert.rejects(
    verifyAmazonHealthTransportParity(async () => {
      count++;
      controller.abort();
      return [record(first)];
    }, controller.signal),
  );
  assert.equal(count, 1);
});

test("health Python transport is pinned to the existing project runtime, not caller data", () => {
  const deploy = readFileSync(new URL("../../scripts/deploy-baota.py", import.meta.url), "utf8");
  assert.equal(AMAZON_HEALTH_PYTHON_TRANSPORT.executable, /PYTHON_BIN = "([^"]+)"/.exec(deploy)[1]);
  assert.equal(
    AMAZON_HEALTH_PYTHON_TRANSPORT.script,
    /PROJECT_ROOT = "([^"]+)"/.exec(deploy)[1] + "/python/scoutops_crawler/public_http.py",
  );
  assert.ok(Object.isFrozen(AMAZON_HEALTH_PYTHON_TRANSPORT));
});

for (const pythonBlocked of [false, true])
  test(`health class uses the actual private Python route and preserves leases: blocked=${pythonBlocked}`, async (t) => {
    const profile = "00000000-0000-4000-8000-000000000481";
    const root = await mkdtemp(join(tmpdir(), "scoutops-dual-health-"));
    t.after(async () => {
      await rm(root, { recursive: true, force: true });
    });
    const config = loadRuntimeConfig(
      {
        NODE_ENV: "test",
        AMAZON_PUBLIC_BROWSER_PROFILE_ID: profile,
        CREDENTIALS_MASTER_KEY: "fixture-only-amazon-health-master-key",
        CREDENTIAL_TEMP_ROOT: root,
      },
      "api",
    );
    const credentialContext = {
      assetId: "asset",
      assetVersion: 1,
      kind: "browser_profile",
      keyVersion: "v1",
    };
    const credential = {
      ...credentialContext,
      ...sealCredential(
        { encoding: "base64", value: anonymousAmazonArchive().toString("base64") },
        config.security.credentialsMasterKey,
        credentialContext,
      ),
    };
    const finished = [],
      executions = [],
      logs = [];
    t.mock.method(console, "info", (value) => logs.push(JSON.parse(value)));
    t.mock.method(CrawlerRuntimeService.prototype, "acquire", async () => ({
      run: { id: `run-${executions.length}` },
      lease_token: "fixture",
    }));
    t.mock.method(CrawlerRuntimeService.prototype, "finish", async (input) => {
      finished.push(input);
    });
    t.mock.method(
      MySqlCredentialAssetRepository.prototype,
      "getCipherRecord",
      async () => credential,
    );
    const pool = {
      query: async (sql) =>
        sql.startsWith("SELECT p.*")
          ? [
              [
                {
                  id: profile,
                  credential_asset_id: "asset",
                  locale: "en-US",
                  timezone: "America/New_York",
                },
              ],
            ]
          : [[{ terms_review_status: "approved", terms_version: "reviewed", terms_permanent: 1 }]],
    };
    const runner = async (plan, _userDataDir, _ids, options) => {
      executions.push({ plan, options });
      if (pythonBlocked && options.publicHttpRuntime)
        return { status: "blocked_captcha", error_code: "blocked_captcha", item_count: 0 };
      const search = new URL(plan.start_url).pathname === "/s";
      const body = search
        ? `<div data-component-type="s-search-result" data-asin="${first}"><h2><a href="/dp/${first}"><span>Fixture box</span></a></h2><img class="s-image" src="https://m.media-amazon.com/images/I/fixture.jpg"></div>`
        : '<div id="leftCol"><img id="landingImage" src="https://m.media-amazon.com/images/I/fixture.jpg"></div><div id="centerCol"><h1 id="productTitle">Fixture box</h1></div>';
      const artifact = (kind, bytes) => ({
        kind,
        source_url: plan.start_url,
        content_type: kind === "dom_fragment" ? "text/html" : "image/jpeg",
        content_base64: bytes.toString("base64"),
        content_sha256: createHash("sha256").update(bytes).digest("hex"),
        captured_at: new Date().toISOString(),
        parser_version: "amazon-public-browser-v1",
      });
      return {
        status: "succeeded",
        error_code: null,
        item_count: 1,
        page_count: 1,
        detail_count: 0,
        duration_ms: 1,
        artifacts: [
          artifact("dom_fragment", Buffer.from(body)),
          artifact("screenshot", Buffer.from([255, 216, 255, 217])),
        ],
      };
    };
    t.mock.method(PlaywrightCrawlerEngine.prototype, "run", runner);
    const health = new AmazonPublicBrowserHealth(
      pool,
      config,
      async () => new Response("User-agent: *\nAllow: /\n"),
      async () => ({ accountId: "00000000-0000-4000-8000-000000000001" }),
    );
    const result = await health.probe(
      { id: "provider", targetUrl: "https://www.amazon.com", timeoutMs: 1000 },
      {
        actorId: "actor",
        requestId: "request",
        traceId: "trace",
        sessionId: "session",
        idempotencyKey: "key",
      },
    );
    assert.equal(result.status, pythonBlocked ? "degraded" : "ready");
    assert.equal(result.errorCode, pythonBlocked ? "blocked_captcha" : null);
    assert.equal(executions.length, pythonBlocked ? 2 : 4);
    assert.equal(finished.length, executions.length);
    assert.equal(executions[0].options.publicHttpRuntime, undefined);
    assert.deepEqual(executions[1].options.publicHttpRuntime, AMAZON_HEALTH_PYTHON_TRANSPORT);
    for (const item of executions) {
      assert.equal(item.options.locale, "en-US");
      assert.equal(item.options.timezoneId, "America/New_York");
      assert.ok(item.options.handoff);
      assert.ok(item.options.signal);
    }
    assert.equal(logs.length, executions.length);
    assert.doesNotMatch(JSON.stringify(logs), /www\.amazon\.com|B000000001|Bearer|cookie|password/);
    assert.deepEqual(await readdir(root), []);
  });
