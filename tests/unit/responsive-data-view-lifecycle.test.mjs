import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
const file = "apps/web/src/components/ResponsiveDataView.vue";
const base = "3023a030";
const capturedRevision = "54ec47364b3422b1d49a6eea18f070229af56a59";
const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const previous = (f) =>
  execFileSync("git", ["show", `${base}:${f}`], {
    encoding: "utf8",
    maxBuffer: 20_000_000,
  }).replaceAll("\r\n", "\n");
const captured = (f) =>
  execFileSync("git", ["show", `${capturedRevision}:${f}`], {
    encoding: "utf8",
    maxBuffer: 20_000_000,
  }).replaceAll("\r\n", "\n");
function harness(source = read(file)) {
  const hooks = {},
    rows = [{ id: "first", name: "existing" }];
  const ast = ts.createSourceFile(
    "component.ts",
    parse(source).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const script = ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n");
  const box = {
    defineProps: () => ({ rows, rowKey: (r) => r.id }),
    shallowRef: (value) => ({ value }),
    computed: (fn) => ({
      get value() {
        return fn();
      },
    }),
    watch: () => {},
    onBeforeUnmount: (fn) => (hooks.unmount = fn),
    onDeactivated: (fn) => (hooks.deactivate = fn),
  };
  vm.runInNewContext(
    ts.transpileModule(
      script +
        ";globalThis.result={show,selectedKey,selected,background,getTrigger:()=>trigger,setObserver:(value)=>confirmationObserver=value,getObserver:()=>confirmationObserver}",
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    box,
  );
  return { h: box.result, hooks, rows };
}
function verifyCurrentDeactivation(source) {
  const { h, hooks, rows } = harness(source);
  let focus = 0,
    disconnected = 0;
  const trigger = { focus: () => focus++ },
    first = { inert: true },
    preInert = { inert: true };
  h.show(rows[0], { currentTarget: trigger });
  assert.equal(h.selected.value, rows[0]);
  assert.equal(focus, 1);
  h.background.set(first, false);
  h.background.set(preInert, true);
  h.setObserver({ disconnect: () => disconnected++ });
  hooks.deactivate();
  assert.equal(h.selectedKey.value, null);
  assert.equal(h.selected.value, null);
  assert.equal(h.getTrigger(), null);
  assert.equal(first.inert, false);
  assert.equal(preInert.inert, true);
  assert.equal(h.getObserver(), null);
  assert.equal(h.background.size, 0);
  assert.equal(disconnected, 1);
  assert.equal(focus, 1);
  hooks.deactivate();
  hooks.unmount();
  assert.equal(disconnected, 1);
  h.show(rows[0], { currentTarget: trigger });
  assert.equal(h.selected.value, rows[0]);
  assert.equal(focus, 2);
}
test("KeepAlive deactivation clears selected identity and stale trigger, restores exact inert values and disconnects observer", () => {
  verifyCurrentDeactivation(read(file));
});
test("current lifecycle behavior rejects missing hook, stale identity/trigger and missing background release", () => {
  const source = read(file),
    hook =
      "onDeactivated(() => {\n  selectedKey.value = null;\n  trigger = null;\n  releaseBackground();\n});";
  assert.equal(source.split(hook).length, 2);
  for (const replacement of [
    "",
    hook.replace("  selectedKey.value = null;\n", ""),
    hook.replace("  trigger = null;\n", ""),
    hook.replace("  releaseBackground();\n", ""),
  ])
    assert.throws(() => verifyCurrentDeactivation(source.replace(hook, replacement)));
});
test("historical lifecycle commit adds precisely deactivation while its20 consumers/template/style remain unchanged", () => {
  const added =
    "onDeactivated(() => {\n  selectedKey.value = null;\n  trigger = null;\n  releaseBackground();\n});\n";
  const source = captured(file);
  assert.equal(hash(source), "b9e635a3708a3733fd66ead2be6ac840fd70872e0b5af94b3fab171407245d99");
  assert.ok(source.includes(added));
  assert.equal(
    source.replace(added, "").replace("onBeforeUnmount, onDeactivated,", "onBeforeUnmount,"),
    previous(file),
  );
  const consumers = execFileSync(
    "git",
    [
      "grep",
      "-l",
      "-F",
      "import ResponsiveDataView",
      capturedRevision,
      "--",
      "apps/web/src/components",
    ],
    { encoding: "utf8" },
  )
    .trim()
    .split(/\r?\n/)
    .map((entry) => {
      assert.ok(entry.startsWith(`${capturedRevision}:apps/web/src/components/`));
      return entry.slice(capturedRevision.length + 1);
    });
  assert.equal(consumers.length, 20);
  for (const f of consumers) assert.equal(captured(f), previous(f), f);
});
test("archived real-app lifecycle evidence binds the exact capture commit, not later current source", () => {
  for (const mode of ["baseline", "current"]) {
    const root = `output/playwright/p38-shell-lifecycle/${mode}`,
      e = JSON.parse(read(`${root}/evidence.json`));
    assert.deepEqual(e, JSON.parse(captured(`${root}/evidence.json`)));
    assert.equal(e.mode, mode === "baseline" ? "baseline-reproduction" : "current-regression");
    assert.equal(e.approval, "not-requested-current-behavior-evidence");
    assert.equal(e.processesClosed, true);
    assert.equal(e.checks.length, 4);
    assert.equal(e.observations.length, 8);
    assert.equal(e.screenshots.length, 5);
    for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(captured(f)), sha, f);
    if (mode === "baseline")
      assert.deepEqual(e.baselineReplay, { revision: base, file, sha256: hash(previous(file)) });
    else assert.equal(e.baselineReplay, null);
    for (const width of [390, 760, 761, 1440]) {
      const events = e.observations.filter((o) => o.width === width);
      assert.deepEqual(
        events.map((o) => o.state),
        ["left-overview", "returned-overview"],
      );
      for (const o of events) {
        assert.equal(o.dialogs, mode === "baseline" && width <= 760 ? 1 : 0);
        assert.equal(o.appInert, mode === "baseline" && width <= 760);
      }
      const check = e.checks.find((c) => c.width === width);
      assert.match(check.name, /reopen\/Esc\/focus or desktop density\/freeze preserved/);
      assert.deepEqual(check.requests, [
        "GET /api/v1/me/navigation?shell=platform_admin",
        "GET /api/v1/platform/provider-sources",
        "GET /api/v1/platform/dashboard?window=24h",
        "GET /api/v1/platform/dashboard?window=24h",
        "GET /api/v1/platform/dashboard?window=7d",
      ]);
    }
    for (const shot of e.screenshots)
      assert.equal(hash(readFileSync(`${root}/${shot.file}`)), shot.sha256);
  }
});
test("before and after actual ready-page images retain exact normal rendering", () => {
  for (const width of [390, 1440]) {
    const f = `${width}-ready.png`,
      root = "output/playwright/p38-shell-lifecycle";
    assert.equal(
      hash(readFileSync(`${root}/baseline/${f}`)),
      hash(readFileSync(`${root}/current/${f}`)),
      f,
    );
  }
});

test("historical lifecycle image differences and proposal scope remain exact across explicitly registered later images", () => {
  const result = JSON.parse(
    execFileSync("node", ["scripts/build-ui-phase2-detail-lifecycle-capture-review.mjs"], {
      encoding: "utf8",
    }),
  );
  assert.equal(result.manifests, 26);
  const review = JSON.parse(
    read("design-plans/ui-phase-2-2026-09-07/detail-lifecycle-capture-review.json"),
  );
  assert.equal(review.baselineCommit, base);
  assert.equal(review.approvedByUser, false);
  for (const manifest of review.manifests) {
    const e = JSON.parse(captured(manifest));
    for (const f of Object.keys(e.sourceHashes ?? {}).filter(
      (f) => f.startsWith("design-plans/") && /\.(html|css|js)$/.test(f),
    ))
      assert.equal(captured(f), previous(f), f);
  }
});
