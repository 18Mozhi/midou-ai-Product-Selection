import { historicalAdapterCSource } from "../../scripts/lib/ui-phase2-adapter-c-baseline.mjs";
import { providerHistoricalCapture } from "../../scripts/lib/ui-phase2-provider-historical-capture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import postcss from "postcss";
import { historicalProviderFieldSource } from "../../scripts/lib/ui-phase2-provider-field-baseline.mjs";
import {
  historicalProviderStructureSource,
  providerStructureRevisions,
} from "../../scripts/lib/ui-phase2-provider-structure-baseline.mjs";

// This suite binds the immutable structure-only capture before field semantics.
const read = (f) =>
  historicalProviderFieldSource(f, historicalAdapterCSource(f, readFileSync(f, "utf8")));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const file = "apps/web/src/components/ProviderRegistry.vue";
const original = providerHistoricalCapture("structure-current");
const current = original.source(file);
const styleImport = '<style src="../styles/provider-approved-structure.css"></style>\n';
const style = "apps/web/src/styles/provider-approved-structure.css";
const folder = "output/playwright/p46-approved-structure-implementation";
const captured = (mode) => providerHistoricalCapture(`structure-${mode}`);
const evidence = (mode) => captured(mode).evidence;

test("P46 structure adds only one stylesheet; template, script and contracts remain byte-identical", () => {
  assert.equal(current.split(styleImport).length, 2);
  assert.equal(current.replace(styleImport, ""), historicalProviderStructureSource(file, current));
  for (const r of providerStructureRevisions) {
    const source = original.source(r.file);
    assert.equal(hash(source), r.after);
    assert.equal(hash(historicalProviderStructureSource(r.file, source)), r.before);
    assert.equal(
      historicalProviderStructureSource(r.file, source + "\n/* drift */"),
      source + "\n/* drift */",
    );
  }
});

test("P46 structural CSS is gated by mounted Registry; mobile editor only, no preview/error/detail imports", () => {
  const importedPalette = '@import "../design/provider-registry-tokens.css";\n\n';
  assert.ok(read(style).startsWith(importedPalette));
  const css = read(style).replace(importedPalette, ""),
    root = postcss.parse(css);
  assert.doesNotMatch(
    css,
    /!important|@import|p46-\w+-review|assembly-disclaimer|provider-editor-message|provider-publish-preview/,
  );
  root.walkRules((r) => {
    assert.ok(r.selector.includes(":has(#app .provider-registry)"), r.selector);
    if (/provider-editor|provider-fields|provider-template-bar/.test(r.selector)) {
      let parent = r.parent,
        mobile = false;
      while (parent) {
        if (
          parent.type === "atrule" &&
          parent.name === "media" &&
          parent.params === "(max-width: 760px)"
        )
          mobile = true;
        parent = parent.parent;
      }
      assert.equal(mobile, true, r.selector);
    }
  });
  const palette = read("apps/web/src/design/provider-registry-tokens.css");
  assert.match(palette, /html:has\(#app \.provider-registry\)/);
  assert.match(palette, /--p46-accent: #294caf/);
  assert.match(css, /strong:not\(\.role-signal-status\)/);
  assert.match(css, /grid-template-columns: 220px minmax\(0, 1fr\)/);
  assert.match(css, /max-width: 1100px/);
  assert.match(css, /max-width: 840px/);
  assert.doesNotMatch(css, /--so-(?:primary|bg|panel|text|success|warning|danger):/);
});

test("P46 original before and implemented entry captures bind historical raw sources and PNG inventory", () => {
  for (const mode of ["baseline", "current"]) {
    const e = evidence(mode),
      dir = folder + "/" + mode;
    assert.equal(e.kind, "P46-APPROVED-STRUCTURE-IMPLEMENTATION-r1");
    assert.equal(e.mode, mode);
    assert.equal(e.processesClosed, true);
    assert.equal(e.screenshots.length, 132);
    assert.equal(e.checks.length, mode === "baseline" ? 320 : 452);
    assert.equal(Object.keys(e.sourceHashes).length, mode === "baseline" ? 164 : 165);
    for (const [f, sha] of Object.entries(e.sourceHashes))
      assert.equal(hash(captured(mode).source(f)), sha, f);
    assert.equal(
      e.transformedRegistryHash,
      hash(mode === "baseline" ? current.replace(styleImport, "") : current),
    );
    assert.equal(Boolean(e.sourceHashes[style]), mode === "current");
    assert.deepEqual(
      captured(mode).files().sort(),
      [...e.screenshots.map((s) => s.file), "index.html", "evidence.json"].sort(),
    );
    for (const s of e.screenshots) {
      const bytes = captured(mode).image(s.file);
      assert.equal(hash(bytes), s.sha256, s.file);
      const observedWidth =
        mode === "baseline" && s.fullPage
          ? e.observations.find(
              (o) =>
                o.case === "baseline-width-observation" &&
                o.width === s.width &&
                o.state === s.state,
            ).scroll
          : s.width;
      assert.equal(bytes.readUInt32BE(16), observedWidth);
      assert.equal(bytes.readUInt32BE(20), s.height);
    }
  }
});

test("P46 removes original overflow without hiding historical failures; current keyboard and theme gates pass", () => {
  const a = evidence("baseline"),
    b = evidence("current");
  const overflow = a.observations.filter(
    (o) => o.case === "baseline-width-observation" && o.scroll > o.viewport + 1,
  );
  assert.deepEqual([...new Set(overflow.map((o) => o.width))], [761, 841]);
  for (const width of [390, 760, 761, 840, 841, 1440]) {
    const value = (name) => b.checks.find((c) => c.width === width && c.name === name)?.actual;
    assert.equal(value("no review body class"), null);
    assert.equal(value("no review disclaimer"), 0);
    assert.equal(value("no review stylesheet"), 0);
    for (const name of [
      "editor Tab remains inside",
      "Escape returns record",
      "create close returns trigger",
      "edit close returns record",
    ])
      assert.equal(value(name), true);
    for (const theme of ["deep-ocean", "aurora-purple", "cloud-white"])
      assert.equal(value("theme ID " + theme), theme);
    for (const c of b.checks.filter(
      (c) => c.width === width && c.name.endsWith("no horizontal overflow"),
    ))
      assert.equal(c.actual, true);
  }
  assert.deepEqual(
    a.observations.filter((o) => o.case === "network-and-focus"),
    b.observations.filter((o) => o.case === "network-and-focus"),
  );
  assert.deepEqual(
    a.observations.filter((o) => o.case === "theme"),
    b.observations.filter((o) => o.case === "theme"),
  );
});

test("P46 loaded stylesheet stops matching P47; original palette, layout and screenshots restore", () => {
  const a = evidence("baseline"),
    b = evidence("current");
  // Closed/offscreen SVGs can retain deferred computed values; compare painted SVGs here.
  // The actual opened menu below separately verifies the formerly offscreen controls.
  const painted = (o) => ({
    ...o,
    metrics: {
      ...o.metrics,
      svg: o.metrics.svg.filter(
        (s) =>
          s.width > 0 &&
          s.height > 0 &&
          s.x + s.width > 0 &&
          s.x < o.width &&
          s.y + s.height > 0 &&
          s.y < 1000,
      ),
    },
  });
  assert.deepEqual(
    a.observations.filter((o) => o.case === "p47-no-leak").map(painted),
    b.observations.filter((o) => o.case === "p47-no-leak").map(painted),
  );
  assert.deepEqual(
    a.observations.filter((o) => o.case === "p47-menu-no-leak"),
    b.observations.filter((o) => o.case === "p47-menu-no-leak"),
  );
  for (const s of b.screenshots.filter(
    (s) => s.state === "p47-no-leak" || s.state === "p47-menu-no-leak",
  ))
    assert.equal(s.sha256, a.screenshots.find((t) => t.file === s.file).sha256, s.file);
});
