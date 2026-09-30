import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = "apps/web/src/components";
function vueFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? vueFiles(path) : entry.name.endsWith(".vue") ? [path] : [];
  });
}

test("UiStatePanel consumers wire secondary actions or explicitly hide them", () => {
  const unhandled = [];
  for (const file of vueFiles(root)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/<UiStatePanel\b[\s\S]*?\/>/g)) {
      const tag = match[0];
      if (/@secondary\s*=/.test(tag)) continue;
      if (/(?::hide-secondary|hide-secondary)\s*=\s*["']true["']/.test(tag)) continue;
      const line = source.slice(0, match.index).split("\n").length;
      unhandled.push(`${file}:${line}`);
    }
  }
  assert.deepEqual(unhandled, []);
});
