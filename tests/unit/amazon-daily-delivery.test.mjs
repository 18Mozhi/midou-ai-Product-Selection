import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  withDailyAmazonDelivery,
  assertAmazonDelivery,
} from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";

const cookie = {
  name: "session-id",
  value: "anonymous-fixture",
  domain: ".amazon.com",
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
};
const context = { cookies: async () => [cookie] };
const day = () => new Date("2026-11-19T00:00:00Z");
const fixture = async (work) => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-daily-delivery-"));
  try {
    await work(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test("verified live dotted-www cookie is cached with narrower exact-host scope, never a wider allowlist", () =>
  fixture(async (root) => {
    const original={...cookie,domain:".www.amazon.com"};
    await withDailyAmazonDelivery(root,"asset","94404",state=>state.save({cookies:async()=>[original]}),undefined,day);
    let cached;
    await withDailyAmazonDelivery(root,"asset","94404",async state=>{
      assert.equal(state.cached,true);cached=state.cookies;
    },undefined,day);
    assert.deepEqual(cached,[{...original,domain:"www.amazon.com"}]);
    assert.equal(original.domain,".www.amazon.com","live context snapshot is not mutated");
    const {chromium}=await import("playwright");const browser=await chromium.launch({headless:true});
    try{
      const broad=await browser.newContext(),narrow=await browser.newContext();
      await broad.addCookies([original]);await narrow.addCookies(cached);
      // BrowserContext.cookies(url) filters by suffix, not host-only semantics.
      // Observe actual Chromium request headers on intercepted owned pages instead.
      const sendsCookie=async(context,url)=>{
        const page=await context.newPage();let sent=false;
        await page.route("**/*",async route=>{
          const headers=await route.request().allHeaders();
          sent=(headers.cookie??"").includes("session-id=anonymous-fixture");
          await route.fulfill({contentType:"text/html",body:"Fixture"});
        });
        await page.goto(url);await page.close();return sent;
      };
      assert.equal(await sendsCookie(broad,"https://child.www.amazon.com/"),true);
      assert.equal(await sendsCookie(narrow,"https://child.www.amazon.com/"),false);
      assert.equal(await sendsCookie(narrow,"https://www.amazon.com/"),true);
    }finally{await browser.close();}
    const [name]=await readdir(root);const path=join(root,name);
    const state=JSON.parse(await readFile(path,"utf8"));state.cookies=[original];
    await writeFile(path,JSON.stringify(state));
    await assert.rejects(withDailyAmazonDelivery(root,"asset","94404",()=>assert.fail("untrusted dotted domain cannot load"),undefined,day),/cache_invalid/);
  }));

test("same project identity and day reuse verified anonymous state; different day/postal/asset do not", () =>
  fixture(async (root) => {
    let preparations = 0;
    const run = (identity = "asset:1:proxy", postal = "94404", clock = day) =>
      withDailyAmazonDelivery(
        root,
        identity,
        postal,
        async (state) => {
          if (!state.cached) {
            preparations++;
            await state.save(context);
          } else assert.deepEqual(state.cookies, [cookie]);
        },
        undefined,
        clock,
      );
    await run();
    await run();
    await run();
    assert.equal(preparations, 1);
    await run("asset:1:proxy", "10001");
    await run("asset:2:proxy");
    assert.equal(preparations, 3);
    await run(undefined, undefined, () => new Date("2026-11-19T16:00:00Z"));
    assert.equal(preparations, 4, "operational day is Beijing midnight");
    assert.ok((await readdir(root)).every((name) => name.endsWith(".json")));
    if (process.platform !== "win32")
      for (const name of await readdir(root))
        assert.equal((await stat(join(root, name))).mode & 0o777, 0o600);
  }));

test("two workers serialize the first preparation and release all lock files", () =>
  fixture(async (root) => {
    let preparations = 0;
    const run = () =>
      withDailyAmazonDelivery(
        root,
        "asset:1",
        "94404",
        async (state) => {
          if (!state.cached) {
            preparations++;
            await new Promise((r) => setTimeout(r, 20));
            await state.save(context);
          }
        },
        undefined,
        day,
      );
    await Promise.all([run(), run()]);
    assert.equal(preparations, 1);
    assert.equal((await readdir(root)).length, 1);
  }));

test("failed guards and authenticated/foreign cookies cannot seed a daily proof", () =>
  fixture(async (root) => {
    await assert.rejects(
      withDailyAmazonDelivery(
        root,
        "failed",
        "94404",
        async () => {
          throw Error("guard");
        },
        undefined,
        day,
      ),
      /guard/,
    );
    assert.deepEqual(await readdir(root), []);
    for (const bad of [
      { ...cookie, name: "at-main" },
      { ...cookie, domain: "evil.test" },
      { ...cookie, domain: ".www.amazon.com.evil.test" },
      { ...cookie, name: "at-main", domain: ".www.amazon.com" },
      { ...cookie, name: "sess-at-main", domain: ".www.amazon.com" },
      { ...cookie, value: "bad\r\nheader" },
    ]) {
      await assert.rejects(
        withDailyAmazonDelivery(
          root,
          "asset",
          "94404",
          (state) => state.save({ cookies: async () => [bad] }),
          undefined,
          day,
        ),
        /cache_invalid/,
      );
      assert.deepEqual(await readdir(root), []);
    }
  }));

test("malformed cache is refused, cancellation leaves no state or lock", () =>
  fixture(async (root) => {
    await withDailyAmazonDelivery(
      root,
      "asset",
      "94404",
      (state) => state.save(context),
      undefined,
      day,
    );
    const [name] = await readdir(root);
    const path = join(root, name);
    const original = await readFile(path, "utf8");
    await writeFile(path, "not json");
    await assert.rejects(
      withDailyAmazonDelivery(
        root,
        "asset",
        "94404",
        () => assert.fail("read invalid proof"),
        undefined,
        day,
      ),
    );
    assert.equal((await readdir(root)).length, 1);
    await writeFile(path, original);
    const abort = new AbortController();
    abort.abort(Error("cancelled"));
    await assert.rejects(
      withDailyAmazonDelivery(root, "asset", "94404", () => assert.fail(), abort.signal, day),
      /cancelled/,
    );
  }));

test("cached proof still requires exact anonymous label, same origin and current postal header", async () => {
  for (const mode of ["signed_in", "origin", "postal", "captcha"]) {
    const page = {
      url: () => (mode === "origin" ? "https://evil.test" : "https://www.amazon.com/dp/B012345678"),
      getByRole: (_role, options) => {
        assert.equal(options.name, "Hello, sign in Account & Lists");
        return { isVisible: async () => mode !== "signed_in" };
      },
      locator: () => ({
        filter: ({ hasText }) => ({
          waitFor: async () => {
            assert.ok(hasText.test("Deliver to 94404"));
            if (mode === "postal") throw Error("wrong postal");
          },
        }),
      }),
    };
    await assert.rejects(
      assertAmazonDelivery(page, "94404", async () => {
        if (mode === "captcha") throw Error("captcha");
      }),
    );
  }
});

test(
  "real Chromium: daily homepage state is reused across fresh profiles, no fake detail from a shell",
  { timeout: 20000 },
  () =>
    fixture(async (root) => {
      const { chromium } = await import("playwright");
      const { PlaywrightCrawlerEngine } =
        await import("../../packages/playwright-crawler/dist/index.js");
      const { createAmazonBrowserExecutionRequest } =
        await import("../../packages/provider-sources/dist/index.js");
      const original = chromium.launchPersistentContext.bind(chromium),
        calls = [];
      const html = (ready, detail) =>
        `<html><body><a href="/ap/signin">Hello, sign in Account &amp; Lists</a><div id="glow-ingress-block">Deliver to ${ready ? "94404" : "China"}</div>${detail ? '<div id="title"><h1 id="productTitle">Clorox fixture brush set</h1></div>' : ""}</body></html>`;
      chromium.launchPersistentContext = async (...args) => {
        const ctx = await original(...args);
        await ctx.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== "https://www.amazon.com") return route.abort();
          const home = url.pathname === "/";
          const ready =
            home ||
            (await ctx.cookies(url.origin)).some(
              (c) => c.name === "session-id" && c.value === "anonymous-fixture",
            );
          calls.push(home ? "home" : "detail");
          await route.fulfill({
            status: 200,
            contentType: "text/html",
            headers: home
              ? {
                  "set-cookie":
                    "session-id=anonymous-fixture; Domain=.amazon.com; Path=/; Secure; HttpOnly; SameSite=Lax",
                }
              : {},
            body: html(ready, !home && ready),
          });
        });
        return ctx;
      };
      const limits = {
        navigationTimeoutMs: 1000,
        actionTimeoutMs: 300,
        maxPages: 1,
        maxScrolls: 0,
        maxDetails: 0,
        maxArchiveBytes: 100000,
        maxExtractedBytes: 100000,
        maxArchiveFiles: 10,
        headless: true,
      };
      const { plan } = createAmazonBrowserExecutionRequest(
        { page_url: "https://www.amazon.com/dp/B0FR7TKH1X" },
        "94404",
      );
      let i = 0;
      const run = (dailyDelivery) =>
        new PlaywrightCrawlerEngine(limits).run(
          { ...plan, max_scrolls: 0 },
          join(root, "profile-" + i++),
          { requestId: "fixture", traceId: "fixture" },
          dailyDelivery ? { dailyDelivery } : {},
        );
      try {
        const baseline = await run();
        assert.equal(baseline.item_count, 0);
        assert.notEqual(baseline.status, "succeeded");
        calls.length = 0;
        for (let n = 0; n < 2; n++) {
          const result = await withDailyAmazonDelivery(
            join(root, "state"),
            "fixture-asset:1",
            "94404",
            run,
            undefined,
            day,
          );
          assert.equal(result.status, "succeeded");
          assert.equal(result.item_count, 1);
        }
        assert.deepEqual(calls, ["home", "detail", "detail"]);
      } finally {
        chromium.launchPersistentContext = original;
      }
    }),
);
