import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildP73ActionReview } from "../../scripts/build-ui-phase2-p73-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P73.json`, "utf8"));
const sourceFiles = ["apps/web/src/components/NotFoundPage.vue"];
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

test("P73 maps the three current fallback navigation candidates exactly once", () => {
  assert.deepEqual(review, buildP73ActionReview());
  assert.equal(candidates.length, 3);
  assert.equal(validateActionReview(review, context).sourceSites, 3);
  assert.equal(review.route, "/:pathMatch(.*)*");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P73 keeps brand, most-recent and conditional home destinations distinct", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("NF-BRAND").kind, "navigation");
  assert.match(actions.get("NF-RETURN").handler, /router.resolve/u);
  assert.match(actions.get("NF-HOME").condition, /不等于\/home/u);
  assert.match(actions.get("NF-RETURN").remaining, /HTTP状态为404/u);
});

test("P73 declares no current dialog, form or business API action", () => {
  assert.equal(review.dialogs.kind, "none-in-current-source");
  assert.match(review.pageScopeExclusions.remaining, /没有history.back/u);
  assert.match(review.surfaceReview.remaining, /真实HTTP 404/u);
});

test("P73 does not infer destination authorization or complete URL-safety acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /目标页鉴权/u);
  assert.match(review.compositionGaps.join(" "), /点击导航离开后不能继续宣称零请求/u);
});
