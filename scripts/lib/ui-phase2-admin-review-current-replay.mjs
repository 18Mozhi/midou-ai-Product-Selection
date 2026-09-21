import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { adminReviewCaptureStages } from "./ui-phase2-admin-review-historical-capture.mjs";

export const adminReviewReplayRoot = "output/playwright/p44-current-replay-r3";
export const adminReviewReplayStyle =
  "design-plans/ui-phase-2-2026-09-07/implementation/admin-current-replay.css";
export const adminReviewStyleImport =
  "import " +
  JSON.stringify("/@fs/" + path.resolve(adminReviewReplayStyle).replaceAll("\\", "/")) +
  ";\n";

// Original URL assertions run unchanged. Cross-run comparison ignores only the reserved loopback port.
export function assertAdminReviewChecks(stage, current, original) {
  assert.ok(Object.hasOwn(adminReviewCaptureStages, stage));
  const names =
    stage === "comparison"
      ? ["comparison URL untouched"]
      : stage === "create"
        ? []
        : stage.startsWith("boundary-")
          ? ["keyboard traversal no URL changes", "comparison changes no URL"]
          : ["comparison changes no URL"];
  const widths = stage.startsWith("boundary-") ? [1200, 1201] : [390, 760, 761, 1440];
  const normalize = (checks) => {
    for (const name of names)
      assert.deepEqual(
        checks.filter((c) => c.name === name).map((c) => c.width),
        widths,
      );
    return checks.map((check) => {
      if (!names.includes(check.name)) return check;
      const url = new URL(check.actual);
      assert.equal(url.protocol, "http:");
      assert.equal(url.hostname, "127.0.0.1");
      assert.ok(Number(url.port) > 0 && Number(url.port) <= 65535);
      assert.equal(url.username + url.password + url.hash, "");
      assert.equal(url.pathname + url.search, "/platform-admin/admins?keep=p44");
      return { ...check, actual: "http://127.0.0.1:PORT" + url.pathname + url.search };
    });
  };
  assert.deepEqual(
    normalize(current),
    normalize(original),
    `${stage}: original checks, reserved port excluded`,
  );
}
export function adminReviewReplayDriver(stage, source) {
  assert.ok(Object.hasOwn(adminReviewCaptureStages, stage), "Unknown P44 replay stage");
  const entry = adminReviewCaptureStages[stage];
  source = source.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    entry.driverHash,
    "Original P44 driver changed; review before replaying",
  );
  const before = stage.startsWith("boundary-")
    ? 'const output = "output/playwright/p44-page-boundary-vue-" + (baseline ? "baseline" : "preview");'
    : `const output = "${entry.folder}";`;
  assert.equal(source.split(before).length, 2, "One exact output-only substitution");
  source = source.replace(before, `const output = "${adminReviewReplayRoot}/${stage}";`);
  assert.equal(source.split("const host = ").length, 2);
  source = source.replace(
    "const host = ",
    `sources.add(${JSON.stringify(adminReviewReplayStyle)});\nconst host = `,
  );
  const hostAnchor = "document.documentElement.dataset.design=";
  assert.equal(source.split(hostAnchor).length, 2);
  source = source.replace(hostAnchor, adminReviewStyleImport + hostAnchor);
  const ast = ts.createSourceFile(entry.driver, source, ts.ScriptTarget.Latest, true);
  const replacements = ast.statements.filter(ts.isImportDeclaration).map((node) => {
    const specifier = node.moduleSpecifier.text;
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
