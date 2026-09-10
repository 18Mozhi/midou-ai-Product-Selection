import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import {
  base,
  sourceFile,
  buildOrganizationProfileReview as buildProfileReview,
} from "../../scripts/build-ui-phase2-organization-profile-review.mjs";

const source = readFileSync(sourceFile, "utf8").replaceAll("\r\n", "\n");
const sourceHashes = { [sourceFile]: createHash("sha256").update(source).digest("hex") };
const packages = new Map(
  [
    "organization-profile-direction-c",
    "organization-profile-controls-direction-c",
    "organization-profile-fields-direction-c",
  ].map((name) => [name, JSON.parse(readFileSync(`${base}/design/${name}/evidence.json`, "utf8"))]),
);
const buildOrganizationProfileReview = (source, evidence) =>
  buildProfileReview(source, evidence, packages.get("organization-profile-fields-direction-c"));
const context = {
  candidates: scanSource(source, sourceFile).candidates,
  sourceHashes,
  contracts: runContractAudit().records,
  packages,
  files: new Set([
    "scripts/verify-ui-phase2-organization-profile-c.mjs",
    "scripts/verify-ui-phase2-organization-profile-controls-c.mjs",
    "scripts/verify-ui-phase2-organization-profile-fields-c.mjs",
  ]),
};
const review = () => JSON.parse(readFileSync(`${base}/action-reviews/P29.json`, "utf8"));

test("P29 maps all eleven parent sites to three business actions, Logo validity and three exclusions", () => {
  const r = validateActionReview(review(), context);
  assert.equal(r.sourceSites, 11);
  assert.equal(r.semanticGroups, 7);
  assert.equal(r.routeActions, 4); // Includes the local field callback, not four business buttons.
  assert.equal(r.excludedGroups, 3);
  assert.equal(r.writeActions, 1);
  assert.equal(r.unmappedVisualSlots, 0);
  assert.equal(r.sourceInapplicableVisualSlots, 4);
  assert.equal(
    review().actions.find((a) => a.actionId === "OG-PROFILE-SAVE").sourceCandidateIds.length,
    2,
  );
});
test("P29 keeps six models, one inline form and the shared reason caller distinct", () => {
  const value = review();
  const result = validateReviewSurfaces(value.surfaceReview, {
    sources: { [sourceFile]: source },
    packages,
  });
  assert.equal(result.localModelBindings, 6);
  assert.equal(result.callerContainers, 2);
  assert.equal(result.consumerVariants, 32);
  assert.equal(result.runtimeAcceptance, "unproven");
  const reason = value.surfaceReview.containers[1].variants[0];
  assert.equal(reason.evidenceScope, "route-excluded-reference");
  assert.match(reason.exclusionReason, /初始.*跨缓存/);
  assert.match(value.dialogs.remaining, /共享原因组件仍在父模板/);
});
test("P29 only binds business states; directory/disclosure/recheck remain proposals", () => {
  const r = review(),
    e = packages.get("organization-profile-controls-direction-c");
  assert.equal(
    r.actions.reduce((n, a) => n + Object.keys(a.visualStateReferences ?? {}).length, 0),
    20,
  );
  const variants = r.actions.flatMap((a) => a.additionalControlVariants ?? []);
  assert.equal(variants.length, 8);
  assert.equal(
    variants.reduce((n, v) => n + Object.keys(v.states).length, 0),
    29,
  );
  assert.equal(r.proposalOnlyControls.length, 11);
  assert.equal(e.screenshots.length, 170);
  assert.deepEqual(Object.keys(e.actionVisualReferences).sort(), [
    "OG-PROFILE-SAVE",
    "OG-REFRESH",
    "OG-RETRY",
  ]);
  assert.deepEqual(r, buildOrganizationProfileReview(source, e));
  assert.ok(!r.actions.some((a) => a.actionId.startsWith("PROPOSAL-")));
});
test("P29 refuses source omissions, nonexistent approval and stale source", () => {
  const r = review();
  r.actions = r.actions.filter((a) => a.actionId !== "OG-PROFILE-LOGO");
  assert.throws(() => validateActionReview(r, context), /unmapped candidates/);
  const stale = review();
  stale.sourceHashes[sourceFile] = "stale";
  assert.throws(() => validateActionReview(stale, context), /reviewed source drift/);
  const approved = review();
  approved.approval = "approved";
  assert.throws(() => validateActionReview(approved, context), /cannot grant approval/);
  assert.throws(
    () =>
      buildOrganizationProfileReview(
        source + "\n// drift",
        packages.get("organization-profile-controls-direction-c"),
      ),
    /verify current proposal/,
  );
});
test("P29 refuses invented fields and a missing shared reason component", () => {
  const value = review();
  value.surfaceReview.inputs.push({
    file: sourceFile,
    binding: "form.status",
    meaning: "invented",
    remaining: "invented",
  });
  assert.throws(
    () =>
      validateReviewSurfaces(value.surfaceReview, { sources: { [sourceFile]: source }, packages }),
    /input omissions/,
  );
  const missing = review();
  missing.surfaceReview.containers.pop();
  assert.throws(
    () =>
      validateReviewSurfaces(missing.surfaceReview, {
        sources: { [sourceFile]: source },
        packages,
      }),
    /container omissions/,
  );
});
test("P29 rejects selector borrowing or missing exact mobile variant evidence", () => {
  const wrong = review();
  wrong.actions.find((a) => a.actionId === "OG-RETRY").additionalControlVariants[0].selector =
    "#save-profile";
  assert.throws(() => validateActionReview(wrong, context), /variant selector differs/);
  const incomplete = structuredClone(packages),
    e = incomplete.get("organization-profile-controls-direction-c");
  e.screenshots = e.screenshots.filter(
    (s) => !(s.width === 390 && s.control?.key === "P29-retry-blocked"),
  );
  assert.throws(
    () => validateActionReview(review(), { ...context, packages: incomplete }),
    /missing scene\/viewport|missing exact variant/,
  );
  const absent = structuredClone(packages.get("organization-profile-controls-direction-c"));
  delete absent.actionVisualReferences["OG-PROFILE-SAVE"];
  assert.throws(() => buildOrganizationProfileReview(source, absent), /missing business control/);
});
test("P29 exclusion conditions stay bound to exact child branches and source reason origins", () => {
  const find = (id) => context.candidates.find((c) => c.candidateId === `${sourceFile}#${id}`);
  assert.ok(
    find("6a563eeaa67fea90.1").conditions.some((c) => c.expression === "view === 'members'"),
  );
  assert.ok(find("b09d7923228aabe6.1").conditions.some((c) => c.expression === "view === 'roles'"));
  assert.ok(
    find("d6b520278ab3dd57.1").conditions.some((c) => c.expression === "view === 'summary'"),
  );
  assert.deepEqual(Object.keys(find("1cbd108c64b5230c.1").events), ["@invalid", "@input"]);
  const submit = source.slice(
    source.indexOf("async function submit("),
    source.indexOf("async function inviteMembers("),
  );
  assert.ok(submit.length > 100);
  assert.doesNotMatch(submit, /askAuditedReason|await auditedReason/);
  assert.match(source, /:open="auditedReasonOpen"/);
});
