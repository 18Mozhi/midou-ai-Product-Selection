import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  previewAdapterReadError,
  readErrorTitle,
  readErrorDescription,
} from "../../scripts/lib/ui-phase2-adapter-read-error-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const root = "output/playwright/p47-read-error-current-review";
const historicalRoot = "output/playwright/p47-read-error-review";
const evidence = () => JSON.parse(read(`${root}/evidence.json`));
const reviewBaseline = () =>
  execFileSync("git", ["show", `90632224:${component}`], { encoding: "utf8" }).replaceAll(
    "\r\n",
    "\n",
  );

test("P47 read-error historical proposal only supplies two error-specific presentation props", () => {
  const original = reviewBaseline(),
    review = previewAdapterReadError(original);
  const additions =
    `      :title="state === 'error' ? '${readErrorTitle}' : ''"\n` +
    `      :description="state === 'error' ? '${readErrorDescription}' : ''"\n`;
  assert.equal(review.replace(additions, ""), original);
  const parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  assert.equal(
    parsed.descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p47-read-error",
    }).errors,
    [],
  );
  assert.throws(() =>
    previewAdapterReadError(original.replace(':kind="state"', ':kind="changed"')),
  );
  assert.throws(() => previewAdapterReadError(original + '\n      :kind="state"\n'));
  assert.ok(!original.includes(readErrorTitle));
});

test("P47 read-error visual rules cannot target other state panels or production pages", () => {
  const css = postcss.parse(
    read(
      "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-preview.css",
    ),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p47-read-error-review"));
      assert.ok(selector.includes(".adapter-center--c"));
      assert.ok(selector.includes('.ui-state-panel[data-kind="error"]'));
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
});

test("P47 read-error review retains its historical source manifest, pictures and neighboring states", () => {
  const e = evidence();
  assert.equal(e.kind, "P47-READ-ERROR-CURRENT-REVIEW-r1");
  assert.equal(e.userReview, "pending");
  assert.equal(e.historicalPackage, historicalRoot);
  assert.equal(e.reviewOnly, true);
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 30);
  assert.equal(e.screenshots.length, 30);
  for (const file of [
    "scripts/verify-ui-phase2-provider-adapter-read-error-current.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "apps/web/src/design/provider-adapter-tokens.css",
    "apps/web/src/design/provider-registry-tokens.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-current-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-preview.css",
  ])
    assert.ok(e.sourceHashes[file], file);
  for (const expected of Object.values(e.sourceHashes)) assert.match(expected, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  assert.equal(e.comparisons.length, 6);
  for (const comparison of e.comparisons) {
    assert.equal(comparison.sameSize, true);
    assert.ok(comparison.changedPixels <= 8);
    assert.ok(comparison.maxChannelDelta <= 1);
  }
  for (const run of e.runs) {
    const value = (name) => run.checks.find((c) => c.name === name)?.actual;
    const initialReads = run.scene === "blocked-unchanged" ? 3 : 1;
    assert.equal(value("original initial GET attempt count"), initialReads);
    assert.equal(value("explicit retry alone adds one GET"), initialReads + 1);
    assert.equal(value("no probe writes"), 0);
    assert.equal(value("keyboard retry target fits"), true);
    assert.equal(value("no page or panel horizontal overflow"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.mode === "review" && !run.scene.endsWith("unchanged"))
      assert.equal(value("trace labels preserve 13px floor"), true);
  }
});

test("P47 original read-error driver and review images remain immutable beside the current replay", () => {
  assert.equal(
    hash(read("scripts/verify-ui-phase2-provider-adapter-read-error.mjs")),
    "1799619b1e5fa42b8646971ca53310b49c2dbb675130e7999c5a454c1b4cfea1",
  );
  assert.equal(
    hash(read(`${historicalRoot}/evidence.json`)),
    "9ae95e9db43d145b995a74beb26940d6a2ec8555aaedf6e7e0111ecb1869492f",
  );
  const old = JSON.parse(read(`${historicalRoot}/evidence.json`));
  assert.equal(old.kind, "P47-READ-ERROR-REVIEW-r1");
  assert.equal(old.screenshots.length, 30);
  for (const shot of old.screenshots)
    assert.equal(hash(readFileSync(`${historicalRoot}/${shot.file}`)), shot.sha256, shot.file);
  for (const file of [
    "scripts/lib/ui-phase2-adapter-read-error-preview.mjs",
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-preview.css",
  ])
    assert.equal(hash(read(file)), old.sourceHashes[file], file);
});

test("P47 current error preview only raises its trace label to the existing 13px floor", () => {
  const css = postcss.parse(
    read(
      "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-current-preview.css",
    ),
  );
  const imports = [],
    rules = [];
  css.walkAtRules((rule) => imports.push([rule.name, rule.params]));
  assert.deepEqual(imports, [["import", '"./provider-adapters-read-error-preview.css"']]);
  css.walkRules((rule) => rules.push(rule));
  assert.equal(rules.length, 1);
  assert.equal(
    rules[0].selector.replace(/\s+/g, " "),
    'html body.p47-read-error-review:has(#app .adapter-center--c) #app .adapter-center--c .ui-state-panel[data-kind="error"] dt',
  );
  assert.deepEqual(
    rules[0].nodes.map((node) => [node.type, node.prop, node.value, Boolean(node.important)]),
    [["decl", "font-size", "13px", false]],
  );
});
