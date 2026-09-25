import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { buildP51ActionReview } from "../../scripts/build-ui-phase2-p51-action-review.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const sourceFiles = [
  "apps/web/src/components/CollectionRuntimeSurface.vue",
  "apps/web/src/components/CollectionTaskCenter.vue",
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
const review = buildP51ActionReview();
const files = new Set([
  ...contracts.map((record) => record.document),
  "tests/unit/ui-phase2-p51-action-map.test.mjs",
]);
const context = { candidates, sourceHashes, contracts, packages: new Map(), files };

test("P51 maps each current task page and route-surface source candidate once", () => {
  assert.deepEqual(review, buildP51ActionReview());
  assert.equal(candidates.length, 26);
  assert.equal(validateActionReview(review, context).sourceSites, 26);
  assert.equal(review.route, "/platform-admin/collection");
  assert.equal(review.visualApproval, "user-approved-remaining-pages-auto");
  assert.equal(review.actionApproval, "pending-user-review");
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
});

test("P51 retains list/detail reads and manual replay as separate existing API effects", () => {
  const byId = new Map(review.actions.map((action) => [action.actionId, action]));
  assert.equal(byId.get("CL51-LOAD").kind, "read");
  assert.equal(byId.get("CL51-DETAIL-READ").kind, "read");
  assert.equal(byId.get("CL51-REPLAY-WRITE").kind, "write");
  assert.match(
    byId.get("CL51-REPLAY-WRITE").handler,
    /POST \/platform\/collection\/tasks\/\{id\}\/replay/u,
  );
  assert.match(byId.get("CL51-REPLAY-WRITE").handler, /body 只含 reason/u);
  assert.match(byId.get("CL51-REPLAY-WRITE").handler, /不自动重复 POST/u);
  assert.match(byId.get("CL51-EMPTY-RECOVERY").handler, /不会补造普通采集任务创建入口/u);
});

test("P51 event wiring and surface evidence do not imply real RBAC or collection acceptance", () => {
  const statePrimary = review.actions.find((action) => action.actionId === "CL51-STATE-PRIMARY");
  assert.deepEqual(statePrimary.forwardsTo, ["CL51-LOAD"]);
  assert.equal(statePrimary.forwardBindings[0].handler, "() => load()");
  const result = validateReviewSurfaces(review.surfaceReview, {
    sources,
    sourceHashes,
    packages: context.packages,
  });
  assert.equal(result.runtimeAcceptance, "unproven");
  assert.match(
    review.actions.find((action) => action.actionId === "CL51-REPLAY-WRITE").remaining,
    /collection:replay/u,
  );
  assert.match(review.surfaceReview.remaining, /M07-03/u);
});
