import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP67ActionReview } from "../../scripts/build-ui-phase2-p67-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P67.json`, "utf8"));
const sourceFiles = ["apps/web/src/components/RedisResilienceCenter.vue"];
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

test("P67 maps all four current Redis page controls exactly once", () => {
  assert.deepEqual(review, buildP67ActionReview());
  assert.equal(candidates.length, 4);
  assert.equal(validateActionReview(review, context).sourceSites, 4);
  assert.equal(review.route, "/platform-admin/redis");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P67 keeps load, retry and expired-login behavior inside the existing read contract", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("RD67-LOAD").kind, "read");
  assert.equal(actions.get("RD67-RETRY").sourceCandidateIds.length, 2);
  assert.equal(actions.get("RD67-LOGIN").kind, "navigation");
  assert.match(actions.get("RD67-RETRY").handler, /失败\/空响应追踪与保留快照追踪分开/u);
});

test("P67 keeps shared trace details and excludes Redis mutation controls", () => {
  const shared = new Set(review.pageScopeExclusions.sharedFiles.map((item) => item.file));
  assert.ok(shared.has("apps/web/src/components/TechnicalDetails.vue"));
  assert.equal(review.dialogs.kind, "none-in-current-source");
  assert.match(review.compositionGaps.join(" "), /无重启、恢复、清键/u);
});

test("P67 does not claim real Redis, MySQL, permission or formal M07-03 acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实Redis探针/u);
  assert.match(review.compositionGaps.join(" "), /未知\/占位/u);
});
