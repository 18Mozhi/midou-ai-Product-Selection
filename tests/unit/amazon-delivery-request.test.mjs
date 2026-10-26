import test from "node:test";
import assert from "node:assert/strict";
import { requestAmazonDeliveryContext } from "../../packages/playwright-crawler/dist/amazon-delivery-request.js";
import { classifyBrowserFailure } from "../../packages/playwright-crawler/dist/index.js";
import { prepareAmazonDeliveryContext } from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";

function fixture({
  status = 200,
  body = 'CSRF_TOKEN: "fixture-dynamic-token"',
  modal,
  postStatus = 200,
  signedIn = false,
  readback = true,
} = {}) {
  const calls = [],
    disposed = [];
  let delivery = "Deliver to China";
  const response = (method, code, text, url) => ({
    status: () => code,
    text: async () => text,
    url: () => url,
    dispose: async () => disposed.push(method),
  });
  const data = modal ?? {
    url: "/gp/glow/get-address-selections.html?pageType=Detail&storeContext=generic",
    ajaxHeaders: {
      "anti-csrftoken-a2z": "fixture-initial",
      Cookie: "must-not-forward",
      Authorization: "must-not-forward",
    },
  };
  const page = {
    url: () => "https://www.amazon.com/dp/B000000001/",
    locator: (selector) => ({
      count: async () => 1,
      getAttribute: async () => JSON.stringify(data),
      textContent: async () => delivery,
      filter: ({ hasText }) => ({
        waitFor: async () => {
          if (!hasText.test(delivery)) throw new Error("Timeout postal readback mismatch");
        },
      }),
    }),
    getByRole: () => ({ isVisible: async () => !signedIn }),
    request: {
      get: async (url, options) => {
        calls.push({ method: "GET", url, options });
        return response("GET", status, body, url);
      },
      post: async (url, options) => {
        calls.push({ method: "POST", url, options });
        return response("POST", postStatus, "{}", url);
      },
    },
  };
  return {
    page,
    calls,
    disposed,
    reread: async () => {
      if (readback) delivery = "Deliver to San Mateo 94404";
    },
  };
}

test("ported public modal chain uses same request jar and provider-issued contract only", async () => {
  const f = fixture();
  assert.equal(await requestAmazonDeliveryContext(f.page, "94404", 1000), true);
  assert.deepEqual(
    f.calls.map((c) => c.method),
    ["GET", "POST"],
  );
  assert.equal(f.calls[0].options.headers["anti-csrftoken-a2z"], "fixture-initial");
  assert.equal(f.calls[1].options.headers["anti-csrftoken-a2z"], "fixture-dynamic-token");
  assert.deepEqual(f.calls[1].options.data, {
    locationType: "LOCATION_INPUT",
    zipCode: "94404",
    deviceType: "web",
    pageType: "Detail",
    storeContext: "generic",
    actionSource: "glow",
  });
  for (const { options } of f.calls) {
    assert.equal(options.maxRedirects, 0);
    assert.equal(options.maxRetries, 0);
    assert.equal(options.timeout, 1000);
    assert.equal(options.headers.Cookie, undefined);
    assert.equal(options.headers.Authorization, undefined);
  }
  assert.deepEqual(f.disposed, ["GET", "POST"]);
});

for (const [options, expected] of [
  [{ status: 503 }, { status: "dependency_failed", code: "network_error", retryable: true }],
  [{ status: 429 }, { status: "rate_limited", code: "rate_limited", retryable: true }],
  [{ status: 401 }, { status: "blocked_login", code: "blocked_login", retryable: false }],
  [
    {
      status: 503,
      body: '<form action="/errors/validateCaptcha"><input id="captchacharacters"></form>',
    },
    { status: "blocked_captcha", code: "blocked_captcha", retryable: false },
  ],
  [
    { postStatus: 403 },
    { status: "dependency_failed", code: "permission_denied", retryable: false },
  ],
])
  test(`request response preserves failure classification ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await assert.rejects(requestAmazonDeliveryContext(f.page, "94404", 1000), (error) => {
      assert.deepEqual(classifyBrowserFailure(error), expected);
      return true;
    });
    assert.equal(f.calls.length, options.postStatus ? 2 : 1);
    assert.equal(f.disposed.length, f.calls.length);
  });

test("missing modal/token falls back before POST, cross-origin modal fails closed", async () => {
  for (const options of [{ modal: {} }, { body: "No dynamic token" }]) {
    const f = fixture(options);
    assert.equal(await requestAmazonDeliveryContext(f.page, "94404", 1000), false);
    assert.ok(f.calls.every((c) => c.method === "GET"));
  }
  const f = fixture({
    modal: { url: "https://example.test/?pageType=Detail&storeContext=generic" },
  });
  await assert.rejects(requestAmazonDeliveryContext(f.page, "94404", 1000));
  assert.equal(f.calls.length, 0);
});

test("request200 never replaces original anonymous document postal proof", async () => {
  for (const readback of [false, true]) {
    const f = fixture({ readback });
    const run = prepareAmazonDeliveryContext(
      f.page,
      "94404",
      async () => {},
      () => {},
      f.reread,
      1000,
    );
    if (readback) assert.equal(await run, true);
    else await assert.rejects(run, /postal readback mismatch/);
    assert.deepEqual(
      f.calls.map((c) => c.method),
      ["GET", "POST"],
    );
  }
  const f = fixture({ signedIn: true });
  await assert.rejects(
    prepareAmazonDeliveryContext(
      f.page,
      "94404",
      async () => {},
      () => {},
      f.reread,
      1000,
    ),
    /anonymous/,
  );
  assert.equal(f.calls.length, 0);
});
