import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import postcss from "postcss";
import { transform } from "esbuild";
import postcssConfiguration from "../../apps/web/postcss.config.mjs";
import {
  compactOrganizationSelectors,
  factorClassAlternatives,
} from "../../apps/web/build/organization-css-compaction.mjs";

function expand(selector) {
  const match = /:is\((\.[A-Za-z_][\w-]*(?:,\.[A-Za-z_][\w-]*)+)\)/u.exec(selector);
  return match
    ? match[1].split(",").flatMap((part) => expand(selector.replace(match[0], part)))
    : [selector.trim().replace(/\s+/gu, " ")];
}

function structure(node) {
  return {
    type: node.type,
    ...(node.type === "rule" ? { selectors: node.selectors.flatMap(expand).sort() } : {}),
    ...Object.fromEntries(
      ["name", "params", "prop", "value", "important", "text"]
        .filter((key) => node[key] !== undefined)
        .map((key) => [key, node[key]]),
    ),
    ...(node.nodes ? { nodes: node.nodes.map(structure) } : {}),
  };
}

test("organization production compaction preserves every selector, declaration and cascade position", async () => {
  const source = await readFile("apps/web/src/organization-admin.css", "utf8");
  const result = await postcss([compactOrganizationSelectors()]).process(source, {
    from: "apps/web/src/organization-admin.css",
  });
  assert.deepEqual(structure(postcss.parse(result.css)), structure(postcss.parse(source)));
  const before = await transform(source, { loader: "css", minify: true });
  const after = await transform(result.css, { loader: "css", minify: true });
  assert.ok(Buffer.byteLength(before.code) - Buffer.byteLength(after.code) >= 1040);
  const other = await postcss([compactOrganizationSelectors()]).process(source, {
    from: "apps/web/src/other.css",
  });
  assert.equal(other.css, source);
});

test("compaction cannot distribute alternatives through functions or change mixed specificity", () => {
  assert.equal(postcssConfiguration({ env: "development" }).plugins.length, 0);
  assert.equal(postcssConfiguration({ env: "production" }).plugins.length, 1);
  for (const selectors of [
    [".scope :not(.a .x)", ".scope :not(.b .x)"],
    [".scope[data-x] .a", ".scope[data-x] .b"],
    [".scope .a", ".scope #b"],
    [".scope .a", ".scope button"],
    [".scope .a\\:b", ".scope .c"],
  ])
    assert.deepEqual(factorClassAlternatives(selectors), selectors);
  const selectors = [".scope .a > header", ".scope .b > header", ".other .c"];
  assert.deepEqual(factorClassAlternatives(selectors).flatMap(expand).sort(), selectors.sort());
});
