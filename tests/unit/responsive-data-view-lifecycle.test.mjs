import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
const file = "apps/web/src/components/ResponsiveDataView.vue";
const base = "3023a030";
const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const previous = (f) =>
  execFileSync("git", ["show", `${base}:${f}`], {
    encoding: "utf8",
    maxBuffer: 20_000_000,
  }).replaceAll("\r\n", "\n");
function harness() {
  const hooks = {},
    rows = [{ id: "first", name: "existing" }];
  const ast = ts.createSourceFile(
    "component.ts",
    parse(read(file)).descriptor.scriptSetup.content,
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
test("KeepAlive deactivation clears selected identity and stale trigger, restores exact inert values and disconnects observer", () => {
  const { h, hooks, rows } = harness();
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
});
test("source change is precisely a deactivation hook, with all20 consumers/template/style untouched", () => {
  const added =
    "onDeactivated(() => {\n  selectedKey.value = null;\n  trigger = null;\n  releaseBackground();\n});\n";
  assert.ok(read(file).includes(added));
  assert.equal(
    read(file).replace(added, "").replace("onBeforeUnmount, onDeactivated,", "onBeforeUnmount,"),
    previous(file),
  );
  const root = "apps/web/src/components",
    consumers = readdirSync(root).filter(
      (f) => f.endsWith(".vue") && read(`${root}/${f}`).includes("import ResponsiveDataView"),
    );
  assert.equal(consumers.length, 20);
  for (const f of consumers) assert.equal(read(`${root}/${f}`), previous(`${root}/${f}`), f);
});
test("real app baseline reproduces trapped mobile page; current cache exit and return clear it at all four widths", () => {
  for (const mode of ["baseline", "current"]) {
    const root = `output/playwright/p38-shell-lifecycle/${mode}`,
      e = JSON.parse(read(`${root}/evidence.json`));
    assert.equal(e.mode, mode === "baseline" ? "baseline-reproduction" : "current-regression");
    assert.equal(e.approval, "not-requested-current-behavior-evidence");
    assert.equal(e.processesClosed, true);
    assert.equal(e.checks.length, 4);
    assert.equal(e.observations.length, 8);
    assert.equal(e.screenshots.length, 5);
    for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
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

test("all recaptured legacy image differences are measured exactly, not a generic tolerance or approval", () => {
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
    const e = JSON.parse(read(manifest));
    for (const f of Object.keys(e.sourceHashes ?? {}).filter(
      (f) => f.startsWith("design-plans/") && /\.(html|css|js)$/.test(f),
    ))
      assert.equal(read(f), previous(f), f);
  }
});
