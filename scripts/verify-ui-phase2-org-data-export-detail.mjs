import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import ts from "typescript";
import { buildOrgDataDesignData } from "./lib/ui-phase2-org-data-design-data.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const output = "output/playwright/p35-export-detail-vue";
const component = "apps/web/src/components/OrganizationDataPanel.vue";
const baselineCommit = "d401ec95501555a458715ea3a610e61f5f8eead7";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const lf = (v) => v.replaceAll("\r\n", "\n");
const read = async (f) => lf(await readFile(f, "utf8"));
const baselineSource = lf(
  execFileSync("git", ["show", `${baselineCommit}:${component}`], { encoding: "utf8" }),
);
const currentSource = await read(component);
assert.equal(
  currentSource
    .replace(
      ' aria-labelledby="org-data-title" data-export-detail-c>',
      ' aria-labelledby="org-data-title">',
    )
    .replace('\n<style src="../org-data-export-detail.css"></style>\n', ""),
  baselineSource,
  "only root styling marker and lazy CSS import may change the component",
);
const data = await buildOrgDataDesignData(process.cwd());
const main = await read("apps/web/src/main.ts");
const cssFiles = [...main.matchAll(/import "\.\/(.*?\.css)";/g)]
  .map((m) => m[1])
  .concat("organization-admin.css");
const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
const parent = ts.createSourceFile(
  "parent.ts",
  (await read(parentFile)).split('<script setup lang="ts">')[1].split("</script>")[0],
  ts.ScriptTarget.Latest,
  true,
);
let fmt;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parent) === "fmt")
    fmt = node.initializer.getText(parent);
  ts.forEachChild(node, visit);
}
visit(parent);
assert.ok(fmt);
fmt = ts.transpileModule(`const fmt=${fmt}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const sourceFiles = [
  component,
  parentFile,
  "apps/web/src/org-data-export-detail.css",
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-org-data-export-detail.mjs",
  "scripts/lib/ui-phase2-org-data-design-data.mjs",
  "tests/e2e/m06-01-organization-admin.spec.ts",
  ...cssFiles.map((f) => `apps/web/src/${f}`),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sourceFiles.map(async (f) => [f, hash(await read(f))])),
);
let previous;
if (!smoke && !capture) {
  previous = JSON.parse(await read(`${output}/evidence.json`));
  assert.deepEqual(sourceHashes, previous.sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
}
if (capture) await mkdir(output, { recursive: true });
const entry = "/__p35_export_detail.js";
const baselineId = path
  .resolve("apps/web/src/components/__P35DetailBaseline.vue")
  .replaceAll("\\", "/");
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Current from '/src/components/OrganizationDataPanel.vue';import Baseline from '/src/components/__P35DetailBaseline.vue';
${cssFiles.map((f) => `import '/src/${f}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';
const original=${JSON.stringify(data)};const params=new URL(location.href).searchParams;const scene=params.get('scene')||'normal';
let data=structuredClone(original);
if(scene==='zero') data=structuredClone(original.zeroFixture);
if(scene==='empty') data.exports=[];
if(['long','unknown','missing'].includes(scene)) {
 data.exports=[{...original.exports[0]}]; const row=data.exports[0];
 if(scene==='long') row.workspace_name='跨区域新品采购与合规评估协作工作区'.repeat(7);
 if(scene==='unknown') {row.status='unrecognized';row.report_type='unrecognized';}
 if(scene==='missing') {row.created_at=null;row.updated_at=null;row.row_count=null;}
}
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
${fmt}
const app=createApp({render:()=>h('main',{class:'org-admin-center'},h(params.has('baseline')?Baseline:Current,{data,formatTime:fmt}))}).use(router);
await router.isReady();app.mount('#host');window.P35_DETAIL_TEST={data};`;
const probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
let baselineLoaded = false;
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false },
  plugins: [
    {
      name: "p35-export-detail-isolated-vue",
      enforce: "pre",
      resolveId: (id) =>
        id === entry
          ? entry
          : id === "/src/components/__P35DetailBaseline.vue"
            ? baselineId
            : undefined,
      load: (id) => {
        if (id === entry) return host;
        if (id.split("?")[0] === baselineId && !id.includes("type=")) {
          baselineLoaded = true;
          return baselineSource;
        }
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/org-admin/data") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P35 手机导出详情真实子Vue隔离验证</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [];
let browser;
try {
  await server.listen();
  console.log(`p35_detail_host http://127.0.0.1:${port}`);
  browser = await chromium.launch({ headless: true });
  for (const width of smoke ? [390] : [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === `http://127.0.0.1:${port}` && !url.pathname.startsWith("/api/"))
          return route.continue();
        requests.push(url.pathname);
        return route.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const go = async (q) => {
        await page.goto(`http://127.0.0.1:${port}/org-admin/data?${q}`);
        await page.locator(".org-data-panel").waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
      };
      const panel = () => page.locator(".org-data-panel");
      for (const [name, q] of [
        ["workspaces", ""],
        ["no exports", "org_data_view=exports&scene=empty"],
        ["no match", "org_data_view=exports&org_data_export_query=不存在"],
        ...(width > 760 ? [["desktop exports", "org_data_view=exports"]] : []),
      ]) {
        await go("baseline=1&" + q);
        const before = hash(await panel().screenshot({ animations: "disabled" }));
        await go(q);
        check(
          `${name}: unchanged baseline pixels`,
          hash(await panel().screenshot({ animations: "disabled" })),
          before,
        );
      }
      const sceneList = smoke
        ? ["normal", "zero", "long"]
        : [
            "normal",
            "zero",
            "long",
            "unknown",
            "missing",
            "queued",
            "leased",
            "retry_scheduled",
            "succeeded",
            "dead_letter",
            "expired",
          ];
      for (const scene of sceneList) {
        const isStatus = [
          "queued",
          "leased",
          "retry_scheduled",
          "succeeded",
          "dead_letter",
          "expired",
        ].includes(scene);
        await go(
          `org_data_view=exports&keep=detail-review&${isStatus ? "org_data_export_status=" + scene : "scene=" + scene}`,
        );
        const card = page.locator(".org-data-export-list article").first(),
          detail = card.locator("details"),
          summary = detail.locator("summary");
        const url = page.url(),
          originalData = await page.evaluate(() => JSON.stringify(window.P35_DETAIL_TEST.data));
        check(`${scene}: present`, await card.count(), 1);
        if (scene === "zero") {
          check(
            "known zero remains 0 行",
            (await page.locator(".org-data-export-list").innerText()).includes("0 行"),
          );
          check(
            "null remains 尚未生成",
            (await page.locator(".org-data-export-list").innerText()).includes("尚未生成"),
          );
        }
        if (scene === "unknown") {
          check(
            "unknown status retained",
            (await card.innerText()).includes("未知状态（unrecognized）"),
          );
          check(
            "unknown type retained",
            (await card.innerText()).includes("未知类型（unrecognized）"),
          );
        }
        if (scene === "missing")
          check(
            "missing times preserve original formatter",
            await card.locator("dd").allTextContents(),
            ["尚未生成", "数据不足", "数据不足"],
          );
        if (isStatus)
          check(
            `${scene}: original status attribute`,
            await card.locator("i").getAttribute("data-status"),
            scene,
          );
        await summary.focus();
        await page.keyboard.press("Enter");
        check(`${scene}: keyboard opens native detail`, await detail.getAttribute("open"), "");
        check(`${scene}: technical ID visible`, await detail.locator("code").isVisible());
        if (width <= 760) {
          const m = await card.evaluate((n) => {
            const rect = (s) => n.querySelector(s).getBoundingClientRect();
            const type = rect("header span"),
              name = rect("h5"),
              status = rect("i"),
              count = rect("dl>div:first-child"),
              created = rect("dl>div:nth-child(2)"),
              updated = rect("dl>div:nth-child(3)"),
              technical = rect("summary");
            return {
              white: getComputedStyle(n).backgroundColor,
              title: getComputedStyle(n.querySelector("h5")).fontSize,
              font: getComputedStyle(n.querySelector("summary")).fontSize,
              target: technical.height >= 44,
              placement:
                type.y <= name.y &&
                name.y < status.y &&
                count.x > name.x &&
                Math.abs(created.y - updated.y) < 1 &&
                technical.y > created.y,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              contained: [...n.querySelectorAll("h5,dt,dd,i,code,summary")].every(
                (el) => el.scrollWidth <= el.clientWidth + 1,
              ),
            };
          });
          check(`${scene}: mobile white surface`, m.white, "rgb(255, 255, 255)");
          check(`${scene}: title font`, m.title, "18px");
          check(`${scene}: control font`, m.font, "16px");
          check(`${scene}: control size`, m.target);
          check(`${scene}: approved placement`, m.placement);
          check(`${scene}: no page overflow`, m.overflow, false);
          check(`${scene}: no field clipping`, m.contained);
        }
        if (scene === "zero") {
          const zeroCard = page
            .locator(".org-data-export-list article")
            .filter({ hasText: "空文件工作区" });
          check("zero row exact label", await zeroCard.locator("dd").first().innerText(), "0 行");
          await zeroCard.locator("summary").click();
          check(
            "zero row native detail opens",
            await zeroCard.locator("details").getAttribute("open"),
            "",
          );
          if (capture && width <= 760) {
            await zeroCard.locator("summary").evaluate((n) => n.blur());
            await page.mouse.move(0, 0);
            const file = `known-zero-open-${width}.png`;
            await zeroCard.screenshot({ path: `${output}/${file}`, animations: "disabled" });
            screenshots.push({
              file,
              scene: "known-zero",
              width,
              scope: "actual-child-isolated-fixture-not-parent-API-production",
              sha256: hash(await readFile(`${output}/${file}`)),
            });
          }
        }
        if (capture && width <= 760) {
          await page.mouse.move(0, 0);
          await summary.evaluate((n) => n.blur());
          const file = `${scene}-open-${width}.png`;
          await card.screenshot({ path: `${output}/${file}`, animations: "disabled" });
          screenshots.push({
            file,
            scene,
            width,
            scope: "actual-child-isolated-fixture-not-parent-API-production",
            sha256: hash(await readFile(`${output}/${file}`)),
          });
        }
        await summary.focus();
        await page.keyboard.press("Space");
        check(`${scene}: keyboard closes native detail`, await detail.getAttribute("open"), null);
        await summary.click();
        check(`${scene}: pointer opens native detail`, await detail.getAttribute("open"), "");
        check(
          `${scene}: data unchanged`,
          await page.evaluate(() => JSON.stringify(window.P35_DETAIL_TEST.data)),
          originalData,
        );
        check(`${scene}: URL unchanged`, page.url(), url);
      }
      check(
        "no business/file buttons",
        await page.locator(".org-data-export-list button,.org-data-export-list a").count(),
        0,
      );
      check("no dialog", await page.locator("dialog,[role=dialog]").count(), 0);
      check("no external/API requests", requests, []);
      check("no page errors", errors, []);
      check(
        "no persistent storage",
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
    } finally {
      await context.close();
    }
  }
  assert.ok(baselineLoaded, "immutable baseline SFC actually loaded");
} finally {
  await browser?.close();
  await server.close();
}
if (capture) {
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        pageId: "P35",
        scope: "mobile-detail-only-actual-child-not-parent-API-SQL-production",
        baselineCommit,
        sourceHashes,
        checks,
        screenshots,
        baselineLoaded,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P35 真实Vue导出详情</title><style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;margin:20px;color:#202c3d}img{max-width:100%;height:auto}figure{margin:24px 0;padding:16px;background:white}a{color:#254a9c}</style><h1>P35 手机导出详情 · 实际子Vue隔离图</h1><p>数据为现有测试夹具，long/unknown/missing为明确合成边界。仅原手机详情组合已获批，其他状态待审；不是父页面、权限、实际导出或生产验收。</p><a href="evidence.json">验证证据</a>${screenshots.map((s) => `<figure><figcaption>${s.scene} · ${s.width}px</figcaption><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.width}px"></figure>`).join("")}</html>`,
  );
} else if (!smoke) assert.deepEqual(checks, previous.checks);
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    checks: checks.length,
    pixelComparisons: checks.filter((c) => c.name.includes("baseline pixels")).length,
    screenshots: capture ? screenshots.length : (previous?.screenshots.length ?? 0),
    port,
    browserAndServerClosed: true,
  }),
);
