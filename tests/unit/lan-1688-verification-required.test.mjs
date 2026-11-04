import test from "node:test";
import assert from "node:assert/strict";
import { Lan1688ImageSearch } from "../../packages/provider-sources/dist/lan-1688-image-search.js";
import { Lan1688HealthAdapter } from "../../packages/provider-sources/dist/lan-1688-health-adapter.js";
const image = "https://m.media-amazon.com/images/I/fixture.jpg";
const verification = {
  success: false,
  error_code: "verification_required",
  message: "请在管理后台完成人工验证，自动重试已暂停",
};
test("observed 409 manual verification stops collection without node fallback", async () => {
  let calls = 0;
  const client = new Lan1688ImageSearch("fixture-only", 1000, async () => {
    calls++;
    return new Response(JSON.stringify(verification), { status: 409 });
  });
  await assert.rejects(
    client.collect(image, async () => {}),
    { code: "captcha", retryable: false },
  );
  assert.equal(calls, 1);
});
test("pool verification reports blocked health and does not expose records or credentials", async () => {
  let calls = 0;
  const adapter = new Lan1688HealthAdapter(
    {},
    {
      token: "fixture-only",
      timeoutMs: 1000,
      fetcher: async () => {
        calls++;
        return new Response(JSON.stringify(verification), { status: 409 });
      },
    },
  );
  const result = await adapter.healthCheck({}, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.errorCode, "captcha");
  assert.equal(calls, 6, "existing health pool size is unchanged");
  assert.doesNotMatch(JSON.stringify(result), /fixture-only|records|自动重试已暂停/);
});
for (const [name, body] of [
  ["unknown", JSON.stringify({ error_code: "conflict", message: "verification_required" })],
  ["malformed", "not json"],
  ["string", JSON.stringify("verification_required")],
])
  test(`unrecognized 409 ${name} retains dependency classification`, async () => {
    let calls = 0;
    const client = new Lan1688ImageSearch("fixture-only", 1000, async () => {
      calls++;
      return new Response(body, { status: 409 });
    });
    await assert.rejects(
      client.collect(image, async () => {}),
      { code: "dependency_unavailable", retryable: true },
    );
    assert.equal(calls, 6);
  });
test("oversized 409 errors release each response without accepting a partial verification code", async () => {
  let canceled = 0;
  const client = new Lan1688ImageSearch(
    "fixture-only",
    1000,
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode("x".repeat(5000)));
          },
          cancel() {
            canceled++;
          },
        }),
        { status: 409 },
      ),
  );
  await assert.rejects(
    client.collect(image, async () => {}),
    { code: "dependency_unavailable", retryable: true },
  );
  assert.equal(canceled, 6);
});
