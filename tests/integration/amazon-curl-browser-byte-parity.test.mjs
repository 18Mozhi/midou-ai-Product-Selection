import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { createGzip, gzipSync, constants } from "node:zlib";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { installPublicHttpTransport } from "../../packages/playwright-crawler/dist/public-http-transport.js";

const sha = (body) => createHash("sha256").update(body).digest("hex");
const head =
  '<html><head><meta charset="utf-8"></head><body><a href="/ap/signin">Hello, sign in Account &amp; Lists</a><div id="glow-ingress-block">Deliver to San Mateo 94404</div>';
const tail =
  '<div id="title"><h1 id="productTitle">Owned 中文 café product</h1></div><script>document.documentElement.dataset.ownedParsed="yes"</script></body></html>';

// This is a representation/stdio/Chromium test, not a real Amazon replay. Only
// the factory in the owned fixture can route to this dynamically bound loopback
// server. No production credential/profile/DB, Amazon request or TLS bypass.
for (const mode of [
  "identity",
  "gzip",
  "chunked",
  "gzip_chunked",
  "utf16",
  "source_shell",
  "truncated",
]) {
  test(`real curl0.7.4 -> Python helper -> stdio -> Chromium: ${mode}`, async () => {
    const requests = [];
    const html =
      mode === "source_shell"
        ? head + "</body></html>"
        : mode === "utf16"
          ? (head + tail).replace('charset="utf-8"', 'charset="utf-16le"')
          : head + tail;
    const expected =
      mode === "utf16"
        ? Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(html, "utf16le")])
        : Buffer.from(html);
    const server = createServer((req, res) => {
      requests.push(req.url);
      assert.equal(req.url, `/${mode}`);
      res.setHeader(
        "content-type",
        mode === "utf16" ? "text/html; charset=utf-16le" : "text/html; charset=utf-8",
      );
      res.setHeader("set-cookie", [
        "owned-a=1; Path=/; Secure; SameSite=Lax",
        "owned-b=2; Path=/; Secure; SameSite=Lax",
      ]);
      if (mode === "gzip") {
        const compressed = gzipSync(expected);
        res.setHeader("content-encoding", "gzip");
        res.setHeader("content-length", compressed.length);
        res.end(compressed);
      } else if (mode === "gzip_chunked") {
        res.setHeader("content-encoding", "gzip");
        const gzip = createGzip();
        gzip.pipe(res);
        gzip.write(head);
        gzip.flush(constants.Z_SYNC_FLUSH);
        setTimeout(() => gzip.end(tail), 200);
      } else if (mode === "chunked" || mode === "truncated") {
        res.write(head);
        setTimeout(() => (mode === "truncated" ? res.destroy() : res.end(tail)), 200);
      } else {
        res.setHeader("content-length", expected.length);
        res.end(expected);
      }
    });
    let browser;
    try {
      await new Promise((done) => server.listen(0, "127.0.0.1", done));
      const port = server.address().port;
      const python = execFileSync("python", ["-c", "import sys; print(sys.executable)"], {
        encoding: "utf8",
      }).trim();
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      let fulfilledBody;
      const register = context.route.bind(context);
      context.route = async (matcher, handler) =>
        register(matcher, async (route) => {
          const fulfill = route.fulfill.bind(route);
          route.fulfill = async (options) => {
            fulfilledBody = options.body;
            return fulfill(options);
          };
          return handler(route);
        });
      await installPublicHttpTransport(
        context,
        python,
        resolve("tests/fixtures/curl-document/scoutops_crawler/public_http.py"),
        3000,
      );
      const page = await context.newPage();
      const statuses = [];
      page.on("response", (r) => statuses.push(r.status()));
      const target = `https://www.amazon.com/dp/B0H8GWY1HV?owned_port=${port}&owned_case=${mode}`;
      // The one owned top-frame request falls through to the stdio transport.
      // All favicon, subresource or unexpected navigation attempts are aborted,
      // never passed to Chromium's actual network stack.
      await register("**/*", (route) => {
        const request = route.request();
        if (
          request.url() === target &&
          request.isNavigationRequest() &&
          request.frame().parentFrame() === null
        )
          return route.fallback();
        return route.abort();
      });
      if (mode === "truncated") {
        await assert.rejects(page.goto(target, { waitUntil: "domcontentloaded", timeout: 10000 }));
        assert.deepEqual(
          statuses,
          [],
          "partial curl stream must not be fulfilled as a complete HTTP200 document",
        );
        assert.equal(await page.locator("#productTitle").count(), 0);
      } else {
        const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 10000 });
        assert.equal(response.status(), 200);
        const headers = response.headers();
        const body = await response.body();
        assert.equal(
          sha(fulfilledBody),
          sha(expected),
          "helper/base64/Node preserve every representation byte passed to real route.fulfill",
        );
        // Chromium/CDP returns text as a UTF8 string, not the original UTF16
        // representation. Compare raw bytes at fulfill and parsed text here.
        assert.equal(sha(body), sha(mode === "utf16" ? Buffer.from(html) : expected));
        assert.equal(
          headers["x-owned-helper-sha256"],
          sha(expected),
          "Python and Chromium see the same bytes",
        );
        assert.equal(
          headers["content-encoding"],
          undefined,
          "decoded representation must not be decoded twice",
        );
        assert.equal(headers["transfer-encoding"], undefined);
        assert.equal(Number(headers["content-length"]), expected.length);
        if (mode === "source_shell") {
          assert.equal(await page.locator("#productTitle").count(), 0);
          assert.equal(await page.evaluate(() => document.readyState), "complete");
        } else {
          assert.equal(
            await page.locator("#productTitle").textContent(),
            "Owned 中文 café product",
          );
          assert.equal(await page.locator("html").getAttribute("data-owned-parsed"), "yes");
        }
        assert.match(await page.locator("#glow-ingress-block").textContent(), /94404/);
        assert.deepEqual((await context.cookies()).map((c) => c.name).sort(), [
          "owned-a",
          "owned-b",
        ]);
      }
      assert.deepEqual(requests, [`/${mode}`], "no implicit retry or second source request");
    } finally {
      await browser?.close();
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    }
  });
}
