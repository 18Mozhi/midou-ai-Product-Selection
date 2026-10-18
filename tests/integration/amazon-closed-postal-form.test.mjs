import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { prepareAmazonDeliveryContext } from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";

test("closed postal form requires an actual original-URL reread and strict target region", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const scenario of [
      "accepted",
      "aria_hidden",
      "css_hidden",
      "aria_hidden_signed_in",
      "initial_aria_hidden",
      "rejected",
      "wrong_postal",
      "input_remains",
      "signed_in",
      "challenge",
      "reread_failed",
      "no_reread",
    ]) {
      const page = await browser.newPage();
      const fastExpected = ["accepted", "aria_hidden"].includes(scenario);
      page.setDefaultTimeout(fastExpected ? 5000 : 250);
      page.setDefaultNavigationTimeout(2000);
      let rereads = 0;
      let observedApplication = false;
      const original = "https://www.amazon.com/dp/B0HBQ566FK";
      await page.route("**/*", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: rereads
            ? `<a href="/signin">Hello, sign in Account &amp; Lists</a><span id="glow-ingress-block">${observedApplication ? `Deliver to San Mateo ${scenario === "wrong_postal" ? "95001" : "94404"}` : "Deliver to Taiwan"}</span>`
            : `<a id="account" href="/signin" ${scenario === "initial_aria_hidden" ? 'aria-hidden="true"' : ""}>Hello, sign in Account &amp; Lists</a>
          <span id="glow-ingress-block">Deliver to Taiwan</span>
          <button id="nav-global-location-popover-link">Location</button>
          <section id="postal-form"><input id="GLUXZipUpdateInput"><span id="GLUXZipUpdate"><input type="button" value="Apply"></span></section>
          <script>document.querySelector('#GLUXZipUpdate input').onclick=()=>{
          window.postalApplied=${scenario !== "rejected"};
          ${scenario === "input_remains" ? "document.querySelector('#postal-form').hidden=true;" : "document.querySelector('#postal-form').remove();"}
          ${["signed_in", "aria_hidden_signed_in"].includes(scenario) ? "document.querySelector('#account').textContent='Hello, Account & Lists';" : ""}
          ${["aria_hidden", "aria_hidden_signed_in"].includes(scenario) ? "document.querySelector('#account').setAttribute('aria-hidden','true');" : ""}
          ${scenario === "css_hidden" ? "document.querySelector('#account').style.display='none';" : ""}
          ${scenario === "challenge" ? "document.body.insertAdjacentHTML('beforeend','<form action=\"/validateCaptcha\"></form>');" : ""}
          };</script>`,
        }),
      );
      await page.goto(original);
      const steps = [];
      const reread =
        scenario === "no_reread"
          ? undefined
          : async () => {
              if (scenario === "reread_failed") throw new Error("original URL unavailable");
              observedApplication = await page.evaluate(() => window.postalApplied === true);
              rereads++;
              await page.goto(original, { waitUntil: "domcontentloaded" });
            };
      const preparationStarted = Date.now();
      const preparation = prepareAmazonDeliveryContext(
        page,
        "94404",
        async () => {
          assert.equal(new URL(page.url()).origin, "https://www.amazon.com");
          if (await page.locator('form[action*="validateCaptcha"]').count())
            throw new Error("captcha blocked");
        },
        (step) => steps.push(step),
        reread,
        2000,
      );
      if (fastExpected) {
        assert.equal(await preparation, true);
        assert.ok(
          Date.now() - preparationStarted < 2000,
          "detached form must not spend the 5s confirmation timeout",
        );
        assert.equal(rereads, 1);
        assert.match(await page.locator("#glow-ingress-block").textContent(), /94404/);
        assert.equal(page.url(), original);
        assert.ok(steps.includes("postal_form_closed_guard"));
        assert.ok(steps.includes("verify_header"));
      } else {
        await assert.rejects(preparation, undefined, scenario);
        assert.equal(rereads, ["rejected", "wrong_postal"].includes(scenario) ? 1 : 0, scenario);
      }
      assert.equal(steps.includes("finish_location"), false, scenario);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
