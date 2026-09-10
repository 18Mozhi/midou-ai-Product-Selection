import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { tokenSecretPreview } from "./lib/ui-phase2-token-secret-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p36-secret-vue-preview";
const component = "apps/web/src/components/OrganizationTokenPanel.vue";
const css = "design-plans/ui-phase-2-2026-09-07/implementation/token-secret-preview.css";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const original = await read(component),
  transformed = tokenSecretPreview(original);
const initialSecret = "SYNTHETIC_UI_REVIEW_ONLY_NOT_A_REAL_TOKEN";
const longSecret = "SYNTHETIC_LONG_REVIEW_ONLY_" + "NO_AUTHORITY_".repeat(20);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((match) => "apps/web/src/" + match[1]);
const entry = "/__p36_secret_preview.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Parent from '/src/components/OrganizationAdminCenter.vue';
${cssFiles.map((file) => `import '/src/${file.slice("apps/web/src/".length)}';`).join("\n")}
import '/src/organization-admin.css';import '/@fs/${path.resolve(css).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';
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
      name: "p36-secret-review-only",
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
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 一次性明文 · C审核</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
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
  ...cssFiles,
  "apps/web/src/organization-admin.css",
  "apps/web/src/main.ts",
  "scripts/lib/ui-phase2-token-secret-preview.mjs",
  "scripts/verify-ui-phase2-token-secret-preview.mjs",
  "apps/web/vite.config.ts",
]);
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p36_secret_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 640 : 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    let releaseRead = () => {};
    try {
      await context.addInitScript(() => {
        window.__copies = [];
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: (value) =>
              new Promise((resolve, reject) => window.__copies.push({ value, resolve, reject })),
          },
        });
      });
      const page = await context.newPage(),
        requests = [],
        errors = [],
        forbidden = [];
      let writes = 0,
        holdRead = false;
      let readGate = Promise.resolve();
      page.on("pageerror", (error) => errors.push(error.message));
      const envelope = (value) => ({
        data: value,
        request_id: "p36-secret-preview-fixture",
        trace_id: "p36-secret-preview-fixture",
      });
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          forbidden.push(req.url());
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        requests.push({
          path: url.pathname,
          method: req.method(),
          body: req.postDataJSON(),
          idempotency: Boolean(req.headers()["idempotency-key"]),
        });
        if (
          req.method() === "GET" &&
          ["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(url.pathname)
        ) {
          if (holdRead) await readGate;
          return route.fulfill({
            json: envelope(
              url.pathname.endsWith("/tokens") ? [] : { observed_at: "2026-09-11T00:00:00Z" },
            ),
          });
        }
        if (req.method() === "POST" && url.pathname === "/api/v1/org/admin/tokens") {
          writes++;
          return route.fulfill({
            json: envelope({ secret: writes === 1 ? initialSecret : longSecret }),
          });
        }
        forbidden.push(`${req.method()} ${url.pathname}`);
        return route.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const region = page.locator(".p36-secret-c"),
        copy = region.getByRole("button", { name: "复制明文", exact: true }),
        saved = region.getByRole("button", { name: "我已安全保存", exact: true });
      const state = async (expected) =>
        page.waitForFunction(
          (value) =>
            document.querySelector(".p36-secret-c")?.getAttribute("data-copy-state") === value,
          expected,
        );
      const settle = async (index, outcome) => {
        await page.evaluate(
          ({ index, outcome }) => {
            const request = window.__copies[index];
            outcome === "copied" ? request.resolve() : request.reject(Error("synthetic denial"));
          },
          { index, outcome },
        );
      };
      const shot = async (name) => {
        check(
          name + ":no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        const bytes = await region.screenshot({ animations: "disabled" }),
          file = `${width}-${name}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          width,
          state: name,
          sha256: hash(bytes),
          scope: "actual-parent-child-review-template-css-fixtures-not-approval",
        });
      };
      const form = page.locator(".org-token-create");
      const create = async () => {
        await form.locator('input[maxlength="120"]').fill("明文审核测试");
        await form.locator("textarea").fill("界面审核，不创建真实凭据");
        await form.locator('input[type="checkbox"]').first().check();
        await form.locator('button[type="submit"]').click();
      };
      await page.goto(origin + "/org-admin/tokens");
      await form.waitFor();
      check("no secret before creation", await region.count(), 0);
      holdRead = true;
      readGate = new Promise((done) => {
        releaseRead = done;
      });
      await create();
      await region.waitFor();
      await state("idle");
      check(
        "actual parent pending reread",
        await form.locator('button[type="submit"]').isDisabled(),
      );
      check(
        "original secret actions remain enabled during reread",
        await region
          .locator("button")
          .evaluateAll((nodes) => nodes.length === 2 && nodes.every((node) => !node.disabled)),
      );
      await shot("parent-refreshing");
      holdRead = false;
      releaseRead();
      await page.waitForFunction(
        () => !document.querySelector('.org-token-create button[type="submit"]').disabled,
      );
      check(
        "blue rail and white content",
        await region.evaluate((node) => [
          getComputedStyle(node.querySelector("header")).backgroundColor,
          getComputedStyle(node).backgroundColor,
        ]),
        ["rgb(37, 74, 156)", "rgb(255, 255, 255)"],
      );
      check(
        "complete initial synthetic text",
        await region.locator("code").textContent(),
        initialSecret,
      );
      check(
        "native two button touch targets",
        await region.locator("button").evaluateAll((nodes) =>
          nodes.every((node) => {
            const b = node.getBoundingClientRect();
            return (
              b.height >= 44 && b.width >= 44 && parseFloat(getComputedStyle(node).fontSize) >= 16
            );
          }),
        ),
      );
      check(
        "mobile vertical or desktop side rail",
        await region.evaluate((node) => {
          const header = node.querySelector("header").getBoundingClientRect(),
            content = node.querySelector(".p36-secret-content").getBoundingClientRect();
          return content.top >= header.bottom - 1 ? "stack" : "side";
        }),
        width <= 1000 ? "stack" : "side",
      );
      await page.mouse.move(0, 0);
      await shot("default");
      await copy.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      check(
        "keyboard reaches copy",
        await copy.evaluate((node) => node === document.activeElement),
      );
      check(
        "blue keyboard focus",
        await copy.evaluate((node) => getComputedStyle(node).outlineStyle),
        "solid",
      );
      await shot("copy-focus");
      await page.keyboard.press("Tab");
      check(
        "keyboard proceeds to saved",
        await saved.evaluate((node) => node === document.activeElement),
      );
      await shot("saved-focus");
      await saved.evaluate((node) => node.blur());
      for (const [label, button] of [
        ["copy", copy],
        ["saved", saved],
      ]) {
        await button.hover();
        await shot(label + "-hover");
        await page.mouse.down();
        check(label + ":native pressed", await button.evaluate((node) => node.matches(":active")));
        await shot(label + "-pressed");
        // Release outside the target so the saved button is not accidentally activated.
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      await copy.click();
      await shot("copy-pending");
      check(
        "pending feedback remains original idle",
        await region.getAttribute("data-copy-state"),
        "idle",
      );
      await settle(0, "copied");
      await state("copied");
      await shot("copied");
      check(
        "real success wording",
        (await region.locator('[role="status"]').textContent()).trim(),
        "已复制到剪贴板，请立即保存到受限凭据位置。",
      );
      await copy.click();
      await settle(1, "failed");
      await state("failed");
      await shot("failed");
      check(
        "real failure wording",
        (await region.locator('[role="status"]').textContent()).trim(),
        "浏览器拒绝复制，请手动选择并保存。",
      );
      check(
        "manual selection retains exact text",
        await region.locator("code").evaluate((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const selection = getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return selection.toString();
        }),
        initialSecret,
      );
      await page.evaluate(() => getSelection().removeAllRanges());
      await copy.click();
      await create();
      await page.waitForFunction(
        (value) => document.querySelector(".p36-secret-c code")?.textContent === value,
        longSecret,
      );
      await settle(2, "copied");
      await state("idle");
      await shot("replacement-long");
      check(
        "old completion never marks replacement",
        await region.getAttribute("data-copy-state"),
        "idle",
      );
      check(
        "long value completely selectable",
        await region.locator("code").evaluate((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const selection = getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return selection.toString();
        }),
        longSecret,
      );
      await page.evaluate(() => getSelection().removeAllRanges());
      await copy.click();
      await saved.click();
      await region.waitFor({ state: "detached" });
      await settle(3, "failed");
      check("actual parent dismissal remains cleared", await region.count(), 0);
      check(
        "exact clipboard contents",
        await page.evaluate(() => window.__copies.map((request) => request.value)),
        [initialSecret, initialSecret, initialSecret, longSecret],
      );
      const posts = requests.filter((request) => request.method === "POST");
      check("two explicit original posts", posts.length, 2);
      for (const [index, post] of posts.entries()) {
        check("exact create body" + index, post.body, {
          name: "明文审核测试",
          scopes: ["task:read"],
          ttl_days: 90,
          reason: "界面审核，不创建真实凭据",
        });
        check("original idempotency" + index, post.idempotency);
      }
      check("no external or unexpected API", forbidden, []);
      check("no browser errors", errors, []);
      check(
        "no storage",
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      runs.push({ width, requests });
      console.log(`passed ${width}`);
    } finally {
      releaseRead();
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
  kind: "P36-SECRET-VUE-PREVIEW-r1",
  approval: "pending-user-review",
  scope:
    "Actual parent and child scripts with review-only secret composition/CSS. Intercepted HTTP and invalid synthetic credentials, mock clipboard; not real authorization, persistence, OS clipboard, App shell, rotation contract or production acceptance. Original pending and enabled states retained; no invented disabled/timeout/policy.",
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
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P36 一次性明文组合审核</title><style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}img{max-width:100%;border:1px solid #dbe1e9}article{padding:20px;background:white;margin:24px 0}</style><h1>P36 一次性明文 · 实际Vue审核稿</h1><p>测试数据、模拟剪贴板、C审核模板/CSS；未上线。复制/已保存的原逻辑保留。仅区域审核，不代表整页或权限验收。</p>${screenshots.map((shot) => `<article><h2>${shot.file}</h2><img src="${shot.file}" alt="${shot.state}" loading="lazy"></article>`).join("\n")}</html>`,
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
