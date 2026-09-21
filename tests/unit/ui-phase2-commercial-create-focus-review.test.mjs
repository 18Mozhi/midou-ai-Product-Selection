import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewCommercialCreateOutcome } from "../../scripts/lib/ui-phase2-commercial-create-outcome-preview.mjs";
import {
  previewCommercialCreateFocus,
  draftFocusBoundary,
} from "../../scripts/lib/ui-phase2-commercial-create-focus-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const component = "apps/web/src/components/CommercialOperationsCenter.vue";
const root = "output/playwright/p58-create-focus-review";
const source = read(component),
  preview = previewCommercialCreateFocus(source);
test("P58 strict focus proposal compiles and consists solely of local function plus dialog keydown", () => {
  const parsed = parse(preview);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p58-focus" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p58-focus",
    }).errors,
    [],
  );
  assert.equal(
    preview.replace(draftFocusBoundary, "").replace(' @keydown="keepDraftFocus"', ""),
    previewCommercialCreateOutcome(source),
  );
  assert.throws(() =>
    previewCommercialCreateFocus(
      source.replace(
        "const creatingPlan = ref(false);",
        'const creatingPlan = ref(false);\nconst draftFeedback = ref("");',
      ),
    ),
  );
});

function focusHarness() {
  const box = {
    document: { activeElement: null },
    getComputedStyle: (el) => ({ visibility: el.visibility ?? "visible" }),
  };
  class Element {
    tabIndex = 0;
    parentElement = null;
    disabled = false;
    hidden = false;
    visible = true;
    tagName = "BUTTON";
    children = [];
    constructor(name) {
      this.name = name;
    }
    focus(options) {
      this.lastFocusOptions = options;
      box.document.activeElement = this;
    }
    scrollIntoView(options) {
      this.lastScrollOptions = options;
    }
    matches(selector) {
      assert.equal(selector, ":disabled");
      return this.disabled;
    }
    closest() {
      for (let e = this; e; e = e.parentElement) if (e.hidden) return e;
      return null;
    }
    getClientRects() {
      return this.visible ? [{}] : [];
    }
    contains(el) {
      for (let e = el; e; e = e.parentElement) if (e === this) return true;
      return false;
    }
  }
  class Dialog extends Element {
    open = true;
    modal = true;
    nodes = [];
    heading = new Element("heading");
    matches(selector) {
      assert.equal(selector, ":modal");
      return this.modal;
    }
    querySelectorAll() {
      return this.nodes;
    }
    querySelector() {
      return this.heading;
    }
  }
  class Details extends Element {
    open = false;
  }
  box.HTMLDialogElement = Dialog;
  box.HTMLDetailsElement = Details;
  vm.runInNewContext(
    ts.transpileModule(draftFocusBoundary + "\nglobalThis.handle=keepDraftFocus;", {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    box,
  );
  const dialog = new Dialog("dialog"),
    first = new Element("first"),
    middle = new Element("middle"),
    last = new Element("last");
  dialog.nodes = [first, middle, last];
  for (const e of dialog.nodes) e.parentElement = dialog;
  const key = (props = {}) => {
    const event = {
      key: "Tab",
      currentTarget: dialog,
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
      ...props,
    };
    box.handle(event);
    return event;
  };
  return { box, Element, Details, dialog, first, middle, last, key };
}
test("focus boundary wraps only at edges, preserves normal keys and anchors all-disabled state", () => {
  const h = focusHarness(),
    { first, middle, last, dialog, box, key } = h;
  last.focus();
  assert.equal(key().prevented, true);
  assert.equal(box.document.activeElement, first);
  first.focus();
  assert.equal(key({ shiftKey: true }).prevented, true);
  assert.equal(box.document.activeElement, last);
  middle.focus();
  assert.equal(key().prevented, false);
  assert.equal(box.document.activeElement, middle);
  for (const props of [
    { key: "Enter" },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { isComposing: true },
    { defaultPrevented: true },
  ]) {
    last.focus();
    assert.equal(key(props).prevented, false);
    assert.equal(box.document.activeElement, last);
  }
  dialog.open = false;
  assert.equal(key().prevented, false);
  dialog.open = true;
  dialog.modal = false;
  assert.equal(key().prevented, false);
  dialog.modal = true;
  for (const el of dialog.nodes) el.disabled = true;
  assert.equal(key().prevented, true);
  assert.equal(box.document.activeElement, dialog.heading);
  assert.equal(dialog.heading.lastFocusOptions.preventScroll, true);
  assert.equal(dialog.heading.lastScrollOptions.block, "center");
  assert.equal(key({ shiftKey: true }).prevented, true);
  assert.equal(box.document.activeElement, dialog.heading);
});
test("focus candidates exclude invisible, inert-equivalent and closed-details content, then include expanded content", () => {
  const h = focusHarness(),
    { first, last, dialog, box, key, Element, Details } = h;
  const details = new Details("details"),
    summary = new Element("summary"),
    copy = new Element("copy");
  details.parentElement = dialog;
  summary.tagName = "SUMMARY";
  details.children = [summary, copy];
  summary.parentElement = details;
  copy.parentElement = details;
  const negative = new Element("negative"),
    hidden = new Element("hidden"),
    invisible = new Element("invisible"),
    collapsed = new Element("collapsed");
  negative.tabIndex = -1;
  hidden.hidden = true;
  invisible.visible = false;
  collapsed.visibility = "collapse";
  for (const el of [negative, hidden, invisible, collapsed]) el.parentElement = dialog;
  dialog.nodes = [first, last, summary, copy, negative, hidden, invisible, collapsed];
  summary.focus();
  assert.equal(key().prevented, true);
  assert.equal(box.document.activeElement, first);
  first.focus();
  key({ shiftKey: true });
  assert.equal(box.document.activeElement, summary);
  details.open = true;
  first.focus();
  key({ shiftKey: true });
  assert.equal(box.document.activeElement, copy);
  copy.disabled = true;
  first.focus();
  key({ shiftKey: true });
  assert.equal(box.document.activeElement, summary);
});
test("P58 focus evidence binds unchanged visual pairs, current sources, every control traversal and local network", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.kind, "P58-CREATE-FOCUS-REVIEW-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.userReview, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 6);
  assert.equal(
    e.runs.reduce((total, run) => total + run.checks.length, 0),
    597,
  );
  assert.equal(e.screenshots.length, 30);
  assert.equal(Object.keys(e.sourceHashes).length, 168);
  for (const file of [
    component,
    "apps/web/src/use-modal-dialog.ts",
    "scripts/verify-ui-phase2-commercial-create-focus.mjs",
    "scripts/lib/ui-phase2-commercial-create-focus-preview.mjs",
    "scripts/lib/ui-phase2-commercial-create-outcome-preview.mjs",
  ])
    assert.ok(e.sourceHashes[file], file);
  for (const [file, digest] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), digest, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const b = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(b), shot.sha256);
    assert.equal(b.readUInt32BE(16), shot.pixelWidth);
    assert.equal(b.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of e.runs) {
    const val = (name) => run.checks.find((c) => c.name === name)?.actual,
      isReview = run.mode === "review";
    for (const state of ["default", "error-collapsed", "error-expanded"]) {
      assert.equal(val(state + " reverse observed").tag, isReview ? "BUTTON" : "DIALOG");
      assert.equal(val(state + " forward observed").tag, isReview ? "BUTTON" : "BODY");
      assert.equal(val(state + " reverse wraps immediately"), isReview);
      assert.equal(val(state + " forward wraps immediately"), isReview);
      if (isReview)
        for (const direction of ["Tab", "Shift+Tab"]) {
          const n = state === "default" ? 10 : state === "error-collapsed" ? 11 : 12;
          for (let i = 1; i <= n * 2; i++)
            assert.equal(val(state + " " + direction + " step" + i), true);
        }
    }
    for (const direction of ["Tab", "Shift+Tab"])
      assert.equal(val("busy " + direction + " stays on heading"), isReview);
    for (const direction of ["Tab", "Shift+Tab"])
      assert.equal(val("busy " + direction + " observed").tag, isReview ? "H3" : "DIALOG");
    assert.equal(val("native initial focus observed").tag, "H3");
    assert.equal(val("reopen focus observed").tag, "H3");
    if (isReview)
      for (const direction of ["Tab", "Shift+Tab"])
        assert.equal(val("busy " + direction + " heading visible"), true);
    for (const name of [
      "native initial focus inside",
      "native top-layer retained",
      "pending Escape guard unchanged",
      "escape restores original trigger",
      "reopen focus stays inside",
      "cancel restores original trigger",
    ])
      assert.equal(val(name), true);
    assert.equal(val("busy all ten form controls disabled"), 10);
    assert.equal(val("one local rejected POST"), 1);
    assert.equal(val("one commercial GET"), 1);
    assert.deepEqual(val("no unexpected network"), []);
    assert.deepEqual(val("no runtime errors"), []);
    const posts = run.requests.filter((r) => r.key.startsWith("POST "));
    assert.equal(posts.length, 1);
    assert.ok(posts[0].idempotencyKey);
  }
  for (const width of [390, 760, 1440])
    for (const suffix of [
      "initial",
      "default-boundary",
      "busy-heading",
      "error-collapsed",
      "error-expanded",
    ]) {
      const pair = e.screenshots.filter((s) => s.width === width && s.suffix === suffix);
      assert.equal(pair.length, 2);
      assert.equal(pair[0].pixelWidth, pair[1].pixelWidth);
      assert.equal(pair[0].pixelHeight, pair[1].pixelHeight);
      // Only the same initial state is pixel-identical. Keyboard outcomes can change scroll/focus.
      if (suffix === "initial")
        assert.equal(pair[0].sha256, pair[1].sha256, `${width} initial visual unchanged`);
    }
});
