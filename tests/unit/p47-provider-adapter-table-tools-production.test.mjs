import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  component = read("apps/web/src/components/ProviderAdapterCenter.vue"),
  css = postcss.parse(read("apps/web/src/provider-adapters-c-table-tools.css"));

test("P47 production page imports its route-scoped table controls stylesheet", () => {
  assert.ok(component.includes('import "../provider-adapters-c-table-tools.css";'));
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body:has(#app .adapter-center--c)"), selector);
      assert.ok(selector.includes(".adapter-center--c"), selector);
      assert.ok(selector.includes(".table-view-controls"), selector);
    }
    assert.ok(
      rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important),
    );
  });
});

test("P47 production table controls retain the approved desktop states", () => {
  const cssText = read("apps/web/src/provider-adapters-c-table-tools.css");
  for (const approved of [
    ".table-view-controls__toolbar",
    "min-height: 44px",
    "button[aria-pressed=\"true\"]",
    "fieldset",
    "div:last-child",
    ":focus-visible",
    ".table-view-controls__content",
  ])
    assert.ok(cssText.includes(approved), approved);
});
