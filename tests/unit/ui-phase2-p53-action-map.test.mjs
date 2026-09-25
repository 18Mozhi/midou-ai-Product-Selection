import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildP53ActionReview } from "../../scripts/build-ui-phase2-p53-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P53.json`, "utf8"));
const file = "apps/web/src/components/CollectionRuntimeCenter.vue";
const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const sources = { [file]: source };
const sourceHash = createHash("sha256").update(source).digest("hex");
const sourceHashes = { [file]: sourceHash };
const candidates = scanSource(source, file).candidates;
const contracts = runContractAudit().records;
const files = new Set(
  review.actions.flatMap((action) => action.testReferences.map((reference) => reference.file)),
);
const context = { candidates, sourceHashes, contracts, packages: new Map(), files };

test("P53 maps every current browser-runtime source candidate exactly once", () => {
  assert.deepEqual(review, buildP53ActionReview());
  assert.equal(candidates.length, 12);
  assert.equal(validateActionReview(review, context).sourceSites, 12);
  assert.equal(review.route, "/platform-admin/collection/browser-runtime");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P53 keeps the recovery prompt separate from the global write", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("CL53-RECOVERY-OPEN").kind, "local");
  assert.match(actions.get("CL53-RECOVERY-OPEN").handler, /不发送POST/u);
  assert.equal(actions.get("CL53-RECOVER-WRITE").kind, "write");
  assert.match(
    actions.get("CL53-RECOVER-WRITE").handler,
    /POST \/platform\/crawler-runtime\/recover-expired，body为空对象/u,
  );
  assert.match(actions.get("CL53-RECOVER-WRITE").handler, /结果未知时锁定再次提交/u);
  assert.match(actions.get("CL53-RECOVER-WRITE").handler, /不宣称OS浏览器进程已停止/u);
  assert.match(actions.get("CL53-RECOVER-DIALOG").handler, /不提交POST/u);
});

test("P53 renewal navigation does not invent credential or task writes", () => {
  const renewal = review.actions.find((action) => action.actionId === "CL53-RENEW-NAV");
  assert.equal(renewal.kind, "navigation");
  assert.match(renewal.handler, /status=blocked_login/u);
  assert.match(renewal.handler, /不续期凭证/u);
  const filter = review.actions.find((action) => action.actionId === "CL53-FILTER-FORM");
  assert.deepEqual(filter.forwardsTo, ["CL53-FILTER-APPLY"]);
  assert.equal(filter.forwardBindings[0].handler, "applyFilters");
});

test("P53 source evidence stays separate from production and permission acceptance", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /collection:replay/u);
  assert.match(review.surfaceReview.remaining, /M07-03/u);
});
