import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { tokenPagePreview } from "./lib/ui-phase2-token-page-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p36-page-vue-preview";
const component = "apps/web/src/components/OrganizationTokenPanel.vue";
const fixtureFile = "tests/e2e/m06-01-organization-admin.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const original = await read(component),
  transformed = tokenPagePreview(original);
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
const reviewCss = ["create", "secret", "list", "reason", "page"].map(
  (name) => `design-plans/ui-phase-2-2026-09-07/implementation/token-${name}-preview.css`,
);
const entry = "/__p36_page_preview.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Parent from '/src/components/OrganizationAdminCenter.vue';
${cssFiles.map((file) => `import '/src/${file.slice("apps/web/src/".length)}';`).join("\n")}
${reviewCss.map((file) => `import '/@fs/${path.resolve(file).replaceAll("\\", "/")}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p36-page-preview','p36-create-preview','p36-list-preview','p36-reason-preview');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const app=createApp({render:()=>h(Parent,{apiBaseUrl:location.origin+'/api/v1',routePath:'/org-admin/tokens',organizationId:'00000000-0000-4000-8000-000000000601'})}).use(router);await router.isReady();app.mount('#host');`;
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p36-whole-page-review",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(source, id) {
        if (id.replaceAll("\\", "/") === path.resolve(component).replaceAll("\\", "/")) {
          assert.equal(source.replaceAll("\r\n", "\n"), original);
          return transformed;
        }
      },
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
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 整页C审核稿</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  runs = [],
  screenshots = [];
const sourceFiles = new Set([
  component,
  fixtureFile,
  ...cssFiles,
  ...reviewCss,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-token-page-preview.mjs",
  ...["create", "secret", "list", "page"].map(
    (name) => `scripts/lib/ui-phase2-token-${name}-preview.mjs`,
  ),
]);
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p36_page_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    let release = () => {};
    try {
      const page = await context.newPage(),
        requests = [],
        errors = [],
        forbidden = [];
      let rows = tokens,
        hold = true,
        readStatus = 200;
      const gate = new Promise((done) => {
        release = done;
      });
      await page.clock.install({ time: new Date(fixedTime) });
      await context.addInitScript(() =>
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: () => {
              throw Error("clipboard not tested here");
            },
          },
        }),
      );
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          forbidden.push(req.url());
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        requests.push({
          method: req.method(),
          path: url.pathname,
          body: req.postDataJSON(),
          idempotency: Boolean(req.headers()["idempotency-key"]),
        });
        if (
          req.method() === "GET" &&
          ["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(url.pathname)
        ) {
          if (hold) await gate;
          if (readStatus !== 200 && url.pathname.endsWith("/tokens"))
            return route.fulfill({
              status: readStatus,
              json: {
                error: {
                  code: "fixture_read_failed",
                  message: "隔离测试：组织令牌暂时读取失败。",
                  action_hint: "稍后重新加载。",
                },
                request_id: "p36-page-failure",
                trace_id: "p36-page-failure",
              },
            });
          return route.fulfill({
            json: {
              data: url.pathname.endsWith("/tokens") ? rows : { observed_at: fixedTime },
              request_id: "p36-page-read",
              trace_id: "p36-page-read",
            },
          });
        }
        if (req.method() === "POST" && url.pathname === "/api/v1/org/admin/tokens") {
          const record = {
            ...tokens[0],
            id: "00000000-0000-4000-8000-000000000999",
            name: "整页审核接入",
            version: 1,
            created_at: fixedTime,
            updated_at: fixedTime,
            scopes: ["task:read"],
          };
          rows = [...tokens, record];
          return route.fulfill({
            json: {
              data: { ...record, secret: "synthetic-p36-page-only" },
              request_id: "p36-page-write",
              trace_id: "p36-page-write",
            },
          });
        }
        forbidden.push(`${req.method()} ${url.pathname}`);
        return route.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}:${name}`);
        checks.push({ width, name });
      };
      const shot = async (name, fullPage = true) => {
        check(
          name + ":no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (fullPage) await page.evaluate(() => scrollTo(0, 0));
        await page.mouse.move(0, 0);
        if (!capture) return;
        const bytes = await page.screenshot({ fullPage, animations: "disabled" }),
          file = `${width}-${name}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({ file, width, state: name, fullPage, sha256: hash(bytes) });
      };
      await page.goto(origin + "/org-admin/tokens");
      await page.locator(".org-admin-state").waitFor();
      check(
        "initial loading refresh disabled",
        await page.locator(".org-admin-refresh button").isDisabled(),
      );
      await shot("loading");
      hold = false;
      release();
      const panel = page.locator(".org-token-panel"),
        form = page.locator(".p36-create-c"),
        results = page.locator(".p36-results-c"),
        filter = page.locator(".org-token-filters-c");
      await panel.waitFor();
      check(
        "original eight total",
        (await page.locator(".org-token-metrics b").allTextContents())[0],
        "8",
      );
      check(
        "management DOM precedes creation",
        await page
          .locator(".org-token-workbench")
          .evaluate((node) => [...node.children].map((child) => child.tagName)),
        ["SECTION", "DIV", "FORM"],
      );
      check(
        "blue overview",
        await page
          .locator(".org-token-overview")
          .evaluate((node) => getComputedStyle(node).backgroundColor),
        "rgb(37, 74, 156)",
      );
      check(
        "old grid removed",
        await page.locator("body").evaluate((node) => getComputedStyle(node).backgroundImage),
        "none",
      );
      check(
        "creation remains nonsticky",
        await form.evaluate((node) => getComputedStyle(node).position),
        "static",
      );
      check(
        "original blank creation",
        await form.locator('input[maxlength="120"]').inputValue(),
        "",
      );
      for (const selector of [
        ".org-admin-hero",
        ".org-token-overview",
        ".org-token-metrics",
        ".org-token-truth",
        ".org-token-filters-c",
        ".p36-results-c",
        ".p36-create-c",
      ]) {
        const target = page.locator(selector);
        await target.scrollIntoViewIfNeeded();
        check(
          selector + ":unobscured",
          await target.evaluate((node) => {
            const b = node.getBoundingClientRect(),
              top = Math.max(0, b.top),
              bottom = Math.min(innerHeight, b.bottom);
            return (
              bottom > top &&
              [0.15, 0.5, 0.85].every((r) =>
                node.contains(
                  document.elementFromPoint(b.left + b.width / 2, top + (bottom - top) * r),
                ),
              )
            );
          }),
        );
      }
      await shot("default");
      await shot("default-viewport", false);
      await results.getByRole("button", { name: "下一页", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".p36-results-c article").length === 2,
      );
      check("page two URL", new URL(page.url()).searchParams.get("org_token_page"), "2");
      await shot("page-two");
      const query = filter.locator('input[type="search"]');
      if (!(await query.isVisible())) await filter.locator("button[aria-expanded]").click();
      await query.fill("fixture-no-match");
      await page.waitForFunction(
        () => document.querySelectorAll(".p36-results-c article").length === 0,
      );
      await shot("no-results");
      await filter.getByRole("button", { name: "重置筛选", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".p36-results-c article").length === 6,
      );
      await form.locator('input[maxlength="120"]').fill("  整页审核接入  ");
      await form.locator("textarea").fill("  验证整页组合  ");
      await form.locator('button[type="submit"]').click();
      await form.locator("#token-scope-error").waitFor();
      check("scope failure no POST", requests.filter((req) => req.method === "POST").length, 0);
      await shot("create-scope-error");
      await form.locator('input[type="checkbox"]').first().check();
      await form.locator('button[type="submit"]').click();
      await page.locator(".p36-secret-c").waitFor();
      await page.waitForFunction(
        () => document.querySelector('.p36-create-c input[maxlength="120"]')?.value === "",
      );
      check("exact create body", requests.find((req) => req.method === "POST").body, {
        name: "整页审核接入",
        scopes: ["task:read"],
        ttl_days: 90,
        reason: "验证整页组合",
      });
      check("idempotency present", requests.find((req) => req.method === "POST").idempotency);
      check(
        "synthetic secret full text",
        await page.locator(".p36-secret-c code").textContent(),
        "synthetic-p36-page-only",
      );
      check(
        "total after reread",
        (await page.locator(".org-token-metrics b").allTextContents())[0],
        "9",
      );
      await shot("secret-shown");
      await page.getByRole("button", { name: "我已安全保存", exact: true }).click();
      check("saved removes secret", await page.locator(".p36-secret-c").count(), 0);
      await shot("secret-cleared");
      for (const [action, label] of [
        ["rotate", "轮换密钥"],
        ["revoke", "撤销访问"],
      ]) {
        const button = page.getByRole("button", { name: label, exact: true }).first();
        await button.click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        check(action + ":actual modal", await dialog.evaluate((node) => node.matches(":modal")));
        await shot(action + "-dialog", false);
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        check(
          action + ":restore focus",
          await button.evaluate((node) => node === document.activeElement),
        );
      }
      readStatus = 500;
      await page.reload();
      await page.locator(".org-admin-state h3").waitFor();
      check(
        "read failure error role",
        await page.locator(".org-admin-notice").getAttribute("role"),
        "alert",
      );
      await shot("first-read-failure");
      check("one creation only", requests.filter((req) => req.method === "POST").length, 1);
      check("no external or unexpected writes", forbidden, []);
      check("zero browser errors", errors, []);
      check(
        "zero storage",
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      runs.push({ width, requests });
      console.log(`passed ${width}`);
    } finally {
      release();
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
  kind: "P36-PAGE-VUE-PREVIEW-r1",
  approval: "pending-user-review",
  scope:
    "Actual parent and child scripts with composed review-only create/secret/list templates and page/reason CSS. Whole route content, not App shell/navigation or production integration. Original eight fixtures plus one synthetic creation; exact create POST and GET, no rotation/revocation submits, real authorization/SQL/audit/clipboard. Original filter markup and old captures unchanged, not pixel-identical filter approval. Previously diagnosed write/read-failure and cached reason policies remain pending; no behavior fix inferred from this layout.",
  fixedTime,
  sourceHashes,
  transformedHashes: { [component]: hash(transformed) },
  checks,
  runs,
  screenshots,
  processesClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P36 整页C审核</title><style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;background:#edf1f6}article{background:white;padding:20px;margin:24px 0}img{max-width:100%}</style><h1>P36 整页C组合 · 实际Vue</h1><p>审核宿主、合成数据。默认图覆盖该路由完整内容但不含应用导航壳；弹窗和首屏图为viewport。待审局部/行为规则不因此获批。</p>${screenshots.map((shot) => `<article><h2>${shot.file}</h2><img src="${shot.file}" alt="${shot.state}" loading="lazy"></article>`).join("\n")}</html>`,
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
