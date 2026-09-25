import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP69ActionReview } from "../../scripts/build-ui-phase2-p69-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P69.json`, "utf8"));
const sourceFiles = ["apps/web/src/components/FileResilienceCenter.vue"];
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

test("P69 maps all four current FileResilienceCenter controls exactly once", () => {
  assert.deepEqual(review, buildP69ActionReview());
  assert.equal(candidates.length, 4);
  assert.equal(validateActionReview(review, context).sourceSites, 4);
  assert.equal(review.route, "/platform-admin/files");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P69 keeps file reads, retry branches and expired-login navigation separate", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("FL69-LOAD").kind, "read");
  assert.equal(actions.get("FL69-RETRY").sourceCandidateIds.length, 2);
  assert.equal(actions.get("FL69-LOGIN").kind, "navigation");
  assert.match(actions.get("FL69-LOAD").handler, /不列目录、不下载/u);
});

test("P69 treats progress bars as read-only indicators and excludes file operations", () => {
  assert.equal(review.dialogs.kind, "none-in-current-source");
  assert.match(review.pageScopeExclusions.remaining, /只读容量指标/u);
  assert.match(review.compositionGaps.join(" "), /不计按钮/u);
  assert.match(review.compositionGaps.join(" "), /页面无文件浏览\/下载\/删除\/恢复/u);
});

test("P69 does not claim real filesystem, recovery, SQL or formal M07-03 acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实文件系统权限/u);
  assert.match(review.compositionGaps.join(" "), /不等于已测磁盘满/u);
});
