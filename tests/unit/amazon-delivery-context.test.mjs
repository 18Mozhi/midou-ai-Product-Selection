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

test("referral detail navigation and delivery reread use the exact ASIN without dropping variant queries", async (t) => {
  const { chromium } = await import("playwright");
  const canonical = "https://www.amazon.com/dp/B012345678";
  const referral = "https://www.amazon.com/Observed-Example/dp/B012345678/ref=cm_cr_arp_d_product_top";
  const variant = referral + "?th=1&psc=1";
  const paths = [
    [referral,canonical], [variant,variant], [canonical,canonical],
  ];
  let page;
  t.mock.method(chromium,"launchPersistentContext",async()=>({
    pages:()=>[page],setDefaultTimeout(){},setDefaultNavigationTimeout(){},on(){},close:async()=>{},
  }));
  t.mock.method(console,"warn",()=>{});
  for(const [requested,expected] of paths){
    const f = fixture({doneWrongPostal:true,locationAfterReread:"Deliver to 94404"});
    const navigations=[], {locator}=f.page;
    let active;
    page=Object.assign(f.page,{
      locator:(selector)=>({...locator(selector),count:async()=>0}),
      url:()=>active,
      goto:async(url)=>{
        active=url;
        navigations.push(url);
        if(navigations.length===2) await f.reread();
        return {status:()=>200};
      },
      waitForFunction:async()=>{throw new errors.TimeoutError("title absent in fixture");},
      evaluate:async()=>null,
    });
    const {plan}=createAmazonBrowserExecutionRequest({page_url:requested});
    const result=await new PlaywrightCrawlerEngine(limits).run(plan,"not-created",{
      requestId:"fixture",traceId:"fixture",
    });
    assert.deepEqual(navigations,[expected,expected]);
    assert.equal(plan.start_url,requested);
    assert.equal(result.status,"timeout");
    assert.equal(result.item_count,0);
  }
});

test("daily delivery prepares home once, then reads the product; cached jobs never post or reread region", async (t) => {
  const { chromium } = await import("playwright");
  t.mock.method(console, "warn", () => {});
  for (const cached of [false, true]) {
    const f = fixture(cached ? { location: "Deliver to 94404" } : { locationAfterReread: "Deliver to 94404" });
    const navigations = [], added = []; let active;
    const locator = f.page.locator;
    const page = Object.assign(f.page, {
      locator: selector => ({ ...locator(selector), count: async () => 0 }),
      url: () => active,
      goto: async url => { active = url; navigations.push(url); if (!cached && navigations.length === 2) await f.reread(); return { status: () => 200 }; },
      waitForFunction: async () => { throw new errors.TimeoutError("fixture missing title"); }, evaluate: async () => null,
    });
    const context = { pages: () => [page], setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, on() {}, close: async () => {}, addCookies: async c => added.push(c) };
    t.mock.method(chromium, "launchPersistentContext", async () => context);
    let saves = 0;
    const { plan } = createAmazonBrowserExecutionRequest({ page_url: "https://www.amazon.com/dp/B012345678" }, "94404");
    const result = await new PlaywrightCrawlerEngine(limits).run(plan, "not-created", { requestId: "fixture", traceId: "fixture" }, {
      dailyDelivery: { cached, cookies: cached ? [{ name: "session-id", value: "fixture" }] : [], save: async c => { assert.equal(c, context); saves++; } },
    });
    assert.equal(result.status, "timeout", "daily state cannot replace product evidence");
    assert.equal(saves, cached ? 0 : 1);
    assert.deepEqual(navigations, cached ? [plan.start_url] : ["https://www.amazon.com/", "https://www.amazon.com/", plan.start_url]);
    assert.equal(added.length, cached ? 1 : 0);
    if (cached) assert.deepEqual(f.actions, [["wait", "#glow-ingress-block"], ["wait", "#glow-ingress-block"]]);
  }
});

test("Amazon checkpoint redirects fail as verification before detail waits without exporting the URL", async (t) => {
  const { chromium } = await import("playwright");
  const f = fixture({location:"Deliver to 94404"});
  const { locator } = f.page;
  let waits=0;
  Object.assign(f.page,{
    locator:(selector)=>({...locator(selector),count:async()=>selector.split(",").includes("html")?1:0}),
    url:()=>"https://www.amazon.com/checkpoint/private-route?token=private-token",
    goto:async()=>({status:()=>200}),
    waitForFunction:async()=>{waits++;throw new errors.TimeoutError("unexpected wait");},
  });
  t.mock.method(chromium,"launchPersistentContext",async()=>({
    pages:()=>[f.page],setDefaultTimeout(){},setDefaultNavigationTimeout(){},on(){},close:async()=>{},
  }));
  const warnings=[];
  t.mock.method(console,"warn",entry=>warnings.push(JSON.parse(entry)));
  const {plan}=createAmazonBrowserExecutionRequest({page_url:"https://www.amazon.com/dp/B012345678"});
  const result=await new PlaywrightCrawlerEngine(limits).run(plan,"not-created",{requestId:"fixture",traceId:"fixture"});
  assert.equal(result.status,"blocked_captcha");
  assert.equal(result.error_code,"blocked_captcha");
  assert.equal(result.item_count,0);
  assert.equal(result.artifacts,undefined);
  assert.equal(waits,0);
  assert.doesNotMatch(JSON.stringify({result,warnings}),/private-route|private-token|checkpoint\/|B012345678/);
});

test("checkpoint can open the existing human handoff but never claims or solves it automatically", async (t) => {
  const { chromium } = await import("playwright");
  const {mkdtemp,readdir,readFile,rm}=await import("node:fs/promises");
  const {tmpdir}=await import("node:os");
  const {join}=await import("node:path");
  const root=await mkdtemp(join(tmpdir(),"scoutops-checkpoint-"));
  const f=fixture({location:"Deliver to 94404"});
  const {locator}=f.page;
  Object.assign(f.page,{
    locator:selector=>({...locator(selector),count:async()=>selector.split(",").includes("html")?1:0}),
    url:()=>"https://www.amazon.com/checkpoint/private-route?token=private-token",
    goto:async()=>({status:()=>200}),
    screenshot:async()=>Buffer.from([255,216,255,217]),
    context:()=>({newCDPSession:async()=>({send:async()=>({data:Buffer.from([255,216,255,217]).toString("base64")}),detach:async()=>{}})}),
    setViewportSize:async size=>assert.deepEqual(size,{width:1280,height:720}),
  });
  t.mock.method(chromium,"launchPersistentContext",async()=>({
    pages:()=>[f.page],setDefaultTimeout(){},setDefaultNavigationTimeout(){},on(){},close:async()=>{},
  }));
  const warnings=[];t.mock.method(console,"warn",entry=>warnings.push(JSON.parse(entry)));
  const controller=new AbortController();
  const {plan}=createAmazonBrowserExecutionRequest({page_url:"https://www.amazon.com/dp/B012345678"});
  const running=new PlaywrightCrawlerEngine(limits).run(plan,"not-created",{
    requestId:"fixture",traceId:"fixture"},{signal:controller.signal,
    handoff:{root,runId:"00000000-0000-4000-8000-000000000001"},
  });
  try {
    let info;
    for(let i=0;i<100&&!info;i++){
      for(const name of await readdir(root)){
        try{info=JSON.parse(await readFile(join(root,name,"info.json"),"utf8"));}catch{}
      }
      if(!info)await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.equal(info?.hostname,"www.amazon.com",JSON.stringify(warnings));
    const files=await readdir(join(root,info.id));
    assert.ok(files.includes("frame.jpg"));
    assert.ok(!files.includes("claim.json")&&!files.includes("command.json"));
    assert.deepEqual(f.actions,[]);
    controller.abort();
    const result=await running;
    assert.equal(result.status,"blocked_captcha");
    assert.equal(result.artifacts,undefined);
    assert.deepEqual(await readdir(root),[]);
  } finally {
    controller.abort();await running;await rm(root,{recursive:true,force:true});
  }
});

test("detail readiness timeouts record only bounded DOM facts and remain timeouts", async (t) => {
  const { chromium } = await import("playwright");
  const target = "https://www.amazon.com/dp/B012345678?tag=private-tag";
  let documentPath = "/dp/B012345678";
  const f = fixture({location:"Deliver to 94404"});
  const { locator } = f.page;
  Object.assign(f.page,{
    locator:(selector)=>({...locator(selector),count:async()=>0}),
    url:()=>target,
    goto:async()=>({status:()=>200}),
    waitForFunction:async()=>{throw new errors.TimeoutError("private browser state");},
    evaluate:async(fn,args)=>{
      assert.deepEqual(Object.keys(args).sort(),["initialPath","postal","selector"]);
      // Execute the actual projection over a fixture without exporting DOM text.
      const oldDocument=globalThis.document, oldLocation=globalThis.location;
      try{
        globalThis.location={pathname:documentPath};
        globalThis.document={readyState:"complete",querySelector:(key)=>
          key==="#glow-ingress-block"?{textContent:"private 94404"}:
          key==="#productTitle"?{textContent:"private product title"}:null};
        return fn(args);
      }finally{globalThis.document=oldDocument;globalThis.location=oldLocation;}
    },
  });
  t.mock.method(chromium,"launchPersistentContext",async()=>({
    pages:()=>[f.page],setDefaultTimeout(){},setDefaultNavigationTimeout(){},on(){},close:async()=>{},
  }));
  const warnings=[];
  t.mock.method(console,"warn",(entry)=>warnings.push(JSON.parse(entry)));
  const {plan}=createAmazonBrowserExecutionRequest({page_url:target});
  for (const [path, kind, matches] of [["/dp/B012345678", "product", true], ["/dp/B087654321", "product", false], ["/s", "search", false], ["/", "home", false], ["/ap/signin", "login", false], ["/checkpoint/test", "checkpoint", false], ["/unknown-private", "other", false]]) {
  documentPath=path;warnings.length=0;
  const result=await new PlaywrightCrawlerEngine(limits).run(plan,"not-created",{
    requestId:"fixture",traceId:"fixture",
  });
  assert.equal(result.status,"timeout");
  assert.equal(result.item_count,0);
  assert.equal(warnings[0].stage,"amazon_detail_ready");
  assert.deepEqual(warnings[0].detail_state,{
    document_state:"complete",document_path_kind:kind,expected_product_path:matches,item_present:false,title_present:true,
    title_nonempty:true,delivery_matches:true,
  });
  assert.doesNotMatch(JSON.stringify(warnings),/private|94404|B012345678|B087654321|unknown-private/);
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
    headers: () => ({}),
    url: () => "https://www.amazon.com/errors/validateCaptcha?private-token=secret",
    request: () => ({
      isNavigationRequest: () => true,
      frame: () => ({ parentFrame: () => (main ? null : {}), page: () => page }),
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


test("real Chromium delivery diagnostics distinguish anonymous, postal and hidden-overlay failures without content", async()=>{
  const {chromium}=await import("playwright"),{inspectAmazonDeliveryReadiness}=await import("../../packages/playwright-crawler/dist/index.js");
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    for(const mode of ["ready","missing_anonymous","wrong_postal","hidden"]){
      await page.setContent(`<html><body><div ${mode==="hidden"?'aria-hidden="true"':""}>${mode==="missing_anonymous"?"":'<a id="nav-link-accountList" href="/ap/signin">Hello, sign in Account &amp; Lists</a>'}</div><div id="glow-ingress-block">Deliver to ${mode==="wrong_postal"?"10001":"94404"}</div><a id="nav-global-location-popover-link" href="">private-content-that-must-not-be-logged</a></body></html>`);
      const result=await inspectAmazonDeliveryReadiness(page,"94404");
      assert.equal(result.postal_matches,mode!=="wrong_postal");
      assert.equal(result.postal_header_count,1);
      assert.equal(result.postal_matching_header_count,mode==="wrong_postal"?0:1);
      assert.equal(result.postal_matching_visible_header_count,mode==="wrong_postal"?0:1);
      assert.equal(result.anonymous_exact_visible,!["missing_anonymous","hidden"].includes(mode));
      assert.equal(result.anonymous_aria_hidden_visible,mode!=="missing_anonymous");
      assert.equal(result.account_link_present,mode!=="missing_anonymous");
      assert.doesNotMatch(JSON.stringify(result),/private|94404|10001|signin|amazon\.com/);
    }
  }finally{await browser.close();}
});

test("delivery failure kind exposes only fixed classifications, never error content",async()=>{
  const {amazonDeliveryFailureKind}=await import("../../packages/playwright-crawler/dist/index.js");
  for(const [message,expected] of [
    ["amazon_delivery_requires_anonymous_page","anonymous_missing"],
    ["amazon_delivery_cache_invalid","daily_cache_invalid"],
    ["locator.waitFor: strict mode violation: private","selector_ambiguous"],
    ["locator.count: Execution context was destroyed, most likely because of a navigation","navigation_context_lost"],
    ["locator.count: Cannot find context with specified id","navigation_context_lost"],
    ["locator.waitFor: Target page, context or browser has been closed","page_closed"],
    ["Timeout private payload","readiness_timeout"],
    ["header.filter is not a function","runtime_method_missing"],
    ["private is not defined","runtime_reference_missing"],
    ["Cannot read properties of undefined","runtime_property_missing"],
    ["private https://example.test/?token=secret","other"],
  ])assert.equal(amazonDeliveryFailureKind(new Error(message)),expected);
  assert.equal(amazonDeliveryFailureKind(null),"other");
});

test("daily cache shape diagnostics expose only counts without admitting rejected cookies",async()=>{
  const {inspectAnonymousDeliveryCookieShape}=await import("../../packages/playwright-crawler/dist/index.js");
  const cookie={name:"session-id",value:"private-token",domain:".amazon.com",path:"/",expires:-1,httpOnly:true,secure:true,sameSite:"Lax"};
  const result=inspectAnonymousDeliveryCookieShape([cookie,{...cookie,name:"at-main",domain:".www.amazon.com"},{...cookie,domain:"evil.test"}]);
  assert.equal(result.cookie_count,3);assert.equal(result.auth_cookie_count,1);
  assert.equal(result.unaccepted_domain_count,2);assert.equal(result.dotted_www_domain_count,1);
  assert.doesNotMatch(JSON.stringify(result),/private-token|session-id|at-main|amazon\.com|evil\.test/);
  assert.ok(Object.values(result).every(Number.isInteger));
});


test("real Chromium: post-region reread waits for exact anonymous rendering without weakening ZIP or identity", {timeout:15000}, async()=>{
  const {chromium}=await import("playwright");const browser=await chromium.launch({headless:true});
  const anonymous='<a id="nav-link-accountList" href="/ap/signin">Hello, sign in Account &amp; Lists</a>';
  try {
    for(const mode of ["delayed_anonymous","missing_anonymous","wrong_postal","wrong_identity"]){
      const ctx=await browser.newContext();ctx.setDefaultTimeout(800);let navigations=0;
      await ctx.route("**/*",route=>{
        assert.equal(new URL(route.request().url()).origin,"https://www.amazon.com");navigations++;
        const modal=JSON.stringify({url:"/fixture-modal?pageType=Gateway&storeContext=generic"});
        return route.fulfill({status:200,contentType:"text/html",body:navigations===1?
          `<html><body>${anonymous}<div id="glow-ingress-block">Deliver to China</div><i id="nav-global-location-data-modal-action" data-a-modal='${modal}'></i></body></html>`:
          `<html><body><div id="account-slot"></div><div id="glow-ingress-block">Deliver to ${mode==="wrong_postal"?"10001":"94404"}</div><script>setTimeout(()=>{document.querySelector('#account-slot').innerHTML=${JSON.stringify(mode==="missing_anonymous"?"":mode==="wrong_identity"?'<a id="nav-link-accountList">Hello, fixture Account &amp; Lists</a>':anonymous)}},300)</script></body></html>`});
      });
      const page=await ctx.newPage();
      // Only the local fixture's provider-issued modal chain is mocked; no external request.
      const response=(url,body)=>({url:()=>url,status:()=>200,text:async()=>body,dispose:async()=>{}});
      ctx.request.get=async url=>response(url,'CSRF_TOKEN: "fixture-issued-token"');
      ctx.request.post=async(url,options)=>{assert.equal(options.data.zipCode,"94404");return response(url,'{}');};
      await page.goto("https://www.amazon.com/",{waitUntil:"domcontentloaded"});
      const safe=async()=>{assert.equal(new URL(page.url()).origin,"https://www.amazon.com");assert.equal(await page.locator('input[type="password"]').count(),0);};
      const reread=async()=>{await page.goto("https://www.amazon.com/",{waitUntil:"domcontentloaded"});assert.equal(await page.getByRole("link",{name:"Hello, sign in Account & Lists",exact:true}).isVisible(),false);};
      try {
        const running=prepareAmazonDeliveryContext(page,"94404",safe,()=>{},reread,800);
        if(mode==="delayed_anonymous")assert.equal(await running,true);
        else await assert.rejects(running,mode==="wrong_postal"?/Timeout/:/requires_anonymous/);
        assert.equal(navigations,2);
      }finally{await ctx.close();}
    }
  }finally{await browser.close();}
});
