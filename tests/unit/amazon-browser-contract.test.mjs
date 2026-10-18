import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { sealCredential } from "../../packages/credentials/dist/index.js";
import {
  amazonBrowserUrl,
  anonymousAmazonArchive,
  anonymousAmazonFingerprint,
  createAmazonBrowserExecutionRequest,
  parseAmazonBrowserRunResult,
  parseAmazonBrowserEvidenceArtifacts,
  sanitizeAmazonBrowserRunResult,
  AMAZON_BROWSER_PARSER_VERSION,
} from "../../packages/provider-sources/dist/index.js";
import { loadRuntimeConfig } from "../../packages/config/dist/index.js";
import { MySqlAuthenticatedBrowserJobClient } from "../../apps/worker/dist/authenticated-browser-job-client.js";
import { MySqlCrawlerRuntimeRepository } from "../../apps/api/dist/mysql-crawler-runtime-repository.js";
import { AmazonPublicBrowserHealth } from "../../apps/api/dist/amazon-public-browser-health.js";
import { ProviderAdapterService } from "../../apps/api/dist/provider-adapter-service.js";
import { ProviderAdapterRegistry } from "../../packages/provider-adapters/dist/index.js";

const asin = "B09HL7C2FP",
  url = `https://www.amazon.com/dp/${asin}`;
const html =
  '<div id="leftCol"><img id="landingImage" src="https://m.media-amazon.com/images/I/81ubellLb6L.jpg"></div><div id="centerCol"><h1 id="productTitle">Observed cleaner</h1><div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">$17.99</span></span></div></div>';
function artifact(kind, content, source = url) {
  const bytes = Buffer.from(content);
  return {
    kind,
    source_url: source,
    content_type: kind === "screenshot" ? "image/jpeg" : "text/html",
    content_base64: bytes.toString("base64"),
    content_sha256: createHash("sha256").update(bytes).digest("hex"),
    captured_at: "2026-10-18T02:00:00.000Z",
    parser_version: AMAZON_BROWSER_PARSER_VERSION,
  };
}
const result = (body = html, source = url) => ({
  status: "succeeded",
  artifacts: [
    artifact("dom_fragment", body, source),
    artifact("screenshot", [255, 216, 255, 217], source),
  ],
});

test("anonymous archive contains only empty tar blocks and has stable credential fingerprint", () => {
  const archive = anonymousAmazonArchive();
  assert.deepEqual(gunzipSync(archive), Buffer.alloc(1024));
  assert.equal(
    anonymousAmazonFingerprint(),
    createHash("sha256").update(archive).digest("hex").slice(0, 16),
  );
});
test("Amazon plan binds public desktop origin and preserves observed primary regions", () => {
  assert.equal(
    amazonBrowserUrl({ query: " storage box " }),
    "https://www.amazon.com/s?k=storage%20box",
  );
  const request = createAmazonBrowserExecutionRequest({ page_url: url });
  assert.equal(request.purpose, "amazon_public");
  assert.equal(request.plan.fail_on_http_error, true);
  assert.deepEqual(request.plan.allowed_origins, ["https://www.amazon.com"]);
  assert.deepEqual(request.plan.evidence.ancestor_ids, ["leftCol", "centerCol"]);
  assert.ok(request.plan.evidence.dom_selectors.includes("#landingImage"));
  for (const page_url of [
    "http://www.amazon.com/dp/" + asin,
    "https://evil.test/dp/" + asin,
    url + "#hidden",
    url + "?bm-verify=x",
    "https://name:pass@www.amazon.com/dp/" + asin,
    "https://www.amazon.com/ap/signin",
  ])
    assert.throws(() => amazonBrowserUrl({ page_url }));
  for (const query of ["", "x\n", "a".repeat(201), null])
    assert.throws(() => amazonBrowserUrl({ query }));
});
test("browser facts use captured timestamp, primary image and observed price; missing price stays unknown", () => {
  const [row] = parseAmazonBrowserRunResult(result(), { page_url: url });
  assert.equal(row.externalId, asin);
  assert.equal(row.observedAt, "2026-10-18T02:00:00.000Z");
  assert.equal(row.payload.fields.price, 17.99);
  assert.equal(row.payload.fields.observed_at, "2026-10-18T02:00:00.000Z");
  assert.equal(row.payload.source_paths.observed_at, "browser.artifact.captured_at");
  assert.match(row.payload.fields.image_url, /81ubellLb6L/);
  const missing = html.replace(/<div id="corePriceDisplay[\s\S]*?<\/div>/, "");
  assert.equal(
    parseAmazonBrowserRunResult(result(missing), { page_url: url })[0].payload.fields.price,
    null,
  );
});
test("browser results reject corrupted evidence, mismatched identities, challenge URLs and empty facts", () => {
  const damaged = result();
  damaged.artifacts[0].content_sha256 = "0".repeat(64);
  assert.throws(() => parseAmazonBrowserEvidenceArtifacts(damaged.artifacts));
  for (const source of [
    url.replace(asin, "B000000001"),
    url + "?bm-verify=1",
    "https://evil.test/dp/" + asin,
  ])
    assert.throws(() => parseAmazonBrowserRunResult(result(html, source), { page_url: url }));
  const mismatch = result();
  mismatch.artifacts[1].source_url = url + "?different=1";
  assert.throws(() => parseAmazonBrowserRunResult(mismatch, { page_url: url }));
  assert.throws(() =>
    parseAmazonBrowserRunResult(result("<form>Verify you are human</form>"), { page_url: url }),
  );
  assert.throws(
    () =>
      parseAmazonBrowserRunResult(
        { status: "blocked_captcha", error_code: "captcha" },
        { page_url: url },
      ),
    (e) => e.code === "captcha" && !e.retryable,
  );
});
test("anonymous browser config defaults off, validates actual profile UUID and bounded navigation timeout", () => {
  const config = loadRuntimeConfig({ NODE_ENV: "test" }, "api");
  assert.equal(config.providerAdapters.amazonBrowserProfileId, "");
  assert.equal(config.providerAdapters.amazonBrowserNavigationTimeoutMs, 60000);
  const id = "00000000-0000-4000-8000-000000000481";
  assert.equal(
    loadRuntimeConfig({ AMAZON_PUBLIC_BROWSER_PROFILE_ID: id }, "api").providerAdapters
      .amazonBrowserProfileId,
    id,
  );
  assert.throws(
    () => loadRuntimeConfig({ AMAZON_PUBLIC_BROWSER_PROFILE_ID: "cookie-profile" }, "api"),
    /AMAZON_PUBLIC_BROWSER_PROFILE_ID/,
  );
  assert.throws(
    () => loadRuntimeConfig({ AMAZON_PUBLIC_BROWSER_NAVIGATION_TIMEOUT_MS: "120001" }, "api"),
    /AMAZON_PUBLIC_BROWSER_NAVIGATION_TIMEOUT_MS/,
  );
});

test("queued Amazon job carries target, returns evidence and does not retry permission failures", async () => {
  const calls = [];
  let terminal = { id: "job", status: "succeeded", result_json: result() };
  const pool = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return sql.startsWith("SELECT id,status") ? [[terminal]] : [{ affectedRows: 1 }];
    },
  };
  const input = {
    organizationId: "org",
    workspaceId: "workspace",
    taskId: "task",
    subqueryId: "subquery",
    provider: {
      id: "provider",
      code: "amazon_product",
      accessMode: "public_page",
      timeoutMs: 1000,
    },
    target: { page_url: url },
    requestId: "request",
    traceId: "trace",
  };
  const client = new MySqlAuthenticatedBrowserJobClient(pool, 1, async () =>
    assert.fail("terminal jobs must not poll again"),
  );
  const collected = await client.collect(input, async () => {});
  assert.equal(JSON.parse(calls[0].values[6]).purpose, "amazon_public");
  assert.equal(collected.records[0].externalId, asin);
  assert.equal(collected.parseError, null);
  assert.equal(collected.artifacts.length, 2);
  terminal = { id: "job", status: "failed", error_code: "permission_denied" };
  await assert.rejects(
    () => client.collect(input, async () => {}),
    (e) => e.code === "permission_denied" && !e.retryable,
  );
});

test("crawler claim only permits the configured canonical empty Amazon profile and retains legacy default", async () => {
  for (const profileId of ["", "00000000-0000-4000-8000-000000000481"]) {
    const calls = [];
    const connection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async (sql, values) => {
        calls.push({ sql, values });
        return sql.startsWith("SELECT") ? [[]] : [{ affectedRows: 1 }];
      },
    };
    const repository = new MySqlCrawlerRuntimeRepository(
      { getConnection: async () => connection },
      profileId,
    );
    assert.equal(
      await repository.acquireJob({
        now: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        completionSpool: {
          pendingCount: 0,
          pendingBytes: 0,
          quarantinedCount: 0,
          quarantinedBytes: 0,
          oldestPendingAt: null,
          retentionDays: 30,
          maxBytes: 1000000,
          minimumFreeDiskMb: 0,
          freeDiskMb: 10000,
        },
      }),
      null,
    );
    const query = calls.find((c) => c.sql.startsWith("SELECT j.*"));
    assert.match(query.sql, /p.status='active'/);
    if (profileId) {
      assert.match(query.sql, /p.id=\? AND a.kind='browser_profile' AND a.fingerprint=\?/);
      assert.match(query.sql, /execution_request_json,'\$\.purpose'\)\)='amazon_public'/);
      assert.equal(query.values[0], profileId);
      assert.equal(query.values[1], anonymousAmazonFingerprint());
    } else {
      assert.doesNotMatch(query.sql, /amazon_product|amazon_public/);
      assert.equal(query.values.length, 1);
    }
  }
});

test("browser health requires selected scope and canonical active profile, with no HTTP success fallback", async () => {
  const config = loadRuntimeConfig(
    { NODE_ENV: "test", AMAZON_PUBLIC_BROWSER_PROFILE_ID: "00000000-0000-4000-8000-000000000481" },
    "api",
  );
  const context = {
    actorId: "actor",
    sessionId: "selected-session",
    requestId: "request",
    traceId: "trace",
    idempotencyKey: "health",
  };
  let selected = false,
    queried = false;
  const probe = new AmazonPublicBrowserHealth(
    {
      query: async (sql, args) => {
        queried = true;
        assert.match(sql, /a.fingerprint=\?/);
        assert.equal(args[2], anonymousAmazonFingerprint());
        return [[]];
      },
    },
    config,
    async () => assert.fail("missing canonical profile must stop before network"),
    async (c) => {
      assert.equal(c, context);
      selected = true;
      return { organizationId: "org", workspaceId: "workspace" };
    },
  );
  const signal = await probe.probe({ id: "provider" }, context);
  assert.ok(selected && queried);
  assert.equal(signal.status, "degraded");
  assert.equal(signal.errorCode, "anonymous_profile_unavailable");
});

test("registered Amazon health persists the browser result instead of independently green HTTP health", async () => {
  const provider = {
    id: "00000000-0000-4000-8000-000000000481",
    code: "amazon_product",
    name: "Amazon",
    accessMode: "public_page",
    status: "enabled",
    timeoutMs: 1000,
    fields: [],
    circuitFailureThreshold: 5,
  };
  let stored;
  const repository = {
    getProvider: async () => provider,
    findReplay: async () => null,
    recordHealth: async (input) => {
      stored = input;
      return {
        providerId: provider.id,
        adapterVersion: input.adapterVersion,
        healthStatus: input.signal.status,
        lastCheckedAt: new Date().toISOString(),
        lastLatencyMs: input.signal.latencyMs,
        lastErrorCode: input.signal.errorCode,
        consecutiveFailures: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
    },
  };
  const registry = new ProviderAdapterRegistry({
    healthTimeoutMs: 1000,
    maxResponseBytes: 10000,
    maxItemsPerBatch: 10,
  }).register({
    key: provider.code,
    accessMode: "public_page",
    version: "test-v13",
    healthCheck: async () => assert.fail("browser enabled must not fall back to HTTP"),
  });
  const context = {
    actorId: "actor",
    sessionId: "session",
    requestId: "request",
    traceId: "trace",
    idempotencyKey: "probe",
  };
  const service = new ProviderAdapterService(repository, registry, undefined, async (p, c) => {
    assert.equal(p, provider);
    assert.equal(c, context);
    return { status: "degraded", latencyMs: 10, errorCode: "captcha", message: "blocked" };
  });
  const summary = await service.probe(provider.id, context);
  assert.equal(summary.health_status, "degraded");
  assert.equal(stored.signal.errorCode, "captcha");
  assert.equal(stored.adapterVersion, "test-v13");
});

test("Node runner rejects nonempty and cookie profiles before loading a public browser", () => {
  const master = "test-amazon-runner-integration-master-key";
  for (const kind of ["browser_profile", "cookie_bundle"]) {
    const context = { assetId: "test-asset", assetVersion: 1, kind, keyVersion: "v1" };
    const sealed = sealCredential(
      { encoding: "base64", value: Buffer.from("not-an-empty-profile").toString("base64") },
      master,
      context,
    );
    const request = {
      ...createAmazonBrowserExecutionRequest({ page_url: url }),
      request_id: "test",
      trace_id: "test",
      temp_root: loadRuntimeConfig({ NODE_ENV: "test" }, "worker").storage.credentialTempRoot,
      master_key: master,
      credential: {
        asset_id: context.assetId,
        asset_version: 1,
        kind,
        key_version: "v1",
        ciphertext_base64: sealed.ciphertext.toString("base64"),
        nonce_base64: sealed.nonce.toString("base64"),
        auth_tag_base64: sealed.authTag.toString("base64"),
      },
    };
    const run = spawnSync(process.execPath, ["scripts/run-playwright-crawler.mjs"], {
      input: JSON.stringify(request),
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test" },
      timeout: 10000,
      windowsHide: true,
    });
    assert.equal(run.status, 2, run.stderr);
    assert.equal(JSON.parse(run.stdout).code, "crawler_anonymous_profile_invalid");
  }
});

test("observed checkpoint redirects fail closed without emitting verification content or URL parameters", () => {
  const challenge = result(
    "<main>Verification body</main>",
    "https://www.amazon.com/checkpoint/continue?token=test-only-transient-value",
  );
  challenge.status = "succeeded_empty";
  const clean = sanitizeAmazonBrowserRunResult(challenge);
  assert.equal(clean.status, "dependency_failed");
  assert.equal(clean.error_code, "permission_denied");
  assert.equal(clean.item_count, 0);
  assert.equal(clean.artifacts, undefined);
  assert.doesNotMatch(JSON.stringify(clean), /test-only-transient-value|content_base64|source_url/);
  assert.throws(
    () => parseAmazonBrowserEvidenceArtifacts(challenge.artifacts),
    (e) => e.code === "permission_denied" && !e.retryable,
  );
  const valid = result();
  assert.equal(sanitizeAmazonBrowserRunResult(valid), valid);
});
