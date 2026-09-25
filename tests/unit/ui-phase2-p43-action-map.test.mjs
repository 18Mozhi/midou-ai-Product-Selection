import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";

const reviewPath = "design-plans/ui-phase-2-2026-09-07/action-reviews/P43.json";
const normalized = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const digest = (value) => createHash("sha256").update(value).digest("hex");

test("P43 maps the current user directory, detail and shared-dialog sources without granting runtime acceptance", () => {
  const review = JSON.parse(normalized(reviewPath));
  const sources = {};
  const sourceHashes = {};
  const candidates = [];
  for (const file of Object.keys(review.sourceHashes)) {
    sources[file] = normalized(file);
    sourceHashes[file] = digest(sources[file]);
    candidates.push(...scanSource(sources[file], file).candidates);
  }

  const packages = new Map();
  for (const action of review.actions)
    for (const scene of action.scenes) {
      if (packages.has(scene.package)) continue;
      const evidencePath = `design-plans/ui-phase-2-2026-09-07/design/${scene.package}/evidence.json`;
      packages.set(scene.package, JSON.parse(normalized(evidencePath)));
    }

  const files = new Set();
  for (const action of review.actions)
    for (const reference of action.testReferences) {
      assert.ok(existsSync(reference.file), `missing verifier ${reference.file}`);
      files.add(reference.file);
    }

  const contracts = runContractAudit();
  const summary = validateActionReview(review, {
    candidates,
    sourceHashes,
    contracts: contracts.records,
    packages,
    files,
  });

  assert.equal(summary.pageId, "P43");
  assert.equal(summary.sourceSites, 67);
  assert.equal(summary.actionApproval, "pending-user-review");
  assert.equal(summary.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actions.length, 39);
  assert.ok(review.compositionGaps.length > 0);
});
