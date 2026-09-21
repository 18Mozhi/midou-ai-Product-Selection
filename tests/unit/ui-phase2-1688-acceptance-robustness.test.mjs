import test from "node:test";
import { acceptanceHistoricalCapture } from "../../scripts/lib/ui-phase2-acceptance-historical-capture.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  acceptanceRobustnessContract,
  previewAlibaba1688AcceptanceRobustness,
} from "../../scripts/lib/ui-phase2-1688-acceptance-robustness-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  cssFile =
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-robustness-preview.css",
  root = "output/playwright/p49-acceptance-robustness-review";

test("P49 robustness review transforms the actual Vue surface and compiles", () => {
  const source = read(component),
    review = previewAlibaba1688AcceptanceRobustness(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p49-robustness" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p49-robustness",
    }).errors,
    [],
  );
  assert.ok(review.includes("p49-robustness"));
  assert.equal(source.includes("p49-robustness"), false);
  assert.deepEqual(acceptanceRobustnessContract, {
    themes: ["deep-ocean", "aurora-purple", "cloud-white"],
    densities: ["standard", "compact"],
    smallestWidth: 320,
    zoomStress: "component-css-zoom-200",
  });
});

test("P49 robustness CSS is token-based, isolated, responsive, and focus-safe", () => {
  const css = postcss.parse(read(cssFile));
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(
        selector.includes("body.p49-acceptance-robustness-review"),
        `unscoped selector: ${selector}`,
      );
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  for (const marker of [
    "var(--so-info)",
    "var(--so-panel)",
    "var(--so-text)",
    'html[data-density="compact"]',
    'html[data-p49-zoom="200"]',
    "@media (max-width: 760px)",
    "@media (pointer: coarse)",
    "@media (forced-colors: active)",
  ])
    assert.ok(text.includes(marker), marker);
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(text), false, "review CSS must not hardcode theme colors");
  assert.equal(text.includes("outline: none"), false);
});

test("P49 historical robustness evidence binds every matrix run, token, and image", () => {
  const historical = acceptanceHistoricalCapture("robustness");
  assert.equal(read(`${root}/evidence.json`), historical.manifest);
  const evidence = JSON.parse(historical.manifest);
  assert.equal(evidence.kind, "P49-ACCEPTANCE-ROBUSTNESS-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.layoutMechanicalScan.status, "not_run");
  assert.equal(evidence.matrixCount, 40);
  assert.equal(evidence.runs.length, 40);
  assert.equal(evidence.screenshots.length, 42);
  assert.deepEqual(
    Object.keys(evidence.themeColors).sort(),
    [...acceptanceRobustnessContract.themes].sort(),
  );
  assert.equal(new Set(Object.values(evidence.themeColors).map((value) => value.info)).size, 3);
  assert.equal(new Set(Object.values(evidence.themeColors).map((value) => value.panel)).size, 3);
  assert.ok(Object.keys(evidence.sourceHashes).length >= 45);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(historical.source(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth, shot.file);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight, shot.file);
  }
  assert.deepEqual(
    new Set(evidence.runs.map((run) => run.theme)),
    new Set(acceptanceRobustnessContract.themes),
  );
  assert.deepEqual(
    new Set(evidence.runs.map((run) => run.density)),
    new Set(acceptanceRobustnessContract.densities),
  );
  assert.equal(evidence.runs.filter((run) => run.kind === "theme-density").length, 24);
  assert.equal(evidence.runs.filter((run) => run.kind === "long-content").length, 4);
  assert.equal(evidence.runs.filter((run) => run.kind === "invalid-content").length, 4);
  assert.equal(evidence.runs.filter((run) => run.kind === "component-css-zoom-200").length, 2);
  assert.equal(evidence.runs.filter((run) => run.kind === "smallest-width").length, 3);
  assert.equal(evidence.runs.filter((run) => run.kind === "mobile-landscape").length, 3);
  for (const run of evidence.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("document has no horizontal overflow"), true);
    assert.equal(value("review root has no horizontal overflow"), true);
    assert.deepEqual(value("interactive labels are not clipped"), []);
    assert.equal(value("coarse pointer targets are at least 44px"), true);
    assert.deepEqual(value("no unknown network"), []);
    assert.equal(value("GET-only review"), false);
    assert.deepEqual(value("no page runtime errors"), []);
    assert.deepEqual(value("no console errors"), []);
  }
});
