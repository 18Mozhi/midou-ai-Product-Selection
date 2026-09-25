import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP58ActionReview } from "../../scripts/build-ui-phase2-p58-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P58.json`, "utf8"));
const file = "apps/web/src/components/CommercialOperationsCenter.vue";
const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const sources = { [file]: source };
const sourceHashes = { [file]: createHash("sha256").update(source).digest("hex") };
const candidates = scanSource(source, file).candidates;
const contracts = runContractAudit().records;
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((ref) => ref.file)),
);
const context = { candidates, sourceHashes, contracts, packages: new Map(), files };

test("P58 maps all current commercial-operation source candidates exactly once", () => {
  assert.deepEqual(review, buildP58ActionReview());
  assert.equal(candidates.length, 43);
  assert.equal(validateActionReview(review, context).sourceSites, 43);
  assert.equal(review.route, "/platform-admin/commercial");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P58 distinguishes preparation dialogs from actual commercial writes", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  for (const id of [
    "CO58-SUSPEND",
    "CO58-RESUME",
    "CO58-END",
    "CO58-ASSIGN",
    "CO58-ADJUST",
    "CO58-REVOKE",
    "CO58-ACTIVATE",
    "CO58-RETIRE",
    "CO58-SAVE-PREPARE",
  ])
    assert.equal(actions.get(id).kind, "local");
  assert.equal(actions.get("CO58-CREATE").kind, "write");
  assert.match(actions.get("CO58-CREATE").handler, /POST \/platform\/commercial\/plans/u);
  assert.match(actions.get("CO58-CREATE").handler, /不自动启用或分配/u);
  assert.equal(actions.get("CO58-CONFIRM").kind, "write");
  assert.match(actions.get("CO58-CONFIRM").handler, /pending中既有path\/method\/body/u);
  assert.match(actions.get("CO58-CONFIRM-DIALOG").handler, /不提交POST\/PATCH/u);
});

test("P58 preserves independent plan and adjustment pagination and does not infer retry policy", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.match(actions.get("CO58-PAGE").handler, /不更改调整历史页/u);
  assert.match(actions.get("CO58-ADJ-PAGE").handler, /不更改方案目录page/u);
  assert.match(review.surfaceReview.remaining, /未知POST结果策略/u);
  assert.match(review.compositionGaps.join(" "), /不推定未知POST结果可安全重提/u);
});

test("P58 source review remains distinct from runtime, permissions and production acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实会话\/RBAC/u);
  assert.match(review.surfaceReview.remaining, /MySQL事务审计/u);
});
