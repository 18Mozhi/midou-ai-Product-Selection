import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildP52ActionReview } from "../../scripts/build-ui-phase2-p52-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const review = JSON.parse(readFileSync(`${base}/action-reviews/P52.json`, "utf8"));
const sourceFiles = [
  "apps/web/src/components/CollectionRuntimeSurface.vue",
  "apps/web/src/components/CollectionOperationsConsole.vue",
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
  review.actions.flatMap((action) => action.testReferences.map((reference) => reference.file)),
);
const context = { candidates, sourceHashes, contracts, packages: new Map(), files };

test("P52 maps all 32 current overview/surface source candidates once", () => {
  assert.deepEqual(review, buildP52ActionReview());
  assert.equal(candidates.length, 32);
  assert.equal(validateActionReview(review, context).sourceSites, 32);
  assert.equal(review.route, "/platform-admin/collection/overview");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P52 preserves server-scope reads and keeps the two independent page cursors", () => {
  const actions = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(actions.get("CL52-LOAD").kind, "read");
  assert.equal(actions.get("CL52-SCOPE-APPLY").kind, "read");
  assert.equal(actions.get("CL52-ROOT-DRILL").kind, "read");
  assert.notDeepEqual(
    actions.get("CL52-ATTEMPT-PAGE").sourceCandidateIds,
    actions.get("CL52-DEAD-PAGE").sourceCandidateIds,
  );
  assert.match(
    actions.get("CL52-SCOPE-APPLY").handler,
    /来源健康、根因、质量、尝试及死信各自服务端口径/u,
  );
  assert.match(actions.get("CL52-ROOT-DRILL").handler, /真实 error_code/u);
});

test("P52 batch replay is frozen, sequential, and never auto-retries unknown writes", () => {
  const replay = review.actions.find((action) => action.actionId === "CL52-BATCH-WRITE");
  const preview = review.actions.find((action) => action.actionId === "CL52-BATCH-PREVIEW");
  assert.equal(replay.kind, "write");
  assert.match(preview.condition, /选中1–20条开放死信/u);
  assert.match(replay.handler, /body只含reason/u);
  assert.match(replay.handler, /dead-batch:\{batchId\}:\{task_id\}/u);
  assert.match(replay.handler, /未知时不自动重发/u);
  assert.match(replay.handler, /不代表采集执行成功/u);
  assert.match(review.compositionGaps.join(" "), /不执行|冻结快照/u);
});

test("P52 input event wiring and approval state do not imply runtime acceptance", () => {
  const form = review.actions.find((action) => action.actionId === "CL52-SCOPE-FORM");
  assert.deepEqual(form.forwardsTo, ["CL52-SCOPE-APPLY"]);
  assert.equal(form.forwardBindings[0].handler, "applyScope");
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: new Map(),
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(review.surfaceReview.remaining, /collection:replay/u);
  assert.match(review.surfaceReview.remaining, /M07-03/u);
});
