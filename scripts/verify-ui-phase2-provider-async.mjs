import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { historicalProviderAsyncSource } from "./lib/ui-phase2-provider-async-baseline.mjs";

const capture = process.argv.includes("--capture");
const baseline = process.argv.includes("--baseline");
assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--baseline"].includes(arg)));
const mode = baseline ? "baseline" : "current";
const output = "output/playwright/p46-provider-async-implementation/" + mode;
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");

const parent = "apps/web/src/components/ProviderRuntimeSurface.vue";
const child = "apps/web/src/components/ProviderRegistry.vue";
const pageStyle = "design-plans/ui-phase-2-2026-09-07/implementation/provider-page-preview.css";
const editorStyle = "design-plans/ui-phase-2-2026-09-07/implementation/provider-editor-preview.css";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/provider-detail-preview.css";
const registryStyle = "apps/web/src/provider-registry.css";
const originals = { [child]: await read(child), [registryStyle]: await read(registryStyle) };
const transformed = {
  [child]: baseline ? historicalProviderAsyncSource(child, originals[child]) : originals[child],
  [registryStyle]: baseline
    ? historicalProviderAsyncSource(registryStyle, originals[registryStyle])
    : originals[registryStyle],
};
const fixtureFile = "tests/e2e/m03-01-provider-registry.spec.ts";
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const box = {};
vm.runInNewContext(
  ["definition", "blockedDefinition", "definitions"]
    .map((name) => {
      const matches = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(matches.length, 1);
      return "const " + name + "=" + matches[0].initializer.getText(ast) + ";";
    })
    .join("\n") + "globalThis.result=definitions;",
  box,
);
const definitions = JSON.parse(JSON.stringify(box.result));
assert.equal(definitions.length, 25);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => "apps/web/src/" + m[1]);
const sources = new Set([
  parent,
  child,
  style,
  pageStyle,
  editorStyle,
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "apps/web/src/navigation-shell-route-state.ts",
  "scripts/lib/ui-phase2-provider-async-baseline.mjs",
  "scripts/verify-ui-phase2-provider-async.mjs",
]);
const entry = "/__p46_review.js";
const host = `import {createApp,h,ref,KeepAlive} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/ProviderRuntimeSurface.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(pageStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(editorStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';if(new URLSearchParams(location.search).get('surface')==='review')document.body.classList.add('p46-page-review','p46-editor-review','p46-detail-review');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/providers',query});
const shown=ref(true),Away={name:'Away',render:()=>h('button',{id:'away'},'隔离宿主的其他页面')};window.__away=()=>{shown.value=false};window.__back=()=>{shown.value=true};const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P46 异步归属 · 实际Vue隔离KeepAlive · 测试数据 · 未上线'),h(KeepAlive,null,{default:()=>shown.value?h(Parent,{key:'provider',apiBaseUrl:'/api/v1',routePath:'/platform-admin/providers',capabilities:['platform:superadmin']}):h(Away)})])}).use(router);await router.isReady();app.mount('#app');window.__destroy=()=>app.unmount();`;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p46-review",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(source, id) {
        const file = Object.keys(originals).find(
          (f) => path.resolve(f).replaceAll("\\", "/") === id.replaceAll("\\", "/"),
        );
        if (!file) return null;
        assert.equal(source.replaceAll("\r\n", "\n"), originals[file]);
        return { code: transformed[file], map: null };
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/platform-admin/providers") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46 来源设置审核</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});

const checks = [],
  screenshots = [],
  observations = [];
const cases = [
  "late-success-create",
  "late-failure-edit",
  "refresh-success-create",
  "refresh-failure-edit",
  "reload-new-create",
  "inactive-success-edit",
  "inactive-failure-edit",
  "read-deactivate",
];
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + port;
  console.log("p46_async_host " + origin + " " + mode);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const surface of ["production", "review"])
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      const page = await context.newPage(),
        requests = [],
        errors = [],
        unexpected = [];
      let scenario,
        readCount = 0,
        pendingWrite,
        pendingRead,
        releaseWrite,
        releaseRead;
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, surface + ":" + width + ":" + scenario + ":" + name);
        checks.push({ surface, width, scenario, name, actual });
      };
      const waitForLatch = async (kind) => {
        for (let i = 0; i < 500 && !(kind === "write" ? releaseWrite : releaseRead); i++)
          await new Promise((r) => setTimeout(r, 10));
        assert.ok(kind === "write" ? releaseWrite : releaseRead, kind + " latch");
      };
      try {
        await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/*", async (route) => {
          const req = route.request(),
            url = new URL(req.url());
          if (url.origin !== origin) {
            unexpected.push(req.url());
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const method = req.method();
          if (
            url.pathname !== "/api/v1/platform/providers" &&
            url.pathname !== "/api/v1/platform/providers/" + definitions[0].id
          ) {
            unexpected.push(method + " " + url.pathname);
            return route.abort();
          }
          if (!["GET", "POST", "PUT"].includes(method)) {
            unexpected.push(method);
            return route.abort();
          }
          const entry = {
            scenario,
            method,
            path: url.pathname,
            body: method === "GET" ? null : req.postDataJSON(),
            idempotencyPresent: method === "GET" ? false : !!req.headers()["idempotency-key"],
          };
          requests.push(entry);
          if (method !== "GET") {
            pendingWrite = true;
            const requestedStatus = await new Promise((resolve) => {
              releaseWrite = resolve;
            });
            const status = requestedStatus === 200 && method === "POST" ? 201 : requestedStatus;
            pendingWrite = false;
            entry.status = status;
            return route.fulfill({
              status,
              json:
                status === 409
                  ? {
                      error: {
                        code: "provider_version_conflict",
                        message: "旧请求版本冲突",
                        action_hint: "旧请求冲突，请重新核对。",
                      },
                      request_id: "old-write-error",
                      trace_id: "async",
                    }
                  : {
                      data: { ...definitions[0], ...entry.body },
                      request_id: "accepted-write",
                      trace_id: "async",
                    },
            });
          }
          readCount++;
          if (
            (scenario === "reload-new-create" && readCount === 2) ||
            (scenario === "read-deactivate" && readCount === 1)
          ) {
            pendingRead = true;
            await new Promise((resolve) => {
              releaseRead = resolve;
            });
            pendingRead = false;
          }
          const status = scenario === "refresh-failure-edit" && readCount === 2 ? 500 : 200;
          entry.status = status;
          return route.fulfill({
            status,
            json:
              status === 500
                ? {
                    error: {
                      code: "dependency_unavailable",
                      message: "读取失败",
                      action_hint: "请重新读取来源。",
                    },
                    request_id: "read-error",
                    trace_id: "async",
                  }
                : { data: [definitions[0]], request_id: "read-" + readCount, trace_id: "async" },
          });
        });
        const shot = async (state) => {
          if (await page.locator(".provider-editor").count()) {
            await page.locator(".provider-editor").evaluate((n) => {
              n.scrollTop = n.scrollHeight;
            });
          } else if (await page.locator('.provider-feedback[data-tone="success"]').count()) {
            await page.locator('.provider-feedback[data-tone="success"]').scrollIntoViewIfNeeded();
          }
          await page.evaluate(() => document.fonts.ready);
          await page.clock.runFor(100);
          if (!capture) return;
          const bytes = await page.screenshot({ animations: "disabled" }),
            file = surface + "-" + width + "-" + scenario + "-" + state + ".png";
          await writeFile(output + "/" + file, bytes);
          screenshots.push({ surface, width, scenario, state, file, sha256: hash(bytes) });
        };
        const open = async (editing = false, name = "审核保存") => {
          if (editing) {
            if (width === 390) {
              await page.locator(".responsive-data-view__mobile article > button").click();
              await page
                .locator(".responsive-data-view__drawer")
                .getByRole("button", { name: "编辑来源", exact: true })
                .click();
            } else await page.locator(".responsive-data-view__desktop tbody tr button").click();
          } else await page.locator(".provider-hero > button").click();
          await page.locator(".provider-editor").waitFor();
          if (!editing) await page.locator(".provider-fields input").first().fill("review_source");
          await page.getByRole("textbox", { name: /^名称/ }).fill(name);
          await page.getByRole("textbox", { name: /^目标 URL/ }).fill("https://example.test/feed");
          await page.getByRole("button", { name: "4 合规与发布", exact: true }).click();
        };
        const close = async () => {
          await page.getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
          await page.locator(".provider-editor").waitFor({ state: "hidden" });
        };
        const settle = async () => {
          await page.waitForLoadState("networkidle");
        };
        for (scenario of cases) {
          readCount = 0;
          releaseWrite = null;
          releaseRead = null;
          pendingWrite = false;
          pendingRead = false;
          const start = requests.length;
          await page.goto(origin + "/platform-admin/providers?surface=" + surface);
          if (scenario === "read-deactivate") {
            await waitForLatch("read");
            await page.evaluate(() => window.__away());
            await page.locator("#away").waitFor();
            await shot("away");
            releaseRead();
            releaseRead = null;
            await settle();
            await page.evaluate(() => window.__back());
            await page.locator(".provider-list-tools").waitFor();
            check("read count after cached return", readCount, baseline ? 1 : 2);
            check(
              "exact returned list",
              await page.locator(".provider-overview article strong").first().innerText(),
              "1",
            );
            await shot("returned");
          } else {
            await page.locator(".provider-list-tools").waitFor();
            const editing = scenario.endsWith("edit");
            await open(editing);
            await page.locator(".provider-editor button[type=submit]").click();
            await waitForLatch("write");
            check("original write method", requests.at(-1).method, editing ? "PUT" : "POST");
            check(
              "original expected version presence",
              Object.hasOwn(requests.at(-1).body, "expected_version"),
              editing,
            );
            check("write keeps idempotency", requests.at(-1).idempotencyPresent);
            if (scenario.startsWith("late")) {
              await close();
              await open(false, "新窗口草稿");
              await page.getByRole("button", { name: "应用技术模板", exact: true }).click();
              check(
                "serial pending disabled",
                await page.locator(".provider-editor button[type=submit]").isDisabled(),
              );
              check(
                "new window pending label",
                await page.locator(".provider-editor button[type=submit]").innerText(),
                baseline ? "保存中…" : "等待上一项保存…",
              );
              await shot("pending-new");
              releaseWrite(scenario.includes("failure") ? 409 : 200);
              releaseWrite = null;
              await settle();
              const remains = !baseline || scenario.includes("failure");
              check(
                "new editor remains",
                await page.locator(".provider-editor").count(),
                remains ? 1 : 0,
              );
              if (remains) {
                await page.getByRole("button", { name: "1 基本信息", exact: true }).click();
                check(
                  "new draft name retained",
                  await page.getByRole("textbox", { name: /^名称/ }).inputValue(),
                  "新窗口草稿",
                );
                const feedback = await page.locator(".provider-editor-message").innerText();
                check(
                  "feedback belongs to current window",
                  baseline ? feedback.includes("旧请求冲突") : feedback.includes("已应用"),
                  true,
                );
                check(
                  "no stale editor request id",
                  await page.locator(".provider-editor-message code").count(),
                  baseline ? 1 : 0,
                );
              }
              check(
                "stale success does not reload",
                readCount,
                baseline && scenario.includes("success") ? 2 : 1,
              );
              await shot("settled");
            } else if (scenario.startsWith("inactive")) {
              await page.evaluate(() => window.__away());
              await page.locator("#away").waitFor();
              await shot("away");
              releaseWrite(scenario.includes("failure") ? 409 : 200);
              releaseWrite = null;
              await settle();
              check(
                "no inactive followup read",
                readCount,
                baseline && scenario.includes("success") ? 2 : 1,
              );
              await page.evaluate(() => window.__back());
              await page.locator(".provider-registry").waitFor();
              check(
                "cached editor retained",
                await page.locator(".provider-editor").count(),
                baseline && scenario.includes("success") ? 0 : 1,
              );
              if (!baseline)
                check(
                  "cached editor has no stale error",
                  await page.locator(".provider-editor-message").count(),
                  0,
                );
              await shot("returned");
            } else {
              releaseWrite(200);
              releaseWrite = null;
              if (scenario === "reload-new-create") {
                await waitForLatch("read");
                await open(false, "刷新中的新草稿");
                await page.getByRole("button", { name: "应用技术模板", exact: true }).click();
                await shot("pending-new");
                releaseRead();
                releaseRead = null;
                await settle();
                check(
                  "editor survives earlier refresh",
                  await page.locator(".provider-editor").count(),
                  1,
                );
                check(
                  "old success not posted into new window session",
                  await page.locator('.provider-feedback[data-tone="success"]').count(),
                  baseline ? 1 : 0,
                );
                check(
                  "editor technical id isolated from read",
                  await page.locator(".provider-editor-message code").count(),
                  baseline ? 1 : 0,
                );
                await shot("settled");
              } else {
                await settle();
                const feedback = await page
                  .locator('.provider-feedback[data-tone="success"]')
                  .innerText();
                check("save is confirmed", feedback.includes(editing ? "已更新" : "已创建"));
                check(
                  "refresh fact matches outcome",
                  feedback.includes("列表未能刷新"),
                  !baseline && scenario.includes("failure"),
                );
                check(
                  "current save closes editor",
                  await page.locator(".provider-editor").count(),
                  0,
                );
                await shot("settled");
                if (scenario.includes("failure")) {
                  check(
                    "failed refresh retained snapshot",
                    await page.locator(".provider-overview article strong").first().innerText(),
                    "1",
                  );
                  await page
                    .locator(".provider-feedback")
                    .filter({ hasText: "刷新失败" })
                    .getByRole("button", { name: "再次刷新", exact: true })
                    .click();
                  await settle();
                  check("manual retry retained", readCount, 3);
                  check(
                    "obsolete save-refresh caption cleared on retry",
                    await page.locator('.provider-feedback[data-tone="success"]').count(),
                    baseline ? 1 : 0,
                  );
                  await shot("retried");
                }
              }
            }
          }
          observations.push({ surface, width, scenario, requests: requests.slice(start) });
        }
        check("no page errors", errors, []);
        check("no unexpected network", unexpected, []);
        console.log("passed " + mode + " " + surface + " " + width);
      } finally {
        releaseWrite?.(409);
        releaseRead?.();
        await context.close();
      }
    }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css)$/.test(file)
    )
      sources.add(file);
  }
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      [...sources].sort().map(async (f) => [f, hash(transformed[f] ?? (await read(f)))]),
    ),
  );
  await browser.close();
  browser = null;
  await server.close();
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P46-ASYNC-OWNERSHIP-r1",
          mode,
          scope:
            "Current actual ProviderRuntimeSurface/Registry in an isolated KeepAlive harness, not full NavigationShell/App. Historical baseline af60b101 versus current; production and C review CSS separately,390/1440. Original fixtures and explicitly entered test drafts; all GET/POST/PUT intercepted, supplied success/error only, no real persistence or permissions. Preserve existing request bodies and serial pending save; late results, refresh truth, separate editor/read request IDs and cached return checked. Focus/field residual/date/full modal acceptance not expanded.",
          sourceHashes,
          checks,
          screenshots,
          observations,
          processesClosed: true,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46异步归属</title><style>body{font:16px/1.6 sans-serif;margin:24px}img{max-width:100%}</style><h1>P46异步归属 · ' +
        mode +
        "</h1><p>隔离KeepAlive实际Vue，测试成功/失败，不是生产保存验收。</p>" +
        screenshots
          .map(
            (s) =>
              "<article><h2>" +
              s.surface +
              " " +
              s.width +
              " " +
              s.scenario +
              " " +
              s.state +
              '</h2><img loading="lazy" src="' +
              s.file +
              '"></article>',
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      mode,
      checks: checks.length,
      images: screenshots.length,
      sources: sources.size,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
