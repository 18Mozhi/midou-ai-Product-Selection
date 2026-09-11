import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { parse as parseSfc } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { historicalProviderIsolationSource } from "../../scripts/lib/ui-phase2-provider-isolation-baseline.mjs";
import {
  historicalProviderFieldSource,
  providerFieldRevision,
} from "../../scripts/lib/ui-phase2-provider-field-baseline.mjs";

// Bind the immutable field-only capture, before modal isolation was connected.
const read = (f) => historicalProviderIsolationSource(f, readFileSync(f, "utf8"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const file = providerFieldRevision.file,
  source = read(file),
  old = historicalProviderFieldSource(file, source);
const root = "output/playwright/p46-field-semantics";
const evidence = (mode) => JSON.parse(read(`${root}/${mode}/evidence.json`));

test("P46 field changes preserve 111 paired PNGs exactly; one existing border has 50 low-level raster deltas", () => {
  const require = createRequire(import.meta.url);
  const { PNG } = require(
    path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
  );
  const a = evidence("baseline"),
    b = evidence("current");
  const differences = b.screenshots.filter(
    (s) => s.sha256 !== a.screenshots.find((x) => x.file === s.file).sha256,
  );
  assert.deepEqual(
    differences.map((s) => s.file),
    ["760-step4-repaired.png"],
  );
  const file = differences[0].file;
  const before = PNG.sync.read(readFileSync(`${root}/baseline/${file}`)),
    after = PNG.sync.read(readFileSync(`${root}/current/${file}`));
  assert.deepEqual([before.width, before.height], [after.width, after.height]);
  let pixels = 0,
    maximum = 0,
    minX = before.width,
    minY = before.height,
    maxX = 0,
    maxY = 0;
  for (let i = 0; i < before.data.length; i += 4) {
    let changed = false;
    for (let k = 0; k < 4; k++) {
      const d = Math.abs(before.data[i + k] - after.data[i + k]);
      maximum = Math.max(maximum, d);
      changed ||= d > 0;
    }
    if (changed) {
      pixels++;
      const x = (i / 4) % before.width,
        y = Math.floor(i / 4 / before.width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  assert.deepEqual([pixels, maximum, minX, minY, maxX, maxY], [50, 2, 33, 399, 726, 501]);
});

test("P46 field semantics change only field-name spans and error ARIA; scripts/styles/events/models unchanged", () => {
  assert.equal(hash(source), providerFieldRevision.after);
  assert.equal(hash(old), providerFieldRevision.before);
  assert.equal(
    historicalProviderFieldSource(file, source + "\n/* drift */"),
    source + "\n/* drift */",
  );
  const before = parseSfc(old).descriptor,
    after = parseSfc(source).descriptor;
  assert.equal(after.scriptSetup.content, before.scriptSetup.content);
  assert.deepEqual(
    after.styles.map((s) => [s.attrs, s.content]),
    before.styles.map((s) => [s.attrs, s.content]),
  );
  let spans = 0,
    invalid = 0,
    described = 0,
    names = 0,
    errors = 0;
  const tree = (node, strip) => {
    if (node.type === 2)
      return node.content.trim() ? { text: node.content.replace(/\s+/g, " ").trim() } : null;
    if (node.type === 5) return { interpolation: node.content.content.trim() };
    if (node.type === 3) return { comment: node.content };
    const children = (node.children ?? []).flatMap((n) => {
      const result = tree(n, strip);
      return result ? (Array.isArray(result) ? result : [result]) : [];
    });
    if (node.type === 0) return children;
    assert.equal(node.type, 1);
    if (
      strip &&
      node.tag === "span" &&
      node.props.some(
        (p) => p.name === "id" && /^provider-field-\w+-label$/.test(p.value?.content ?? ""),
      )
    ) {
      spans++;
      return children;
    }
    const props = node.props
      .filter((p) => {
        if (!strip) return true;
        if (
          p.type === 6 &&
          p.name === "aria-labelledby" &&
          /^provider-field-\w+-label$/.test(p.value.content)
        ) {
          names++;
          return false;
        }
        if (p.type === 6 && p.name === "id" && /^provider-field-\w+-error$/.test(p.value.content)) {
          errors++;
          return false;
        }
        if (p.type === 7 && p.name === "bind" && p.arg?.content === "aria-invalid") {
          assert.match(p.exp.content, /^Boolean\(formErrors\.\w+\)$/);
          invalid++;
          return false;
        }
        if (p.type === 7 && p.name === "bind" && p.arg?.content === "aria-describedby") {
          assert.match(
            p.exp.content.trim(),
            /^formErrors\.\w+\s+\?\s+'provider-field-\w+-error'\s+:\s+undefined$/,
          );
          described++;
          return false;
        }
        return true;
      })
      .map((p) =>
        p.type === 6
          ? { name: p.name, value: p.value?.content }
          : {
              directive: p.name,
              arg: p.arg?.content,
              exp: p.exp?.content,
              modifiers: p.modifiers.map((m) => m.content),
            },
      );
    return { tag: node.tag, props, children };
  };
  assert.deepEqual(
    tree(baseParse(after.template.content), true),
    tree(baseParse(before.template.content), false),
  );
  assert.deepEqual(
    { spans, invalid, described, names, errors },
    { spans: 23, invalid: 20, described: 20, names: 23, errors: 20 },
  );
});

test("P46 field evidence binds raw current source and every retained image; old source only in baseline renderer", () => {
  for (const mode of ["baseline", "current"]) {
    const e = evidence(mode),
      dir = `${root}/${mode}`;
    assert.equal(e.kind, "P46-FIELD-SEMANTICS-r1");
    assert.equal(e.mode, mode);
    assert.equal(e.processesClosed, true);
    assert.equal(e.renderedRegistryHash, hash(mode === "baseline" ? old : source));
    for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
    assert.equal(e.observations.length, 276);
    assert.equal(e.screenshots.length, 112);
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
      "provider-approved-structure.css",
    ])
      assert.ok(
        Object.keys(e.sourceHashes).some((f) => f.endsWith("/" + suffix)),
        suffix,
      );
  }
});

test("P46 all 20 error cases clear their description after repair; 23 names remain independent of errors", () => {
  const a = evidence("baseline"),
    b = evidence("current");
  const semanticsFree = (e) => e.observations.map(({ invalid, describedby, ax, ...o }) => o);
  assert.deepEqual(semanticsFree(a), semanticsFree(b));
  assert.deepEqual(a.network, b.network);
  for (const width of [390, 760, 761, 1440]) {
    const rows = b.observations.filter((o) => o.width === width);
    assert.equal(new Set(rows.map((o) => o.key)).size, 23);
    assert.equal(rows.filter((o) => o.phase === "invalid" && o.errorText).length, 20);
    assert.equal(rows.filter((o) => o.phase === "repaired" && o.errorText).length, 0);
    for (const o of rows) {
      assert.equal(o.describedby, o.errorText ? `provider-field-${o.key}-error` : null);
      if (o.errorText) assert.equal(o.invalid, "true");
      else assert.ok(o.invalid === "false" || o.invalid === null);
    }
    const result = (name) => b.checks.find((c) => c.width === width && c.name === name)?.actual;
    assert.equal(result("close restores trigger"), true);
    assert.equal(result("all repaired permits submit"), true);
    assert.deepEqual(result("no unexpected network"), []);
    assert.equal(result("no review body marker"), null);
    assert.ok(b.network.find((n) => n.width === width).requests.every((r) => r.startsWith("GET ")));
  }
});
