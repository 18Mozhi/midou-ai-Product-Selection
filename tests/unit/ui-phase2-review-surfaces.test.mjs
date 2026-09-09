import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  scanReviewSurfaces,
  validateReviewSurfaces,
} from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

function fixture() {
  const source =
    '<template><ResponsiveDataView><input v-model="query" /></ResponsiveDataView><aside v-if="detail">Detail</aside><ConfirmDialog :open="confirming" /></template>';
  const scan = scanReviewSurfaces(source, "Example.vue");
  const review = {
    status: "source-reviewed-not-runtime-accepted",
    files: ["Example.vue"],
    dependencyHashes: { "Example.vue": createHash("sha256").update(source).digest("hex") },
    inputs: scan.inputs.map((i) => ({
      ...i,
      meaning: "local search",
      remaining: "all states pending",
    })),
    containers: scan.containers.map((c) => ({
      ...c,
      sourceBehavior: "actual caller",
      remaining: "mounted flow pending",
      variants: [
        {
          name: "default",
          evidenceScope: "related-scene-only",
          remaining: "not approved",
          scenes: [{ package: "sample", scene: "default" }],
        },
      ],
    })),
    sharedRemaining: ["shared behaviors require each consumer verification"],
  };
  const context = {
    sources: { "Example.vue": source },
    packages: new Map([
      [
        "sample",
        {
          screenshots: [
            { scene: "default", viewport: { width: 1440 } },
            { scene: "default", viewport: { width: 390 } },
          ],
        },
      ],
    ]),
  };
  return { review, context };
}
test("caller inventory counts inline aside separately from a modal", () => {
  const { review, context } = fixture();
  assert.equal(review.containers[1].shape, "inline-aside");
  assert.deepEqual(validateReviewSurfaces(review, context), {
    callerFiles: 1,
    localModelBindings: 1,
    callerContainers: 3,
    consumerVariants: 3,
    runtimeAcceptance: "unproven",
  });
});
for (const [name, change] of [
  ["input omitted", (r) => r.inputs.pop()],
  ["duplicate input", (r) => r.inputs.push(r.inputs[0])],
  ["wrong input", (r) => (r.inputs[0].binding = "other")],
  ["missing input limit", (r) => (r.inputs[0].remaining = "")],
  ["container omitted", (r) => r.containers.pop()],
  [
    "variant cannot grant acceptance",
    (r) => (r.containers[0].variants[0].evidenceScope = "accepted"),
  ],
  ["aside called modal", (r) => (r.containers[1].shape = "confirmation-dialog")],
  ["duplicate variant", (r) => r.containers[0].variants.push(r.containers[0].variants[0])],
  ["variant without scene", (r) => (r.containers[0].variants[0].scenes = [])],
  ["no shared limits", (r) => (r.sharedRemaining = [])],
  ["missing caller hash", (r) => (r.dependencyHashes = {})],
  ["source drift", (r, c) => (c.sources["Example.vue"] += "\n")],
  ["fake acceptance", (r) => (r.status = "accepted")],
  ["missing viewport", (r, c) => c.packages.get("sample").screenshots.pop()],
])
  test("rejects " + name, () => {
    const { review, context } = fixture();
    change(review, context);
    assert.throws(() => validateReviewSurfaces(review, context));
  });
