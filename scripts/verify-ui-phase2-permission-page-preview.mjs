import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { permissionPagePreview } from "./lib/ui-phase2-permission-page-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p45-permission-page-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");

const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const child = "apps/web/src/components/PlatformRoleComparison.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/permission-page-preview.css";
const originals = { [child]: await read(child) };
const transformed = { [child]: permissionPagePreview(originals[child]) };
const fixtureFile = "tests/e2e/m06-01-platform-accounts.spec.ts";
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations])
  .filter((n) => n.name.getText(ast) === "platformRoles");
assert.equal(declarations.length, 1);
const roles = JSON.parse(
  JSON.stringify(vm.runInNewContext("(" + declarations[0].initializer.getText(ast) + ")")),
);
assert.equal(roles.length, 3);
assert.equal(new Set(roles.flatMap((r) => r.capabilities)).size, 7);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => "apps/web/src/" + m[1]);
const sources = new Set([
  parent,
  child,
  style,
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "apps/web/src/navigation-shell-route-state.ts",
  "scripts/lib/ui-phase2-permission-page-preview.mjs",
  "scripts/verify-ui-phase2-permission-page-preview.mjs",
]);
const entry = "/__p45_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p45-page-review');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/permissions',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P45 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',initialTab:'admins',routePath:'/platform-admin/permissions'})])}).use(router);await router.isReady();app.mount('#app');`;
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
      name: "p45-review",
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
          if (req.url?.split("?")[0] !== "/platform-admin/permissions") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P45 平台角色权限比较审核</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
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
  console.log("p45_permission_host " + origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
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
    let variant = "normal",
      status = 200,
      gate,
      release;
    const hold = () => {
      gate = new Promise((r) => (release = r));
    };
    const unhold = () => {
      release?.();
      gate = undefined;
    };
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, width + ":" + name);
      checks.push({ width, name, actual });
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
        if (req.method() !== "GET" || url.pathname !== "/api/v1/platform/roles") {
          unexpected.push(req.method() + " " + url.pathname);
          return route.abort();
        }
        const responseStatus = status;
        let data = structuredClone(roles);
        if (variant === "empty") data = [];
        if (variant === "single") data = [data[2]];
        if (variant === "long")
          data = data.map((r) => ({
            ...r,
            name: r.name.repeat(4),
            description: r.description.repeat(8),
          }));
        requests.push({ method: "GET", path: url.pathname, status: responseStatus, variant });
        if (gate) await gate;
        return route.fulfill(
          responseStatus === 200
            ? { json: { data, request_id: "p45-review", trace_id: "p45-review" } }
            : {
                status: responseStatus,
                json: {
                  error: {
                    code: "p45_read_error",
                    message: "测试读取失败",
                    action_hint: "当前目录暂时无法读取，请稍后重试。",
                  },
                  request_id: "p45-error",
                  trace_id: "p45-error",
                },
              },
        );
      });
      const comp = page.locator(".role-comparison"),
        matrix = comp.locator(".role-comparison__matrix article");
      const left = comp.getByRole("combobox", { name: "左侧角色", exact: true });
      const right = comp.getByRole("combobox", { name: "右侧角色", exact: true });
      const diff = comp.getByRole("checkbox", { name: "只看差异", exact: true });
      const query = comp.getByRole("textbox", { name: "搜索权限", exact: true });
      const group = comp.getByRole("combobox", { name: "能力分组", exact: true });
      const reset = comp.getByRole("button", { name: "重置", exact: true });
      const refresh = page.locator(".account-hero button");
      const settled = () =>
        page.waitForFunction(
          () =>
            !document.querySelector(".account-hero button")?.disabled &&
            !!document.querySelector(".role-comparison,.account-empty,.account-state"),
        );
      const urlIs = async (values) => {
        await page.waitForFunction((values) => {
          const actual = Object.fromEntries(new URL(location.href).searchParams);
          return (
            JSON.stringify(Object.entries(actual).sort()) ===
            JSON.stringify(Object.entries(values).sort())
          );
        }, values);
        await settled();
      };
      const shot = async (state, focus) => {
        if (focus) await page.locator(focus).scrollIntoViewIfNeeded();
        else await page.evaluate(() => scrollTo(0, 0));
        await page.evaluate(() => document.fonts.ready);
        check(
          state + ":no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        check(
          state + ":no business dialogs",
          await page.locator('dialog[open],[role="dialog"]:visible').count(),
          0,
        );
        if (capture) {
          const file = width + "-" + state + ".png",
            bytes = await page.screenshot({ fullPage: !focus, animations: "disabled" });
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            file,
            width,
            state,
            sha256: hash(bytes),
            viewport: page.viewportSize(),
            imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          });
        }
      };
      const rows = async (count, name) => {
        await page.waitForFunction(
          (count) => document.querySelectorAll(".role-comparison__matrix article").length === count,
          count,
        );
        check(name, await matrix.count(), count);
      };
      hold();
      await page.goto(origin + "/platform-admin/permissions?keep=p45");
      await page.getByText("正在读取真实平台角色目录…", { exact: true }).waitFor();
      await shot("loading");
      unhold();
      await comp.waitFor();
      await settled();
      check(
        "only real role directory metrics",
        await page.locator(".permission-metrics strong").allTextContents(),
        ["3", "7", "MySQL"],
      );
      check(
        "administrator link target",
        await page.getByRole("link", { name: "管理管理员", exact: true }).getAttribute("href"),
        "/platform-admin/admins",
      );
      await rows(6, "selected union six not global seven");
      check("default reset disabled", await reset.isDisabled());
      check(
        "context blue",
        await page
          .locator(".p45-role-context")
          .evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(41, 76, 175)",
      );
      await shot("default");
      await shot("default-top", ".account-hero");
      await diff.focus();
      await page.keyboard.press("Tab");
      await page.waitForFunction(() => {
        const n = document.querySelector(".role-comparison__selectors select");
        return (
          n === document.activeElement &&
          n.matches(":focus-visible") &&
          getComputedStyle(n).outlineColor === "rgb(255, 255, 255)" &&
          getComputedStyle(n).outlineWidth === "3px"
        );
      });
      check(
        "Tab reaches left role",
        await left.evaluate((n) => n === document.activeElement && n.matches(":focus-visible")),
      );
      check(
        "role focus white",
        await left.evaluate((n) => getComputedStyle(n).outlineColor),
        "rgb(255, 255, 255)",
      );
      await shot("role-focus", ".p45-role-context");
      await right.selectOption("platform_operations_admin");
      await urlIs({ keep: "p45", right_role: "platform_operations_admin" });
      await rows(0, "same role no differences");
      check("role-only reset still disabled", await reset.isDisabled());
      await shot("same-none", ".p45-reading");
      await diff.uncheck();
      await urlIs({ keep: "p45", right_role: "platform_operations_admin", show_all: "1" });
      await rows(3, "same role show all three");
      await shot("same-all", ".p45-reading");
      await left.selectOption("platform_super_admin");
      await urlIs({
        keep: "p45",
        right_role: "platform_operations_admin",
        left_role: "platform_super_admin",
        show_all: "1",
      });
      await rows(7, "super and operations union seven");
      await shot("super-all", ".p45-reading");
      await diff.check();
      await urlIs({
        keep: "p45",
        right_role: "platform_operations_admin",
        left_role: "platform_super_admin",
      });
      await rows(4, "super and operations four differences");
      await shot("super-differences", ".p45-reading");
      await query.fill("平台");
      await reset.click();
      await urlIs({ keep: "p45" });
      await rows(6, "reset restores defaults");
      await query.fill("  PLATFORM:  ");
      await urlIs({ keep: "p45", capability_query: "PLATFORM:" });
      await rows(2, "case-insensitive code query");
      await shot("code-search", ".p45-reading");
      await query.fill("");
      await group.selectOption("安全治理");
      await urlIs({ keep: "p45", capability_group: "安全治理" });
      await rows(2, "security group two");
      await shot("group", ".p45-reading");
      await query.fill("不存在的能力");
      await urlIs({ keep: "p45", capability_query: "不存在的能力", capability_group: "安全治理" });
      await rows(0, "combined no result");
      await shot("search-empty", ".p45-reading");
      await reset.click();
      await urlIs({ keep: "p45" });
      await left.selectOption("platform_security_admin");
      await right.selectOption("platform_super_admin");
      await diff.uncheck();
      await query.fill("会话");
      await group.selectOption("安全治理");
      const allKeys = {
        keep: "p45",
        left_role: "platform_security_admin",
        right_role: "platform_super_admin",
        show_all: "1",
        capability_query: "会话",
        capability_group: "安全治理",
      };
      await urlIs(allKeys);
      await rows(1, "five URL controls combined result");
      const savedUrl = page.url();
      await page.reload();
      await comp.waitFor();
      await urlIs(allKeys);
      check("reload keeps exact URL", page.url(), savedUrl);
      check(
        "reload restores all five controls",
        [
          await left.inputValue(),
          await right.inputValue(),
          await diff.isChecked(),
          await query.inputValue(),
          await group.inputValue(),
        ],
        ["platform_security_admin", "platform_super_admin", false, "会话", "安全治理"],
      );
      await rows(1, "reload combined result");
      await shot("url-restored");
      await reset.click();
      await urlIs({ keep: "p45" });
      await rows(6, "reset removes only owned URL keys");
      const previousTime = await page.locator(".account-updated").innerText();
      hold();
      await refresh.click();
      await page.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
      check("refresh busy disables native button", await refresh.isDisabled());
      await shot("refresh-pending");
      unhold();
      await settled();
      for (const code of [500, 403, 401]) {
        status = code;
        await refresh.click();
        await settled();
        await rows(6, "retained matrix after " + code);
        check(
          "retained timestamp after " + code,
          await page.locator(".account-updated").innerText(),
          previousTime,
        );
        check(
          "stale notice after " + code,
          (await page.locator(".account-message").innerText()).includes(
            "已保留上次成功读取的权限矩阵",
          ),
        );
        await shot("refresh-error-" + code);
      }
      status = 500;
      await page.goto(origin + "/platform-admin/permissions?keep=p45");
      await settled();
      await page.getByText("暂时无法读取角色目录", { exact: true }).waitFor();
      check("initial error has no comparison", await comp.count(), 0);
      await shot("initial-error");
      status = 200;
      await page.getByRole("button", { name: "重新加载", exact: true }).click();
      await comp.waitFor();
      await settled();
      await rows(6, "initial retry recovers");
      await shot("retry-success");
      variant = "empty";
      await refresh.click();
      await settled();
      await page.getByText("角色目录为空", { exact: true }).waitFor();
      check("empty directory hides metrics", await page.locator(".permission-metrics").count(), 0);
      await shot("empty");
      variant = "single";
      await page.getByRole("button", { name: "重新检查", exact: true }).click();
      await comp.waitFor();
      await settled();
      check(
        "single role initial fallback",
        [await left.inputValue(), await right.inputValue()],
        ["platform_super_admin", "platform_super_admin"],
      );
      await shot("single-role");
      await query.fill("平台");
      await page.waitForFunction(
        () => new URL(location.href).searchParams.get("capability_query") === "平台",
      );
      await settled();
      hold();
      await reset.click();
      await page.waitForFunction(() => document.querySelector(".account-hero button")?.disabled);
      check(
        "single reset pending missing role options",
        [await left.inputValue(), await right.inputValue()],
        ["", ""],
      );
      await shot("single-reset-pending");
      unhold();
      await settled();
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".role-comparison__selectors select")].every(
          (n) => n.value === "platform_super_admin",
        ),
      );
      check(
        "single reset recovers after actual reread",
        [await left.inputValue(), await right.inputValue()],
        ["platform_super_admin", "platform_super_admin"],
      );
      await shot("single-reset-recovered");
      variant = "long";
      await page.goto(origin + "/platform-admin/permissions?keep=p45");
      await comp.waitFor();
      await settled();
      await shot("long-content");
      check(
        "all requests roles GET only",
        requests.every((r) => r.method === "GET" && r.path === "/api/v1/platform/roles"),
      );
      check("no external requests", unexpected, []);
      check("no browser errors", errors, []);
      observations.push({ width, requests, unexpected, errors });
      console.log("passed " + width);
    } finally {
      unhold();
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
    await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
  );
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P45-PERMISSION-PAGE-VUE-PREVIEW-r1",
          approval: "pending-user-review",
          scope:
            "Current P45 parent and comparison Vue scripts unchanged; review-only section composition/CSS. Original roles fixture and explicit empty/single/long variants. URL-bound filters may trigger original parent rereads. GET roles only, no accounts or writes, no real RBAC/DB/MFA. Auth-error retention and single-role reset pending/recovery observed without policy change. No full App/navigation/back-forward/KeepAlive or whole-page approval; prior P44 approvals do not apply.",
          sourceHashes,
          transformedHashes: Object.fromEntries(
            Object.entries(transformed).map(([f, s]) => [f, hash(s)]),
          ),
          checks,
          screenshots,
          observations,
          processesClosed: true,
        },
        null,
        2,
      ) + "\n",
    );
    const gallery =
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P45 平台权限实际Vue审核</title><style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#eef2f7;color:#142a46;margin:24px}article{margin:24px 0;padding:20px;background:white}img{max-width:100%;height:auto}nav{display:flex;gap:12px;flex-wrap:wrap}</style><h1>P45 平台角色权限比较 · C审核</h1><p>测试数据，未上线，待用户审核。仅页面主体与样例读取/筛选，不代表真实授权或整页通过。</p><nav>' +
      [390, 760, 761, 1440].map((w) => '<a href="#' + w + '-default">' + w + "px</a>").join("") +
      "</nav>" +
      screenshots
        .map(
          (s) =>
            '<article id="' +
            s.width +
            "-" +
            s.state +
            '"><h2>' +
            s.width +
            "px · " +
            s.state +
            '</h2><a href="' +
            s.file +
            '"><img loading="lazy" src="' +
            s.file +
            '" alt="P45 ' +
            s.state +
            '"></a></article>',
        )
        .join("\n");
    await writeFile(output + "/index.html", gallery);
  }
  console.log(
    JSON.stringify({ checks: checks.length, images: screenshots.length, sources: sources.size }),
  );
} finally {
  await browser?.close();
  await server.close();
}
