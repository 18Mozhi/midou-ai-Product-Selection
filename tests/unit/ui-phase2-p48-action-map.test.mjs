import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildP48ActionReview } from "../../scripts/build-ui-phase2-p48-action-review.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P48.json`, "utf8"));
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

test("P48 maps all current local source candidates to existing SC48 semantics", () => {
  assert.deepEqual(review, buildP48ActionReview());
  const result = validateActionReview(review, context);
  assert.equal(result.sourceSites, 83);
  assert.equal(review.route, "/platform-admin/providers/sources");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(
    review.actions.find((action) => action.actionId === "SC48-DIRECTORY-EVENT-WIRING").kind,
    "wiring",
  );
  assert.deepEqual(
    review.actions.find((action) => action.actionId === "SC48-CONFIG-VERSION-DIALOG-WIRING")
      .forwardsTo,
    ["SC48-CONFIG", "SC48-VERSIONS"],
  );
  assert.equal(review.actions.find((action) => action.actionId === "SC48-PROBE").kind, "write");
  assert.equal(review.actions.find((action) => action.actionId === "SC48-SAMPLES").kind, "write");
});

test("P48 records dialog and external-side-effect limits without granting action approval", () => {
  const surface = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: context.packages,
  });
  assert.equal(surface.runtimeAcceptance, "unproven");
  assert.equal(review.dialogs.kind, "local-callers-and-listed-shared-only");
  assert.match(review.dialogs.remaining, /独立复核子窗/u);
  assert.match(review.compositionGaps.join(" "), /可能触达外部来源/u);
  assert.match(review.compositionGaps.join(" "), /真实RBAC/u);
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});
