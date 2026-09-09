import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";

export function validateAutomationFieldContract(source, fields) {
  const parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  const nodes = [];
  function visit(node, ancestors = []) {
    if (node.type === 1) {
      const model = node.props.find((p) => p.type === 7 && p.name === "model");
      if (model) nodes.push({ node, model, ancestors });
    }
    for (const child of node.children ?? []) visit(child, [...ancestors, node]);
  }
  visit(baseParse(parsed.descriptor.template.content));
  assert.deepEqual(
    fields.map((f) => f.binding),
    nodes.map((n) => n.model.exp.content),
    "field model omissions/order",
  );
  for (const [i, field] of fields.entries()) {
    const { node, model, ancestors } = nodes[i];
    assert.equal(node.tag, field.tag, field.binding);
    const attributes = Object.fromEntries(
      node.props.filter((p) => p.type === 6).map((p) => [p.name, p.value?.content ?? true]),
    );
    assert.equal(Boolean(attributes.required), Boolean(field.required), field.id + " required");
    for (const key of ["min", "max", "maxlength", "type"])
      assert.equal(
        attributes[key],
        field[key] === undefined ? undefined : String(field[key]),
        `${field.id} ${key}`,
      );
    assert.ok(
      !node.props.some(
        (p) => p.name === "disabled" || (p.type === 7 && p.arg?.content === "disabled"),
      ),
      "source field disabled behavior changed",
    );
    if (field.type === "number")
      assert.ok(model.modifiers.some((m) => (m.content ?? m) === "number"));
    if (field.options)
      assert.deepEqual(
        node.children
          .filter((c) => c.tag === "option")
          .map((c) => c.props.find((p) => p.type === 6 && p.name === "value")?.value?.content),
        field.options,
      );
    if (["reason", "action_assignee_id"].includes(field.id)) {
      const condition = field.id === "reason" ? "editing" : "form.action_type === 'create_task'";
      assert.ok(
        ancestors.some((a) =>
          a.props?.some((p) => p.type === 7 && p.name === "if" && p.exp?.content === condition),
        ),
        field.id + " conditional rendering",
      );
    }
  }
  return { bindings: nodes.length, required: fields.filter((f) => f.required).length };
}

export function validateAutomationFieldEvidence(fields, review, evidence) {
  assert.equal(review.approval, "pending-user-review");
  assert.equal(evidence.scope, "offline-proposal-not-runtime-or-user-accepted");
  assert.deepEqual(
    Object.keys(evidence.fieldVisualReferences),
    fields.map((f) => f.binding),
  );
  let states = 0;
  for (const field of fields) {
    const ref = evidence.fieldVisualReferences[field.binding];
    const registry = review.surfaceReview.inputs.find(
      (i) => i.binding === field.binding,
    )?.fieldStateEvidence;
    assert.ok(registry, "missing field registry");
    assert.equal(registry.package, "automation-forms-direction-c");
    assert.equal(registry.selector, `#${field.id}`, "field selector mismatch");
    assert.equal(ref.selector, registry.selector, "field selector mismatch");
    assert.deepEqual(registry.states, ref.states);
    const expected = [
      "default",
      "focus",
      "busy",
      ...(field.required ? ["missing"] : []),
      ...(field.type === "number" ? ["min", "max", "below", "above", "fraction"] : []),
      ...(field.maxlength ? ["maxlength"] : []),
    ];
    assert.deepEqual(Object.keys(ref.states), expected, "field states incomplete or invented");
    for (const [state, scene] of Object.entries(ref.states)) {
      assert.equal(scene, `${field.id}-${state}`);
      states++;
      for (const width of [1440, 390]) {
        const matches = evidence.screenshots.filter((s) => s.scene === scene && s.width === width);
        assert.equal(matches.length, 1, "missing/duplicate field viewport image");
        assert.deepEqual(
          matches[0].field,
          { binding: field.binding, selector: ref.selector, state },
          "field image identity mismatch",
        );
      }
    }
  }
  return { bindings: fields.length, states, runtimeAcceptance: "unproven" };
}
