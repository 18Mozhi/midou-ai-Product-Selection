import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const organizationTest = "tests/e2e/m06-01-organization-admin.spec.ts";
const capturedHash = "8751561100b8dd01b51e86baabb3f7fc562c012e3592bd39fea0bb508af18cef";
const scopedAssertionHash = "5c536fabd9fe94c9a51127ab3972fe475f6b8e6c9d8cecea4ab6cc9cb50ea465";
const originalAssertion =
  '  await expect(page.getByRole("heading", { name: "成员与邀请", level: 1 })).toBeVisible();';
const scopedAssertion = [
  "  await expect(",
  '    page.locator(".org-admin-center").getByRole("heading", { name: "成员与邀请", level: 1 }),',
  "  ).toBeVisible();",
].join("\n");
const hash = (source) => createHash("sha256").update(source).digest("hex");

// Preserve capture-time hashes. Exact test-only locator deltas are compatible
// only when reversing them reproduces the complete original capture input.
// Runtime sources, fixture changes and unknown test revisions still fail closed.
export function assertCaptureSource(
  file,
  bytes,
  expected,
  message = `Captured source changed: ${file}`,
) {
  const source = bytes.toString().replaceAll("\r\n", "\n");
  const actual = hash(source);
  if (actual === expected) return { kind: "exact", actual, captured: expected };
  if (file === organizationTest && expected === capturedHash && actual === scopedAssertionHash) {
    assert.equal(source.split(scopedAssertion).length, 2, message);
    assert.equal(hash(source.replace(scopedAssertion, originalAssertion)), expected, message);
    return { kind: "test-assertion-only", actual, captured: expected, commit: "fa8aea67" };
  }
  if (
    file === "scripts/verify-ui-phase2-org-profile-form-vue-c.mjs" &&
    expected === "fcc2125c3a6c479fc2ee081422115cc06742c63b5c1fad85510d7b023e34c53a" &&
    actual === "02e0949cbc545d1fb074a92fa924489627cf012ea1f18eff26c6f184e688886e"
  ) {
    let original = source;
    for (const state of [":disabled", ":not(:disabled)"]) {
      const current = `.org-admin-grid > form > fieldset > button${state}`;
      assert.equal(original.split(current).length, 2, message);
      original = original.replace(current, `.org-admin-grid > form > button${state}`);
    }
    assert.equal(hash(original), expected, message);
    return { kind: "capture-driver-wait-only", actual, captured: expected, commit: "ce13d048" };
  }
  assert.equal(actual, expected, message);
}
