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
} from "./lib/ui-phase2-shell-org-fixture.mjs";
import { previewOrgRefresh, orgRefreshCss } from "./lib/ui-phase2-org-refresh-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
assert.ok(process.argv.slice(2).length <= 1);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const output = "output/playwright/org-refresh-vue-c-r1";
const shell = "apps/web/src/components/NavigationShell.vue";
const orgComponent = "apps/web/src/components/OrganizationAdminCenter.vue";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = await read(shell),
  replacement = previewShellVue(source),
  fixture = await buildShellOrgFixture();
const orgSource = await read(orgComponent),
  orgReplacement = previewOrgRefresh(orgSource);
const sources = new Set([
  shell,
  orgComponent,
  shellReviewCss,
  shellReviewModule,
  orgFixtureFile,
  orgReviewCss,
  orgRefreshCss,
  "scripts/lib/ui-phase2-org-refresh-preview.mjs",
  "scripts/verify-ui-phase2-org-refresh-vue-c.mjs",
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
                    .replace("<body>", '<body class="shell-vue-c org-refresh-c">')
                    .replace(
                      "</head>",
                      [shellReviewCss, orgReviewCss, orgRefreshCss]
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

    for (const width of [390, 1440]) {
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
          unexpected = [],
          errors = [],
          checks = [];
        page.setDefaultTimeout(15000);
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}: ${name}`);
          checks.push({ name, actual });
        };
        let phase = "initial",
          gate = Promise.resolve();
        const hold = (next) => {
          phase = next;
          gate = new Promise((done) => {
            release = done;
          });
        };
        const shot = async (scene, selector) => {
          if (!capture) return;
          if (selector) {
            await page.locator(selector).evaluate((n) => n.scrollIntoView({ block: "center" }));
          } else await page.evaluate(() => scrollTo(0, 0));
          await page.evaluate(() => document.fonts.ready);
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
        await page.route("**/*", async (route) => {
          const req = route.request(),
            url = new URL(req.url()),
            key = `${req.method()} ${url.pathname}${url.search}`;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const values = {
            "GET /api/v1/me/navigation?shell=organization_admin": fixture.navigation,
            "GET /api/v1/auth/session-status": { authenticated: true },
            "GET /api/v1/org/admin/summary": fixture.summary,
            "GET /api/v1/org/admin/profile": fixture.profile,
            "GET /api/v1/org/admin/workspaces": fixture.workspaces,
          };
          if (key === "GET /api/v1/me/ui-preferences") {
            requests.push({ key, phase, body: req.postData() });
            return route.fulfill({ status: 500, json: {} });
          }
          if (!(key in values)) {
            unexpected.push(key);
            return route.abort();
          }
          const ownPhase = phase,
            ownGate = gate;
          requests.push({ key, phase: ownPhase, body: req.postData() });
          if (url.pathname.startsWith("/api/v1/org/admin/") && ownPhase !== "initial")
            await ownGate;
          if (key === "GET /api/v1/org/admin/summary" && ownPhase === "failure")
            return route.fulfill({
              status: 500,
              json: { request_id: "org-refresh-local-500", trace_id: "org-refresh-local-500" },
            });
          return route.fulfill({
            json: {
              data: values[key],
              request_id: "org-refresh-local-ok",
              trace_id: "org-refresh-local-ok",
            },
          });
        });
        await page.goto(origin + "/org-admin");
        await page.waitForSelector('.org-admin-center[data-state="ready"]');
        const center = page.locator(".org-admin-center"),
          refresh = page.locator(".org-admin-refresh button"),
          heading = page.locator(".org-admin-hero h2"),
          name = page.getByRole("textbox", { name: "名称", exact: true });
        const facts = await page.locator(".org-admin-metrics b").allTextContents();
        await name.fill("未保存的本地审核草稿");
        hold("failure");
        await refresh.focus();
        await page.keyboard.press("Enter");
        await page.waitForSelector('.org-admin-center[aria-busy="true"]');
        check("refresh disabled while pending", await refresh.isDisabled());
        check(
          "facts preserved while pending",
          await page.locator(".org-admin-metrics b").allTextContents(),
          facts,
        );
        check("draft preserved while pending", await name.inputValue(), "未保存的本地审核草稿");
        const pendingFocus = await page.evaluate(() => ({
          tag: document.activeElement.tagName,
          body: document.activeElement === document.body,
          heading: document.activeElement === document.querySelector(".org-admin-hero h2"),
        }));
        checks.push({ name: "pending focus observation", actual: pendingFocus });
        if (mode === "review")
          check("focused refresh moves to persistent heading", pendingFocus.heading);
        await page.keyboard.press("Enter");
        check(
          "keyboard repeat does not duplicate summary read",
          requests.filter((r) => r.phase === "failure" && r.key === "GET /api/v1/org/admin/summary")
            .length,
          1,
        );
        await shot("pending");
        release();
        await page.waitForSelector(
          '.org-admin-center[aria-busy="false"] .org-admin-notice[data-kind="error"]',
        );
        check("failure keeps ready content", await center.getAttribute("data-state"), "ready");
        check(
          "failure keeps original facts",
          await page.locator(".org-admin-metrics b").allTextContents(),
          facts,
        );
        check("failure keeps unsaved draft", await name.inputValue(), "未保存的本地审核草稿");
        check("failure enables reread", await refresh.isEnabled());
        check(
          "original fallback notice",
          await page
            .locator(".org-admin-notice")
            .textContent()
            .then((s) => s.includes("请求暂时失败。 请求未完成，请稍后重试。")),
        );
        if (mode === "review") {
          check(
            "read trace initially closed",
            await page.locator(".org-admin-notice details").evaluate((n) => !n.open),
          );
          check(
            "trace hidden before disclosure",
            await page.locator(".org-admin-notice code").isVisible(),
            false,
          );
          await shot("failure");
          await page.locator(".org-admin-notice summary").click();
          check(
            "original trace retained",
            await page.locator(".org-admin-notice code").textContent(),
            "org-refresh-local-500",
          );
          await shot("failure-trace", ".org-admin-notice");
        } else await shot("failure");
        hold("recovery");
        await refresh.focus();
        await page.keyboard.press("Enter");
        await page.waitForSelector('.org-admin-center[aria-busy="true"]');
        check(
          "retry removes old notice using original load",
          await page.locator(".org-admin-notice").count(),
          0,
        );
        check("retry pending keeps draft", await name.inputValue(), "未保存的本地审核草稿");
        if (mode === "review") await shot("reread-pending");
        release();
        await page.waitForSelector('.org-admin-center[aria-busy="false"]');
        check("success retains ready content", await center.getAttribute("data-state"), "ready");
        check(
          "success uses current original form reset policy",
          await name.inputValue(),
          fixture.profile.name,
        );
        check(
          "read success never claims audited save",
          await page.locator(".org-admin-notice").count(),
          0,
        );
        check(
          "recovery request once",
          requests.filter(
            (r) => r.phase === "recovery" && r.key === "GET /api/v1/org/admin/summary",
          ).length,
          1,
        );
        if (mode === "review") await shot("restored");
        hold("unfocused");
        await name.focus();
        await refresh.dispatchEvent("click");
        await page.waitForSelector('.org-admin-center[aria-busy="true"]');
        check(
          "unfocused trigger does not steal focus",
          await name.evaluate((n) => n === document.activeElement),
        );
        release();
        await page.waitForSelector('.org-admin-center[aria-busy="false"]');
        check(
          "zero writes or request bodies",
          requests.every((r) => r.key.startsWith("GET ") && r.body === null),
        );
        check(
          "only four summary reads",
          requests.filter((r) => r.key === "GET /api/v1/org/admin/summary").length,
          4,
        );
        check(
          "no overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ mode, width, checks, requests });
      } finally {
        release();
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
    kind: "ORG-REFRESH-VUE-C-r1",
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
      "Actual App and original organization read lifecycle with original fixtures; local summary500 failure then successful reread. Review adds only focus wrapper, status semantics, trace disclosure and CSS. No production changes or writes. Original success resets drafts; not a newly approved policy. Theme preference500 fallback, no real permissions, other failures, save or production acceptance.",
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>组织概览刷新状态审核</title><style>body{font:16px/1.7 sans-serif;margin:24px;background:#f3f6fb;color:#172d4c}img{max-width:100%}article{margin:32px 0}</style><h1>组织概览 · 刷新状态实际 Vue</h1><p>本地测试样例，待审核；只核对展示区域，不代表保存、真实权限、其他页面或生产验收。</p><a href="evidence.json">机器证据</a>' +
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
