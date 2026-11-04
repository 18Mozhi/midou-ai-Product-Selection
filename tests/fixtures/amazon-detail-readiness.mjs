import { chromium } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAmazonBrowserExecutionRequest } from "../../packages/provider-sources/dist/index.js";

// Owned, intercepted HTML only. Never connects to Amazon or imports account state.
export async function runAmazonDetailFixture(Engine, mode) {
  const root = await mkdtemp(join(tmpdir(), "scoutops-detail-readiness-"));
  const launch = chromium.launchPersistentContext;
  const requests = [];
  const title = '<div id="title"><h1 id="productTitle">Fixture product</h1></div>';
  chromium.launchPersistentContext = async function (...args) {
    const context = await launch.apply(this, args);
    await context.route("**/*", async (route) => {
      requests.push(route.request().url());
      const content = mode === "ready" ? title : "";
      const script =
        mode === "delayed"
          ? `setTimeout(()=>document.body.insertAdjacentHTML('beforeend',${JSON.stringify(title)}),1000)`
          : mode === "captcha"
            ? "setTimeout(()=>document.body.insertAdjacentHTML('beforeend','<input id=\"captchacharacters\">'),100)"
            : "";
      await route.fulfill({
        contentType: "text/html",
        body:
          '<a href="/ap/signin">Hello, sign in Account &amp; Lists</a>' +
          '<div id="glow-ingress-block">Deliver to San Mateo 94404</div>' +
          '<div id="leftCol"><img id="landingImage" alt="Fixture image"></div>' +
          content +
          `<script>${script}</script>`,
      });
    });
    return context;
  };
  try {
    const target =
      mode === "search"
        ? { query: "fixture missing" }
        : {
            page_url: "https://www.amazon.com/dp/B000000001",
          };
    const { plan } = createAmazonBrowserExecutionRequest(target);
    const result = await new Engine({
      navigationTimeoutMs: 3000,
      actionTimeoutMs: 3000,
      maxPages: 1,
      maxScrolls: 0,
      maxDetails: 0,
      maxArchiveBytes: 1000000,
      maxExtractedBytes: 1000000,
      maxArchiveFiles: 20,
      headless: true,
    }).run(plan, root, { requestId: "fixture", traceId: "fixture" });
    return { result, requests };
  } finally {
    chromium.launchPersistentContext = launch;
    await rm(root, { recursive: true, force: true });
  }
}
