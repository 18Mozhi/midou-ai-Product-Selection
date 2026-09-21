import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewTeamsVue, teamsVueFile } from "../../scripts/lib/ui-phase2-teams-vue-preview.mjs";
import {
  previewTeamsCreateFocus,
  teamsCreateFocusChanges,
} from "../../scripts/lib/ui-phase2-teams-create-focus-preview.mjs";

const source = readFileSync(teamsVueFile, "utf8").replaceAll("\r\n", "\n");
const revised = previewTeamsCreateFocus(source);
const script = parse(revised).descriptor.scriptSetup.content;
function functionSource(code, name) {
  const ast = ts.createSourceFile("teams.ts", code, ts.ScriptTarget.Latest, true);
  return ast.statements
    .find((n) => ts.isFunctionDeclaration(n) && n.name.text === name)
    .getText(ast);
}

test("creation focus preview compiles and is exactly reversible without changing writes or models", () => {
  const descriptor = parse(revised).descriptor;
  compileScript(descriptor, { id: "teams-focus" });
  assert.deepEqual(
    compileTemplate({
      id: "teams-focus",
      filename: teamsVueFile,
      source: descriptor.template.content,
    }).errors,
    [],
  );
  let reverse = revised;
  for (const [before, after] of [...teamsCreateFocusChanges].reverse()) {
    assert.equal(reverse.split(after).length, 2);
    reverse = reverse.replace(after, before);
  }
  assert.equal(reverse, previewTeamsVue(source));
  for (const name of ["submitCreate", "performMemberAction", "resetFilters"])
    assert.equal(
      functionSource(script, name),
      functionSource(parse(source).descriptor.scriptSetup.content, name),
    );
  assert.deepEqual(revised.match(/v-model="[^"]+"/g), source.match(/v-model="[^"]+"/g));
  assert.deepEqual(revised.match(/@[^\s=]+="[^"]+"/g), source.match(/@[^\s=]+="[^"]+"/g));
  assert.doesNotMatch(revised, /role="dialog"|aria-modal|tabindex="[1-9]/);
});

function harness() {
  const ticks = [],
    frames = [],
    focused = [];
  class Button {
    constructor(name) {
      this.name = name;
      this.isConnected = true;
      this.disabled = false;
    }
    focus() {
      focused.push(this.name);
    }
  }
  const overview = new Button("overview"),
    opener = new Button("opener"),
    input = {};
  const doc = { body: {}, activeElement: input };
  const state = {
    createBusy: { value: false },
    createOpen: { value: true },
    form: {
      value: {
        name: "name",
        lead_membership_id: "member",
        default_workflow_key: "flow",
        reason: "reason",
      },
    },
    createForm: {
      value: {
        contains: (node) => node === input,
        querySelector: (selector) => ({ focus: () => focused.push(selector) }),
      },
    },
    createTrigger: { value: opener },
    createOverviewTrigger: { value: overview },
    document: doc,
    HTMLButtonElement: Button,
    window: { requestAnimationFrame: (fn) => frames.push(fn) },
    nextTick: (fn) => {
      ticks.push(fn);
      return Promise.resolve();
    },
  };
  const js = ts.transpileModule(
    ["openCreate", "cancelCreate"].map((name) => functionSource(script, name)).join("\n"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const methods = new Function(...Object.keys(state), js + "\nreturn {openCreate,cancelCreate};")(
    ...Object.values(state),
  );
  return { state, ticks, frames, focused, overview, opener, doc, methods };
}

test("cancel returns to the actual opener only after inline form removal", () => {
  const h = harness();
  h.methods.cancelCreate();
  assert.equal(h.state.createOpen.value, false);
  assert.deepEqual(h.state.form.value, {
    name: "",
    lead_membership_id: "",
    default_workflow_key: "",
    reason: "",
  });
  assert.deepEqual(h.focused, []);
  h.doc.activeElement = h.doc.body;
  h.ticks.shift()();
  assert.deepEqual(h.focused, ["opener"]);
});

test("busy cancel remains a no-op with no scheduled focus", () => {
  const h = harness();
  h.state.createBusy.value = true;
  h.methods.cancelCreate();
  assert.equal(h.state.createOpen.value, true);
  assert.equal(h.state.form.value.name, "name");
  assert.equal(h.ticks.length, 0);
});

test("deferred cancel does not steal another control's focus", () => {
  const h = harness();
  h.methods.cancelCreate();
  h.doc.activeElement = {};
  h.ticks.shift()();
  assert.deepEqual(h.focused, []);
});

test("external-focus cancellation has no focus restoration", () => {
  const h = harness();
  h.doc.activeElement = {};
  h.methods.cancelCreate();
  h.doc.activeElement = h.doc.body;
  h.ticks.shift()();
  assert.deepEqual(h.focused, []);
});

test("removed opener falls back locally, while disabled or unmounted targets are not focused", () => {
  for (const mode of ["removed", "disabled", "unmounted"]) {
    const h = harness();
    if (mode === "disabled") h.opener.disabled = true;
    else h.opener.isConnected = false;
    if (mode === "unmounted") h.overview.isConnected = false;
    h.methods.cancelCreate();
    h.doc.activeElement = h.doc.body;
    h.ticks.shift()();
    assert.deepEqual(h.focused, mode === "removed" ? ["overview"] : []);
  }
});

test("opening records the event trigger and scoped input focus becomes harmless after unmount", () => {
  const h = harness();
  h.methods.openCreate({ currentTarget: h.overview });
  assert.equal(h.state.createTrigger.value, h.overview);
  h.frames.shift()();
  assert.deepEqual(h.focused, ["#team-name"]);
  h.methods.openCreate();
  h.state.createForm.value = null;
  assert.doesNotThrow(() => h.frames.shift()());
  assert.deepEqual(h.focused, ["#team-name"]);
});

test("unknown source drift is rejected and current production has no preview import", () => {
  assert.throws(
    () =>
      previewTeamsCreateFocus(
        source.replace("function cancelCreate()", "function changedCancel()"),
      ),
    /Inspect P33 creation focus anchor/,
  );
  assert.doesNotMatch(source, /createOverviewTrigger|createForm|teams-create-focus-preview/);
});

test("before/after packets bind every current source and all eight actual screenshots", () => {
  const dir = "output/playwright/p33-create-focus-r1";
  const hash = (input) => createHash("sha256").update(input).digest("hex");
  for (const revision of ["original", "revised"]) {
    const e = JSON.parse(readFileSync(`${dir}/${revision}-evidence.json`, "utf8"));
    assert.equal(e.reviewOnly, true);
    assert.equal(e.processesClosed, true);
    assert.equal(e.approval, "pending-user-review");
    assert.equal(e.focusRevision, revision);
    assert.deepEqual(
      e.runs.map((r) => r.width),
      [390, 840, 841, 1440],
    );
    assert.equal(e.focusScreenshots.length, 4);
    assert.equal(Object.keys(e.sourceHashes).length, 180);
    for (const [file, expected] of Object.entries(e.sourceHashes))
      assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), expected, file);
    for (const shot of e.focusScreenshots) {
      const bytes = readFileSync(`${dir}/${shot.file}`);
      assert.equal(hash(bytes), shot.sha256, shot.file);
      assert.equal(bytes.readUInt32BE(16), shot.width);
      assert.equal(bytes.readUInt32BE(20), 1000);
    }
    assert.equal(
      e.transformedHashes[teamsVueFile],
      hash(revision === "original" ? previewTeamsVue(source) : revised),
    );
    for (const run of e.runs) {
      assert.equal(run.checks.length, revision === "original" ? 55 : 60);
      assert.equal(run.requests.filter((r) => r.key === "GET /api/v1/org/admin/teams").length, 1);
      assert.ok(run.requests.every((r) => r.key.startsWith("GET ") && r.body === null));
    }
    assert.match(e.boundary, /OG-G02 remains/);
    assert.match(e.focusBoundary, /Original r4 layout and production untouched/);
  }
});

test("capture is exclusive and invalid arguments fail without starting a browser", () => {
  for (const arg of ["--capture", "--unknown"]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-teams-create-focus.mjs", arg],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    if (arg === "--capture") assert.match(result.stderr, /EEXIST/);
  }
});
