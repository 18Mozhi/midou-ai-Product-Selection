import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  components = [
    "apps/web/src/components/ProviderSourceCenter.vue",
    "apps/web/src/components/ProviderSourceFilters.vue",
    "apps/web/src/components/ProviderSourceDirectory.vue",
  ],
  root = "output/playwright/p48-source-mobile-review";

test("P48 current mobile directory components compile and expose accessible controls", () => {
  const sources = new Map();
  for (const file of components) {
    const source = read(file),
      parsed = parse(source, { filename: file });
    assert.deepEqual(parsed.errors, [], file);
    compileScript(parsed.descriptor, { id: file });
    assert.deepEqual(
      compileTemplate({
        source: parsed.descriptor.template.content,
        filename: file,
        id: file,
      }).errors,
      [],
      file,
    );
    sources.set(file, source);
  }

  const page = sources.get(components[0]),
    filters = sources.get(components[1]),
    directory = sources.get(components[2]);
  assert.match(page, /ProviderSourceFilters/);
  assert.match(page, /ProviderSourceDirectory/);
  assert.match(filters, /class="source-filter-toggle"[\s\S]*?:aria-expanded="filtersExpanded"/);
  assert.match(filters, /aria-controls="source-filter-fields"/);
  assert.match(filters, /class="source-filter-fields"[\s\S]*'is-open': filtersExpanded/);
  assert.match(directory, /class="source-detail-trigger"[\s\S]*:aria-controls=/);
  assert.match(directory, /class="source-detail-back"[\s\S]*@click="closeDetail"/);
  assert.match(directory, /source-detail-back"\)\s*\?\.focus/);
  assert.match(directory, /if \(trigger\?\.isConnected\) trigger\.focus/);
});

test("P48 mobile review CSS is isolated and keeps explicit focus treatment", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-mobile-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p48-mobile-detail-review"), selector);
      assert.ok(selector.includes(".source-center"), selector);
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("max-height: min(48vh, 440px)"));
});

test("P48 archived mobile evidence remains internally intact and is clearly review-only", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-SOURCE-MOBILE-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 8);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    94,
  );
  assert.equal(evidence.screenshots.length, 24);
  assert.equal(evidence.comparisons.length, 4);
  assert.equal(Object.keys(evidence.sourceHashes).length, 172);
  for (const [file, expected] of Object.entries(evidence.sourceHashes)) {
    assert.ok(!file.startsWith("/") && !file.includes(".."), file);
    assert.match(expected, /^[a-f0-9]{64}$/i, file);
  }
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
  for (const comparison of evidence.comparisons) {
    assert.equal(comparison.sameSize, true);
    assert.equal(comparison.changedPixels, 0);
    assert.equal(comparison.maxChannelDelta, 0);
  }
  for (const run of evidence.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("one catalog GET"), 1);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    assert.equal(value("no horizontal overflow"), true);
    if (run.mode === "mobile" && run.width <= 760) {
      assert.equal(value("collapsed hides six selects"), 0);
      assert.equal(value("search remains visible"), true);
      assert.equal(value("result count remains visible"), true);
      assert.equal(value("filter toggle44"), true);
      assert.equal(value("expanded shows six selects"), 6);
      assert.equal(value("expanded fields are bounded"), true);
      assert.equal(value("only selected record remains"), 1);
      assert.equal(value("only selected group remains"), 1);
      assert.equal(value("detail preserves source facts"), 7);
      assert.equal(value("detail preserves original actions"), 3);
      assert.equal(value("back target44"), true);
      assert.equal(value("detail cycle adds no GET"), 1);
    }
  }
});
