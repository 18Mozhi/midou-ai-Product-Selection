import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// Reuse the exact reviewed flow without changing its captures or source bindings.
const base = "scripts/verify-ui-phase2-teams-read-result.mjs";
let code = (await readFile(base, "utf8")).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(code).digest("hex"),
  "6f5526facc1381f51f84873b079a32d492de42d0ca30b95dd0fba74370e50f74",
);
const args = process.argv.slice(2);
assert.equal(new Set(args).size, args.length);
assert.ok(args.every((arg) => ["--smoke", "--capture", "--baseline", "--external"].includes(arg)));
assert.ok(!(args.includes("--baseline") && args.includes("--external")));
assert.ok(!(args.includes("--smoke") && args.includes("--capture")));
const baseline = args.includes("--baseline"),
  external = args.includes("--external");
const mode = baseline ? "baseline" : external ? "external" : "revised";
process.argv = [
  process.execPath,
  process.argv[1],
  ...args.filter((arg) => ["--smoke", "--capture"].includes(arg)),
];
const once = (before, after) => {
  assert.equal(code.split(before).length, 2, `Inspect focus driver anchor: ${before}`);
  code = code.replace(before, after);
};
once(
  '      await warning.getByRole("button", { name: "重新读取列表", exact: true }).click();',
  '      await warning.getByRole("button", { name: "重新读取列表", exact: true }).focus();\n      await page.keyboard.press("Enter");',
);
once(
  "      releaseRead();",
  `
      ${external ? 'await page.locator(".role-brand").focus();\n      check("user can move focus outside pending feedback", await page.locator(".role-brand").evaluate(n => n === document.activeElement));' : ""}
      releaseRead();`,
);
once(
  '      await shot("recovered", ".org-admin-notice");',
  `
      await page.evaluate(() => new Promise(done => requestAnimationFrame(done)));
      const resultNotice = page.locator(".org-admin-notice");
      check("${mode} recovery focus destination", await page.evaluate(() => {
        const active = document.activeElement;
        return active === document.body ? "body" : active.matches(".org-admin-notice") ? "notice" : active.matches(".role-brand") ? "brand" : active.tagName;
      }), ${JSON.stringify(baseline ? "body" : external ? "brand" : "notice")});
      ${
        !baseline && !external
          ? `check("success focus is not a new Tab stop", await resultNotice.getAttribute("tabindex"), "-1");
      check("success focus has a visible blue outline", await resultNotice.evaluate(n => [getComputedStyle(n).outlineWidth,getComputedStyle(n).outlineColor]), ["3px", "rgb(77, 121, 255)"]);
      check("focused success region is visible above fixed controls", await resultNotice.evaluate(n => {
        const r = n.getBoundingClientRect(), bar = document.querySelector(".role-mobile-nav");
        const b = bar?.getClientRects().length ? bar.getBoundingClientRect() : null;
        return r.top >= 0 && r.bottom <= innerHeight && (!b || r.bottom <= b.top || r.top >= b.bottom);
      }));`
          : ""
      }
      await shot("recovery-focus", ${JSON.stringify(external ? ".role-topbar" : ".org-admin-notice")});
      check("capture preserves focus destination", await page.evaluate(() => {
        const active = document.activeElement;
        return active === document.body ? "body" : active.matches(".org-admin-notice") ? "notice" : active.matches(".role-brand") ? "brand" : active.tagName;
      }), ${JSON.stringify(baseline ? "body" : external ? "brand" : "notice")});
      ${
        !external
          ? `await page.keyboard.press("Tab");
      check("next Tab reaches team directory", await page.evaluate(() => ({tag:document.activeElement.tagName,text:document.activeElement.textContent.trim()})), {tag:"A",text:"01 团队目录"});`
          : ""
      }
`,
);
code = code.replaceAll("p33-read-result-${status}-r2", `p33-recovery-focus-${mode}-\${status}-r2`);
code = code.replaceAll("P33-C-READ-RESULT-r2", `P33-C-RECOVERY-FOCUS-${mode}-r2`);
if (!baseline) {
  once(
    "`import { previewTeamsReadResult, teamsParentFile, teamsReadResultComponent }",
    '`import { previewTeamsRecoveryFocus } from "./lib/ui-phase2-teams-recovery-focus-preview.mjs";\nimport { previewTeamsReadResult, teamsParentFile, teamsReadResultComponent }',
  );
  once(
    "previewTeamsReadResult(originals.get(teamsParentFile))",
    "previewTeamsRecoveryFocus(originals.get(teamsParentFile))",
  );
}
once(
  "    const ast = ts.createSourceFile(base, code, ts.ScriptTarget.Latest, true);",
  `
    replace('        if (!capture) return;', '        if (!capture || scene !== "recovery-focus") return;');
    replace('await target.screenshot({ animations: "disabled" })', 'await page.screenshot({ animations: "disabled", fullPage: false })');
    replace('const runs = [],', 'sources.add("scripts/verify-ui-phase2-teams-recovery-focus.mjs");\\n sources.add("scripts/lib/ui-phase2-teams-recovery-focus-preview.mjs");\\n const runs = [],');
    const ast = ts.createSourceFile(base, code, ts.ScriptTarget.Latest, true);`,
);
const resolutions = {};
for (const file of [base, "scripts/verify-ui-phase2-teams-create-states.mjs"]) {
  const source = await readFile(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements.filter(ts.isImportDeclaration)) {
    const specifier = node.moduleSpecifier.text;
    if (!specifier.startsWith(".")) resolutions[specifier] = import.meta.resolve(specifier);
  }
}
once(": import.meta.resolve(specifier);", `: ${JSON.stringify(resolutions)}[specifier];`);
const ast = ts.createSourceFile(base, code, ts.ScriptTarget.Latest, true);
for (const node of ast.statements.filter(ts.isImportDeclaration).reverse()) {
  const specifier = node.moduleSpecifier.text;
  const resolved = specifier.startsWith(".")
    ? pathToFileURL(path.resolve(path.dirname(base), specifier)).href
    : import.meta.resolve(specifier);
  code =
    code.slice(0, node.moduleSpecifier.getStart(ast)) +
    JSON.stringify(resolved) +
    code.slice(node.moduleSpecifier.end);
}
try {
  await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
} catch (error) {
  console.error(
    String(error?.stack ?? error).replaceAll(
      /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
      "p33-recovery-focus-composed",
    ),
  );
  process.exitCode = 1;
}
