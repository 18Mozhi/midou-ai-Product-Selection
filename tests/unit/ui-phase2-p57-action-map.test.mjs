import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildP57ActionReview } from "../../scripts/build-ui-phase2-p57-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P57.json`, "utf8"));
const sourceFiles = [
  "apps/web/src/components/PlatformNotificationManagement.vue",
  "apps/web/src/components/PlatformMessageWorkbench.vue",
  "apps/web/src/components/PlatformNotificationOperations.vue",
  "apps/web/src/components/PlatformNotificationPagination.vue",
  "apps/web/src/components/PlatformMessageEditor.vue",
  "apps/web/src/components/PlatformNotificationActionDialog.vue",
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
const scopedIds = new Set(review.actions.flatMap((action) => action.sourceCandidateIds));
const candidates = Object.entries(sources).flatMap(([file, source]) =>
  scanSource(source, file).candidates.filter((candidate) => scopedIds.has(candidate.candidateId)),
);
const contracts = runContractAudit().records;
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((reference) => reference.file)),
);
const context = { candidates, sourceHashes, contracts, packages: new Map(), files };

test("P57 maps all 31 notification-component candidates and records shared parent boundaries", () => {
  assert.deepEqual(review, buildP57ActionReview());
  assert.equal(candidates.length, 31);
  assert.equal(validateActionReview(review, context).sourceSites, 31);
  assert.equal(review.route, "/platform-admin/notifications");
  assert.equal(review.pageScopeExclusions.excludedCurrentCandidates.length, 11);
  assert.equal(review.pageScopeExclusions.sharedCurrentCandidates.length, 4);
  for (const parent of review.pageScopeExclusions.sharedCurrentCandidates) {
    assert.ok(
      contracts.some(
        (record) =>
          record.candidateId === parent.candidateId &&
          record.document === review.contract &&
          ["identity-current", "line-moved"].includes(record.status),
      ),
    );
  }
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P57 keeps message and delivery filters and pagination independent", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.notDeepEqual(
    actions.get("PN57-MESSAGE-PAGE-WIRING").sourceCandidateIds,
    actions.get("PN57-NOTIFICATION-PAGE-WIRING").sourceCandidateIds,
  );
  assert.match(actions.get("PN57-FILTER-WIRING").handler, /不作用于消息草稿目录/u);
  assert.equal(actions.get("PN57-FILTER-WIRING").kind, "local");
});

test("P57 draft save remains draft and publish/cancel remain distinct reason-gated actions", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("PN57-EDITOR-SAVE").kind, "local");
  assert.match(actions.get("PN57-EDITOR-SAVE").handler, /不自动发布/u);
  assert.match(actions.get("PN57-MESSAGE-PUBLISH").handler, /独立原因窗/u);
  assert.match(actions.get("PN57-MESSAGE-CANCEL").handler, /不撤回已发布消息/u);
  assert.match(actions.get("PN57-ACTION-CONFIRM").condition, /2–300/u);
  assert.match(review.compositionGaps.join(" "), /邮件能力保持关闭/u);
});

test("P57 proposal checks do not claim production delivery or live RBAC", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /收件人去重/u);
  assert.match(review.surfaceReview.remaining, /M07-03/u);
});
