import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

let runner = (await readFile("scripts/verify-ui-phase2-commercial-create.mjs", "utf8")).replaceAll(
  "\r\n",
  "\n",
);
assert.equal(
  createHash("sha256").update(runner).digest("hex"),
  "29950b8199909b9afb7020d11561576cabcdb5a2e117472ccd024ae4497d601d",
);
const replace = (before, after) => {
  assert.equal(runner.split(before).length, 2, before);
  runner = runner.replace(before, after);
};
replace(
  'output = "output/playwright/p58-create-current-review"',
  'output = "output/playwright/p58-create-focus-review"',
);
replace(
  'implementation/commercial-create-preview.css";',
  'implementation/commercial-create-outcome-preview.css";',
);
replace(
  "preview = previewCommercialCreate(source);",
  "preview = previewCommercialCreateFocus(source), nativePreview = previewCommercialCreateOutcome(source);",
);
replace(
  '"scripts/verify-ui-phase2-commercial-create.mjs",',
  '"scripts/verify-ui-phase2-commercial-create.mjs",\n  "scripts/verify-ui-phase2-commercial-create-focus.mjs",\n  "scripts/lib/ui-phase2-commercial-create-write-preview.mjs",\n  "scripts/lib/ui-phase2-commercial-create-outcome-preview.mjs",\n  "scripts/lib/ui-phase2-commercial-create-focus-preview.mjs",',
);
replace(
  '      plugins:\n        mode === "baseline"\n          ? []\n          : [',
  "      plugins: [",
);
replace(
  "return { code: preview, map: null };",
  'return { code: mode === "review" ? preview : nativePreview, map: null };',
);
replace(
  "      try {\n        const page",
  "      let releaseWrite;\n      try {\n        const page",
);
replace(
  "      } finally {\n        await context.close();",
  "      } finally {\n        releaseWrite?.();\n        await context.close();",
);
const routeStart = runner.indexOf('        await page.route("**/*",'),
  routeEnd = runner.indexOf("        await page.goto(", routeStart);
assert.ok(routeStart > 0 && routeEnd > routeStart);
runner =
  runner.slice(0, routeStart) +
  `
        let writes=0;
        const gate=new Promise(resolve=>{releaseWrite=resolve;});
        await page.route("**/*", async route=>{
          const req=route.request(),url=new URL(req.url()),key=req.method()+" "+url.pathname;
          if(url.origin!==origin){unexpected.push(key);return route.abort();}
          if(!url.pathname.startsWith("/api/"))return route.continue();
          if(!["GET /api/v1/me/navigation","GET /api/v1/auth/session-status","GET /api/v1/platform/commercial","POST /api/v1/platform/commercial/plans"].includes(key)){unexpected.push(key);return route.abort();}
          requests.push({key,body:req.postData(),idempotencyKey:req.headers()["idempotency-key"]??null});
          if(key.startsWith("POST ")){writes++;await gate;return route.fulfill({status:409,json:{error:{code:"local_focus_conflict",message:"本地拒绝样例",action_hint:"标识发生冲突，请核对后再创建。"},request_id:"p58-focus-local"}});}
          return route.fulfill({json:{data:url.pathname.endsWith("navigation")?fixtures.navigation:url.pathname.endsWith("session-status")?{authenticated:true}:fixtures.data,request_id:"p58-focus-read"}});
        });
` +
  runner.slice(routeEnd);
const flowStart = runner.indexOf('        await expect(page.getByText("380 / 1050"))'),
  last =
    "        runs.push({ mode, width, checks, requests, backgroundSha256: hash(background) });",
  flowEnd = runner.indexOf(last, flowStart) + last.length;
assert.ok(flowStart > 0 && flowEnd > flowStart);
runner =
  runner.slice(0, flowStart) +
  `
        await expect(page.getByText("380 / 1050")).toBeVisible();
        await trigger.focus();await page.keyboard.press("Enter");await expect(dialog).toBeVisible();
        const close=dialog.getByRole("button",{name:"关闭新建配额方案"}),submit=dialog.locator("footer button.primary"),cancel=dialog.getByRole("button",{name:"取消",exact:true});
        const fields=["内部标识","方案名称","方案说明","采集任务","外部接口请求","报表导出","创建原因"].map(name=>dialog.getByLabel(name,{exact:true}));
        const picture=async(suffix)=>{
          if(!capture)return;
          await page.evaluate(()=>document.fonts.ready);
          const bytes=await dialog.screenshot({animations:"disabled"}),file=mode+"-"+width+"-"+suffix+".png";
          await writeFile(output+"/"+file,bytes);
          screenshots.push({file,mode,width,suffix,sha256:hash(bytes),pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20)});
        };
        const active=()=>page.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.getAttribute("aria-label")??document.activeElement?.textContent?.slice(0,45)}));
        const checkBoundary=async(stage,stops)=>{
          await stops[0].focus();await page.keyboard.press("Shift+Tab");
          const reverse=await active(),reverseTarget=await stops.at(-1).evaluate(el=>el===document.activeElement);
          checks.push({name:stage+" reverse observed",actual:reverse});
          check(stage+" reverse wraps immediately",reverseTarget,mode==="review");
          await stops.at(-1).focus();await page.keyboard.press("Tab");
          const forward=await active(),forwardTarget=await stops[0].evaluate(el=>el===document.activeElement);
          checks.push({name:stage+" forward observed",actual:forward});
          check(stage+" forward wraps immediately",forwardTarget,mode==="review");
          if(mode==="review")for(const direction of ["Tab","Shift+Tab"]){
            await stops[0].focus();
            for(let step=1;step<=stops.length*2;step++){
              await page.keyboard.press(direction);
              const index=direction==="Tab"?step%stops.length:(stops.length-step%stops.length)%stops.length;
              await expect(stops[index]).toBeFocused();
              check(stage+" "+direction+" step"+step,await dialog.evaluate(el=>el.contains(document.activeElement)));
            }
          }
          await close.focus();
        };
        check("native initial focus inside",await dialog.evaluate(el=>el.contains(document.activeElement)));
        checks.push({name:"native initial focus observed",actual:await active()});
        check("native top-layer retained",await dialog.evaluate(el=>el.matches(":modal")));
        await picture("initial");
        await checkBoundary("default",[close,...fields,cancel,submit]);
        await picture("default-boundary");
        await fields[0].fill("basic_2026");await fields[1].fill("审核样例配额方案");await fields[6].fill("验证创建窗键盘闭环");
        await submit.focus();await page.keyboard.press("Enter");await expect.poll(()=>writes).toBe(1);
        const heading=dialog.getByRole("heading",{name:"创建配额方案草稿",exact:true});
        await expect(heading).toBeFocused();
        check("busy all ten form controls disabled",await dialog.locator("input:disabled,textarea:disabled,button:disabled").count(),10);
        for(const direction of ["Tab","Shift+Tab"]){
          await heading.focus();await page.keyboard.press(direction);
          const remains=await heading.evaluate(el=>el===document.activeElement);
          checks.push({name:"busy "+direction+" observed",actual:await active()});
          check("busy "+direction+" stays on heading",remains,mode==="review");
          if(mode==="review")for(let step=0;step<3;step++){await page.keyboard.press(direction);await expect(heading).toBeFocused();check("busy repeated "+direction+step,true);}
          if(mode==="review")check("busy "+direction+" heading visible",await heading.evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest("dialog").getBoundingClientRect();return r.top>=d.top&&r.bottom<=d.bottom&&r.top>=0&&r.bottom<=innerHeight;}));
        }
        await heading.focus();await picture("busy-heading");
        await page.keyboard.press("Escape");await expect(dialog).toBeVisible();check("pending Escape guard unchanged",true);
        releaseWrite();await expect(submit).toBeEnabled();
        await expect(dialog.getByRole("alert")).toContainText("标识发生冲突");
        const summary=dialog.locator(".p58-draft-feedback summary"),copy=dialog.locator(".p58-draft-feedback").getByRole("button",{name:"复制请求编号",exact:true});
        await expect(copy).not.toBeVisible();
        await checkBoundary("error-collapsed",[close,summary,...fields,cancel,submit]);
        await picture("error-collapsed");
        await summary.focus();await page.keyboard.press("Enter");await expect(copy).toBeVisible();
        await checkBoundary("error-expanded",[close,summary,copy,...fields,cancel,submit]);
        await picture("error-expanded");
        await summary.focus();await page.keyboard.press("Enter");await expect(copy).not.toBeVisible();
        if(mode==="review"){
          await summary.focus();await page.keyboard.press("Tab");await expect(fields[0]).toBeFocused();check("recollapse skips hidden copy",true);
        }
        await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();check("escape restores original trigger",true);
        await page.keyboard.press("Enter");await expect(dialog).toBeVisible();check("reopen focus stays inside",await dialog.evaluate(el=>el.contains(document.activeElement)));checks.push({name:"reopen focus observed",actual:await active()});
        await cancel.click();await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();check("cancel restores original trigger",true);
        check("one local rejected POST",writes,1);
        check("one commercial GET",requests.filter(r=>r.key==="GET /api/v1/platform/commercial").length,1);
        check("no unexpected network",unexpected,[]);check("no runtime errors",errors,[]);
        runs.push({mode,width,checks,requests});
` +
  runner.slice(flowEnd);
replace(
  "  await includeImportedStyleSources(sources, read);",
  `  const appSources=new Set([...sources].filter(file=>file.startsWith("apps/web/")));
  await includeImportedStyleSources(appSources,read);for(const file of appSources)sources.add(file);
  sources.add("design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-preview.css");
  sources.add("design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-write-preview.css");`,
);
replace('kind: "P58-CREATE-CURRENT-REVIEW-r1"', 'kind: "P58-CREATE-FOCUS-REVIEW-r1"');
replace(
  '"Actual App and existing E2E fixtures. Only create-dialog presentation/help and equivalent HTML-v pattern escaping in review. Production/GET/POST/API/permissions unchanged; no submit or real writes, no busy/error/save/complete-page acceptance."',
  '"Actual App, baseline is prior C outcome preview without the new keydown handler, review adds only local creation-dialog focus boundary. Same styles; original production/shared modal untouched. Default, all-disabled pending, rejected collapsed/expanded details use one local409 POST per run. No real writes, clipboard, screen reader, soft keyboard, other dialogs/lifecycle or production acceptance."',
);
replace(
  "本地样例，未提交。连续局部图覆盖滚动区域；不代表保存或完整页面验收。",
  "仅本地409拒绝。基线是先前C预览；只比较创建窗键盘闭环，不代表真实创建、读屏或整页验收。",
);
replace("P58 实际 Vue 创建窗 · C 方向", "P58 创建窗 · 键盘边界验证");
runner =
  'import { previewCommercialCreateFocus } from "./lib/ui-phase2-commercial-create-focus-preview.mjs";\nimport { previewCommercialCreateOutcome } from "./lib/ui-phase2-commercial-create-outcome-preview.mjs";\n' +
  runner;
runner = runner.replace(
  /from "([^"\n]+)"/g,
  (_, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
