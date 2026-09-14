import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { computed, nextTick, reactive, ref } from "vue";

const drawerSource = await readFile("apps/web/src/components/ResponsiveFilterDrawer.vue", "utf8");
function callerModes(source, tag = "ResponsiveFilterDrawer") {
  const descriptor = parse(source).descriptor;
  const script = ts.createSourceFile(
    "caller.ts",
    descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  assert.ok(
    script.statements.some(
      (node) =>
        ts.isImportDeclaration(node) &&
        node.importClause?.name?.text === tag &&
        node.moduleSpecifier.text === `./${tag}.vue`,
    ),
    "actual drawer/caller import required",
  );
  const result = [];
  function visit(node) {
    if (node.type === 1 && node.tag === tag) {
      assert.ok(
        !node.props.some(
          (p) =>
            p.type === 7 && p.name === "bind" && (!p.arg?.isStatic || p.arg.content === "mode"),
        ),
        "dynamic drawer mode forwarding requires its own caller test",
      );
      result.push(
        node.props.find((p) => p.type === 6 && p.name === "mode")?.value?.content ?? "responsive",
      );
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(baseParse(descriptor.template.content));
  assert.ok(result.length > 0, "mounted drawer caller required");
  return result;
}

function harness(input = {}, matches = false) {
  const mounted = [],
    unmounted = [],
    subscriptions = [];
  const document = { activeElement: null };
  const mediaQuery = {
    matches,
    addEventListener: (event, handler) => subscriptions.push(["add", event, handler]),
    removeEventListener: (event, handler) => subscriptions.push(["remove", event, handler]),
  };
  const box = {
    exports: {},
    computed,
    ref,
    nextTick,
    // Mounted multi-instance useId behavior is checked by the actual Vue browser verifier.
    useId: () => "unit-instance",
    defineProps: () => input,
    withDefaults: (props, defaults) =>
      reactive({
        ...defaults,
        ...Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined)),
      }),
    watch: () => {},
    onMounted: (callback) => mounted.push(callback),
    onBeforeUnmount: (callback) => unmounted.push(callback),
    document,
    window: {
      matchMedia: (query) => {
        assert.equal(query, "(max-width: 760px)");
        return mediaQuery;
      },
    },
  };
  const ast = ts.createSourceFile(
    "drawer.ts",
    parse(drawerSource).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const body = ast.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(ast))
    .join("\n");
  vm.runInNewContext(
    ts.transpileModule(
      body +
        "\nexports.api={props,open,mobile,overlay,triggerButton,closeButton,sheet,show,close,handleKeydown,syncViewport};",
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      },
    ).outputText,
    box,
  );
  for (const mount of mounted) mount();
  return {
    ...box.exports.api,
    document,
    subscriptions,
    unmount: () => unmounted.forEach((callback) => callback()),
  };
}

test("default member/collection filters retain responsive mode", async () => {
  const [drawer, trends, trendFilters, opportunities, collection] = await Promise.all(
    [
      "apps/web/src/components/ResponsiveFilterDrawer.vue",
      "apps/web/src/components/TrendDashboard.vue",
      "apps/web/src/components/TrendFilterPanel.vue",
      "apps/web/src/components/OpportunityListPanel.vue",
      "apps/web/src/components/CollectionOperationsConsole.vue",
    ].map((path) => readFile(path, "utf8")),
  );

  assert.match(drawer, /aria-haspopup="dialog"/);
  assert.match(drawer, /@keydown="handleKeydown"/);
  assert.match(drawer, /triggerButton\.value\?\.focus\(\)/);
  assert.match(drawer, /event\.key !== "Tab"/);
  assert.match(drawer, /@submit\.capture="close"/);
  assert.match(drawer, /<Teleport to="body" :disabled="!overlay">/);
  assert.match(drawer, /max-width: 760px/);
  assert.match(drawer, /inset: 0;[\s\S]*width: 100%;[\s\S]*height: 100dvh/);
  assert.match(drawer, /var\(--so-touch-target\)/);
  assert.doesNotMatch(drawer, /alwaysDrawer|border-radius|box-shadow|!important|#[0-9a-f]{3,8}\b/i);
  assert.match(trends, /TrendFilterPanel/);
  for (const source of [trendFilters, opportunities, collection])
    assert.deepEqual(callerModes(source), ["responsive"]);
  for (const source of [trendFilters, opportunities])
    assert.match(source, /filter-apply-action secondary/);
  assert.doesNotMatch(opportunities, /always-drawer/);
});

for (const mode of [undefined, "responsive", "dialog"]) {
  test(`drawer ${mode ?? "default"} mode uses actual reactive viewport/prop rules`, () => {
    const h = harness({ mode });
    assert.equal(h.props.mode, mode ?? "responsive");
    assert.equal(h.overlay.value, mode === "dialog");
    h.syncViewport({ matches: true });
    assert.equal(h.mobile.value, true);
    assert.equal(h.overlay.value, true);
    h.open.value = true;
    h.syncViewport({ matches: false });
    assert.equal(h.open.value, false);
    assert.equal(h.overlay.value, mode === "dialog");
    h.props.mode = "dialog";
    assert.equal(h.overlay.value, true);
    h.props.mode = "responsive";
    assert.equal(h.overlay.value, false);
    h.unmount();
    assert.deepEqual(
      h.subscriptions.map(([action, event]) => [action, event]),
      [
        ["add", "change"],
        ["remove", "change"],
      ],
    );
    assert.equal(h.subscriptions[0][2], h.subscriptions[1][2]);
  });
}

for (const [mode, mobile] of [
  ["responsive", true],
  ["dialog", false],
]) {
  test(`drawer ${mode} opening/closing and Escape preserve the existing focus handoff`, async () => {
    const h = harness({ mode }, mobile);
    const focused = [];
    h.closeButton.value = { focus: () => focused.push("close") };
    h.triggerButton.value = { focus: () => focused.push("trigger") };
    await h.close();
    assert.deepEqual(focused, []);
    await h.show();
    assert.equal(h.open.value, true);
    assert.deepEqual(focused, ["close"]);
    let prevented = 0;
    h.handleKeydown({ key: "Escape", preventDefault: () => prevented++ });
    await nextTick();
    // The script runs in another VM realm; let its async continuation finish too.
    await new Promise(setImmediate);
    assert.equal(h.open.value, false);
    assert.equal(prevented, 1);
    assert.deepEqual(focused, ["close", "trigger"]);
    await h.close();
    assert.deepEqual(focused, ["close", "trigger"]);
    h.unmount();
  });
}

test("drawer traps only open-overlay boundary Tabs and leaves interior/inline/closed navigation alone", () => {
  const h = harness({}, true);
  const first = {
    focus: () => {
      h.document.activeElement = first;
    },
  };
  const middle = {};
  const last = {
    focus: () => {
      h.document.activeElement = last;
    },
  };
  h.sheet.value = { querySelectorAll: () => [first, middle, last] };
  h.open.value = true;
  function press(active, shiftKey = false) {
    h.document.activeElement = active;
    let prevented = 0;
    h.handleKeydown({ key: "Tab", shiftKey, preventDefault: () => prevented++ });
    return { prevented, active: h.document.activeElement };
  }
  assert.deepEqual(press(first, true), { prevented: 1, active: last });
  assert.deepEqual(press(last), { prevented: 1, active: first });
  assert.deepEqual(press(middle), { prevented: 0, active: middle });
  h.open.value = false;
  assert.deepEqual(press(last), { prevented: 0, active: last });
  h.syncViewport({ matches: false });
  h.open.value = true;
  assert.deepEqual(press(last), { prevented: 0, active: last });
  h.props.mode = "dialog";
  assert.deepEqual(press(last), { prevented: 1, active: first });
  h.unmount();
});
