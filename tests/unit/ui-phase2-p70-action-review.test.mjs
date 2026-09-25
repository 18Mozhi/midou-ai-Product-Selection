import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP70ActionReview } from "../../scripts/build-ui-phase2-p70-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P70.json`, "utf8"));
const sourceFiles = [
  "apps/web/src/components/CrawlerSchedulerCenter.vue",
  "apps/web/src/components/CrawlerSchedulerEvidence.vue",
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

test("P70 maps all sixteen current scheduler/evidence candidates exactly once", () => {
  assert.deepEqual(review, buildP70ActionReview());
  assert.equal(candidates.length, 16);
  assert.equal(validateActionReview(review, context).sourceSites, 16);
  assert.equal(review.route, "/platform-admin/crawler-scheduler");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P70 keeps both recovery writes separate from preview, cancel and local controls", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("SC70-EXPIRED").kind, "write");
  assert.equal(actions.get("SC70-PROVIDER-RECOVER").kind, "write");
  assert.match(actions.get("SC70-EXPIRED").handler, /打开不写入/u);
  assert.match(actions.get("SC70-EXPIRED").handler, /只删除过期调度槽位/u);
  assert.match(actions.get("SC70-PROVIDER-RECOVER").handler, /不自动健康检查/u);
  assert.equal(actions.get("SC70-FILTER").kind, "local");
  assert.equal(actions.get("SC70-PAGE").kind, "local");
});

test("P70 preserves shared confirmation and technical-detail boundaries", () => {
  const shared = new Set(review.pageScopeExclusions.sharedFiles.map((item) => item.file));
  assert.ok(shared.has("apps/web/src/components/ConfirmDialog.vue"));
  assert.ok(shared.has("apps/web/src/components/TechnicalDetails.vue"));
  assert.equal(review.dialogs.kind, "local-callers-and-listed-shared-only");
  assert.match(review.dialogs.remaining, /打开\/取消不POST/u);
});

test("P70 does not overclaim local counts, database recovery, RBAC or M08-05 acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /MySQL锁\/幂等审计/u);
  assert.match(review.compositionGaps.join(" "), /本地过滤和分页不等同服务端/u);
});
