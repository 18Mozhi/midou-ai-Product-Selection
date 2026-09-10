import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { tokenCreatePreview } from "./lib/ui-phase2-token-create-preview.mjs";
import { buildOrgTokenDesignData } from "./lib/ui-phase2-org-token-design-data.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p36-create-vue-preview";
const component = "apps/web/src/components/OrganizationTokenPanel.vue";
const css = "design-plans/ui-phase-2-2026-09-07/implementation/token-create-preview.css";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const original = await read(component),
  transformed = tokenCreatePreview(original);
const data = await buildOrgTokenDesignData(process.cwd());
const entry = "/__p36_create_preview.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Parent from '/src/components/OrganizationAdminCenter.vue';
import '/src/styles.css';import '/src/design/tokens.css';import '/src/accessibility.css';import '/src/responsive-baselines.css';import '/src/signal-ledger.css';
import '/@fs/${path.resolve(css).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p36-create-preview');
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
      name: "p36-create-review-only",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(source, id) {
        if (id.replaceAll("\\", "/") === path.resolve(component).replaceAll("\\", "/"))
          return transformed;
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
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 创建组合 · 真实Vue审核</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
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
  "scripts/verify-ui-phase2-token-create-preview.mjs",
  "scripts/lib/ui-phase2-token-create-preview.mjs",
  "scripts/lib/ui-phase2-org-token-design-data.mjs",
  "tests/e2e/m06-01-organization-admin.spec.ts",
  "apps/web/vite.config.ts",
]);
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p36_create_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    let release;
    try {
      const page = await context.newPage(),
        requests = [],
        unexpected = [],
        errors = [];
      let outcome = "failure";
      const env = (value) => ({
        data: value,
        request_id: "p36-create-fixture",
        trace_id: "p36-create-fixture",
      });
      // Advancing browser clock preserves native Vue bubbling event timestamps.
      await page.clock.install({ time: new Date(data.fixedTime) });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: () => {
              throw Error("OS clipboard not in scope");
            },
          },
        });
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push(req.url());
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        requests.push({
          method: req.method(),
          path: url.pathname,
          body: req.postDataJSON(),
          key: Boolean(req.headers()["idempotency-key"]),
        });
        if (
          req.method() === "GET" &&
          ["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(url.pathname)
        )
          return route.fulfill({
            json: env(
              url.pathname.endsWith("/tokens") ? data.tokens : { observed_at: data.fixedTime },
            ),
          });
        if (req.method() === "POST" && url.pathname === "/api/v1/org/admin/tokens") {
          await new Promise((done) => {
            release = done;
          });
          if (outcome === "failure")
            return route.fulfill({
              status: 500,
              json: {
                error: {
                  code: "fixture_failure",
                  message: "测试失败",
                  action_hint: "测试：创建未完成，请稍后重试。",
                },
                request_id: "p36-create-fixture",
                trace_id: "p36-create-fixture",
              },
            });
          return route.fulfill({ json: env({ secret: "SYNTHETIC_NOT_A_TOKEN_FOR_UI_REVIEW" }) });
        }
        unexpected.push(`${req.method()} ${url.pathname}`);
        return route.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      await page.goto(origin + "/org-admin/tokens");
      const form = page.locator(".p36-create-c"),
        name = form.locator('input[maxlength="120"]'),
        days = form.locator('input[type="number"]'),
        reason = form.locator("textarea"),
        scopes = form.locator('input[type="checkbox"]'),
        submit = form.locator('button[type="submit"]');
      await expect(form).toBeVisible();
      check(
        "C paper and no inherited primary containers",
        await form.evaluate((node) => {
          const layout = node.querySelector(".p36-form-layout"),
            fields = node.querySelector(".p36-form-fields");
          return [
            getComputedStyle(node).backgroundColor,
            getComputedStyle(layout).backgroundColor,
            getComputedStyle(fields).backgroundColor,
            getComputedStyle(fields).fontWeight,
          ];
        }),
        ["rgb(255, 255, 255)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "400"],
      );
      check(
        "native fields and clickable labels have readable touch geometry",
        await form
          .locator('input:not([type="checkbox"]), textarea, button, .org-token-scope-field label')
          .evaluateAll((nodes) =>
            nodes.every((node) => {
              const box = node.getBoundingClientRect();
              return (
                box.width >= 44 &&
                box.height >= 44 &&
                parseFloat(getComputedStyle(node).fontSize) >= 16
              );
            }),
          ),
      );
      const shot = async (state) => {
        check(
          `${state} no page overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        await page.mouse.move(0, 0);
        const file = `${width}-${state}.png`,
          bytes = await form.screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          width,
          state,
          sha256: hash(bytes),
          scope: "actual-parent-child-with-review-template-css-and-HTTP-fixtures-not-approval",
        });
      };
      check(
        "original empty name and90days",
        [await name.inputValue(), await days.inputValue()],
        ["", "90"],
      );
      check(
        "original four scopes unchecked",
        await scopes.evaluateAll(
          (nodes) => nodes.length === 4 && nodes.every((node) => !node.checked),
        ),
      );
      check(
        "original native field constraints",
        await form
          .locator('input:not([type="checkbox"]),textarea')
          .evaluateAll((nodes) =>
            nodes.map((node) => [
              node.tagName,
              node.required,
              node.getAttribute("maxlength"),
              node.getAttribute("min"),
              node.getAttribute("max"),
            ]),
          ),
        [
          ["INPUT", true, "120", null, null],
          ["INPUT", true, null, "1", "365"],
          ["TEXTAREA", true, "500", null, null],
        ],
      );
      await shot("default");
      await name.focus();
      const focusOrder = [];
      for (let index = 0; index < 12; index++) {
        focusOrder.push(
          await page.evaluate(() => {
            const node = document.activeElement;
            return (
              node.tagName +
              ":" +
              (node.getAttribute("type") || "") +
              ":" +
              (node.tagName === "BUTTON" ? node.textContent.trim() : "")
            );
          }),
        );
        await page.keyboard.press("Tab");
      }
      check("DOM and keyboard order match proposed field order", focusOrder, [
        "INPUT::",
        "INPUT:number:",
        "BUTTON:button:30 天",
        "BUTTON:button:90 天",
        "BUTTON:button:180 天",
        "BUTTON:button:365 天",
        "INPUT:checkbox:",
        "INPUT:checkbox:",
        "INPUT:checkbox:",
        "INPUT:checkbox:",
        "TEXTAREA::",
        "BUTTON:submit:创建并显示一次明文",
      ]);
      await name.fill("  月度报表接入  ");
      await reason.fill("  经营团队按月核对报表  ");
      await submit.click();
      await expect(form.locator("#token-scope-error")).toHaveText("至少选择一个只读权限范围。");
      check(
        "missing scopes sends no POST",
        requests.filter((request) => request.method === "POST").length,
        0,
      );
      await shot("scope-required");
      await scopes.first().check();
      await expect(form.locator("#token-scope-error")).toHaveCount(0);
      for (const value of ["0", "366", "1.5", ""]) {
        await days.fill(value);
        await submit.click();
        check(
          `native TTL blocks ${value || "empty"}`,
          await days.evaluate((node) => node.validity.valid),
          false,
        );
        check(
          `invalid TTL has no POST ${value}`,
          requests.filter((request) => request.method === "POST").length,
          0,
        );
      }
      await days.fill("366");
      await shot("ttl-invalid");
      for (const value of [30, 90, 180, 365]) {
        await form.getByRole("button", { name: `${value} 天`, exact: true }).click();
        await expect(days).toHaveValue(String(value));
        await expect(
          form.getByRole("button", { name: `${value} 天`, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        check(`shortcut ${value} retained`, await days.evaluate((node) => node.validity.valid));
      }
      await form.getByRole("button", { name: "90 天", exact: true }).click();
      for (let i = 0; i < 4; i++) await scopes.nth(i).check();
      await shot("all-scopes");
      await name.focus();
      await shot("name-focus");
      const sent = page.waitForRequest((request) => request.method() === "POST");
      await submit.click();
      await sent;
      await expect(submit).toBeDisabled();
      await name.fill("失败后保留的后续草稿");
      check(
        "pending fields remain editable",
        await form
          .locator("input,textarea")
          .evaluateAll((nodes) => nodes.every((node) => !node.disabled)),
      );
      await shot("pending");
      const failed = page.waitForResponse((response) => response.request().method() === "POST");
      release();
      await (await failed).finished();
      await expect(submit).toBeEnabled();
      await expect(page.locator(".org-admin-notice")).toContainText("创建未完成");
      await expect(name).toHaveValue("失败后保留的后续草稿");
      check(
        "failed creation exposes no secret",
        await page.locator(".org-token-secret").count(),
        0,
      );
      await shot("failure-preserved");
      outcome = "success";
      const sentAgain = page.waitForRequest((request) => request.method() === "POST");
      await submit.click();
      await sentAgain;
      const succeeded = page.waitForResponse((response) => response.request().method() === "POST");
      release();
      await (await succeeded).finished();
      await expect(submit).toBeEnabled();
      await expect(name).toHaveValue("");
      await expect(days).toHaveValue("90");
      await expect(reason).toHaveValue("");
      check(
        "success unchecks all scopes",
        await scopes.evaluateAll((nodes) => nodes.every((node) => !node.checked)),
      );
      await expect(page.locator(".org-token-secret code")).toHaveText(
        "SYNTHETIC_NOT_A_TOKEN_FOR_UI_REVIEW",
      );
      await shot("success-reset");
      const writes = requests.filter((request) => request.method === "POST");
      check("two explicit original posts", writes.length, 2);
      for (const [i, request] of writes.entries()) {
        check(`exact original body${i}`, request.body, {
          name: i ? "失败后保留的后续草稿" : "月度报表接入",
          scopes: data.scopeOptions.map((scope) => scope.value),
          ttl_days: 90,
          reason: "经营团队按月核对报表",
        });
        check(`idempotency retained${i}`, request.key);
      }
      check(
        "no storage",
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      check("no unexpected requests", unexpected, []);
      check("no Vue errors", errors, []);
      runs.push({ width, requests });
      console.log(`passed ${width}`);
    } finally {
      release?.();
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
const result = {
  kind: "P36-CREATE-VUE-PREVIEW-r1",
  approval: "pending-user-review",
  scope:
    "Actual parent/child scripts and native constraints; review-only creation template/CSS. HTTP fixtures, synthetic invalid secret, no real authorization, persistence, OS clipboard, App shell or production acceptance. Failure notice remains outside form, not a new inline field error.",
  sourceHashes,
  transformedHashes: { [component]: hash(transformed) },
  checks,
  runs,
  screenshots,
  processesClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(result, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P36 创建组合审核</title><h1>P36 创建组合 · 真实 Vue 待审</h1><p>仅创建表单的审核模板与CSS。原父子逻辑，全部HTTP为测试数据，未上线。失败提示仍在表单外，图中保留草稿不代表没有错误。</p>${screenshots.map((shot) => `<h2>${shot.file}</h2><img style="max-width:100%" src="${shot.file}" alt="${shot.state}">`).join("\n")}</html>`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    sources: sourceFiles.size,
    processesClosed: true,
  }),
);
