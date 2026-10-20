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
