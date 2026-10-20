import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { PublicRssRecovery } from "../../apps/api/dist/public-rss-recovery.js";
import {
  amazonPublicRecoveryTarget,
  amazonPublicHandoffRecoveryTarget,
  amazonPublicRecoveryCandidatesSql,
  resolveAmazonPublicRecoveryScope,
} from "../../apps/api/dist/amazon-public-recovery.js";
import { registerProviderAdapterRoutes } from "../../apps/api/dist/provider-adapter-routes.js";
import { loadRuntimeConfig } from "../../packages/config/dist/index.js";

const actor = "00000000-0000-4000-8000-000000000001",
  task = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-10-18T07:00:00Z"),
  opened = new Date("2026-10-18T06:30:00Z");
function fixture(
  status = "ready",
  rows = [{ id: "provider", version: 19, opened_at: opened, collection_task_id: task }],
  target = amazonPublicRecoveryTarget,
) {
  const calls = [];
  const worker = new PublicRssRecovery(
    {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return [rows];
      },
    },
    {
      probe: async (id, context) => {
        calls.push({ probe: id, context });
        return { health_status: status };
      },
    },
    {
      recoverProvider: async (input) => {
        calls.push({ recover: input });
        return { recovered: true };
      },
    },
    { enabled: true, actorId: actor, pollMs: 60000, cooldownMs: 300000 },
    () => now,
    undefined,
    undefined,
    target,
  );
  return { worker, calls };
}
test("Amazon recovery uses one cooled real pending system task and preserves fresh-health/version recovery", async () => {
  const f = fixture();
  assert.equal((await f.worker.processOnce()).status, "recovered");
  assert.equal(f.calls[0].sql, amazonPublicRecoveryCandidatesSql);
  assert.deepEqual(f.calls[0].params, [actor, now, new Date(now - 300000), new Date(now - 300000)]);
  const context = f.calls[1].context;
  assert.equal(context.automaticCollectionTaskId, task);
  assert.equal(context.sessionId, undefined);
  assert.match(context.idempotencyKey, /^amazon-public-recovery:/);
  assert.deepEqual(f.calls[2].recover.automaticRecovery, { providerVersion: 19, openedAt: opened });
  assert.match(f.calls[0].sql, /t.created_by=recovery_actor.id/);
  assert.match(f.calls[0].sql, /o.status='active'/);
  assert.match(f.calls[0].sql, /w.organization_id=t.organization_id AND w.status='active'/);
  assert.match(f.calls[0].sql, /p.status='enabled'/);
  assert.match(f.calls[0].sql, /p.terms_review_status='approved'/);
  assert.match(f.calls[0].sql, /c.last_error_code IN \('network_error','timeout','rate_limited'\)/);
  assert.match(f.calls[0].sql, /h.health_status='blocked'/);
});
for (const status of ["degraded", "blocked", "unknown"])
  test(`Amazon ${status} health leaves circuit open`, async () => {
    const f = fixture(status);
    assert.equal((await f.worker.processOnce()).status, status);
    assert.equal(
      f.calls.some((c) => c.recover),
      false,
    );
  });
test("Amazon without eligible pending work creates no probe or recovery", async () => {
  const f = fixture("ready", []);
  assert.equal((await f.worker.processOnce()).status, "idle");
  assert.equal(f.calls.length, 1);
});
test("automatic health scope fails before SQL for missing or different system identity", async () => {
  for (const [configured, ctx] of [
    ["", { actorId: actor, automaticCollectionTaskId: task }],
    [actor, { actorId: "other", automaticCollectionTaskId: task }],
    [actor, { actorId: actor }],
    [actor, { actorId: actor, automaticCollectionTaskId: "invalid" }],
  ])
    await assert.rejects(
      resolveAmazonPublicRecoveryScope({ query: () => assert.fail("no lookup") }, configured, ctx),
      /selected_scope_required/,
    );
});
test("automatic health scope rechecks owned pending work and active tenant, without login", async () => {
  const calls = [],
    ctx = { actorId: actor, automaticCollectionTaskId: task };
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[{ organization_id: "org", workspace_id: "workspace" }]];
    },
  };
  assert.deepEqual(await resolveAmazonPublicRecoveryScope(pool, actor, ctx), {
    organizationId: "org",
    workspaceId: "workspace",
  });
  assert.deepEqual(calls[0].params, [task, actor]);
  assert.match(calls[0].sql, /t.created_by=\?/);
  assert.match(calls[0].sql, /o.status='active'/);
  assert.match(calls[0].sql, /w.organization_id=t.organization_id/);
  await assert.rejects(
    resolveAmazonPublicRecoveryScope({ query: async () => [[]] }, actor, ctx),
    /scope_unavailable/,
  );
});
test("HTTP health input cannot inject the internal task or override authenticated identity", async () => {
  const app = Fastify(),
    calls = [];
  registerProviderAdapterRoutes(app, {
    service: {
      probe: async (id, ctx) => {
        calls.push(ctx);
        return { id };
      },
    },
    authorization: { authorize: async () => {} },
    auth: { authenticate: async () => ({ user: { id: actor }, session: { id: "session" } }) },
    secureCookie: false,
    webOrigin: "http://localhost",
  });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/platform/provider-adapters/provider/health-check",
      headers: {
        origin: "http://localhost",
        cookie: "scoutops_session=test",
        "idempotency-key": "internal-context-is-not-input",
        "x-request-id": "request",
        "x-trace-id": "trace",
      },
      payload: { automaticCollectionTaskId: task, actorId: "forged", organizationId: "foreign" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(calls[0].automaticCollectionTaskId, undefined);
    assert.equal(calls[0].organizationId, undefined);
    assert.equal(calls[0].actorId, actor);
    assert.equal(calls[0].sessionId, "session");
  } finally {
    await app.close();
  }
});
test("Amazon recovery defaults are server-only and invalid timing fails closed", () => {
  const c = loadRuntimeConfig({ NODE_ENV: "test" }, "api");
  assert.equal(c.providerAdapters.amazonPublicRecoveryEnabled, true);
  assert.equal(c.providerAdapters.amazonHandoffRecoveryEnabled, false);
  assert.equal(
    loadRuntimeConfig({ AMAZON_PUBLIC_HANDOFF_RECOVERY_ENABLED: "true" }, "api").providerAdapters
      .amazonHandoffRecoveryEnabled,
    true,
  );
  assert.throws(
    () => loadRuntimeConfig({ AMAZON_PUBLIC_HANDOFF_RECOVERY_ENABLED: "yes" }, "api"),
    /AMAZON_PUBLIC_HANDOFF_RECOVERY_ENABLED/,
  );
  assert.equal(c.providerAdapters.amazonPublicRecoveryPollMs, 60000);
  assert.equal(c.providerAdapters.amazonPublicRecoveryCooldownMs, 300000);
  assert.equal(
    loadRuntimeConfig({ AMAZON_PUBLIC_AUTO_RECOVERY_ENABLED: "false" }, "api").providerAdapters
      .amazonPublicRecoveryEnabled,
    false,
  );
  assert.throws(
    () => loadRuntimeConfig({ AMAZON_PUBLIC_AUTO_RECOVERY_COOLDOWN_MS: "0" }, "api"),
    /AMAZON_PUBLIC_AUTO_RECOVERY_COOLDOWN_MS/,
  );
});

test("opted-in handoff recovery excludes busy/denied sources and reuses only a fresh actual health receipt", async () => {
  const row = {
    id: "provider",
    version: 19,
    opened_at: opened,
    collection_task_id: task,
    recovery_health_status: "ready",
    recovery_checked_at: new Date(now.getTime() - 1000),
    recovery_provider_updated_at: opened,
  };
  const f = fixture("ready", [row], amazonPublicHandoffRecoveryTarget);
  assert.equal((await f.worker.processOnce()).status, "recovered");
  assert.equal(f.calls.filter((c) => c.probe).length, 0);
  assert.equal(f.calls.find((c) => c.recover).recover.automaticRecovery.captchaHandoff, true);
  assert.match(f.calls[0].sql, /'captcha','blocked_captcha'/);
  assert.match(f.calls[0].sql, /NOT EXISTS \(SELECT 1 FROM crawler_profile_leases/);
  assert.match(f.calls[0].sql, /h.last_checked_at>=p.updated_at/);
  assert.match(
    f.calls[0].sql,
    /h.last_error_code IN \('network_error','timeout','rate_limited','captcha','blocked_captcha','dependency_unavailable'\)/,
  );
  for (const checked of [
    opened,
    new Date(now.getTime() - 600000),
    new Date(now.getTime() + 1000),
  ]) {
    const stale = fixture(
      "blocked",
      [{ ...row, recovery_checked_at: checked }],
      amazonPublicHandoffRecoveryTarget,
    );
    assert.equal((await stale.worker.processOnce()).status, "blocked");
    assert.equal(stale.calls.filter((c) => c.probe).length, 1);
    assert.equal(stale.calls.filter((c) => c.recover).length, 0);
  }
});

test("automatic Amazon health cannot use the manual disabled-provider lease exception", async () => {
  const { AmazonPublicBrowserHealth } =
    await import("../../apps/api/dist/amazon-public-browser-health.js");
  const { MySqlCrawlerRuntimeRepository } =
    await import("../../apps/api/dist/mysql-crawler-runtime-repository.js");
  const { MySqlCredentialAssetRepository } =
    await import("../../apps/api/dist/mysql-credential-asset-repository.js");
  const profile = "00000000-0000-4000-8000-000000000003";
  const originalAcquire = MySqlCrawlerRuntimeRepository.prototype.acquire;
  const originalCipher = MySqlCredentialAssetRepository.prototype.getCipherRecord;
  const observed = [];
  MySqlCredentialAssetRepository.prototype.getCipherRecord = async () => ({});
  MySqlCrawlerRuntimeRepository.prototype.acquire = async function () {
    observed.push(this.amazonHealthProfileId);
    throw new Error("fixture_stop_before_browser");
  };
  const config = loadRuntimeConfig(
    { NODE_ENV: "test", AMAZON_PUBLIC_BROWSER_PROFILE_ID: profile },
    "api",
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
                timezone: "America/Los_Angeles",
              },
            ],
          ]
        : [[{ terms_review_status: "approved", terms_version: "reviewed", terms_permanent: 1 }]],
  };
  const provider = {
    id: "provider",
    code: "amazon_product",
    accessMode: "public_page",
    targetUrl: "https://www.amazon.com",
    timeoutMs: 1000,
  };
  try {
    for (const automatic of [false, true]) {
      const health = new AmazonPublicBrowserHealth(
        pool,
        config,
        async () =>
          new Response("User-agent: *\nAllow: /\n", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
        async () => ({ organizationId: actor, workspaceId: task }),
      );
      const result = await health.probe(provider, {
        actorId: actor,
        idempotencyKey: "fixture",
        requestId: "request",
        traceId: "trace",
        ...(automatic ? { automaticCollectionTaskId: task } : { sessionId: "session" }),
      });
      assert.equal(result.status, "degraded");
    }
    assert.deepEqual(observed, [profile, ""]);
  } finally {
    MySqlCrawlerRuntimeRepository.prototype.acquire = originalAcquire;
    MySqlCredentialAssetRepository.prototype.getCipherRecord = originalCipher;
  }
});
