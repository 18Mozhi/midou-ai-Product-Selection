import assert from "node:assert/strict";
import { userReasonCases } from "./lib/ui-phase2-user-reason-cases.mjs";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { userPasswordPreview } from "./lib/ui-phase2-user-password-preview.mjs";
import { userPagePreview } from "./lib/ui-phase2-user-page-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p43-reasons-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/user-page-preview.css";
const child = "apps/web/src/components/PlatformAccountDialogs.vue";
const passwordStyle = "design-plans/ui-phase-2-2026-09-07/implementation/user-password-preview.css";
const reasonStyle = "design-plans/ui-phase-2-2026-09-07/implementation/user-reason-preview.css";
const originals = {
  [parent]: await read(parent),
  [detailFile]: await read(detailFile),
  [child]: await read(child),
};
const transformed = {
  [parent]: userPagePreview(originals[parent], "parent"),
  [detailFile]: userPagePreview(originals[detailFile], "detail"),
  [child]: userPasswordPreview(originals[child]),
};
const fixtureFile = "tests/e2e/m06-01-platform-accounts.spec.ts";
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const code = ["user", "org", "session", "overview"]
  .map((name) => {
    const nodes = declarations.filter((n) => n.name.getText(ast) === name);
    assert.equal(nodes.length, 1);
    return `const ${name}=${nodes[0].initializer.getText(ast)};`;
  })
  .join("\n");
const details = [];
function find(node) {
  if (
    ts.isObjectLiteralExpression(node) &&
    ["user", "memberships", "sessions"].every((key) =>
      node.properties.some((p) => p.name?.getText(ast) === key),
    ) &&
    node.getText(ast).includes('device_label: "Chrome"')
  )
    details.push(node);
  ts.forEachChild(node, find);
}
find(ast);
assert.equal(details.length, 1);
const fixture = JSON.parse(
  JSON.stringify(vm.runInNewContext(`${code}\n({overview,detail:${details[0].getText(ast)}})`)),
);
// Original detail fixture lacks organization_id. Preserve and disclose it, never silently repair.
assert.equal(fixture.detail.memberships[0].organization_id, undefined);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => "apps/web/src/" + m[1]);
const sources = new Set([
  parent,
  detailFile,
  style,
  passwordStyle,
  reasonStyle,
  "scripts/lib/ui-phase2-user-reason-cases.mjs",
  "scripts/lib/ui-phase2-user-password-preview.mjs",
  "apps/api/src/platform-account-service.ts",
  "apps/api/src/mysql-platform-account-repository.ts",
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/lib/ui-phase2-user-page-preview.mjs",
  "scripts/verify-ui-phase2-user-reasons-preview.mjs",
]);
const entry = "/__p43_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(passwordStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(reasonStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p43-page-preview','p43-password-review','p43-reasons-review');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/users',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P43 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',initialTab:'users',routePath:'/platform-admin/users'})])}).use(router);await router.isReady();app.mount('#app');`;
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
      name: "p43-review",
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
          if (req.url?.split("?")[0] !== "/platform-admin/users") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P43 用户管理审核</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
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
  console.log("p43_reasons_host", origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.clock.install({ time: new Date("2026-09-11T02:00:00Z") });
      const errors = [],
        unexpected = [];
      let scenario,
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push(url.origin);
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const detailPath = "/api/v1/platform/accounts/users/" + fixture.detail.user.id;
        if (
          req.method() !== "GET" ||
          !["/api/v1/platform/accounts", detailPath].includes(url.pathname)
        ) {
          unexpected.push(req.method() + " " + url.pathname);
          return route.abort();
        }
        requests.push({
          method: "GET",
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
        });
        const value = structuredClone(
          url.pathname === detailPath ? fixture.detail : fixture.overview,
        );
        if (url.pathname === detailPath) {
          value.user.status = scenario.status;
          if (scenario.status === "disabled") value.sessions = [];
        } else {
          value.users[0].status = scenario.status;
          value.users[0].platform_roles = scenario.role ? [scenario.role] : [];
          if (scenario.status === "disabled") value.users[0].active_session_count = 0;
        }
        return route.fulfill({
          json: { data: value, request_id: "p43-reason-fixture", trace_id: "p43-reason-fixture" },
        });
      });
      for (const item of userReasonCases) {
        scenario = item;
        requests = [];
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, width + ":" + item.id + ":" + name);
          checks.push({ width, caseId: item.id, name, actual });
        };
        await page.goto(origin + "/platform-admin/users?keep=reasons");
        const row = (
          width <= 760
            ? page.locator(".responsive-data-view__mobile article")
            : page.locator(".account-table-wrap tbody tr")
        ).first();
        await row.waitFor();
        if (width <= 760) {
          await row.getByRole("button").click();
          await page
            .locator(".responsive-data-view__drawer")
            .getByRole("button", { name: "打开账号详情", exact: true })
            .click();
        } else await row.getByRole("button", { name: "账号详情", exact: true }).click();
        const detail = page.locator("dialog.p43-user-detail");
        await detail.locator(".detail-grid").waitFor();
        const scope =
          item.scope === "footer"
            ? detail.locator("footer")
            : item.scope === "role"
              ? detail.locator(".role-actions")
              : detail.locator(".p43-sessions");
        const trigger = scope.getByRole("button", { name: item.trigger, exact: true });
        check("trigger enabled", await trigger.isEnabled());
        if (item.status === "disabled")
          check(
            "disabled user role controls stay disabled",
            await detail.locator(".role-actions button:disabled").count(),
            3,
          );
        await trigger.click();
        const dialog = page.locator("dialog.p43-reason-sheet"),
          field = dialog.getByLabel("操作原因", { exact: true });
        const cancel = dialog.getByRole("button", { name: "取消", exact: true }),
          confirm = dialog.getByRole("button", { name: "确认执行", exact: true });
        await dialog.waitFor();
        check("exact reason title", await dialog.locator("h3").innerText(), item.title);
        check("exact accessible name", await dialog.getAttribute("aria-label"), item.title);
        check("initial textarea focus", await field.evaluate((n) => n === document.activeElement));
        check("original reason default", await field.inputValue(), "平台管理员人工操作");
        check(
          "original constraints",
          await field.evaluate((n) => ({
            required: n.required,
            min: n.minLength,
            max: n.maxLength,
          })),
          { required: true, min: 2, max: 300 },
        );
        check(
          "control metrics",
          await dialog.locator("textarea,button").evaluateAll((ns) =>
            ns.every((n) => {
              const r = n.getBoundingClientRect();
              return (
                r.width >= 44 && r.height >= 44 && parseFloat(getComputedStyle(n).fontSize) >= 16
              );
            }),
          ),
        );
        const shot = async (state) => {
          if (!/(hover|pressed)/.test(state)) await page.mouse.move(0, 0);
          if (!/(focus|hover|pressed)/.test(state))
            await page.evaluate(() => {
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            });
          check(state + ":native modal", await dialog.evaluate((n) => n.matches(":modal")));
          check(
            state + ":no horizontal overflow",
            await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
          );
          if (capture) {
            const file = width + "-" + item.id + "-" + state + ".png",
              bytes = await dialog.screenshot({ animations: "disabled" });
            await writeFile(output + "/" + file, bytes);
            screenshots.push({
              file,
              width,
              caseId: item.id,
              title: item.title,
              state,
              sha256: hash(bytes),
              viewport: page.viewportSize(),
            });
          }
        };
        await shot("default");
        check(
          "confirmation direction color",
          await confirm.evaluate((n) => getComputedStyle(n).backgroundColor),
          item.color === "blue" ? "rgb(37, 74, 156)" : "rgb(163, 41, 52)",
        );
        await field.focus();
        await shot("field-focus");
        await field.fill("已核对当前账号状态及本次操作范围，记录人工处理原因。");
        await cancel.focus();
        await shot("cancel-focus");
        await page.keyboard.press("Tab");
        check(
          "confirm follows cancel",
          await confirm.evaluate((n) => n === document.activeElement),
        );
        await shot("confirm-focus");
        await confirm.hover();
        await shot("confirm-hover");
        await page.mouse.down();
        check("native pressed", await confirm.evaluate((n) => n.matches(":active")));
        await shot("confirm-pressed");
        // Release outside the button: record native pressed visual without submitting a write.
        await page.mouse.move(0, 0);
        await page.mouse.up();
        check("pressed cancellation keeps dialog open", await dialog.isVisible());
        await field.fill("核对账号与操作范围后记录的人工处理原因。".repeat(12));
        await shot("long-reason");
        await cancel.click();
        await dialog.waitFor({ state: "hidden" });
        check(
          "cancel returns exact invoking control",
          await trigger.evaluate((n) => n === document.activeElement),
        );
        await trigger.click();
        await dialog.waitFor();
        check("reopen restores original default", await field.inputValue(), "平台管理员人工操作");
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        check(
          "Escape returns exact invoking control",
          await trigger.evaluate((n) => n === document.activeElement),
        );
        check(
          "only two fixture GETs",
          requests.map((r) => r.method),
          ["GET", "GET"],
        );
        check("no unexpected network", unexpected, []);
        check("no browser errors", errors, []);
        observations.push({
          width,
          caseId: item.id,
          fixture: {
            status: item.status,
            selectedPlatformRoles: item.role ? [item.role] : [],
            emptySessions: item.status === "disabled",
          },
          requests: [...requests],
          errors: [...errors],
          unexpected: [...unexpected],
        });
        console.log("passed", width, item.id);
      }
    } finally {
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
    await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
  );
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P43-REASONS-VUE-r1",
          approval: "pending-user-review",
          scope:
            "Ten actual non-password reason variants via original parent/detail/native shared dialog. Review-only template/CSS; explicit disabled/no-sessions and selected-role fixture clones. All traffic GET-only intercepted, final writes never submitted. Not authorization, self-protection, SQL/audit or write lifecycle/production acceptance. Color distinguishes direction, not safety.",
          sourceHashes,
          transformedHashes: Object.fromEntries(
            Object.entries(transformed).map(([f, v]) => [f, hash(v)]),
          ),
          cases: userReasonCases,
          checks,
          screenshots,
          observations,
          processesClosed: true,
        },
        null,
        2,
      ) + "\n",
    );
    const intro =
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P43 原因窗审核</title><style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;margin:24px;background:#edf1f6;color:#202c3d}article{padding:20px;background:white;margin:24px 0}img{max-width:100%}nav{display:flex;gap:12px;flex-wrap:wrap}</style><h1>P43 十类原因窗 · 待审核</h1><p>实际Vue，测试样例，所有确认未提交。蓝色表示授予/恢复方向，不表示权限操作低风险。</p>';
    await writeFile(
      output + "/index.html",
      intro +
        "<nav>" +
        userReasonCases
          .map((c) => '<a href="#390-' + c.id + '-default">' + c.title + "</a>")
          .join("") +
        "</nav>" +
        screenshots
          .map(
            (s) =>
              '<article id="' +
              s.width +
              "-" +
              s.caseId +
              "-" +
              s.state +
              '"><h2>' +
              s.width +
              "px · " +
              s.title +
              " · " +
              s.state +
              '</h2><img loading="lazy" src="' +
              s.file +
              '" alt="' +
              s.title +
              " " +
              s.state +
              '"></article>',
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({ checks: checks.length, images: screenshots.length, sources: sources.size }),
  );
} finally {
  await browser?.close();
  await server.close();
}
