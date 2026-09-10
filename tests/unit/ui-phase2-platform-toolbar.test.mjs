import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import postcss from "postcss";

const output = "output/playwright/p38-toolbar-compositions";
const style =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-overview-controls-preview.css";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const evidence = JSON.parse(read(`${output}/evidence.json`));
const prior = (file) =>
  execFileSync("git", ["show", `e845daca:${file}`], { encoding: "utf8" }).replaceAll("\r\n", "\n");

test("P38 toolbar binds actual Vue and fixture sources with 18 distinct state images", () => {
  for (const [file, fingerprint] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), fingerprint, file);
  assert.ok(evidence.sourceHashes["tests/e2e/m06-02-platform-dashboard.spec.ts"]);
  assert.equal(evidence.screenshots.length, 18);
  assert.deepEqual(
    readdirSync(output)
      .filter((file) => file.endsWith(".png"))
      .sort(),
    evidence.screenshots.map((s) => s.file).sort(),
  );
  for (const shot of evidence.screenshots) {
    const bytes = readFileSync(`${output}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(shot.kind, "vue-isolated");
    assert.equal(shot.buildSha, null);
    assert.equal(shot.sourceSha, hash(JSON.stringify(evidence.sourceHashes)));
    assert.deepEqual(shot.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
    assert.equal(new URL(shot.concreteUrl).hostname, "127.0.0.1");
    for (const key of ["artifactId", "role", "state", "theme", "font", "browser", "os", "caseId"])
      assert.ok(shot[key]);
  }
  for (const width of [390, 1440])
    assert.deepEqual(
      evidence.screenshots
        .filter((s) => s.viewport.width === width)
        .map((s) => s.state)
        .sort(),
      [
        "normal",
        "range-hover",
        "range-focus",
        "refresh-hover",
        "refresh-focus",
        "refresh-pressed",
        "refresh-loading",
        "refresh-failed",
        "range-7d",
      ].sort(),
    );
});

test("P38 toolbar styling remains state-only and review-scoped, without changing old layouts or production", () => {
  const allowed = new Set([
    "transition",
    "box-shadow",
    "transform",
    "background",
    "border-color",
    "color",
    "outline",
    "outline-offset",
  ]);
  postcss.parse(read(style)).walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.match(selector, /^body\.p38-vue-preview #app \.platform-dashboard-toolbar /);
    rule.walkDecls((decl) => {
      assert.ok(allowed.has(decl.prop), decl.prop);
      assert.equal(decl.important, undefined);
    });
  });
  assert.doesNotMatch(read(style), /@import|url\(|!important/);
  for (const file of [
    "apps/web/src/main.ts",
    "apps/web/src/components/PlatformDashboard.vue",
    "apps/web/src/components/ResponsiveDataView.vue",
    "apps/web/src/components/TableViewControls.vue",
    "apps/web/src/components/TechnicalDetails.vue",
    "apps/web/src/api-client.ts",
    "design-plans/ui-phase-2-2026-09-07/implementation/platform-overview-preview.css",
  ])
    assert.equal(read(file), prior(file), file);
  for (const directory of ["p38-vue-c-preview", "p38-provider-compositions"]) {
    const file = `output/playwright/${directory}/evidence.json`;
    assert.equal(read(file), prior(file));
    for (const shot of JSON.parse(read(file)).screenshots)
      assert.equal(hash(readFileSync(`output/playwright/${directory}/${shot.file}`)), shot.sha256);
  }
});

test("P38 toolbar verification separates local interaction, raster variance and user acceptance", () => {
  assert.equal(evidence.approval, "pending");
  assert.match(
    evidence.scope,
    /not native popup, full page, real RBAC\/API, MySQL or production acceptance/,
  );
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.checks.length, 20);
  for (const width of [390, 760, 761, 1440])
    assert.equal(evidence.checks.filter((check) => check.width === width).length, 5);
  assert.equal(evidence.disabledComparisons.length, 4);
  for (const item of evidence.disabledComparisons) {
    assert.equal(item.computedStylesIdentical, true);
    assert.notEqual(
      item.beforeSha256,
      item.afterSha256,
      "Do not claim disabled snapshots byte-identical",
    );
    assert.equal(item.maxChannelDelta, item.width === 1440 ? 1 : 2);
    assert.equal(item.changedPixels, { 390: 18, 760: 31, 761: 31, 1440: 20 }[item.width]);
  }
  const verifier = read("scripts/verify-ui-phase2-platform-toolbar.mjs");
  assert.match(verifier, /import Current from '\/src\/components\/PlatformDashboard.vue'/);
  assert.match(verifier, /toHaveCSS\("transform", "none"\)/);
  assert.match(verifier, /assert\.deepEqual\(await refresh\.boundingBox\(\), unpressed\)/);
  assert.match(verifier, /keyboard\.press\("ArrowDown"\)/);
});
