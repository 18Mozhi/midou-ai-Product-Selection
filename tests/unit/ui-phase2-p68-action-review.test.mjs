import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP68ActionReview } from "../../scripts/build-ui-phase2-p68-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P68.json`, "utf8"));
const sourceFiles = ["apps/web/src/components/MySqlResilienceCenter.vue"];
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

test("P68 maps all four current MySQL page controls exactly once", () => {
  assert.deepEqual(review, buildP68ActionReview());
  assert.equal(candidates.length, 4);
  assert.equal(validateActionReview(review, context).sourceSites, 4);
  assert.equal(review.route, "/platform-admin/mysql");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P68 preserves the existing GET, retry and expired-login separation", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("MY68-LOAD").kind, "read");
  assert.equal(actions.get("MY68-RETRY").sourceCandidateIds.length, 2);
  assert.equal(actions.get("MY68-LOGIN").kind, "navigation");
  assert.match(actions.get("MY68-LOAD").handler, /不执行SQL写入、迁移/u);
});

test("P68 uses shared request details without inventing SQL or recovery dialogs", () => {
  assert.ok(
    review.pageScopeExclusions.sharedFiles.some((item) =>
      item.file.endsWith("/TechnicalDetails.vue"),
    ),
  );
  assert.equal(review.dialogs.kind, "none-in-current-source");
  assert.match(review.compositionGaps.join(" "), /无筛选、分页、排序或业务表单/u);
  assert.match(review.compositionGaps.join(" "), /SQL执行、迁移/u);
});

test("P68 does not promote MySQL, recovery, audit or formal M07-03 acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /MySQL 5.7真实配置/u);
  assert.match(review.compositionGaps.join(" "), /不因视觉状态推断/u);
});
