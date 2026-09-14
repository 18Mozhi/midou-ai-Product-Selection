import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import {
  filterResetRevision,
  historicalFilterResetSource,
} from "../../scripts/lib/ui-phase2-filter-reset-baseline.mjs";
const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const capturedRevision = "01af02620bdbb751cc846e6a02081d4a0b735784";
const captured = (f, revision = capturedRevision) =>
  execFileSync("git", ["show", `${revision}:${f}`], { encoding: "utf8" }).replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const source = read(filterResetRevision.file);
const old = execFileSync(
  "git",
  ["show", `${filterResetRevision.baseline}:${filterResetRevision.file}`],
  { encoding: "utf8" },
).replaceAll("\r\n", "\n");
function watchCode(vueSource) {
  const ast = ts.createSourceFile(
    "source.ts",
    parse(vueSource).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const watchers = ast.statements.filter(
    (n) =>
      ts.isExpressionStatement(n) &&
      ts.isCallExpression(n.expression) &&
      n.expression.expression.getText(ast) === "watch",
  );
  assert.equal(watchers.length, 1);
  return watchers[0].getText(ast);
}
function fixture(options = {}) {
  class Button {
    disabled = false;
  }
  const focused = new Button(),
    body = {},
    other = {},
    closed = [];
  const state = {
    props: { activeCount: 1 },
    overlay: { value: true },
    open: { value: true },
    sheet: { value: { contains: (n) => n === focused } },
    closeButton: { value: { focus: () => closed.push("close") } },
    document: { activeElement: focused, body },
    HTMLButtonElement: Button,
  };
  let callback, release;
  const pending = new Promise((r) => (release = r));
  vm.runInNewContext(
    ts.transpileModule(watchCode(options.source ?? source), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { ...state, watch: (getter, fn) => (callback = fn), nextTick: () => pending },
  );
  return { focused, body, other, closed, state, release, callback, ...options };
}
test("archived reset repair preserves its original template/styles and exact captured revision", () => {
  const repaired = captured(filterResetRevision.file);
  assert.equal(hash(old), filterResetRevision.before);
  assert.equal(hash(repaired), filterResetRevision.after);
  assert.equal(parse(repaired).descriptor.template.content, parse(old).descriptor.template.content);
  assert.deepEqual(
    parse(repaired).descriptor.styles.map((s) => s.content),
    parse(old).descriptor.styles.map((s) => s.content),
  );
  assert.equal(historicalFilterResetSource(filterResetRevision.file, repaired), old);
  assert.throws(() =>
    historicalFilterResetSource(filterResetRevision.file, repaired + "\n// unknown"),
  );
  // This historical adapter must not silently bless the later appearance/ARIA revision.
  assert.notEqual(hash(source), filterResetRevision.after);
  assert.throws(() => historicalFilterResetSource(filterResetRevision.file, source));
});
for (const active of ["body", "same"]) {
  test(`cleared reset disabled with ${active} focus returns to close`, async () => {
    const f = fixture();
    const task = f.callback(0);
    f.focused.disabled = true;
    f.state.document.activeElement = active === "body" ? f.body : f.focused;
    f.release();
    await task;
    assert.deepEqual(f.closed, ["close"]);
  });
}
async function assertNoFocusSteal(kind, currentSource = source) {
  const f = fixture({ source: currentSource });
  if (kind === "desktop") f.state.overlay.value = false;
  if (kind === "closed") f.state.open.value = false;
  if (kind === "text-field") f.state.document.activeElement = {};
  if (kind === "outside") f.state.sheet.value.contains = () => false;
  const task = f.callback(kind === "nonzero" ? 1 : 0);
  f.focused.disabled = kind !== "still-enabled";
  if (kind === "new-focus") f.state.document.activeElement = f.other;
  if (kind === "closed-before-tick") f.state.open.value = false;
  if (kind === "desktop-before-tick") f.state.overlay.value = false;
  if (kind === "unmounted") f.state.closeButton.value = null;
  f.release();
  await task;
  assert.deepEqual(f.closed, []);
}
for (const kind of [
  "nonzero",
  "desktop",
  "closed",
  "text-field",
  "outside",
  "still-enabled",
  "new-focus",
  "closed-before-tick",
  "desktop-before-tick",
  "unmounted",
]) {
  test(`does not steal focus: ${kind}`, async () => {
    await assertNoFocusSteal(kind);
  });
}
test("current watcher tests reject missing disabled and post-tick lifecycle/focus guards", async () => {
  for (const [kind, before, after] of [
    ["still-enabled", "      focused.disabled &&\n", ""],
    ["closed-before-tick", "      open.value &&\n", ""],
    ["desktop-before-tick", "      overlay.value &&\n", ""],
    [
      "new-focus",
      "(document.activeElement === focused || document.activeElement === document.body)",
      "true",
    ],
  ]) {
    assert.equal(source.split(before).length, 2);
    await assert.rejects(() => assertNoFocusSteal(kind, source.replace(before, after)));
  }
});
test("archived baseline and repaired four-width packets bind their exact sources without claiming current capture", () => {
  for (const mode of ["baseline", "current"]) {
    const folder = `output/playwright/filter-reset-focus/${mode}`,
      e = JSON.parse(read(`${folder}/evidence.json`));
    assert.deepEqual(e, JSON.parse(captured(`${folder}/evidence.json`)));
    assert.equal(e.mode, mode === "baseline" ? "baseline-diagnosis" : "current-regression");
    assert.equal(
      e.sourceHashes[filterResetRevision.file],
      mode === "baseline" ? filterResetRevision.before : filterResetRevision.after,
    );
    assert.equal(e.checks.length, mode === "baseline" ? 76 : 80);
    assert.equal(e.screenshots.length, 8);
    assert.equal(e.processesClosed, true);
    for (const [file, sha] of Object.entries(e.sourceHashes))
      assert.equal(
        hash(
          captured(
            file,
            mode === "baseline" && file === filterResetRevision.file
              ? filterResetRevision.baseline
              : capturedRevision,
          ),
        ),
        sha,
        file,
      );
    assert.deepEqual(
      readdirSync(folder).sort(),
      ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const s of e.screenshots)
      assert.equal(hash(readFileSync(`${folder}/${s.file}`)), s.sha256);
    for (const width of [390, 760])
      for (const input of ["click", "keyboard"]) {
        assert.equal(
          e.checks.find((s) => s.width === width && s.name === `${input}:focus repaired`).actual,
          mode === "current",
        );
        assert.equal(
          e.checks.find((s) => s.width === width && s.name === `${input}:Escape closes`).actual,
          mode === "baseline" ? "true" : "false",
        );
      }
    assert.ok(
      e.observations.every(
        (o) => o.requests.length === 4 && o.errors.length === 0 && o.unexpected.length === 0,
      ),
    );
  }
});
