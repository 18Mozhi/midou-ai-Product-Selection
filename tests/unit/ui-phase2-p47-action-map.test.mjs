import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P47.json`, "utf8"));
const sources = Object.fromEntries(
  Object.keys(review.sourceHashes).map((file) => [
    file,
    readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  ]),
);
const sourceHashes = Object.fromEntries(
  Object.entries(sources).map(([file, source]) => [
    file,
    createHash("sha256").update(source).digest("hex"),
  ]),
);
const candidates = Object.entries(sources).flatMap(
  ([file, source]) => scanSource(source, file).candidates,
);
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((reference) => reference.file)),
);
const context = {
  candidates,
  sourceHashes,
  contracts: runContractAudit().records,
  packages: new Map([
    [
      "provider-adapters-direction-c",
      JSON.parse(
        readFileSync(`${base}/design/provider-adapters-direction-c/evidence.json`, "utf8"),
      ),
    ],
  ]),
  files,
};

test("P47 maps current page and listed shared candidates without approving actions", () => {
  const result = validateActionReview(review, context);
  assert.equal(result.sourceSites, 31);
  assert.equal(review.route, "/platform-admin/providers/adapters");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(
    review.actions.find((action) => action.actionId === "PR47-SECONDARY-UNBOUND").kind,
    "excluded",
  );
  assert.deepEqual(
    review.actions.find((action) => action.actionId === "PR47-LOAD-WIRING").forwardsTo,
    ["PR47-LOAD"],
  );
  const coveredCandidates = review.actions.flatMap((action) => action.sourceCandidateIds);
  assert.equal(new Set(coveredCandidates).size, 31);
  assert.equal(review.actions.filter((action) => action.kind === "write").length, 1);
  assert.match(review.actions.find((action) => action.actionId === "PR47-PROBE").handler, /POST/u);
});

test("P47 keeps external probe and runtime acceptance boundaries explicit", () => {
  assert.match(review.compositionGaps.join(" "), /同标签页在途锁/u);
  assert.match(review.compositionGaps.join(" "), /真实RBAC/u);
  assert.match(review.compositionGaps.join(" "), /M07-03生产验收/u);
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
  const surface = validateReviewSurfaces(review.surfaceReview, {
    sources,
    packages: context.packages,
  });
  assert.equal(surface.runtimeAcceptance, "unproven");
  assert.equal(surface.callerContainers, 2);
});
