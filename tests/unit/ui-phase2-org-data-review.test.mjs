import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import {
  base,
  parentFile,
  childFile,
  dependencies,
  readOrgDataReviewInputs,
  buildOrgDataReview,
  validateOrgDataBindings,
} from "../../scripts/build-ui-phase2-org-data-review.mjs";

const inputs = readOrgDataReviewInputs();
const build = () => buildOrgDataReview(inputs);
const context = {
  candidates: dependencies.flatMap((f) => scanSource(inputs.sources[f], f).candidates),
  sourceHashes: build().sourceHashes,
  contracts: runContractAudit().records,
  packages: inputs.packages,
  files: new Set(["scripts/verify-ui-phase2-org-data-controls.mjs"]),
};

test("P35 all23 current source sites are nine read-only route actions and five exclusions", () => {
  const r = validateActionReview(build(), context);
  assert.equal(r.sourceSites, 23);
  assert.equal(r.semanticGroups, 14);
  assert.equal(r.routeActions, 9);
  assert.equal(r.excludedGroups, 5);
  assert.equal(r.wiringGroups, 0);
  assert.equal(r.writeActions, 0);
  assert.deepEqual(JSON.parse(readFileSync(`${base}/action-reviews/P35.json`, "utf8")), build());
  const missing = build();
  missing.actions.find((a) => a.actionId === "OG-D-VIEW").sourceCandidateIds.pop();
  assert.throws(() => validateActionReview(missing, context), /unmapped candidates/);
  const promoted = build();
  promoted.approval = "approved";
  assert.throws(() => validateActionReview(promoted, context), /cannot grant approval/);
});

test("P35 actual props and two P34-only failure forwards remain route-separated", () => {
  const root = baseParse(parse(inputs.sources[parentFile]).descriptor.template.content),
    nodes = [];
  function visit(n) {
    if (n.type === 1 && n.tag === "OrganizationDataPanel") nodes.push(n);
    for (const c of n.children ?? []) visit(c);
  }
  visit(root);
  assert.equal(nodes.length, 1);
  const node = nodes[0],
    binding = build().propBindings[0];
  assert.deepEqual(
    Object.fromEntries(
      node.props
        .filter((p) => p.type === 7 && p.name === "bind")
        .map((p) => [p.arg.content, p.exp.content]),
    ),
    binding.props,
  );
  assert.equal(
    node.props.find((p) => p.type === 7 && p.name === "else-if").exp.content,
    binding.condition,
  );
  assert.deepEqual(
    node.props.filter((p) => p.type === 7 && p.name === "on"),
    [],
  );
  assert.doesNotMatch(inputs.sources[childFile], /defineEmits|\bfetch\(/);
  const excluded = build().actions.find((a) => a.actionId === "EX-P34-RETRY");
  assert.equal(excluded.kind, "excluded");
  for (const id of excluded.sourceCandidateIds) {
    const c = context.candidates.find((c) => c.candidateId === id);
    assert.ok(c.conditions.some((c) => c.expression.includes("view === 'approvals'")));
    assert.deepEqual(c.events, { "@reload": "load()" });
  }
});

test("P35 eight local fields and six excluded parent fields, no local business dialog", () => {
  const r = build();
  assert.deepEqual(validateReviewSurfaces(r.surfaceReview, inputs), {
    callerFiles: 2,
    localModelBindings: 14,
    callerContainers: 4,
    consumerVariants: 4,
    runtimeAcceptance: "unproven",
  });
  assert.equal(r.surfaceReview.inputs.filter((f) => f.file === childFile).length, 8);
  assert.ok(
    r.surfaceReview.inputs
      .filter((f) => f.file === parentFile)
      .every((f) => f.meaning.includes("排除")),
  );
  assert.ok(
    r.surfaceReview.containers
      .filter((c) => c.file === parentFile)
      .every((c) => c.variants[0].evidenceScope === "route-excluded-reference"),
  );
  assert.match(r.dialogs.remaining, /无本地业务弹窗/);
  const missing = build();
  missing.surfaceReview.inputs.pop();
  assert.throws(() => validateReviewSurfaces(missing.surfaceReview, inputs), /input omissions/);
});

test("P35 all independent control, field and real Vue images are pinned without promoting global slots", () => {
  assert.deepEqual(validateOrgDataBindings(build(), inputs), {
    sourceSites: 23,
    existingControlVariants: 19,
    proposedControlVariants: 6,
    localFields: 8,
    fieldImages: 140,
    fieldCompositions: 16,
    implementationImages: 24,
  });
  for (const mutate of [
    (r) => r.externalControlBindings.pop(),
    (r) =>
      r.externalControlBindings
        .find((c) => c.id === "workspace-next")
        .sourceCandidateIds.splice(0, 1),
    (r) =>
      r.externalControlBindings.find((c) => c.id === "workspace-filters-open").widths.push(1440),
    (r) => {
      r.externalControlBindings.find((c) => c.id === "export-clear-empty").proposalOnly = false;
    },
    (r) => {
      r.surfaceReview.inputs.find((f) => f.file === childFile).fieldEvidence.selector = "#wrong";
    },
    (r) => r.externalFieldCompositions.pop(),
    (r) => r.externalImplementationImages.pop(),
    (r) => {
      r.parentDesignEvidence.screenshots = 0;
    },
  ]) {
    const r = build();
    mutate(r);
    assert.throws(() => validateOrgDataBindings(r, inputs));
    assert.doesNotThrow(
      () => validateOrgDataBindings(build(), inputs),
      "negative mutation cannot poison source evidence or subsequent builds",
    );
  }
  assert.ok(
    build()
      .actions.filter((a) => a.kind !== "excluded")
      .every((a) => Object.values(a.visualStates).every((v) => v === "not-mapped")),
  );
  assert.deepEqual(build().approvalRecords, ["P35-MOBILE-EXPORT-DETAIL-APPROVAL.md"]);
  assert.equal(build().parentReadEvidence.scenarios, 112);
  assert.equal(build().parentReadEvidence.checks, 1624);
  assert.equal(build().parentReadEvidence.screenshots, 128);
  assert.match(build().parentReadEvidence.scope, /不是C批准/);
  assert.equal(build().parentDesignEvidence.scenes, 17);
  assert.equal(build().parentDesignEvidence.screenshots, 276);
  assert.match(build().parentDesignEvidence.scope, /全部新区域待审/);
});
