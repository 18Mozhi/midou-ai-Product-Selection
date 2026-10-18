import test from "node:test";
import assert from "node:assert/strict";
import { prepareAmazonDeliveryContext } from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";
import {
  validateBrowserPlan,
  PlaywrightCrawlerEngine,
} from "../../packages/playwright-crawler/dist/index.js";
import { createAmazonBrowserExecutionRequest } from "../../packages/provider-sources/dist/index.js";
import { loadRuntimeConfig } from "../../packages/config/dist/index.js";

const limits = {
  navigationTimeoutMs: 1000,
  actionTimeoutMs: 500,
  maxPages: 3,
  maxScrolls: 2,
  maxDetails: 2,
  maxArchiveBytes: 1024,
  maxExtractedBytes: 2048,
  maxArchiveFiles: 10,
  headless: true,
};
function fixture(options = {}) {
  const actions = [];
  let location = options.location ?? "Deliver to China",
    applied = false,
    postal = "";
  const locator = (selector, filter) => ({
    textContent: async () => location,
    filter: (value) => locator(selector, value),
    fill: async (value) => {
      actions.push(["fill", selector, value]);
      postal = value;
    },
    click: async () => {
      actions.push(["click", selector]);
      if (selector === "#GLUXZipUpdate input") applied = !options.rejected;
      if (selector === 'button[name="glowDoneButton"]') location = `Deliver to San Mateo ${postal}`;
    },
    waitFor: async () => {
      actions.push(["wait", selector]);
      const text =
        selector === "#GLUXZipConfirmationSection" && applied
          ? `Deliver to ${postal} Change`
          : location;
      if (!filter.hasText.test(text))
        throw new Error("Timeout waiting for actual location confirmation");
    },
  });
  const page = {
    locator,
    getByRole: (role, value) => ({
      isVisible: async () =>
        role === "link" && value.name === "Hello, sign in Account & Lists" && !options.signedIn,
    }),
  };
  let checks = 0;
  const safe = async () => {
    checks++;
    if (options.blockAfterOpen && checks === 2) throw new Error("captcha block");
  };
  return { page, safe, actions, location: () => location };
}

test("US postal context is explicit, validated and configurable without credentials", () => {
  assert.equal(
    loadRuntimeConfig({}, "api").providerAdapters.amazonPublicDeliveryPostalCode,
    "94404",
  );
  assert.equal(
    loadRuntimeConfig({ AMAZON_PUBLIC_DELIVERY_POSTAL_CODE: "10001" }, "worker").providerAdapters
      .amazonPublicDeliveryPostalCode,
    "10001",
  );
  for (const value of ["1234", "123456", "China", "10001 OR 1=1"])
    assert.throws(
      () => loadRuntimeConfig({ AMAZON_PUBLIC_DELIVERY_POSTAL_CODE: value }, "api"),
      /AMAZON_PUBLIC_DELIVERY_POSTAL_CODE/,
    );
  const { plan } = createAmazonBrowserExecutionRequest({ query: "metal sign" }, "94404");
  assert.deepEqual(validateBrowserPlan(plan, limits).amazon_delivery, {
    country: "US",
    postal_code: "94404",
  });
  for (const invalid of [
    false,
    null,
    "US",
    { country: "CN", postal_code: "94404" },
    { country: "US", postal_code: 94404 },
    { country: "US", postal_code: "9440" },
  ])
    assert.throws(() => validateBrowserPlan({ ...plan, amazon_delivery: invalid }, limits));
  assert.throws(() =>
    validateBrowserPlan(
      { ...plan, start_url: "https://example.test/", allowed_origins: ["https://example.test/"] },
      limits,
    ),
  );
});
test("already correct anonymous observation region requires no setting writes", async () => {
  const f = fixture({ location: "Deliver to San Mateo 94404" });
  assert.equal(await prepareAmazonDeliveryContext(f.page, "94404", f.safe), false);
  assert.deepEqual(f.actions, []);
});
test("anonymous country mismatch waits for confirmed US postcode before closing and verifying header", async () => {
  const f = fixture();
  assert.equal(await prepareAmazonDeliveryContext(f.page, "94404", f.safe), true);
  assert.equal(f.location(), "Deliver to San Mateo 94404");
  assert.deepEqual(
    f.actions.map((a) => a.slice(0, 2)),
    [
      ["click", "#nav-global-location-popover-link"],
      ["fill", "#GLUXZipUpdateInput"],
      ["click", "#GLUXZipUpdate input"],
      ["wait", "#GLUXZipConfirmationSection"],
      ["click", 'button[name="glowDoneButton"]'],
      ["wait", "#glow-ingress-block"],
    ],
  );
});
test("signed-in pages never open or modify an address selector", async () => {
  const f = fixture({ signedIn: true });
  await assert.rejects(prepareAmazonDeliveryContext(f.page, "94404", f.safe), /requires_anonymous/);
  assert.deepEqual(f.actions, []);
});
test("unconfirmed postal application never advances to Done or reports region success", async () => {
  const f = fixture({ rejected: true });
  await assert.rejects(prepareAmazonDeliveryContext(f.page, "94404", f.safe), /Timeout/);
  assert.equal(f.location(), "Deliver to China");
  assert.ok(!f.actions.some((a) => a[1] === 'button[name="glowDoneButton"]'));
});
test("challenge/origin guards run again before filling location", async () => {
  const f = fixture({ blockAfterOpen: true });
  await assert.rejects(prepareAmazonDeliveryContext(f.page, "94404", f.safe), /captcha block/);
  assert.deepEqual(f.actions, [["click", "#nav-global-location-popover-link"]]);
});
test("cookie-backed contexts fail before any browser is launched", async () => {
  const { plan } = createAmazonBrowserExecutionRequest({ query: "metal sign" });
  const result = await new PlaywrightCrawlerEngine(limits).run(
    plan,
    "not-created-cookie-context",
    { requestId: "req", traceId: "trace" },
    { cookies: [{ name: "session", value: "test", domain: ".amazon.com", path: "/" }] },
  );
  assert.equal(result.status, "blocked_login");
  assert.equal(result.error_code, "permission_denied");
});

test("configured source proxy reaches only private anonymous browser launch options", async () => {
  const { chromium } = await import("playwright");
  const original = chromium.launchPersistentContext;
  const proxy = {
    server: "http://127.0.0.1:18899",
    username: "fixture-user",
    password: "fixture-only-password",
  };
  let launchOptions;
  chromium.launchPersistentContext = async (_directory, options) => {
    launchOptions = options;
    throw new Error("fixture_launch_boundary");
  };
  try {
    const { plan } = createAmazonBrowserExecutionRequest({ query: "metal sign" });
    const result = await new PlaywrightCrawlerEngine(limits).run(
      plan,
      "not-created-proxy-context",
      { requestId: "req", traceId: "trace" },
      { proxy },
    );
    assert.equal(result.status, "dependency_failed");
    assert.deepEqual(launchOptions.proxy, proxy);
    assert.doesNotMatch(JSON.stringify(plan), /fixture-user|fixture-only-password|18899/);
    launchOptions = undefined;
    const legacyPlan = { ...plan };
    delete legacyPlan.amazon_delivery;
    const rejected = await new PlaywrightCrawlerEngine(limits).run(
      legacyPlan,
      "not-created-proxy-context",
      { requestId: "req", traceId: "trace" },
      { proxy },
    );
    assert.equal(rejected.error_code, "crawler_proxy_scope_invalid");
    assert.equal(launchOptions, undefined);
  } finally {
    chromium.launchPersistentContext = original;
  }
});
