import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { historicalProviderSummarySource } from "../../scripts/lib/ui-phase2-provider-summary-baseline.mjs";
import {
  historicalProviderIsolationSource,
  providerIsolationRevision,
} from "../../scripts/lib/ui-phase2-provider-isolation-baseline.mjs";

const read = (f) => historicalProviderSummarySource(f, readFileSync(f, "utf8"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const file = providerIsolationRevision.file,
  source = read(file),
  old = historicalProviderIsolationSource(file, source);
const hook = "apps/web/src/use-provider-editor-isolation.ts",
  root = "output/playwright/p46-editor-isolation";
const evidence = (mode) => JSON.parse(read(`${root}/${mode}/evidence.json`));

test("P46 isolation connects two script lines only; model/template/styles/save/focus functions unchanged", () => {
  assert.equal(hash(source), providerIsolationRevision.after);
  assert.equal(hash(old), providerIsolationRevision.before);
  const importLine =
    'import { useProviderEditorIsolation } from "../use-provider-editor-isolation";\n';
  const callLine = "useProviderEditorIsolation(editorPanel, () => editorOpen.value);\n";
  assert.equal(source.split(importLine).length, 2);
  assert.equal(source.split(callLine).length, 2);
  assert.equal(source.replace(importLine, "").replace(callLine, ""), old);
  assert.equal(
    historicalProviderIsolationSource(file, source + "\n/* drift */"),
    source + "\n/* drift */",
  );
});

test("P46 actual App captures bind raw sources, mock network and all 80 formal PNGs", () => {
  for (const mode of ["baseline", "current"]) {
    const e = evidence(mode),
      dir = `${root}/${mode}`;
    assert.equal(e.kind, "P46-EDITOR-ISOLATION-r1");
    assert.equal(e.mode, mode);
    assert.equal(e.processesClosed, true);
    assert.equal(e.renderedRegistryHash, hash(mode === "baseline" ? old : source));
    assert.equal(e.checks.length, mode === "baseline" ? 193 : 228);
    assert.equal(e.observations.length, 70);
    assert.equal(e.screenshots.length, 40);
    assert.equal(Object.keys(e.sourceHashes).length, mode === "baseline" ? 164 : 165);
    for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
    assert.equal(Boolean(e.sourceHashes[hook]), mode === "current");
    assert.deepEqual(
      readdirSync(dir).sort(),
      [...e.screenshots.map((s) => s.file), "evidence.json", "index.html"].sort(),
    );
    for (const s of e.screenshots) {
      const bytes = readFileSync(`${dir}/${s.file}`);
      assert.equal(hash(bytes), s.sha256, s.file);
      assert.equal(bytes.readUInt32BE(16), s.width);
      assert.equal(bytes.readUInt32BE(20), s.height);
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

test("P46 open/pending/conflict/cached return reject background focus and restore previous state on close/leave", () => {
  const a = evidence("baseline"),
    b = evidence("current");
  assert.deepEqual(a.network, b.network);
  for (const [width, height] of [
    [390, 1000],
    [760, 1000],
    [761, 1000],
    [1440, 1000],
    [390, 568],
  ]) {
    const obs = (e, state) =>
      e.observations.find((o) => o.width === width && o.height === height && o.state === state);
    const check = (name) =>
      b.checks.find((c) => c.width === width && c.height === height && c.name === name)?.actual;
    for (const state of ["create", "history-return", "edit-handoff", "pending", "conflict"]) {
      assert.equal(obs(a, state).focusEscaped, true);
      assert.equal(obs(b, state).focusEscaped, false);
      assert.equal(obs(b, state).editorInert, false);
      assert.ok(obs(b, state).targets.every((t) => t.inert));
    }
    for (const state of [
      "create-close",
      "dynamic-close",
      "preexisting-close",
      "history-away",
      "history-return-close",
      "edit-close",
    ]) {
      assert.deepEqual(obs(b, state).inert, []);
      assert.equal(obs(b, state).overflow, "");
    }
    const wheel = obs(b, "scrim-wheel");
    assert.equal(wheel.afterY, wheel.beforeY);
    // Inspect post-paint geometry, not just the earlier JS scrollY snapshot.
    const layout = obs(b, "scrim-wheel-layout");
    assert.deepEqual(layout.afterGeometry, layout.beforeGeometry);
    assert.equal(check("editor content remains scrollable"), true);
    const oldWheel = obs(a, "scrim-wheel");
    if (width <= 760) assert.ok(oldWheel.afterY > oldWheel.beforeY);
    for (const name of [
      "cached return retains open editor",
      "create return focus",
      "edit returns record",
      "dynamic sibling inert",
    ]) {
      assert.equal(check(name), name === "cached return retains open editor" ? 1 : true);
    }
    assert.deepEqual(check("preexisting scroll declaration restored"), ["auto", "important"]);
    assert.equal(check("preexisting inert restored"), "retained-before-open");
    assert.equal(check("production body class"), null);
    assert.deepEqual(check("no unexpected requests"), []);
    const req = b.network.find((n) => n.width === width && n.height === height).requests;
    assert.equal(req.filter((r) => r.key.startsWith("PUT ")).length, 1);
    assert.equal(req.filter((r) => r.key.startsWith("GET ")).length, 3);
  }
});

function lifecycleHarness() {
  const handlers = {},
    observed = [];
  class Element {
    children = [];
    parentElement = null;
    attrs = new Map();
    tag;
    focused = 0;
    constructor(tag = "div") {
      this.tag = tag;
    }
    append(n) {
      if (n.parentElement)
        n.parentElement.children = n.parentElement.children.filter((x) => x !== n);
      this.children.push(n);
      n.parentElement = this;
    }
    getAttribute(k) {
      return this.attrs.get(k) ?? null;
    }
    setAttribute(k, v) {
      this.attrs.set(k, v);
    }
    removeAttribute(k) {
      this.attrs.delete(k);
    }
    set inert(v) {
      v ? this.setAttribute("inert", "") : this.removeAttribute("inert");
    }
    get inert() {
      return this.attrs.has("inert");
    }
    matches(s) {
      return s.split(",").includes(this.tag);
    }
    get isConnected() {
      let n = this;
      while (n) {
        if (n === body) return true;
        n = n.parentElement;
      }
      return false;
    }
    focus() {
      this.focused++;
    }
  }
  const values = new Map(),
    style = {
      getPropertyValue: (k) => values.get(k)?.[0] ?? "",
      getPropertyPriority: (k) => values.get(k)?.[1] ?? "",
      setProperty: (k, v, p = "") => values.set(k, [v, p]),
      removeProperty: (k) => values.delete(k),
    };
  const body = new Element("body"),
    app = new Element(),
    page = new Element(),
    layer = new Element(),
    panel = new Element("form"),
    background = new Element("button"),
    outside = new Element("button"),
    native = new Element("dialog");
  body.append(app);
  app.append(page);
  page.append(background);
  page.append(layer);
  layer.append(panel);
  body.append(outside);
  body.append(native);
  const exports = {};
  let open = false;
  const compiled = ts.transpileModule(read(hook), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      assert.equal(name, "vue");
      return {
        watch: (_s, cb) => (handlers.watch = cb),
        onActivated: (cb) => (handlers.activate = cb),
        onDeactivated: (cb) => (handlers.deactivate = cb),
        onBeforeUnmount: (cb) => (handlers.unmount = cb),
      };
    },
    HTMLElement: Element,
    document: { body, documentElement: { style } },
    MutationObserver: class {
      constructor(cb) {
        this.callback = cb;
        this.closed = false;
        observed.push(this);
      }
      observe() {}
      disconnect() {
        this.closed = true;
      }
    },
  });
  exports.useProviderEditorIsolation({ value: panel }, () => open);
  return {
    handlers,
    observed,
    body,
    page,
    panel,
    background,
    outside,
    native,
    style,
    Element,
    setOpen: (v) => {
      open = v;
      handlers.watch();
    },
  };
}

test("P46 hook callbacks clean up on deactivate/unmount, reinstate on activate and disconnect observers", () => {
  const h = lifecycleHarness();
  h.background.setAttribute("inert", "before");
  h.style.setProperty("overflow", "auto", "important");
  h.setOpen(true);
  assert.equal(h.outside.inert, true);
  assert.equal(h.native.inert, false);
  assert.equal(h.panel.inert, false);
  h.handlers.deactivate();
  assert.equal(h.outside.inert, false);
  assert.equal(h.background.getAttribute("inert"), "before");
  assert.equal(h.style.getPropertyPriority("overflow"), "important");
  assert.equal(h.observed[0].closed, true);
  h.handlers.activate();
  assert.equal(h.outside.inert, true);
  assert.equal(h.panel.focused, 1);
  h.handlers.unmount();
  assert.equal(h.outside.inert, false);
  assert.equal(h.background.getAttribute("inert"), "before");
  assert.equal(h.observed.at(-1).closed, true);
  assert.equal(h.style.getPropertyValue("overflow"), "auto");
});

test("P46 hook restores moved nodes, tracks new siblings and preserves a different later overflow declaration", () => {
  const h = lifecycleHarness();
  h.setOpen(true);
  h.panel.append(h.outside);
  h.observed.at(-1).callback();
  assert.equal(h.outside.inert, false);
  const later = new h.Element("button");
  h.body.append(later);
  h.observed.at(-1).callback();
  assert.equal(later.inert, true);
  h.style.setProperty("overflow", "clip", "important");
  h.setOpen(false);
  assert.equal(later.inert, false);
  assert.equal(h.style.getPropertyValue("overflow"), "clip");
  assert.equal(h.style.getPropertyPriority("overflow"), "important");
});
