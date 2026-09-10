import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildOrgTokenDesignData } from "../../scripts/lib/ui-phase2-org-token-design-data.mjs";
import {
  base,
  parentFile,
  childFile,
  reasonFile,
  dependencies,
  readOrgTokenReviewInputs,
  buildOrgTokenReview,
  validateOrgTokenBindings,
} from "../../scripts/build-ui-phase2-org-token-review.mjs";

const inputs = readOrgTokenReviewInputs(),
  build = () => buildOrgTokenReview(inputs);
const context = {
  candidates: dependencies.flatMap((f) => scanSource(inputs.sources[f], f).candidates),
  sourceHashes: build().sourceHashes,
  contracts: runContractAudit().records,
  packages: inputs.packages,
  files: new Set(["scripts/verify-ui-phase2-org-token-controls.mjs"]),
};

test("P36 exact25 current sites become12 route actions,2 wirings and5 exclusions", () => {
  const r = validateActionReview(build(), context);
  assert.equal(r.sourceSites, 25);
  assert.equal(r.semanticGroups, 19);
  assert.equal(r.routeActions, 12);
  assert.equal(r.wiringGroups, 2);
  assert.equal(r.excludedGroups, 5);
  assert.equal(r.writeActions, 3);
  assert.equal(r.unmappedVisualSlots, 72);
  assert.deepEqual(JSON.parse(readFileSync(`${base}/action-reviews/P36.json`, "utf8")), build());
  const missing = build();
  missing.actions.find((a) => a.actionId === "OG-K-CREATE").sourceCandidateIds.pop();
  assert.throws(() => validateActionReview(missing, context), /unmapped candidates/);
  const promoted = build();
  promoted.approval = "approved";
  assert.throws(() => validateActionReview(promoted, context), /cannot grant approval/);
});
test("P36 reason forwards target only rotate/revoke and other-page origins remain excluded", () => {
  const review = build(),
    w = review.actions.find((a) => a.actionId === "W-K-REASON");
  assert.deepEqual(w.forwardsTo, ["OG-K-ROTATE", "OG-K-REVOKE"]);
  assert.equal(w.forwardBindings.length, 4);
  assert.ok(w.forwardBindings.every((e) => ["@submit", "@cancel"].includes(e.event)));
  assert.equal(review.actions.find((a) => a.actionId === "W-K-ASK").forwardBindings.length, 0);
  for (const id of review.actions.find((a) => a.actionId === "EX-P34-RETRY").sourceCandidateIds)
    assert.ok(
      context.candidates
        .find((c) => c.candidateId === id)
        .conditions.some((c) => c.expression.includes("view === 'approvals'")),
    );
  const changed = build();
  changed.actions.find((a) => a.actionId === "W-K-REASON").forwardBindings[0].handler = "load()";
  assert.throws(() => validateActionReview(changed, context), /forward event omitted or changed/);
});
test("P36 all seven child models,six excluded models,six structures and nine contexts are registered", () => {
  assert.deepEqual(validateReviewSurfaces(build().surfaceReview, inputs), {
    callerFiles: 2,
    localModelBindings: 13,
    callerContainers: 6,
    consumerVariants: 9,
    runtimeAcceptance: "unproven",
  });
  assert.equal(build().surfaceReview.inputs.filter((f) => f.file === childFile).length, 7);
  assert.deepEqual(
    build().nonModelFields.map((f) => f.binding),
    ["createForm.scopes"],
  );
  assert.equal(build().sharedReasonReview.input.file, reasonFile);
  assert.equal(build().sharedReasonReview.input.maxlength, null);
  assert.deepEqual(
    build().sharedReasonReview.contexts.map((c) => c.action),
    ["rotate", "revoke"],
  );
  const missing = build();
  missing.surfaceReview.containers.pop();
  assert.throws(() => validateReviewSurfaces(missing.surfaceReview, inputs), /container omissions/);
});
test("P36 explicit parent props reject altered source routing and POST contract", () => {
  assert.equal(build().functionProps.length, 3);
  for (const [from, to] of [
    [
      ':busy="busy || refreshing"\n        :format-time="fmt"\n        :create-token="createOrganizationToken"',
      ':busy="busy"\n        :format-time="fmt"\n        :create-token="createOrganizationToken"',
    ],
    [':perform-token-action="tokenAction"', ':perform-token-action="memberAction"'],
    ['submit("/org/admin/tokens", value, "POST"', 'submit("/org/admin/tokens", value, "PATCH"'],
    [
      'expected_version: item.version,\n        reason,\n      },\n      "POST",',
      'expected_version: 0,\n        reason,\n      },\n      "POST",',
    ],
  ]) {
    assert.ok(inputs.sources[parentFile].includes(from));
    const changed = {
      ...inputs,
      sources: { ...inputs.sources, [parentFile]: inputs.sources[parentFile].replace(from, to) },
    };
    assert.throws(() => validateOrgTokenBindings(buildOrgTokenReview(changed), changed));
  }
});
test("P36 every control/field/composition/implementation image is bound without promotion", () => {
  assert.deepEqual(validateOrgTokenBindings(build(), inputs), {
    sourceSites: 25,
    semanticGroups: 19,
    routeActions: 12,
    writeKinds: 3,
    functionProps: 3,
    childControlVariants: 30,
    parentControlVariants: 2,
    sharedReasonControlVariants: 6,
    proposals: 6,
    localFields: 7,
    nonModelGroups: 1,
    sharedReasonContexts: 2,
    callerContainers: 6,
    controlImages: 354,
    fieldImages: 196,
    implementationImages: 10,
  });
  assert.equal(build().externalControlCompositions.length, 10);
  assert.equal(build().externalFieldCompositions.length, 40);
  assert.equal(build().sharedReasonReview.sourceSites.length, 6);
  for (const mutate of [
    (r) => r.externalControlBindings.pop(),
    (r) => r.externalControlBindings.find((c) => c.id === "filters-open").widths.push(1440),
    (r) => r.externalControlBindings.find((c) => c.id === "rotate-submit").sharedSourceIds.pop(),
    (r) =>
      (r.surfaceReview.inputs.find((f) => f.file === childFile).fieldEvidence.selector = "#wrong"),
    (r) => r.nonModelFields[0].fieldEvidence.screenshots.pop(),
    (r) => r.sharedReasonReview.contexts[0].screenshots.pop(),
    (r) => r.externalFieldCompositions.pop(),
    (r) => r.externalImplementationImages.pop(),
  ]) {
    const review = build();
    mutate(review);
    assert.throws(() => validateOrgTokenBindings(review, inputs));
  }
  assert.doesNotThrow(() => validateOrgTokenBindings(build(), inputs));
  assert.deepEqual(build().approvalRecords, ["P36-MOBILE-FILTER-COMPOSITION-APPROVAL.md"]);
});
test("P36 current inert source handler checks still match existing bodies and known limitations", async () => {
  const data = await buildOrgTokenDesignData(process.cwd());
  assert.deepEqual(Object.keys(data.createBody).sort(), ["name", "reason", "scopes", "ttl_days"]);
  assert.equal(data.actionBodies.length, 2);
  assert.ok(data.sourceChecks.some((v) => v.includes("OG-G05 reproduced")));
  assert.ok(data.sourceChecks.some((v) => v.includes("not mounted Vue or API proof")));
});
