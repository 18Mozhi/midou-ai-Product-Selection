import test from "node:test";
import assert from "node:assert/strict";
import { readCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";
import { createHash } from "node:crypto";
import {
  beforePublishedPresentation,
  publishedPresentationRevisions,
} from "../../scripts/lib/ui-phase2-published-presentation-baseline.mjs";
const hash = (source) => createHash("sha256").update(source).digest("hex");
for (const [file, revision] of Object.entries(publishedPresentationRevisions)) {
  test(`published presentation history keeps exact registered and captured boundaries: ${file}`, () => {
    // This registry describes an archived release, including now-retired files.
    // Verify its exact Git bytes without requiring production to retain that UI.
    const source = readCaptureSourceRevision(file, revision.current);
    assert.equal(hash(source), revision.current);
    const previous = beforePublishedPresentation(file, source);
    assert.equal(hash(previous), revision.before);
    assert.equal(beforePublishedPresentation(file, previous), previous);
    const unknown = source + "\n<!-- unknown revision -->";
    assert.equal(
      beforePublishedPresentation(file, unknown),
      unknown,
      "unknown revisions must never be silently substituted",
    );
    assert.equal(beforePublishedPresentation("unknown.vue", source), source);
  });
}
