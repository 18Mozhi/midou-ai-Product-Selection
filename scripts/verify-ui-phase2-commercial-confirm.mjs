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
  'output = "output/playwright/p58-confirm-current-review"',
);
replace(
  'implementation/commercial-create-preview.css";',
  'implementation/commercial-confirm-preview.css";',
);
replace(
  'import { previewCommercialCreate } from "./lib/ui-phase2-commercial-create-preview.mjs";',
  'import { previewCommercialConfirm, commercialConfirmScenarios, commercialConfirmSample } from "./lib/ui-phase2-commercial-confirm-preview.mjs";',
);
replace(
  "preview = previewCommercialCreate(source);",
  "preview = previewCommercialConfirm(source);",
);
replace(
  '"scripts/lib/ui-phase2-commercial-create-preview.mjs",',
  '"scripts/lib/ui-phase2-commercial-confirm-preview.mjs",\n  "scripts/verify-ui-phase2-commercial-confirm.mjs",',
);
runner = runner.replaceAll("p58-draft-review", "p58-impact-review");
replace(
  "console.log(`P58 create ${mode} ${origin}`);",
  "console.log(`P58 confirmation ${mode} ${origin}`);",
);
replace(
  "    for (const width of [390, 760, 1440]) {",
  "    for (const width of [390, 760, 1440]) { for (const scenario of commercialConfirmScenarios) {\n      const sample = commercialConfirmSample(fixtures.data, scenario);",
);
replace(
  "    }\n    for (const mod of server.moduleGraph",
  "    }}\n    for (const mod of server.moduleGraph",
);
replace(": fixtures.data,", ": sample,");
replace("`${mode}/${width}:${name}`", "`${mode}/${width}/${scenario}:${name}`");
const start = runner.indexOf("        const trigger = page.getByRole("),
  last =
    "        runs.push({ mode, width, checks, requests, backgroundSha256: hash(background) });",
  end = runner.indexOf(last, start) + last.length;
assert.ok(start > 0 && end > start);
runner =
  runner.slice(0, start) +
  `
        await expect(page.getByRole("heading",{name:"组织配额与用量",exact:true})).toBeVisible();
        await expect(page.getByRole("button",{name:"编辑",exact:true})).toBeVisible();
        const background=await page.locator(".commercial").screenshot({animations:"disabled"});
        const dialog=page.getByRole("dialog",{name:"确认配额变更",exact:true});
        const titles={edit:"保存配额方案修改",activate:"启用配额方案",retire:"退役配额方案",assign:"分配组织配额方案",renew:"调整组织配额方案",suspend:"暂停组织配额",resume:"恢复组织配额",end:"结束组织配额",adjust:"人工调整配额",revoke:"撤销人工调整"};
        let trigger;
        if(scenario==="edit"){
          trigger=page.getByRole("button",{name:"编辑",exact:true});await trigger.click();
          const edit=page.getByRole("dialog",{name:"编辑配额方案",exact:true});await expect(edit).toBeVisible();
          await edit.getByLabel("名称",{exact:true}).fill("本地变更名称");await edit.getByLabel("说明",{exact:true}).fill("本地确认预览，不执行保存。");
          await edit.getByLabel("采集任务",{exact:true}).fill("125");await edit.getByLabel("原因",{exact:true}).fill("审核修改原因");
          await edit.getByRole("button",{name:"保存新版本",exact:true}).click();
        }else if(scenario==="assign"||scenario==="renew"){
          const form=page.locator("form.renew");
          if(scenario==="assign"){
            await form.locator("select").selectOption("p1");
            await form.getByLabel("开始",{exact:true}).fill("2026-08-01T08:00");
            await form.getByLabel("结束",{exact:true}).fill("2026-09-01T08:00");
          }else await form.getByLabel("结束",{exact:true}).fill("2026-10-01T08:00");
          trigger=form.getByRole("button",{name:scenario==="assign"?"确认分配":"确认调整",exact:true});await trigger.click();
        }else if(scenario==="adjust"){
          const form=page.locator("form.adjust");await form.getByLabel("调整量",{exact:true}).fill("25");
          trigger=form.getByRole("button",{name:"提交调整",exact:true});await trigger.click();
        }else{
          const names={activate:"启用",retire:"退役",suspend:"暂停",resume:"恢复",end:"结束",revoke:"撤销"};
          trigger=page.getByRole("button",{name:names[scenario],exact:true});await trigger.click();
        }
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("heading",{name:"确认"+titles[scenario]+"？",exact:true})).toBeVisible();
        check("one native modal",await page.locator("dialog:modal").count(),1);
        check("two original confirmation controls",await dialog.getByRole("button").count(),2);
        const cancel=dialog.getByRole("button",{name:"取消",exact:true}),submit=dialog.getByRole("button",{name:"确认执行",exact:true});
        check("initial cancel focus",await cancel.evaluate(el=>el===document.activeElement));
        check("no horizontal overflow",await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
        const rows=await dialog.locator(".commercial-impact-preview dl > div").evaluateAll(els=>els.map(el=>{
          const content=node=>{const copy=node.cloneNode(true);copy.querySelectorAll("small").forEach(s=>s.remove());return copy.textContent.trim();};
          return {label:content(el.querySelector("dt")),before:content(el.querySelector("dd span")),after:content(el.querySelector("dd strong"))};
        }));
        const impact=await dialog.locator(".commercial-impact-preview").evaluate(el=>({scope:el.querySelector("p").textContent.trim(),note:el.querySelector("p:last-child").textContent.trim()}));
        check("original impact row count",rows.length,{edit:1,activate:1,retire:1,assign:5,renew:5,suspend:0,resume:0,end:0,adjust:1,revoke:1}[scenario]);
        if(scenario==="edit")check("changed quota fact",rows[0],{label:"采集任务",before:"100",after:"125"});
        if(scenario==="renew")check("new period has no predicted usage",rows.slice(2).every(row=>row.after.includes("新周期用量将在变更后重新统计")));
        if(scenario==="activate")check("activation status fact",rows[0],{label:"方案状态",before:"草稿",after:"启用"});
        if(scenario==="retire")check("retirement status fact",rows[0],{label:"方案状态",before:"启用",after:"已退役"});
        const expectedFacts={};
        if(["edit","activate","retire"].includes(scenario)){
          expectedFacts["方案名称"]=scenario==="edit"?"本地变更名称":sample.plans[0].name;
          expectedFacts["方案说明"]=scenario==="edit"?"本地确认预览，不执行保存。":sample.plans[0].description;
        }
        if(!["assign","adjust"].includes(scenario))expectedFacts["请求携带的版本"]=["edit","activate","retire"].includes(scenario)?"2":"1";
        expectedFacts["变更原因"]=scenario==="edit"?"审核修改原因":["activate","retire"].includes(scenario)?"商业配置变更":scenario==="adjust"?"人工配额调整":scenario==="revoke"?"撤销人工调整":"分配或调整配额方案";
        let facts=null;
        if(mode==="review"){
          facts=await dialog.locator(".p58-impact-facts dl > div").evaluateAll(els=>Object.fromEntries(els.map(el=>[el.querySelector("dt").textContent.trim(),el.querySelector("dd").textContent.trim()])));
          check("submission facts from actual pending body",facts,expectedFacts);
          check("44px buttons",await dialog.getByRole("button").evaluateAll(els=>els.every(el=>el.getBoundingClientRect().height>=44)));
          check("no-row notice only without comparisons",await dialog.locator(".p58-impact-no-rows").count(),rows.length?0:1);
          if(!rows.length)await expect(dialog.locator(".p58-impact-no-rows")).toContainText("本次未提供逐项前后值");
          check("before after labels on every row",await dialog.locator(".commercial-impact-preview dd small").count(),rows.length*2);
          const textStyles=await dialog.locator("dt,dd,dd span,dd strong,dd small").evaluateAll(els=>els.map(el=>({tag:el.tagName,font:getComputedStyle(el).fontFamily})));
          check("all fact typography uses C sans",textStyles.every(s=>s.font.includes("Microsoft YaHei")));
        }
        await page.evaluate(()=>document.fonts.ready);
        const size=await dialog.evaluate(el=>({total:el.scrollHeight,height:el.clientHeight}));
        if(capture){let part=0;for(let offset=0;;offset+=Math.max(100,size.height-80)){
          const y=Math.min(offset,Math.max(0,size.total-size.height));await dialog.evaluate((el,y)=>el.scrollTop=y,y);
          const geometry=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,modal:el.matches(":modal")};});
          assert.ok(geometry.modal&&geometry.y>=0&&geometry.y+geometry.height<=901);
          const bytes=await dialog.screenshot({animations:"disabled"}),file=mode+"-"+width+"-"+scenario+"-part"+(++part)+".png";
          await writeFile(output+"/"+file,bytes);screenshots.push({file,mode,width,scenario,part,geometry,sha256:hash(bytes),pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20)});
          if(y>=size.total-size.height)break;
        }}
        // Exercise ordinary native order, not a strict boundary or pending-save claim.
        await cancel.focus();await page.keyboard.press("Tab");await expect(submit).toBeFocused();check("cancel to execute native Tab",true);
        await page.keyboard.press("Shift+Tab");await expect(cancel).toBeFocused();check("execute to cancel native ShiftTab",true);
        if(["activate","resume","adjust","renew","end"].includes(scenario))await page.keyboard.press("Escape");else await cancel.click();
        await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();check("cancel or Escape returns original trigger",true);
        check("one commercial GET",requests.filter(r=>r.key.endsWith("/commercial")).length,1);
        check("zero writes and request bodies",requests.every(r=>r.key.startsWith("GET ")&&r.body===null));
        check("no unexpected network",unexpected,[]);check("no runtime errors",errors,[]);
        runs.push({mode,width,scenario,checks,requests,rows,impact,facts,backgroundSha256:hash(background),fixtureSha256:hash(JSON.stringify(sample))});
        console.log(mode+"/"+width+"/"+scenario+" checked");
` +
  runner.slice(end);
replace('kind: "P58-CREATE-CURRENT-REVIEW-r1"', 'kind: "P58-CONFIRM-CURRENT-REVIEW-r1"');
replace(
  '"Actual App and existing E2E fixtures. Only create-dialog presentation/help and equivalent HTML-v pattern escaping in review. Production/GET/POST/API/permissions unchanged; no submit or real writes, no busy/error/save/complete-page acceptance."',
  '"Actual App, original E2E base and explicit local draft/suspended/unassigned variations. Ten confirmation entry variants; only confirm template/CSS and pending-body read-only facts. Whole script and original impact algorithm/submit behavior preserved. Local GET only; confirmation is canceled, never executed. Historical/synthetic fixtures do not prove real business eligibility, version consistency, permissions, MySQL, write outcomes, lifecycle or full accessibility. No-row means missing comparison, not no change."',
);
replace("P58 创建窗审核", "P58 确认窗审核");
replace("P58 实际 Vue 创建窗 · C 方向", "P58 实际 Vue 确认窗 · C 方向");
replace(
  "本地样例，未提交。连续局部图覆盖滚动区域；不代表保存或完整页面验收。",
  "十类确认入口的本地样例，仅预览并取消，未执行。含明确的草稿/暂停/未分配合成变体；不代表真实权限、可执行性、保存或整页验收。",
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
