import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export const teamsAnchorBase = "scripts/verify-ui-phase2-teams-vue-c.mjs";
export const teamsAnchorBaseHash =
  "b5eb47ed230f5a2b218b96577ddab8f27f81b49581535f6c6651db3ee8dc599a";

export const teamsAnchorScenario = `
        if (mode === "review") {
          const identity = await panel.elementHandle();
          const readState = async () => ({
            team: await detail.locator("h3").textContent(),
            member: await panel.locator("#team-member-select").inputValue(),
            query: await directory.locator('input[type="search"]').inputValue(),
            sort: await directory.locator(".org-team-toolbar select").inputValue(),
            name: await form.locator("#team-name").inputValue(),
            reason: await form.locator("#team-reason").inputValue(),
            lead: await form.locator("#team-lead").inputValue(),
            workflow: await form.locator("#team-workflow").inputValue(),
          });
          const before = await readState();
          const links = panel.locator(".teams-c-index a");
          const settle = async (hash) => {
            await page.waitForFunction((value) => location.hash === value, hash);
            await page.evaluate(() => new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve))));
          };
          const preserved = async (step) => {
            check(step + " component retained", await identity.evaluate((n) =>
              n.isConnected && n === document.querySelector(".org-team-panel")));
            check(step + " original draft and selection retained", await readState(), before);
            check(step + " pathname unchanged", new URL(page.url()).pathname, "/org-admin/teams");
          };
          const tabTarget = async (selector, step) => {
            await page.keyboard.press("Tab");
            check(step + " next Tab enters target region", await page.locator(selector).evaluate((n) =>
              n === document.activeElement));
            check(step + " keyboard focus visible and unobscured", await page.locator(selector).evaluate((n) => {
              const r = n.getBoundingClientRect(), style = getComputedStyle(n);
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return n.matches(":focus-visible") && parseFloat(style.outlineWidth) > 0 &&
                style.outlineStyle !== "none" && r.top >= 0 && r.bottom <= innerHeight &&
                r.left >= 0 && r.right <= innerWidth + 1 && (hit === n || n.contains(hit));
            }));
          };
          await links.nth(0).click();
          await settle("#p33-directory");
          await preserved("directory click");
          await tabTarget(".org-team-status-tabs button:first-child", "directory");
          await links.nth(1).focus();
          await page.keyboard.press("Enter");
          await settle("#p33-collaboration");
          await preserved("collaboration Enter");
          await tabTarget("#team-member-select", "collaboration");
          await page.goBack();
          await settle("#p33-directory");
          await preserved("back");
          await page.goForward();
          await settle("#p33-collaboration");
          await preserved("forward");
          await page.goBack();
          await settle("#p33-directory");
          await page.goBack();
          await settle("");
          await preserved("return to initial history entry");
          check("hash navigation never reloaded the document", await page.evaluate(() =>
            performance.getEntriesByType("navigation").length), 1);
          await identity.dispose();
        }
`;

export const teamsAnchorEdits = [
  ['["--capture", "--smoke"].includes(a)', '["--smoke"].includes(a)'],
  ['const capture = process.argv.includes("--capture"),', "const capture = false,"],
  [
    'for (const mode of smoke ? ["review"] : ["baseline", "review"]) {',
    'for (const mode of ["review"]) {',
  ],
  [
    '        await shot("create", ".org-team-create");',
    teamsAnchorScenario + '        await shot("create", ".org-team-create");',
  ],
  ['    kind: "P33-ACTUAL-VUE-C-r4",', '    kind: "P33-C-ANCHOR-INTERACTIONS-r1",'],
];

// Compose only the test driver; preserve the r4 Vue/CSS/capture sources and original checks.
export function teamsAnchorDriver(input) {
  let source = input.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    teamsAnchorBaseHash,
    "Inspect changed P33 r4 driver before composition",
  );
  for (const [before, after] of teamsAnchorEdits) {
    assert.equal(source.split(before).length, 2, "One exact P33 anchor driver edit");
    source = source.replace(before, after);
  }
  const ast = ts.createSourceFile(teamsAnchorBase, source, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements.filter(ts.isImportDeclaration).reverse()) {
    const specifier = node.moduleSpecifier.text;
    const resolved = specifier.startsWith(".")
      ? pathToFileURL(path.resolve(path.dirname(teamsAnchorBase), specifier)).href
      : import.meta.resolve(specifier);
    source =
      source.slice(0, node.moduleSpecifier.getStart(ast)) +
      JSON.stringify(resolved) +
      source.slice(node.moduleSpecifier.end);
  }
  return source;
}
