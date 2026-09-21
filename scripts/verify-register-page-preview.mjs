import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { registerPagePlugin, registerPageSources } from "./lib/register-page-preview.mjs";

const args = process.argv.slice(2), smoke = process.env.P03_SMOKE === "1";
assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])));
const widths = process.env.P03_VIEWPORT ? [Number.parseInt(process.env.P03_VIEWPORT, 10)] : smoke ? [390] : [1440,390];
const motions = process.env.P03_MOTION ? [process.env.P03_MOTION] : smoke ? ["reduce"] : ["reduce","no-preference"];
assert.deepEqual(widths.every((value) => [390,1440].includes(value)), true);
assert.deepEqual(motions.every((value) => ["reduce","no-preference"].includes(value)), true);
const output = args.length ? path.resolve(`output/playwright/p03-page-composition-${args[1]}`) : null;
if (output) await mkdir(output, { recursive:true });
const previous = output ? await readFile(path.join(output,"manifest.json"),"utf8").then(JSON.parse).catch(() => null) : null;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0,"127.0.0.1",resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({ configFile:path.resolve("apps/web/vite.config.ts"), logLevel:"error", define:{"import.meta.env.VITE_API_BASE_URL":JSON.stringify("/api/v1")}, plugins:[registerPagePlugin()], server:{host:"127.0.0.1",port,strictPort:true,proxy:{},hmr:false,open:false} });
const hash = (value) => createHash("sha256").update(value).digest("hex"), images = [], results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P03 actual Vue review ${origin}`);
  for (const width of widths) for (const motion of motions) {
    const context = await browser.newContext({ viewport:{width,height:width===390?844:1000}, locale:"zh-CN", reducedMotion:motion });
    const errors = [], unexpected = [], writes = []; let checks = 0;
    const check = (actual,expected,label) => { assert.deepEqual(actual,expected,`${width}/${motion}: ${label}`); checks++; };
    const capture = async (page,name) => {
      await page.evaluate(() => new Promise((resolve) => { window.scrollTo(0,0); requestAnimationFrame(() => { window.scrollTo(0,0); resolve(); }); }));
      const bytes = await page.screenshot({animations:"disabled"}), file = `${width}-${name}.png`;
      await writeFile(path.join(output,file),bytes);
      images.push({file,sha256:hash(bytes),pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20)});
    };
    try {
      context.on("page",(page) => page.on("pageerror",(error) => errors.push(error.message)));
      await context.route("**/*",async(route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (request.method() !== "POST" || url.pathname !== "/api/v1/auth/register") { unexpected.push(`${request.method()} ${url.pathname}`); return route.abort(); }
        writes.push({method:request.method(),path:url.pathname,body:request.postDataJSON()});
        return route.fulfill({status:201,json:{data:{accepted:true},request_id:"p03-register-review",trace_id:"p03-register-review"}});
      });
      const page = await context.newPage();
      await page.goto(origin + "/register",{waitUntil:"domcontentloaded"});
      const root = page.locator(".identity-page--review");
      await root.waitFor();
      check(await root.locator("h1").count(),1,"single creation h1");
      check(await page.getByLabel("邮箱").count(),1,"email field");
      const newPasswordFields = root.locator('input[autocomplete="new-password"]');
      check(await newPasswordFields.count(),2,"password and confirmation fields");
      check(await page.getByLabel("确认密码").count(),1,"confirmation field");
      check(await root.getByText("确认密码仅用于浏览器内一致性校验；服务端只接收邮箱和密码。",{exact:true}).count(),1,"payload boundary shown");
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true,"default no overflow");
      if (output && motion === "reduce") await capture(page,"register");
      await page.getByLabel("邮箱").fill("new.member@example.test");
      await newPasswordFields.nth(0).fill("Long-enough-password-123!");
      await newPasswordFields.nth(1).fill("Different-password-456!");
      await page.getByRole("button",{name:"创建账号",exact:true}).click();
      await root.getByText("两次输入的密码不一致。",{exact:true}).waitFor();
      check(await root.getAttribute("data-state"),"error","mismatch is local error");
      check(writes.length,0,"mismatch makes zero POST");
      check(await page.getByLabel("邮箱").inputValue(),"new.member@example.test","mismatch preserves email");
      if (output && motion === "reduce") await capture(page,"mismatch");
      await newPasswordFields.nth(1).fill("Long-enough-password-123!");
      const createButton = page.getByRole("button",{name:"创建账号",exact:true});
      await createButton.focus();
      check(await createButton.evaluate((node) => getComputedStyle(node).outlineWidth),"3px","create focus visible");
      await createButton.click();
      await page.getByTestId("verify").waitFor();
      check(await root.getAttribute("data-mode"),"verify","successful registration is pending verification");
      check(await page.getByRole("button",{name:"返回登录",exact:true}).count(),1,"verify keeps return action");
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true,"verify no overflow");
      if (output && motion === "reduce") await capture(page,"verify");
      check(writes,[{method:"POST",path:"/api/v1/auth/register",body:{email:"new.member@example.test",password:"Long-enough-password-123!"}}],"registration payload omits confirmation");
      check(unexpected,[],"no unexpected api"); check(errors,[],"no page errors");
      results.push({width,motion,checks,writes:writes.length});
      console.log(JSON.stringify({width,motion,checks,writes:writes.length}));
    } finally { await context.close(); }
  }
  const sources = new Set(registerPageSources);
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    const file = module.file && path.relative(process.cwd(),module.file).replaceAll("\\","/");
    if (file && !file.startsWith("..") && !file.includes("node_modules") && /\.(vue|ts|css|json)$/.test(file)) sources.add(file);
  }
  const allImages = [...(previous?.images ?? []),...images].filter((item,index,values) => values.findLastIndex((value) => value.file === item.file) === index).sort((a,b) => a.file.localeCompare(b.file));
  const allResults = [...(previous?.results ?? []),...results].filter((item,index,values) => values.findLastIndex((value) => value.width === item.width && value.motion === item.motion) === index).sort((a,b) => a.width-b.width || a.motion.localeCompare(b.motion));
  if (output) await writeFile(path.join(output,"manifest.json"),JSON.stringify({page:"P03",revision:args[1],capturedAt:new Date().toISOString(),sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),scope:"local actual Vue C review; registration POST is locally intercepted after a zero-POST mismatch",sources:Object.fromEntries(await Promise.all([...sources].sort().map(async(file) => [file,hash(await readFile(file))]))),images:allImages,results:allResults},null,2)+"\n");
  console.log(JSON.stringify({groups:allResults.length,checks:allResults.reduce((sum,result) => sum+result.checks,0),writes:allResults.reduce((sum,result) => sum+result.writes,0),images:allImages.length,sources:sources.size,port}));
} finally { await browser?.close(); await server.close(); }
