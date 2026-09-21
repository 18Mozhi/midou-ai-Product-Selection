import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { userLifecycleReviewCaptureStages } from "./ui-phase2-user-lifecycle-review-historical-capture.mjs";

export const userLifecycleReviewReplayRoot = "output/playwright/p43-lifecycle-current-replay-r1";
export function userLifecycleReviewReplayDriver(stage, source) {
  assert.ok(Object.hasOwn(userLifecycleReviewCaptureStages, stage), "Unknown P43 replay stage");
  assert.ok(
    ["create-current", "password-current"].includes(stage),
    "Only current lifecycle replay is allowed",
  );
  const entry = userLifecycleReviewCaptureStages[stage];
  source = source.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    entry.driverHash,
    "Original P43 driver changed; review before replaying",
  );
  const before = `const output = "${entry.folder.slice(0, -7)}" + (baseline ? "baseline" : "current");`;
  assert.equal(source.split(before).length, 2, "One exact output-only substitution");
  source = source.replace(before, `const output = "${userLifecycleReviewReplayRoot}/${stage}";`);
  const ast = ts.createSourceFile(entry.driver, source, ts.ScriptTarget.Latest, true);
  const replacements = ast.statements.filter(ts.isImportDeclaration).map((node) => {
    const specifier =
      node.moduleSpecifier.text === "./lib/ui-phase2-user-page-preview.mjs"
        ? "./lib/ui-phase2-user-page-current-preview.mjs"
        : node.moduleSpecifier.text;
    const resolved = specifier.startsWith(".")
      ? pathToFileURL(path.resolve(path.dirname(entry.driver), specifier)).href
      : import.meta.resolve(specifier);
    return {
      start: node.moduleSpecifier.getStart(ast),
      end: node.moduleSpecifier.end,
      text: JSON.stringify(resolved),
    };
  });
  for (const item of replacements.reverse())
    source = source.slice(0, item.start) + item.text + source.slice(item.end);
  return source;
}
