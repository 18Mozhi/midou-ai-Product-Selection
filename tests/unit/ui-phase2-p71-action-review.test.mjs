import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildP71ActionReview } from "../../scripts/build-ui-phase2-p71-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P71.json`, "utf8"));
const sourceFiles = [
  "apps/web/src/components/CapacityBoundaryCenter.vue",
  "apps/web/src/components/CapacityBoundaryEvidence.vue",
];
const sources = Object.fromEntries(
  sourceFiles.map((file) => [file, readFileSync(file, "utf8").replaceAll("\r\n", "\n")]),
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
const contracts = runContractAudit().records;
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((ref) => ref.file)),
);
const context = { candidates, sourceHashes, contracts, packages: new Map(), files };

test("P71 maps all seven current capacity page candidates exactly once", () => {
  assert.deepEqual(review, buildP71ActionReview());
  assert.equal(candidates.length, 7);
  assert.equal(validateActionReview(review, context).sourceSites, 7);
  assert.equal(review.route, "/platform-admin/capacity");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P71 separates the audited read, confirmation write and local disclosure", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("SC71-LOAD").kind, "read");
  assert.match(actions.get("SC71-LOAD").handler, /api_view及平台审计/u);
  assert.equal(actions.get("SC71-ATTEST").kind, "write");
  assert.match(actions.get("SC71-ATTEST").handler, /打开不写入/u);
  assert.match(actions.get("SC71-ATTEST").handler, /不启动压测或恢复执行器/u);
  assert.equal(actions.get("SC71-FINDING-TECH").kind, "local");
});

test("P71 keeps shared dialog and parent authorization outside local page ownership", () => {
  const shared = new Set(review.pageScopeExclusions.sharedFiles.map((item) => item.file));
  assert.ok(shared.has("apps/web/src/components/ConfirmDialog.vue"));
  assert.ok(shared.has("apps/web/src/components/PlatformManagementCenter.vue"));
  assert.equal(review.dialogs.kind, "local-callers-and-listed-shared-only");
  assert.match(review.dialogs.remaining, /取消不POST/u);
});

test("P71 does not claim real capacity, SQL transaction, RBAC or M08-06 acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /同提交测量/u);
  assert.match(review.compositionGaps.join(" "), /封顶进度条不构成容量承诺/u);
});
