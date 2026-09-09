import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const file = "apps/web/src/components/AutomationRuleCenter.vue";
const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const sourceHashes = { [file]: createHash("sha256").update(source).digest("hex") };
const packages = new Map([
  [
    "automation-direction-c",
    JSON.parse(readFileSync(`${base}/design/automation-direction-c/evidence.json`, "utf8")),
  ],
]);
packages.set(
  "automation-controls-direction-c",
  JSON.parse(readFileSync(`${base}/design/automation-controls-direction-c/evidence.json`, "utf8")),
);
const context = {
  candidates: scanSource(source, file).candidates,
  sourceHashes,
  contracts: runContractAudit().records,
  packages,
  files: new Set([
    "scripts/verify-ui-phase2-automation-c.mjs",
    "scripts/verify-ui-phase2-automation-controls-c.mjs",
  ]),
};
const review = () => JSON.parse(readFileSync(`${base}/action-reviews/P27.json`, "utf8"));

test("P27 maps every current source site without counting preview or dialog wiring as writes", () => {
  const value = review();
  const result = validateActionReview(value, context);
  assert.equal(result.sourceSites, 19);
  assert.equal(result.semanticGroups, 16);
  assert.equal(result.routeActions, 14);
  assert.equal(result.writeActions, 2);
  assert.equal(result.wiringGroups, 2);
  assert.equal(result.unmappedVisualSlots, 0);
  assert.equal(
    value.actions.reduce((n, a) => n + Object.keys(a.visualStateReferences ?? {}).length, 0),
    68,
  );
  assert.equal(result.sourceInapplicableVisualSlots, 10);
  assert.equal(value.actions.find((a) => a.actionId === "AR-PREVIEW").kind, "read");
  assert.equal(value.actions.find((a) => a.actionId === "AR-SAVE").sourceCandidateIds.length, 2);
  assert.equal(value.approval, "pending-user-review");
});

test("P27 retains all ten models and three containers; variant references are not extra modals", () => {
  const result = validateReviewSurfaces(review().surfaceReview, {
    sources: { [file]: source },
    packages,
  });
  assert.equal(result.localModelBindings, 10);
  assert.equal(result.callerContainers, 3);
  assert.equal(result.consumerVariants, 32);
  assert.equal(result.runtimeAcceptance, "unproven");
});

test("P27 cannot omit a template caller or turn its generic control board into exact state proof", () => {
  const missing = review();
  missing.actions = missing.actions.filter((a) => a.actionId !== "AR-TEMPLATE");
  assert.throws(() => validateActionReview(missing, context), /unmapped candidates/);
  const invented = review();
  const action = invented.actions.find((a) => a.actionId === "AR-SAVE");
  action.scenes.push({ package: "automation-direction-c", scene: "controls" });
  action.visualStates.hover = "scene-reference-not-acceptance";
  action.visualStateReferences = {
    hover: { package: "automation-direction-c", scene: "controls", selector: "button" },
  };
  assert.throws(
    () => validateActionReview(invented, context),
    /missing action-specific visual evidence/,
  );
});

test("P27 cannot omit conditional task assignee or alter native cancel forwarding", () => {
  const missing = review();
  missing.surfaceReview.inputs = missing.surfaceReview.inputs.filter(
    (i) => i.binding !== "form.action_assignee_id",
  );
  assert.throws(
    () => validateReviewSurfaces(missing.surfaceReview, { sources: { [file]: source }, packages }),
    /input omissions/,
  );
  const wrong = review();
  wrong.actions.find((a) => a.actionId === "D-AR-EDITOR").forwardBindings[0].handler = "create";
  assert.throws(() => validateActionReview(wrong, context), /forward event omitted or changed/);
});

test("P27 stale source and pretend approval fail closed", () => {
  const stale = review();
  stale.sourceHashes[file] = "stale";
  assert.throws(() => validateActionReview(stale, context), /reviewed source drift/);
  const approved = review();
  approved.approval = "approved";
  assert.throws(() => validateActionReview(approved, context), /cannot grant approval/);
});

test("P27 ten explicit variants preserve action counts and bind both viewport images", () => {
  const value = review();
  const variants = value.actions.flatMap((a) => a.additionalControlVariants ?? []);
  assert.equal(variants.length, 10);
  assert.equal(
    variants.reduce((n, v) => n + Object.keys(v.states).length, 0),
    42,
  );
  assert.deepEqual(
    variants.map((v) => v.key).sort(),
    [
      "P27-resume",
      "P27-save-edit",
      "P27-template-competitor",
      "P27-template-rejected",
      "P27-reload-blocked",
      "P27-reload-expired",
      "P27-reload-forbidden",
      "P27-reload-rate_limited",
      "P27-reload-version_conflict",
      "P27-cancel-edit",
    ].sort(),
  );
  const result = validateActionReview(value, context);
  assert.equal(result.routeActions, 14);
  assert.equal(result.writeActions, 2);
  assert.equal(value.approval, "pending-user-review");
});

test("P27 variants cannot borrow another selector or a viewport image without its exact variant key", () => {
  const wrong = review();
  wrong.actions.find((a) => a.actionId === "AR-STATUS").additionalControlVariants[0].selector =
    "#save";
  assert.throws(() => validateActionReview(wrong, context), /variant selector differs/);
  const brokenPackages = structuredClone(packages);
  const image = brokenPackages
    .get("automation-controls-direction-c")
    .screenshots.find((s) => s.control?.key === "P27-resume" && s.width === 390);
  image.control.key = "P27-wrong";
  assert.throws(
    () => validateActionReview(review(), { ...context, packages: brokenPackages }),
    /missing exact variant screenshot/,
  );
});
