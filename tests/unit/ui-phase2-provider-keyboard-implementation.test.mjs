import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { historicalProviderStructureSource } from "../../scripts/lib/ui-phase2-provider-structure-baseline.mjs";
import {
  historicalProviderKeyboardSource,
  providerKeyboardRevisions,
} from "../../scripts/lib/ui-phase2-provider-keyboard-baseline.mjs";
import { providerPagePreview } from "../../scripts/lib/ui-phase2-provider-page-preview.mjs";

// Preserve the keyboard-only capture; the structure suite binds raw current sources.
const read = (f) => historicalProviderStructureSource(f, readFileSync(f, "utf8"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const file = "apps/web/src/components/ProviderRegistry.vue";
const current = read(file);
const folder = "output/playwright/p46-editor-keyboard-implementation";
const e = JSON.parse(read(folder + "/evidence.json"));

test("P46 keyboard patch changes only local Tab handler, event and fallback tabindex", () => {
  const a = parse(current).descriptor,
    b = parse(historicalProviderKeyboardSource(file, current)).descriptor;
  const script = a.scriptSetup.content;
  const from = script.indexOf("function containEditorTab("),
    to = script.indexOf("function closeEditor()", from);
  assert.ok(from > 0 && to > from);
  assert.equal(script.slice(0, from) + script.slice(to), b.scriptSetup.content);
  assert.equal(
    a.template.content
      .replace('        tabindex="-1"\n', "")
      .replace('        @keydown="containEditorTab"\n', ""),
    b.template.content,
  );
  assert.deepEqual(
    a.styles.map((s) => [s.src, s.content, s.attrs]),
    b.styles.map((s) => [s.src, s.content, s.attrs]),
  );
  const handler = script.slice(from, to);
  for (const fragment of [
    "event.defaultPrevented",
    "event.ctrlKey",
    "event.metaKey",
    "event.shiftKey",
    "element.tabIndex >= 0",
    'element.matches(":disabled")',
    'element.closest("[inert]")',
    "visibilityProperty: true",
    "panel.focus()",
    "first.focus()",
    "last.focus()",
  ])
    assert.ok(handler.includes(fragment), fragment);
});

test("P46 exact historical adapter rejects unknown drift and preserves approved evidence", () => {
  for (const r of providerKeyboardRevisions) {
    const source = read(r.file);
    assert.equal(hash(source), r.after);
    assert.equal(hash(historicalProviderKeyboardSource(r.file, source)), r.before);
    assert.equal(
      historicalProviderKeyboardSource(r.file, source + "\n/* drift */"),
      source + "\n/* drift */",
    );
  }
  const old = JSON.parse(read("output/playwright/p46-route-assembly-review/evidence.json"));
  assert.equal(old.checks.length, 232);
  assert.equal(
    old.observations
      .filter((o) => o.case === "network-and-focus")
      .every((o) => o.focus[0].inside === false),
    true,
  );
});

test("P46 current keyboard capture binds raw sources and separate 104-image manifest", () => {
  assert.equal(e.kind, "P46-EDITOR-KEYBOARD-IMPLEMENTATION-r1");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 388);
  assert.equal(e.screenshots.length, 104);
  assert.equal(Object.keys(e.sourceHashes).length, 168);
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
  assert.equal(e.transformedRegistryHash, hash(providerPagePreview(current)));
  assert.deepEqual(
    readdirSync(folder).sort(),
    [...e.screenshots.map((s) => s.file), "index.html", "evidence.json"].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(folder + "/" + s.file);
    assert.equal(hash(bytes), s.sha256, s.file);
    assert.equal(bytes.readUInt32BE(16), s.width);
    assert.equal(bytes.readUInt32BE(20), s.height);
  }
});

test("P46 Tab cycles in both directions in all steps, pending and error states; Escape returns", () => {
  for (const width of [390, 760, 761, 840, 841, 1440]) {
    const value = (name) => e.checks.find((c) => c.width === width && c.name === name)?.actual;
    for (const label of [
      "create step1",
      "create step2",
      "create step3",
      "create step4",
      "edit step1",
      "pending save skips disabled submit",
      "conflict with collapsed technical details",
      "conflict with expanded technical details",
    ])
      for (const suffix of [" forward wraps", " reverse wraps", " middle moves normally"])
        assert.equal(value(label + suffix), true, width + label + suffix);
    for (const name of [
      "editor Tab remains inside",
      "Escape returns record",
      "create close returns trigger",
      "edit close returns record",
    ])
      assert.equal(value(name), true);
    const o = e.observations.find((o) => o.width === width && o.case === "network-and-focus");
    assert.equal(o.focus[0].inside, true);
    assert.equal(o.requests.length, 9);
    const writes = o.requests.filter((r) => r.method !== "GET");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "PUT");
    assert.equal(writes[0].status, 409);
  }
});
