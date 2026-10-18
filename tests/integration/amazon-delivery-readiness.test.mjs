import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { prepareAmazonDeliveryContext } from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";

test("Chromium aborted reread recovers once through a real guarded original-URL navigation", async () => {
  const browser = await chromium.launch({ headless: true });
  let competingNavigation;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(500);
    page.setDefaultNavigationTimeout(2000);
    let requests = 0;
    await page.route("**/*", async (route) => {
      requests++;
      if (requests === 2) {
        await route.abort("aborted");
        competingNavigation = new Promise((resolve) => setTimeout(resolve, 50)).then(() =>
          page.goto("https://www.amazon.com/dp/B0F6FT397Y?settled=1", {
            waitUntil: "domcontentloaded",
          }),
        );
        void competingNavigation.catch(() => {});
        return;
      }
      return route.fulfill({
        contentType: "text/html",
        body:
          requests > 2
            ? '<a href="/signin">Hello, sign in Account &amp; Lists</a><span id="glow-ingress-block">Deliver to San Mateo 94404</span>'
            : `<a href="/signin">Hello, sign in Account &amp; Lists</a><span id="glow-ingress-block">Deliver to China</span>
          <button id="nav-global-location-popover-link">Location</button><input id="GLUXZipUpdateInput">
          <span id="GLUXZipUpdate"><input type="button" value="Apply"></span>
          <p id="GLUXZipConfirmationSection">Deliver to 94404</p><button name="glowDoneButton">Done</button>`,
      });
    });
    const original = "https://www.amazon.com/dp/B0F6FT397Y";
    await page.goto(original);
    const steps = [];
    assert.equal(
      await prepareAmazonDeliveryContext(
        page,
        "94404",
        async () => {
          assert.equal(new URL(page.url()).origin, "https://www.amazon.com");
        },
        (step) => steps.push(step),
        async () => {
          await page.goto(original, { waitUntil: "domcontentloaded" });
        },
      ),
      true,
    );
    assert.equal(requests, 4);
    await competingNavigation;
    assert.ok(steps.includes("reread_retry"));
    assert.equal(page.url(), original);
    assert.match(await page.locator("#glow-ingress-block").textContent(), /94404/);
  } finally {
    await competingNavigation?.catch(() => {});
    await browser.close();
  }
});

test("unfinished page resource does not replace the real location modal and postal checks", async () => {
  const browser = await chromium.launch({ headless: true });
  let releaseResource;
  const resourceGate = new Promise((resolve) => {
    releaseResource = resolve;
  });
  try {
    for (const handlerReady of [true, false]) {
      const page = await browser.newPage();
      page.setDefaultTimeout(300);
      page.setDefaultNavigationTimeout(150);
      await page.route("**/*", async (route) => {
        if (new URL(route.request().url()).pathname === "/pending-image") {
          await resourceGate;
          return route.abort();
        }
        return route.fulfill({
          contentType: "text/html",
          body: `
          <a href="/signin">Hello, sign in Account &amp; Lists</a>
          <span id="glow-ingress-block">Deliver to China</span>
          <button id="nav-global-location-popover-link">Location</button>
          <section hidden id="modal"><input id="GLUXZipUpdateInput">
          <span id="GLUXZipUpdate"><input type="button" value="Apply"></span>
          <p hidden id="GLUXZipConfirmationSection"></p><button name="glowDoneButton">Done</button></section>
          <img src="/pending-image">
          <script>
          ${handlerReady ? "document.querySelector('#nav-global-location-popover-link').onclick=()=>document.querySelector('#modal').hidden=false;" : ""}
          document.querySelector('#GLUXZipUpdate input').onclick=()=>{const el=document.querySelector('#GLUXZipConfirmationSection');el.textContent='Deliver to '+document.querySelector('#GLUXZipUpdateInput').value;el.hidden=false;};
          document.querySelector('button[name="glowDoneButton"]').onclick=()=>document.querySelector('#glow-ingress-block').textContent='Deliver to San Mateo '+document.querySelector('#GLUXZipUpdateInput').value;
          </script>`,
        });
      });
      await page.goto("https://www.amazon.com/s?k=fixture", {
        waitUntil: "domcontentloaded",
        timeout: 3000,
      });
      const steps = [];
      let rereads = 0;
      const preparation = prepareAmazonDeliveryContext(
        page,
        "94404",
        async () => {
          assert.equal(new URL(page.url()).origin, "https://www.amazon.com");
        },
        (step) => steps.push(step),
        async () => {
          rereads++;
        },
      );
      if (handlerReady) {
        assert.equal(await preparation, true);
        assert.equal(rereads, 1);
        assert.match(await page.locator("#glow-ingress-block").textContent(), /94404/);
      } else {
        await assert.rejects(preparation, /Timeout/);
        assert.equal(rereads, 0);
        assert.match(await page.locator("#glow-ingress-block").textContent(), /China/);
      }
      assert.ok(steps.includes("page_load_timeout"));
      await page.close();
    }
  } finally {
    releaseResource();
    await browser.close();
  }
});

test("Done without navigation uses original URL reread before accepting the confirmed region", async () => {
  const browser = await chromium.launch({ headless: true });
  let confirmed = false,
    rereads = 0;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(200);
    page.setDefaultNavigationTimeout(1000);
    await page.route("**/*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: confirmed
          ? '<a>Hello, sign in Account &amp; Lists</a><span id="glow-ingress-block">Deliver to San Mateo 94404</span>'
          : `<a>Hello, sign in Account &amp; Lists</a><span id="glow-ingress-block">Deliver to Los Angeles 90060</span>
        <button id="nav-global-location-popover-link">Location</button><input id="GLUXZipUpdateInput">
        <span id="GLUXZipUpdate"><input type="button" value="Apply"></span>
        <p id="GLUXZipConfirmationSection">Deliver to 94404</p><button name="glowDoneButton">Done</button>
        <script>document.querySelector('button[name="glowDoneButton"]').onclick=e=>e.target.hidden=true</script>`,
      }),
    );
    // Give the anonymous-account links their actual semantic role.
    await page.goto("https://www.amazon.com/s?k=fixture");
    await page.locator("a").evaluate((el) => el.setAttribute("href", "/signin"));
    const original = page.url();
    const reread = async () => {
      confirmed = true;
      rereads++;
      await page.goto(original, { waitUntil: "domcontentloaded" });
      await page.locator("a").evaluate((el) => el.setAttribute("href", "/signin"));
    };
    assert.equal(
      await prepareAmazonDeliveryContext(
        page,
        "94404",
        async () => {},
        () => {},
        reread,
      ),
      true,
    );
    assert.equal(rereads, 1);
    assert.equal(page.url(), original);
    assert.match(await page.locator("#glow-ingress-block").textContent(), /94404/);
  } finally {
    await browser.close();
  }
});

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

test("Done navigation uses the existing navigation budget before verifying the new header", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(500);
    page.setDefaultNavigationTimeout(4000);
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== "https://www.amazon.com") return route.abort();
      if (url.searchParams.has("confirmed")) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return route.fulfill({
          contentType: "text/html",
          body: '<a href="/signin">Hello, sign in Account &amp; Lists</a><span id="glow-ingress-block">Deliver to San Mateo 94404</span>',
        });
      }
      return route.fulfill({
        contentType: "text/html",
        body: `
        <a href="/signin">Hello, sign in Account &amp; Lists</a><span id="glow-ingress-block">Deliver to China</span>
        <button id="nav-global-location-popover-link">Location</button><input id="GLUXZipUpdateInput">
        <span id="GLUXZipUpdate"><input type="button" value="Apply"></span>
        <p id="GLUXZipConfirmationSection">Deliver to 94404</p>
        <button name="glowDoneButton">Done</button>
        <script>document.querySelector('button[name="glowDoneButton"]').onclick=()=>setTimeout(()=>location.href='/s?confirmed=1',50)</script>`,
      });
    });
    await page.goto("https://www.amazon.com/s?fixture=1");
    assert.equal(await prepareAmazonDeliveryContext(page, "94404", async () => {}), true);
    assert.match(await page.locator("#glow-ingress-block").textContent(), /94404/);
  } finally {
    await browser.close();
  }
});
