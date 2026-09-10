import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import os from "node:os";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { buildPlatformOverviewDesignData } from "./lib/ui-phase2-platform-overview-design-data.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p38-entry-links",
  read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const data = await buildPlatformOverviewDesignData(process.cwd());
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => m[1]);
const stylesheet =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-overview-preview.css";
const catalog = JSON.parse(await read("config/route-catalog.json"));
const entry = "/__p38_entry_links.js";
const host = `import {createApp,h,ref} from 'vue';
import {createRouter,createWebHistory} from 'vue-router';
import Current from '/src/components/PlatformDashboard.vue';
import {surfaceProps} from '/src/navigation-shell-route-state.ts';
${cssFiles.map((f) => `import '/src/${f}';`).join("\n")}
import '/@fs/${path.resolve(stylesheet).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p38-vue-preview');
const caps=ref(['platform:operate']);window.__entryFixture={caps};
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const app=createApp({setup:()=>()=>h('main',[
h('p',{class:'preview-disclaimer'},'P38 入口组合 · 实际 Vue / 测试样例 · 能力参数模拟，非权限验收 · 待审'),
h(Current,surfaceProps({surface:'platform-dashboard',path:router.currentRoute.value.path,apiBaseUrl:'/api/v1',capabilities:caps.value,roles:[]}))])}).use(router);
await router.isReady();app.mount('#app');`;
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {} },
  plugins: [
    {
      name: "p38-entry-links",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/platform-admin") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P38 入口组合</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  navigation = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p38_entry_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        unexpected = [],
        requests = [];
      let responseStatus = 200,
        emptyTrend = false;
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (
          url.origin === origin &&
          url.pathname === "/api/v1/platform/dashboard" &&
          request.method() === "GET"
        ) {
          requests.push(url.searchParams.get("window"));
          return route.fulfill({
            status: responseStatus,
            json:
              responseStatus === 200
                ? {
                    data: {
                      ...data.dashboard,
                      window: url.searchParams.get("window"),
                      task_trend: emptyTrend ? [] : data.trend,
                    },
                    request_id: "p38-link-fixture",
                    trace_id: "p38-link-fixture",
                  }
                : {
                    error: {
                      code: "SESSION_EXPIRED",
                      message: "fixture expired",
                      action_hint: "fixture only",
                    },
                    request_id: "p38-link-failure",
                    trace_id: "p38-link-failure",
                  },
          });
        }
        if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
        unexpected.push(request.method() + " " + url.href);
        return route.abort();
      });
      await page.goto(`${origin}/platform-admin?window=24h&keep=entry`);
      await expect(page.locator(".platform-facts")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const links = page.locator(".platform-dashboard a");
      const currentLinks = () =>
        links.evaluateAll((nodes) =>
          nodes.map((n) => ({
            text: n.textContent.replace(/\s+/g, " ").trim(),
            href: n.getAttribute("href"),
          })),
        );
      const snap = async (state, selector = ".platform-facts") => {
        if (!capture || ![390, 1440].includes(width)) return;
        const file = `${width}-${state}.png`,
          area = page.locator(selector),
          bytes = await area.screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          sha256: hash(bytes),
          kind: "vue-isolated",
          pageId: "P38",
          state,
          viewport: { width, height: 1000 },
          imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          concreteUrl: page.url(),
          buildSha: null,
          capturedAt: new Date().toISOString(),
          browser: browser.version(),
          os: os.platform(),
          font: await area.evaluate((n) => getComputedStyle(n).fontFamily),
          caseId: `P38-entry-${width}-${state}`,
          approval: "pending",
        });
      };
      await expect(links).toHaveCount(7);
      await expect(page.getByText("仅超级管理员可查看明细", { exact: true })).toHaveCount(2);
      await snap("operate-facts");
      await snap("operate-shortcuts", ".platform-get-started");
      const initialRequests = requests.length;
      for (const caps of [["platform:operate", "platform:superadmin"], ["platform:superadmin"]]) {
        await page.evaluate((c) => (window.__entryFixture.caps.value = c), caps);
        await expect(links).toHaveCount(10);
      }
      await snap("superadmin-facts");
      await snap("superadmin-shortcuts", ".platform-get-started");
      assert.equal(requests.length, initialRequests);
      checks.push({
        width,
        name: "actual surfaceProps passes capabilities; 7 versus 10 ready links, three superadmin-only source sites, no capability-change GET",
      });
      const baseLinks = await currentLinks();
      assert.equal(baseLinks.length, 10);
      for (let index = 0; index < baseLinks.length; index++) {
        const expected = baseLinks[index],
          destination = new URL(expected.href, origin);
        assert.ok(
          catalog.routes.some((r) => r.path === destination.pathname),
          expected.href,
        );
        const link = links.nth(index);
        await link.scrollIntoViewIfNeeded();
        const rect = await link.boundingBox();
        assert.ok(rect.width >= 44 && rect.height >= 44, `${expected.text}: touch target`);
        await link.click();
        await expect(page).toHaveURL(origin + expected.href);
        navigation.push({
          width,
          text: expected.text,
          href: expected.href,
          scope: "router-destination-only-not-destination-page",
        });
        await page.goBack();
        await expect(page).toHaveURL(`${origin}/platform-admin?window=24h&keep=entry`);
        await expect(page.getByRole("button", { name: "刷新", exact: true })).toBeEnabled();
      }
      checks.push({
        width,
        name: "all ten ready RouterLink source instances clicked; exact catalog path/query and return URL; destinations not mounted",
      });
      emptyTrend = true;
      await page.getByRole("button", { name: "刷新", exact: true }).click();
      await expect(links).toHaveCount(12);
      for (const text of ["检查来源是否启用", "查看采集队列"]) {
        const link = page.getByRole("link", { name: text, exact: true }),
          href = await link.getAttribute("href");
        await link.click();
        await expect(page).toHaveURL(origin + href);
        navigation.push({
          width,
          text,
          href,
          scope: "router-destination-only-not-destination-page",
        });
        await page.goBack();
        await expect(page).toHaveURL(`${origin}/platform-admin?window=24h&keep=entry`);
        await expect(page.getByRole("button", { name: "刷新", exact: true })).toBeEnabled();
      }
      checks.push({
        width,
        name: "empty trend adds exactly its two existing navigation instances, no new business operation",
      });
      const beforeRemoval = requests.length;
      await page.evaluate(() => (window.__entryFixture.caps.value = []));
      await expect(links).toHaveCount(9);
      assert.equal(requests.length, beforeRemoval);
      await expect(page.locator(".platform-facts")).toBeVisible();
      checks.push({
        width,
        name: "removing capability input hides three entry instances but does not clear child facts; isolated child is not an authorization gate",
      });
      responseStatus = 401;
      await page.reload();
      await expect(page.locator(".platform-dashboard-state")).toHaveAttribute(
        "data-kind",
        "expired",
      );
      const login = page.getByRole("link", { name: "重新登录", exact: true });
      await expect(login).toHaveAttribute("href", "/login");
      await login.click();
      await expect(page).toHaveURL(origin + "/login");
      navigation.push({
        width,
        text: "重新登录",
        href: "/login",
        scope: "router-destination-only-not-login-flow",
      });
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      assert.ok(requests.every((v) => v === "24h"));
      checks.push({
        width,
        name: "initial 401 exposes the existing login link; no real login, external/API mutation, page errors or changed window",
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
const files = [
  "scripts/verify-ui-phase2-platform-entry-links.mjs",
  "scripts/lib/ui-phase2-platform-overview-design-data.mjs",
  "apps/web/src/components/PlatformDashboard.vue",
  "apps/web/src/components/ResponsiveDataView.vue",
  "apps/web/src/components/TableViewControls.vue",
  "apps/web/src/components/TechnicalDetails.vue",
  "apps/web/src/navigation-shell-route-state.ts",
  "apps/web/src/api-client.ts",
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "config/route-catalog.json",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
  stylesheet,
  ...cssFiles.map((f) => "apps/web/src/" + f),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(files.map(async (f) => [f, hash(await read(f))])),
);
if (capture) {
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        scope:
          "Actual Vue with capability input fixtures and real surfaceProps; NOT full NavigationShell, backend RBAC, destination page, OS clipboard or production acceptance.",
        approval: "pending",
        sourceHashes,
        checks,
        navigation,
        screenshots,
        processesClosed: true,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><h1>P38 按能力展示入口 · 待审</h1><p>实际 Vue / 参数样例 / 非权限验收 / 未部署</p>${screenshots.map((s) => `<h2>${s.file}</h2><img style="max-width:100%" src="${s.file}" alt="${s.state}">`).join("\n")}</html>`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    navigation: navigation.length,
    screenshots: screenshots.length,
    processesClosed: true,
  }),
);
