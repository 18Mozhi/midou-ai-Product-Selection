import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P45.json`, "utf8"));
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
    "permission-comparison-direction-c",
    JSON.parse(
      readFileSync(`${base}/design/permission-comparison-direction-c/evidence.json`, "utf8"),
    ),
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

test("P45 maps all current permission-page source candidates and keeps action approval pending", () => {
  const result = validateActionReview(review, context);
  assert.equal(result.sourceSites, 16);
  assert.equal(review.route, "/platform-admin/permissions");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(
    review.actions.find((action) => action.actionId === "PA45-REFRESH").sourceCandidateIds.length,
    3,
  );
  assert.match(
    review.actions.find((action) => action.actionId === "PA45-RESET").handler,
    /P45通过既有watch\/router\.replace同步URL/u,
  );
  assert.equal(
    review.actions.some((action) => action.kind === "write"),
    false,
  );
});

test("P45 explicitly excludes shared account routes and asserts the current read-only boundary", () => {
  const surface = validateReviewSurfaces(review.surfaceReview, { sources, packages });
  assert.match(review.compositionGaps.join(" "), /没有角色编辑或授权写操作/u);
  assert.equal(surface.runtimeAcceptance, "unproven");
  assert.equal(
    review.actions.find((action) => action.actionId === "PA45-OUT-OTHER-ROUTES").sourceCandidateIds
      .length,
    8,
  );
  assert.equal(
    candidates.some((candidate) => candidate.file.endsWith("PlatformAccountGlobalRail.vue")),
    false,
  );
});
