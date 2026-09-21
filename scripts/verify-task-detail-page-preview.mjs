import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { taskDetailPagePlugin, taskDetailReviewCss } from "./lib/task-detail-page-preview.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])));
const widths = [1440, 390], motions = ["reduce", "no-preference"], output = args.length ? path.resolve(`output/playwright/p24-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive: true });
const images = [], results = [], hash = (value) => createHash("sha256").update(value).digest("hex");
const taskId = "00000000-0000-4000-8000-000000000024";
const envelope = (data, request_id = "p24-request") => ({ data, request_id, trace_id: request_id });
const nav = { shell:"member", organization_id:"p24-org", workspace_id:"p24-workspace", roles:["member"], capabilities:["task:read","task:update","task:assign"], platform_roles:[], platform_capabilities:[], guard_reason:"navigation_member_allowed" };
const detail = (overrides = {}) => ({ id:taskId, title:"复核便携咖啡机成本", description:"核对成本证据、运费与目标利润，再决定是否推进。", status:"in_progress", priority:"high", assignee_id:"member-1", due_at:"2026-09-21T08:00:00.000Z", sla_status:"due_soon", source_type:"manual", source_ref_id:null, collection_task_id:null, progress_percent:40, progress_note:"已完成成本初检，等待运费确认。", version:2, comments:[{id:"comment-1",body:"供应商报价已补齐，待核对最低起订量。",created_by:"member-2",created_at:"2026-09-20T05:00:00.000Z"}], events:[{id:"event-1",event_type:"task.start",actor_id:"member-1",payload:{},created_at:"2026-09-20T02:00:00.000Z"}], ...overrides });
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({ configFile:path.resolve("apps/web/vite.config.ts"), logLevel:"error", define:{"import.meta.env.VITE_API_BASE_URL":JSON.stringify("/api/v1")}, plugins:[taskDetailPagePlugin()], server:{host:"127.0.0.1",port,strictPort:true,proxy:{},hmr:false,open:false} });
let browser;
try {
  await server.listen(); browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P24 actual Vue review ${origin}`);
  for (const width of widths) for (const motion of motions) {
    let failure = false, checks = 0; const writes = [], unexpected = [], errors = [];
    const context = await browser.newContext({ viewport:{width,height:width===390?844:1050}, locale:"zh-CN", reducedMotion:motion });
    const check = (actual, expected, label) => { assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`); checks += 1; };
    const capture = async (page, name) => { if (!output || motion!=="reduce") return; await page.evaluate(() => new Promise((resolve) => { scrollTo(0,0); requestAnimationFrame(resolve); })); const bytes=await page.screenshot({animations:"disabled",fullPage:true}), file=`${width}-${name}.png`; await writeFile(path.join(output,file),bytes); images.push({file,sha256:hash(bytes),pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20)}); };
    try {
      context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
      await context.route("**/*", async (route) => {
        const request=route.request(), url=new URL(request.url());
        if (url.origin!==origin) return route.abort(); if (!url.pathname.startsWith("/api/")) return route.continue();
        const key=`${request.method()} ${url.pathname}`;
        if (key==="GET /api/v1/auth/session-status") return route.fulfill({json:envelope({authenticated:true},"p24-session")});
        if (key==="GET /api/v1/me/navigation") return route.fulfill({json:envelope(nav,"p24-nav")});
        if (key==="GET /api/v1/me/ui-preferences") return route.fulfill({json:envelope({theme:"deep-ocean",version:1},"p24-theme")});
        if (key===`GET /api/v1/tasks/${taskId}`) return failure ? route.fulfill({status:404,json:{error:{code:"task_not_found",message:"task_not_found",action_hint:"本地审核恢复提示"},request_id:"p24-missing",trace_id:"p24-missing"}}) : route.fulfill({json:envelope(detail(),"p24-detail")});
        if (key==="GET /api/v1/tasks/member-options") return route.fulfill({json:envelope([{id:"member-1",label:"当前成员"},{id:"member-2",label:"运营同事"}],"p24-members")});
        if (key===`POST /api/v1/tasks/${taskId}/actions`) { writes.push({key,body:request.postDataJSON()}); return route.fulfill({json:envelope(detail({progress_percent:45,progress_note:"已核对成本与运费，下一步确认最低起订量。",version:3}),"p24-action")}); }
        unexpected.push(key); return route.abort();
      });
      const page = await context.newPage();
      await page.goto(`${origin}/tasks/${taskId}?from=%2Ftasks`, {waitUntil:"domcontentloaded"});
      const root=page.locator(".p24-workspace");
      await root.getByRole("heading",{name:"复核便携咖啡机成本",exact:true}).waitFor({timeout:8000});
      check(await root.getByText("版本、负责人、期限与活动记录均来自当前任务响应；操作按现有权限显示。",{exact:true}).count(),1,"detail provenance copy");
      check(await root.getByText("当前成员",{exact:true}).count(),2,"member directory labels");
      const progress=root.getByRole("button",{name:"更新进度",exact:true}); await progress.focus();
      check(await progress.evaluate((node)=>getComputedStyle(node).outlineWidth),"3px","progress focus visible");
      await capture(page,"ready"); await progress.click();
      const dialog=page.getByRole("dialog",{name:"任务操作表单"}); await dialog.getByLabel("完成进度（0–100）").fill("45"); await dialog.getByLabel("本次进展说明").fill("已核对成本与运费，下一步确认最低起订量。");
      await capture(page,"progress-dialog"); await dialog.getByRole("button",{name:"确认提交",exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector(".p24-action-dialog[open]"));
      check(writes[0],{key:`POST /api/v1/tasks/${taskId}/actions`,body:{action:"progress",expected_version:2,progress_percent:45,progress_note:"已核对成本与运费，下一步确认最低起订量。"}},"exact progress action body");
      check(writes.length,1,"single action write");
      failure=true; const missing=await context.newPage(); await missing.goto(`${origin}/tasks/${taskId}`,{waitUntil:"domcontentloaded"}); const missingRoot=missing.locator(".p24-workspace"); await missingRoot.getByText("任务不存在或已删除",{exact:true}).waitFor({timeout:8000});
      check(await missingRoot.getByRole("button",{name:"重新加载",exact:true}).count(),1,"not found retry"); await capture(missing,"not-found");
      check(unexpected,[],"no unexpected API"); check(errors,[],"no page errors"); results.push({width,motion,checks,writes:writes.length}); console.log(JSON.stringify({width,motion,checks,writes:writes.length}));
    } finally { await context.close(); }
  }
  const sources=["apps/web/src/components/TaskWorkspace.vue","apps/web/src/components/TaskDetailPanel.vue","scripts/lib/task-detail-page-preview.mjs","scripts/verify-task-detail-page-preview.mjs",taskDetailReviewCss];
  if (output) await writeFile(path.join(output,"manifest.json"),JSON.stringify({page:"P24",revision:args[1],capturedAt:new Date().toISOString(),scope:"local actual Vue C review; navigation and task responses are locally intercepted",sources:Object.fromEntries(await Promise.all(sources.sort().map(async(file)=>[file,hash(await readFile(file))]))),images:images.sort((a,b)=>a.file.localeCompare(b.file)),results:results.sort((a,b)=>a.width-b.width||a.motion.localeCompare(b.motion))},null,2)+"\n");
  console.log(JSON.stringify({groups:results.length,checks:results.reduce((n,row)=>n+row.checks,0),writes:results.reduce((n,row)=>n+row.writes,0),images:images.length,sources:sources.length,port}));
} finally { await browser?.close(); await server.close(); }
