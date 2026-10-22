import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
const retired = [
  "overview",
  "section",
  "downstream",
  "competitor-facts",
  "partial-error",
  "tabs",
  "score",
];
async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory()
        ? sources(file)
        : /\.(vue|ts)$/.test(file)
          ? readFile(file, "utf8")
          : "";
    }),
  );
  return files.flat().join("\n");
}
test("retired opportunity layouts have no current component class or runtime CSS selector", async () => {
  const source = await sources("apps/web/src");
  for (const suffix of retired) {
    const token = `opportunity-${suffix}`;
    assert.doesNotMatch(source, new RegExp(`(?<![\\w-])${token}(?![\\w-])`), token);
    for (const file of ["opportunities.css", "automatic-selection.css"]) {
      assert.doesNotMatch(
        await readFile(`apps/web/src/${file}`, "utf8"),
        new RegExp(`\\.${token}(?![\\w-])`),
        file,
      );
    }
  }
});
test("active opportunity filters, modal and evidence rules survive retirement", async () => {
  const base = await readFile("apps/web/src/opportunities.css", "utf8");
  for (const token of [
    "opportunity-modal",
    "opportunity-filters",
    "opportunity-evidence",
    "opportunity-decisions",
    "opportunity-pagination",
  ])
    assert.ok(base.includes(`.${token}`), token);
  const review = await readFile("apps/web/src/automatic-selection.css", "utf8");
  assert.match(review, /\.opportunity-workspace--review \.opportunity-modal button/);
  assert.match(review, /opportunity-technical-details summary/);
});

test("current opportunity dialogs keep solid actions and an unblurred backdrop", async () => {
  const css = await readFile("apps/web/src/opportunities.css", "utf8");
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|backdrop-filter:\s*blur/);
  assert.match(css, /\.opportunity-modal::backdrop\s*\{[^}]*backdrop-filter:\s*none/s);
  assert.match(
    css,
    /\.opportunity-modal footer button:last-child\s*\{[^}]*background:\s*var\(--so-primary\)/s,
  );
});
