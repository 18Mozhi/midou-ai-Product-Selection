import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P39.json`, "utf8"));
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
    "account-overview-direction-c",
    JSON.parse(readFileSync(`${base}/design/account-overview-direction-c/evidence.json`, "utf8")),
  ],
]);
const testFiles = new Set(
  review.actions.flatMap((action) => action.testReferences.map((reference) => reference.file)),
);
const context = {
  candidates,
  sourceHashes,
  contracts: runContractAudit().records,
  packages,
  files: testFiles,
};

test("P39 maps its scoped 22 directory and organization-record source sites", () => {
  const result = validateActionReview(review, context);
  assert.equal(result.sourceSites, 22);
  assert.equal(result.unmappedVisualSlots, 48);
  assert.equal(review.approval, "pending-user-review");
  assert.equal(
    candidates.filter((candidate) =>
      candidate.file.endsWith("PlatformAccountDirectoryWorkspace.vue"),
    ).length,
    16,
  );
  assert.equal(
    candidates.filter((candidate) => candidate.file.endsWith("PlatformAccountGlobalRail.vue"))
      .length,
    3,
  );
  assert.equal(
    candidates.filter((candidate) => candidate.file.endsWith("PlatformOrganizationRecords.vue"))
      .length,
    3,
  );
});

test("P39 reviews the exact local filters, responsive directories and proposal scenes", () => {
  const result = validateReviewSurfaces(review.surfaceReview, { sources, packages });
  assert.equal(result.callerFiles, 3);
  assert.equal(result.localModelBindings, 6);
  assert.equal(result.callerContainers, 3);
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.compositionGaps.join(" "), /22个源码位置/u);
  assert.match(review.compositionGaps.join(" "), /六态映射.*分开/u);
});
