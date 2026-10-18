import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { prepareAmazonDeliveryContext } from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";

test("anonymous delivery waits for the loaded location handler before clicking its empty href", async () => {
  const browser = await chromium.launch({ headless: true });
  let releaseScript;
  const scriptGate = new Promise((resolve) => {
    releaseScript = resolve;
  });
  let enteredLoad;
  const loadEntered = new Promise((resolve) => {
    enteredLoad = resolve;
  });
  let preparation;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(1500);
    page.setDefaultNavigationTimeout(3000);
    const html = `<!doctype html><html><head><script async src="/fixture-location.js"></script></head><body>
      <a href="/signin">Hello, sign in Account &amp; Lists</a>
      <a id="nav-global-location-popover-link" href=""><span id="glow-ingress-block">Deliver to China</span></a>
      <section id="fixture-modal" hidden><input id="GLUXZipUpdateInput">
      <span id="GLUXZipUpdate"><input type="button" value="Apply"></span>
      <p id="GLUXZipConfirmationSection" hidden></p><button name="glowDoneButton" hidden>Done</button></section>
      </body></html>`;
    const script = `const modal=document.querySelector('#fixture-modal'),zip=document.querySelector('#GLUXZipUpdateInput'),confirmation=document.querySelector('#GLUXZipConfirmationSection'),done=document.querySelector('button[name="glowDoneButton"]');
      document.querySelector('#nav-global-location-popover-link').addEventListener('click',e=>{e.preventDefault();modal.hidden=false});
      document.querySelector('#GLUXZipUpdate input').addEventListener('click',()=>{confirmation.textContent='Deliver to '+zip.value;confirmation.hidden=false;done.hidden=false});
      done.addEventListener('click',()=>{document.querySelector('#glow-ingress-block').textContent='Deliver to San Mateo '+zip.value;modal.hidden=true});`;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== "https://www.amazon.com") return route.abort();
      if (url.pathname === "/fixture-location.js") {
        await scriptGate;
        return route.fulfill({ contentType: "application/javascript", body: script });
      }
      if (url.pathname === "/s") return route.fulfill({ contentType: "text/html", body: html });
      return route.abort();
    });
    await page.goto("https://www.amazon.com/s?k=fixture", { waitUntil: "domcontentloaded" });
    const wait = page.waitForLoadState.bind(page);
    page.waitForLoadState = (...args) => {
      enteredLoad("load_wait");
      return wait(...args);
    };
    const earlyNavigation = new Promise((resolve) =>
      page.once("framenavigated", () => resolve("early_navigation")),
    );
    preparation = prepareAmazonDeliveryContext(page, "94404", async () => {});
    preparation.catch(() => {});
    assert.equal(await Promise.race([loadEntered, earlyNavigation]), "load_wait");
    releaseScript();
    assert.equal(await preparation, true);
    assert.equal(page.url(), "https://www.amazon.com/s?k=fixture");
    assert.match(await page.locator("#glow-ingress-block").textContent(), /94404/);
  } finally {
    releaseScript();
    await preparation?.catch(() => {});
    await browser.close();
  }
});
