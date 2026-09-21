import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = "scripts/verify-ui-phase2-commercial-create.mjs";
let runner = (await readFile(base, "utf8")).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(runner).digest("hex"),
  "29950b8199909b9afb7020d11561576cabcdb5a2e117472ccd024ae4497d601d",
);
function replace(before, after) {
  assert.equal(runner.split(before).length, 2, before);
  runner = runner.replace(before, after);
}
replace(
  'output = "output/playwright/p58-create-current-review"',
  'output = "output/playwright/p58-create-outcome-review"',
);
replace(
  "preview = previewCommercialCreate(source);",
  "preview = previewCommercialCreateOutcome(source);",
);
replace(
  'implementation/commercial-create-preview.css";',
  'implementation/commercial-create-outcome-preview.css";',
);
replace(
  '"scripts/verify-ui-phase2-commercial-create.mjs",',
  '"scripts/verify-ui-phase2-commercial-create.mjs",\n  "scripts/verify-ui-phase2-commercial-create-outcome.mjs",\n  "scripts/lib/ui-phase2-commercial-create-write-preview.mjs",\n  "scripts/lib/ui-phase2-commercial-create-outcome-preview.mjs",',
);
replace(
  "for (const width of [390, 760, 1440]) {",
  'for (const width of [390, 760, 1440]) for (const scene of ["ready", "conflict", "forbidden", "blocked"]) {',
);
replace(
  "      try {\n        const page",
  "      let releaseRead, releaseRetry;\n      try {\n        const page",
);
replace(
  "      } finally {\n        await context.close();",
  "      } finally {\n        releaseRead?.(); releaseRetry?.();\n        await context.close();",
);
const routeStart = runner.indexOf('        await page.route("**/*",'),
  routeEnd = runner.indexOf("        await page.goto(", routeStart);
assert.ok(routeStart > 0 && routeEnd > routeStart);
runner =
  runner.slice(0, routeStart) +
  `
        let writes = 0, reads = 0, failures = 0, recovering = false;
        const firstReadGate = new Promise(resolve => { releaseRead = resolve; });
        const retryReadGate = new Promise(resolve => { releaseRetry = resolve; });
        const hint = scene === "forbidden" ? "当前权限暂不能读取目录。" : scene === "blocked" ? "目录服务暂时不可用，请稍后重试。" : "本次目录读取未完成，请重试。";
        let payload;
        const after = structuredClone(fixtures.data);
        const errorStatus = scene === "forbidden" ? 403 : scene === "blocked" ? 503 : 409;
        await page.route("**/*", async route => {
          const req = route.request(), url = new URL(req.url()), key = req.method() + " " + url.pathname;
          if (url.origin !== origin) { unexpected.push(key); return route.abort(); }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (!["GET /api/v1/me/navigation", "GET /api/v1/auth/session-status", "GET /api/v1/platform/commercial", "POST /api/v1/platform/commercial/plans"].includes(key)) { unexpected.push(key); return route.abort(); }
          requests.push({key, query: Object.fromEntries(url.searchParams), body:req.postData(), idempotencyKey:req.headers()["idempotency-key"] ?? null});
          if (key.startsWith("POST ")) {
            writes++; payload=req.postDataJSON();
            after.summary={total:2,draft:1,active:1,retired:0};
            after.plans=[{...fixtures.data.plans[0], ...payload, id:"p58-local-draft", status:"draft", version:1, assignment_count:0}];
            return route.fulfill({status:201,json:{data:{id:"p58-local-draft",status:"draft",version:1},request_id:"p58-create-receipt"}});
          }
          if (url.pathname.endsWith("commercial")) {
            reads++;
            if (reads > 1) {
              if (recovering) await retryReadGate; else await firstReadGate;
              if (!recovering && scene !== "ready") {
                failures++;
                return route.fulfill({status:errorStatus,json:{error:{code:"p58_local_read_"+scene,message:"本地读取失败",action_hint:hint},request_id:"p58-read-failed-"+failures}});
              }
            }
            return route.fulfill({json:{data:reads===1?fixtures.data:after,request_id:reads===1?"p58-first-read":"p58-read-ready"}});
          }
          return route.fulfill({json:{data:url.pathname.endsWith("navigation")?fixtures.navigation:{authenticated:true},request_id:"p58-local-session"}});
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
        const outcome=page.getByRole("region",{name:"本次草稿创建结果",exact:true});
        const picture=async(suffix,locator=mode==="review"?outcome:page.locator(".commercial > .notice"))=>{
          if(!capture)return;
          await page.evaluate(()=>document.fonts.ready);
          await locator.evaluate(el=>{
            const target=el.getBoundingClientRect();
            const topbars=[...document.querySelectorAll(".role-topbar,.role-sidebar,.platform-secondary-nav")].filter(bar=>{
              const rect=bar.getBoundingClientRect();return rect.height>0&&rect.top<150&&rect.bottom>0&&rect.right>target.left&&rect.left<target.right&&["fixed","sticky"].includes(getComputedStyle(bar).position);
            });
            const top=Math.max(0,...topbars.map(bar=>bar.getBoundingClientRect().bottom))+12;
            window.scrollBy({top:el.getBoundingClientRect().top-top,behavior:"instant"});
          });
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const visibility=await locator.evaluate(el=>{
            const r=el.getBoundingClientRect(), nav=document.querySelector(".role-mobile-nav"),nr=nav?.getBoundingClientRect();
            const bottom=nr&&nr.height>0?nr.top:innerHeight;
            const points=[[r.left+4,r.top+4],[r.right-4,r.top+4],[r.left+4,r.bottom-4],[r.right-4,r.bottom-4]].map(([x,y])=>{const hit=document.elementFromPoint(x,y);return{inside:el.contains(hit),hit:hit?.tagName+"."+hit?.className};});
            return {unobscured:r.top>=0&&r.bottom<=bottom&&r.left>=0&&r.right<=innerWidth&&points.every(point=>point.inside),rect:r.toJSON(),bottom,points};
          });
          assert.ok(visibility.unobscured,mode+"/"+width+"/"+scene+" "+JSON.stringify(visibility));
          check("unobscured capture "+suffix,true);
          const bytes=await locator.screenshot({animations:"disabled"}),file=mode+"-"+width+"-"+scene+"-"+suffix+".png";
          await writeFile(output+"/"+file,bytes);
          screenshots.push({file,mode,width,scene,suffix,sha256:hash(bytes),pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20)});
        };
        await expect(page.getByText("380 / 1050")).toBeVisible();
        await trigger.click(); await expect(dialog).toBeVisible();
        await dialog.getByLabel("内部标识",{exact:true}).fill("basic_2026");
        await dialog.getByLabel("方案名称",{exact:true}).fill("审核样例配额方案");
        await dialog.getByLabel("创建原因",{exact:true}).fill("验证创建与目录读取双结果");
        await dialog.getByRole("button",{name:"创建草稿",exact:true}).click();
        await expect.poll(()=>reads).toBe(2); await expect(dialog).not.toBeVisible();
        check("one successful local POST",writes,1);
        check("exact original create payload",payload,{code:"basic_2026",name:"审核样例配额方案",description:"",quotas:{collection_tasks:100,open_api_requests:1000,report_exports:20},reason:"验证创建与目录读取双结果"});
        check("native close returns original trigger",await trigger.evaluate(el=>el===document.activeElement));
        if(mode==="review"){
          await expect(outcome.getByRole("heading",{name:"草稿已创建",exact:true})).toBeVisible();
          await expect(outcome.getByRole("heading",{name:"正在更新目录",exact:true})).toBeVisible();
          await expect(outcome.getByRole("button",{name:"正在读取目录…",exact:true})).toBeDisabled();
          check("write success visible before read settles",true);
          await picture("read-pending");
        }
        releaseRead();
        await expect(page.getByRole("button",{name:"刷新数据",exact:true})).toBeEnabled();
        const expectedFailures=scene==="ready"?0:scene==="blocked"?3:1;
        check("original GET retry count",failures,expectedFailures);
        if(scene!=="ready"){
          await expect(page.getByText("成长配额方案").first()).toBeVisible();
          check("previous catalog retained",true);
          check("read error remains visible",await page.locator(".commercial > .notice").getAttribute("data-kind"),mode==="review"?"error":"success");
          await page.locator(".commercial > .notice summary").click();
          check("global notice matches outcome request",await page.locator(".commercial > .notice code").textContent(),mode==="review"?"p58-read-failed-"+expectedFailures:"p58-create-receipt");
        } else {
          await expect(page.locator(".commercial-plan-table").getByText("审核样例配额方案",{exact:true})).toBeVisible();
          check("server read supplies new draft row",true);
        }
        if(mode==="review"){
          await expect(outcome.getByRole("heading",{name:scene==="ready"?"目录读取完成":"目录暂未更新",exact:true})).toBeVisible();
          await expect(outcome).toContainText("无需重复创建");
          if(scene!=="ready")await expect(outcome).toContainText(hint);
          check("read and write outcomes distinct",true);
          check("no result horizontal overflow",await outcome.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
          await picture("result");
          await outcome.getByText("本次创建追踪",{exact:true}).click();
          await outcome.getByText("本次目录读取追踪",{exact:true}).click();
          check("separate write read IDs",await outcome.locator("code").allTextContents(),["p58-create-receipt",scene==="ready"?"p58-read-ready":"p58-read-failed-"+expectedFailures]);
          check("result controls44px",await outcome.locator("button,summary").evaluateAll(els=>els.every(el=>el.getBoundingClientRect().height>=44)));
          await picture("traces");
        } else { await picture("result"); }
        if(scene!=="ready"){
          recovering=true;
          const retry=mode==="review"?outcome.getByRole("button",{name:"重新读取当前目录",exact:true}):page.getByRole("button",{name:"刷新数据",exact:true});
          await retry.focus(); await page.keyboard.press("Enter");
          const expectedReads=2+expectedFailures;
          await expect.poll(()=>reads).toBe(expectedReads);
          check("manual retry issues GET not POST",writes,1);
          if(mode==="review"){
            await expect(outcome.getByRole("heading",{name:"正在更新目录",exact:true})).toBeFocused();
            await expect(outcome.getByRole("button",{name:"正在读取目录…",exact:true})).toBeDisabled();
            await picture("retry-pending");
          }
          releaseRetry();
          await expect(page.getByRole("button",{name:"刷新数据",exact:true})).toBeEnabled();
          if(mode==="review"){
            await expect(outcome.getByRole("heading",{name:"目录读取完成",exact:true})).toBeFocused();
            await expect(outcome.getByRole("button",{name:"重新读取当前目录",exact:true})).toHaveCount(0);
            check("retry completion retains persistent heading focus",true);
            await expect(outcome.locator("code").first()).toHaveText("p58-create-receipt");
            check("write receipt preserved after reread",true);
            await picture("retry-ready");
          }
        }
        const readsLog=requests.filter(r=>r.key==="GET /api/v1/platform/commercial");
        for(const entry of readsLog.slice(1))check("existing create filter query",entry.query,{page:"1",page_size:"20",adjustment_page:"1",adjustment_page_size:"10",organization_id:"o1",query:"basic_2026",status:"draft"});
        check("final local POST count",writes,1); check("no unexpected network",unexpected,[]); check("no runtime errors",errors,[]);
        runs.push({mode,width,scene,checks,requests});
` +
  runner.slice(flowEnd);
replace(
  "  await includeImportedStyleSources(sources, read);",
  `  const appSources=new Set([...sources].filter(file=>file.startsWith("apps/web/")));
  await includeImportedStyleSources(appSources,read);
  for(const file of appSources)sources.add(file);
  sources.add("design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-preview.css");
  sources.add("design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-write-preview.css");`,
);
replace('kind: "P58-CREATE-CURRENT-REVIEW-r1"', 'kind: "P58-CREATE-OUTCOME-REVIEW-r1"');
replace(
  '"Actual App and existing E2E fixtures. Only create-dialog presentation/help and equivalent HTML-v pattern escaping in review. Production/GET/POST/API/permissions unchanged; no submit or real writes, no busy/error/save/complete-page acceptance."',
  '"Actual App, local201 POST then held GET success/409/403/503 and explicit GET recovery. Review-only dual outcome, load return value and stable reread focus. Source-derived initial fixture and synthetic post-create response; no real writes, lifecycle/concurrent ownership/unknown POST/full page/production acceptance. Production and previous packets unchanged."',
);
replace(
  "本地样例，未提交。连续局部图覆盖滚动区域；不代表保存或完整页面验收。",
  "本地201创建样例与后续GET结果分开；无真实写入，不代表真实事务、完整页面或生产验收。",
);
replace("P58 实际 Vue 创建窗 · C 方向", "P58 创建成功与目录核对 · 独立审核");
runner =
  'import { previewCommercialCreateOutcome } from "./lib/ui-phase2-commercial-create-outcome-preview.mjs";\n' +
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
