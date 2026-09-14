import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

// This single later recapture is not part of the earlier lifecycle capture stage.
// Pin both immutable stages and exact pixels; never allow a general image tolerance.
export const detailImageSupersession = Object.freeze({
  file: "output/playwright/responsive-data-view-focus/390-close-focus.png",
  beforeRevision: "54ec47364b3422b1d49a6eea18f070229af56a59",
  afterRevision: "093d643b789cc887edd4762c8612dd3c8904560a",
  beforeSha256: "ed7b8531f3860bfe9c4231a439dbaae084f61969cc479f2d81f36239a3314945",
  afterSha256: "ce9b7f6c717bfde3feea8a17f2bef0af277ddd4a23b4e8f4aff285d53c0bb185",
  dimensions: Object.freeze([390, 900]),
  changedPixels: 2,
  maxChannelDelta: 3,
  bounds: Object.freeze([321, 37, 323, 37]),
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readRevision = (revision, file) =>
  execFileSync("git", ["show", `${revision}:${file}`], { maxBuffer: 1_000_000 });

export function detailLifecycleStageImage(file, currentBytes, historical = readRevision) {
  const revision = detailImageSupersession;
  if (file !== revision.file) return currentBytes;
  assert.equal(hash(currentBytes), revision.afterSha256, "unregistered current focus image");
  const before = historical(revision.beforeRevision, file),
    after = historical(revision.afterRevision, file);
  assert.equal(hash(before), revision.beforeSha256, "lifecycle stage image drift");
  assert.equal(hash(after), revision.afterSha256, "P50 recapture image drift");
  assert.deepEqual(currentBytes, after, "current image must equal the registered P50 recapture");
  const require = createRequire(import.meta.url);
  const { PNG } = require(
    path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
  );
  const a = PNG.sync.read(before),
    b = PNG.sync.read(after);
  assert.deepEqual([a.width, a.height], revision.dimensions);
  assert.deepEqual([b.width, b.height], revision.dimensions);
  let changedPixels = 0,
    maxChannelDelta = 0,
    x0 = a.width,
    y0 = a.height,
    x1 = -1,
    y1 = -1;
  for (let p = 0; p < a.width * a.height; p++) {
    let different = false;
    for (let c = 0; c < 4; c++) {
      const delta = Math.abs(a.data[p * 4 + c] - b.data[p * 4 + c]);
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      different ||= delta > 0;
    }
    if (!different) continue;
    changedPixels++;
    const x = p % a.width,
      y = Math.floor(p / a.width);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  assert.equal(changedPixels, revision.changedPixels);
  assert.equal(maxChannelDelta, revision.maxChannelDelta);
  assert.deepEqual([x0, y0, x1, y1], revision.bounds);
  return before;
}
