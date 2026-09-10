import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import ts from "typescript";
import { buildOrgDataDesignData } from "./lib/ui-phase2-org-data-design-data.mjs";
import {
  exportDetailStyle,
  exportDetailTokens,
  undoExportDetailTokens,
} from "./lib/ui-phase2-export-detail-token-delta.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)) && !(capture && smoke),
);
const output = "output/playwright/p35-export-token-equivalence",
  read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n"),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  baselineCommit = "c380b995b3a6d55d7f1742dc42baf9479be0e8e7",
  component = "apps/web/src/components/OrganizationDataPanel.vue",
  old = (f) =>
    execFileSync("git", ["show", `${baselineCommit}:${f}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    ),
  source = await read(component),
  oldStyle = old(exportDetailStyle);
assert.equal(source, old(component));
assert.equal(undoExportDetailTokens(await read(exportDetailStyle)), oldStyle);
const data = await buildOrgDataDesignData(process.cwd()),
  cssFiles = [...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g)]
    .map((m) => m[1])
    .concat("organization-admin.css"),
  parentFile = "apps/web/src/components/OrganizationAdminCenter.vue",
  parent = ts.createSourceFile(
    "parent.ts",
    (await read(parentFile)).split('<script setup lang="ts">')[1].split("</script>")[0],
    ts.ScriptTarget.Latest,
    true,
  );
let formatter;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parent) === "fmt")
    formatter = node.initializer.getText(parent);
  ts.forEachChild(node, visit);
}
visit(parent);
assert.ok(formatter);
const fmt = ts.transpileModule(`const fmt=${formatter}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText,
  entry = "/__p35_token_equivalence.js",
  oldComponentId = path
    .resolve("apps/web/src/components/__P35TokenBaseline.vue")
    .replaceAll("\\", "/"),
  host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
${cssFiles.map((f) => `import '/src/${f}';`).join("\n")}
const params=new URL(location.href).searchParams;
const Current=(await import(params.has('baseline')?'/src/components/__P35TokenBaseline.vue':'/src/components/OrganizationDataPanel.vue')).default;
document.documentElement.dataset.design='signal-ledger';
let data=${JSON.stringify(data)};const scene=params.get('scene')||'normal';
if(scene==='zero') data=data.zeroFixture;
if(scene==='unknown') data.exports=[{...data.exports[0],status:'unrecognized'}];
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
${fmt}
const app=createApp({render:()=>h('main',{class:'org-admin-center'},h(Current,{data,formatTime:fmt}))}).use(router);
await router.isReady();app.mount('#host');`;
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const testPort = probe.address().port;
await new Promise((done) => probe.close(done));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: testPort, strictPort: true, open: false, proxy: {} },
  plugins: [
    {
      name: "p35-exact-palette-comparison",
      enforce: "pre",
      resolveId(id) {
        if (id === entry) return entry;
        if (id.endsWith("/__P35TokenBaseline.vue")) return oldComponentId;
      },
      load(id) {
        if (id === entry) return host;
        if (id.split("?")[0] === oldComponentId && !id.includes("type="))
          return source.replace(
            '<style src="../org-data-export-detail.css"></style>',
            `<style>${oldStyle}</style>`,
          );
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/org-admin/data") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
let browser;
const checks = [],
  screenshots = [];
try {
  await server.listen();
  const port = server.httpServer.address().port,
    origin = `http://127.0.0.1:${port}`;
  console.log(`p35_token_equivalence_host ${origin}`);
  browser = await chromium.launch({ headless: true });
  if (capture) await mkdir(output, { recursive: true });
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
        forbidden = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
        forbidden.push(url.pathname);
        return route.abort();
      });
      for (const scene of smoke
        ? ["normal", "zero"]
        : ["normal", "zero", "unknown", "queued", "retry_scheduled", "succeeded", "dead_letter"]) {
        const query = new URLSearchParams({ org_data_view: "exports" });
        if (["normal", "zero", "unknown"].includes(scene)) query.set("scene", scene);
        else query.set("org_data_export_status", scene);
        const baseline = new Map();
        for (const before of [true, false]) {
          await page.goto(`${origin}/org-admin/data?${query}${before ? "&baseline=1" : ""}`);
          await page.locator(".org-data-export-list article").first().waitFor();
          await page.evaluate(() => document.fonts.ready);
          const card = page.locator(".org-data-export-list article").first(),
            summary = card.locator("summary");
          for (const state of ["closed", "open", "focus", "hover", "pressed"]) {
            await page.mouse.move(0, 0);
            await summary.evaluate((n, opened) => {
              n.parentElement.open = opened;
              n.blur();
            }, state !== "closed");
            if (state === "focus") {
              await summary.focus();
              await page.keyboard.press("Tab");
              await page.keyboard.press("Shift+Tab");
            }
            if (["hover", "pressed"].includes(state)) await summary.hover();
            if (state === "pressed") await page.mouse.down();
            const bytes = await page
              .locator(".org-data-panel")
              .screenshot({ animations: "disabled" });
            if (before) baseline.set(state, hash(bytes));
            else {
              assert.equal(
                hash(bytes),
                baseline.get(state),
                `${width}/${scene}/${state} pixels changed`,
              );
              checks.push({
                width,
                scene,
                state,
                name: "pixel-identical to pre-token current Vue",
              });
              if (
                capture &&
                width <= 760 &&
                ["normal", "zero"].includes(scene) &&
                state === "open"
              ) {
                const file = `${width}-${scene}-open.png`,
                  image = await card.screenshot({ animations: "disabled" });
                await writeFile(`${output}/${file}`, image);
                screenshots.push({ file, width, scene, sha256: hash(image) });
              }
            }
            if (state === "pressed") {
              await page.mouse.move(0, 0);
              await page.mouse.up();
            }
          }
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
          );
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(forbidden, []);
      checks.push({ width, name: "no external/API requests or page errors" });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
const sourceFiles = [
    component,
    parentFile,
    exportDetailStyle,
    exportDetailTokens,
    "scripts/lib/ui-phase2-export-detail-token-delta.mjs",
    "scripts/verify-ui-phase2-export-detail-tokens.mjs",
    "scripts/lib/ui-phase2-org-data-design-data.mjs",
    ...cssFiles.map((f) => `apps/web/src/${f}`),
  ],
  sourceHashes = Object.fromEntries(
    await Promise.all(sourceFiles.map(async (f) => [f, hash(await read(f))])),
  );
if (capture) {
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "P35-EXACT-TOKEN-EXTRACTION",
        baselineCommit,
        sourceHashes,
        checks,
        screenshots,
        browserAndServerClosed: true,
        appearanceChanged: false,
        acceptanceComplete: false,
      },
      null,
      2,
    ) + "\n",
  );
} else if (!smoke) {
  const prior = JSON.parse(await read(`${output}/evidence.json`));
  assert.deepEqual(prior.sourceHashes, sourceHashes);
  assert.deepEqual(prior.checks, checks);
  for (const s of prior.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    browserAndServerClosed: true,
    appearanceChanged: false,
  }),
);
