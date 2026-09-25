import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildP72ActionReview } from "../../scripts/build-ui-phase2-p72-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P72.json`, "utf8"));
const sourceFiles = [
  "apps/web/src/components/UiStateShowcase.vue",
  "apps/web/src/components/UiStatePanel.vue",
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

test("P72 maps all eight current demonstration and child-panel candidates once", () => {
  assert.deepEqual(review, buildP72ActionReview());
  assert.equal(candidates.length, 8);
  assert.equal(validateActionReview(review, context).sourceSites, 8);
  assert.equal(review.route, "/ui-states");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P72 distinguishes navigation, query state, example emits and local confirmation", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("ST72-HOME").kind, "navigation");
  assert.equal(actions.get("ST72-SELECT").kind, "local");
  assert.match(actions.get("ST72-ACTIONS").handler, /loading不展示/u);
  assert.equal(actions.get("ST72-CONFIRM-DEMO").kind, "local");
  assert.match(actions.get("ST72-CONFIRM-DEMO").handler, /无API/u);
});

test("P72 keeps shared ConfirmDialog definition and DEV routing outside page scope", () => {
  const shared = new Set(review.pageScopeExclusions.sharedFiles.map((item) => item.file));
  assert.ok(shared.has("apps/web/src/components/ConfirmDialog.vue"));
  assert.ok(shared.has("apps/web/src/App.vue"));
  assert.equal(review.dialogs.kind, "local-callers-and-listed-shared-only");
});

test("P72 does not claim real business effects or production exposure acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /生产不可达/u);
  assert.match(review.compositionGaps.join(" "), /权限申请、撤销或持久化/u);
});
