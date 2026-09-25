import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P46.json`, "utf8"));
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
const packages = new Map([
  [
    "provider-registry-direction-c",
    JSON.parse(readFileSync(`${base}/design/provider-registry-direction-c/evidence.json`, "utf8")),
  ],
]);
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((reference) => reference.file)),
);
const context = {
  candidates,
  sourceHashes,
  contracts: runContractAudit().records,
  packages,
  files,
};

test("P46 maps current provider-registry source candidates and keeps action approval pending", () => {
  const result = validateActionReview(review, context);
  assert.equal(result.sourceSites, 37);
  assert.equal(review.route, "/platform-admin/providers");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(
    review.actions.find((action) => action.actionId === "PR46-PANEL-SECONDARY-UNBOUND").kind,
    "excluded",
  );
  assert.deepEqual(
    review.actions.find((action) => action.actionId === "PR46-LOAD-WIRING").forwardsTo,
    ["PR46-LOAD"],
  );
  assert.equal(
    review.actions.some((action) => action.kind === "write"),
    true,
  );
});

test("P46 retains listed modal and shared-control scope without claiming runtime acceptance", () => {
  const surface = validateReviewSurfaces(review.surfaceReview, { sources, packages });
  assert.equal(surface.runtimeAcceptance, "unproven");
  assert.equal(review.dialogs.kind, "local-callers-and-listed-shared-only");
  assert.match(review.compositionGaps.join(" "), /PR-G01/u);
  assert.match(review.surfaceReview.sharedRemaining.join(" "), /NavigationShell/u);
});
