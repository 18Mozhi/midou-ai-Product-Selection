import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { buildTeamsDesignData } from "../../scripts/lib/ui-phase2-teams-design-data.mjs";
import {
  base,
  parentFile,
  childFile,
  dependencies,
  packageNames,
  buildTeamsReview,
  validateTeamsEvidenceBindings,
} from "../../scripts/build-ui-phase2-teams-review.mjs";

const sources = Object.fromEntries(dependencies.map((f) => [f, readFileSync(f, "utf8")]));
const packages = new Map(
  packageNames.map((p) => [
    p,
    JSON.parse(readFileSync(`${base}/design/${p}/evidence.json`, "utf8")),
  ]),
);
const build = () => buildTeamsReview(sources, packages);
const copy = (v) => JSON.parse(JSON.stringify(v));
const context = {
  candidates: [parentFile, childFile].flatMap((f) => scanSource(sources[f], f).candidates),
  sourceHashes: build().surfaceReview.dependencyHashes,
  contracts: runContractAudit().records,
  packages,
  files: new Set(build().actions.flatMap((a) => a.testReferences.map((r) => r.file))),
};
test("P33 registers all 29 parent and child sites without counting function props as events", () => {
  const r = build(),
    result = validateActionReview(r, context);
  assert.deepEqual(result, {
    pageId: "P33",
    sourceSites: 29,
    semanticGroups: 16,
    routeActions: 12,
    wiringGroups: 0,
    excludedGroups: 4,
    writeActions: 2,
    sourceInapplicableVisualSlots: 0,
    unmappedVisualSlots: 17,
  });
  assert.deepEqual(JSON.parse(readFileSync(`${base}/action-reviews/P33.json`, "utf8")), r);
  assert.equal(r.approval, "pending-user-review");
  const omitted = build();
  omitted.actions.pop();
  assert.throws(() => validateActionReview(omitted, context), /unmapped candidates/);
  const approved = build();
  approved.approval = "approved";
  assert.throws(() => validateActionReview(approved, context), /cannot grant approval/);
});
test("P33 41 business control variants and seven fields bind all catalog states and both viewports", () => {
  assert.deepEqual(validateTeamsEvidenceBindings(build(), packages), {
    controls: 41,
    sourceSignatures: 18,
    fields: 7,
    fieldStates: 49,
  });
  assert.deepEqual(
    build().proposalOnlyControls.map((c) => c.id),
    ["filters-closed", "filters-open"],
  );
  for (const type of ["control", "field", "signature", "package"]) {
    const r = build();
    if (type === "control")
      r.actions.find((a) => a.actionId === "OG-T-MEMBER").controlCatalogBindings.pop();
    if (type === "field") r.surfaceReview.inputs.at(-1).fieldEvidence.selector = "#wrong-member";
    if (type === "signature")
      r.actions.find(
        (a) => a.actionId === "OG-T-CREATE",
      ).controlCatalogBindings[0].sourceCandidateIds = [];
    if (type === "package") r.surfaceReview.inputs.at(-1).fieldEvidence.package = packageNames[0];
    assert.throws(() => validateTeamsEvidenceBindings(r, packages));
  }
});
test("P33 generic representative validation rejects catalog cross-action, selector, page, state and viewport forgery", () => {
  for (const type of ["action", "selector", "page", "state", "viewport", "proposal", "mixed"]) {
    const r = build(),
      e = copy(packages.get(packageNames[1]));
    const ref = r.actions.find((a) => a.actionId === "OG-T-CREATE").visualStateReferences.focus;
    if (type === "action") ref.catalogControlId = "assign";
    if (type === "selector") ref.selector = "#wrong";
    if (type === "page") r.pageId = "P32";
    if (type === "state") ref.scene = "create-hover";
    if (type === "viewport")
      e.screenshots = e.screenshots.filter((s) => !(s.scene === "create-focus" && s.width === 390));
    if (type === "proposal") ref.catalogControlId = "filters-open";
    if (type === "mixed") ref.pageId = "P33";
    assert.throws(() =>
      validateActionReview(r, {
        ...context,
        packages: new Map([...packages, [packageNames[1], e]]),
      }),
    );
  }
});
test("P33 nonrepresentative control and field scenes cannot silently lose mobile coverage", () => {
  for (const [pkg, scene] of [
    [packageNames[1], "remove-archived-focus"],
    [packageNames[2], "member-locked"],
    [packageNames[2], "composition-member-missing"],
  ]) {
    const e = copy(packages.get(pkg));
    e.screenshots = e.screenshots.filter((s) => !(s.scene === scene && s.width === 390));
    assert.throws(
      () => validateTeamsEvidenceBindings(build(), new Map([...packages, [pkg, e]])),
      /missing exact scene/,
    );
  }
});
test("P33 thirteen models and three containers preserve one shared dialog versus inline creation", () => {
  assert.deepEqual(validateReviewSurfaces(build().surfaceReview, { sources, packages }), {
    callerFiles: 2,
    localModelBindings: 13,
    callerContainers: 3,
    consumerVariants: 14,
    runtimeAcceptance: "unproven",
  });
  for (const key of ["inputs", "containers"]) {
    const r = build();
    r.surfaceReview[key].pop();
    assert.throws(() => validateReviewSurfaces(r.surfaceReview, { sources, packages }));
  }
  assert.equal(build().sharedReasonInput.maximumLength, null);
  assert.doesNotMatch(sources[dependencies[2]], /maxlength=/);
  assert.throws(
    () => buildTeamsReview({ ...sources, [childFile]: sources[childFile] + "\n" }, packages),
    /stale team source/,
  );
});
function bindings(source) {
  let found;
  const visit = (n) => {
    if (n.type === 1 && n.tag === "OrganizationTeamPanel") found = n;
    for (const c of n.children || []) visit(c);
  };
  visit(baseParse(parse(source).descriptor.template.content));
  assert.ok(found);
  return Object.fromEntries(
    found.props
      .filter((p) => p.type === 7 && p.name === "bind")
      .map((p) => [p.arg.content, p.exp.content]),
  );
}
test("P33 actual function props and data/busy bindings match the registered child consumers", () => {
  const r = build(),
    actual = bindings(sources[parentFile]);
  assert.deepEqual(actual, {
    teams: "data?.teams ?? []",
    members: "data?.members ?? []",
    busy: "busy",
    "create-team": "createTeam",
    "perform-member-action": "teamMemberAction",
  });
  for (const p of r.functionProps) {
    assert.equal(actual[p.attribute], p.handler);
    assert.ok(sources[childFile].includes(p.consumer + "("));
  }
  assert.equal(
    bindings(
      sources[parentFile].replace(':create-team="createTeam"', ':create-team="createWorkspace"'),
    )["create-team"],
    "createWorkspace",
  );
});
test("P33 extracted behavior verifies real write contracts while retaining explicit unresolved OG-G02", async () => {
  const data = await buildTeamsDesignData(process.cwd());
  assert.equal(data.sourceChecks.length, 5);
  assert.ok(data.sourceChecks.some((s) => s.includes("OG-G02")));
  assert.ok(data.sourceChecks.some((s) => s.includes("no expected_version")));
  assert.ok(build().compositionGaps.some((s) => s.includes("OG-G02")));
});
