import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
  assert.equal(evidence.screenshots.length, 26);
  assert.deepEqual(
    readdirSync(output)
      .filter((file) => file.endsWith(".png"))
      .sort(),
    evidence.screenshots.map((s) => s.file).sort(),
  );
  for (const image of evidence.screenshots)
    assert.equal(hash(readFileSync(`${output}/${image.file}`)), image.sha256, image.file);
});

test("P38 review CSS is scoped; actual components and production entry remain unchanged", () => {
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
    "components/ResponsiveDataView.vue",
    "components/TableViewControls.vue",
    "components/TechnicalDetails.vue",
    "api-client.ts",
  ]) {
    const path = `apps/web/src/${file}`;
    assert.equal(
      read(path),
      execFileSync("git", ["show", `df4b7263:${path}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      ),
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
  assert.equal(evidence.checks.length, 16);
  for (const width of [390, 760, 761, 1440])
    assert.equal(evidence.checks.filter((c) => c.width === width).length, 4);
  assert.equal(evidence.observations.filter((c) => c.name.includes("403")).length, 4);
  assert.deepEqual(
    evidence.observations.filter((c) => c.name.includes("focus trap")).map((c) => c.width),
    [390, 760],
  );
});
