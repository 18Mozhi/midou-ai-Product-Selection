import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { AmazonProductSearchAdapter } from "../../packages/provider-sources/dist/index.js";

const context = { provider: { parserVersion: "amazon-public-product-v5" } };
const search =
  '<html><body><div data-component-type="s-search-result" data-asin="B0ABCDEF12"><h2><span>Storage Box</span></h2></div></body></html>';
const detail =
  '<html><body><div id="centerCol"><h1 id="productTitle">Storage Box</h1></div></body></html>';
const verification =
  '<html><head><meta http-equiv="refresh" content="5; URL=/dp/B0ABCDEF12?bm-verify=test-only"></head></html>';

function setup(detailResponse, searchResponse = () => new Response(search)) {
  const calls = [];
  const adapter = new AmazonProductSearchAdapter(async (input, options) => {
    const url = new URL(String(input));
    calls.push({ path: url.pathname, url: url.toString(), signal: options?.signal });
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nAllow: /");
    if (url.pathname === "/s") return searchResponse();
    assert.equal(url.toString(), "https://www.amazon.com/dp/B0ABCDEF12");
    return detailResponse();
  });
  return { adapter, calls };
}

test("Amazon readiness requires the actual search result's detail, without requiring a known price", async () => {
  const { adapter, calls } = setup(() => new Response(detail));
  const signal = AbortSignal.timeout(1000);
  const result = await adapter.healthCheck(context, signal);
  assert.equal(result.status, "ready");
  assert.equal(result.errorCode, null);
  assert.match(result.message, /搜索与抽样详情/);
  assert.deepEqual(
    calls.filter((c) => c.path !== "/robots.txt").map((c) => c.path),
    ["/s", "/dp/B0ABCDEF12"],
  );
  assert.ok(calls.filter((c) => c.path !== "/robots.txt").every((c) => c.signal === signal));
  assert.equal("records" in result, false);
});

for (const [name, response, code] of [
  ["verification interstitial", () => new Response(verification), "permission_denied"],
  ["HTTP access denial", () => new Response("denied", { status: 403 }), "permission_denied"],
  ["rate limit", () => new Response("limited", { status: 429 }), "rate_limited"],
  ["missing detail", () => new Response("gone", { status: 404 }), "empty_result"],
]) {
  test(`a healthy search cannot hide detail ${name}`, async () => {
    const { adapter, calls } = setup(response);
    const result = await adapter.healthCheck(context, AbortSignal.timeout(1000));
    assert.equal(result.status, "degraded");
    assert.equal(result.errorCode, code);
    assert.equal(calls.filter((c) => c.path === "/dp/B0ABCDEF12").length, 1);
    assert.ok(!calls.some((c) => c.url.includes("bm-verify")));
    assert.equal("records" in result, false);
  });
}

test("failed search stops before any detail request", async () => {
  const { adapter, calls } = setup(
    () => {
      throw Error("must not request detail");
    },
    () => new Response("denied", { status: 403 }),
  );
  const result = await adapter.healthCheck(context, AbortSignal.timeout(1000));
  assert.equal(result.status, "degraded");
  assert.equal(result.errorCode, "permission_denied");
  assert.deepEqual(
    calls.map((c) => c.path),
    ["/s"],
  );
});

test("cancellation after search prevents the follow-up detail request", async () => {
  const controller = new AbortController();
  const { adapter, calls } = setup(
    () => {
      throw Error("must not request detail");
    },
    () => {
      controller.abort();
      return new Response(search);
    },
  );
  const result = await adapter.healthCheck(context, controller.signal);
  assert.equal(result.status, "degraded");
  assert.deepEqual(
    calls.map((c) => c.path),
    ["/s"],
  );
});

test("detail robots prohibition is checked before the sampled detail HTTP request", () => {
  const source = `import {AmazonProductSearchAdapter} from './packages/provider-sources/dist/index.js';
    const calls=[]; const adapter=new AmazonProductSearchAdapter(async input=>{
      const path=new URL(String(input)).pathname;calls.push(path);
      if(path==='/robots.txt')return new Response('User-agent: *\\nAllow: /s\\nDisallow: /dp/');
      if(path==='/s')return new Response(${JSON.stringify(search)});
      throw Error('forbidden detail requested');
    });
    const result=await adapter.healthCheck(${JSON.stringify(context)},AbortSignal.timeout(1000));
    console.log(JSON.stringify({result,calls}));`;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  assert.equal(child.status, 0, child.stderr);
  const { result, calls } = JSON.parse(child.stdout);
  assert.equal(result.status, "degraded");
  assert.equal(result.errorCode, "robots_disallowed");
  assert.deepEqual(calls, ["/s", "/robots.txt"]);
});
