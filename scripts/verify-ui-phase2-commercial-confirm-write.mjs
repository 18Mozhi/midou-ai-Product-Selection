import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

let harness = (
  await readFile("scripts/verify-ui-phase2-commercial-confirm.mjs", "utf8")
).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(harness).digest("hex"),
  "dbac1a2b3151a9b2b0920f50f3bb9a63522ca2fc5101bfdc74abcd9d7cacf0ed",
);

function augment(runner) {
  const replace = (before, after) => {
    if (runner.split(before).length !== 2)
      throw new Error("Unique confirm-write runner anchor: " + before);
    runner = runner.replace(before, after);
  };
  replace(
    'output = "output/playwright/p58-confirm-current-review"',
    'output = "output/playwright/p58-confirm-write-review"',
  );
  replace(
    'implementation/commercial-confirm-preview.css";',
    'implementation/commercial-confirm-write-preview.css";',
  );
  replace(
    "preview = previewCommercialConfirm(source);",
    "preview = previewCommercialConfirmWrite(source), nativePreview = previewCommercialConfirm(source);",
  );
  runner =
    'import { previewCommercialConfirmWrite } from "./lib/ui-phase2-commercial-confirm-write-preview.mjs";\n' +
    runner;
  replace(
    '"scripts/verify-ui-phase2-commercial-confirm.mjs",',
    '"scripts/verify-ui-phase2-commercial-confirm.mjs",\n"scripts/verify-ui-phase2-commercial-confirm-write.mjs",\n"scripts/lib/ui-phase2-commercial-confirm-write-preview.mjs",\n"scripts/lib/ui-phase2-commercial-create-focus-preview.mjs",\n"scripts/lib/ui-phase2-commercial-create-outcome-preview.mjs",\n"scripts/lib/ui-phase2-commercial-create-write-preview.mjs",\n"scripts/lib/ui-phase2-commercial-create-preview.mjs",\n"design-plans/ui-phase-2-2026-09-07/implementation/commercial-confirm-preview.css",',
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
    "for (const scenario of commercialConfirmScenarios) {",
    'for (const scenario of ["edit", "renew", "resume", "adjust", "revoke"]) { for (const errorCode of [409,403]) {',
  );
  replace("    }}\n    for (const mod", "    }}}\n    for (const mod");
  replace(
    "      try {\n        const page",
    "      let releaseWrite;\n      try {\n        const page",
  );
  replace(
    "      } finally {\n        await context.close();",
    "      } finally {\n        releaseWrite?.();\n        await context.close();",
  );
  replace(
    "`${mode}/${width}/${scenario}:${name}`",
    "`${mode}/${width}/${scenario}/${errorCode}:${name}`",
  );
  const routeStart = runner.indexOf('        await page.route("**/*",'),
    routeEnd = runner.indexOf("        await page.goto(", routeStart);
  if (routeStart < 0 || routeEnd < routeStart) throw new Error("route anchors");
  runner =
    runner.slice(0, routeStart) +
    `
        let writes=0;
        const gate=new Promise(resolve=>{releaseWrite=resolve;});
        const hint=errorCode===409?"版本已发生变化，请重新核对。":"当前权限还不能执行此操作。请核对权限后再试。";
        const expectedRoute={edit:"PATCH /api/v1/platform/commercial/plans/p1",renew:"POST /api/v1/platform/commercial/assignments",resume:"POST /api/v1/platform/commercial/assignments/a1/actions",adjust:"POST /api/v1/platform/commercial/adjustments",revoke:"POST /api/v1/platform/commercial/adjustments/q1/revoke"}[scenario];
        await page.route("**/*",async route=>{
          const req=route.request(),url=new URL(req.url()),key=req.method()+" "+url.pathname;
          if(url.origin!==origin){unexpected.push(key);return route.abort();}
          if(!url.pathname.startsWith("/api/"))return route.continue();
          if(!["GET /api/v1/me/navigation","GET /api/v1/auth/session-status","GET /api/v1/platform/commercial",expectedRoute].includes(key)){unexpected.push(key);return route.abort();}
          requests.push({key,body:req.postData(),idempotencyKey:req.headers()["idempotency-key"]??null});
          if(key===expectedRoute){const attempt=++writes;await gate;return route.fulfill({status:errorCode,json:{error:{code:"local_confirm_rejection",message:"本地拒绝样例",action_hint:hint},request_id:"p58-confirm-"+scenario+"-"+errorCode+"-"+attempt}});}
          return route.fulfill({json:{data:url.pathname.endsWith("navigation")?fixtures.navigation:url.pathname.endsWith("session-status")?{authenticated:true}:sample,request_id:"p58-confirm-read"}});
        });
` +
    runner.slice(routeEnd);
  const flowStart = runner.indexOf(
      '        await expect(dialog).toBeVisible();\n        await expect(dialog.getByRole("heading",{name:"确认"+titles[scenario]',
    ),
    flowEnd =
      runner.indexOf('        console.log(mode+"/"+width+"/"+scenario+" checked");', flowStart) +
      '        console.log(mode+"/"+width+"/"+scenario+" checked");'.length;
  if (flowStart < 0 || flowEnd < flowStart) throw new Error("flow anchors");
  runner =
    runner.slice(0, flowStart) +
    `
        await expect(dialog).toBeVisible();
        const cancel=dialog.getByRole("button",{name:"取消",exact:true}),submit=dialog.locator("footer button.primary"),heading=dialog.locator("header h3");
        await expect(cancel).toBeFocused();check("original initial cancel focus",true);
        const facts=await dialog.locator(".p58-impact-facts").innerText();
        const picture=async(target,suffix)=>{
          if(!capture)return;
          await page.evaluate(()=>document.fonts.ready);
          const rect=await target.boundingBox();assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=901);
          const bytes=await target.screenshot({animations:"disabled"}),file=mode+"-"+width+"-"+scenario+"-"+errorCode+"-"+suffix+".png";
          await writeFile(output+"/"+file,bytes);screenshots.push({file,mode,width,scenario,errorCode,suffix,sha256:hash(bytes),pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20)});
        };
        const atTop=async()=>{await dialog.evaluate(el=>el.scrollTop=0);};
        await atTop();await picture(dialog,"initial-top");
        const cycles=async(stage,stops)=>{
          if(mode!=="review")return;
          for(const direction of ["Tab","Shift+Tab"]){await stops[0].focus();for(let step=1;step<=stops.length*2;step++){
            await page.keyboard.press(direction);const i=direction==="Tab"?step%stops.length:(stops.length-step%stops.length)%stops.length;
            await expect(stops[i]).toBeFocused();check(stage+" "+direction+" step"+step,await dialog.evaluate(el=>el.contains(document.activeElement)));
          }}
        };
        await cycles("initial",[cancel,submit]);
        await submit.click();await expect.poll(()=>writes).toBe(1);await expect(submit).toBeDisabled();await expect(cancel).toBeDisabled();
        check("two original buttons disabled",await dialog.locator("button:disabled").count(),2);
        await dialog.locator("form").evaluate(el=>{el.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));el.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));check("duplicate pending submit single flight",writes,1);
        check("waiting status visible only in review",await dialog.getByRole("status").count(),mode==="review"?1:0);
        if(mode==="review"){
          await expect(heading).toBeFocused();check("waiting heading visible before screenshot",await heading.evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest("dialog").getBoundingClientRect();return r.top>=d.top&&r.bottom<=d.bottom;}));
          for(const direction of ["Tab","Shift+Tab"]){for(let step=0;step<3;step++){await page.keyboard.press(direction);await expect(heading).toBeFocused();check("busy "+direction+step,true);}}
          await page.keyboard.press("Escape");await expect(dialog).toBeVisible();check("waiting Escape stays open",true);
        }
        await atTop();await picture(dialog,"waiting-top");releaseWrite();
        await expect(submit).toBeEnabled();await expect(cancel).toBeEnabled();await expect(dialog).toBeVisible();
        await expect(page.locator(".commercial > .notice")).toContainText(hint);check("original global feedback retained",true);
        check("pending facts preserved after rejection",await dialog.locator(".p58-impact-facts").innerText(),facts);
        check("rejection feedback inside dialog",await dialog.getByRole("alert").count(),mode==="review"?1:0);
        if(mode==="review"){
          const feedback=dialog.getByRole("alert"),summary=feedback.locator("summary"),copy=feedback.getByRole("button",{name:"复制请求编号",exact:true});
          await expect(feedback).toContainText(hint);await expect(heading).toBeFocused();
          await expect(copy).not.toBeVisible();check("folded request copy hidden",true);
          await cycles("rejected-collapsed",[summary,cancel,submit]);await feedback.scrollIntoViewIfNeeded();await picture(feedback,"rejected-collapsed");
          await summary.click();await expect(copy).toBeVisible();await expect(feedback).toContainText("p58-confirm-"+scenario+"-"+errorCode+"-1");check("request id belongs to rejected operation",true);
          await cycles("rejected-expanded",[summary,copy,cancel,submit]);await feedback.scrollIntoViewIfNeeded();await picture(feedback,"rejected-expanded");
          check("expanded feedback has no horizontal overflow",await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
          if(width<=760)check("mobile request id gets full row",await feedback.evaluate(el=>el.querySelector("dd").getBoundingClientRect().width>=el.clientWidth-48));
          await summary.click();await expect(copy).not.toBeVisible();check("folded again removes copy",true);
        }else{await atTop();await picture(dialog,"rejected-background-only");}
        const first=requests.find(r=>r.key===expectedRoute);assert.ok(first.idempotencyKey);
        await submit.click();await expect.poll(()=>writes).toBe(2);await expect(submit).toBeEnabled();
        if(mode==="review"){await expect(dialog.getByRole("alert")).toContainText(hint);await dialog.getByRole("alert").locator("summary").click();await expect(dialog.getByRole("alert")).toContainText("p58-confirm-"+scenario+"-"+errorCode+"-2");}
        const sent=requests.filter(r=>r.key===expectedRoute);check("explicit retry keeps same body and key",sent[1],sent[0]);
        check("two local rejected writes",writes,2);check("no post-rejection catalogue GET",requests.filter(r=>r.key.endsWith("/commercial")).length,1);
        await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();check("ready Escape returns trigger",true);
        check("no unexpected network",unexpected,[]);check("no runtime errors",errors,[]);
        runs.push({mode,width,scenario,errorCode,checks,requests,facts});console.log(mode+"/"+width+"/"+scenario+"/"+errorCode+" checked");
` +
    runner.slice(flowEnd);
  replace(
    "  await includeImportedStyleSources(sources, read);",
    '  const appSources=new Set([...sources].filter(file=>file.startsWith("apps/web/src/")));\n  await includeImportedStyleSources(appSources, read);for(const file of appSources)sources.add(file);',
  );
  replace('kind: "P58-CONFIRM-CURRENT-REVIEW-r1"', 'kind: "P58-CONFIRM-WRITE-REVIEW-r1"');
  replace(
    '"Actual App, original E2E base and explicit local draft/suspended/unassigned variations. Ten confirmation entry variants; only confirm template/CSS and pending-body read-only facts. Whole script and original impact algorithm/submit behavior preserved. Local GET only; confirmation is canceled, never executed. Historical/synthetic fixtures do not prove real business eligibility, version consistency, permissions, MySQL, write outcomes, lifecycle or full accessibility. No-row means missing comparison, not no change."',
    '"Baseline is preceding C confirmation preview, review adds operation-owned inline feedback, pending close/submit guards, dynamic heading focus and local keyboard boundary. Five actual request families with two explicit local rejected attempts each (409/403), same body/key; no real HTTP/MySQL or writes. Initial cancel focus preserved. Busy and collapsed/expanded feedback regions, not complete long-form captures. Unknown/success/readback/lifecycle/permissions/clipboard/screen-reader/production acceptance remain open."',
  );
  replace("P58 确认窗审核", "P58 确认窗等待与拒绝审核");
  replace("P58 实际 Vue 确认窗 · C 方向", "P58 确认窗 · 等待与拒绝反馈");
  replace(
    "十类确认入口的本地样例，仅预览并取消，未执行。含明确的草稿/暂停/未分配合成变体；不代表真实权限、可执行性、保存或整页验收。",
    "五类请求路径的本地409/403拒绝样例，不连接真实后端。初始/等待为窗顶区域，错误为局部反馈；完整默认长窗见此前图包。本轮不是未知结果、成功、真实权限或生产验收。",
  );
  return runner;
}

const anchor = 'runner = runner.replace(\n  /from "([^"\\n]+)"/g,';
assert.equal(harness.split(anchor).length, 2);
harness = harness.replace(anchor, `runner = (${augment.toString()})(runner);\n` + anchor);
const specifiers = [
  "node:assert/strict",
  "node:fs/promises",
  "node:crypto",
  "node:path",
  "node:vm",
  "typescript",
  "vite",
  "@playwright/test",
  "./lib/ui-phase2-commercial-confirm-preview.mjs",
  "./lib/ui-phase2-commercial-confirm-write-preview.mjs",
  "./lib/ui-imported-style-sources.mjs",
];
const resolutions = Object.fromEntries(specifiers.map((s) => [s, import.meta.resolve(s)]));
harness =
  "const p58Resolve=" +
  JSON.stringify(resolutions) +
  ";\n" +
  harness.replace(
    "import.meta.resolve(specifier)",
    'p58Resolve[specifier] ?? (()=>{throw new Error("Unlisted import: "+specifier)})()',
  );
await import("data:text/javascript;base64," + Buffer.from(harness).toString("base64"));
