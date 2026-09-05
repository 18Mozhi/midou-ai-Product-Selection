import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,"../..");
const routes=JSON.parse(await readFile(path.join(repo,"apps/web/src/route-catalog.generated.json"),"utf8")).routes;
const expectedBoards=13;
const desktop=(await readdir(path.join(here,"screens/desktop"))).filter(x=>x.endsWith(".png"));
const mobile=(await readdir(path.join(here,"screens/mobile"))).filter(x=>x.endsWith(".png"));
const boards=(await readdir(path.join(here,"boards"))).filter(x=>x.endsWith(".png"));
const errors=[];
if(desktop.length!==routes.length)errors.push(`desktop count ${desktop.length} != ${routes.length}`);
if(mobile.length!==routes.length)errors.push(`mobile count ${mobile.length} != ${routes.length}`);
if(boards.length!==expectedBoards)errors.push(`board count ${boards.length} != ${expectedBoards}`);

function pngWidth(buffer){if(buffer.toString("ascii",1,4)!=="PNG")return 0;return buffer.readUInt32BE(16)}
for(const file of desktop){const width=pngWidth(await readFile(path.join(here,"screens/desktop",file)));if(width!==1440)errors.push(`${file}: desktop width ${width}`)}
for(const file of mobile){const width=pngWidth(await readFile(path.join(here,"screens/mobile",file)));if(width!==390)errors.push(`${file}: mobile width ${width}`)}

const contentTypes={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png"};
const server=createServer(async(request,response)=>{try{const url=new URL(request.url,"http://127.0.0.1"),requested=decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname),file=path.resolve(here,`.${requested}`);if(!file.startsWith(here)||!existsSync(file))throw new Error();response.writeHead(200,{"content-type":contentTypes[path.extname(file)]||"application/octet-stream"});response.end(await readFile(file))}catch{response.writeHead(404);response.end("not found")}});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
for(const route of routes){const page=await browser.newPage({viewport:{width:390,height:844}}),consoleErrors=[];page.on("console",msg=>{if(msg.type()==="error")consoleErrors.push(msg.text())});await page.goto(`${base}/screen.html?route=${encodeURIComponent(route.path)}`,{waitUntil:"networkidle"});const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,h1:document.querySelectorAll("h1").length,smallButtons:[...document.querySelectorAll("button")].map(el=>{const r=el.getBoundingClientRect();return {text:(el.textContent||el.getAttribute("aria-label")||"").trim().slice(0,30),w:r.width,h:r.height}}).filter(x=>x.w>0&&x.h>0&&(x.w<44||x.h<44)).slice(0,5)}));if(result.overflow>1)errors.push(`${route.path}: mobile overflow ${result.overflow}px`);if(result.h1!==1)errors.push(`${route.path}: h1 count ${result.h1}`);if(result.smallButtons.length)errors.push(`${route.path}: small buttons ${JSON.stringify(result.smallButtons)}`);if(consoleErrors.length)errors.push(`${route.path}: console ${consoleErrors.join(" | ")}`);await page.close()}
const review=await browser.newPage({viewport:{width:1440,height:1000}});await review.goto(`${base}/index.html`,{waitUntil:"networkidle"});const cards=await review.locator(".route-card").count();if(cards!==routes.length)errors.push(`review cards ${cards} != ${routes.length}`);await review.close();await browser.close();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
const full=await readFile(path.join(here,"FULL-RECOMMENDATIONS.md"),"utf8");for(const route of routes){if(!full.includes(`\`${route.path}\``))errors.push(`missing recommendation ${route.path}`)}
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log(`PASS: ${desktop.length+mobile.length+boards.length} images, ${routes.length} routes, 390px overflow, heading, button hit-area and review-index checks`);
