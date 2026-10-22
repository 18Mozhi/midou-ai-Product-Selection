import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
const retired = [
  "org-admin-role-grid",
  "org-admin-comparison",
  "org-admin-template-grid",
  "org-admin-template-diff",
  "org-admin-template-change",
  "org-admin-subheading",
  "org-admin-secret-warning",
  "org-admin-audit-filters",
  "org-admin-summary-row",
  "org-admin-secret",
  "mysql-resilience__hero",
  "mysql-resilience__verdict",
  "mysql-resilience__panel",
  "mysql-resilience__metrics",
  "mysql-resilience__layout",
  "mysql-resilience__impact",
  "mysql-resilience__findings",
  "mysql-resilience__clear",
];
async function source(directory) {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map(async (entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory()
          ? source(file)
          : /\.(vue|ts)$/.test(file)
            ? readFile(file, "utf8")
            : "";
      }),
    )
  ).join("\n");
}
test("retired admin layouts have no current exact component class tokens", async () => {
  const current = await source("apps/web/src");
  for (const name of retired)
    assert.doesNotMatch(current, new RegExp(`(?<![\\w-])${name}(?![\\w-])`), name);
});
test("runtime admin CSS excludes only the retired class families", async () => {
  const css = (
    await Promise.all(
      ["organization-admin.css", "mysql-resilience.css"].map((file) =>
        readFile(`apps/web/src/${file}`, "utf8"),
      ),
    )
  ).join("\n");
  for (const name of retired) assert.doesNotMatch(css, new RegExp(`\\.${name}(?![\\w-])`), name);
  for (const name of [
    "org-admin-filters",
    "org-admin-state",
    "org-admin-pagination",
    "mysql-resilience__state",
    "mysql-resilience__refresh-notice",
    "mysql-resilience__footer",
  ])
    assert.ok(css.includes(`.${name}`), name);
});
