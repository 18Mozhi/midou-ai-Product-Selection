import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { installPublicHttpTransport } from "../../packages/playwright-crawler/dist/public-http-transport.js";

test("actual Chromium receives stdio response status, challenge and both session cookies without login", async () => {
  const python = execFileSync("python", ["-c", "import sys; print(sys.executable)"], {
    encoding: "utf8",
  }).trim();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await installPublicHttpTransport(
      context,
      python,
      resolve("tests/fixtures/scoutops_crawler/public_http.py"),
      1000,
    );
    const page = await context.newPage();
    const response = await page.goto("https://www.amazon.com/dp/B000000001/", {
      waitUntil: "domcontentloaded",
    });
    assert.equal(response.status(), 503);
    assert.equal(await page.locator("#captchacharacters").count(), 1);
    assert.deepEqual((await context.cookies()).map((c) => c.name).sort(), [
      "fixture-a",
      "fixture-b",
    ]);
    await context.close();
  } finally {
    await browser.close();
  }
});
