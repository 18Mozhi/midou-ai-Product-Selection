import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlaywrightCrawlerEngine } from "../../packages/playwright-crawler/dist/index.js";
import { createAmazonBrowserExecutionRequest } from "../../packages/provider-sources/dist/index.js";

// Owned, intercepted confirmation fixture, not a third-party CAPTCHA or live acceptance.
test("Amazon human frame survives a stalled font without claim, commands or automatic verification", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-handoff-font-"));
  const launch = chromium.launchPersistentContext;
  const controller = new AbortController();
  const events = [];
  let fontWait = false,
    finished = false,
    currentPage,
    running;
  t.mock.method(console, "warn", (line) => events.push(JSON.parse(line)));
  chromium.launchPersistentContext = async function (...args) {
    const context = await launch.apply(this, args);
    await context.route("**/*", async (route) => {
      if (route.request().url().endsWith("fixture-font.woff2")) {
        await new Promise((resolve) => context.once("close", resolve));
        await route.abort().catch(() => {});
      } else {
        await route.fulfill({
          contentType: "text/html",
          body:
            '<div id="captchacharacters">Owned confirmation fixture</div><script>' +
            'const f=new FontFace("OwnedFixture","url(https://www.amazon.com/fixture-font.woff2)");' +
            'document.fonts.add(f);document.body.style.fontFamily="OwnedFixture";void f.load().catch(()=>{});</script>',
        });
      }
    });
    const patch = (page) => {
      currentPage = page;
      const screenshot = page.screenshot.bind(page);
      t.mock.method(page, "screenshot", async (...args) => {
        try {
          return await screenshot(...args);
        } catch (e) {
          fontWait =
            e.name === "TimeoutError" && e.message.includes("waiting for fonts to load...");
          throw e;
        }
      });
    };
    context.pages().forEach(patch);
    context.on("page", patch);
    return context;
  };
  try {
    const { plan } = createAmazonBrowserExecutionRequest({
      page_url: "https://www.amazon.com/dp/B000000001",
    });
    running = new PlaywrightCrawlerEngine({
      navigationTimeoutMs: 3000,
      actionTimeoutMs: 3000,
      maxPages: 1,
      maxScrolls: 0,
      maxDetails: 0,
      maxArchiveBytes: 1000000,
      maxExtractedBytes: 1000000,
      maxArchiveFiles: 20,
      headless: true,
    })
      .run(
        plan,
        join(root, "profile"),
        { requestId: "owned-fixture", traceId: "owned-fixture" },
        {
          signal: controller.signal,
          handoff: { root: join(root, "handoffs"), runId: "00000000-0000-4000-8000-000000000001" },
        },
      )
      .finally(() => {
        finished = true;
      });
    let info;
    for (let i = 0; i < 160 && !info && !finished; i++) {
      for (const name of await readdir(join(root, "handoffs")).catch(() => [])) {
        try {
          info = JSON.parse(await readFile(join(root, "handoffs", name, "info.json"), "utf8"));
        } catch {}
      }
      if (!info) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    t.diagnostic(
      JSON.stringify({ font_wait: fontWait, frame_published: Boolean(info), terminal: finished }),
    );
    assert.ok(info, "human frame unavailable; font_wait=" + fontWait);
    assert.equal(finished, false);
    assert.deepEqual([info.width, info.height], [1280, 720]);
    const files = await readdir(join(root, "handoffs", info.id));
    assert.equal(files.includes("claim.json"), false);
    assert.equal(files.includes("command.json"), false);
    const jpeg = await readFile(join(root, "handoffs", info.id, "frame.jpg"));
    assert.equal(jpeg.subarray(0, 2).toString("hex"), "ffd8");
    assert.deepEqual(
      await currentPage.evaluate(() => ({
        font: document.fonts.status,
        family: document.body.style.fontFamily,
        challenge: Boolean(document.querySelector("#captchacharacters")),
      })),
      { font: "loading", family: "OwnedFixture", challenge: true },
    );
  } finally {
    controller.abort();
    if (running) {
      const result = await running;
      assert.equal(result.status, "blocked_captcha");
      assert.equal(result.artifacts, undefined);
    }
    chromium.launchPersistentContext = launch;
    await rm(root, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
  }
});
