import test from "node:test";
import assert from "node:assert/strict";
import {
  providerHistoricalCapture,
  parseProviderCaptureBlobs,
} from "../../scripts/lib/ui-phase2-provider-historical-capture.mjs";

test("P46 byte parser preserves Chinese text and binary PNG bytes and rejects incomplete output", () => {
  const parts = [Buffer.from("来源记录"), Buffer.from([0, 255, 10, 128])];
  const input = Buffer.concat(
    parts.map((bytes) =>
      Buffer.concat([
        Buffer.from(`${"a".repeat(40)} blob ${bytes.length}\n`),
        bytes,
        Buffer.from("\n"),
      ]),
    ),
  );
  const result = parseProviderCaptureBlobs(input, ["source", "image"]);
  assert.deepEqual([...result.values()], parts);
  for (const bad of [
    input.subarray(0, -1),
    Buffer.concat([input, Buffer.from("x")]),
    Buffer.from("missing\n"),
  ])
    assert.throws(() => parseProviderCaptureBlobs(bad, ["source", "image"]));
});
test("P46 historical reader rejects unknown stages, paths and cache mutation", () => {
  for (const stage of ["current", "__proto__", "../../HEAD"])
    assert.throws(() => providerHistoricalCapture(stage), /Unknown P46/);
  const a = providerHistoricalCapture("feedback-current");
  assert.throws(() => a.source("unknown.vue"), /Source absent/);
  assert.throws(() => a.image("../evidence.json"), /Image absent/);
  const shot = a.evidence.screenshots[0];
  const bytes = a.image(shot.file);
  bytes.fill(0);
  a.evidence.sourceHashes = {};
  const b = providerHistoricalCapture("feedback-current");
  assert.equal(Object.keys(b.evidence.sourceHashes).length, 43);
  assert.notDeepEqual(b.image(shot.file), bytes);
});
