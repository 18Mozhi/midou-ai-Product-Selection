import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import postcss from "postcss";
import { parse } from "@vue/compiler-sfc";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const file = "apps/web/src/components/ProviderAdapterCenter.vue";
const source = read(file);
const { descriptor } = parse(source);
const ast = ts.createSourceFile(file, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const wrappers = ["turnPage", "refreshFromButton", "resetEmptyFilters"];
function handler(name, box) {
  const functions = ast.statements.filter(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  assert.equal(functions.length, 1);
  vm.runInNewContext(
    ts.transpileModule(functions[0].getText(ast) + `\nglobalThis.run=${name};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    box,
  );
  return box.run;
}

test("P47 takeover preserves the original data, API and business script outside three focus wrappers", () => {
  const originalStatements = ast.statements
    .filter((node) => !ts.isFunctionDeclaration(node) || !wrappers.includes(node.name?.text))
    .map((node) => node.getText(ast))
    .filter((text) => text !== 'import "../provider-adapters-empty-mobile.css";')
    .map((text) => text.replace("computed, nextTick,", "computed,"))
    .join("\n");
  // SHA of the same TypeScript statement serialization at 883a533c.
  assert.equal(
    hash(originalStatements),
    "17f3a81538690a413185dc4b9e9d25d112ffdafc39352c8909ebbd4f7114e989",
  );
  assert.ok(descriptor.template.content.includes('@click="refreshFromButton"'));
  assert.ok(descriptor.template.content.includes('@click="resetEmptyFilters"'));
  assert.ok(descriptor.template.content.includes('<header class="adapter-heading" tabindex="-1">'));
});

for (const scene of ["owned", "other-focus", "detached", "inert", "missing", "non-element"])
  test(`P47 refresh ${scene}: focus before disable, exactly one original read`, () => {
    const order = [];
    const heading = {
      isConnected: scene !== "detached",
      closest: () => (scene === "inert" ? {} : null),
      focus: (options) => {
        assert.equal(options.preventScroll, true);
        order.push("focus");
      },
    };
    class Element {
      closest(selector) {
        assert.equal(selector, ".adapter-heading");
        return scene === "missing" ? null : heading;
      }
    }
    const trigger = scene === "non-element" ? {} : new Element();
    const box = {
      HTMLElement: Element,
      document: { activeElement: scene === "other-focus" ? {} : trigger },
      load: () => order.push("load"),
    };
    handler("refreshFromButton", box)({ currentTarget: trigger });
    assert.deepEqual(order, scene === "owned" ? ["focus", "load"] : ["load"]);
  });

for (const scene of ["removed-trigger", "new-focus", "detached", "disabled", "inert", "missing"])
  test(`P47 empty reset ${scene}: wait for Vue, do not replace a newer focus`, async () => {
    const order = [];
    let release;
    const input = {
      isConnected: true,
      disabled: false,
      inert: false,
      closest: () => (input.inert ? {} : null),
      focus: () => order.push("focus"),
    };
    const body = {};
    const box = {
      document: { body, activeElement: {} },
      resetFilters: () => order.push("reset"),
      nextTick: () => new Promise((resolve) => (release = resolve)),
    };
    const trigger = {
      closest(selector) {
        assert.equal(selector, ".adapter-center");
        return {
          querySelector(selector) {
            assert.equal(selector, ".adapter-search input");
            return scene === "missing" ? null : input;
          },
        };
      },
    };
    const pending = handler("resetEmptyFilters", box)({ currentTarget: trigger });
    assert.deepEqual(order, ["reset"]);
    box.document.activeElement = scene === "new-focus" ? {} : body;
    input.isConnected = scene !== "detached";
    input.disabled = scene === "disabled";
    input.inert = scene === "inert";
    release();
    await pending;
    assert.deepEqual(order, scene === "removed-trigger" ? ["reset", "focus"] : ["reset"]);
  });

const palette = postcss.parse(read("apps/web/src/design/provider-adapter-tokens.css"));
const colors = new Map();
palette.walkDecls((node) => colors.set(node.prop, node.value));
test("P47 palette stays local and all four callers resolve their colors", () => {
  const nodes = palette.nodes.filter((node) => node.type !== "comment");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].selector, "html:has(body #app .adapter-center--c)");
  assert.equal(nodes[0].nodes.length, 42);
  assert.equal(colors.size, 42);
  assert.ok([...colors.keys()].every((key) => key.startsWith("--p47-")));
  for (const name of ["c-page", "c-detail", "c-feedback", "empty-mobile"]) {
    const css = read(`apps/web/src/provider-adapters-${name}.css`);
    assert.ok(css.startsWith('@import "./design/provider-adapter-tokens.css";'));
    for (const [, key] of css.matchAll(/var\((--p47-[a-z-]+)\)/g))
      assert.ok(colors.has(key), `undefined local color: ${key}`);
  }
});

function declarations(source) {
  const root = postcss.parse(source);
  root.walkComments((node) => node.remove());
  root.walkAtRules("import", (node) => node.remove());
  root.walkRules((node) => {
    if (node.nodes.every((child) => child.type === "decl" && child.prop.startsWith("--p47-")))
      node.remove();
  });
  root.walkDecls((node) => {
    node.value = node.value.replace(/var\((--p47-[a-z-]+)\)/g, (_, key) => {
      assert.ok(colors.has(key));
      return colors.get(key);
    });
  });
  const serialize = (node) => ({
    type: node.type,
    ...Object.fromEntries(
      ["name", "params", "selector", "prop", "value", "important"]
        .filter((key) => node[key] !== undefined)
        .map((key) => [
          key,
          typeof node[key] === "string" ? node[key].replace(/\s+/g, " ").trim() : node[key],
        ]),
    ),
    ...(node.nodes ? { nodes: node.nodes.map(serialize) } : {}),
  });
  return hash(JSON.stringify(serialize(root)));
}

// Resolved ordered CSS AST fingerprints at 883a533c, before the palette extraction.
for (const [name, expected] of Object.entries({
  page: "3e8c0c3ae4407a36d4d2bb39b125adadc40ab86b4d71eba0f0c3e4971be97b49",
  detail: "e73d569a9939c2ee2801d0707e7648918e5b06b3552bf7233542e98a14501a10",
  feedback: "32e9e6cd4dea0c2e53d8fa5b7102369156d784efdf44d4ee8bc571cd6a4e7fe1",
}))
  test(`P47 ${name} retains every resolved rule/declaration in its original order`, () => {
    assert.equal(declarations(read(`apps/web/src/provider-adapters-c-${name}.css`)), expected);
  });
