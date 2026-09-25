import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildP66ActionReview } from "../../scripts/build-ui-phase2-p66-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P66.json`, "utf8"));
const sourceFiles = ["apps/web/src/components/RuntimeTopologyCenter.vue"];
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

test("P66 maps all sixteen current runtime topology controls exactly once", () => {
  assert.deepEqual(review, buildP66ActionReview());
  assert.equal(candidates.length, 16);
  assert.equal(validateActionReview(review, context).sourceSites, 16);
  assert.equal(review.route, "/platform-admin/topology");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
});

test("P66 separates navigation, local queue filtering, disclosures and read retries", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("RT66-NAV").sourceCandidateIds.length, 4);
  assert.equal(actions.get("RT66-RETRY").sourceCandidateIds.length, 2);
  assert.equal(actions.get("RT66-QUEUES").kind, "local");
  assert.match(actions.get("RT66-QUEUES").handler, /不发请求、不改变队列调度/u);
  assert.equal(review.dialogs.kind, "none-in-current-source");
});

test("P66 does not turn restart observations, alerts or blockers into execution controls", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("RT66-RESTART").kind, "local");
  assert.match(actions.get("RT66-RESTART").handler, /不向进程发送重启命令/u);
  assert.match(review.compositionGaps.join(" "), /不是执行按钮/u);
  assert.match(review.compositionGaps.join(" "), /不改变Worker调度/u);
});

test("P66 source review remains separate from runtime health, audit and formal M08-01", () => {
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /真实节点健康/u);
  assert.match(review.compositionGaps.join(" "), /独立脱敏入口/u);
});
