import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP63ActionReview } from "../../scripts/build-ui-phase2-p63-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P63.json`, "utf8"));
const sourceFiles = ["apps/web/src/components/ApiCoverageOperationCard.vue"];
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

test("P63 maps every current local operation-card control exactly once", () => {
  assert.deepEqual(review, buildP63ActionReview());
  assert.equal(candidates.length, 2);
  assert.equal(validateActionReview(review, context).sourceSites, 2);
  assert.equal(review.route, "/platform-admin/api-coverage");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P63 keeps evidence and technical trace as separate read-only native disclosures", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("P63-OP-CURRENT-EVIDENCE").kind, "local");
  assert.match(actions.get("P63-OP-CURRENT-EVIDENCE").handler, /不发请求、不运行接口验证/u);
  assert.equal(actions.get("P63-OP-CURRENT-TRACE").kind, "local");
  assert.match(actions.get("P63-OP-CURRENT-TRACE").handler, /不重读报告/u);
  assert.equal(review.dialogs.kind, "none-in-current-source");
});

test("P63 cross-references parent filters and shared drawer without duplicate ownership", () => {
  const shared = new Set(review.pageScopeExclusions.sharedFiles.map((item) => item.file));
  assert.ok(shared.has("apps/web/src/components/PlatformManagementCenter.vue"));
  assert.ok(shared.has("apps/web/src/components/ResponsiveFilterDrawer.vue"));
  assert.match(review.pageScopeExclusions.remaining, /不重复计数/u);
});

test("P63 mapping does not claim production report, API probes, RBAC or formal acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实受限报告/u);
  assert.match(review.compositionGaps.join(" "), /不新增下载、探测、批准/u);
});
