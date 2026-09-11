import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { historicalProviderFocusSource } from "./lib/ui-phase2-provider-focus-baseline.mjs";

const capture = process.argv.includes("--capture");
const baseline = process.argv.includes("--baseline");
assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--baseline"].includes(arg)));
const mode = baseline ? "baseline" : "current";
const output = "output/playwright/p46-provider-focus-implementation/" + mode;
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
  [child]: baseline ? historicalProviderFocusSource(child, originals[child]) : originals[child],
  [registryStyle]: baseline
    ? historicalProviderFocusSource(registryStyle, originals[registryStyle])
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
  "scripts/lib/ui-phase2-provider-focus-baseline.mjs",
  "scripts/verify-ui-phase2-provider-focus.mjs",
]);
const entry = "/__p46_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/ProviderRuntimeSurface.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(pageStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(editorStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';if(new URLSearchParams(location.search).get('surface')==='review')document.body.classList.add('p46-page-review','p46-editor-review','p46-detail-review');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/providers',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P46 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',routePath:'/platform-admin/providers',capabilities:['platform:superadmin']})])}).use(router);await router.isReady();app.mount('#app');`;
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
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + port;
  console.log("p46_focus_host " + origin + " " + mode);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const surface of ["production", "review"])
    for (const width of [390, 760, 761, 1440]) {
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
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, surface + ":" + width + ":" + name);
        checks.push({ surface, width, name, actual });
      };
      let rows = definitions,
        delayed = false,
        releaseRead;
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
          if (req.method() !== "GET" || url.pathname !== "/api/v1/platform/providers") {
            unexpected.push(req.method() + " " + url.pathname);
            return route.abort();
          }
          requests.push({ method: "GET", path: url.pathname });
          if (delayed)
            await new Promise((resolve) => {
              releaseRead = resolve;
            });
          return route.fulfill({
            json: { data: rows, request_id: "p46-focus", trace_id: "p46-focus" },
          });
        });
        const goto = async (data = definitions) => {
          rows = data;
          await page.goto(origin + "/platform-admin/providers?surface=" + surface);
          await page.locator(data.length ? ".provider-list-tools" : ".provider-empty").waitFor();
        };
        const shot = async (state) => {
          if (!capture) return;
          await page.evaluate(() => document.fonts.ready);
          await page.clock.runFor(100);
          const bytes = await page.screenshot({ animations: "disabled" }),
            file = surface + "-" + width + "-" + state + ".png";
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            surface,
            width,
            state,
            file,
            sha256: hash(bytes),
            height: bytes.readUInt32BE(20),
          });
        };
        const visibleRecords = () =>
          page.locator(
            width <= 760
              ? ".responsive-data-view__mobile article > button"
              : ".responsive-data-view__desktop tbody tr button",
          );
        let targetName, targetCode;
        const openRecord = async (index = 1) => {
          const button = visibleRecords().nth(index);
          targetName = await button.evaluate(
            (n) =>
              n.closest("tr")?.querySelector("strong")?.textContent.trim() ??
              n.querySelector("strong").textContent.trim(),
          );
          await button.click();
          if (width <= 760)
            await page
              .locator(".responsive-data-view__drawer")
              .getByRole("button", { name: "编辑来源", exact: true })
              .click();
          await page.locator(".provider-editor").waitFor();
          targetCode = await page.locator(".provider-fields input").first().inputValue();
          check(
            "selected code exists in fixture",
            definitions.some((d) => d.code === targetCode),
          );
          check(
            "single dialog after handoff",
            await page.locator('[role="dialog"]:visible').count(),
            1,
          );
          check(
            "editor owns initial focus",
            await page
              .locator(".provider-fields input")
              .first()
              .evaluate((n) => n === document.activeElement),
          );
        };
        const close = async (kind) => {
          if (kind === "escape") await page.keyboard.press("Escape");
          else if (kind === "scrim")
            await page.locator(".provider-editor-layer").click({ position: { x: 1, y: 1 } });
          else await page.getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
          await page.locator(".provider-editor").waitFor({ state: "hidden" });
          if (!baseline)
            await page.waitForFunction(() => document.activeElement?.tagName === "BUTTON");
        };
        const focus = async () =>
          page.evaluate(() => {
            const n = document.activeElement;
            return {
              tag: n.tagName,
              text: n.textContent.trim(),
              id:
                n.dataset.providerFocusId ??
                n.querySelector("[data-provider-focus-id]")?.dataset.providerFocusId ??
                null,
              visible: n.checkVisibility({ visibilityProperty: true }),
              focusVisible: n.matches(":focus-visible"),
              outlineStyle: getComputedStyle(n).outlineStyle,
              outlineWidth: parseFloat(getComputedStyle(n).outlineWidth),
              articleOverflow: n.closest("article")
                ? getComputedStyle(n.closest("article")).overflow
                : null,
              inViewport: (() => {
                const r = n.getBoundingClientRect();
                const x = Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2));
                const y = Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2));
                return (
                  r.bottom > 0 &&
                  r.top < innerHeight &&
                  r.right > 0 &&
                  r.left < innerWidth &&
                  n.contains(document.elementFromPoint(x, y))
                );
              })(),
              inert: !!n.closest("[inert]"),
            };
          });
        await goto();
        await shot("default");
        await page.getByRole("button", { name: "下一页", exact: true }).click();
        const closeKinds =
          surface === "production" && width === 390
            ? ["button", "escape"]
            : ["button", "escape", "scrim"];
        for (const kind of closeKinds) {
          await openRecord(1);
          await close(kind);
          const f = await focus(),
            id = definitions.find((d) => d.code === targetCode).id;
          check("record " + kind + " focus", baseline ? f.tag : f.id, baseline ? "BODY" : id);
          if (!baseline) {
            check("record " + kind + " is button", f.tag, "BUTTON");
            check("record " + kind + " visible", f.visible);
            check("record " + kind + " in viewport", f.inViewport);
            check("record " + kind + " not inert", f.inert, false);
            if (kind === "escape") {
              check("keyboard return focus visible", f.focusVisible);
              check("keyboard outline style", f.outlineStyle, "solid");
              check("keyboard outline width", f.outlineWidth >= 2);
              if (width <= 760)
                check("mobile focus outline not clipped", f.articleOverflow, "visible");
            }
          }
          check(
            "page two retained " + kind,
            await page
              .locator(".provider-pagination")
              .innerText()
              .then((t) => t.includes("第 2 / 2 页")),
            true,
          );
          await shot("record-" + kind);
        }
        // During editing, move across the real mobile/desktop breakpoint.
        await openRecord(1);
        const resizedWidth = width <= 760 ? 1024 : 390;
        await page.setViewportSize({ width: resizedWidth, height: 900 });
        await close("button");
        const resized = await focus();
        check(
          "resize focus",
          baseline ? resized.tag : resized.id,
          baseline ? "BODY" : definitions.find((d) => d.code === targetCode).id,
        );
        if (!baseline) {
          check("resize target visible", resized.visible);
          check("resize target in viewport", resized.inViewport);
        }
        await page.setViewportSize({ width, height: 900 });
        // A read begun before editing completes after the selected row is removed.
        await goto(definitions.slice(0, 3));
        delayed = true;
        await page.locator(".provider-list-heading > button").click();
        await page.waitForFunction(
          () => document.querySelector(".provider-list-heading > button")?.disabled,
        );
        await openRecord(1);
        while (!releaseRead) await new Promise((resolve) => setTimeout(resolve, 10));
        rows = definitions.filter((d) => d.code !== targetCode).slice(0, 2);
        delayed = false;
        releaseRead();
        releaseRead = null;
        await page.waitForFunction(
          () => document.querySelector(".provider-overview article strong")?.textContent === "2",
        );
        await close("button");
        const fallback = await focus();
        check(
          "removed row fallback",
          baseline ? fallback.tag : fallback.text,
          baseline ? "BODY" : "＋ 新建来源",
        );
        await shot("missing-record");
        await page.locator(".provider-hero > button").click();
        await page.locator(".provider-editor").waitFor();
        await close("escape");
        check(
          "header create returns focus",
          await page
            .locator(".provider-hero > button")
            .evaluate((n) => n === document.activeElement),
        );
        await shot("header-create");
        await goto([]);
        await page.locator(".provider-empty > button").click();
        await page.locator(".provider-editor").waitFor();
        await close("button");
        const empty = await focus();
        check(
          "empty create returns focus",
          baseline ? empty.tag : empty.text,
          baseline ? "BODY" : "登记第一个来源",
        );
        await shot("empty-create");
        check("three loads plus one refresh", requests.length, 4);
        check("no page errors", errors, []);
        check("no unexpected network", unexpected, []);
        observations.push({ surface, width, requests, errors, unexpected });
        console.log("passed " + mode + " " + surface + " " + width);
      } finally {
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
          kind: "P46-EDITOR-FOCUS-IMPLEMENTATION-r1",
          mode,
          scope:
            "Actual untransformed ProviderRuntimeSurface and Registry, production styles and review CSS separately. Historical baseline651e9898 vs current source. GET fixtures only; no writes or production backend. Close button/Escape/scrim, page-two identity, breakpoint resize, removed record during pending read, header and empty create. Not save lifecycle, full App/KeepAlive or modal accessibility acceptance.",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46编辑关闭焦点</title><style>body{font:16px/1.6 sans-serif;margin:24px}img{max-width:100%}</style><h1>P46编辑关闭焦点 · ' +
        mode +
        "</h1><p>测试数据，生产样式与C审核样式分别验证；未部署。</p>" +
        screenshots
          .map(
            (s) =>
              "<article><h2>" +
              s.surface +
              " " +
              s.width +
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
