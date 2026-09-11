import { historicalAdapterCSource } from "../../scripts/lib/ui-phase2-adapter-c-baseline.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import postcss from "postcss";
import { historicalProviderSummarySource } from "../../scripts/lib/ui-phase2-provider-summary-baseline.mjs";

const root = "output/playwright/p46-desktop-editor";
const preview =
  "design-plans/ui-phase-2-2026-09-07/implementation/provider-desktop-editor-preview.css";
const registry = "apps/web/src/components/ProviderRegistry.vue";
const read = (f) =>
  historicalProviderSummarySource(f, historicalAdapterCSource(f, readFileSync(f, "utf8")));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const evidence = (mode) => JSON.parse(read(`${root}/${mode}/evidence.json`));

test("P46 desktop review has no production import and every CSS rule is desktop and editor scoped", () => {
  assert.equal(
    hash(read(registry)),
    "b217ac9898675371d6a6b0406a2574784a7321fac93c233347299991289b0f8e",
  );
  postcss.parse(read(preview)).walkRules((rule) => {
    assert.equal(rule.parent.type, "atrule");
    assert.equal(rule.parent.name, "media");
    assert.match(rule.parent.params, /\(min-width: 761px\)/);
    for (const selector of rule.selectors) {
      assert.match(
        selector.replace(/\s+/g, " "),
        /^html body\.p46-desktop-editor-review #app \.provider-/,
      );
    }
  });
  for (const f of Object.keys(evidence("current").sourceHashes).filter((f) =>
    f.startsWith("apps/"),
  )) {
    assert.ok(!read(f).includes("provider-desktop-editor-preview"), f);
  }
});

test("P46 actual route evidence binds current raw source, all fields and every formal image", () => {
  for (const mode of ["baseline", "current"]) {
    const e = evidence(mode),
      dir = `${root}/${mode}`;
    assert.equal(e.kind, "P46-DESKTOP-EDITOR-REVIEW-r1");
    assert.equal(e.mode, mode);
    assert.equal(e.processesClosed, true);
    assert.equal(e.renderedRegistryHash, hash(read(registry)));
    assert.equal(e.observations.length, 345);
    assert.equal(e.screenshots.length, 75);
    for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
    assert.deepEqual(
      readdirSync(dir).sort(),
      [...e.screenshots.map((s) => s.file), "evidence.json", "index.html"].sort(),
    );
    for (const s of e.screenshots) {
      const bytes = readFileSync(`${dir}/${s.file}`);
      assert.equal(hash(bytes), s.sha256, s.file);
      assert.equal(bytes.readUInt32BE(16), s.pixelWidth);
      assert.equal(bytes.readUInt32BE(20), s.pixelHeight);
    }
    for (const suffix of [
      "App.vue",
      "NavigationShell.vue",
      "ProviderRuntimeSurface.vue",
      "ProviderRegistry.vue",
    ])
      assert.ok(Object.keys(e.sourceHashes).some((f) => f.endsWith("/" + suffix)));
  }
});

test("P46 visual review preserves field behavior, read-only fixtures and mobile screenshots", () => {
  const a = evidence("baseline"),
    b = evidence("current");
  assert.deepEqual(a.observations, b.observations);
  assert.deepEqual(a.network, b.network);
  for (const width of [390, 760, 761, 1024, 1440]) {
    const requests = b.network.find((n) => n.width === width).requests;
    assert.equal(requests.length, 2);
    assert.ok(requests.every((r) => r.startsWith("GET ")));
    const check = (name) => b.checks.find((c) => c.width === width && c.name === name)?.actual;
    assert.equal(check("close restores trigger"), true);
    assert.equal(check("successful next clears summary"), true);
    assert.deepEqual(check("no unexpected network"), []);
    assert.deepEqual(check("no browser errors"), []);
    for (let step = 1; step <= 4; step++) {
      assert.equal(check(`step${step} field Tab stays inside`), true);
      assert.equal(check(`step${step} dialog fits viewport`), true);
      if (width > 760) assert.equal(check(`step${step} responsive columns`), width < 1024 ? 1 : 2);
    }
  }
  const require = createRequire(import.meta.url);
  const { PNG } = require(
    path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
  );
  const deltas = {};
  for (const s of b.screenshots.filter((s) => s.width <= 760)) {
    if (s.sha256 === a.screenshots.find((x) => x.file === s.file).sha256) continue;
    const x = PNG.sync.read(readFileSync(`${root}/baseline/${s.file}`));
    const y = PNG.sync.read(readFileSync(`${root}/current/${s.file}`));
    assert.deepEqual([x.width, x.height], [y.width, y.height]);
    let pixels = 0,
      maximum = 0,
      minX = x.width,
      minY = x.height,
      maxX = 0,
      maxY = 0;
    for (let i = 0; i < x.data.length; i += 4) {
      let changed = false;
      for (let k = 0; k < 4; k++) {
        const difference = Math.abs(x.data[i + k] - y.data[i + k]);
        changed ||= difference > 0;
        maximum = Math.max(maximum, difference);
      }
      if (changed) {
        pixels++;
        const px = (i / 4) % x.width,
          py = Math.floor(i / 4 / x.width);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
    deltas[s.file] = [pixels, maximum, minX, minY, maxX, maxY];
  }
  // Bind observed raster deltas exactly, not a permissive percentage tolerance.
  assert.deepEqual(deltas, {
    "390-step1-repaired.png": [101, 2, 33, 538, 356, 834],
    "760-step1-invalid.png": [14, 1, 544, 10, 637, 11],
    "760-step1-repaired.png": [14, 1, 544, 10, 637, 11],
    "760-step2-invalid.png": [14, 1, 544, 10, 637, 11],
    "760-step2-repaired.png": [14, 1, 544, 10, 637, 11],
    "760-step3-invalid.png": [14, 1, 544, 10, 637, 11],
    "760-step3-repaired.png": [14, 1, 544, 10, 637, 11],
    "760-step4-invalid.png": [14, 1, 544, 10, 637, 11],
    "760-step4-repaired.png": [64, 2, 33, 10, 726, 501],
    "760-step1-ready.png": [39, 2, 33, 10, 637, 446],
    "760-step2-ready.png": [14, 1, 544, 10, 637, 11],
    "760-step3-ready.png": [14, 1, 544, 10, 637, 11],
    "760-step4-ready.png": [65, 2, 544, 10, 726, 970],
  });
});
