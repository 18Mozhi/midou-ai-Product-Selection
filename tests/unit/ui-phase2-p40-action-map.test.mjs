import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const root = process.cwd();
const reviewPath = "design-plans/ui-phase-2-2026-09-07/action-reviews/P40.json";
const normalized = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const digest = (value) => createHash("sha256").update(value).digest("hex");

test("P40 action map exactly covers its reviewed Vue sources without granting acceptance", () => {
  const review = JSON.parse(normalized(reviewPath));
  const sources = {};
  const candidates = [];
  const sourceHashes = {};
  for (const file of Object.keys(review.sourceHashes)) {
    sources[file] = normalized(file);
    sourceHashes[file] = digest(sources[file]);
    candidates.push(...scanSource(sources[file], file).candidates);
  }

  const packages = new Map();
  for (const action of review.actions)
    for (const scene of action.scenes) {
      const evidencePath = `design-plans/ui-phase-2-2026-09-07/design/${scene.package}/evidence.json`;
      if (!packages.has(scene.package))
        packages.set(scene.package, JSON.parse(normalized(evidencePath)));
    }

  const files = new Set();
  for (const action of review.actions)
    for (const reference of action.testReferences) {
      assert.ok(existsSync(reference.file), `missing verifier ${reference.file}`);
      files.add(reference.file);
    }

  const contractAudit = runContractAudit();
  const summary = validateActionReview(review, {
    candidates,
    sourceHashes,
    contracts: contractAudit.records,
    packages,
    files,
  });
  const surfaces = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages,
  });

  assert.equal(summary.pageId, "P40");
  assert.equal(summary.sourceSites, candidates.length);
  assert.equal(summary.actionApproval, "pending-user-review");
  assert.equal(summary.visualApproval, "user-approved-remaining-pages-auto");
  assert.ok(surfaces.callerContainers > 0);
  assert.equal(surfaces.runtimeAcceptance, "unproven");
  assert.equal(review.surfaceReview.status, "source-reviewed-not-runtime-accepted");
});
