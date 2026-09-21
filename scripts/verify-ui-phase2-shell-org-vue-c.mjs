import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./lib/ui-phase2-shell-vue-preview.mjs";
import {
  buildShellOrgFixture,
  orgFixtureFile,
  orgReviewCss,
  previewOrgSummary,
} from "./lib/ui-phase2-shell-org-fixture.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
assert.ok(process.argv.slice(2).length <= 1);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const output = "output/playwright/shell-org-vue-c-r2";
const shell = "apps/web/src/components/NavigationShell.vue";
const orgComponent = "apps/web/src/components/OrganizationAdminCenter.vue";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = await read(shell),
  replacement = previewShellVue(source),
  fixture = await buildShellOrgFixture();
const orgSource = await read(orgComponent),
  orgReplacement = previewOrgSummary(orgSource);
const sources = new Set([
  shell,
  orgComponent,
  shellReviewCss,
  shellReviewModule,
  orgFixtureFile,
  orgReviewCss,
  "scripts/verify-ui-phase2-shell-org-vue-c.mjs",
  "scripts/lib/ui-phase2-shell-org-fixture.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [],
  ports = [];
if (capture) await mkdir(output); // Exclusive versioned deliverable, never overwrite a prior review.
let browser, server;
try {
  browser = await chromium.launch();
  for (const mode of smoke ? ["review"] : ["baseline", "review"]) {
    const reserved = reservePort();
    await new Promise((done) => reserved.listen(0, "127.0.0.1", done));
    const port = reserved.address().port;
    await new Promise((done) => reserved.close(done));
    ports.push(port);
    const origin = `http://127.0.0.1:${port}`;
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
      plugins:
        mode === "baseline"
          ? []
          : [
              {
                name: "org-summary-c-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (
                    id.replaceAll("\\", "/") === path.resolve(orgComponent).replaceAll("\\", "/")
                  ) {
                    assert.equal(text.replaceAll("\r\n", "\n"), orgSource);
                    return { code: orgReplacement, map: null };
                  }
                  if (id.replaceAll("\\", "/") !== path.resolve(shell).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: replacement, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="shell-vue-c">')
                    .replace(
                      "</head>",
                      [shellReviewCss, orgReviewCss]
                        .map(
                          (file) =>
                            `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
                        )
                        .join("") + "</head>",
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`Organization ${mode} ${origin}`);
    for (const width of mode === "baseline" || smoke ? [390, 1440] : [390, 840, 841, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [],
          checks = [];
        page.setDefaultTimeout(15000);
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}: ${name}`);
          checks.push({ name, actual });
        };
        const shot = async (scene, selector) => {
          if (!capture) return;
          await page.evaluate(() => document.fonts.ready);
          if (selector) await page.locator(selector).scrollIntoViewIfNeeded();
          else await page.evaluate(() => scrollTo(0, 0));
          const bytes = selector
            ? await page.locator(selector).screenshot({ animations: "disabled" })
            : await page.screenshot({ animations: "disabled" });
          const file = `${mode}-${width}-${scene}.png`;
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            mode,
            width,
            scene,
            selector: selector ?? null,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", (route) => {
          const req = route.request(),
            url = new URL(req.url()),
            key = `${req.method()} ${url.pathname}${url.search}`;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          // Existing access-state review convention: explicit local preference failure,
          // not evidence of persisted theme synchronization.
          if (key === "GET /api/v1/me/ui-preferences") {
            requests.push({ key, body: req.postData() });
            return route.fulfill({ status: 500, json: {} });
          }
          const values = {
            "GET /api/v1/me/navigation?shell=organization_admin": fixture.navigation,
            "GET /api/v1/auth/session-status": { authenticated: true },
            "GET /api/v1/org/admin/summary": fixture.summary,
            "GET /api/v1/org/admin/profile": fixture.profile,
            "GET /api/v1/org/admin/workspaces": fixture.workspaces,
          };
          if (!(key in values)) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: req.postData() });
          return route.fulfill({
            json: {
              data: values[key],
              request_id: "org-summary-local-fixture",
              trace_id: "org-summary-local-fixture",
            },
          });
        });
        await page.goto(origin + "/org-admin");
        await page.waitForSelector(
          '.role-shell[data-state="ready"] .org-admin-center[data-state="ready"]',
        );
        check(
          "profile fixture name",
          await page.locator(".org-admin-profile h3").textContent(),
          fixture.profile.name,
        );
        check(
          "original six metrics",
          await page.locator(".org-admin-metrics b").allTextContents(),
          ["96", "8", "24", "7", "18", "1238"],
        );
        check(
          "workspace name not UUID",
          await page.locator(".org-admin-profile dd").last().textContent(),
          fixture.workspaces[0].name,
        );
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        const expectedMenu = await page
          .locator(".role-nav-menu a")
          .evaluateAll((nodes) =>
            nodes.map((n) => ({ href: n.getAttribute("href"), name: n.textContent.trim() })),
          );
        check(
          "only organization routes",
          expectedMenu.length === 9 &&
            expectedMenu.every(
              (item) => item.href === "/org-admin" || item.href.startsWith("/org-admin/"),
            ),
        );
        await shot("overview");
        if (mode === "review") {
          check(
            "summary heading uses actual organization name",
            await page.locator(".org-admin-hero h2").textContent(),
            fixture.profile.name,
          );
          check(
            "summary font no longer uses legacy serif",
            await page
              .locator(".org-admin-hero h2")
              .evaluate((n) => getComputedStyle(n).fontFamily.includes("Microsoft YaHei")),
          );
          if (width <= 840)
            check(
              "context fluorescent edge removed",
              await page
                .locator(".role-context-drawer > summary")
                .evaluate((n) => getComputedStyle(n).borderLeftWidth),
              "0px",
            );
          check(
            "content visible beside desktop menu",
            await page.evaluate(() => {
              const content = document.querySelector(".role-content").getBoundingClientRect();
              const nav = document.querySelector(".role-navigation-frame").getBoundingClientRect();
              return content.y < 150 && (innerWidth <= 840 || content.x >= nav.right - 1);
            }),
          );
          check(
            "blue summary heading",
            await page
              .locator(".org-admin-hero")
              .evaluate((n) => getComputedStyle(n).backgroundColor),
            "rgb(36, 75, 176)",
          );
          const form = page.locator(".org-admin-grid > form");
          check("six original fields", await form.locator("label").count(), 6);
          check(
            "fields minimum touch size",
            await form
              .locator("input,select,textarea,button")
              .evaluateAll((nodes) => nodes.every((n) => n.getBoundingClientRect().height >= 44)),
          );
          check(
            "form visual order equals DOM order",
            await form
              .locator("input,select,textarea,button")
              .evaluateAll((nodes) => nodes.every((n) => getComputedStyle(n).order === "0")),
          );
          await shot("profile", ".org-admin-profile");
          await shot("form", ".org-admin-grid > form");
          const name = form.getByRole("textbox", { name: "名称", exact: true });
          await name.fill("本地审核草稿，不提交");
          check("original form remains editable", await name.inputValue(), "本地审核草稿，不提交");
          await name.fill(fixture.profile.name);
          await name.focus();
          await page.keyboard.press("Tab");
          check(
            "name tab reaches logo field",
            await form.locator('input[type="url"]').evaluate((n) => n === document.activeElement),
          );
          check(
            "native reason still required",
            await form
              .locator("textarea")
              .evaluate((n) => n.required && n.maxLength === 500 && !n.validity.valid),
          );
          const opener = page.getByRole("button", { name: "打开导航菜单", exact: true });
          if (width <= 840) {
            await opener.click();
            await page.waitForSelector(".role-navigation-frame:modal");
            check(
              "menu initial focus",
              await page
                .locator(".role-navigation-close")
                .evaluate((n) => n === document.activeElement),
            );
            await shot("navigation-open");
            await page.keyboard.press("Shift+Tab");
            check(
              "reverse tab contained",
              await page
                .locator(".role-navigation-frame")
                .evaluate((n) => n.contains(document.activeElement)),
            );
            await page.keyboard.press("Tab");
            check(
              "forward tab contained",
              await page
                .locator(".role-navigation-close")
                .evaluate((n) => n === document.activeElement),
            );
            await page.keyboard.press("Escape");
            check(
              "escape restores menu opener",
              await opener.evaluate((n) => n === document.activeElement),
            );
            await opener.click();
          }
          const search = page.getByRole("searchbox", { name: "搜索导航菜单", exact: true });
          await search.fill("无匹配的组织菜单");
          await page.waitForSelector(".role-menu-empty");
          check(
            "menu empty preserves profile",
            await page.locator(".org-admin-profile h3").textContent(),
            fixture.profile.name,
          );
          await shot("navigation-empty");
          await search.fill("");
          check(
            "all authorized menu restored",
            await page
              .locator(".role-nav-menu a")
              .evaluateAll((nodes) =>
                nodes.map((n) => ({ href: n.getAttribute("href"), name: n.textContent.trim() })),
              ),
            expectedMenu,
          );
          if (width <= 840) await page.keyboard.press("Escape");
          const before = requests.filter((r) => r.key === "GET /api/v1/org/admin/summary").length;
          await page.getByRole("button", { name: "刷新数据", exact: true }).click();
          await page.waitForFunction(
            () =>
              document.querySelector(".org-admin-refresh button")?.textContent.trim() ===
              "刷新数据",
          );
          check(
            "refresh is one additional summary read",
            requests.filter((r) => r.key === "GET /api/v1/org/admin/summary").length,
            before + 1,
          );
          check("refresh retains original profile", await name.inputValue(), fixture.profile.name);
        }
        check(
          "GET only and no bodies",
          requests.every((r) => r.key.startsWith("GET ") && r.body === null),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ mode, width, checks, requests, expectedMenu });
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
        /\.(vue|ts|css|json)$/.test(file)
      )
        sources.add(file);
    }
    await server.close();
    server = null;
  }
  await includeImportedStyleSources(sources, (file) =>
    file.startsWith("apps/web/src/") ? read(file) : "",
  );
  await browser.close();
  browser = null;
  const evidence = {
    kind: "SHELL-ORG-VUE-C-r2",
    reviewOnly: true,
    userReview: "pending",
    processesClosed: true,
    ports,
    runs,
    screenshots,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    boundary:
      "Actual App/Router/NavigationShell/OrganizationAdminCenter, summary only. Review-only shell transform and CSS; organization script unchanged, one heading expression displays existing profile name. Original M06-01 GET fixtures; preference GET explicit500 fallback, not synchronization proof. No writes, real authorization, other organization pages, themes, save validation or production acceptance.",
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>组织概览 C 实际 Vue 审核</title><style>body{font:16px/1.7 sans-serif;margin:24px;background:#f3f6fb;color:#172d4c}img{max-width:100%}article{margin:32px 0}</style><h1>组织概览 · C 方向实际 Vue</h1><p>本地测试样例，待审核；只核对展示区域，不代表保存、真实权限、其他页面或生产验收。</p><a href="evidence.json">机器证据</a>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.mode} / ${s.width} / ${s.scene}</h2><img loading="lazy" src="${s.file}" alt="${s.mode} ${s.width} ${s.scene}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, r) => n + r.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
      ports,
      processesClosed: true,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
