import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  detailImageSupersession as revision,
  detailLifecycleStageImage,
} from "../../scripts/lib/ui-detail-lifecycle-image-stage.mjs";

const oldBytes = execFileSync("git", ["show", `${revision.beforeRevision}:${revision.file}`]),
  newBytes = execFileSync("git", ["show", `${revision.afterRevision}:${revision.file}`]);
const historical = (ref, file) => {
  assert.equal(file, revision.file);
  assert.ok([revision.beforeRevision, revision.afterRevision].includes(ref));
  return ref === revision.beforeRevision ? oldBytes : newBytes;
};
test("exact current P50 image reconstructs only its pinned lifecycle stage and measures all pixels", () => {
  const current = readFileSync(revision.file);
  assert.deepEqual(current, newBytes);
  assert.deepEqual(detailLifecycleStageImage(revision.file, current, historical), oldBytes);
  const manifest = JSON.parse(
    readFileSync("output/playwright/responsive-data-view-focus/evidence.json", "utf8"),
  );
  assert.equal(
    manifest.screenshots.find((shot) => shot.file === "390-close-focus.png").sha256,
    revision.afterSha256,
  );
});
test("unknown current bytes and reverting to the old stage are not accepted as the later image", () => {
  for (const bytes of [Buffer.concat([newBytes, Buffer.from("drift")]), oldBytes])
    assert.throws(
      () => detailLifecycleStageImage(revision.file, bytes, historical),
      /unregistered current focus image/,
    );
});
test("corrupt or swapped historical stages fail closed", () => {
  assert.throws(
    () => detailLifecycleStageImage(revision.file, newBytes, () => newBytes),
    /lifecycle stage image drift/,
  );
  assert.throws(
    () => detailLifecycleStageImage(revision.file, newBytes, () => oldBytes),
    /P50 recapture image drift/,
  );
});
test("all other image paths remain untouched and cannot acquire this exception", () => {
  const bytes = Buffer.from("unrelated");
  for (const file of ["other.png", revision.file.replace("close-focus", "expanded-control-focus")])
    assert.equal(
      detailLifecycleStageImage(file, bytes, () => assert.fail("must not read history")),
      bytes,
    );
});
test("revision metadata is immutable and explicitly limited to two measured pixels", () => {
  assert.equal(revision.changedPixels, 2);
  assert.equal(revision.maxChannelDelta, 3);
  assert.deepEqual(revision.bounds, [321, 37, 323, 37]);
  assert.throws(() => (revision.changedPixels = 100));
  assert.throws(() => (revision.bounds[0] = 0));
});
