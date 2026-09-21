import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Read-only original review evidence, never a replacement for current UI validation.
const stages = {
  page: [
    "5bbd5aaab7c5b32f7974558e7cb766bad67882c8",
    "fc890a22829001a8f9b4f28b30990910b5fb847518732b59862fc446f89b70f9",
  ],
  "read-states": [
    "4462621e24cd2297f06c94051ef6fe5729e0d233",
    "801f4f38c6e0a932580cc0b725537a879fac7b0b677e60234948886c142b3b30",
  ],
  actions: [
    "1579412d1a4d0c59485c6b943f12e90954eaa09b",
    "00a115174e0010294ffe04a02fa9357d9c851958b4a95fe6e6a6d50ecf70eedb",
  ],
  robustness: [
    "952e81e0dc9900c90491ca11499253d4a2c06c4d",
    "e471fff26a54d23ee5ad4f03fb0e8e04fa4ad6e53f8bf8cad7e34042d2d3afb8",
  ],
  lifecycle: [
    "7c92a5d62191399e5a57ce51f798ce82e90f609a",
    "51c794dec7fc13dec2d1967b682d23348b57e9eabc4d20d3abd9552fe1ec706f",
  ],
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (value) => value.toString("utf8").replaceAll("\r\n", "\n");
const cache = new Map();

export function acceptanceCapturedBrowserSource(bytes, expected) {
  const source = normalize(bytes);
  assert.equal(hash(source), expected, "Captured browser config build changed");
  return source;
}

// Git sizes are byte lengths, not JS string lengths (Chinese sources must stay intact).
export function parseAcceptanceHistoricalBlobs(bytes, expected) {
  const sources = new Map();
  let offset = 0;
  for (const [file, sha] of Object.entries(expected)) {
    const end = bytes.indexOf(10, offset);
    assert.ok(end >= offset, "Missing Git object header");
    const header = bytes.subarray(offset, end).toString("ascii");
    const match = /^[0-9a-f]{40,64} blob ([0-9]+)$/.exec(header);
    assert.ok(match, "Expected a complete Git blob header");
    const size = Number(match[1]);
    assert.ok(Number.isSafeInteger(size), "Invalid Git blob size");
    const start = end + 1,
      finish = start + size;
    assert.ok(finish < bytes.length && bytes[finish] === 10, "Truncated Git blob");
    const source = normalize(bytes.subarray(start, finish));
    assert.equal(hash(source), sha, `Historical P49 source mismatch: ${file}`);
    sources.set(file, source);
    offset = finish + 1;
  }
  assert.equal(offset, bytes.length, "Unexpected trailing Git output");
  return sources;
}

export function acceptanceHistoricalCapture(stage) {
  assert.ok(Object.hasOwn(stages, stage), "Unknown P49 historical stage");
  if (!cache.has(stage)) {
    const [revision, manifestSha] = stages[stage];
    const file = `output/playwright/p49-acceptance-${stage}-review/evidence.json`;
    const manifest = normalize(
      execFileSync("git", ["show", `${revision}:${file}`], { maxBuffer: 16 * 1024 * 1024 }),
    );
    assert.equal(hash(manifest), manifestSha, "Historical P49 manifest must match in full");
    const expected = JSON.parse(manifest).sourceHashes;
    // This single ignored build output was captured originally but never stored in Git.
    // Its current bytes must still equal the original manifest; no generic missing-file fallback.
    const browserBuild = "packages/config/dist/browser.js";
    assert.ok(Object.hasOwn(expected, browserBuild));
    const built = acceptanceCapturedBrowserSource(
      readFileSync(browserBuild),
      expected[browserBuild],
    );
    const tracked = Object.fromEntries(
      Object.entries(expected).filter(([file]) => file !== browserBuild),
    );
    const files = Object.keys(tracked);
    assert.ok(files.length > 0);
    assert.ok(
      files.every((file) => !/[\r\n]/.test(file)),
      "Invalid source path",
    );
    const bytes = execFileSync("git", ["cat-file", "--batch"], {
      input: files.map((file) => `${revision}:${file}\n`).join(""),
      maxBuffer: 64 * 1024 * 1024,
    });
    const sources = parseAcceptanceHistoricalBlobs(bytes, tracked);
    sources.set(browserBuild, built);
    cache.set(stage, { manifest, sources });
  }
  const { manifest, sources } = cache.get(stage);
  return {
    manifest,
    source(file) {
      assert.ok(sources.has(file), "Source absent from original P49 manifest");
      return sources.get(file);
    },
  };
}
