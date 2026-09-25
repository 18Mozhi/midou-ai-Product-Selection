import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP65ActionReview } from "../../scripts/build-ui-phase2-p65-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P65.json`, "utf8"));
const sourceFiles = ["apps/web/src/components/ReleaseRolloutCenter.vue"];
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

test("P65 maps all twelve current release-center candidates exactly once", () => {
  assert.deepEqual(review, buildP65ActionReview());
  assert.equal(candidates.length, 12);
  assert.equal(validateActionReview(review, context).sourceSites, 12);
  assert.equal(review.route, "/platform-admin/releases");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P65 keeps read, retry, login, navigation and evidence disclosures distinct", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("RL65-LOAD").kind, "read");
  assert.equal(actions.get("RL65-RETRY").sourceCandidateIds.length, 2);
  assert.equal(actions.get("RL65-LOGIN").kind, "navigation");
  assert.equal(actions.get("RL65-COVERAGE").kind, "navigation");
  assert.equal(actions.get("RL65-GATE-DETAIL").sourceCandidateIds.length, 3);
});

test("P65 excludes deploy and signed write-probe execution from the page action map", () => {
  assert.equal(review.dialogs.kind, "local-callers-and-listed-shared-only");
  assert.match(review.dialogs.remaining, /不含发布、回滚、迁移/u);
  assert.match(review.compositionGaps.join(" "), /write-probe为独立签名API/u);
  assert.match(review.compositionGaps.join(" "), /不生成签名/u);
});

test("P65 source mapping does not claim BaoTa, rollback, SQL or formal M07-05 acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /宝塔发布对象/u);
  assert.match(review.pageScopeExclusions.remaining, /没有部署执行/u);
});
