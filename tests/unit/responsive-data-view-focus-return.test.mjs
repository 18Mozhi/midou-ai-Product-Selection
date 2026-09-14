import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";

const filename = "apps/web/src/components/ResponsiveDataView.vue";
const source = readFileSync(filename, "utf8");
function harness() {
  let callback;
  const doc = { activeElement: null },
    focus = [];
  const props = { rows: [{ id: "one" }], rowKey: (row) => row.id };
  const box = {
    defineProps: () => props,
    shallowRef: (value) => ({ value }),
    computed: (fn) => ({
      get value() {
        return fn();
      },
    }),
    watch: (_, fn) => {
      callback = fn;
    },
    nextTick: () => Promise.resolve(),
    onBeforeUnmount: () => {},
    onDeactivated: () => {},
    document: doc,
  };
  const ast = ts.createSourceFile(
    "component.ts",
    parse(source).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const body = ast.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(ast))
    .join("\n");
  vm.runInNewContext(
    ts.transpileModule(body + ";globalThis.api={show,viewRoot,mobileList,selectedKey,background}", {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    box,
  );
  const element = (name, options = {}) => ({
    isConnected: options.connected ?? true,
    matches: () => options.disabled ?? false,
    closest: (selector) =>
      selector === "[inert]" ? (options.inert ? {} : null) : options.dialog ? {} : null,
    checkVisibility: () => options.visible ?? true,
    focus: (settings) => {
      assert.equal(settings.preventScroll, true);
      focus.push(name);
      doc.activeElement = name;
    },
  });
  const open = (triggerOptions = {}, mobileOptions = {}, rootOptions = {}) => {
    box.api.viewRoot.value = element("root", rootOptions);
    box.api.mobileList.value = element("mobile", mobileOptions);
    box.api.show(props.rows[0], { currentTarget: element("trigger", triggerOptions) });
    focus.length = 0;
    doc.activeElement = null;
  };
  return { open, focus, doc, api: box.api, close: () => callback(false, true), element };
}

for (const [name, trigger, mobile, root, expected] of [
  ["visible trigger", {}, {}, {}, ["trigger"]],
  ["hidden trigger", { visible: false }, {}, {}, ["mobile"]],
  ["removed trigger", { connected: false }, {}, {}, ["mobile"]],
  ["disabled trigger", { disabled: true }, {}, {}, ["mobile"]],
  ["inert trigger", { inert: true }, {}, {}, ["mobile"]],
  ["desktop breakpoint hides mobile targets", { visible: false }, { visible: false }, {}, ["root"]],
  ["detached component", { connected: false }, { connected: false }, { connected: false }, []],
  ["all targets inert", { inert: true }, { inert: true }, { inert: true }, []],
])
  test(`drawer close chooses a visible enabled local target: ${name}`, async () => {
    const h = harness();
    h.open(trigger, mobile, root);
    await h.close();
    assert.deepEqual(h.focus, expected);
  });

test("drawer close does not steal a newer dialog's focus and restores existing inert state", async () => {
  const h = harness();
  h.open();
  const background = { inert: true },
    alreadyInert = { inert: true };
  h.api.background.set(background, false);
  h.api.background.set(alreadyInert, true);
  h.doc.activeElement = h.element("new-dialog", { dialog: true });
  await h.close();
  assert.deepEqual(h.focus, []);
  assert.equal(background.inert, false);
  assert.equal(alreadyInert.inert, true);
});

test("fallback group is named, programmatically focusable and compiles without new props", () => {
  const descriptor = parse(source).descriptor;
  assert.match(
    descriptor.template.content,
    /ref="viewRoot"[\s\S]*role="group"[\s\S]*:aria-label="title"[\s\S]*tabindex="-1"/,
  );
  assert.match(
    source,
    /\.responsive-data-view:focus-visible\s*\{\s*outline: 3px solid var\(--so-focus\)/,
  );
  const script = compileScript(descriptor, { id: "focus-return" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename,
      id: "focus-return",
      compilerOptions: { bindingMetadata: script.bindings },
    }).errors,
    [],
  );
});
