import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  acceptanceHistoricalCapture,
  parseAcceptanceHistoricalBlobs,
  acceptanceCapturedBrowserSource,
} from "../../scripts/lib/ui-phase2-acceptance-historical-capture.mjs";

const hash = (text) => createHash("sha256").update(text).digest("hex");
const blob = (text) =>
  Buffer.concat([
    Buffer.from(`${"a".repeat(40)} blob ${Buffer.byteLength(text)}\n`),
    Buffer.from(text),
    Buffer.from("\n"),
  ]);

test("P49 captured browser build exception requires exact original content", () => {
  assert.equal(
    acceptanceCapturedBrowserSource(Buffer.from("original\r\n"), hash("original\n")),
    "original\n",
  );
  assert.throws(
    () => acceptanceCapturedBrowserSource(Buffer.from("changed\n"), hash("original\n")),
    /Captured browser config build changed/,
  );
});

test("P49 batch reader respects UTF8 byte sizes and CRLF source normalization", () => {
  const expected = { "one.vue": hash("门禁\n"), "two.css": hash("蓝色\n") };
  const result = parseAcceptanceHistoricalBlobs(
    Buffer.concat([blob("门禁\r\n"), blob("蓝色\n")]),
    expected,
  );
  assert.deepEqual(
    [...result],
    [
      ["one.vue", "门禁\n"],
      ["two.css", "蓝色\n"],
    ],
  );
});

test("P49 batch reader rejects missing, truncated, changed and extra objects", () => {
  const expected = { "one.vue": hash("original") };
  for (const bytes of [
    Buffer.from("missing missing\n"),
    blob("original").subarray(0, -1),
    blob("changed"),
    Buffer.concat([blob("original"), blob("extra")]),
  ])
    assert.throws(() => parseAcceptanceHistoricalBlobs(bytes, expected));
});

test("P49 historical stages pin independent original manifests and reject unknown sources", () => {
  for (const stage of ["current", "__proto__", "../page"])
    assert.throws(() => acceptanceHistoricalCapture(stage), /Unknown P49/);
  for (const [stage, count, images] of [
    ["page", 59, 16],
    ["read-states", 61, 27],
    ["actions", 63, 54],
    ["robustness", 65, 42],
    ["lifecycle", 181, 4],
  ]) {
    const capture = acceptanceHistoricalCapture(stage),
      evidence = JSON.parse(capture.manifest);
    assert.equal(Object.keys(evidence.sourceHashes).length, count);
    assert.equal(evidence.screenshots.length, images);
    for (const [file, sha] of Object.entries(evidence.sourceHashes))
      assert.equal(hash(capture.source(file)), sha);
    assert.throws(() => capture.source("unknown.vue"), /Source absent/);
    evidence.sourceHashes = {};
    assert.equal(
      Object.keys(JSON.parse(acceptanceHistoricalCapture(stage).manifest).sourceHashes).length,
      count,
    );
  }
});
