import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import {
  BrowserHandoffStore,
  validHandoffCommand,
  PlaywrightCrawlerEngine,
} from "../../packages/playwright-crawler/dist/index.js";
import { waitForManualCaptcha } from "../../packages/playwright-crawler/dist/manual-handoff.js";
import { registerBrowserHandoffRoutes } from "../../apps/api/dist/browser-handoff-routes.js";
import { browserHandoffRunLive } from "../../apps/api/dist/browser-handoff-routes.js";

test("handoff lease checks use the same Date serialization as the lease producer", async () => {
  const now = new Date("2026-10-20T13:52:00Z"),
    id = randomUUID();
  let rows = [{ id }];
  const pool = {
    query: async (sql, parameters) => {
      assert.match(sql, /r\.status='running'/);
      assert.match(sql, /l\.expires_at>\?/);
      assert.doesNotMatch(sql, /UTC_TIMESTAMP|NOW\(/);
      assert.deepEqual(parameters, [id, now]);
      return [rows];
    },
  };
  assert.equal(await browserHandoffRunLive(pool, id, now), true);
  rows = [];
  assert.equal(await browserHandoffRunLive(pool, id, now), false);
});

test("HTTP 503 guard precedes network failure, while 429 still stops immediately", async () => {
  const engine = new PlaywrightCrawlerEngine({}),
    origin = "https://www.amazon.com";
  let status = 503,
    guarded = 0;
  const page = { goto: async () => ({ status: () => status }), url: () => origin + "/s?k=box" };
  await engine.goto(page, origin, [origin], true, async () => {
    guarded++;
    return true;
  });
  assert.equal(guarded, 1);
  await assert.rejects(
    engine.goto(page, origin, [origin], true, async () => false),
    (e) => e.code === "network_error" && e.httpStatus === 503,
  );
  status = 429;
  await assert.rejects(
    engine.goto(page, origin, [origin], true, async () => {
      assert.fail("429 cannot be bypassed by handoff");
    }),
    (e) => e.code === "rate_limited",
  );
});

test("real-context handoff applies only bounded operator input, resumes and removes IPC", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-handoff-test-")),
    runId = randomUUID(),
    store = new BrowserHandoffStore(root);
  let challenge = true,
    clicks = 0,
    screenshot = 0;
  const page = {
    url: () => "https://www.amazon.com/errors/validateCaptcha",
    setViewportSize: async () => {},
    locator: (s) => ({ count: async () => (s.includes("password") ? 0 : Number(challenge)) }),
    screenshot: async () => {
      screenshot++;
      return Buffer.from("frame");
    },
    waitForLoadState: async () => {},
    mouse: {
      click: async () => {
        clicks++;
        challenge = false;
      },
    },
    keyboard: {},
  };
  const running = waitForManualCaptcha({
    root,
    runId,
    requestId: randomUUID(),
    page,
    captchaSelector: "#captcha",
    allowedOrigins: ["https://www.amazon.com"],
  });
  try {
    let items = [];
    for (let i = 0; i < 100 && !items.length; i++) {
      await new Promise((r) => setTimeout(r, 10));
      items = await store.list();
    }
    assert.equal(items[0].run_id, runId);
    assert.ok(screenshot > 0);
    assert.equal((await store.frame(items[0].id)).toString(), "frame");
    await store.command(items[0].id, { kind: "click", x: 10, y: 20 }, randomUUID());
    await running;
    assert.equal(clicks, 1);
    assert.deepEqual(await readdir(root), []);
    for (const command of [
      { kind: "navigate", url: "http://127.0.0.1" },
      { kind: "text", text: "x".repeat(101) },
      { kind: "key", key: "Control+L" },
      { kind: "click", x: 1280, y: 0 },
    ])
      assert.equal(validHandoffCommand(command), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("challenge marker disappearing does not resume before normal page readiness", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-handoff-test-"));
  const store = new BrowserHandoffStore(root);
  let ready = false,
    settled = false,
    clicks = 0;
  const page = {
    url: () => "https://www.amazon.com/errors/validateCaptcha",
    setViewportSize: async () => {},
    locator: () => ({ count: async () => 0 }),
    waitForLoadState: async () => {},
    screenshot: async () => Buffer.from("waiting-page"),
    mouse: {
      click: async () => {
        clicks++;
        ready = true;
      },
    },
  };
  const running = waitForManualCaptcha({
    root,
    runId: randomUUID(),
    requestId: randomUUID(),
    page,
    captchaSelector: "#captcha",
    allowedOrigins: ["https://www.amazon.com"],
    isReady: async () => ready,
  }).then(() => {
    settled = true;
  });
  try {
    let items = [];
    for (let i = 0; i < 100 && !items.length; i++) {
      await new Promise((r) => setTimeout(r, 10));
      items = await store.list();
    }
    assert.equal(items.length, 1);
    assert.equal(settled, false);
    assert.equal((await store.frame(items[0].id)).toString(), "waiting-page");
    await store.command(items[0].id, { kind: "click", x: 10, y: 20 }, randomUUID());
    await running;
    assert.equal(clicks, 1);
    assert.equal(settled, true);
    assert.deepEqual(await readdir(root), []);
  } finally {
    ready = true;
    await running;
    await rm(root, { recursive: true, force: true });
  }
});

test("operator routes require superadmin, origin, live lease, exclusive session and bounded commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-handoff-routes-")),
    id = randomUUID(),
    runId = randomUUID();
  const dir = join(root, id);
  await mkdir(dir);
  const info = {
    id,
    run_id: runId,
    request_id: randomUUID(),
    hostname: "www.amazon.com",
    expires_at: new Date(Date.now() + 300000).toISOString(),
    updated_at: new Date().toISOString(),
    width: 1280,
    height: 720,
  };
  await writeFile(join(dir, "info.json"), JSON.stringify(info));
  await writeFile(join(dir, "frame.jpg"), "actual-frame");
  const audit = [],
    caps = [];
  let authorized = true,
    live = true,
    session = "first";
  // Stable actor; distinct sessions of the same actor must still be excluded.
  const actorId = randomUUID();
  const app2 = Fastify();
  app2.setErrorHandler((e, _r, reply) => reply.code(e.statusCode ?? 500).send({ code: e.code }));
  registerBrowserHandoffRoutes(app2, {
    root,
    webOrigin: "https://scout.test",
    secureCookie: false,
    auth: { authenticate: async () => ({ user: { id: actorId }, session: { id: session } }) },
    authorization: {
      authorize: async (i) => {
        caps.push(i.capability);
        if (!authorized) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
      },
    },
    isLive: async () => live,
    audit: async (e) => audit.push(e),
  });
  app2.addHook("onRequest", async (r) => {
    r.headers.cookie = "scoutops_session=test";
  });
  const base = "/api/v1/platform/crawler-handoffs",
    headers = { origin: "https://scout.test", "idempotency-key": randomUUID() };
  try {
    authorized = false;
    assert.equal((await app2.inject({ url: base })).statusCode, 403);
    authorized = true;
    assert.equal(
      (
        await app2.inject({
          method: "POST",
          url: base + "/" + id + "/claim",
          headers: { ...headers, origin: "https://evil.test" },
          payload: {},
        })
      ).statusCode,
      403,
    );
    assert.equal((await app2.inject({ url: base + "/" + id + "/frame" })).statusCode, 409);
    assert.equal(
      (await app2.inject({ method: "POST", url: base + "/" + id + "/claim", headers, payload: {} }))
        .statusCode,
      200,
    );
    assert.equal((await app2.inject({ url: base + "/" + id + "/frame" })).body, "actual-frame");
    session = "second";
    assert.equal(
      (await app2.inject({ method: "POST", url: base + "/" + id + "/claim", headers, payload: {} }))
        .statusCode,
      409,
    );
    session = "first";
    assert.equal(
      (
        await app2.inject({
          method: "POST",
          url: base + "/" + id + "/commands",
          headers,
          payload: { kind: "text", text: "SECRET-CAPTCHA" },
        })
      ).statusCode,
      200,
    );
    assert.ok(!JSON.stringify(audit).includes("SECRET-CAPTCHA"));
    assert.equal(
      (
        await app2.inject({
          method: "POST",
          url: base + "/" + id + "/commands",
          headers,
          payload: { kind: "navigate", url: "http://127.0.0.1" },
        })
      ).statusCode,
      400,
    );
    live = false;
    assert.equal((await app2.inject({ url: base + "/" + id + "/frame" })).statusCode, 410);
    assert.ok(caps.every((x) => x === "platform:superadmin"));
    const store = new BrowserHandoffStore(root);
    await assert.rejects(store.info("../../etc/passwd"));
    await writeFile(join(dir, "info.json"), JSON.stringify({ ...info, updated_at: "invalid" }));
    assert.deepEqual(await store.list(), []);
  } finally {
    await app2.close();
    await rm(root, { recursive: true, force: true });
  }
});

test(
  "real Chromium: Amazon WAF marker enters only existing human handoff; ordinary 202 stays failure",
  { timeout: 25000 },
  async () => {
    const { chromium } = await import("playwright");
    const { createAmazonBrowserExecutionRequest } =
      await import("../../packages/provider-sources/dist/index.js");
    const root = await mkdtemp(join(tmpdir(), "scoutops-waf-handoff-"));
    const original = chromium.launchPersistentContext.bind(chromium);
    let challenge = true,
      contexts = 0;
    const ready =
      '<a href="/ap/signin">Hello, sign in Account &amp; Lists</a><div id="glow-ingress-block">Deliver to 94404</div><div id="title"><h1 id="productTitle">Local fixture brush</h1></div>';
    chromium.launchPersistentContext = async (...args) => {
      const ctx = await original(...args);
      contexts++;
      await ctx.route("**/*", (route) =>
        route.fulfill({
          status: 202,
          headers: { "x-amzn-waf-action": "challenge" },
          contentType: "text/html",
          body: challenge
            ? `<html><body><script type="text/plain" src="https://fixture.token.awswaf.com/local/challenge.js"></script><button onclick='document.body.innerHTML=${JSON.stringify(ready)}'>Local operator confirmation</button></body></html>`
            : "<html><body>ordinary unavailable fixture</body></html>",
        }),
      );
      return ctx;
    };
    const limits = {
      navigationTimeoutMs: 1000,
      actionTimeoutMs: 300,
      maxPages: 1,
      maxScrolls: 0,
      maxDetails: 0,
      headless: true,
    };
    const { plan } = createAmazonBrowserExecutionRequest(
      { page_url: "https://www.amazon.com/dp/B0FR7TKH1X" },
      "94404",
    );
    const handoffs = join(root, "handoffs"),
      store = new BrowserHandoffStore(handoffs);
    const run = (options) =>
      new PlaywrightCrawlerEngine(limits).run(
        { ...plan, max_scrolls: 0 },
        join(root, "profile-" + contexts),
        { requestId: randomUUID(), traceId: randomUUID() },
        {
          ...options,
          dailyDelivery: {
            cookies: [],
            cached: true,
            save: async () => assert.fail("cached fixture must not save"),
          },
        },
      );
    try {
      const blocked = await run({});
      assert.equal(blocked.status, "blocked_captcha");
      assert.equal(blocked.item_count, 0);
      const controller = new AbortController();
      const running = run({
        handoff: { root: handoffs, runId: randomUUID() },
        signal: controller.signal,
      });
      try {
        let live = [];
        for (let i = 0; i < 200 && !live.length; i++) {
          await new Promise((r) => setTimeout(r, 10));
          live = await store.list();
        }
        assert.equal(live.length, 1);
        assert.ok((await store.frame(live[0].id)).length > 0);
        // Only this self-owned local fixture is clicked. No third-party challenge is solved.
        await store.command(live[0].id, { kind: "click", x: 90, y: 18 }, randomUUID());
        const result = await running;
        assert.equal(result.status, "succeeded");
        assert.equal(result.item_count, 1);
        assert.deepEqual(await store.list(), []);
      } finally {
        controller.abort();
        await running.catch(() => {});
      }
      challenge = false;
      const ordinary = await run({ handoff: { root: handoffs, runId: randomUUID() } });
      assert.notEqual(ordinary.status, "succeeded");
      assert.equal(ordinary.item_count, 0);
      assert.deepEqual(await store.list(), []);
    } finally {
      chromium.launchPersistentContext = original;
      await rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "claim hook waits for original valid claim, runs once and retains original deadline",
  { timeout: 10000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "scoutops-claim-hook-")),
      store = new BrowserHandoffStore(root),
      controller = new AbortController();
    let ready = false,
      calls = 0;
    const page = {
      url: () => "https://www.amazon.com/",
      locator: (s) => ({ count: async () => (s.includes("password") ? 0 : Number(!ready)) }),
      setViewportSize: async () => {},
      screenshot: async () => Buffer.from("frame"),
      waitForLoadState: async () => {},
    };
    const deadline = setTimeout(() => controller.abort(new Error("local fixture deadline")), 3000);
    const running = waitForManualCaptcha({
      root,
      runId: randomUUID(),
      requestId: randomUUID(),
      page,
      captchaSelector: "#captcha",
      allowedOrigins: ["https://www.amazon.com"],
      signal: controller.signal,
      isReady: async () => ready,
      onClaim: async (expires) => {
        calls++;
        assert.ok(expires > Date.now() && expires <= Date.now() + 300000);
        ready = true;
      },
    });
    try {
      let list = [];
      for (let i = 0; i < 100 && !list.length; i++) {
        await new Promise((r) => setTimeout(r, 10));
        list = await store.list();
      }
      assert.equal(list.length, 1);
      assert.equal(calls, 0);
      const claim = store.path(list[0].id, "claim.json");
      await writeFile(claim, JSON.stringify({ actorId: "forged", session: "a".repeat(64) }));
      await new Promise((r) => setTimeout(r, 600));
      assert.equal(calls, 0);
      await writeFile(claim, JSON.stringify({ actorId: randomUUID(), session: "a".repeat(64) }));
      await running;
      assert.equal(calls, 1);
      assert.deepEqual(await store.list(), []);
    } finally {
      clearTimeout(deadline);
      controller.abort();
      await running.catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
  },
);

for (const finalStatus of [200, 429])
  test(
    `real Chromium: exact WAF reload requires claimed handoff and preserves result ${finalStatus}`,
    { timeout: 20000 },
    async () => {
      const { chromium } = await import("playwright"),
        { createAmazonBrowserExecutionRequest } =
          await import("../../packages/provider-sources/dist/index.js");
      const root = await mkdtemp(join(tmpdir(), "scoutops-claimed-waf-")),
        original = chromium.launchPersistentContext.bind(chromium),
        store = new BrowserHandoffStore(join(root, "handoffs")),
        controller = new AbortController();
      let documents = 0;
      chromium.launchPersistentContext = async (...args) => {
        const ctx = await original(...args);
        await ctx.route("**/*", (route) => {
          if (new URL(route.request().url()).origin !== "https://www.amazon.com")
            return route.abort();
          documents++;
          return route.fulfill({
            status: documents === 1 ? 202 : finalStatus,
            headers: documents === 1 ? { "x-amzn-waf-action": "challenge" } : {},
            contentType: "text/html",
            body:
              documents === 1
                ? '<html><body><script type="text/plain" src="https://1c5c1ecf7303.eb59107c.us-west-1.token.awswaf.com/fixture/challenge.js"></script></body></html>'
                : finalStatus === 429
                  ? "<html><body>local rate limit fixture</body></html>"
                  : '<html><body><a href="/ap/signin">Hello, sign in Account &amp; Lists</a><div id="glow-ingress-block">Deliver to 94404</div><div id="title"><h1 id="productTitle">Local brush fixture</h1></div><script type="text/plain" src="https://1c5c1ecf7303.eb59107c.us-west-1.token.awswaf.com/fixture/challenge.js"></script></body></html>',
          });
        });
        return ctx;
      };
      const { plan } = createAmazonBrowserExecutionRequest(
        { page_url: "https://www.amazon.com/dp/B0FR7TKH1X" },
        "94404",
      );
      const deadline = setTimeout(
        () => controller.abort(new Error("local fixture deadline")),
        6000,
      );
      const running = new PlaywrightCrawlerEngine({
        headless: true,
        navigationTimeoutMs: 1000,
        actionTimeoutMs: 300,
        maxPages: 1,
        maxScrolls: 0,
        maxDetails: 0,
      }).run(
        { ...plan, max_scrolls: 0 },
        join(root, "profile"),
        { requestId: randomUUID(), traceId: randomUUID() },
        {
          signal: controller.signal,
          handoff: { root: store.root, runId: randomUUID() },
          proxy: { server: "http://127.0.0.1:9", username: "fixture", password: "fixture" },
          dailyDelivery: { cached: true, cookies: [], save: async () => assert.fail() },
        },
      );
      try {
        let list = [];
        for (let i = 0; i < 200 && !list.length; i++) {
          await new Promise((r) => setTimeout(r, 10));
          list = await store.list();
        }
        assert.equal(list.length, 1);
        assert.equal(documents, 1);
        await new Promise((r) => setTimeout(r, 600));
        assert.equal(documents, 1);
        await writeFile(
          store.path(list[0].id, "claim.json"),
          JSON.stringify({ actorId: randomUUID(), session: "a".repeat(64) }),
        );
        const result = await running;
        assert.equal(documents, 2);
        assert.equal(result.status, finalStatus === 200 ? "succeeded" : "rate_limited");
        assert.equal(result.item_count, finalStatus === 200 ? 1 : 0);
        assert.deepEqual(await store.list(), []);
      } finally {
        clearTimeout(deadline);
        controller.abort();
        await running.catch(() => {});
        chromium.launchPersistentContext = original;
        await rm(root, { recursive: true, force: true });
      }
    },
  );
