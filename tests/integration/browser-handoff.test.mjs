import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import Fastify from "fastify";
import {
  BrowserHandoffStore,
  PlaywrightCrawlerEngine,
} from "../../packages/playwright-crawler/dist/index.js";
import { waitForManualCaptcha } from "../../packages/playwright-crawler/dist/manual-handoff.js";
import { installNavigationRequestTransport } from "../../packages/playwright-crawler/dist/navigation-transport.js";
import { registerBrowserHandoffRoutes } from "../../apps/api/dist/browser-handoff-routes.js";

// Owned local confirmation fixture, never a third-party CAPTCHA or production acceptance.
test("real Chromium 503 manual fixture is operated through authenticated HTTP and resumes the same cookie context", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-live-handoff-")),
    runId = randomUUID(),
    actorId = randomUUID();
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://fixture.test");
    if (url.pathname === "/verified" && url.searchParams.get("code") === "fixture") {
      res.writeHead(200, {
        "content-type": "text/html",
        "set-cookie": "fixture_verified=yes; Path=/; SameSite=Lax",
      });
      res.end("<article id='product'>verified local fixture</article>");
      return;
    }
    if (req.headers.cookie?.includes("fixture_verified=yes")) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<article id='product'>same context continued</article>");
      return;
    }
    res.writeHead(503, { "content-type": "text/html" });
    res.end(
      "<form id='manual-fixture' action='/verified'><label>Fixture code<input name='code' style='position:absolute;left:20px;top:20px;width:300px;height:50px'></label><button>Confirm local fixture</button></form>",
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`,
    store = new BrowserHandoffStore(root),
    app = Fastify();
  app.addHook("onRequest", async (r) => {
    r.headers.cookie = "scoutops_session=fixture";
  });
  registerBrowserHandoffRoutes(app, {
    root,
    webOrigin: origin,
    secureCookie: false,
    auth: {
      authenticate: async () => ({ user: { id: actorId }, session: { id: "fixture-session" } }),
    },
    authorization: { authorize: async () => {} },
    isLive: async (id) => id === runId,
    audit: async () => {},
  });
  const browser = await chromium.launch({ headless: true }),
    context = await browser.newContext(),
    page = await context.newPage();
  try {
    await installNavigationRequestTransport(context, origin, 5000);
    const engine = new PlaywrightCrawlerEngine({}),
      navigation = engine.goto(page, origin, [origin], true, async (current) => {
        if (!(await current.locator("#manual-fixture").count())) return false;
        await waitForManualCaptcha({
          root,
          runId,
          requestId: randomUUID(),
          page: current,
          captchaSelector: "#manual-fixture",
          allowedOrigins: [origin],
        });
        return true;
      });
    let items = [];
    for (let i = 0; i < 100 && !items.length; i++) {
      await new Promise((r) => setTimeout(r, 50));
      items = await store.list();
    }
    assert.equal(items.length, 1);
    const base = `/api/v1/platform/crawler-handoffs/${items[0].id}`,
      headers = { origin, "idempotency-key": randomUUID() };
    assert.equal(
      (await app.inject({ method: "POST", url: base + "/claim", headers, payload: {} })).statusCode,
      200,
    );
    const frame = await app.inject({ url: base + "/frame" });
    assert.equal(frame.statusCode, 200);
    assert.equal(frame.headers["content-type"], "image/jpeg");
    assert.ok(frame.rawPayload.length > 1000);
    for (const command of [
      { kind: "click", x: 70, y: 45 },
      { kind: "text", text: "fixture" },
      { kind: "key", key: "Enter" },
    ]) {
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: base + "/commands",
            headers: { ...headers, "idempotency-key": randomUUID() },
            payload: command,
          })
        ).statusCode,
        200,
      );
      for (let i = 0; i < 100; i++) {
        if (
          !(await stat(store.path(items[0].id, "command.json") + ".lock").then(
            () => true,
            () => false,
          ))
        )
          break;
        await new Promise((r) => setTimeout(r, 25));
      }
    }
    await navigation;
    assert.equal(await page.locator("#product").innerText(), "verified local fixture");
    await engine.goto(page, origin, [origin], true);
    assert.equal(await page.locator("#product").innerText(), "same context continued");
    assert.ok((await context.cookies()).some((c) => c.name === "fixture_verified"));
    assert.deepEqual(await readdir(root), []);
  } finally {
    await browser.close();
    await app.close();
    await new Promise((r) => server.close(r));
    await rm(root, { recursive: true, force: true });
  }
});
