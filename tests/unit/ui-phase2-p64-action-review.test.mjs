import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP64ActionReview } from "../../scripts/build-ui-phase2-p64-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P64.json`, "utf8"));
const sourceFiles = [
  "apps/web/src/components/BackupRecoveryCenter.vue",
  "apps/web/src/components/BackupRecoveryDirectory.vue",
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

test("P64 maps all ten current page-owned candidates exactly once", () => {
  assert.deepEqual(review, buildP64ActionReview());
  assert.equal(candidates.length, 10);
  assert.equal(validateActionReview(review, context).sourceSites, 10);
  assert.equal(review.route, "/platform-admin/operations");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P64 keeps refresh, login and page-local disclosures within read-only contracts", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("BR64-LOAD").kind, "read");
  assert.equal(actions.get("BR64-RETRY").sourceCandidateIds.length, 2);
  assert.equal(actions.get("BR64-LOGIN").kind, "navigation");
  assert.equal(actions.get("BR64-TECH").sourceCandidateIds.length, 3);
  assert.match(review.compositionGaps.join(" "), /没有创建备份、执行恢复、启动演练/u);
});

test("P64 cross-references shared details and never claims a destructive confirmation dialog", () => {
  const shared = new Set(review.pageScopeExclusions.sharedFiles.map((item) => item.file));
  assert.ok(shared.has("apps/web/src/components/ResponsiveDataView.vue"));
  assert.ok(shared.has("apps/web/src/components/TableViewControls.vue"));
  assert.equal(review.dialogs.kind, "local-callers-and-listed-shared-only");
  assert.match(review.dialogs.remaining, /不存在备份\/恢复\/演练执行确认窗/u);
});

test("P64 source review remains separate from MySQL, encryption and recovery acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实platform:operate/u);
  assert.match(review.compositionGaps.join(" "), /不推导真实恢复能力/u);
});
