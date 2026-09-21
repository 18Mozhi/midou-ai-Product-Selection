import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Reuse the immutable local-only App/fixture/capture harness without editing earlier evidence.
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
  'output = "output/playwright/p58-edit-current-review"',
);
replace(
  'implementation/commercial-create-preview.css";',
  'implementation/commercial-edit-preview.css";',
);
replace(
  'import { previewCommercialCreate } from "./lib/ui-phase2-commercial-create-preview.mjs";',
  'import { previewCommercialEdit } from "./lib/ui-phase2-commercial-edit-preview.mjs";',
);
replace("preview = previewCommercialCreate(source);", "preview = previewCommercialEdit(source);");
replace(
  '"scripts/lib/ui-phase2-commercial-create-preview.mjs",',
  '"scripts/lib/ui-phase2-commercial-edit-preview.mjs",\n  "scripts/verify-ui-phase2-commercial-edit.mjs",',
);
runner = runner.replaceAll("p58-draft-review", "p58-revise-review");
replace(
  "console.log(`P58 create ${mode} ${origin}`);",
  "console.log(`P58 edit ${mode} ${origin}`);",
);
replace(
  'name: "新建配额方案", exact: true }),\n          dialog = page.getByRole("dialog", { name: "新建配额方案"',
  'name: "编辑", exact: true }),\n          dialog = page.getByRole("dialog", { name: "编辑配额方案"',
);
const start = runner.indexOf('        await expect(page.getByText("380 / 1050"))'),
  last =
    "        runs.push({ mode, width, checks, requests, backgroundSha256: hash(background) });",
  end = runner.indexOf(last, start) + last.length;
assert.ok(start > 0 && end > start);
runner =
  runner.slice(0, start) +
  `
        await expect(page.getByText("380 / 1050")).toBeVisible();
        const background = await page.locator(".commercial").screenshot({ animations: "disabled" });
        await trigger.focus();await page.keyboard.press("Enter");await expect(dialog).toBeVisible();
        const fields=dialog.locator("input,textarea,select"), submit=dialog.locator("footer button.primary");
        const initial=await fields.evaluateAll(els=>els.map(el=>el.value));
        check("native modal open",await dialog.evaluate(el=>el.matches(":modal")));
        check("seven original fields",await fields.count(),7);
        check("two original buttons",await dialog.getByRole("button").count(),2);
        check("original field values",initial,[fixtures.data.plans[0].name,fixtures.data.plans[0].description,"100","1000","20","active","编辑配额方案"]);
        check("initial name focus unchanged",await fields.nth(0).evaluate(el=>el===document.activeElement));
        check("no dialog horizontal overflow",await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
        check("unchanged native status options",await dialog.locator("option").evaluateAll(els=>els.map(el=>el.value)),["draft","active","retired"]);
        if(mode==="review"){
          check("all nine controls44px",await dialog.locator("input,textarea,select,button").evaluateAll(els=>els.every(el=>el.getBoundingClientRect().height>=44)));
          await expect(dialog.locator(".p58-revise-version")).toHaveText("基于版本 2");check("version comes from selected record",true);
          await expect(submit).toHaveText("预览修改影响");check("preview label describes original action",true);
          check("header help uses C sans typography",await dialog.locator("header p").evaluateAll(els=>els.every(el=>{const s=getComputedStyle(el);return s.fontFamily.includes("Microsoft YaHei")&&s.letterSpacing==="normal";})));
        }
        const picture=async(target,suffix,part)=>{
          if(!capture)return;
          await page.evaluate(()=>document.fonts.ready);
          const geometry=await target.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,modal:el.matches(":modal")};});
          assert.ok(geometry.modal&&geometry.y>=0&&geometry.y+geometry.height<=900+1);
          const bytes=await target.screenshot({animations:"disabled"}),file=mode+"-"+width+"-"+suffix+"-part"+part+".png";
          await writeFile(output+"/"+file,bytes);
          screenshots.push({file,mode,width,suffix,part,geometry,sha256:hash(bytes),pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20)});
        };
        const sequence=async(target,suffix)=>{
          const size=await target.evaluate(el=>({total:el.scrollHeight,height:el.clientHeight}));let part=0;
          for(let offset=0;;offset+=Math.max(100,size.height-80)){
            const y=Math.min(offset,Math.max(0,size.total-size.height));
            await target.evaluate((el,y)=>el.scrollTop=y,y);await picture(target,suffix,++part);
            if(y>=size.total-size.height)break;
          }
        };
        await sequence(dialog,"initial");
        // Use actual typing for minlength, since programmatic .value does not activate tooShort.
        await fields.nth(6).fill("");await fields.nth(6).pressSequentially("审");
        await submit.click();await expect(dialog).toBeVisible();
        check("original reason2 native restriction",await fields.nth(6).evaluate(el=>el.validity.tooShort));
        check("invalid form does not open confirmation",await page.locator('dialog[open][aria-label="确认配额变更"]').count(),0);
        await sequence(dialog,"reason-invalid");
        await fields.nth(6).fill("本地审核修改原因");
        for(const [value,flag] of [["-1","rangeUnderflow"],["1000000001","rangeOverflow"],["0.5","stepMismatch"]]){
          await fields.nth(2).fill(value);check("quota native "+flag,await fields.nth(2).evaluate((el,flag)=>el.validity[flag],flag));
        }
        await fields.nth(0).fill("审核修改后的配额方案");
        await fields.nth(1).fill("本地视觉样例；只预览，不保存。");
        await fields.nth(2).fill("125");await fields.nth(3).fill("1500");await fields.nth(4).fill("30");
        await fields.nth(5).selectOption("retired");
        check("edited form remains valid",await dialog.locator("form").evaluate(el=>el.checkValidity()));
        await sequence(dialog,"filled");
        await submit.focus();await page.keyboard.press("Enter");
        const confirmation=page.getByRole("dialog",{name:"确认配额变更",exact:true});
        await expect(confirmation).toBeVisible();await expect(dialog).not.toBeVisible();
        check("one native modal in impact step",await page.locator("dialog:modal").count(),1);
        await expect(confirmation.getByRole("heading",{name:"确认保存配额方案修改？"})).toBeVisible();
        await expect(confirmation.locator(".commercial-impact-preview")).toContainText("3 个当前仍分配该方案的组织；方案 成长配额方案");
        check("existing impacted organization count retained",true);
        check("original quota and status comparison",await confirmation.locator("dl > div").evaluateAll(els=>els.map(el=>({label:el.querySelector("dt").textContent.trim(),before:el.querySelector("dd span").textContent.trim(),after:el.querySelector("dd strong").textContent.trim()}))),[
          {label:"采集任务",before:"100",after:"125"},{label:"外部接口请求",before:"1000",after:"1500"},{label:"报表导出",before:"20",after:"30"},{label:"方案状态",before:"启用",after:"已退役"}
        ]);
        await sequence(confirmation,"original-impact");
        check("preview has no write",requests.filter(r=>!r.key.startsWith("GET ")).length,0);
        await confirmation.getByRole("button",{name:"取消",exact:true}).click();
        await expect(confirmation).not.toBeVisible();await expect(dialog).not.toBeVisible();
        check("cancel preview closes both dialogs",await page.locator("dialog[open]").count(),0);
        checks.push({name:"observed confirmation cancel focus",actual:await page.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.trim().slice(0,50)}))});
        await trigger.click();await expect(dialog).toBeVisible();
        check("reopen restores persisted sample not canceled edits",await fields.evaluateAll(els=>els.map(el=>el.value)),initial);
        await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();check("edit Escape returns trigger",true);
        await trigger.click();await dialog.getByRole("button",{name:"取消",exact:true}).click();await expect(trigger).toBeFocused();check("edit cancel returns trigger",true);
        check("one commercial GET",requests.filter(r=>r.key.endsWith("/commercial")).length,1);
        check("no writes or bodies",requests.every(r=>r.key.startsWith("GET ")&&r.body===null));
        check("no unexpected network",unexpected,[]);check("no runtime errors",errors,[]);
        runs.push({mode,width,checks,requests,backgroundSha256:hash(background)});
` +
  runner.slice(end);
replace('kind: "P58-CREATE-CURRENT-REVIEW-r1"', 'kind: "P58-EDIT-CURRENT-REVIEW-r1"');
replace(
  '"Actual App and existing E2E fixtures. Only create-dialog presentation/help and equivalent HTML-v pattern escaping in review. Production/GET/POST/API/permissions unchanged; no submit or real writes, no busy/error/save/complete-page acceptance."',
  '"Actual App and original E2E fixtures. Only edit dialog template/help/button label/C styles transformed. Whole script and confirmation unchanged. Native validation and edit-to-impact-to-cancel exercised; cancel closes without returning draft, reopening restores original sample. Local GET only, no PATCH/POST/real writes. Strict focus loop, full confirmation redesign, save/permissions/version conflicts/lifecycle/full page remain unaccepted."',
);
replace("P58 创建窗审核", "P58 编辑窗审核");
replace("P58 实际 Vue 创建窗 · C 方向", "P58 实际 Vue 编辑窗 · C 方向");
replace(
  "本地样例，未提交。连续局部图覆盖滚动区域；不代表保存或完整页面验收。",
  "本地样例，仅进入影响预览后取消；没有写请求。连续局部图覆盖编辑窗；original-impact 为未改造的原确认窗，不在本轮视觉审核内。",
);
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
