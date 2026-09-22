import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const registryPath = "apps/web/src/components/ProviderRegistry.vue";
const stylePath = "apps/web/src/styles/provider-registry-c-completion.css";
const registry = readFileSync(registryPath, "utf8");
const css = readFileSync(stylePath, "utf8");

test("P46 C completion stays route-scoped and imports after the approved structure", () => {
  assert.match(
    registry,
    /<style src="\.\.\/styles\/provider-registry-c-completion\.css"><\/style>/,
  );
  assert.ok(
    registry.indexOf("provider-registry-c-completion.css") >
      registry.indexOf("provider-approved-structure.css"),
  );
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.match(selector, /html body:has\(#app \.provider-registry\)/, selector);
  });
});

test("P46 C includes records, empty/error states, teleported detail and desktop editor breakpoints", () => {
  for (const selector of [
    ".provider-table-wrap",
    ".table-view-controls__toolbar",
    ".responsive-data-view__mobile article",
    ".responsive-data-view__drawer",
    ".provider-empty",
    ".ui-state-panel",
    ".provider-editor-steps",
    ".provider-editor > footer",
  ])
    assert.ok(css.includes(selector), selector);
  assert.ok(css.includes("@media (min-width: 761px)"));
  assert.ok(css.includes("@media (min-width: 761px) and (max-width: 1023px)"));
  assert.ok(css.includes("@media (max-width: 760px)"));
  assert.match(registry, /primary-label="重新读取来源"/);
  assert.match(registry, /<th scope="col">操作<\/th>/);
});
