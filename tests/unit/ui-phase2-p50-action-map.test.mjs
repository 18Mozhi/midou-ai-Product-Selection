import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildP50ActionReview } from "../../scripts/build-ui-phase2-p50-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P50.json`, "utf8"));
const file = "apps/web/src/components/CredentialAssetCenter.vue";
const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const sourceHash = createHash("sha256").update(source).digest("hex");
const sources = { [file]: source };
const sourceHashes = { [file]: sourceHash };
const candidates = scanSource(source, file).candidates;
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((reference) => reference.file)),
);
const context = {
  candidates,
  sourceHashes,
  contracts: runContractAudit().records,
  packages: new Map(),
  files,
};

test("P50 maps all 39 current credential-center candidates to SC50 contracts", () => {
  assert.deepEqual(review, buildP50ActionReview());
  assert.equal(candidates.length, 39);
  assert.equal(validateActionReview(review, context).sourceSites, 39);
  assert.equal(review.route, "/platform-admin/credentials");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P50 keeps distinct asset/profile/login/revoke and browser-helper effects", () => {
  for (const actionId of [
    "SC50-ASSET-SAVE",
    "SC50-PROFILE-SAVE",
    "SC50-LOGIN-SAVE",
    "SC50-REVOKE",
    "SC50-HELPER-COOKIE",
  ])
    assert.equal(review.actions.find((action) => action.actionId === actionId)?.kind, "write");
  assert.equal(
    review.actions.find((action) => action.actionId === "SC50-EXTERNAL")?.kind,
    "navigation",
  );
  assert.equal(
    review.actions.find((action) => action.actionId === "SC50-HELPER-DOWNLOAD")?.kind,
    "local",
  );
  assert.match(
    review.actions.find((action) => action.actionId === "SC50-LOGIN-SAVE").handler,
    /资产POST后再运行档案POST/u,
  );
  assert.match(
    review.actions.find((action) => action.actionId === "SC50-REVOKE").handler,
    /expected_version/u,
  );
  assert.match(review.compositionGaps.join(" "), /不自动启用|不同动作审阅/u);
});

test("P50 surface evidence does not grant secret, RBAC or runtime acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: context.packages,
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.dialogs.remaining, /共享ConfirmDialog/u);
  assert.match(review.surfaceReview.remaining, /Cookie/u);
  assert.match(review.surfaceReview.remaining, /生产环境验收通过/u);
});
