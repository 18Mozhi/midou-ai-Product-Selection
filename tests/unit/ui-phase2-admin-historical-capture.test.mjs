import test from "node:test";
import assert from "node:assert/strict";
import { adminHistoricalCapture } from "../../scripts/lib/ui-phase2-admin-historical-capture.mjs";

test("P44 historical reader rejects an unknown stage, source or image", () => {
  for (const stage of ["current", "__proto__", "controls", "../../HEAD"])
    assert.throws(() => adminHistoricalCapture(stage), /Unknown P44/);
  const capture = adminHistoricalCapture("controls-implemented");
  assert.throws(
    () => capture.source("apps/web/src/design/platform-admin-mobile-tokens.css"),
    /Source absent/,
  );
  assert.throws(() => capture.image("../evidence.json"), /Image absent/);
  const detail = adminHistoricalCapture("detail-preview");
  assert.equal(detail.evidence.kind, "P44-ADMIN-DETAIL-VUE-PREVIEW-r1");
  assert.throws(
    () => detail.source("apps/web/src/design/platform-admin-mobile-tokens.css"),
    /Source absent/,
  );
  assert.throws(() => detail.image("../../current.png"), /Image absent/);
});

test("P44 history returns independent manifests and image buffers, never mutable cache state", () => {
  const capture = adminHistoricalCapture("controls-implemented");
  const first = capture.evidence.screenshots[0];
  const image = capture.image(first.file);
  image.fill(0);
  capture.evidence.sourceHashes = {};
  const fresh = adminHistoricalCapture("controls-implemented");
  assert.equal(Object.keys(fresh.evidence.sourceHashes).length, 36);
  assert.notDeepEqual(fresh.image(first.file), image);
  assert.equal(fresh.image(first.file).subarray(1, 4).toString(), "PNG");
});
