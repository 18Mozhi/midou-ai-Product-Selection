import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";

const source = readFileSync("apps/web/src/components/RedisResilienceCenter.vue", "utf8");
const script = parse(source).descriptor.scriptSetup.content;
const ast = ts.createSourceFile("redis.ts", script, ts.ScriptTarget.Latest, true);
const handoff = ast.statements
  .find((node) => ts.isFunctionDeclaration(node) && node.name.text === "handoffReadFocus")
  .getText(ast);

function fixture({
  owner = "retry",
  hidden,
  disconnected,
  inert,
  refused = false,
  top = 20,
  covered = false,
} = {}) {
  const calls = [];
  const doc = { activeElement: null, elementFromPoint: () => (covered ? {} : buttons.refresh) };
  const buttons = Object.fromEntries(
    ["retry", "notice", "refresh", "other"].map((name) => [
      name,
      {
        ownerDocument: doc,
        isConnected: disconnected !== name,
        closest: () => (inert === name ? {} : null),
        checkVisibility: () => hidden !== name,
        focus: (options) => {
          calls.push(["focus", options]);
          if (!refused) doc.activeElement = buttons[name];
        },
        getBoundingClientRect: () => ({ top, bottom: top + 40, left: 10, width: 100, height: 40 }),
        contains: (node) => node === buttons[name],
        scrollIntoView: (options) => calls.push(["scroll", options]),
      },
    ]),
  );
  doc.activeElement = buttons[owner];
  const context = {
    retryButton: { value: buttons.retry },
    noticeRetryButton: { value: buttons.notice },
    refreshButton: { value: buttons.refresh },
    window: { innerHeight: 800 },
  };
  vm.runInNewContext(`${handoff}; handoffReadFocus();`, context, { timeout: 1000 });
  return { calls: JSON.parse(JSON.stringify(calls)), active: doc.activeElement, buttons };
}

for (const owner of ["retry", "notice"])
  test(`P67 ${owner} transfers its own focus without unnecessary scroll`, () => {
    const result = fixture({ owner });
    assert.equal(result.active, result.buttons.refresh);
    assert.deepEqual(result.calls, [["focus", { preventScroll: true }]]);
  });

test("P67 retry never steals focus that the user moved elsewhere", () => {
  const result = fixture({ owner: "other" });
  assert.equal(result.active, result.buttons.other);
  assert.deepEqual(result.calls, []);
});

for (const property of ["hidden", "disconnected", "inert"])
  for (const target of ["retry", "refresh"])
    test(`P67 ${property} ${target} prevents handoff`, () => {
      assert.deepEqual(fixture({ [property]: target }).calls, []);
    });

test("P67 unsuccessful focus does not scroll", () => {
  const result = fixture({ refused: true, top: -100 });
  assert.equal(result.active, result.buttons.retry);
  assert.equal(result.calls.length, 1);
});

for (const options of [{ top: -20 }, { top: 790 }, { covered: true }])
  test(`P67 focused but obscured target is scrolled into view ${JSON.stringify(options)}`, () => {
    assert.deepEqual(fixture(options).calls, [
      ["focus", { preventScroll: true }],
      ["scroll", { block: "center", inline: "nearest" }],
    ]);
  });

test("P67 single-flight guard precedes handoff and clearing the old retry region", () => {
  const load = ast.statements
    .find((node) => ts.isFunctionDeclaration(node) && node.name.text === "load")
    .getText(ast);
  assert.ok(load.indexOf("if (controller) return") < load.indexOf("handoffReadFocus()"));
  assert.ok(load.indexOf("handoffReadFocus()") < load.indexOf("refreshFailure.value = null"));
  assert.ok(load.indexOf("handoffReadFocus()") < load.indexOf('state.value = "loading"'));
  const template = parse(source).descriptor.template.content;
  assert.match(template, /ref="refreshButton"[\s\S]*?:aria-disabled="refreshing"/);
});
