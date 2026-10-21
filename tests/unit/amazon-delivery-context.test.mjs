import test from "node:test";
import assert from "node:assert/strict";
import { prepareAmazonDeliveryContext } from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";
import {
  validateBrowserPlan,
  PlaywrightCrawlerEngine,
} from "../../packages/playwright-crawler/dist/index.js";
import { createAmazonBrowserExecutionRequest } from "../../packages/provider-sources/dist/index.js";
import { loadRuntimeConfig } from "../../packages/config/dist/index.js";
import { errors } from "playwright";

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
      if (selector === 'button[name="glowDoneButton"]' && !options.doneWrongPostal)
        location = `Deliver to San Mateo ${postal}`;
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
    waitForNavigation: async () => {
      throw new Error("Timeout without navigation");
    },
    waitForLoadState: async (state) => {
      actions.push(["load", state]);
      if (options.loadError) throw options.loadError;
      if (options.loadFailed) throw new Error("Timeout waiting for page load");
      if (options.locationAfterLoad) location = options.locationAfterLoad;
    },
    getByRole: (role, value) => ({
      isVisible: async () =>
        role === "link" &&
        value.name === "Hello, sign in Account & Lists" &&
        !options.signedIn &&
        !(options.signedInAfterLoad && actions.some((a) => a[0] === "load")),
    }),
  };
  let checks = 0;
  const safe = async () => {
    checks++;
    if ((options.blockAfterLoad && checks === 2) || (options.blockAfterOpen && checks === 3))
      throw new Error("captcha block");
  };
  const reread = async () => {
    actions.push(["reread", "original_url"]);
    if (options.rereadFailed) throw new Error("Timeout rereading original URL");
    if (options.locationAfterReread) location = options.locationAfterReread;
  };
  return { page, safe, actions, reread, location: () => location };
}

test("confirmed region with no automatic navigation rereads original URL before strict header check", async () => {
  const f = fixture({ doneWrongPostal: true, locationAfterReread: "Deliver to San Mateo 94404" });
  const steps = [];
  assert.equal(
    await prepareAmazonDeliveryContext(f.page, "94404", f.safe, (s) => steps.push(s), f.reread),
    true,
  );
  assert.equal(f.actions.filter((a) => a[0] === "reread").length, 1);
  assert.ok(
    f.actions.findIndex((a) => a[0] === "reread") <
      f.actions.findIndex((a) => a[0] === "wait" && a[1] === "#glow-ingress-block"),
  );
  assert.ok(steps.includes("reread_navigation"));
});

test("explicit reread never accepts stale postal, failed navigation, rejected confirmation or signed-in context", async () => {
  for (const options of [
    { doneWrongPostal: true },
    { rereadFailed: true },
    { rejected: true },
    { signedIn: true },
  ]) {
    const f = fixture(options);
    await assert.rejects(prepareAmazonDeliveryContext(f.page, "94404", f.safe, () => {}, f.reread));
    if (options.rejected || options.signedIn) assert.ok(!f.actions.some((a) => a[0] === "reread"));
  }
  const f = fixture({ location: "Deliver to San Mateo 94404" });
  assert.equal(
    await prepareAmazonDeliveryContext(f.page, "94404", f.safe, () => {}, f.reread),
    false,
  );
  assert.deepEqual(f.actions, []);
});

test("an aborted original-URL reread is retried once after document and anonymous guards", async () => {
  const steps = [];
  let calls = 0;
  const success = fixture({ locationAfterReread: "Deliver to San Mateo 94404" });
  success.page.waitForEvent = async (event, options) => {
    assert.equal(options.timeout, 321);
    success.actions.push(["navigation", event]);
  };
  assert.equal(
    await prepareAmazonDeliveryContext(
      success.page,
      "94404",
      success.safe,
      (s) => steps.push(s),
      async () => {
        if (++calls === 1) throw new Error("page.goto: net::ERR_ABORTED");
        await success.reread();
      },
      321,
    ),
    true,
  );
  assert.equal(calls, 2);
  assert.ok(steps.includes("reread_interrupted_wait"));
  assert.ok(steps.includes("reread_retry"));
  assert.ok(success.actions.some((a) => a[0] === "navigation" && a[1] === "domcontentloaded"));
});

test("aborted reread recovery preserves all guards and cannot retry indefinitely", async () => {
  for (const mode of [
    "generic",
    "second_abort",
    "blocked",
    "signed_in",
    "wrong_postal",
    "settle_failed",
  ]) {
    const f = fixture({ doneWrongPostal: true });
    let calls = 0;
    f.page.waitForEvent = async () => {
      if (mode === "settle_failed") throw new errors.TimeoutError("settle failed");
    };
    const safe = async () => {
      await f.safe();
      if (calls && mode === "blocked") throw new Error("captcha block");
    };
    const role = f.page.getByRole;
    f.page.getByRole = (...args) =>
      calls && mode === "signed_in" ? { isVisible: async () => false } : role(...args);
    await assert.rejects(
      prepareAmazonDeliveryContext(
        f.page,
        "94404",
        safe,
        () => {},
        async () => {
          calls++;
          if (mode === "generic") throw new Error("ERR_ABORTED without Chromium navigation error");
          if (calls === 1 || mode === "second_abort")
            throw new Error("page.goto: net::ERR_ABORTED");
        },
      ),
    );
    assert.equal(calls, ["second_abort", "wrong_postal"].includes(mode) ? 2 : 1);
  }
});

test(
  "actual postal input removal can finish guarded reread while legacy confirmation never appears",
  { timeout: 1000 },
  async () => {
    const f = fixture({ doneWrongPostal: true, locationAfterReread: "Deliver to San Mateo 94404" });
    const original = f.page.locator;
    f.page.locator = (selector) => {
      const value = original(selector);
      if (selector === "#GLUXZipConfirmationSection")
        return { ...value, filter: () => ({ waitFor: () => new Promise(() => {}) }) };
      if (selector === "#GLUXZipUpdateInput")
        return {
          ...value,
          count: async () => 0,
          waitFor: async (options) => {
            assert.equal(options.state, "detached");
          },
        };
      return value;
    };
    const steps = [];
    assert.equal(
      await prepareAmazonDeliveryContext(f.page, "94404", f.safe, (s) => steps.push(s), f.reread),
      true,
    );
    assert.ok(steps.includes("postal_form_closed_guard"));
    assert.ok(steps.includes("verify_header"));
    assert.equal(f.actions.filter((a) => a[0] === "reread").length, 1);
    assert.equal(
      f.actions.some((a) => a[1] === 'button[name="glowDoneButton"]'),
      false,
    );
  },
);

test(
  "a reinserted postal input still waits for real confirmation and Done",
  { timeout: 1000 },
  async () => {
    const f = fixture();
    const original = f.page.locator;
    let confirm;
    const confirmation = new Promise((resolve) => {
      confirm = resolve;
    });
    f.page.locator = (selector) => {
      const value = original(selector);
      if (selector === "#GLUXZipConfirmationSection")
        return { ...value, filter: () => ({ waitFor: () => confirmation }) };
      if (selector === "#GLUXZipUpdateInput")
        return {
          ...value,
          waitFor: async () => {},
          count: async () => {
            confirm();
            return 1;
          },
        };
      return value;
    };
    const steps = [];
    assert.equal(
      await prepareAmazonDeliveryContext(f.page, "94404", f.safe, (s) => steps.push(s), f.reread),
      true,
    );
    assert.equal(steps.includes("postal_form_closed_guard"), false);
    assert.equal(f.actions.filter((a) => a[1] === 'button[name="glowDoneButton"]').length, 1);
    assert.ok(steps.includes("verify_header"));
  },
);

test(
  "a closed-form safety TimeoutError is never retried as an observation timeout",
  { timeout: 1000 },
  async () => {
    const f = fixture({ locationAfterReread: "Deliver to San Mateo 94404" });
    const original = f.page.locator;
    f.page.locator = (selector) => {
      const value = original(selector);
      if (selector === "#GLUXZipConfirmationSection")
        return { ...value, filter: () => ({ waitFor: () => new Promise(() => {}) }) };
      if (selector === "#GLUXZipUpdateInput")
        return { ...value, count: async () => 0, waitFor: async () => {} };
      return value;
    };
    let safeCalls = 0;
    const failure = new errors.TimeoutError("guard timeout");
    const safe = async () => {
      if (++safeCalls === 4) throw failure;
    };
    await assert.rejects(
      prepareAmazonDeliveryContext(f.page, "94404", safe, () => {}, f.reread),
      (error) => error === failure,
    );
    assert.equal(safeCalls, 4);
    assert.equal(
      f.actions.some((a) => a[0] === "reread"),
      false,
    );
  },
);

test("both postal observations failing preserve the original confirmation error", async () => {
  const f = fixture();
  const original = f.page.locator;
  const failure = new Error("original confirmation failure");
  f.page.locator = (selector) => {
    const value = original(selector);
    if (selector === "#GLUXZipConfirmationSection")
      return {
        ...value,
        filter: () => ({
          waitFor: async () => {
            throw failure;
          },
        }),
      };
    if (selector === "#GLUXZipUpdateInput")
      return {
        ...value,
        waitFor: async () => {
          throw new errors.TimeoutError("input remains");
        },
      };
    return value;
  };
  await assert.rejects(
    prepareAmazonDeliveryContext(f.page, "94404", f.safe, () => {}, f.reread),
    (error) => error === failure,
  );
  assert.equal(
    f.actions.some((a) => a[0] === "reread"),
    false,
  );
});

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
      ["load", "load"],
      ["click", "#nav-global-location-popover-link"],
      ["fill", "#GLUXZipUpdateInput"],
      ["click", "#GLUXZipUpdate input"],
      ["wait", "#GLUXZipConfirmationSection"],
      ["click", 'button[name="glowDoneButton"]'],
      ["wait", "#glow-ingress-block"],
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
  assert.deepEqual(f.actions, [
    ["load", "load"],
    ["click", "#nav-global-location-popover-link"],
  ]);
});

test("loading failures and newly blocked or signed-in pages never open the location modal", async () => {
  for (const options of [
    { loadFailed: true },
    { blockAfterLoad: true },
    { signedInAfterLoad: true },
  ]) {
    const f = fixture(options);
    await assert.rejects(prepareAmazonDeliveryContext(f.page, "94404", f.safe));
    assert.deepEqual(f.actions, [["load", "load"]]);
  }
});

test("only Playwright load timeout can continue through all original region guards", async () => {
  const f = fixture({ loadError: new errors.TimeoutError("page load timed out") });
  const steps = [];
  assert.equal(
    await prepareAmazonDeliveryContext(f.page, "94404", f.safe, (s) => steps.push(s)),
    true,
  );
  assert.ok(steps.includes("page_load_timeout"));
  assert.equal(f.location(), "Deliver to San Mateo 94404");
  const imitation = new Error("not a Playwright timeout");
  imitation.name = "TimeoutError";
  const rejected = fixture({ loadError: imitation });
  await assert.rejects(
    prepareAmazonDeliveryContext(rejected.page, "94404", rejected.safe),
    (e) => e === imitation,
  );
  assert.deepEqual(rejected.actions, [["load", "load"]]);
});

test("load timeout never bypasses anonymous, challenge, confirmation, reread or postal guards", async () => {
  for (const options of [
    { blockAfterLoad: true },
    { signedInAfterLoad: true },
    { rejected: true },
    { rereadFailed: true },
    { doneWrongPostal: true },
  ]) {
    const f = fixture({ ...options, loadError: new errors.TimeoutError("page load timed out") });
    await assert.rejects(prepareAmazonDeliveryContext(f.page, "94404", f.safe, () => {}, f.reread));
    if (options.blockAfterLoad || options.signedInAfterLoad)
      assert.deepEqual(f.actions, [["load", "load"]]);
  }
});

test("a correct region that appears during loading needs no location interaction", async () => {
  const f = fixture({ locationAfterLoad: "Deliver to San Mateo 94404" });
  assert.equal(await prepareAmazonDeliveryContext(f.page, "94404", f.safe), false);
  assert.deepEqual(f.actions, [["load", "load"]]);
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

test("configured source proxy stays backend-only and the browser gets per-run local credentials", async () => {
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
    assert.match(launchOptions.proxy.server, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.notEqual(launchOptions.proxy.server, proxy.server);
    assert.notEqual(launchOptions.proxy.username, proxy.username);
    assert.notEqual(launchOptions.proxy.password, proxy.password);
    assert.doesNotMatch(JSON.stringify(launchOptions), /fixture-user|fixture-only-password|18899/);
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

test("postal timeout reports its fixed step without exposing postal input", async () => {
  const f = fixture({ rejected: true });
  const steps = [];
  await assert.rejects(
    prepareAmazonDeliveryContext(f.page, "94404", f.safe, (step) => steps.push(step)),
    /Timeout/,
  );
  assert.equal(steps.at(-1), "confirm_postal");
  assert.doesNotMatch(JSON.stringify(steps), /94404/);
});

test("Amazon failure diagnostics omit private errors and preserve the result contract", async () => {
  const { chromium } = await import("playwright");
  const original = chromium.launchPersistentContext;
  const originalWarn = console.warn;
  const messages = [];
  chromium.launchPersistentContext = async () => {
    throw new Error("private-password target-query");
  };
  console.warn = (message) => messages.push(message);
  try {
    const { plan } = createAmazonBrowserExecutionRequest({ query: "private-query" });
    const result = await new PlaywrightCrawlerEngine(limits).run(
      plan,
      "not-created-diagnostic-context",
      { requestId: "private-id", traceId: "private-trace" },
    );
    assert.deepEqual(messages.map(JSON.parse), [
      {
        event: "amazon_browser_step_failed",
        stage: "browser_launch",
        error_code: "dependency_unavailable",
      },
    ]);
    assert.doesNotMatch(messages.join(""), /private|password|query/);
    assert.equal(result.status, "dependency_failed");
    assert.equal(Object.hasOwn(result, "stage"), false);
  } finally {
    chromium.launchPersistentContext = original;
    console.warn = originalWarn;
  }
});

test("main document diagnostics retain bounded real statuses without URLs or subframe noise", async () => {
  const { chromium } = await import("playwright");
  const original = chromium.launchPersistentContext;
  const originalWarn = console.warn;
  const listeners = new Map();
  const messages = [];
  const response = (status, main = true) => ({
    status: () => status,
    url: () => "https://www.amazon.com/errors/validateCaptcha?private-token=secret",
    request: () => ({
      isNavigationRequest: () => true,
      frame: () => ({ parentFrame: () => (main ? null : {}) }),
      method: () => "POST",
      resourceType: () => "document",
    }),
  });
  const page = {
    goto: async () => {
      for (let i = 0; i < 15; i++) listeners.get("response")(response(200 + i));
      listeners.get("response")(response(200, false));
      throw new Error("net::ERR_FAILED private-token");
    },
  };
  chromium.launchPersistentContext = async () => ({
    pages: () => [page],
    setDefaultTimeout() {},
    setDefaultNavigationTimeout() {},
    on: (event, handler) => listeners.set(event, handler),
    close: async () => {},
  });
  console.warn = (message) => messages.push(JSON.parse(message));
  try {
    const { plan } = createAmazonBrowserExecutionRequest({ query: "private-query" });
    await new PlaywrightCrawlerEngine(limits).run(plan, "not-created", {
      requestId: "req",
      traceId: "trace",
    });
    const documents = messages[0].main_document_responses;
    assert.equal(documents.length, 10);
    assert.deepEqual(
      documents.map((entry) => entry.http_status),
      [205, 206, 207, 208, 209, 210, 211, 212, 213, 214],
    );
    assert.ok(
      documents.every((entry) => entry.hostname === "www.amazon.com" && entry.method === "POST"),
    );
    assert.doesNotMatch(JSON.stringify(messages), /private|token|secret|validateCaptcha/);
  } finally {
    chromium.launchPersistentContext = original;
    console.warn = originalWarn;
  }
});

test("navigation request transport is server-configured and rejects non-Amazon plans before launch", async () => {
  assert.equal(
    loadRuntimeConfig({}, "api").providerAdapters.amazonBrowserNavigationTransport,
    "browser",
  );
  assert.equal(
    loadRuntimeConfig({ AMAZON_PUBLIC_BROWSER_NAVIGATION_TRANSPORT: "request" }, "api")
      .providerAdapters.amazonBrowserNavigationTransport,
    "request",
  );
  assert.throws(
    () => loadRuntimeConfig({ AMAZON_PUBLIC_BROWSER_NAVIGATION_TRANSPORT: "unknown" }, "api"),
    /AMAZON_PUBLIC_BROWSER_NAVIGATION_TRANSPORT/,
  );
  const result = await new PlaywrightCrawlerEngine(limits).run(
    {
      start_url: "https://example.test",
      allowed_origins: ["https://example.test"],
      item_selector: "article",
      max_pages: 1,
      max_scrolls: 0,
      max_details: 0,
    },
    "not-created",
    { requestId: "scope", traceId: "scope" },
    { navigationTransport: "request" },
  );
  assert.equal(result.error_code, "crawler_proxy_scope_invalid");
});

test("async postal dialog uses the caller navigation budget and still requires a confirmed header", async () => {
  const f = fixture(),
    originalLocator = f.page.locator;
  let actualTimeout;
  f.page.locator = (...args) => {
    const value = originalLocator(...args),
      fill = value.fill;
    return {
      ...value,
      fill: async (postal, options) => {
        actualTimeout = options?.timeout;
        if (!(actualTimeout >= 20_000)) throw new errors.TimeoutError("delayed postal modal");
        return fill(postal);
      },
    };
  };
  await prepareAmazonDeliveryContext(f.page, "94404", f.safe, () => {}, f.reread, 60_000);
  assert.equal(actualTimeout, 60_000);
  assert.equal(f.location(), "Deliver to San Mateo 94404");
  const rejected = fixture({ rejected: true });
  await assert.rejects(
    prepareAmazonDeliveryContext(
      rejected.page,
      "94404",
      rejected.safe,
      () => {},
      rejected.reread,
      60_000,
    ),
  );
});

test("Done without navigation or matching header retains the original timeout failure", async () => {
  const f = fixture({ doneWrongPostal: true });
  await assert.rejects(
    prepareAmazonDeliveryContext(f.page, "94404", f.safe),
    /Timeout waiting for actual location confirmation/,
  );
  assert.equal(f.location(), "Deliver to China");
});
