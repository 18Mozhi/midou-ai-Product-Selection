import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { installNavigationRequestTransport } from "../../packages/playwright-crawler/dist/navigation-transport.js";

test("navigation relay preserves real response status/body, browser identity, cookies, form payload and redirects without retrying", async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({
      path: req.url,
      method: req.method,
      headers: req.headers,
      body: Buffer.concat(chunks).toString(),
    });
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("x-origin-response", "unchanged");
    if (req.url === "/compressed") {
      const body = gzipSync(Buffer.from("<h1 id='compressed'>actual compressed response</h1>"));
      res.setHeader("content-encoding", "gzip");
      res.setHeader("content-length", body.length);
      res.end(body);
      return;
    }
    if (req.url === "/bootstrap") {
      res.setHeader("set-cookie", "fixture_session=server-created; Path=/; SameSite=Lax");
      res.end("bootstrap");
      return;
    }
    if (req.url === "/payload") {
      res.end(
        "<h1 id='actual'>actual upstream content</h1><form action='/submit' method='post'><input name='literal' value='exact'><button>Submit fixture</button></form><script>fetch('/resource')</script>",
      );
      return;
    }
    if (req.url === "/submit") {
      res.statusCode = 201;
      res.setHeader("set-cookie", "fixture_applied=yes; Path=/; SameSite=Lax");
      res.end("<h1 id='receipt'>actual submit response</h1>");
      return;
    }
    if (req.url === "/redirect") {
      res.statusCode = 302;
      res.setHeader("location", "/payload");
      res.end();
      return;
    }
    const status = Number(req.url?.slice(1));
    if ([403, 429, 503].includes(status)) {
      res.statusCode = status;
      res.end(
        "<div id='actual-status'>upstream block</div><form id='fixture-captcha'>unchanged fixture marker</form>",
      );
      return;
    }
    res.end("resource");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`,
    browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
        extraHTTPHeaders: { "x-fixture-marker": "preserved" },
      }),
      page = await context.newPage();
    await page.goto(origin + "/bootstrap");
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await installNavigationRequestTransport(context, origin, 5000);
    const resource = page.waitForResponse((r) => r.url() === origin + "/resource");
    let response = await page.goto(origin + "/payload");
    await resource;
    assert.equal(await page.locator("#actual").innerText(), "actual upstream content");
    assert.equal(response.status(), 200);
    assert.equal(await response.headerValue("x-origin-response"), "unchanged");
    await Promise.all([
      page.waitForNavigation(),
      page.getByRole("button", { name: "Submit fixture" }).click(),
    ]);
    assert.equal(await page.locator("#receipt").innerText(), "actual submit response");
    const post = requests.find((r) => r.path === "/submit");
    assert.equal(post.method, "POST");
    assert.equal(post.body, "literal=exact");
    assert.ok(
      (await context.cookies()).some((c) => c.name === "fixture_applied" && c.value === "yes"),
    );
    await page.goto(origin + "/compressed");
    assert.equal(await page.locator("#compressed").innerText(), "actual compressed response");
    for (const code of [403, 429, 503]) {
      response = await page.goto(origin + "/" + code);
      assert.equal(response.status(), code);
      assert.equal(await page.locator("#fixture-captcha").count(), 1);
      assert.equal(requests.filter((r) => r.path === "/" + code).length, 1);
    }
    await page.goto(origin + "/redirect");
    assert.equal(page.url(), origin + "/payload");
    assert.equal(requests.filter((r) => r.path === "/redirect").length, 1);
    for (const request of requests.filter((r) =>
      ["/payload", "/submit", "/403", "/429", "/503"].includes(r.path),
    )) {
      assert.equal(request.headers["user-agent"], userAgent);
      assert.equal(request.headers["x-fixture-marker"], "preserved");
      assert.match(request.headers.cookie, /fixture_session=server-created/);
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
});
