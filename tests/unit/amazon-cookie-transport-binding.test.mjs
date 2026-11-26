import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { sealCredential } from "../../packages/credentials/dist/index.js";
import { MySqlCrawlerRuntimeRepository } from "../../apps/api/dist/mysql-crawler-runtime-repository.js";
import { CredentialAssetService } from "../../apps/api/dist/credential-asset-service.js";
import { createAmazonBrowserExecutionRequest } from "../../packages/provider-sources/dist/index.js";
import {
  AmazonPublicBrowserHealth,
  AMAZON_HEALTH_PYTHON_TRANSPORT,
} from "../../apps/api/dist/amazon-public-browser-health.js";
import { MySqlCredentialAssetRepository } from "../../apps/api/dist/mysql-credential-asset-repository.js";
import { CrawlerRuntimeService } from "../../apps/api/dist/crawler-runtime-service.js";
import { PlaywrightCrawlerEngine } from "../../packages/playwright-crawler/dist/index.js";
import { loadRuntimeConfig } from "../../packages/config/dist/index.js";
const profile = randomUUID(),
  asset = randomUUID(),
  provider = randomUUID(),
  actor = randomUUID(),
  master = "owned-master-key-more-than-32-characters";
const cookie = (name) => ({
  name,
  value: "OWNED-NOT-LOGGED",
  domain: ".amazon.com",
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
});
for (const kind of ["cookie_bundle", "browser_profile"]) {
  test(`assignment derives ${kind} mode from bound credential, not queued input`, async () => {
    let sql = "";
    const now = new Date();
    const c = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
      query: async (q, v) => {
        if (q.startsWith("SELECT contract_version")) return [[{ contract_version: 25 }]];
        if (q.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{ Field: "account_id" }]];
        if (
          q.startsWith("SELECT slot_key") ||
          q.startsWith("SELECT run_id FROM crawler_profile_leases")
        )
          return [[]];
        if (q.startsWith("SELECT j.*")) {
          sql = q;
          const request = createAmazonBrowserExecutionRequest({ query: "owned" });
          request.amazon_session_mode = "administrator_cookie";
          return [
            [
              {
                id: randomUUID(),
                account_id: actor,
                collection_task_id: randomUUID(),
                collection_subquery_id: randomUUID(),
                provider_id: provider,
                provider_code: "amazon_product",
                profile_id: profile,
                execution_request_json: JSON.stringify(request),
                request_id: "R",
                trace_id: "T",
                locale: "en-US",
                timezone: "America/Los_Angeles",
                asset_id: asset,
                asset_version: 1,
                kind,
                key_version: "v1",
                payload_ciphertext: Buffer.alloc(1),
                payload_nonce: Buffer.alloc(1),
                payload_auth_tag: Buffer.alloc(1),
              },
            ],
          ];
        }
        if (q.startsWith("SHOW COLUMNS FROM crawler_browser_runs"))
          return [[{ Field: "historical_context" }]];
        if (q.startsWith("SHOW COLUMNS")) return [[]];
        return [{ affectedRows: 1 }];
      },
    };
    const r = new MySqlCrawlerRuntimeRepository({ getConnection: async () => c }, profile);
    const assignment = await r.acquireJob({
      actorId: actor,
      requestId: "R",
      traceId: "T",
      leaseOwner: "owned",
      leaseSeconds: 120,
      runId: randomUUID(),
      leaseId: randomUUID(),
      leaseTokenHash: "a".repeat(64),
      completionSpool: {},
      now,
      expiresAt: new Date(+now + 120000),
    });
    assert.ok(sql.includes("p.id=?"));
    assert.ok(sql.includes("a.provider_id=p.provider_id"));
    assert.ok(sql.includes("a.fingerprint=?"));
    const request = assignment.job.execution_request;
    assert.equal(
      request.amazon_session_mode,
      kind === "cookie_bundle" ? "administrator_cookie" : undefined,
    );
    assert.equal(
      request.plan.amazon_delivery.session_mode,
      kind === "cookie_bundle" ? "administrator_cookie" : undefined,
    );
  });
}
test("Amazon Cookie rotation suppresses automatic task replay without affecting other sources", async () => {
  for (const code of ["amazon_product", "owned_other"]) {
    let value;
    const service = new CredentialAssetService(
      {
        listProviderOptions: async () => [
          {
            id: provider,
            code,
            name: "Owned",
            target_url: code === "amazon_product" ? "https://www.amazon.com" : "https://owned.test",
            access_mode: "public_page",
          },
        ],
        getCipherRecord: async () => ({
          summary: {
            kind: "cookie_bundle",
            status: "active",
            provider_id: provider,
            expires_at: null,
          },
        }),
        rotateAsset: async (input) => ((value = input), { id: asset }),
      },
      master,
      "v1",
    );
    const cookies = [
      { ...cookie("at-main"), domain: code === "amazon_product" ? ".amazon.com" : "owned.test" },
    ];
    await service.rotateAsset(
      asset,
      { expected_version: 1, secret_payload: { encoding: "utf8", value: JSON.stringify(cookies) } },
      { actorId: actor, idempotencyKey: "owned", requestId: "R", traceId: "T" },
    );
    assert.equal(value.skipAutomaticReplay, code === "amazon_product" ? true : undefined);
  }
});
for (const blocked of [false, true])
  test(`configured cookie health still requires both transports: blocked=${blocked}`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "scoutops-cookie-health-"));
    try {
      const config = loadRuntimeConfig();
      config.storage.credentialTempRoot = root;
      config.security.credentialsMasterKey = master;
      config.providerAdapters.amazonBrowserProfileId = profile;
      const sealed = sealCredential(
        {
          encoding: "utf8",
          value: JSON.stringify({
            format: "scoutops-cookie-bundle-v1",
            cookies: [cookie("at-main"), cookie("sess-at-main")],
          }),
        },
        master,
        { assetId: asset, assetVersion: 1, kind: "cookie_bundle", keyVersion: "v1" },
      );
      const credential = {
        ...sealed,
        assetId: asset,
        assetVersion: 1,
        kind: "cookie_bundle",
        keyVersion: "v1",
      };
      t.mock.method(
        MySqlCredentialAssetRepository.prototype,
        "getCipherRecord",
        async () => credential,
      );
      t.mock.method(CrawlerRuntimeService.prototype, "acquire", async () => ({
        lease_token: "owned",
        run: { id: randomUUID() },
      }));
      t.mock.method(CrawlerRuntimeService.prototype, "finish", async () => ({}));
      t.mock.method(console, "info", () => {});
      const calls = [];
      t.mock.method(PlaywrightCrawlerEngine.prototype, "run", async (plan, _dir, _ids, options) => {
        calls.push({ plan, options });
        assert.equal(plan.amazon_delivery.session_mode, "administrator_cookie");
        assert.ok(options.cookies.some((c) => c.name === "at-main"));
        assert.equal(options.dailyDelivery, undefined);
        if (blocked && options.publicHttpRuntime)
          return { status: "blocked_captcha", error_code: "blocked_captcha", item_count: 0 };
        const body =
          new URL(plan.start_url).pathname === "/s"
            ? '<div data-component-type="s-search-result" data-asin="B0H8GWY1HV"><h2><a href="/dp/B0H8GWY1HV"><span>Owned product</span></a></h2><img class="s-image" src="https://m.media-amazon.com/images/I/owned.jpg"></div>'
            : '<div id="leftCol"><img id="landingImage" src="https://m.media-amazon.com/images/I/owned.jpg"></div><div id="centerCol"><h1 id="productTitle">Owned product</h1></div>';
        const artifact = (kind, b) => ({
          kind,
          source_url: plan.start_url,
          content_type: kind === "dom_fragment" ? "text/html" : "image/jpeg",
          content_base64: b.toString("base64"),
          content_sha256: createHash("sha256").update(b).digest("hex"),
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
      });
      const pool = {
        query: async (sql) =>
          sql.startsWith("SELECT p.*")
            ? [
                [
                  {
                    id: profile,
                    credential_asset_id: asset,
                    kind: "cookie_bundle",
                    locale: "en-US",
                    timezone: "America/Los_Angeles",
                  },
                ],
              ]
            : [[{ terms_review_status: "approved", terms_version: "owned", terms_permanent: 1 }]],
      };
      const health = new AmazonPublicBrowserHealth(
        pool,
        config,
        async () => new Response("User-agent: *\nAllow: /\n"),
        async () => ({ accountId: actor }),
      );
      const result = await health.probe(
        { id: provider, targetUrl: "https://www.amazon.com", timeoutMs: 1000 },
        {
          actorId: actor,
          requestId: "R",
          traceId: "T",
          sessionId: "owned",
          idempotencyKey: "owned",
        },
      );
      assert.equal(result.status, blocked ? "degraded" : "ready");
      assert.equal(calls.length, blocked ? 2 : 4);
      assert.deepEqual(calls[1].options.publicHttpRuntime, AMAZON_HEALTH_PYTHON_TRANSPORT);
      assert.deepEqual(await readdir(root), []);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
    }
  });
