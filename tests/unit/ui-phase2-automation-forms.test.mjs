import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  validateAutomationFieldContract,
  validateAutomationFieldEvidence,
} from "../../scripts/lib/ui-phase2-automation-form-review.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const window = {};
runInNewContext(readFileSync(`${base}/design/automation-forms-direction-c/fields.js`, "utf8"), {
  window,
});
const fields = JSON.parse(JSON.stringify(window.AUTOMATION_FORM_FIELDS));
const source = readFileSync("apps/web/src/components/AutomationRuleCenter.vue", "utf8");
const review = () => JSON.parse(readFileSync(`${base}/action-reviews/P27.json`, "utf8"));
const evidence = () =>
  JSON.parse(readFileSync(`${base}/design/automation-forms-direction-c/evidence.json`, "utf8"));

test("P27 field proposal matches all ten actual Vue models and native constraints", () => {
  assert.deepEqual(validateAutomationFieldContract(source, fields), { bindings: 10, required: 7 });
});
test("P27 field contract rejects changed length, omitted conditional field and invented disabled behavior", () => {
  const wrong = structuredClone(fields);
  wrong.find((f) => f.id === "reason").maxlength = 1000;
  assert.throws(() => validateAutomationFieldContract(source, wrong), /reason maxlength/);
  assert.throws(
    () =>
      validateAutomationFieldContract(
        source,
        fields.filter((f) => f.id !== "action_assignee_id"),
      ),
    /field model omissions/,
  );
  assert.throws(
    () =>
      validateAutomationFieldContract(
        source.replace('v-model="form.name"', 'v-model="form.name" :disabled="busy"'),
        fields,
      ),
    /disabled behavior changed/,
  );
});
test("P27 fifty exact field states map both viewports without granting runtime or page approval", () => {
  assert.deepEqual(validateAutomationFieldEvidence(fields, review(), evidence()), {
    bindings: 10,
    states: 50,
    runtimeAcceptance: "unproven",
  });
  assert.equal(evidence().screenshots.length, 114);
});
test("P27 field evidence cannot borrow a selector, omit a phone image or invent a disabled state", () => {
  const wrong = review();
  wrong.surfaceReview.inputs[0].fieldStateEvidence.selector = "#action_title";
  assert.throws(
    () => validateAutomationFieldEvidence(fields, wrong, evidence()),
    /field selector mismatch/,
  );
  const missing = evidence();
  missing.screenshots = missing.screenshots.filter(
    (s) => !(s.scene === "reason-missing" && s.width === 390),
  );
  assert.throws(
    () => validateAutomationFieldEvidence(fields, review(), missing),
    /field viewport image/,
  );
  const invented = evidence(),
    registry = review();
  invented.fieldVisualReferences[fields[0].binding].states.disabled = "name-busy";
  registry.surfaceReview.inputs[0].fieldStateEvidence.states.disabled = "name-busy";
  assert.throws(
    () => validateAutomationFieldEvidence(fields, registry, invented),
    /incomplete or invented/,
  );
});
