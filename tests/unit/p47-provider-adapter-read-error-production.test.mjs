import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileTemplate, parse } from "@vue/compiler-sfc";
import postcss from "postcss";

const componentPath = "apps/web/src/components/ProviderAdapterCenter.vue";
const stylePath = "apps/web/src/provider-adapters-c-read-error.css";
const component = readFileSync(componentPath, "utf8").replaceAll("\r\n", "\n");
const style = readFileSync(stylePath, "utf8").replaceAll("\r\n", "\n");

test("P47 initial GET error uses the approved read-only copy and keeps the existing retry", () => {
  const parsed = parse(component);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: componentPath,
      id: "p47-read-error-production",
    }).errors,
    [],
  );
  assert.match(component, /state === 'error' \? '暂时未能读取采集状态' : ''/);
  assert.match(
    component,
    /state === 'error' \? '这次读取未完成。你可以重新读取，获取最新状态。' : ''/,
  );
  assert.match(component, /:primary-label="state === 'loading' \? '' : '重新读取状态'"/);
  assert.match(component, /@primary="load"/);
  assert.match(component, /:request-id="requestId"/);
});

test("P47 read-error styles are restricted to the active page's generic error panel", () => {
  const root = postcss.parse(style);
  let rules = 0;
  root.walkRules((rule) => {
    rules += 1;
    for (const selector of rule.selectors) {
      assert.ok(selector.includes(".adapter-center--c"), selector);
      assert.ok(selector.includes('.ui-state-panel[data-kind="error"]'), selector);
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  assert.ok(rules >= 8);
  assert.match(style, /font-size: 13px/);
  assert.match(style, /min-height: 44px/);
  assert.match(style, /\.primary:focus-visible/);
  assert.match(style, /@media \(max-width: 760px\)/);
});
