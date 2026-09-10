import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { tokenListPreview } from "./lib/ui-phase2-token-list-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p36-list-vue-preview";
const component = "apps/web/src/components/OrganizationTokenPanel.vue";
const css = "design-plans/ui-phase-2-2026-09-07/implementation/token-list-preview.css";
const fixtureFile = "tests/e2e/m06-01-organization-admin.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const original = await read(component),
  transformed = tokenListPreview(original);
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((node) => node.declarationList.declarations)
  .filter((node) => node.name.getText(ast) === "organizationTokens");
assert.equal(declarations.length, 1);
const tokens = JSON.parse(
  JSON.stringify(vm.runInNewContext(declarations[0].initializer.getText(ast))),
);
assert.equal(tokens.length, 8);
const fixedTime = "2026-08-26T10:00:00.000Z";
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((match) => "apps/web/src/" + match[1]);
const entry = "/__p36_list_preview.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Parent from '/src/components/OrganizationAdminCenter.vue';
${cssFiles.map((file) => `import '/src/${file.slice("apps/web/src/".length)}';`).join("\n")}
import '/src/organization-admin.css';import '/@fs/${path.resolve(css).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p36-list-preview');
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
      name: "p36-list-review-only",
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
            return res.end("API without fixture forbidden");
          }
          if (pathname !== "/org-admin/tokens") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 令牌列表 · C审核</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
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
  component,
  css,
  fixtureFile,
  ...cssFiles,
  "apps/web/src/organization-admin.css",
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/lib/ui-phase2-token-list-preview.mjs",
  "scripts/verify-ui-phase2-token-list-preview.mjs",
]);
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p36_list_host ${origin}`);
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
        hold = false,
        gate = Promise.resolve();
      await page.clock.install({ time: new Date(fixedTime) });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: () => {
              throw Error("clipboard outside list scope");
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
        if (hold) await gate;
        return route.fulfill({
          json: {
            data: url.pathname.endsWith("/tokens") ? rows : { observed_at: fixedTime },
            request_id: "p36-list-fixture",
            trace_id: "p36-list-fixture",
          },
        });
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const result = page.locator(".p36-results-c"),
        cards = result.locator("article"),
        filter = page.locator(".org-token-filters-c"),
        query = filter.locator('input[type="search"]'),
        status = filter.locator('select[aria-labelledby="org-token-status-label"]'),
        paging = result.locator(".org-token-pagination"),
        next = paging.getByRole("button", { name: "下一页", exact: true }),
        previous = paging.getByRole("button", { name: "上一页", exact: true });
      const waitCount = (count) =>
        page.waitForFunction(
          (value) => document.querySelectorAll(".p36-results-c article").length === value,
          count,
        );
      const shot = async (name, target = result) => {
        await target.scrollIntoViewIfNeeded();
        check(
          name + ":visible region is unobscured",
          await target.evaluate((node) => {
            const box = node.getBoundingClientRect();
            const left = Math.max(0, box.left),
              right = Math.min(innerWidth, box.right);
            const top = Math.max(0, box.top),
              bottom = Math.min(innerHeight, box.bottom);
            if (right <= left || bottom <= top) return false;
            return [0.15, 0.5, 0.85].every((ratio) =>
              node.contains(
                document.elementFromPoint((left + right) / 2, top + (bottom - top) * ratio),
              ),
            );
          }),
        );
        check(
          name + ":no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        const bytes = await target.screenshot({ animations: "disabled" }),
          file = `${width}-${name}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          width,
          state: name,
          sha256: hash(bytes),
          scope: "actual-parent-child-C-review-fixtures-not-approval",
        });
      };
      const refresh = async () => {
        await page.locator(".org-admin-refresh button").click();
        await page.waitForFunction(
          () => document.querySelector(".org-admin-center")?.getAttribute("aria-busy") === "false",
        );
      };
      await page.goto(origin + "/org-admin/tokens");
      await result.waitFor();
      await waitCount(6);
      check(
        "six rows on first page",
        await cards.locator("h5").allTextContents(),
        [...tokens]
          .reverse()
          .slice(0, 6)
          .map((item) => item.name),
      );
      check("first previous disabled", await previous.isDisabled());
      check("first next enabled", await next.isEnabled());
      check(
        "inactive rows have no write actions",
        await cards.evaluateAll((nodes) =>
          nodes
            .filter((node) => node.dataset.status !== "active")
            .every((node) => node.querySelectorAll("button").length === 0),
        ),
      );
      check(
        "technical IDs initially collapsed",
        await cards.first().locator("details code").isVisible(),
        false,
      );
      await shot("page-one");
      await next.click();
      await waitCount(2);
      check("page two exact names", await cards.locator("h5").allTextContents(), [
        tokens[1].name,
        tokens[0].name,
      ]);
      check("page two next disabled", await next.isDisabled());
      check("page two URL", new URL(page.url()).searchParams.get("org_token_page"), "2");
      await shot("page-two");
      await query.fill("fixture-no-match");
      await waitCount(0);
      check("no-result copy", await result.locator("h5").textContent(), "没有匹配的组织令牌");
      check("no-result pagination absent", await paging.count(), 0);
      await shot("no-result");
      await filter.getByRole("button", { name: "重置筛选", exact: true }).click();
      await waitCount(6);
      await status.selectOption("active");
      await waitCount(6);
      check(
        "all six actual active records",
        await cards.evaluateAll((nodes) => nodes.every((node) => node.dataset.status === "active")),
      );
      check("filter and paging made no extra GET", requests.length, 2);
      const card = cards.first(),
        name = await card.locator("h5").textContent();
      check(
        "C record paper",
        await card.evaluate((node) => getComputedStyle(node).backgroundColor),
        "rgb(255, 255, 255)",
      );
      check(
        "native action and summary touch targets",
        await card.locator("button,summary").evaluateAll((nodes) =>
          nodes.every((node) => {
            const b = node.getBoundingClientRect();
            return (
              b.width >= 44 && b.height >= 44 && parseFloat(getComputedStyle(node).fontSize) >= 16
            );
          }),
        ),
      );
      await shot("active-record", card);
      const summary = card.locator("summary");
      await summary.click();
      check(
        "exact technical ID",
        await card.locator("details code").textContent(),
        `令牌记录 ID：${tokens[5].id}`,
      );
      await shot("technical-open", card);
      await summary.click();
      for (const [action, label] of [
        ["rotate", "轮换密钥"],
        ["revoke", "撤销访问"],
      ]) {
        const button = card.getByRole("button", { name: label, exact: true });
        await button.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        check(
          action + ":real keyboard focus",
          await button.evaluate(
            (node) =>
              node === document.activeElement && getComputedStyle(node).outlineStyle === "solid",
          ),
        );
        await shot(action + "-focus", card);
        await button.evaluate((node) => node.blur());
        await button.hover();
        await shot(action + "-hover", card);
        await page.mouse.down();
        check(action + ":native pressed", await button.evaluate((node) => node.matches(":active")));
        await shot(action + "-pressed", card);
        await page.mouse.move(0, 0);
        await page.mouse.up();
        await button.click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        check(
          action + ":actual reason target",
          await dialog.getAttribute("aria-label"),
          action === "rotate" ? `轮换“${name}”密钥` : `撤销“${name}”访问`,
        );
        check(action + ":original blank reason", await dialog.locator("textarea").inputValue(), "");
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        check(
          action + ":cancel restores trigger",
          await button.evaluate((node) => node === document.activeElement),
        );
      }
      hold = true;
      gate = new Promise((done) => {
        release = done;
      });
      await page.locator(".org-admin-refresh button").click();
      await page.waitForFunction(
        () => document.querySelector(".p36-results-c article button")?.disabled === true,
      );
      check(
        "busy record actions disabled",
        await cards
          .locator("button")
          .evaluateAll((nodes) => nodes.length === 12 && nodes.every((node) => node.disabled)),
      );
      await shot("busy-record", card);
      hold = false;
      release();
      await page.waitForFunction(
        () => document.querySelector(".p36-results-c article button")?.disabled === false,
      );
      await filter.getByRole("button", { name: "重置筛选", exact: true }).click();
      rows = [];
      await refresh();
      await waitCount(0);
      check(
        "empty-organization copy",
        await result.locator("h5").textContent(),
        "当前组织尚未创建令牌",
      );
      await shot("no-tokens");
      rows = [{ ...tokens[0], status: "expired", expires_at: "2026-08-20T12:00:00.000Z" }];
      await refresh();
      await waitCount(1);
      check(
        "expired actual label",
        await cards.first().locator(".p36-token-state > span").textContent(),
        "已过期",
      );
      check("expired has no write actions", await cards.locator("button").count(), 0);
      await shot("expired-record", cards.first());
      rows = [
        {
          ...tokens[0],
          name: "测试长名称_".repeat(18),
          status: "fixture_unknown",
          scopes: ["fixture:unknown"],
        },
      ];
      await refresh();
      await waitCount(1);
      check(
        "unknown status is not invented active",
        await cards.first().locator(".p36-token-state > span").textContent(),
        "未知状态（fixture_unknown）",
      );
      check(
        "unknown scope original fallback",
        await cards.first().locator(".org-token-scopes span").textContent(),
        "未知 scope（fixture:unknown）",
      );
      check("unknown has no actions", await cards.locator("button").count(), 0);
      await shot("unknown-long-record", cards.first());
      check(
        "all requests remain exact GET",
        requests.every(
          (request) =>
            request.method === "GET" &&
            ["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(request.path),
        ),
      );
      check("zero external or write requests", forbidden, []);
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
  kind: "P36-LIST-VUE-PREVIEW-r1",
  approval: "pending-user-review",
  scope:
    "Actual parent/child and original scripts/directives with review-only result template/CSS. Original eight token fixture at fixed review clock; supplemental empty,expired and unknown/long-name responses explicitly synthetic. GET-only, original reason dialogs opened and cancelled; no submitted rotation/revoke, OS clipboard, permissions, actual SQL, App shell or production acceptance. Filters retain original markup; host workbench width is a preview arrangement, not pixel-identical full-page approval.",
  fixedTime,
  fixtureRows: tokens,
  supplemental: ["empty", "expired-clone", "unknown-scope-status-long-name-clone"],
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
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P36 令牌列表审核</title><style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}article{padding:20px;margin:24px 0;background:white}img{max-width:100%}</style><h1>P36 令牌列表 · 实际Vue审核稿</h1><p>测试数据、固定审核时间；不是生产记录。列表/分页/原原因窗取消由实际Vue验证，未提交轮换或撤销。创建、明文与已批筛选不是本轮审图范围。</p>${screenshots.map((shot) => `<article><h2>${shot.file}</h2><img src="${shot.file}" alt="${shot.state}" loading="lazy"></article>`).join("\n")}</html>`,
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
