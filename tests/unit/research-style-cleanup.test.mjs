import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import postcss from "postcss";
async function code(directory) {
  const parts = await Promise.all(
    (await readdir(directory, { withFileTypes: true })).map(async (entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory()
        ? code(file)
        : /\.(vue|ts)$/.test(file)
          ? readFile(file, "utf8")
          : "";
    }),
  );
  return parts.join("\n");
}
test("old trend width and rule layouts have no component tokens or runtime selectors", async () => {
  const source = await code("apps/web/src");
  const css = await readFile("apps/web/src/trends.css", "utf8");
  for (const name of ["trend-width-control", "trend-rules"]) {
    assert.doesNotMatch(source, new RegExp(`(?<![\\w-])${name}(?![\\w-])`));
    assert.ok(!css.includes(`.${name}`));
  }
});
test("sourcing comparison tray stays opaque and flat in base and review modes", async () => {
  const root = postcss.parse(await readFile("apps/web/src/sourcing.css", "utf8"));
  const values = {};
  root.walkRules((rule) => {
    if (rule.parent.type !== "root") return;
    if (
      rule.selector === ".sourcing-compare-tray" ||
      rule.selector === "#app .sourcing-workspace--review .sourcing-compare-tray"
    ) {
      values[rule.selector] = Object.fromEntries(
        rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value]),
      );
    }
  });
  assert.equal(values[".sourcing-compare-tray"]["background"], "var(--so-panel)");
  assert.equal(values[".sourcing-compare-tray"]["backdrop-filter"], "none");
  for (const declaration of Object.values(values)) assert.equal(declaration["box-shadow"], "none");
});
