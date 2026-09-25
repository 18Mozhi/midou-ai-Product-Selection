import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP60ActionReview } from "../../scripts/build-ui-phase2-p60-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P60.json`, "utf8"));
const file = "apps/web/src/components/OpenPlatformCenter.vue";
const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const sources = { [file]: source };
const sourceHashes = { [file]: createHash("sha256").update(source).digest("hex") };
const candidates = scanSource(source, file).candidates;
const contracts = runContractAudit().records;
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((ref) => ref.file)),
);
const context = { candidates, sourceHashes, contracts, packages: new Map(), files };

test("P60 maps all current open-platform source candidates exactly once", () => {
  assert.deepEqual(review, buildP60ActionReview());
  assert.equal(candidates.length, 44);
  assert.equal(validateActionReview(review, context).sourceSites, 44);
  assert.equal(review.route, "/platform-admin/open-platform");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P60 separates operation preparation, explicit confirmation and queued outcomes", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  for (const id of [
    "OP60-CREATE-PREPARE",
    "OP60-CLIENT-ROTATE",
    "OP60-CLIENT-REVOKE",
    "OP60-HOOK-STATUS",
    "OP60-HOOK-TEST",
    "OP60-HOOK-ROTATE",
    "OP60-REPLAY",
  ])
    assert.equal(actions.get(id).kind, "local");
  assert.equal(actions.get("OP60-CONFIRM").kind, "write");
  assert.match(actions.get("OP60-CONFIRM").handler, /cancel只清空pending/u);
  assert.match(actions.get("OP60-CONFIRM").handler, /202代表queued/u);
  assert.match(actions.get("OP60-REPLAY").remaining, /不代表Worker发送/u);
});

test("P60 keeps one-time secret handling local and scoped to the current surface", () => {
  const secret = actionsById("OP60-SECRET");
  assert.equal(secret.kind, "local");
  assert.match(secret.handler, /复制只调用浏览器剪贴板/u);
  assert.match(secret.remaining, /不证明外部凭证系统已保存/u);
  assert.match(review.surfaceReview.remaining, /签名\/密钥安全/u);
});

test("P60 action map remains distinct from real token permission and external delivery acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实platform_token:manage/u);
  assert.match(review.surfaceReview.remaining, /Worker外部投递/u);
  assert.match(review.dialogs.remaining, /共享OpenCreateDialog/u);
});

function actionsById(id) {
  return review.actions.find((action) => action.actionId === id);
}
