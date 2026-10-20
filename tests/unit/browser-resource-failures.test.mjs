import test from "node:test";
import assert from "node:assert/strict";
import { recordResourceFailure } from "../../packages/playwright-crawler/dist/resource-failures.js";

test("advertising image and CONNECT noise cannot erase script or modal request failures", () => {
  const failures = [];
  const script = { resource_type: "script", network_code: "ERR_FAILED" };
  const modal = { resource_type: "xhr", http_status: 503 };
  recordResourceFailure(failures, script);
  recordResourceFailure(failures, modal);
  for (let i = 0; i < 40; i++) {
    recordResourceFailure(failures, { resource_type: i % 2 ? "image" : "proxy_connect", i });
    assert.ok(failures.length <= 10);
  }
  assert.ok(failures.includes(script));
  assert.ok(failures.includes(modal));
});

test("a later actionable failure displaces lower priority noise, keeping original records", () => {
  const failures = [];
  for (let i = 0; i < 10; i++) recordResourceFailure(failures, { resource_type: "image", i });
  const xhr = { resource_type: "fetch", http_status: 403, hostname: "www.amazon.com" };
  recordResourceFailure(failures, xhr);
  assert.equal(failures.length, 10);
  assert.equal(failures.at(-1), xhr);
  assert.equal(failures[0].i, 1);
});

test("equal priority failures retain the latest ten, lower priority cannot displace them", () => {
  const failures = [];
  for (let i = 0; i < 15; i++) recordResourceFailure(failures, { resource_type: "document", i });
  recordResourceFailure(failures, { resource_type: "proxy_connect", i: 99 });
  assert.deepEqual(failures.map((item) => item.i), [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
});
