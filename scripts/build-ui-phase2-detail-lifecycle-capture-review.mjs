import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
import { detailLifecycleStageImage } from "./lib/ui-detail-lifecycle-image-stage.mjs";
const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const baselineCommit = "3023a030";
const old = (f) =>
  execFileSync("git", ["show", `${baselineCommit}:${f}`], { maxBuffer: 30_000_000 });
const require = createRequire(import.meta.url);
const { PNG } = require(
  path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
);
assert.ok(process.argv.slice(2).every((a) => a === "--write"));
const root = "design-plans/ui-phase-2-2026-09-07";
const manifests = [
  ...JSON.parse(read(root + "/shared-mobile-detail-capture-review.json")).manifests,
  ...[
    "responsive-data-view-focus",
    "p38-vue-c-preview",
    "p38-toolbar-compositions",
    "p38-entry-links",
    "p38-provider-compositions",
  ].map((p) => `output/playwright/${p}/evidence.json`),
];
assert.equal(manifests.length, 26);
const differences = [];
let images = 0;
for (const manifest of manifests) {
  const previous = JSON.parse(old(manifest)),
    current = JSON.parse(read(manifest));
  assert.deepEqual(
    current.screenshots.map((s) => s.file),
    previous.screenshots.map((s) => s.file),
    manifest,
  );
  for (const shot of previous.screenshots) {
    images++;
    const file = path.posix.dirname(manifest) + "/" + shot.file,
      currentBytes = readFileSync(file);
    // First bind actual disk bytes to their actual manifest. Only then reconstruct
    // the one explicitly registered earlier stage for its unchanged historical table.
    assert.equal(
      current.screenshots.find((s) => s.file === shot.file).sha256,
      hash(currentBytes),
      file,
    );
    const bytes = detailLifecycleStageImage(file, currentBytes),
      next = hash(bytes);
    if (next === shot.sha256) continue;
    const oldBytes = old(file);
    assert.equal(hash(oldBytes), shot.sha256, file);
    const a = PNG.sync.read(oldBytes),
      b = PNG.sync.read(bytes);
    assert.deepEqual([a.width, a.height], [b.width, b.height], file);
    let pixels = 0,
      delta = 0,
      x0 = a.width,
      y0 = a.height,
      x1 = 0,
      y1 = 0;
    for (let p = 0; p < a.width * a.height; p++) {
      let changed = false;
      for (let c = 0; c < 4; c++) {
        const d = Math.abs(a.data[p * 4 + c] - b.data[p * 4 + c]);
        changed ||= d > 0;
        delta = Math.max(delta, d);
      }
      if (changed) {
        pixels++;
        const x = p % a.width,
          y = Math.floor(p / a.width);
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    differences.push({
      file,
      beforeSha256: shot.sha256,
      afterSha256: next,
      dimensions: [a.width, a.height],
      changedPixels: pixels,
      maxChannelDelta: delta,
      bounds: pixels ? [x0, y0, x1, y1] : null,
    });
  }
}
const result = {
  schemaVersion: 1,
  baselineCommit,
  approvedByUser: false,
  scope:
    "Exact recapture differences only; existing styles/content unchanged. Not visual approval, not a general pixel tolerance. New baseline/current bug evidence is separate.",
  manifests,
  images,
  differences,
};
const target = root + "/detail-lifecycle-capture-review.json",
  value = JSON.stringify(result, null, 2) + "\n";
if (process.argv.includes("--write")) writeFileSync(target, value);
else assert.equal(read(target), value, "capture review drift");
console.log(
  JSON.stringify({
    manifests: manifests.length,
    images,
    changed: differences.length,
    maxPixels: Math.max(0, ...differences.map((d) => d.changedPixels)),
    maxDelta: Math.max(0, ...differences.map((d) => d.maxChannelDelta)),
  }),
);
