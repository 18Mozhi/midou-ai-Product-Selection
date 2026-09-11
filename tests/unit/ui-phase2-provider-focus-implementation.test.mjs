import { historicalAdapterCSource } from "../../scripts/lib/ui-phase2-adapter-c-baseline.mjs";
import test from "node:test";
import { historicalProviderAsyncSource } from "../../scripts/lib/ui-phase2-provider-async-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import {
  historicalProviderFocusSource,
  providerFocusRevision,
} from "../../scripts/lib/ui-phase2-provider-focus-baseline.mjs";

const read = (f) =>
  historicalProviderAsyncSource(f, historicalAdapterCSource(f, readFileSync(f, "utf8")));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const file = providerFocusRevision.file,
  current = read(file);
const original = historicalProviderFocusSource(file, current);
const root = "output/playwright/p46-provider-focus-implementation";
const evidence = (mode) => JSON.parse(read(root + "/" + mode + "/evidence.json"));
const script = (s) => parse(s).descriptor.scriptSetup.content;
function functionText(s, name) {
  const ast = ts.createSourceFile("registry.ts", script(s), ts.ScriptTarget.Latest, true);
  const matches = ast.statements.filter(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === name,
  );
  assert.equal(matches.length, 1, name);
  return matches[0].getText(ast);
}

test("P46 focus patch preserves the whole source outside close restoration and DOM identity", () => {
  assert.equal(hash(current), providerFocusRevision.after);
  assert.equal(hash(original), providerFocusRevision.before);
  const reverted = script(current)
    .replace("  registryRoot = ref<HTMLElement | null>(null),\n", "")
    .replace("let editorFocusGeneration = 0;\n", "")
    .replace("  editorFocusGeneration++;\n", "")
    .replace(functionText(current, "closeEditor"), functionText(original, "closeEditor"));
  assert.equal(reverted, script(original));
  const template = (s) => parse(s).descriptor.template.content.replace(/\s+/g, "");
  const restoredTemplate = current
    .replace(' ref="registryRoot"', "")
    .replace(' :data-provider-focus-id="item.id"', "")
    .replace(' :data-provider-focus-id="row.id"', "")
    .replace('@mousedown.self.prevent="closeEditor"', '@mousedown.self="closeEditor"');
  assert.equal(template(restoredTemplate), template(original));
  for (const name of ["save", "load", "applyTemplate", "resetFilters", "nextStep"])
    assert.equal(functionText(current, name), functionText(original, name));
  assert.equal((current.match(/v-model(?:\.[\w]+)?="form\./g) ?? []).length, 23);
  const cssFile = "apps/web/src/provider-registry.css",
    css = read(cssFile);
  assert.equal(
    css.replace(
      ".provider-registry .responsive-data-view__mobile article:focus-within {\n  overflow: visible;\n}\n",
      "",
    ),
    historicalProviderFocusSource(cssFile, css),
  );
});

test("P46 actual close function avoids hidden/disconnected/inert targets and newer dialogs", () => {
  const compiled = ts.transpileModule(functionText(current, "closeEditor"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const run = (setup = () => {}, after = () => {}) => {
    const focused = [],
      queue = [];
    const element = (name, extra = {}) => ({
      name,
      isConnected: true,
      visible: true,
      inert: false,
      disabled: false,
      dataset: {},
      matches(selector) {
        return selector === ":disabled" && this.disabled;
      },
      closest(selector) {
        return selector === "[inert]"
          ? this.inert
            ? this
            : null
          : selector === "button"
            ? this
            : null;
      },
      checkVisibility() {
        return this.visible;
      },
      focus(options) {
        focused.push({ name, options });
      },
      ...extra,
    });
    const row = element("selected", { dataset: { providerFocusId: "selected-id" } });
    const wrong = element("other", { dataset: { providerFocusId: "other-id" } });
    const trigger = element("trigger", { isConnected: false });
    const header = element("header"),
      empty = element("empty");
    const list = element("root", {
      querySelectorAll() {
        return [wrong, row];
      },
      querySelector(selector) {
        return selector.includes("empty") ? null : header;
      },
    });
    const box = {
      registryRoot: { value: list },
      editing: { value: { id: "selected-id" } },
      editorTrigger: { value: trigger },
      editorOpen: { value: true },
      message: { value: "old" },
      editorFocusGeneration: 2,
      document: { activeElement: element("body") },
      nextTick: (fn) => queue.push(fn),
      window: { requestAnimationFrame: (fn) => queue.push(fn) },
      row,
      wrong,
      trigger,
      header,
      empty,
      list,
    };
    setup(box);
    vm.runInNewContext(compiled + "\ncloseEditor();", box);
    assert.equal(box.editing.value, null);
    assert.equal(box.editorOpen.value, false);
    assert.equal(box.message.value, "");
    after(box);
    while (queue.length) queue.shift()();
    assert.ok(focused.every((f) => f.options === undefined));
    return focused.map((f) => f.name);
  };
  assert.deepEqual(run(), ["selected"]);
  assert.deepEqual(
    run((b) => {
      b.trigger.isConnected = true;
    }),
    ["trigger"],
  );
  assert.deepEqual(
    run((b) => {
      b.trigger.isConnected = true;
      b.trigger.visible = false;
    }),
    ["selected"],
  );
  assert.deepEqual(
    run((b) => {
      b.row.inert = true;
    }),
    ["header"],
  );
  assert.deepEqual(
    run((b) => {
      b.row.disabled = true;
    }),
    ["header"],
  );
  assert.deepEqual(
    run((b) => {
      b.list.querySelectorAll = () => [b.wrong];
    }),
    ["header"],
  );
  assert.deepEqual(
    run((b) => {
      b.editing.value = null;
      b.list.querySelector = (s) => (s.includes("empty") ? b.empty : b.header);
    }),
    ["empty"],
  );
  for (const change of [
    (b) => {
      b.list.visible = false;
    },
    (b) => {
      b.list.isConnected = false;
    },
    (b) => {
      b.list.inert = true;
    },
    (b) => {
      b.registryRoot.value = null;
    },
    (b) => {
      b.editorOpen.value = true;
    },
    (b) => {
      b.editorFocusGeneration++;
    },
    (b) => {
      b.document.activeElement.closest = () => ({});
    },
  ])
    assert.deepEqual(run(undefined, change), []);
});

test("P46 archived source mapping rejects unknown drift instead of masking it", () => {
  assert.equal(
    historicalProviderFocusSource(file, current + "\n/* drift */"),
    current + "\n/* drift */",
  );
  assert.equal(historicalProviderFocusSource("unrelated.vue", current), current);
  for (const group of ["page", "editor", "detail"]) {
    const old = JSON.parse(
      read("output/playwright/p46-provider-" + group + "-vue-preview/evidence.json"),
    );
    assert.equal(old.sourceHashes[file], hash(original));
  }
});

test("P46 historical focus evidence pins its original sources, comparisons and restoration", () => {
  for (const mode of ["baseline", "current"]) {
    const e = evidence(mode),
      directory = root + "/" + mode;
    assert.equal(e.kind, "P46-EDITOR-FOCUS-IMPLEMENTATION-r1");
    assert.equal(e.mode, mode);
    assert.equal(e.processesClosed, true);
    assert.equal(e.checks.length, mode === "baseline" ? 219 : 355);
    assert.equal(e.screenshots.length, 55);
    assert.equal(Object.keys(e.sourceHashes).length, 40);
    for (const [f, sha] of Object.entries(e.sourceHashes))
      assert.equal(
        hash(mode === "baseline" ? historicalProviderFocusSource(f, read(f)) : read(f)),
        sha,
        mode + ":" + f,
      );
    assert.deepEqual(
      readdirSync(directory).sort(),
      ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const s of e.screenshots) {
      const bytes = readFileSync(directory + "/" + s.file);
      assert.equal(hash(bytes), s.sha256);
      assert.equal(bytes.readUInt32BE(16), s.width);
      assert.equal(bytes.readUInt32BE(20), 900);
      if (mode === "current" && s.state === "default") {
        const before = evidence("baseline").screenshots.find((b) => b.file === s.file);
        if (s.sha256 !== before.sha256) {
          const review = JSON.parse(read(root + "/default-raster-review.json"));
          assert.equal(s.file, review.file);
          assert.equal(before.sha256, review.baselineSha256);
          assert.equal(s.sha256, review.currentSha256);
          const require = createRequire(import.meta.url);
          const { PNG } = require(
            path.join(
              path.dirname(require.resolve("playwright-core/package.json")),
              "lib/utilsBundle.js",
            ),
          );
          const a = PNG.sync.read(readFileSync(root + "/baseline/" + s.file)),
            b = PNG.sync.read(bytes);
          assert.deepEqual([a.width, a.height], review.dimensions);
          assert.deepEqual([b.width, b.height], review.dimensions);
          let pixels = 0,
            maximum = 0,
            minX = a.width,
            minY = a.height,
            maxX = 0,
            maxY = 0;
          for (let p = 0; p < a.width * a.height; p++) {
            let changed = false;
            for (let c = 0; c < 4; c++) {
              const delta = Math.abs(a.data[p * 4 + c] - b.data[p * 4 + c]);
              changed ||= delta !== 0;
              maximum = Math.max(maximum, delta);
            }
            if (changed) {
              pixels++;
              const x = p % a.width,
                y = Math.floor(p / a.width);
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          }
          assert.equal(pixels, review.changedPixels);
          assert.equal(maximum, review.maximumChannelDelta);
          assert.deepEqual([minX, minY, maxX, maxY], review.bounds);
        }
      }
    }
    assert.equal(e.observations.length, 8);
    for (const o of e.observations) {
      const value = (name) => {
        const c = e.checks.find(
          (c) => c.width === o.width && c.surface === o.surface && c.name === name,
        );
        assert.ok(c, name);
        return c.actual;
      };
      assert.deepEqual(o.errors, []);
      assert.deepEqual(o.unexpected, []);
      assert.equal(o.requests.length, 4);
      assert.ok(
        o.requests.every((r) => r.method === "GET" && r.path === "/api/v1/platform/providers"),
      );
      for (const kind of o.surface === "production" && o.width === 390
        ? ["button", "escape"]
        : ["button", "escape", "scrim"]) {
        assert.equal(
          value("record " + kind + " focus"),
          mode === "baseline" ? "BODY" : "00000000-0000-4000-8000-000000000819",
        );
        assert.equal(value("page two retained " + kind), true);
        if (mode === "current") assert.equal(value("record " + kind + " is button"), "BUTTON");
        if (mode === "current") assert.equal(value("record " + kind + " in viewport"), true);
      }
      assert.equal(
        value("resize focus"),
        mode === "baseline" ? "BODY" : "00000000-0000-4000-8000-000000000819",
      );
      assert.equal(value("removed row fallback"), mode === "baseline" ? "BODY" : "＋ 新建来源");
      assert.equal(
        value("empty create returns focus"),
        mode === "baseline" ? "BODY" : "登记第一个来源",
      );
      assert.equal(value("header create returns focus"), true);
      if (mode === "current") {
        assert.equal(value("resize target in viewport"), true);
        assert.equal(value("keyboard return focus visible"), true);
        assert.equal(value("keyboard outline style"), "solid");
        assert.equal(value("keyboard outline width"), true);
        if (o.width <= 760) assert.equal(value("mobile focus outline not clipped"), "visible");
      }
    }
  }
});
