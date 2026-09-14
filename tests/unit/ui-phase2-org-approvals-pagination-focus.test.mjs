import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";

const file = "apps/web/src/components/OrganizationApprovalPanel.vue";
const { descriptor, errors } = parse(readFileSync(file, "utf8"));
const ast = ts.createSourceFile(file, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
const handlers = ast.statements.filter(
  (n) => ts.isFunctionDeclaration(n) && n.name?.text === "turnPage",
);
assert.equal(handlers.length, 1);
const code = ts.transpileModule(handlers[0].getText(ast) + "\nglobalThis.run=turnPage;", {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
for (const view of ["requests", "templates"]) {
  for (const direction of [-1, 1]) {
    for (const scene of [
      "boundary",
      "middle",
      "other-focus",
      "inert",
      "detached",
      "missing",
      "non-button",
      "offscreen",
      "covered",
      "after-focus-changed",
      "after-inert",
      "after-detached",
    ]) {
      test(`P34 ${view}/${direction}/${scene}: original page step and owned focus only`, () => {
        const start = scene === "middle" ? (direction === 1 ? 1 : 3) : 2;
        let current = start;
        const events = [];
        const pending = [];
        let statusInert = scene === "inert";
        const ownsFocus = [
          "boundary",
          "offscreen",
          "covered",
          "after-focus-changed",
          "after-inert",
          "after-detached",
        ].includes(scene);
        const status = {
          isConnected: scene !== "detached",
          closest: (selector) => {
            assert.equal(selector, "[inert]");
            return statusInert ? {} : null;
          },
          focus: (options) => {
            assert.equal(options.preventScroll, true);
            events.push("focus");
            box.document.activeElement = status;
          },
          getBoundingClientRect: () => ({
            x: 0,
            y: scene === "offscreen" ? 1600 : 50,
            left: 0,
            right: 160,
            top: scene === "offscreen" ? 1600 : 50,
            bottom: scene === "offscreen" ? 1620 : 70,
            width: 160,
            height: 20,
          }),
          contains: (node) => node === status,
          scrollIntoView: (options) => {
            assert.deepEqual(JSON.parse(JSON.stringify(options)), {
              block: "center",
              inline: "nearest",
              behavior: "instant",
            });
            events.push("scroll");
          },
        };
        class Button {
          closest(selector) {
            assert.equal(selector, ".org-approval-pagination");
            return {
              querySelector: (selector) => {
                assert.equal(selector, "span");
                return scene === "missing" ? null : status;
              },
            };
          }
        }
        const trigger = scene === "non-button" ? {} : new Button();
        const active = {
          get value() {
            return current;
          },
          set value(v) {
            events.push("page");
            current = v;
          },
        };
        const inactive = { value: 7 };
        const box = {
          HTMLButtonElement: Button,
          document: {
            activeElement: scene === "other-focus" ? {} : trigger,
            elementFromPoint: () => (scene === "covered" ? {} : status),
          },
          window: { innerWidth: 390, innerHeight: 1000 },
          nextTick: (callback) => {
            pending.push(callback);
            return Promise.resolve();
          },
          requestPage: view === "requests" ? active : inactive,
          templatePage: view === "templates" ? active : inactive,
          requestPageCount: { value: 3 },
          templatePageCount: { value: 3 },
        };
        vm.runInNewContext(code, box);
        box.run(view, direction, { currentTarget: trigger });
        assert.equal(current, start + direction);
        assert.equal(inactive.value, 7);
        assert.deepEqual(events, ownsFocus ? ["focus", "page"] : ["page"]);
        assert.equal(pending.length, ownsFocus ? 1 : 0);
        if (scene === "after-focus-changed") box.document.activeElement = {};
        if (scene === "after-inert") statusInert = true;
        if (scene === "after-detached") status.isConnected = false;
        for (const callback of pending) callback();
        assert.deepEqual(
          events,
          ownsFocus
            ? ["focus", "page", ...(["offscreen", "covered"].includes(scene) ? ["scroll"] : [])]
            : ["page"],
        );
      });
    }
  }
}
test("P34 template binds both real pagers without changing disabled bounds or page sizes", () => {
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "p34-page-focus" });
  assert.deepEqual(
    compileTemplate({ source: descriptor.template.content, filename: file, id: "p34-page-focus" })
      .errors,
    [],
  );
  for (const view of ["requests", "templates"]) {
    for (const step of [-1, 1])
      assert.ok(descriptor.template.content.includes(`turnPage('${view}', ${step}, $event)`));
  }
  for (const binding of [
    "requestPage <= 1",
    "requestPage >= requestPageCount",
    "templatePage <= 1",
    "templatePage >= templatePageCount",
  ])
    assert.ok(descriptor.template.content.includes(`:disabled="${binding}"`));
  assert.equal(
    (
      descriptor.template.content.match(
        /tabindex="-1" role="status" aria-live="polite" aria-atomic="true"/g,
      ) || []
    ).length,
    2,
  );
  assert.match(descriptor.scriptSetup.content, /requestPageSize = 8,\s*templatePageSize = 6/);
  assert.match(
    descriptor.styles.find((s) => s.scoped).content,
    /\.org-approval-pagination > span:focus-visible/,
  );
  const reviewCss = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/implementation/org-approvals-vue-c.css",
    "utf8",
  );
  assert.match(
    reviewCss,
    /\.org-approval-pagination > span:focus-visible \{\s*outline: 3px solid #4d79ff;\s*outline-offset: 3px;/,
  );
});
