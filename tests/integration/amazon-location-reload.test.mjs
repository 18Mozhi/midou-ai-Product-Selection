import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { prepareAmazonDeliveryContext } from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";

test("observed main-frame location-link reload permits exactly one guarded modal reopening", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ["ready", "never_ready", "signed_in_after_reload", "captcha_after_reload"]) {
      const page = await browser.newPage();
      page.setDefaultTimeout(300);
      page.setDefaultNavigationTimeout(2000);
      let requests = 0;
      await page.route("**/*", async (route) => {
        requests++;
        const verified = route.request().headers().cookie?.includes("fixture_region=94404");
        const account =
          requests > 1 && mode === "signed_in_after_reload"
            ? "Hello, Fixture"
            : "Hello, sign in Account &amp; Lists";
        const modal = requests > 1 && mode === "ready";
        await route.fulfill({
          contentType: "text/html",
          body: `${requests > 1 && mode === "captcha_after_reload" ? "<div id='fixture-captcha'>fixture block</div>" : ""}<a href='/signin'>${account}</a>
          <span id='glow-ingress-block'>Deliver to ${verified ? "San Mateo 94404" : "China"}</span>
          <a href='' id='nav-global-location-popover-link' ${modal ? "onclick=\"event.preventDefault();document.getElementById('fixture-modal').hidden=false\"" : ""}>Location</a>
          ${modal ? `<div id='fixture-modal' hidden><input id='GLUXZipUpdateInput'><span id='GLUXZipUpdate'><input type='button' value='Apply'></span><p id='GLUXZipConfirmationSection'>Deliver to 94404</p><button name='glowDoneButton' onclick="document.cookie='fixture_region=94404; Path=/';">Done</button></div>` : ""}`,
        });
      });
      const original = "https://www.amazon.com/dp/B000000001",
        steps = [];
      await page.goto(original);
      const operation = prepareAmazonDeliveryContext(
        page,
        "94404",
        async () => {
          assert.equal(new URL(page.url()).origin, "https://www.amazon.com");
          assert.equal(
            await page.locator("#fixture-captcha").count(),
            0,
            "captcha remains blocked",
          );
        },
        (s) => steps.push(s),
        () => page.goto(original),
        500,
      );
      if (mode === "ready") {
        assert.equal(await operation, true);
        assert.match(await page.locator("#glow-ingress-block").innerText(), /94404/);
        assert.equal(steps.filter((s) => s === "location_reload_reopen").length, 1);
        assert.equal(requests, 3);
      } else {
        await assert.rejects(operation);
        assert.ok(steps.filter((s) => s === "location_reload_reopen").length <= 1);
        assert.equal(requests, mode === "never_ready" ? 3 : 2);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
