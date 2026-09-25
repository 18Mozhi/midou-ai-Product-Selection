import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP61ActionReview } from "../../scripts/build-ui-phase2-p61-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P61.json`, "utf8"));
const sourceFiles = [
  "apps/web/src/components/PlatformStatusCenterView.vue",
  "apps/web/src/components/PlatformStatusWorkspace.vue",
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

test("P61 maps every current status-view/workspace candidate exactly once", () => {
  assert.deepEqual(review, buildP61ActionReview());
  assert.equal(candidates.length, 6);
  assert.equal(validateActionReview(review, context).sourceSites, 6);
  assert.equal(review.route, "/platform-admin/status");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P61 links only to existing management targets and changes no system state", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  for (const id of [
    "P61-TOPOLOGY",
    "P61-TOPOLOGY-NODE",
    "P61-PROPAGATION",
    "P61-COLLECTION",
    "P61-PROVIDER",
  ])
    assert.equal(actions.get(id).kind, "navigation");
  assert.equal(actions.get("P61-WORKSPACE").kind, "local");
  assert.match(actions.get("P61-WORKSPACE").handler, /不重新GET、不写URL/u);
  assert.match(review.compositionGaps.join(" "), /不在P61启动\/恢复任何服务/u);
});

test("P61 cross-references only its shared parent refresh/retry/trace candidates", () => {
  const shared = review.pageScopeExclusions.sharedCurrentCandidates;
  assert.equal(shared.length, 3);
  assert.ok(shared.some((item) => item.sourceContract.includes("P61-LOAD")));
  assert.ok(shared.some((item) => item.sourceContract.includes("P61-RETRY")));
  assert.ok(shared.some((item) => item.candidateId.endsWith("#1c008f867673db60.1")));
  assert.equal(review.pageScopeExclusions.excludedCurrentCandidates.length, 12);
  assert.match(review.pageScopeExclusions.remaining, /其他内容、email、审核和队列控件不属于P61/u);
});

test("P61 source map does not imply real health, RBAC, SQL or production acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实生产依赖健康/u);
  assert.match(review.dialogs.remaining, /没有新增业务确认弹窗/u);
});
