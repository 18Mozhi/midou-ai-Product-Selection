import { readPreSelectionRebuild } from "../fixtures/pre-selection-rebuild-snapshot.mjs";
// Archived pre-rebuild inputs only; current UI acceptance is verified separately.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertCaptureSource } from "../../scripts/lib/ui-phase2-capture-source-compatibility.mjs";

const file = "tests/e2e/m06-01-organization-admin.spec.ts";
const source = readPreSelectionRebuild(file);
const before = "8751561100b8dd01b51e86baabb3f7fc562c012e3592bd39fea0bb508af18cef";
const after = "5e04bf6dab3ab40677e0baeeb2af069809d72b99172126cc5cfd9107d59708ea";

test("capture compatibility records the exact test-only locator delta without rebinding old hashes", () => {
  assert.deepEqual(assertCaptureSource(file, source, before), {
    kind: "test-locator-copy-only",
    actual: after,
    captured: before,
    commit: "40de9a12",
  });
  assert.equal(assertCaptureSource(file, source, after).kind, "exact");
});

test("capture compatibility rejects fixture edits, unknown captured hashes and runtime substitutions", () => {
  assert.throws(() => assertCaptureSource(file, source + "\n// changed fixture\n", before));
  assert.throws(() => assertCaptureSource(file, source, "0".repeat(64)));
  assert.throws(() => assertCaptureSource("apps/web/src/App.vue", source, before));
});

test("profile capture compatibility proves only the two committed wait-selector corrections", () => {
  const driver = "scripts/verify-ui-phase2-org-profile-form-vue-c.mjs";
  const text = readFileSync(driver, "utf8");
  const captured = "fcc2125c3a6c479fc2ee081422115cc06742c63b5c1fad85510d7b023e34c53a";
  assert.equal(assertCaptureSource(driver, text, captured).kind, "capture-driver-wait-only");
  assert.throws(() => assertCaptureSource(driver, text + "\n// changed payload", captured));
});
