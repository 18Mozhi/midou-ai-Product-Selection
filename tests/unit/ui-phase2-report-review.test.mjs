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
  buildReportReview,
} from "../../scripts/build-ui-phase2-report-review.mjs";

const source = readFileSync(sourceFile, "utf8").replaceAll("\r\n", "\n");
const sourceHashes = { [sourceFile]: createHash("sha256").update(source).digest("hex") };
const packages = new Map(
  ["report-direction-c", "report-controls-direction-c"].map((name) => [
    name,
    JSON.parse(readFileSync(`${base}/design/${name}/evidence.json`, "utf8")),
  ]),
);
const context = {
  candidates: scanSource(source, sourceFile).candidates,
  sourceHashes,
  contracts: runContractAudit().records,
  packages,
  files: new Set([
    "scripts/verify-ui-phase2-report-c.mjs",
    "scripts/verify-ui-phase2-report-controls-c.mjs",
  ]),
};
const review = () => JSON.parse(readFileSync(`${base}/action-reviews/P28.json`, "utf8"));

test("P28 explicitly maps all 14 source sites to ten actions and one modal wiring group", () => {
  const r = validateActionReview(review(), context);
  assert.equal(r.sourceSites, 14);
  assert.equal(r.semanticGroups, 11);
  assert.equal(r.routeActions, 10);
  assert.equal(r.wiringGroups, 1);
  assert.equal(r.writeActions, 2);
  assert.equal(r.sourceInapplicableVisualSlots, 8);
  assert.equal(r.unmappedVisualSlots, 0);
  assert.equal(review().actions.find((a) => a.actionId === "RP-DOWNLOAD").kind, "read");
  assert.equal(
    review().actions.find((a) => a.actionId === "RP-REGENERATE").sourceCandidateIds.length,
    2,
  );
});
test("P28 keeps zero inputs and one native dialog with distinct non-record failure states", () => {
  const value = review();
  const r = validateReviewSurfaces(value.surfaceReview, {
    sources: { [sourceFile]: source },
    packages,
  });
  assert.equal(r.localModelBindings, 0);
  assert.equal(r.callerContainers, 1);
  assert.equal(r.consumerVariants, 17);
  assert.equal(r.runtimeAcceptance, "unproven");
  const excluded = value.surfaceReview.containers[0].variants.filter(
    (v) => v.evidenceScope === "route-excluded-reference",
  );
  assert.deepEqual(
    excluded.map((v) => v.name),
    ["detail_not_found", "detail_forbidden"],
  );
});
test("P28 208 screenshots bind 48 representative states and 14 additional variants without approval", () => {
  const value = review(),
    evidence = packages.get("report-controls-direction-c");
  assert.equal(evidence.screenshots.length, 208);
  assert.equal(
    value.actions.reduce((n, a) => n + Object.keys(a.visualStateReferences ?? {}).length, 0),
    48,
  );
  const variants = value.actions.flatMap((a) => a.additionalControlVariants ?? []);
  assert.equal(variants.length, 14);
  assert.equal(
    variants.reduce((n, v) => n + Object.keys(v.states).length, 0),
    60,
  );
  for (const type of ["opportunity", "trend", "team"])
    assert.ok(variants.some((v) => v.key === `P28-type-${type}-selected`));
  assert.equal(value.approval, "pending-user-review");
  assert.deepEqual(value, buildReportReview(source, evidence));
});
test("P28 refuses to omit the page technical control or a detail regeneration source", () => {
  const omitted = review();
  omitted.actions = omitted.actions.filter((a) => a.actionId !== "RP-TECH");
  assert.throws(() => validateActionReview(omitted, context), /unmapped candidates/);
  const partial = review();
  partial.actions.find((a) => a.actionId === "RP-REGENERATE").sourceCandidateIds.pop();
  assert.throws(
    () => validateActionReview(partial, context),
    /unused contract alias|unmapped candidates/,
  );
});
test("P28 rejects invented date input and wrong native cancel forwarding", () => {
  const value = review();
  value.surfaceReview.inputs.push({
    file: sourceFile,
    binding: "dateRange",
    meaning: "invented",
    remaining: "invented",
  });
  assert.throws(
    () =>
      validateReviewSurfaces(value.surfaceReview, { sources: { [sourceFile]: source }, packages }),
    /input omissions/,
  );
  const wrong = review();
  wrong.actions.find((a) => a.kind === "wiring").forwardBindings[0].handler = "createExport";
  assert.throws(() => validateActionReview(wrong, context), /forward event omitted or changed/);
});
test("P28 variant cannot borrow another selector or omit its mobile screenshot", () => {
  const wrong = review();
  wrong.actions.find((a) => a.actionId === "RP-TYPE").additionalControlVariants[0].selector =
    "[data-create]";
  assert.throws(() => validateActionReview(wrong, context), /variant selector differs/);
  const incomplete = structuredClone(packages);
  const e = incomplete.get("report-controls-direction-c");
  e.screenshots = e.screenshots.filter(
    (s) => !(s.width === 390 && s.control?.key === "P28-regenerate-detail"),
  );
  assert.throws(
    () => validateActionReview(review(), { ...context, packages: incomplete }),
    /missing scene\/viewport|missing exact variant screenshot/,
  );
});
test("P28 source drift and fabricated approval fail closed", () => {
  const stale = review();
  stale.sourceHashes[sourceFile] = "stale";
  assert.throws(() => validateActionReview(stale, context), /reviewed source drift/);
  assert.throws(
    () => buildReportReview(source + "\n// drift", packages.get("report-controls-direction-c")),
    /verify current proposal/,
  );
  const approved = review();
  approved.approval = "approved";
  assert.throws(() => validateActionReview(approved, context), /cannot grant approval/);
});
