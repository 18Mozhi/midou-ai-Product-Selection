import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import postcss from "postcss";

const base = "design-plans/ui-phase-2-2026-09-07/design/platform-overview-direction-c",
  proposal = "design-plans/ui-phase-2-2026-09-07/design/platform-overview-provider-detail",
  output = "output/playwright/p38-provider-compositions",
  read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n"),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  evidence = JSON.parse(read(`${output}/evidence.json`));

test("P38 detail proposal binds current sources and preserves original91 PNG and baseline manifest", () => {
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), sha, file);
  const original = JSON.parse(read(`${base}/evidence.json`));
  assert.equal(original.screenshots.length, 91);
  assert.equal(evidence.retainedOriginalImages, 91);
  assert.deepEqual(
    original.screenshots,
    JSON.parse(
      execFileSync(
        "git",
        ["show", `c380b995b3a6d55d7f1742dc42baf9479be0e8e7:${base}/evidence.json`],
        { encoding: "utf8" },
      ),
    ).screenshots,
  );
  for (const image of original.screenshots)
    assert.equal(hash(readFileSync(`${base}/${image.file}`)), image.sha256, image.file);
});

test("P38 sixteen local compositions have exact images and remain unapproved offline proposals", () => {
  const expected = [
    ...[
      "close-focus",
      "preview-collapsed",
      "preview-expanded",
      "technical-focus",
      "close-hover",
      "close-pressed",
      "unknown-expanded",
      "long-top",
      "long-bottom",
      "short-screen",
    ].map((s) => `390-${s}.png`),
    ...[
      "table-default",
      "columns-expanded",
      "last-column-disabled",
      "freeze-focus",
      "unfrozen",
      "compact",
    ].map((s) => `1440-${s}.png`),
  ];
  assert.deepEqual(evidence.screenshots.map((s) => s.file).sort(), expected.sort());
  assert.deepEqual(
    readdirSync(output)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    expected,
  );
  for (const image of evidence.screenshots)
    assert.equal(hash(readFileSync(`${output}/${image.file}`)), image.sha256, image.file);
  assert.equal(evidence.acceptanceComplete, false);
  assert.equal(evidence.userApproved, false);
  assert.equal(evidence.browserClosed, true);
});

test("P38 child styles are scoped to providers and preview without changing source controller or data", () => {
  const css = postcss.parse(read(`${proposal}/detail.css`));
  css.walkRules((rule) =>
    assert.ok(
      rule.selectors.every((selector) => /^(#providers|\.preview)/.test(selector)),
      rule.selector,
    ),
  );
  assert.doesNotMatch(css.toString(), /!important|url\(|@import/);
  const child = read(`${proposal}/detail.js`);
  assert.doesNotMatch(
    child,
    /fetch\(|localStorage|clipboard|provider_health\s*=|addEventListener\(/,
  );
  assert.match(child, /preview-title provider-name/);
  assert.match(child, /aria-describedby/);
  const html = read(`${proposal}/index.html`);
  assert.match(html, /\.\.\/platform-overview-direction-c\/data.js/);
  assert.match(html, /\.\.\/platform-overview-direction-c\/overview.js/);
  // ResponsiveDataView now has its own modal-focus runtime regression gate.
  for (const file of ["PlatformDashboard.vue", "TableViewControls.vue"]) {
    const path = `apps/web/src/components/${file}`;
    assert.equal(
      file === "PlatformDashboard.vue" ? read(path).split("</script>")[1] : read(path),
      execFileSync("git", ["show", `c380b995b3a6d55d7f1742dc42baf9479be0e8e7:${path}`], {
        encoding: "utf8",
      })
        .replaceAll("\r\n", "\n")
        .split(file === "PlatformDashboard.vue" ? "</script>" : "\0")[
        file === "PlatformDashboard.vue" ? 1 : 0
      ],
    );
  }
});

test("P38 browser evidence covers data, focus return, columns and non-target pixels with no HTTP", () => {
  assert.equal(evidence.checks.length, 28);
  for (const name of [
    "Tab and Shift+Tab wrap within modal",
    "Escape closes and restores original trigger",
    "Long identifiers wrap; short viewport retains visible close action",
    "Four source columns; last selected disabled; first visible column frozen",
    "Freeze and density are local display changes; no read intents",
  ])
    assert.equal(evidence.checks.filter((c) => c.name === name).length, 1, name);
  for (const name of [
    "Non-target attention region pixels unchanged",
    "No HTTP requests or browser errors",
  ])
    assert.deepEqual(
      evidence.checks.filter((c) => c.name === name).map((c) => c.width),
      [390, 1440],
    );
});
