import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p36-reason-vue-preview";
const css = "design-plans/ui-phase-2-2026-09-07/implementation/token-reason-preview.css";
const fixtureFile = "tests/e2e/m06-01-organization-admin.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((node) => node.declarationList.declarations)
  .filter((node) => node.name.getText(ast) === "organizationTokens");
assert.equal(declarations.length, 1);
const tokens = JSON.parse(
  JSON.stringify(vm.runInNewContext(declarations[0].initializer.getText(ast))),
);
const fixedTime = "2026-08-26T10:00:00.000Z";
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((match) => "apps/web/src/" + match[1]);
const entry = "/__p36_reason_preview.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Parent from '/src/components/OrganizationAdminCenter.vue';
${cssFiles.map((file) => `import '/src/${file.slice("apps/web/src/".length)}';`).join("\n")}
import '/src/organization-admin.css';import '/@fs/${path.resolve(css).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p36-reason-preview');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const app=createApp({render:()=>h(Parent,{apiBaseUrl:location.origin+'/api/v1',routePath:'/org-admin/tokens',organizationId:'00000000-0000-4000-8000-000000000601'})}).use(router);await router.isReady();app.mount('#host');`;
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p36-reason-review-only",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          const pathname = req.url?.split("?")[0];
          if (pathname?.startsWith("/api/")) {
            res.statusCode = 418;
            return res.end("unmocked API forbidden");
          }
          if (pathname !== "/org-admin/tokens") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 原因窗审核</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  runs = [];
const sourceFiles = new Set([
  css,
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/src/organization-admin.css",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-token-reason-preview.mjs",
]);
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  console.log(`p36_reason_host ${origin}`);
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
        requests = [],
        errors = [],
        forbidden = [];
      let rows = tokens;
      await page.clock.install({ time: new Date(fixedTime) });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: () => {
              throw Error("clipboard outside reason scope");
            },
          },
        });
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          forbidden.push(req.url());
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        requests.push({ method: req.method(), path: url.pathname });
        if (
          req.method() !== "GET" ||
          !["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(url.pathname)
        ) {
          forbidden.push(`${req.method()} ${url.pathname}`);
          return route.abort();
        }
        return route.fulfill({
          json: {
            data: url.pathname.endsWith("/tokens") ? rows : { observed_at: fixedTime },
            request_id: "p36-reason-fixture",
            trace_id: "p36-reason-fixture",
          },
        });
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const dialog = page.getByRole("dialog"),
        input = dialog.locator("textarea"),
        confirm = dialog.locator('button[type="submit"]'),
        cancel = dialog.getByRole("button", { name: "取消", exact: true }),
        close = dialog.getByRole("button", { name: "关闭原因填写", exact: true });
      const focused = (locator) => locator.evaluate((node) => node === document.activeElement);
      const shot = async (name) => {
        check(
          name + ":contained horizontally",
          await dialog.evaluate((node) => {
            const b = node.getBoundingClientRect();
            return b.left >= 0 && b.right <= innerWidth && node.scrollWidth <= node.clientWidth + 1;
          }),
        );
        check(
          name + ":unobscured",
          await dialog.evaluate((node) => {
            const b = node.getBoundingClientRect();
            return [0.15, 0.5, 0.85].every((r) =>
              node.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height * r)),
            );
          }),
        );
        if (!capture) return;
        const bytes = await dialog.screenshot({ animations: "disabled" }),
          file = `${width}-${name}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({ file, width, state: name, sha256: hash(bytes) });
      };
      await page.goto(origin + "/org-admin/tokens");
      const card = page.locator('.org-token-list article[data-status="active"]').first();
      await card.waitFor();
      for (const [action, label] of [
        ["rotate", "轮换密钥"],
        ["revoke", "撤销访问"],
      ]) {
        const trigger = card.getByRole("button", { name: label, exact: true });
        const name = await card.locator("h5").textContent();
        const open = async () => {
          await trigger.click();
          await dialog.waitFor();
          await input.focus();
        };
        const cancelCheck = async (method) => {
          if (method === "escape") await page.keyboard.press("Escape");
          else await (method === "header" ? close : cancel).click();
          await dialog.waitFor({ state: "hidden" });
          check(`${action}:${method} restores trigger`, await focused(trigger));
        };
        await trigger.click();
        await dialog.waitFor();
        check(
          action + ":actual target",
          await dialog.getAttribute("aria-label"),
          action === "rotate" ? `轮换“${name}”密钥` : `撤销“${name}”访问`,
        );
        check(action + ":autofocus", await focused(input));
        check(action + ":initial empty", await input.inputValue(), "");
        check(action + ":initial disabled", await confirm.isDisabled());
        check(
          action + ":disabled gray",
          await confirm.evaluate((node) => getComputedStyle(node).backgroundColor),
          "rgb(232, 237, 243)",
        );
        check(action + ":minimum two", await input.getAttribute("minlength"), "2");
        check(action + ":no maximum", await input.getAttribute("maxlength"), null);
        await shot(action + "-default");
        for (const value of ["字", "   ", " 字 "]) {
          await input.fill(value);
          check(action + ":trimmed invalid " + JSON.stringify(value), await confirm.isDisabled());
        }
        await shot(action + "-invalid");
        await input.fill("  定期安全维护  ");
        check(action + ":valid enabled", await confirm.isEnabled());
        await page.evaluate(
          () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
        );
        check(
          action + ":action color",
          await confirm.evaluate((node) => getComputedStyle(node).backgroundColor),
          action === "rotate" ? "rgb(32, 89, 212)" : "rgb(181, 44, 58)",
        );
        check(
          action + ":44px controls",
          await dialog.locator("button").evaluateAll((nodes) =>
            nodes.every((node) => {
              const b = node.getBoundingClientRect();
              return b.width >= 44 && b.height >= 44;
            }),
          ),
        );
        await confirm.focus();
        await page.keyboard.press("Tab");
        check(action + ":forward trap", await focused(close));
        await page.keyboard.press("Shift+Tab");
        check(action + ":reverse trap", await focused(confirm));
        for (const [target, control] of [
          ["confirm", confirm],
          ["cancel", cancel],
          ["close", close],
        ]) {
          await control.focus();
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          check(
            `${action}:${target} keyboard outline`,
            await control.evaluate(
              (node) =>
                node === document.activeElement && getComputedStyle(node).outlineStyle === "solid",
            ),
          );
          check(
            `${action}:${target} focus color`,
            await control.evaluate((node) => getComputedStyle(node).outlineColor),
            target === "close" ? "rgb(255, 255, 255)" : "rgb(37, 99, 235)",
          );
          await shot(`${action}-${target}-focus`);
        }
        await confirm.evaluate((node) => node.blur());
        await confirm.hover();
        await shot(action + "-confirm-hover");
        await page.mouse.down();
        check(action + ":pressed", await confirm.evaluate((node) => node.matches(":active")));
        await shot(action + "-confirm-pressed");
        await page.mouse.move(0, 0);
        await page.mouse.up();
        await input.fill("原".repeat(501));
        check(
          action + ":501 retained without inferred server policy",
          (await input.inputValue()).length,
          501,
        );
        await shot(action + "-long-reason");
        await cancelCheck("escape");
        await open();
        check(action + ":reopen resets", await input.inputValue(), "");
        await cancelCheck("header");
        await open();
        await cancelCheck("footer");
      }
      rows = [{ ...tokens[0], name: "审核长目标_".repeat(18) }];
      await page.locator(".org-admin-refresh button").click();
      await page.waitForFunction(
        () => document.querySelector(".org-admin-center")?.getAttribute("aria-busy") === "false",
      );
      await page.setViewportSize({ width, height: 520 });
      for (const [action, label] of [
        ["rotate", "轮换密钥"],
        ["revoke", "撤销访问"],
      ]) {
        await card.getByRole("button", { name: label, exact: true }).click();
        await dialog.waitFor();
        await input.fill("短屏测试");
        await confirm.focus();
        await dialog.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        check(
          action + ":short footer reachable",
          await confirm.evaluate((node) => {
            const b = node.getBoundingClientRect();
            const d = node.closest("dialog").getBoundingClientRect();
            return b.top >= d.top && b.bottom <= d.bottom && b.bottom <= innerHeight;
          }),
        );
        await shot(action + "-short-long-target-footer");
        await close.focus();
        await dialog.evaluate((node) => {
          node.scrollTop = 0;
        });
        check(
          action + ":short header reachable",
          await close.evaluate((node) => {
            const b = node.getBoundingClientRect();
            return b.top >= 0 && b.bottom <= innerHeight;
          }),
        );
        await shot(action + "-short-long-target-header");
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
      }
      check("zero external or write requests", forbidden, []);
      check("zero browser errors", errors, []);
      check("exact four GET", requests.length, 4);
      check(
        "zero storage",
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      runs.push({ width, requests });
      console.log(`passed ${width}`);
    } finally {
      await context.close();
    }
  }
  for (const file of server.moduleGraph.fileToModulesMap.keys()) {
    const relative = path.relative(process.cwd(), file).replaceAll("\\", "/");
    if (
      /^(apps\/web\/src\/|packages\/)/.test(relative) &&
      !relative.includes("?") &&
      !relative.includes("node_modules")
    )
      sourceFiles.add(relative);
  }
} finally {
  await browser?.close();
  await server.close();
}
const sourceHashes = Object.fromEntries(
  await Promise.all([...sourceFiles].sort().map(async (file) => [file, hash(await read(file))])),
);
const evidence = {
  kind: "P36-REASON-VUE-PREVIEW-r1",
  approval: "pending-user-review",
  scope:
    "Actual unmodified parent, child, reason dialog and hooks; CSS-only review host. GET fixtures only, no submission, real permissions, SQL, audit write, OS clipboard, full App or production approval. Synthetic long target and 501-character input do not define backend length policy. Original immediate-close-on-submit behavior unchanged and not exercised here.",
  fixedTime,
  checks,
  runs,
  screenshots,
  sourceHashes,
  processesClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P36 原因窗审核</title><style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#203047;margin:24px}article{background:white;padding:20px;margin:24px 0}img{max-width:100%}</style><h1>P36 轮换与撤销原因窗 · 实际 Vue</h1><p>原组件与约束不改，仅宿主 CSS。全部使用测试数据，不提交、不表示业务或生产验收。短屏图分别展示可滚动到的头部与底部，并非同时可见。</p>${screenshots.map((shot) => `<article><h2>${shot.file}</h2><img src="${shot.file}" alt="${shot.state}" loading="lazy"></article>`).join("\n")}</html>`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    images: screenshots.length,
    sources: sourceFiles.size,
    processesClosed: true,
  }),
);
