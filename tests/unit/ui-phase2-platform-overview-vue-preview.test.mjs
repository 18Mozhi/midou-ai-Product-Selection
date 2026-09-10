import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import postcss from "postcss";

const output = "output/playwright/p38-vue-c-preview";
const stylesheet =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-overview-preview.css";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const evidence = JSON.parse(read(`${output}/evidence.json`));

test("P38 actual Vue preview binds current source and every permanent review image", () => {
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.equal(evidence.screenshots.length, 42);
  assert.deepEqual(
    readdirSync(output)
      .filter((file) => file.endsWith(".png"))
      .sort(),
    evidence.screenshots.map((s) => s.file).sort(),
  );
  for (const image of evidence.screenshots)
    assert.equal(hash(readFileSync(`${output}/${image.file}`)), image.sha256, image.file);
});

test("P38 review CSS is scoped; dashboard template and unrelated shared components remain unchanged", () => {
  postcss.parse(read(stylesheet)).walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.match(
        selector,
        /^(?:html\[data-design="signal-ledger"\] )?body\.p38-vue-preview(?:[\s:#.]|$)/,
      );
  });
  assert.doesNotMatch(read(stylesheet), /!important|url\(|@import/);
  for (const file of [
    "main.ts",
    "components/PlatformDashboard.vue",
    "components/TableViewControls.vue",
    "api-client.ts",
  ]) {
    const path = `apps/web/src/${file}`;
    assert.equal(
      file === "components/PlatformDashboard.vue" ? read(path).split("</script>")[1] : read(path),
      execFileSync("git", ["show", `df4b7263:${path}`], { encoding: "utf8" })
        .replaceAll("\r\n", "\n")
        .split(file === "components/PlatformDashboard.vue" ? "</script>" : "\0")[
        file === "components/PlatformDashboard.vue" ? 1 : 0
      ],
      path,
    );
  }
  const verifier = read("scripts/verify-ui-phase2-platform-overview-vue-preview.mjs");
  assert.match(verifier, /import Current from '\/src\/components\/PlatformDashboard.vue'/);
  assert.doesNotMatch(verifier, /source\.replace|transform\(/);
});

test("P38 keeps actual interaction evidence separate from user and production acceptance", () => {
  assert.equal(evidence.approval, "pending");
  assert.match(evidence.scope, /no real API, MySQL, RBAC/);
  assert.match(evidence.scope, /writes view and audit/);
  assert.equal(evidence.checks.length, 36);
  for (const width of [390, 760, 761, 1440])
    assert.equal(evidence.checks.filter((c) => c.width === width).length, 9);
  assert.equal(evidence.observations.filter((c) => c.name.includes("403")).length, 4);
  assert.equal(evidence.observations.filter((c) => c.name.includes("focus trap")).length, 0);
  assert.deepEqual(
    evidence.checks.filter((c) => c.name.includes("modal focus trap")).map((c) => c.width),
    [390, 760],
  );
});

test("P38 image metadata identifies isolated environment without claiming a production build", () => {
  assert.equal(evidence.schemaVersion, 2);
  assert.match(evidence.sourceCommit, /^[a-f0-9]{40}$/);
  const sourceSha = hash(JSON.stringify(evidence.sourceHashes));
  assert.equal(new Set(evidence.screenshots.map((s) => s.artifactId)).size, 42);
  for (const shot of evidence.screenshots) {
    assert.equal(shot.kind, "vue-isolated");
    assert.equal(shot.routeId, "P38");
    assert.equal(shot.sourceSha, sourceSha);
    assert.equal(shot.buildSha, null);
    assert.match(shot.buildScope, /no production build/);
    assert.equal(new URL(shot.concreteUrl).hostname, "127.0.0.1");
    assert.equal(shot.viewport.width, shot.width);
    assert.equal(shot.viewport.height, 1000);
    assert.ok(Number.isFinite(Date.parse(shot.capturedAt)));
    for (const field of ["role", "state", "theme", "browser", "os", "font", "caseId"])
      assert.ok(shot[field], `${shot.file}:${field}`);
    const png = readFileSync(`${output}/${shot.file}`);
    assert.equal(shot.imageDimensions.width, png.readUInt32BE(16));
    assert.equal(shot.imageDimensions.height, png.readUInt32BE(20));
  }
});

test("P38 adds copy states with exact reviewed capture differences and explicit reproduced bugs", () => {
  const prior = JSON.parse(
    execFileSync("git", ["show", "d300d40b:output/playwright/p38-vue-c-preview/evidence.json"], {
      encoding: "utf8",
    }),
  );
  const review = JSON.parse(read(`${output}/capture-review.json`));
  assert.equal(review.approvedByUser, false);
  assert.equal(review.baselineCommit, "d300d40b");
  const require = createRequire(import.meta.url);
  const { PNG } = require(
    path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
  );
  const changed = [];
  for (const shot of prior.screenshots) {
    const current = evidence.screenshots.find((s) => s.file === shot.file);
    if (current?.sha256 === shot.sha256) continue;
    changed.push(shot.file);
    const reviewed = review.differences.find((s) => s.file === shot.file);
    assert.ok(reviewed, `unreviewed drift ${shot.file}`);
    assert.equal(shot.sha256, reviewed.beforeSha256);
    assert.equal(current.sha256, reviewed.afterSha256);
    const a = PNG.sync.read(execFileSync("git", ["show", `d300d40b:${output}/${shot.file}`]));
    const b = PNG.sync.read(readFileSync(`${output}/${shot.file}`));
    assert.deepEqual([a.width, a.height], reviewed.dimensions);
    assert.deepEqual([b.width, b.height], reviewed.dimensions);
    let pixels = 0,
      delta = 0;
    for (let p = 0; p < a.width * a.height; p++) {
      let different = false;
      for (let c = 0; c < 4; c++) {
        const difference = Math.abs(a.data[p * 4 + c] - b.data[p * 4 + c]);
        if (difference) different = true;
        delta = Math.max(delta, difference);
      }
      if (different) pixels++;
    }
    assert.equal(pixels, reviewed.changedPixels);
    assert.equal(delta, reviewed.maxChannelDelta);
  }
  assert.ok(changed.every((file) => review.differences.some((s) => s.file === file)));
  for (const name of [
    "technical-summary-focus",
    "technical-open",
    "technical-copy-focus",
    "technical-copy-hover",
    "technical-copy-pressed",
    "technical-copy-success",
    "failure-technical-open",
  ]) {
    assert.deepEqual(
      evidence.screenshots.filter((s) => s.state === name).map((s) => s.width),
      [390, 1440],
    );
  }
  for (const prefix of ["Clipboard denial"]) {
    assert.deepEqual(
      evidence.checks.filter((s) => s.name.startsWith(prefix)).map((s) => s.width),
      [390, 760, 761, 1440],
    );
  }
  assert.match(evidence.scope, /local success\/rejection adapter/);
  assert.match(evidence.scope, /synthetic same-route entry/);
  for (const prefix of ["Actual browser Back", "Held read"]) {
    assert.deepEqual(
      evidence.checks.filter((s) => s.name.startsWith(prefix)).map((s) => s.width),
      [390, 760, 761, 1440],
    );
  }
});
