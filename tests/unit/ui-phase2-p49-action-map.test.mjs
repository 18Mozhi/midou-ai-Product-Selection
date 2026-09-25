import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildP49ActionReview } from "../../scripts/build-ui-phase2-p49-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P49.json`, "utf8"));
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
const candidates = Object.entries(sources).flatMap(([file, source]) =>
  scanSource(source, file).candidates,
);
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((reference) => reference.file)),
);
const context = {
  candidates,
  sourceHashes,
  contracts: runContractAudit().records,
  packages: new Map(),
  files,
};

test("P49 maps every current local candidate to an explicit SC49 contract", () => {
  assert.deepEqual(review, buildP49ActionReview());
  assert.equal(candidates.length, 21);
  assert.equal(validateActionReview(review, context).sourceSites, 21);
  assert.equal(review.route, "/platform-admin/providers/sources/1688-acceptance");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P49 preserves scope wiring, external-run and auth boundaries", () => {
  assert.deepEqual(
    review.actions.find((action) => action.actionId === "SC49-EXECUTION-WIRING").forwardsTo,
    ["SC49-SCOPE-READ", "SC49-RUN"],
  );
  assert.deepEqual(
    review.actions.find((action) => action.actionId === "SC49-ORG-WIRING").forwardsTo,
    ["SC49-SCOPE-READ"],
  );
  assert.equal(review.actions.find((action) => action.actionId === "SC49-RUN").kind, "write");
  assert.equal(review.actions.find((action) => action.actionId === "SC49-AUTH").kind, "navigation");
  assert.match(review.actions.find((action) => action.actionId === "SC49-RUN").remaining, /外部浏览器/u);
  assert.match(review.compositionGaps.join(" "), /不增加直接启用/u);
});

test("P49 source-surface review keeps runtime acceptance unproven", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: context.packages,
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.sharedRemaining.join(" "), /共享导航壳/u);
  assert.match(review.dialogs.remaining, /不重复并入本页动作/u);
});
