import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const acceptanceCaptureRoot = "output/playwright/p49-current-review-r2";
export const acceptanceCaptureDrivers = {
  page: "9d3e483517a897faab328fc1bdb677683218d3a636a43ef8d86082e21a9d87ae",
  "read-states": "ffada9aba098ffd7db741f83f320ed8741d7129aebc86efb47969c78a7f48b9d",
  actions: "6387dd7e9455b723f18b36590e6284b4f2481060a75b28ec1bf366d9a2482918",
  robustness: "b6d8e850f31a39cb93d6326834e6fe8922aa962f57eefa8e970b566a6be0795e",
  lifecycle: "74a43dfe4588b9aa05575f15f015d17e857ef7ec9f8414cf3135f50c139b6764",
};

// Only artifact destination/provenance change. All browser interactions and assertions survive.
export function buildAcceptanceCurrentCapture(source, stage) {
  assert.ok(Object.hasOwn(acceptanceCaptureDrivers, stage), "Unknown P49 capture stage");
  let runner = source.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(runner).digest("hex"),
    acceptanceCaptureDrivers[stage],
    "Original P49 driver changed",
  );
  const replace = (before, after) => {
    assert.equal(runner.split(before).length, 2, `Exact capture boundary: ${before}`);
    runner = runner.replace(before, after);
  };
  replace(
    'import assert from "node:assert/strict";',
    'import assert from "node:assert/strict";\nimport { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";',
  );
  replace(
    'assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));',
    'assert.equal(process.argv.length, 3, "Current capture accepts one stage only");',
  );
  replace('const capture = process.argv.includes("--capture"),', "const capture = true,");
  replace(
    `output = "output/playwright/p49-acceptance-${stage}-review"`,
    `output = "${acceptanceCaptureRoot}/${stage}"`,
  );
  if (["robustness", "lifecycle"].includes(stage))
    replace("    await rm(output, { recursive: true, force: true });\n", "");
  const finalMarker =
    stage === "lifecycle"
      ? "if (capture) {\n  const evidence = {"
      : "if (capture) {\n  const sourceHashes =";
  replace(
    finalMarker,
    finalMarker.replace(
      "  const ",
      '  loadedSources.add("scripts/capture-ui-phase2-acceptance-current.mjs");\n' +
        '  loadedSources.add("scripts/lib/ui-phase2-acceptance-current-capture.mjs");\n' +
        '  loadedSources.add("scripts/lib/ui-imported-style-sources.mjs");\n' +
        "  await includeImportedStyleSources(loadedSources, read);\n  const ",
    ),
  );
  const kind = stage.toUpperCase();
  replace(
    `kind: "P49-ACCEPTANCE-${kind}-REVIEW-r1",`,
    `kind: "P49-ACCEPTANCE-${kind}-CURRENT-REVIEW-r2",\n` +
      `      captureStage: "${stage}",\n` +
      `      captureDriverSha: "${acceptanceCaptureDrivers[stage]}",\n` +
      '      userReview: "pending",\n' +
      '      sourceBoundary: "Current-source review composition, not production implementation; local fixtures only. Includes recursively imported CSS.",',
  );
  assert.ok(!runner.includes("await rm(output,"), "Capture must not remove an artifact directory");
  return runner;
}
