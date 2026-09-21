import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const base = "scripts/verify-ui-phase2-teams-create-states.mjs";
let code = (await readFile(base, "utf8")).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(code).digest("hex"),
  "692d4a99de832980b014726cde94d541538d41f29bdd9ee20a4646edd56c08c2",
);
const once = (before, after) => {
  assert.equal(code.split(before).length, 2, `Inspect member-dialog driver anchor: ${before}`);
  code = code.replace(before, after);
};
const section = (start, end, replacement) => {
  assert.equal(code.split(start).length, 2);
  assert.equal(code.split(end).length, 2);
  const a = code.indexOf(start),
    b = code.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  code = code.slice(0, a) + replacement + code.slice(b);
};
code =
  `import { previewTeamsMemberParent, previewTeamsMemberDialog, previewTeamsMemberPanel, teamsMemberDialogFile, teamsMemberDialogCss } from "./lib/ui-phase2-teams-member-dialog-preview.mjs";
import { teamsParentFile } from "./lib/ui-phase2-teams-read-result-preview.mjs";
` + code;
once(
  'const output = "output/playwright/p33-create-states-r2";',
  'const output = "output/playwright/p33-member-dialog-c-r1";',
);
once(
  "[shellFile, teamsVueFile].map",
  "[shellFile, teamsVueFile, teamsParentFile, teamsMemberDialogFile].map",
);
once(
  "const replacements = new Map([",
  `const replacements = new Map([
  [teamsParentFile, previewTeamsMemberParent(originals.get(teamsParentFile))],
  [teamsMemberDialogFile, previewTeamsMemberDialog(originals.get(teamsMemberDialogFile))],`,
);
once(
  "previewTeamsCreateStates(originals.get(teamsVueFile))",
  "previewTeamsMemberPanel(originals.get(teamsVueFile))",
);
once(
  "const styles = [shellReviewCss, teamsVueCss, teamsCreateStatesCss];",
  "const styles = [shellReviewCss, teamsVueCss, teamsCreateStatesCss, teamsMemberDialogCss];",
);
once(
  "const runs = [],",
  `for (const file of ["scripts/lib/ui-phase2-teams-member-dialog-preview.mjs", "scripts/verify-ui-phase2-teams-member-dialog.mjs", "scripts/lib/ui-phase2-teams-read-result-preview.mjs", "scripts/lib/ui-phase2-teams-recovery-focus-preview.mjs"]) sources.add(file);
const runs = [],`,
);
section(
  '        if (key === "POST /api/v1/org/admin/teams") {',
  '        if (key === "GET /api/v1/me/ui-preferences")',
  `        if (key === "POST /api/v1/org/admin/teams/" + teams.teamRows[1].id + "/members") {
          return route.fulfill({ status:500, json:{} });
        }
`,
);
section(
  "      const shot = async (scene, selector) => {",
  '      await page.goto(origin + "/org-admin/teams");',
  `      const shot = async (scene) => {
        if (!capture) return;
        await page.evaluate(() => document.fonts.ready);
        const bytes = await page.screenshot({ animations: "disabled", fullPage:false });
        const file = width + "-" + scene + ".png";
        await writeFile(output + "/" + file, bytes);
        screenshots.push({ file,width,scene,captureViewport:page.viewportSize(),sha256:hash(bytes) });
      };
`,
);
section(
  '      const panel = page.locator(".org-team-panel"),',
  '      check("no unexpected requests", unexpected, []);',
  `
      const panel = page.locator(".org-team-panel"), detail = panel.locator(".org-team-detail");
      const member = teams.members.items[1], target = teams.teamRows[1];
      const memberName = member.display_name ? member.display_name + " · " + member.email : member.email;
      const writes = () => requests.filter(r=>r.key.startsWith("POST "));
      await panel.locator(".org-team-list button").nth(1).click();
      await panel.locator("#team-member-select").selectOption(member.id);
      for (const action of ["assign", "remove"]) {
        const label = action === "assign" ? "分配成员" : "移除成员";
        const title = action === "assign" ? "分配团队成员原因" : "移除团队成员原因";
        const initial = action === "assign" ? "分配团队成员" : "移除团队成员";
        const trigger = detail.getByRole("button", {name:label,exact:true});
        const before = writes().length;
        const open = async () => {
          await trigger.focus(); await page.keyboard.press("Enter");
          const dialog = page.locator(".audited-reason-dialog:modal"); await dialog.waitFor();
          await page.waitForFunction(()=>document.activeElement?.tagName === "TEXTAREA");
          return dialog;
        };
        const dialog = await open(), input = dialog.locator("textarea"), confirm = dialog.locator('button[type="submit"]');
        const close = dialog.getByRole("button",{name:"关闭原因填写",exact:true});
        check(action+" exact native modal title", await dialog.getAttribute("aria-label"), title);
        check(action+" original initial reason", await input.inputValue(), initial);
        check(action+" actual target identity", await dialog.locator("#teams-member-reason-target dd").allTextContents(), [target.name,memberName]);
        check(action+" target description is associated", await dialog.getAttribute("aria-describedby"), "teams-member-reason-target");
        check(action+" existing minimum retained", await input.getAttribute("minlength"), "2");
        check(action+" no invented maximum", await input.getAttribute("maxlength"), null);
        check(action+" input has local help", await input.getAttribute("aria-describedby"), "audited-reason-help");
        check(action+" C white surface", await dialog.evaluate(n=>getComputedStyle(n).backgroundColor), "rgb(255, 255, 255)");
        check(action+" C blue header", await dialog.locator("header").evaluate(n=>getComputedStyle(n).backgroundColor), "rgb(37, 74, 156)");
        await shot(action+"-default");
        await page.keyboard.press("Shift+Tab");
        check(action+" backward Tab reaches close", await close.evaluate(n=>n===document.activeElement));
        await shot(action+"-close-focus");
        await page.keyboard.press("Shift+Tab");
        check(action+" backward boundary wraps to submit", await confirm.evaluate(n=>n===document.activeElement));
        check(action+" exact contextual confirmation label", (await confirm.textContent()).trim(), action === "assign" ? "确认分配" : "确认移除");
        check(action+" confirmation color", await confirm.evaluate(n=>getComputedStyle(n).backgroundColor), action === "assign" ? "rgb(37, 74, 156)" : "rgb(180, 35, 53)");
        await shot(action+"-confirm-focus");
        await page.keyboard.press("Tab");
        check(action+" forward boundary wraps to close", await close.evaluate(n=>n===document.activeElement));
        await page.keyboard.press("Tab");
        check(action+" input remains next", await input.evaluate(n=>n===document.activeElement));
        await page.locator(".role-brand").evaluate(n=>n.focus());
        check(action+" native modality prevents background focus", await input.evaluate(n=>n===document.activeElement));
        await input.fill("");
        check(action+" empty required reason remains invalid", await input.evaluate(n=>n.validity.valueMissing));
        check(action+" empty confirmation disabled", await confirm.isDisabled());
        await confirm.evaluate(n=>Promise.all(n.getAnimations().map(animation=>animation.finished)));
        check(action+" disabled confirmation is grey", await confirm.evaluate(n=>getComputedStyle(n).backgroundColor), "rgb(232, 237, 244)");
        await shot(action+"-empty-disabled");
        await page.keyboard.press("Tab");
        check(action+" disabled submit skipped on forward Tab",(await page.evaluate(()=>document.activeElement.textContent)).trim(),"取消");
        await page.keyboard.press("Tab");
        check(action+" disabled boundary wraps to close",await close.evaluate(n=>n===document.activeElement));
        await page.keyboard.press("Shift+Tab");
        check(action+" disabled backward boundary wraps to cancel",(await page.evaluate(()=>document.activeElement.textContent)).trim(),"取消");
        for (const invalid of ["一", "   "]) {
          await input.fill(invalid); check(action+" short or blank reason disabled: "+JSON.stringify(invalid), await confirm.isDisabled());
        }
        check(action+" no writes from navigation or invalid values",writes().length,before);
        await input.fill("审".repeat(600));
        check(action+" long reason not truncated by invented cap",(await input.inputValue()).length,600);
        await page.keyboard.press("Escape");
        await page.waitForFunction(()=>!document.querySelector(".audited-reason-dialog:modal"));
        await page.waitForFunction(label=>document.activeElement?.textContent?.trim()===label,label);
        check(action+" Escape restores operation trigger",await trigger.evaluate(n=>n===document.activeElement));
        await open();
        check(action+" reopening resets original reason",await input.inputValue(),initial);
        await close.click();
        await page.waitForFunction(()=>!document.querySelector(".audited-reason-dialog:modal"));
        await page.waitForFunction(label=>document.activeElement?.textContent?.trim()===label,label);
        check(action+" close button cancels without write",writes().length,before);
        await open();
        await dialog.getByRole("button",{name:"取消",exact:true}).click();
        await page.waitForFunction(()=>!document.querySelector(".audited-reason-dialog:modal"));
        await page.waitForFunction(label=>document.activeElement?.textContent?.trim()===label,label);
        check(action+" cancel button keeps original selected member",await panel.locator("#team-member-select").inputValue(),member.id);
        await page.setViewportSize({width,height:560});
        await open(); await confirm.focus();
        check(action+" short screen focused confirm visible",await confirm.evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth;}));
        check(action+" short screen dialog within viewport", await dialog.evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight+1 && r.left>=0 && r.right<=innerWidth+1;}));
        await shot(action+"-short-screen");
        await page.keyboard.press("Escape");
        await page.waitForFunction(()=>!document.querySelector(".audited-reason-dialog:modal"));
        await page.setViewportSize({width,height:1000}); await open();
        const reason = action === "assign" ? "加入采购协作范围" : "结束本次采购协作";
        await input.fill("  "+reason+"  "); await confirm.click();
        await page.waitForFunction(()=>!document.querySelector(".audited-reason-dialog:modal") && document.querySelector('.org-admin-notice[data-kind="error"]'));
        check(action+" confirmed request targets original team",writes().at(-1).key,"POST /api/v1/org/admin/teams/"+target.id+"/members");
        check(action+" confirmed payload retains exact original contract",JSON.parse(writes().at(-1).body),{action,membership_id:member.id,reason});
        check(action+" manual confirmation sends once",writes().length,before+1);
        check(action+" idempotency header present",Boolean(writes().at(-1).idempotency));
        check(action+" rejected write does not show success",await page.locator(".org-admin-notice").getAttribute("data-kind"),"error");
        await page.waitForFunction(label=>document.activeElement?.textContent?.trim()===label,label);
        check(action+" rejected write restores enabled trigger",await trigger.isEnabled());
      }
      check("only initial teams read after rejected writes",requests.filter(r=>r.key==="GET /api/v1/org/admin/teams").length,1);
      check("two distinct manual idempotency keys",new Set(writes().map(r=>r.idempotency)).size,2);
      check("only explicit membership writes or bodyless GET",requests.every(r=>r.key.startsWith("POST /api/v1/org/admin/teams/") || (r.key.startsWith("GET ") && r.body===null)));
`,
);
once('    kind: "P33-C-CREATE-STATES-r2",', '    kind: "P33-MEMBER-DIALOG-C-r1",');
once(
  '          "OG-G02 write success masks reload failure; this is reproduced, not fixed or accepted.",',
  '          "Member late-success feedback policy, true backend writes/permissions and whole-page acceptance remain open.",',
);
once(
  '      "Actual App/router/unchanged parent. Latest C cancel-focus preview plus field help relationships and busy announcement. Locally intercepted writes only, no backend transaction/RBAC proof. OG-G02 refresh failure overwrite reproduced, not fixed; overall page and production acceptance remain open.",',
  '      "Actual App/router/C preview; scoped contextual member reason dialog only. Existing min2/no max, defaults, cancel/submit/modal semantics and membership request payload preserved; two locally intercepted500 writes per width. No real writes, late-success policy or production acceptance.",',
);
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
      "p33-member-dialog-composed",
    ),
  );
  process.exitCode = 1;
}
