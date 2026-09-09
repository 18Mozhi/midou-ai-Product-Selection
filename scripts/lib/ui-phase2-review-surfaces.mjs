import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";

// Explicit caller surfaces, not an inferred business-action or global modal denominator.
const shapes = {
  ResponsiveFilterDrawer: "responsive-filter",
  ResponsiveDataView: "responsive-row-detail",
  AuditedReasonDialog: "native-reason-dialog",
  ConfirmDialog: "confirmation-dialog",
  aside: "inline-aside",
};
export function scanReviewSurfaces(source, file, { includeStructuralContainers = false } = {}) {
  const selectedShapes = includeStructuralContainers
    ? {
        ...shapes,
        dialog: "native-dialog",
        form: "form-container",
        OpportunityWorkspaceDialogs: "business-dialog-container",
      }
    : shapes;
  const parsed = parse(source, { filename: file });
  assert.deepEqual(parsed.errors, []);
  const root = baseParse(parsed.descriptor.template?.content ?? "");
  const counts = {},
    inputs = [],
    containers = [];
  function visit(node) {
    if (node.type === 1) {
      for (const prop of node.props)
        if (prop.type === 7 && prop.name === "model") {
          assert.ok(prop.exp?.content, "empty model binding");
          inputs.push({ file, binding: prop.exp.content });
        }
      if (Object.hasOwn(selectedShapes, node.tag)) {
        const ordinal = (counts[node.tag] = (counts[node.tag] ?? 0) + 1);
        containers.push({ file, tag: node.tag, ordinal, shape: selectedShapes[node.tag] });
      }
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(root);
  return { inputs, containers };
}
const key = (v) => `${v.file}#${v.tag}.${v.ordinal}`;
export function validateReviewSurfaces(review, { sources, packages }) {
  assert.equal(review.status, "source-reviewed-not-runtime-accepted");
  assert.ok(review.files.length > 0);
  assert.equal(new Set(review.files).size, review.files.length);
  assert.ok(
    review.includeStructuralContainers === undefined ||
      typeof review.includeStructuralContainers === "boolean",
  );
  const scanned = review.files.map((file) => {
    assert.ok(sources[file], "missing reviewed source");
    return scanReviewSurfaces(sources[file], file, review);
  });
  const hashes = Object.keys(review.dependencyHashes);
  for (const file of review.files) assert.ok(hashes.includes(file), "missing caller hash");
  for (const file of hashes) {
    assert.ok(sources[file], "missing dependency source");
    assert.equal(
      createHash("sha256").update(sources[file].replaceAll("\r\n", "\n")).digest("hex"),
      review.dependencyHashes[file],
      "surface dependency drift",
    );
  }
  const inputs = scanned.flatMap((s) => s.inputs);
  assert.deepEqual(
    review.inputs.map(({ file, binding }) => ({ file, binding })),
    inputs,
    "input omissions/order/duplicates",
  );
  for (const input of review.inputs) assert.ok(input.meaning && input.remaining);
  const expected = scanned.flatMap((s) => s.containers);
  assert.deepEqual(
    review.containers.map(({ file, tag, ordinal, shape }) => ({ file, tag, ordinal, shape })),
    expected,
    "container omissions/order/shape mismatch",
  );
  const variantKeys = new Set();
  for (const container of review.containers) {
    assert.ok(container.sourceBehavior && container.remaining);
    assert.ok(container.variants.length > 0);
    for (const variant of container.variants) {
      assert.ok(variant.name && variant.remaining && variant.scenes.length);
      assert.ok(
        [
          "related-scene-only",
          "matching-dialog-scene",
          "matching-inline-form-scene",
          "route-excluded-reference",
          "proposal-shape-differs",
        ].includes(variant.evidenceScope),
        "unsupported consumer evidence scope",
      );
      if (variant.evidenceScope === "matching-inline-form-scene")
        assert.equal(
          container.shape,
          "form-container",
          "inline form evidence requires a form source",
        );
      if (variant.evidenceScope === "route-excluded-reference")
        assert.ok(variant.exclusionReason, "route exclusion needs source rationale");
      const variantKey = `${key(container)}/${variant.name}`;
      assert.ok(!variantKeys.has(variantKey), "duplicate consumer variant");
      variantKeys.add(variantKey);
      for (const ref of variant.scenes) {
        const evidence = packages.get(ref.package);
        assert.ok(evidence, "missing scene package");
        for (const width of [1440, 390])
          assert.ok(
            evidence.screenshots.some(
              (s) => s.scene === ref.scene && (s.width ?? s.viewport?.width) === width,
            ),
            "missing consumer scene/viewport",
          );
      }
    }
  }
  assert.ok(review.sharedRemaining.length > 0, "shared source not globally accepted");
  return {
    callerFiles: review.files.length,
    localModelBindings: inputs.length,
    callerContainers: expected.length,
    consumerVariants: variantKeys.size,
    runtimeAcceptance: "unproven",
  };
}
