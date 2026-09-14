import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
const source = readFileSync("apps/web/src/components/OpenPlatformCenter.vue", "utf8");
const { descriptor } = parse(source),
  ast = baseParse(descriptor.template.content),
  buttons = [];
function visit(node) {
  if (node.tag === "button") buttons.push(node);
  for (const child of node.children ?? []) visit(child);
}
visit(ast);
const target = buttons.filter((n) =>
  n.props.some((p) => p.name === "class" && p.value?.content === "open-action-reread"),
);
test("P60 recovery alone stays focusable with aria-disabled and native button semantics", () => {
  assert.equal(target.length, 1);
  const p = target[0].props;
  assert.ok(p.some((p) => p.name === "type" && p.value.content === "button"));
  assert.ok(
    p.some(
      (p) =>
        p.name === "bind" && p.arg.content === "aria-disabled" && p.exp.content === "refreshing",
    ),
  );
  assert.ok(
    p.some((p) => p.name === "on" && p.arg.content === "click" && p.exp.content === "load"),
  );
  assert.ok(
    !p.some((p) => p.name === "disabled" || p.arg?.content === "disabled" || p.name === "tabindex"),
  );
  assert.equal(
    buttons.filter((n) => n.props.some((p) => p.arg?.content === "aria-disabled")).length,
    1,
  );
});
test("P60 load checks single-flight before any state or request change", () => {
  assert.match(
    descriptor.scriptSetup.content,
    /async function load\(\) \{\s*if \(refreshing.value\) return;/,
  );
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: "OpenPlatformCenter.vue",
      id: "keyboard",
    }).errors,
    [],
  );
});
test("P60 production and C preview map only the recovery aria-disabled state to existing disabled styles", () => {
  for (const file of [
    "apps/web/src/open-platform.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/platform-open-page-preview.css",
  ]) {
    const css = readFileSync(file, "utf8");
    assert.match(
      css,
      /button:disabled,\s*(?:\.open-platform )?\.open-action-reread\[aria-disabled="true"\]/,
    );
    assert.match(css, /:not\(\[aria-disabled="true"\]\)/);
  }
});
