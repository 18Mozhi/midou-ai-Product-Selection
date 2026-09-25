import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP62ActionReview } from "../../scripts/build-ui-phase2-p62-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P62.json`, "utf8"));
const sourceFiles = [
  "apps/web/src/components/PlatformLogCenter.vue",
  "apps/web/src/components/ResponsiveFilterDrawer.vue",
  "apps/web/src/components/AuditedReasonDialog.vue",
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

test("P62 maps every current local log/filter/reason-dialog candidate exactly once", () => {
  assert.deepEqual(review, buildP62ActionReview());
  assert.equal(candidates.length, 32);
  assert.equal(validateActionReview(review, context).sourceSites, 32);
  assert.equal(review.route, "/platform-admin/logs");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P62 distinguishes export entry, audited submit, cancel and snapshot semantics", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("LG62-EXPORT-OPEN").kind, "local");
  assert.match(actions.get("LG62-EXPORT-OPEN").handler, /不因打开而创建文件或提交导出请求/u);
  assert.equal(actions.get("LG62-EXPORT").kind, "write");
  assert.match(actions.get("LG62-EXPORT").handler, /重新查询最新200条生成CSV，不是DOM快照/u);
  assert.match(actions.get("LG62-EXPORT-DIALOG").handler, /取消只关闭当前原因流程，不发导出POST/u);
});

test("P62 keeps read/write tracing and exception navigation tied to existing records", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("LG62-TASK").kind, "navigation");
  assert.equal(actions.get("LG62-PROVIDER").kind, "navigation");
  assert.match(actions.get("LG62-TRACE").handler, /不混用读\/写requestId/u);
  assert.match(review.compositionGaps.join(" "), /不推定离页会取消已提交服务器导出/u);
});

test("P62 source review remains distinct from real CSV, permissions and production acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实platform:operate\/RBAC/u);
  assert.match(review.dialogs.remaining, /迟到下载生命周期验收/u);
});
