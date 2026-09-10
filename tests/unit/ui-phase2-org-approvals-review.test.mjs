import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
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
  failureFile,
  dependencies,
  packageNames,
  buildOrgApprovalsReview,
  validateOrgApprovalsBindings,
  readOrgApprovalsReviewInputs,
} from "../../scripts/build-ui-phase2-org-approvals-review.mjs";

const { sources, packages } = readOrgApprovalsReviewInputs();
const build = () => buildOrgApprovalsReview(sources, packages);
const context = {
  candidates: dependencies.flatMap((f) => scanSource(sources[f], f).candidates),
  sourceHashes: build().sourceHashes,
  contracts: runContractAudit().records,
  packages,
  files: new Set(build().actions.flatMap((a) => a.testReferences.map((r) => r.file))),
};
const copy = (v) => JSON.parse(JSON.stringify(v));
test("P34 maps all28 source sites into8 read-only page actions,one forwarding and4 exclusions", () => {
  const review = build(),
    r = validateActionReview(review, context);
  assert.equal(r.sourceSites, 28);
  assert.equal(r.semanticGroups, 13);
  assert.equal(r.routeActions, 8);
  assert.equal(r.wiringGroups, 1);
  assert.equal(r.excludedGroups, 4);
  assert.equal(r.writeActions, 0);
  assert.deepEqual(JSON.parse(readFileSync(`${base}/action-reviews/P34.json`, "utf8")), review);
  const missing = build();
  missing.actions.find((a) => a.actionId === "OG-TECH").sourceCandidateIds.pop();
  assert.throws(() => validateActionReview(missing, context));
  const promoted = build();
  promoted.approval = "approved";
  assert.throws(() => validateActionReview(promoted, context), /cannot grant approval/);
  const forward = build();
  forward.actions.find((a) => a.kind === "wiring").forwardBindings[0].handler =
    "load({ background: true })";
  assert.throws(() => validateActionReview(forward, context), /forward event omitted or changed/);
});

test("P34 distinguishes25 existing control variants,7 historical proposal controls and one mobile implementation", () => {
  assert.deepEqual(validateOrgApprovalsBindings(build(), packages), {
    controls: 25,
    proposalOnlyControls: 7,
    sourceSites: 28,
    fields: 10,
    fieldStates: 67,
    fieldCompositions: 8,
    parentStates: 17,
  });
  for (const mutate of [
    (r) => r.actions.find((a) => a.actionId === "OG-A-VIEW").controlCatalogBindings.pop(),
    (r) =>
      r.actions
        .find((a) => a.actionId === "OG-REFRESH")
        .controlCatalogBindings[0].sourceCandidateIds.splice(0, 1),
    (r) => r.proposalOnlyControls.find((c) => c.id === "back-directory").widths.push(1440),
    (r) => r.implementedBindings[0].widths.push(1440),
    (r) =>
      (r.surfaceReview.inputs.find((i) => i.file === childFile).fieldEvidence.selector = "#wrong"),
    (r) => (r.surfaceReview.inputs.at(-1).fieldEvidence.states.focus = "template-query-focus"),
    (r) => (r.parentStates.find((s) => s.id === "background-permission-forbidden").replace = false),
    (r) => r.fieldCompositions.pop(),
  ]) {
    const r = copy(build());
    mutate(r);
    assert.throws(() => validateOrgApprovalsBindings(r, packages));
  }
  const missingShot = new Map([...packages].map(([k, v]) => [k, copy(v)]));
  missingShot.get(packageNames[1]).screenshots = missingShot
    .get(packageNames[1])
    .screenshots.filter((s) => s.file !== "back-directory-focus-390.png");
  assert.throws(() => validateOrgApprovalsBindings(build(), missingShot), /missing exact image/);
});

test("P34 registers16 model sites but excludes6 parent fields and does not invent local dialogs", () => {
  const r = build();
  assert.deepEqual(validateReviewSurfaces(r.surfaceReview, { sources, packages }), {
    callerFiles: 3,
    localModelBindings: 16,
    callerContainers: 3,
    consumerVariants: 3,
    runtimeAcceptance: "unproven",
  });
  assert.equal(r.surfaceReview.inputs.filter((i) => i.file === childFile).length, 10);
  assert.ok(
    r.surfaceReview.inputs
      .filter((i) => i.file === parentFile)
      .every((i) => i.meaning.includes("排除")),
  );
  assert.deepEqual(
    r.surfaceReview.containers.map((c) => [c.tag, c.variants[0].evidenceScope]),
    [
      ["form", "route-excluded-reference"],
      ["AuditedReasonDialog", "route-excluded-reference"],
      ["aside", "related-scene-only"],
    ],
  );
  assert.match(r.dialogs.remaining, /P34无业务弹窗/);
  const changed = copy(r);
  changed.surfaceReview.containers[2].shape = "native-dialog";
  assert.throws(
    () => validateReviewSurfaces(changed.surfaceReview, { sources, packages }),
    /shape mismatch/,
  );
});

test("P34 pass-through props and zero child emits are checked against actual SFC AST", () => {
  const root = baseParse(parse(sources[parentFile]).descriptor.template.content),
    found = [];
  function visit(n) {
    if (n.type === 1 && n.tag === "OrganizationApprovalPanel") found.push(n);
    for (const c of n.children ?? []) visit(c);
  }
  visit(root);
  assert.equal(found.length, 1);
  const node = found[0],
    record = build().propBindings[0];
  assert.deepEqual(
    Object.fromEntries(
      node.props
        .filter((p) => p.type === 7 && p.name === "bind")
        .map((p) => [p.arg.content, p.exp.content]),
    ),
    record.props,
  );
  assert.deepEqual(
    node.props.filter((p) => p.type === 7 && p.name === "on"),
    record.events,
  );
  assert.equal(
    node.props.find((p) => p.type === 7 && p.name === "else-if").exp.content,
    "view === 'approvals'",
  );
  assert.doesNotMatch(sources[childFile], /defineEmits|\bfetch\(/);
  assert.match(sources[failureFile], /emit\('reload'\)/);
});

test("P34 implementation evidence and narrow approval records resolve without promoting design packages", () => {
  const r = build(),
    sha = (s) => createHash("sha256").update(s.replaceAll("\r\n", "\n")).digest("hex");
  for (const ref of r.implementationEvidence) {
    assert.ok(existsSync(`${base}/${ref.review}`));
    const e = JSON.parse(readFileSync(ref.evidence, "utf8"));
    for (const [f, h] of Object.entries(e.sourceHashes))
      assert.equal(sha(readFileSync(f, "utf8")), h, f);
  }
  for (const file of r.approvalRecords) assert.ok(existsSync(`${base}/${file}`));
  assert.equal(packages.get(packageNames[3]).approval, "pending-concrete-parent-section-review");
  assert.ok(r.proposalOnlyControls.some((c) => c.id === "template-clear-empty"));
  assert.deepEqual(r.implementedBindings[0].widths, [390]);
});
