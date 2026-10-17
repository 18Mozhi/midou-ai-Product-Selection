import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { AmazonProductSearchAdapter } from "../../packages/provider-sources/dist/index.js";
import { ProviderSourceExecutor } from "../../apps/worker/dist/provider-source-executor.js";

const incomplete = "<html><body>Unrecognized target response</body></html>";
const good =
  '<html><body><div data-component-type="s-search-result" data-asin="B0ABCDEF12"><h2><span>Storage Box</span></h2><span class="a-price"><span class="a-offscreen">$29.99</span></span></div></body></html>';
function fetcherFor(control) {
  const calls = [];
  return {
    calls,
    fetcher: async (input) => {
      const url = new URL(String(input));
      calls.push(url);
      if (url.pathname === "/robots.txt") return new Response("User-agent: *\nAllow: /");
      return url.searchParams.get("k") === "storage box"
        ? typeof control === "function"
          ? control()
          : new Response(control)
        : new Response(incomplete);
    },
  };
}
const request = {
  provider: { parserVersion: "amazon-public-product-v5" },
  target: { query: "rare concept query" },
  limit: 20,
};

test("a disallowed control path is never fetched", () => {
  // A separate process isolates the real robots-policy cache without changing production hooks.
  const script = `
    import {AmazonProductSearchAdapter} from './packages/provider-sources/dist/index.js';
    const paths=[];
    const adapter=new AmazonProductSearchAdapter(async input=>{
      const url=new URL(String(input));paths.push(url.pathname);
      return new Response(url.pathname==='/robots.txt'?'User-agent: *\\nDisallow: /s':'<html><body>unknown</body></html>');
    });
    try {await adapter.collect({provider:{parserVersion:'amazon-public-product-v5'},target:{page_url:'https://www.amazon.com/dp/B0ABCDEF12'},limit:1},AbortSignal.timeout(1000));}
    catch(e){console.log(JSON.stringify({code:e.code,paths}));}
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.code, "robots_disallowed");
  assert.deepEqual(output.paths, ["/dp/B0ABCDEF12", "/dp/B0ABCDEF12", "/robots.txt"]);
});

test("healthy control does not turn its products into results for an unparseable target", async () => {
  const f = fetcherFor(good);
  await assert.rejects(
    () => new AmazonProductSearchAdapter(f.fetcher).collect(request, AbortSignal.timeout(1000)),
    (e) => e.code === "parse_failed" && e.constructor.name === "AmazonTargetPageParseFailure",
  );
  const searches = f.calls.filter((u) => u.pathname === "/s");
  assert.equal(searches.length, 3);
  assert.deepEqual(
    searches.map((u) => u.searchParams.get("k")),
    ["rare concept query", "rare concept query", "storage box"],
  );
});

test("unparseable control retains provider-wide structural failure", async () => {
  const f = fetcherFor(incomplete);
  await assert.rejects(
    () => new AmazonProductSearchAdapter(f.fetcher).collect(request, AbortSignal.timeout(1000)),
    { code: "source_changed" },
  );
});

test("control rate limit is retained and does not produce target facts", async () => {
  const f = fetcherFor(() => new Response("limited", { status: 429 }));
  await assert.rejects(
    () => new AmazonProductSearchAdapter(f.fetcher).collect(request, AbortSignal.timeout(1000)),
    { code: "rate_limited" },
  );
});

test("a proven healthy control keeps the source circuit healthy while its required target still fails", async () => {
  const f = fetcherFor(good),
    adapter = new AmazonProductSearchAdapter(f.fetcher),
    statements = [];
  const provider = {
    id: "55555555-5555-4555-8555-555555555554",
    code: "amazon_product",
    access_mode: "public_page",
    target_url: "https://www.amazon.com/s",
    parser_version: "amazon-public-product-v5",
    timeout_ms: 20000,
    fields_json: ["title"],
    status: "enabled",
    terms_review_status: "approved",
    terms_version: "test-only",
    terms_expires_at: "2099-08-31T00:00:00Z",
    circuit_failure_threshold: 5,
    created_by: "66666666-6666-4666-8666-666666666666",
    version: 1,
  };
  const c = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    query: async (sql, values) => {
      statements.push([sql, values]);
      if (sql.startsWith("SELECT * FROM providers")) return [[provider]];
      if (sql.startsWith("SELECT state,")) return [[], []];
      return [{ affectedRows: 1 }];
    },
  };
  const executor = new ProviderSourceExecutor(
    {
      getConnection: async () => c,
      query: async (sql) =>
        sql.includes("FROM providers p") ? [[provider]] : [{ affectedRows: 1 }],
    },
    { collect: async (req) => adapter.collect(req, AbortSignal.timeout(1000)) },
    {
      persist: async () => {
        throw new Error("target facts must not be persisted");
      },
    },
    "worker-test",
    undefined,
    async () => new Response("User-agent: *\nAllow: /"),
  );
  await assert.rejects(
    () =>
      executor.execute(
        {
          id: "33333333-3333-4333-8333-333333333335",
          organizationId: "11111111-1111-4111-8111-111111111111",
          workspaceId: "22222222-2222-4222-8222-222222222222",
          attemptCount: 1,
          requestId: "target-test",
          traceId: "target-test",
          leaseToken: "unused",
          subqueries: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              providerId: provider.id,
              ordinal: 0,
              required: true,
              target: request.target,
            },
          ],
        },
        async () => {},
      ),
    { code: "parse_failed" },
  );
  const runtime = statements.find(([sql]) =>
    sql.startsWith("INSERT INTO provider_runtime_circuits"),
  );
  assert.equal(runtime[1][1], "closed");
  assert.equal(runtime[1][2], 0);
  assert.equal(runtime[1][4], null);
  assert.equal(
    statements.some(([sql]) => sql.includes("SET status='disabled'")),
    false,
  );
});
