import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";

const file = "apps/web/src/components/ProviderAdapterCenter.vue";
const { descriptor, errors } = parse(readFileSync(file, "utf8"));
const ast = ts.createSourceFile(file, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const handlers = ast.statements.filter(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "turnPage",
);
assert.equal(handlers.length, 1);
const handler = ts.transpileModule(handlers[0].getText(ast) + "\nglobalThis.run=turnPage;", {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

for (const direction of [-1, 1]) {
  for (const scene of [
    "boundary",
    "middle",
    "other-focus",
    "inert",
    "detached",
    "missing",
    "non-button",
  ]) {
    test(`P47 pagination ${direction}/${scene}: original step, only owned boundary focus`, () => {
      const start = scene === "middle" ? (direction === 1 ? 1 : 3) : 2;
      const events = [];
      let current = start;
      const status = {
        isConnected: scene !== "detached",
        closest: (selector) => {
          assert.equal(selector, "[inert]");
          return scene === "inert" ? {} : null;
        },
        focus: (options) => {
          assert.equal(options.preventScroll, true);
          assert.equal(current, start, "Focus must move before Vue disables the trigger");
          events.push("focus");
        },
      };
      class Button {
        closest(selector) {
          assert.equal(selector, ".adapter-pagination");
          return {
            querySelector: (selector) => {
              assert.equal(selector, "span");
              return scene === "missing" ? null : status;
            },
          };
        }
      }
      const trigger = scene === "non-button" ? {} : new Button();
      const box = {
        HTMLButtonElement: Button,
        document: { activeElement: scene === "other-focus" ? {} : trigger },
        page: {
          get value() {
            return current;
          },
          set value(value) {
            events.push("page");
            current = value;
          },
        },
        totalPages: { value: 3 },
      };
      vm.runInNewContext(handler, box);
      box.run(direction, { currentTarget: trigger });
      assert.equal(current, start + direction);
      assert.deepEqual(events, scene === "boundary" ? ["focus", "page"] : ["page"]);
    });
  }
}

test("P47 real template keeps existing pagination and exposes persistent visible status", () => {
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "p47-pagination-focus" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: file,
      id: "p47-pagination-focus",
    }).errors,
    [],
  );
  const template = descriptor.template.content;
  assert.ok(template.includes('<nav v-if="filtered.length" class="adapter-pagination"'));
  assert.ok(template.includes(':disabled="page === 1" @click="turnPage(-1, $event)"'));
  assert.ok(template.includes(':disabled="page === totalPages" @click="turnPage(1, $event)"'));
  assert.match(
    template,
    /<span tabindex="-1" role="status" aria-live="polite" aria-atomic="true"\s*>\s*第 \{\{ page \}\}/,
  );
  assert.ok(descriptor.scriptSetup.content.includes("pageSize = 20"));
  const css = readFileSync("apps/web/src/provider-adapters-c-page.css", "utf8");
  assert.match(css, /:is\(button, a, input, select, summary, \[tabindex\]\):focus-visible/);
  assert.ok(css.includes("outline: 3px solid var(--p47-focus)"));
});
