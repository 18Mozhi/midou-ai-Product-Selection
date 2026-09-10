import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const responsiveFocusRevision = Object.freeze({
  file: "apps/web/src/components/ResponsiveDataView.vue",
  baseline: "ea005452",
  before: "28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa",
  after: "b9e635a3708a3733fd66ead2be6ac840fd70872e0b5af94b3fab171407245d99",
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");

// Historical contract tables stay untouched. Permit only this explicitly tested revision,
// not arbitrary future source drift; every proposal still must recapture current source hashes.
export function responsiveFocusContractHash(file, expected) {
  const revision = responsiveFocusRevision;
  if (file !== revision.file) return expected;
  assert.equal(expected, revision.before, "unknown historical responsive-view contract");
  assert.equal(
    hash(
      execFileSync("git", ["show", `${revision.baseline}:${file}`], {
        encoding: "utf8",
      }).replaceAll("\r\n", "\n"),
    ),
    revision.before,
  );
  assert.equal(hash(read(file)), revision.after, "unreviewed responsive-view revision");
  const lifecycle = JSON.parse(read("output/playwright/p38-shell-lifecycle/current/evidence.json"));
  assert.equal(lifecycle.mode, "current-regression");
  assert.equal(lifecycle.sourceHashes[file], revision.after);
  assert.equal(lifecycle.processesClosed, true);
  assert.equal(lifecycle.observations.length, 8);
  assert.ok(lifecycle.observations.every((v) => v.dialogs === 0 && v.appInert === false));
  const evidence = JSON.parse(read("output/playwright/responsive-data-view-focus/evidence.json"));
  assert.equal(evidence.sourceHashes[file], revision.after);
  assert.equal(evidence.checks.length, 10);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.approval, "pending");
  for (const [source, fingerprint] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(source)), fingerprint, source);
  for (const shot of evidence.screenshots)
    assert.equal(
      hash(readFileSync(`output/playwright/responsive-data-view-focus/${shot.file}`)),
      shot.sha256,
      shot.file,
    );
  return revision.after;
}
