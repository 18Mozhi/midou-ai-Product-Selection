import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/ProviderSourceCenter.vue",
  directoryComponent = "apps/web/src/components/ProviderSourceDirectory.vue",
  filtersComponent = "apps/web/src/components/ProviderSourceFilters.vue",
  root = "output/playwright/p48-source-page-review";

test("P48 default-directory review keeps the actual ProviderSourceCenter contract", () => {
  const compileComponent = (file, id) => {
    const parsed = parse(read(file));
    assert.deepEqual(parsed.errors, [], file);
    compileScript(parsed.descriptor, { id });
    assert.deepEqual(
      compileTemplate({
        source: parsed.descriptor.template.content,
        filename: file,
        id,
      }).errors,
      [],
      file,
    );
    return parsed.descriptor.template.content;
  };
  const page = compileComponent(component, "p48-source-page"),
    directory = compileComponent(directoryComponent, "p48-source-directory"),
    filters = compileComponent(filtersComponent, "p48-source-filters");
  for (const preserved of [
    'class="source-center source-center--p48 novice"',
    "<ProviderSourceFilters",
    '@reset="resetFilters"',
    "<ProviderSourceDirectory",
    '@test="testSource"',
    '@edit="beginEdit"',
    '@compatibility="loadCompatibility"',
    '@versions="loadConfigurationVersions"',
    '@samples="openParserSamples"',
  ])
    assert.ok(page.includes(preserved), preserved);
  for (const preserved of [
    'aria-label="来源目录筛选"',
    'class="source-reset" @click="emit(\'reset\')"',
  ])
    assert.ok(filters.includes(preserved), preserved);
  for (const preserved of [
    'aria-label="按业务用途分组的热点来源"',
    'aria-label="热点来源分页"',
    "emit('test', item)",
    "emit('edit', item)",
    "emit('compatibility', item)",
    "emit('versions', item)",
    "emit('samples', item)",
  ])
    assert.ok(directory.includes(preserved), preserved);
});

test("P48 default-directory CSS cannot affect production or another page", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p48-source-page-review"), selector);
      assert.ok(selector.includes(".source-center"), selector);
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
});

test("P48 actual Vue evidence binds 146 rows, all controls, and every image", () => {
  const evidenceSource = read(`${root}/evidence.json`),
    evidence = JSON.parse(evidenceSource);
  assert.equal(
    hash(evidenceSource),
    "5937947b1df7b6f4cccf31424f5231a46733540453d222fb2b2e6c1948ba4ab9",
    "archived P48 review packet must remain immutable",
  );
  assert.equal(evidence.kind, "P48-SOURCE-PAGE-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 8);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    148,
  );
  assert.equal(evidence.screenshots.length, 48);
  assert.equal(Object.keys(evidence.sourceHashes).length, 62);
  for (const [file, expected] of Object.entries(evidence.sourceHashes)) {
    assert.match(expected, /^[a-f0-9]{64}$/i, file);
    assert.match(file, /\.(vue|ts|css|html|json|js|mjs)$/i, file);
  }
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("four global metrics"), 4);
    assert.equal(value("three help statements"), 3);
    assert.equal(value("seven labeled filters"), 7);
    assert.equal(value("page one has20 records"), 20);
    assert.equal(value("one catalog GET"), 1);
    assert.equal(value("first page range"), true);
    assert.equal(value("page two retains20 records"), 20);
    assert.equal(value("page two range"), true);
    assert.equal(value("pagination adds no GET"), 1);
    assert.equal(value("category filter adds no GET"), 1);
    assert.equal(value("reset restores page one"), null);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    assert.equal(value("no horizontal overflow"), true);
    if (run.mode === "review")
      for (const control of ["refresh", "manage", "search", "reset", "next"])
        assert.equal(value(`review target44 ${control}`), true);
  }
});
