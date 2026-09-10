import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import {
  base,
  parentFile,
  childFile,
  dependencies,
  readOrgAuditReviewInputs,
  buildOrgAuditReview,
  validateOrgAuditBindings,
} from "../../scripts/build-ui-phase2-org-audit-review.mjs";

const inputs = readOrgAuditReviewInputs();
const build = () => buildOrgAuditReview(inputs);
const context = {
  candidates: dependencies.flatMap((f) => scanSource(inputs.sources[f], f).candidates),
  sourceHashes: build().sourceHashes,
  contracts: runContractAudit().records,
  packages: inputs.packages,
  files: new Set(["scripts/verify-ui-phase2-org-audit-controls.mjs"]),
};

test("P37 covers23 exact sites in11 route actions and5 exclusions without writes", () => {
  const r = validateActionReview(build(), context);
  assert.equal(r.sourceSites, 23);
  assert.equal(r.semanticGroups, 16);
  assert.equal(r.routeActions, 11);
  assert.equal(r.excludedGroups, 5);
  assert.equal(r.wiringGroups, 0);
  assert.equal(r.writeActions, 0);
  assert.equal(r.unmappedVisualSlots, 66);
  assert.deepEqual(JSON.parse(readFileSync(base + "/action-reviews/P37.json", "utf8")), build());
  const missing = build();
  missing.actions.find((a) => a.actionId === "OG-AUD-FILTER").sourceCandidateIds.pop();
  assert.throws(() => validateActionReview(missing, context), /unmapped candidates/);
  const promoted = build();
  promoted.approval = "approved";
  assert.throws(() => validateActionReview(promoted, context), /cannot grant approval/);
});

test("P37 has8 source fields,6 excluded fields,6 containers and9 explicit variants", () => {
  assert.deepEqual(
    build().inputs["OrganizationAuditPanel.vue"],
    build()
      .surfaceReview.inputs.filter((i) => i.file === childFile)
      .map((i) => i.binding),
  );
  assert.equal(Object.values(build().inputs).flat().length, 14);
  assert.deepEqual(validateReviewSurfaces(build().surfaceReview, inputs), {
    callerFiles: 2,
    localModelBindings: 14,
    callerContainers: 6,
    consumerVariants: 9,
    runtimeAcceptance: "unproven",
  });
  const local = build().surfaceReview.inputs.filter((f) => f.file === childFile);
  assert.equal(local.length, 8);
  assert.ok(local.every((f) => f.fieldEvidence.screenshots.length >= 2));
  const missing = build();
  missing.surfaceReview.containers.pop();
  assert.throws(() => validateReviewSurfaces(missing.surfaceReview, inputs), /container omissions/);
  const omitted = build();
  omitted.surfaceReview.inputs.pop();
  assert.throws(() => validateReviewSurfaces(omitted.surfaceReview, inputs), /input omissions/);
});

test("P37 function props and actual v-else reject changed parent routing", () => {
  assert.equal(build().propBindings[0].directive, "else");
  for (const [from, to] of [
    [':apply-filters="applyAuditFilters"', ':apply-filters="load"'],
    [':load-more="loadMoreAudit"', ':load-more="load"'],
    [
      "loadMoreAudit = () => loadAuditPage(auditFilters.value, true)",
      "loadMoreAudit = () => loadAuditPage(auditFilters.value, false)",
    ],
    [
      "<OrganizationAuditPanel\n        v-else",
      "<OrganizationAuditPanel\n        v-else-if=\"view === 'audit'\"",
    ],
  ]) {
    assert.ok(inputs.sources[parentFile].includes(from), from);
    const changed = {
      ...inputs,
      sources: { ...inputs.sources, [parentFile]: inputs.sources[parentFile].replace(from, to) },
    };
    assert.throws(() => validateOrgAuditBindings(buildOrgAuditReview(changed), changed));
  }
});

test("P37 other-route reason and approvals remain exclusions,not local dialogs", () => {
  const r = build();
  assert.equal(r.actions.find((a) => a.actionId === "EX-REASON").sourceCandidateIds.length, 4);
  assert.equal(r.actions.find((a) => a.actionId === "EX-P34-RETRY").kind, "excluded");
  assert.equal(
    r.surfaceReview.containers.filter((c) => c.tag === "AuditedReasonDialog")[0].variants[0]
      .evidenceScope,
    "route-excluded-reference",
  );
  assert.ok(!r.sharedReasonReview);
  assert.deepEqual(
    r.functionProps.map((f) => f.prop),
    ["applyFilters", "loadMore"],
  );
});

test("P37 all19 variants and210 field/control images bind without proposal promotion", () => {
  assert.deepEqual(validateOrgAuditBindings(build(), inputs), {
    sourceSites: 23,
    semanticGroups: 16,
    routeActions: 11,
    writeKinds: 0,
    functionProps: 2,
    controlVariants: 19,
    localModels: 8,
    containers: 6,
    controlImages: 172,
    fieldImages: 38,
  });
  const r = build();
  assert.equal(r.externalControlBindings.filter((c) => c.proposalOnly).length, 4);
  for (const c of r.externalControlBindings.filter((c) => c.proposalOnly)) {
    assert.equal(c.actionId, null);
    assert.deepEqual(c.sourceCandidateIds, []);
  }
  for (const id of ["copy-request", "copy-trace"])
    assert.deepEqual(r.externalControlBindings.find((c) => c.id === id).proposalStates, [
      "disabled",
    ]);
  const files = [
    ...r.externalControlBindings.flatMap((c) => c.screenshots),
    ...r.externalControlCompositions,
    ...r.externalFieldCompositions,
    ...r.surfaceReview.inputs.flatMap((f) => f.fieldEvidence?.screenshots ?? []),
  ].map((s) => s.file);
  assert.equal(new Set(files).size, 210);
  const changed = build();
  changed.externalControlBindings[0].screenshots[0].sha256 = "0".repeat(64);
  assert.throws(() => validateOrgAuditBindings(changed, inputs), /registry drift/);
});

test("P37 pure-space search and copy boundary remain explicit source distinctions", () => {
  const source = inputs.sources[childFile];
  assert.match(source, /v-if="nextCursor && !loadedQuery"/);
  assert.match(source, /!loadedQuery.trim\(\) && !filters.action.trim\(\)/);
  assert.match(source, /await navigator.clipboard.writeText\(value\);\s+settle\("copied"\)/);
  const r = build();
  assert.match(r.actions.find((a) => a.actionId === "OG-AUD-MORE").condition, /原始loadedQuery/);
  assert.match(
    r.actions.find((a) => a.actionId === "OG-AUD-COPY-REQUEST").condition,
    /源无缺失ID禁用/,
  );
  assert.ok(!Object.keys(r).some((k) => k.startsWith("actualVue")));
});
