import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildOrgApprovalsDesignData } from "./lib/ui-phase2-org-approvals-design-data.mjs";
import {
  previewApprovalsVue,
  approvalsVueFile,
  approvalsVueCss,
} from "./lib/ui-phase2-org-approvals-vue-preview.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--capture"));
const capture = args.length === 1;
const output = "output/playwright/p34-pagination-focus-r3";
const entry = "/__p34_pagination_focus.js";
const reviewEntry = "/src/components/__p34_pagination_preview.vue";
const reviewId = path.resolve("apps/web/src/components/__p34_pagination_preview.vue");
const original = (await readFile(approvalsVueFile, "utf8")).replaceAll("\r\n", "\n");
const reviewSource = previewApprovalsVue(original);
assert.equal(
  reviewSource.split('<script setup lang="ts">')[1].split("</script>")[0],
  original.split('<script setup lang="ts">')[1].split("</script>")[0],
);
const data = await buildOrgApprovalsDesignData(process.cwd());
// Explicitly synthetic three-page fixtures; no new API or persisted data.
data.items = Array.from({ length: 17 }, (_, i) => ({
  ...data.items[i % data.items.length],
  id: `focus-request-${i}`,
  title: `分页验证审批 ${i}`,
}));
data.templates = Array.from({ length: 13 }, (_, i) => ({
  ...data.templates[i % data.templates.length],
  id: `focus-template-${i}`,
  name: `分页验证模板 ${i}`,
}));
const host = `import {createApp,h,ref,nextTick} from 'vue';
import {createRouter,createWebHistory} from 'vue-router';
import Panel from '/src/components/OrganizationApprovalPanel.vue';
import ReviewPanel from '${reviewEntry}';
import '/@fs/${path.resolve(approvalsVueCss).replaceAll("\\", "/")}';
import '/src/styles.css';import '/src/organization-admin.css';import '/src/design/tokens.css';
import '/src/accessibility.css';import '/src/responsive-baselines.css';import '/src/signal-ledger.css';
document.documentElement.dataset.design='signal-ledger';
const review=new URL(location.href).searchParams.get('preview')==='review';
document.body.classList.toggle('approvals-vue-c',review);
const data=${JSON.stringify(data)};
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const Host={setup(){const child=ref();window.p34Pagination={
ready:()=>!!child.value,
navigate:async query=>{await router.push({path:'/org-admin/approvals',query});await nextTick();await nextTick();},
state:()=>Object.fromEntries(['section','requestPage','templatePage','requestPageCount','templatePageCount'].map(k=>[k,child.value.$.setupState[k]]))};
return()=>h('main',{class:'org-admin-center'},h(review?ReviewPanel:Panel,{ref:child,templates:data.templates,approvals:data.items,summary:data.summary,statusText:v=>v,summaryText:v=>v,formatTime:v=>v}));}};
const app=createApp(Host).use(router);await router.isReady();app.mount('#host');`;
const portProbe = reservePort();
await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port, strictPort: true, open: false },
  plugins: [
    {
      name: "p34-pagination-focus-isolated-host",
      enforce: "pre",
      resolveId: (id) => (id === entry ? id : id === reviewEntry ? reviewId : undefined),
      load: (id) =>
        id === entry ? host : path.normalize(id) === reviewId ? reviewSource : undefined,
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/org-admin/approvals") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P34 分页焦点隔离验证</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  blocked = [],
  errors = [];
let browser;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
try {
  // Exclusive capture: never overwrite an existing review packet.
  if (capture) await mkdir(output);
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  console.log(`p34_pagination_host_started ${origin}`);
  browser = await chromium.launch({ headless: true });
  for (const { width, mode } of [390, 760, 761, 1440].flatMap((width) =>
    ["baseline", "review"].map((mode) => ({ width, mode })),
  )) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
        blocked.push({ method: route.request().method(), path: url.pathname });
        return route.abort();
      });
      await page.goto(`${origin}/org-admin/approvals?keep=unchanged&preview=${mode}`);
      await page.waitForFunction(() => window.p34Pagination?.ready());
      for (const view of ["requests", "templates"]) {
        const key = view === "requests" ? "requestPage" : "templatePage";
        const queryKey = view === "requests" ? "approval_request_page" : "approval_template_page";
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${width}/${mode}/${view}: ${name}`);
          checks.push({ width, mode, view, name });
        };
        const navigate = async (number) => {
          await page.evaluate((q) => window.p34Pagination.navigate(q), {
            keep: "unchanged",
            approval_view: view,
            [queryKey]: String(number),
          });
          await page.waitForFunction(
            ([k, n]) => window.p34Pagination.state()[k] === n,
            [key, number],
          );
        };
        const waitPage = (n) =>
          page.waitForFunction(
            ([k, n, q]) =>
              window.p34Pagination.state()[k] === n &&
              (new URL(location.href).searchParams.get(q) || "1") === String(n),
            [key, n, queryKey],
          );
        const footer = page.locator(".org-approval-pagination");
        const status = footer.locator(":scope > span");
        for (const direction of [1, -1]) {
          await navigate(direction === 1 ? 1 : 3);
          const button = footer.getByRole("button", {
            name: direction === 1 ? "下一页" : "上一页",
            exact: true,
          });
          await button.focus();
          await button.press("Enter");
          await waitPage(2);
          check(
            `${direction}: middle keeps trigger focus`,
            await button.evaluate((el) => el === document.activeElement),
          );
          await button.press("Enter");
          await waitPage(direction === 1 ? 3 : 1);
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          check(`${direction}: boundary button disabled`, await button.isDisabled());
          check(
            `${direction}: boundary focus stays in same footer`,
            await status.evaluate((el) => el === document.activeElement),
          );
          check(
            `${direction}: persistent status semantics`,
            await status.evaluate((el) => [
              el.getAttribute("role"),
              el.getAttribute("tabindex"),
              el.getAttribute("aria-live"),
              el.getAttribute("aria-atomic"),
            ]),
            ["status", "-1", "polite", "true"],
          );
          check(
            `${direction}: visible keyboard focus`,
            await status.evaluate((el) => {
              const s = getComputedStyle(el);
              return (
                el.matches(":focus-visible") &&
                s.outlineStyle !== "none" &&
                parseFloat(s.outlineWidth) >= 2
              );
            }),
          );
          if (mode === "review") {
            await page.waitForFunction(
              () =>
                getComputedStyle(document.querySelector(".org-approval-pagination > span"))
                  .outlineColor === "rgb(77, 121, 255)",
              undefined,
              { timeout: 3000 },
            );
            check(
              `${direction}: C blue focus`,
              await status.evaluate((el) => getComputedStyle(el).outlineColor),
              "rgb(77, 121, 255)",
            );
          }
          if (capture) {
            const file = `${mode}-${view}-${direction === 1 ? "last" : "first"}-${width}.png`;
            await footer.scrollIntoViewIfNeeded();
            const box = await footer.boundingBox();
            const viewport = page.viewportSize();
            const x = Math.max(0, box.x - 6),
              y = Math.max(0, box.y - 6);
            const bytes = await page.screenshot({
              clip: {
                x,
                y,
                width: Math.min(viewport.width - x, box.width + 12),
                height: Math.min(viewport.height - y, box.height + 12),
              },
            });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({ file, width, mode, view, sha256: hash(bytes) });
          }
          await page.keyboard.press("Tab");
          check(
            `${direction}: Tab reaches enabled opposite button`,
            await footer
              .getByRole("button", { name: direction === 1 ? "上一页" : "下一页", exact: true })
              .evaluate((el) => el === document.activeElement),
          );
        }
        await navigate(2);
        const search = page.locator(".org-approval-toolbar input");
        await search.focus();
        // Programmatic click is a negative case: pagination must not steal another owner's focus.
        await footer
          .getByRole("button", { name: "下一页", exact: true })
          .evaluate((el) => el.click());
        await waitPage(3);
        check(
          "unowned focus retained",
          await search.evaluate((el) => el === document.activeElement),
        );
        check(
          "unrelated query preserved",
          new URL(page.url()).searchParams.get("keep"),
          "unchanged",
        );
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(blocked, [], "No API or external requests");
  assert.deepEqual(errors, [], "No browser errors");
  if (capture) {
    const sourceFiles = [...server.moduleGraph.idToModuleMap.keys()]
      .map((id) => path.normalize(id.split("?")[0]))
      .filter(
        (f) =>
          path.isAbsolute(f) &&
          !f.includes("node_modules") &&
          f.startsWith(path.resolve("apps/web")) &&
          f !== reviewId,
      );
    assert.ok(
      sourceFiles.includes(path.resolve("apps/web/src/components/OrganizationApprovalPanel.vue")),
    );
    sourceFiles.push(
      path.resolve(approvalsVueCss),
      path.resolve("scripts/lib/ui-phase2-org-approvals-vue-preview.mjs"),
      path.resolve("scripts/verify-ui-phase2-org-approvals-pagination-focus.mjs"),
      path.resolve("scripts/lib/ui-phase2-org-approvals-design-data.mjs"),
      path.resolve("tests/e2e/m06-01-organization-admin.spec.ts"),
    );
    const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...new Set(sourceFiles)]
          .sort()
          .map(async (f) => [
            path.relative(process.cwd(), f).replaceAll("\\", "/"),
            hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n")),
          ]),
      ),
    );
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          boundary:
            "Current raw Vue child and existing C template/CSS preview with unchanged current script; real router and synthetic data. Not full App, whole-page approval, screen-reader, API or production acceptance",
          reviewSourceHash: hash(reviewSource),
          approval: "pending-pagination-focus-review",
          sourceHashes,
          checks,
          screenshots,
          blocked,
          errors,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    apiRequests: blocked.length,
    browserAndServerClosed: true,
  }),
);
