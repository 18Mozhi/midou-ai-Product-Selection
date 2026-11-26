import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import * as crawler from "../../packages/playwright-crawler/dist/index.js";
const { PlaywrightCrawlerEngine, validAmazonAdministratorCookies } = crawler;
import { createAmazonBrowserExecutionRequest } from "../../packages/provider-sources/dist/index.js";
const cookie = (name) => ({
  name,
  value: "owned-login-fixture",
  domain: ".amazon.com",
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
});
const cookies = [cookie("at-main"), cookie("sess-at-main")];
test("administrator cookie validator rejects missing, expired, unsafe or foreign identity", () => {
  assert.equal(validAmazonAdministratorCookies(cookies), true);
  for (const bad of [
    [],
    [cookie("session-id")],
    cookies.map((c) => ({ ...c, domain: ".com" })),
    cookies.map((c) => ({ ...c, domain: ".amazon.com.evil.test" })),
    cookies.map((c) => ({ ...c, expires: 1 })),
    cookies.map((c) => ({ ...c, value: "private\r\n" })),
    cookies.map((c) => ({ ...c, path: "/ap/" })),
  ])
    assert.equal(validAmazonAdministratorCookies(bad), false);
});
for (const mode of [
  "login",
  "anonymous",
  "expired",
  "signed_out",
  "captcha",
  "wrong_postal",
  "search",
]) {
  test(`administrator session ${mode} preserves evidence and explicit isolation`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "scoutops-admin-cookie-")),
      launch = chromium.launchPersistentContext,
      requests = [];
    t.mock.method(console, "warn", () => {});
    t.mock.method(chromium, "launchPersistentContext", async (...args) => {
      const context = await launch.apply(chromium, args);
      await context.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        assert.equal(u.origin, "https://www.amazon.com");
        requests.push(u.pathname);
        const privateHead =
          '<header style="height:100px;background:red"><a id="nav-link-accountList" href="/gp/css/homepage.html">PRIVATE-ADMIN-NAME</a><div id="glow-ingress-block">Deliver to PRIVATE-ADDRESS ' +
          (mode === "wrong_postal" ? "10001" : "94404") +
          "</div></header>";
        const product =
          mode === "search"
            ? '<div id="search" style="background:rgb(0,200,0);padding:16px"><div data-component-type="s-search-result" data-asin="B0H8GWY1HV">Owned public product</div></div>'
            : '<div id="centerCol"><input id="ASIN" value="B0H8GWY1HV"><div id="title" style="background:rgb(0,200,0);padding:16px"><h1 id="productTitle">Owned public product</h1></div></div><div id="leftCol"><img id="landingImage" alt="Owned"></div>';
        await route.fulfill({
          contentType: "text/html",
          body:
            (mode === "signed_out"
              ? '<a href="/ap/signin">Hello, sign in Account &amp; Lists</a>'
              : "") +
            privateHead +
            (mode === "captcha" ? '<input id="captchacharacters">' : product),
        });
      });
      return context;
    });
    try {
      const { plan } = createAmazonBrowserExecutionRequest(
        mode === "search"
          ? { query: "owned" }
          : { page_url: "https://www.amazon.com/dp/B0H8GWY1HV" },
      );
      if (mode !== "anonymous") plan.amazon_delivery.session_mode = "administrator_cookie";
      const result = await new PlaywrightCrawlerEngine({
        navigationTimeoutMs: 1000,
        actionTimeoutMs: 1000,
        maxPages: 1,
        maxScrolls: 0,
        maxDetails: 0,
        maxArchiveBytes: 1024,
        maxExtractedBytes: 1024,
        maxArchiveFiles: 1,
        headless: true,
      }).run(
        plan,
        root,
        { requestId: "owned", traceId: "owned" },
        { cookies: mode === "expired" ? cookies.map((c) => ({ ...c, expires: 1 })) : cookies },
      );
      const expected =
        mode === "captcha"
          ? "blocked_captcha"
          : ["anonymous", "expired", "signed_out"].includes(mode)
            ? "blocked_login"
            : mode === "wrong_postal"
              ? "timeout"
              : "succeeded";
      assert.equal(result.status, expected);
      assert.ok(requests.length <= 1, "no home, GLUX, retry or address operation");
      if (expected === "succeeded") {
        assert.equal(result.item_count, 1);
        const dom = result.artifacts.find((a) => a.kind === "dom_fragment");
        assert.doesNotMatch(
          Buffer.from(dom.content_base64, "base64").toString(),
          /PRIVATE-|at-main|sess-at-main/,
        );
        assert.match(Buffer.from(dom.content_base64, "base64").toString(), /Owned public product/);
        const jpg = result.artifacts.find((a) => a.kind === "screenshot");
        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          const pixel = await page.evaluate(async (src) => {
            const img = new Image();
            img.src = src;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            c.getContext("2d").drawImage(img, 0, 0);
            return {
              height: img.height,
              color: Array.from(c.getContext("2d").getImageData(1, 1, 1, 1).data),
            };
          }, "data:image/jpeg;base64," + jpg.content_base64);
          assert.ok(
            pixel.color[1] > pixel.color[0] + 80,
            "real crop starts in public green region, not private red navbar",
          );
          assert.ok(pixel.height < 300);
        } finally {
          await browser.close();
        }
      } else assert.equal(result.artifacts, undefined);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
    }
  });
}

// Real pinned Python/curl helper with an owned loopback response; no Amazon egress.
test("administrator Cookie survives Chromium -> Python curl -> parsed browser DOM", async () => {
  const { createServer } = await import("node:http");
  const { execFileSync } = await import("node:child_process");
  const { resolve } = await import("node:path");
  const { installPublicHttpTransport } =
    await import("../../packages/playwright-crawler/dist/public-http-transport.js");
  const { assertAmazonAdministratorDelivery } =
    await import("../../packages/playwright-crawler/dist/amazon-administrator-session.js");
  const received = [];
  const server = createServer((req, res) => {
    received.push({ path: req.url, cookie: req.headers.cookie });
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader(
      "set-cookie",
      "at-main=owned-renewed; Domain=.amazon.com; Path=/; Secure; HttpOnly; SameSite=Lax",
    );
    res.end(
      '<html><body><div id="glow-ingress-block">Deliver to OWNED-PRIVATE 94404</div><h1 id="productTitle">Owned curl cookie product</h1></body></html>',
    );
  });
  let browser;
  try {
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const port = server.address().port;
    const python = execFileSync("python", ["-B", "-c", "import sys;print(sys.executable)"], {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addCookies(cookies);
    await installPublicHttpTransport(
      context,
      python,
      resolve("tests/fixtures/curl-document/scoutops_crawler/public_http.py"),
      3000,
    );
    const target = `https://www.amazon.com/dp/B0H8GWY1HV?owned_port=${port}&owned_case=identity`;
    await context.route("**/*", (route) =>
      route.request().url() === target ? route.fallback() : route.abort(),
    );
    const page = await context.newPage();
    const response = await page.goto(target);
    assert.equal(response.status(), 200);
    assert.equal(received.length, 1);
    assert.equal(received[0].path, "/identity");
    assert.match(received[0].cookie, /(?:^|; )at-main=owned-login-fixture(?:;|$)/);
    assert.match(received[0].cookie, /(?:^|; )sess-at-main=owned-login-fixture(?:;|$)/);
    await assertAmazonAdministratorDelivery(page, "94404", async () => {});
    assert.equal(await page.locator("#productTitle").innerText(), "Owned curl cookie product");
    assert.equal(
      (await context.cookies(target)).find((c) => c.name === "at-main").value,
      "owned-renewed",
    );
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
