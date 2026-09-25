import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP59ActionReview } from "../../scripts/build-ui-phase2-p59-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P59.json`, "utf8"));
const file = "apps/web/src/components/SecurityOperationsCenter.vue";
const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const sources = { [file]: source };
const sourceHashes = { [file]: createHash("sha256").update(source).digest("hex") };
const candidates = scanSource(source, file).candidates;
const contracts = runContractAudit().records;
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((ref) => ref.file)),
);
const context = { candidates, sourceHashes, contracts, packages: new Map(), files };

test("P59 maps all current security-operations source candidates exactly once", () => {
  assert.deepEqual(review, buildP59ActionReview());
  assert.equal(candidates.length, 29);
  assert.equal(validateActionReview(review, context).sourceSites, 29);
  assert.equal(review.route, "/platform-admin/security");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P59 keeps the investigation read-only and preserves separate view and token pagination", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("SO59-LOAD").kind, "read");
  assert.match(actions.get("SO59-LOAD").handler, /不执行安全处置写操作/u);
  assert.equal(actions.get("SO59-TOKEN-PAGE").kind, "read");
  assert.match(actions.get("SO59-TOKEN-PAGE").handler, /不与凭证主列表page合并/u);
  assert.equal(actions.get("SO59-MANAGE").kind, "navigation");
  assert.match(actions.get("SO59-MANAGE").remaining, /不授予platform:operate/u);
  assert.match(review.surfaceReview.remaining, /security_operations_views/u);
});

test("P59 treats security details as disclosure, not management or secret access", () => {
  const tech = review.actions.find((action) => action.actionId === "SO59-TECH");
  assert.equal(tech.kind, "local");
  assert.equal(tech.sourceCandidateIds.length, 11);
  assert.match(tech.handler, /不新增读取或安全处置/u);
  assert.match(tech.remaining, /不证明敏感字段服务端脱敏/u);
  assert.match(review.dialogs.remaining, /5个ResponsiveDataView消费者/u);
});

test("P59 source review remains distinct from runtime, least-privilege and production acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实platform:secure最小角色/u);
  assert.match(review.surfaceReview.remaining, /M06-04生产验收/u);
});
