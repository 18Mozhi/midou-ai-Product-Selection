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
import { previewOrgReadState, orgReadStateCss } from "./lib/ui-phase2-org-read-state-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
assert.ok(process.argv.slice(2).length <= 1);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const output = "output/playwright/org-read-state-vue-c-r1";
const shell = "apps/web/src/components/NavigationShell.vue";
const orgComponent = "apps/web/src/components/OrganizationAdminCenter.vue";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = await read(shell),
  replacement = previewShellVue(source),
  fixture = await buildShellOrgFixture();
const orgSource = await read(orgComponent),
  orgReplacement = previewOrgReadState(orgSource);
const sources = new Set([
  shell,
  orgComponent,
  shellReviewCss,
  shellReviewModule,
  orgFixtureFile,
  orgReviewCss,
  orgRefreshCss,
  orgReadStateCss,
  "scripts/lib/ui-phase2-org-read-state-preview.mjs",
  "scripts/lib/ui-phase2-org-refresh-preview.mjs",
  "scripts/verify-ui-phase2-org-read-state-vue-c.mjs",
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
      plugins: [
        {
          name: "org-summary-c-review-only",
          enforce: "pre",
          transform(text, id) {
            if (id.replaceAll("\\", "/") === path.resolve(orgComponent).replaceAll("\\", "/")) {
              assert.equal(text.replaceAll("\r\n", "\n"), orgSource);
              return {
                code: mode === "baseline" ? previewOrgRefresh(orgSource) : orgReplacement,
                map: null,
              };
            }
            if (id.replaceAll("\\", "/") !== path.resolve(shell).replaceAll("\\", "/")) return null;
            assert.equal(text.replaceAll("\r\n", "\n"), source);
            return { code: replacement, map: null };
          },
          transformIndexHtml(html) {
            return html
              .replace("<body>", '<body class="shell-vue-c org-refresh-c org-read-state-c">')
              .replace(
                "</head>",
                [
                  shellReviewCss,
                  orgReviewCss,
                  orgRefreshCss,
                  ...(mode === "review" ? [orgReadStateCss] : []),
                ]
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

    const cases = (smoke ? [403] : [401, 403, 409, 429, 500, 503])
      .map((status) => ({ status, entry: "initial" }))
      .concat((smoke ? [403] : [401, 403]).map((status) => ({ status, entry: "background" })));
    for (const scene of cases)
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
            assert.deepEqual(
              actual,
              expected,
              `${mode}/${scene.entry}/${scene.status}/${width}: ${name}`,
            );
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
          const shot = async (name, selector) => {
            if (!capture) return;
            if (selector)
              await page.locator(selector).evaluate((n) => n.scrollIntoView({ block: "center" }));
            else await page.evaluate(() => scrollTo(0, 0));
            await page.evaluate(() => document.fonts.ready);
            const bytes = selector
              ? await page.locator(selector).screenshot({ animations: "disabled" })
              : await page.screenshot({ animations: "disabled" });
            const file = `${mode}-${scene.entry}-${scene.status}-${width}-${name}.png`;
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              mode,
              width,
              entry: scene.entry,
              status: scene.status,
              scene: name,
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
                status: scene.status,
                json: {
                  request_id: `org-read-local-${scene.status}`,
                  trace_id: `org-read-local-${scene.status}`,
                },
              });
            return route.fulfill({
              json: {
                data: values[key],
                request_id: "org-read-local-ok",
                trace_id: "org-read-local-ok",
              },
            });
          });
          if (scene.entry === "initial") hold("failure");
          await page.goto(origin + "/org-admin");
          const center = page.locator(".org-admin-center"),
            heading = page.locator(".org-admin-hero h2");
          if (scene.entry === "background") {
            await page.waitForSelector('.org-admin-center[data-state="ready"]');
            check(
              "initial authorized profile visible",
              await page.locator(".org-admin-profile h3").textContent(),
              fixture.profile.name,
            );
            hold("failure");
            const refresh = page.locator(".org-admin-refresh button");
            await refresh.focus();
            await page.keyboard.press("Enter");
            await page.waitForSelector('.org-admin-center[aria-busy="true"]');
            check(
              "pending background retains facts before rejection",
              await page.locator(".org-admin-metrics article").count(),
              6,
            );
          } else {
            await page.waitForSelector('.org-admin-center[data-state="loading"]');
            check(
              "initial load does not show invented facts",
              await page
                .locator(".org-admin-metrics,.org-admin-profile,.org-admin-grid > form")
                .count(),
              0,
            );
            if (mode === "review" && scene.status === 500) await shot("initial-loading");
          }
          release();
          const expectedState = {
            401: "expired",
            403: "forbidden",
            409: "conflict",
            429: "rate_limited",
            500: "error",
            503: "blocked",
          }[scene.status];
          await page.waitForSelector(
            `.org-admin-center[data-state="${expectedState}"][aria-busy="false"]`,
          );
          check(
            "original HTTP classification",
            await center.getAttribute("data-state"),
            expectedState,
          );
          check(
            "old facts and editing removed",
            await page
              .locator(".org-admin-metrics,.org-admin-profile,.org-admin-grid > form")
              .count(),
            0,
          );
          const leakage = await center.evaluate(
            (n, name) => ({
              name: n.textContent.includes(name),
              timestamp: !!n.querySelector(".org-admin-refresh small"),
            }),
            fixture.profile.name,
          );
          checks.push({ name: "previous metadata observation", actual: leakage });
          const expectedAttempts = [429, 503].includes(scene.status) ? 3 : 1;
          check(
            "original automatic attempts retained",
            requests.filter(
              (r) => r.phase === "failure" && r.key === "GET /api/v1/org/admin/summary",
            ).length,
            expectedAttempts,
          );
          if (mode === "review") {
            check("no stale organization name or update time", leakage, {
              name: false,
              timestamp: false,
            });
            check(
              "single error region no duplicate banner",
              await page.locator(".org-admin-notice").count(),
              0,
            );
            check(
              "error region announced",
              await page.locator(".org-admin-state").getAttribute("role"),
              "alert",
            );
            check(
              "trace initially collapsed",
              await page.locator(".org-admin-state details").evaluate((n) => !n.open),
            );
            await shot("error");
            const disclosure = page.locator(".org-admin-state summary");
            await disclosure.focus();
            await page.keyboard.press("Enter");
            check(
              "keyboard trace reveals original identifier",
              await page.locator(".org-admin-state code").textContent(),
              `org-read-local-${scene.status}`,
            );
            check(
              "trace click height",
              await disclosure.evaluate((n) => n.getBoundingClientRect().height >= 44),
            );
            await shot("trace", ".org-admin-state");
          } else if (scene.entry === "background") await shot("old-metadata");
          hold("recovery");
          const reload = page.locator(".org-admin-state button");
          await reload.focus();
          await page.keyboard.press("Enter");
          await page.waitForSelector('.org-admin-center[data-state="loading"]');
          check(
            "retry hides facts while waiting",
            await page
              .locator(".org-admin-metrics,.org-admin-profile,.org-admin-grid > form")
              .count(),
            0,
          );
          if (mode === "review") {
            check(
              "retry focus stays on persistent heading",
              await heading.evaluate((n) => n === document.activeElement),
            );
            check(
              "loading region has status semantics",
              await page.locator(".org-admin-state").getAttribute("role"),
              "status",
            );
            await shot("retry-loading");
          }
          release();
          await page.waitForSelector('.org-admin-center[data-state="ready"]');
          check(
            "local recovery renders actual original profile",
            await page.locator(".org-admin-profile h3").textContent(),
            fixture.profile.name,
          );
          check(
            "local recovery has six original facts",
            await page.locator(".org-admin-metrics article").count(),
            6,
          );
          check(
            "no error or save success banner after read",
            await page.locator(".org-admin-notice").count(),
            0,
          );
          check(
            "recovery one summary request",
            requests.filter(
              (r) => r.phase === "recovery" && r.key === "GET /api/v1/org/admin/summary",
            ).length,
            1,
          );
          check(
            "no horizontal overflow",
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          check(
            "zero writes or request bodies",
            requests.every((r) => r.key.startsWith("GET ") && r.body === null),
          );
          check("no unexpected network", unexpected, []);
          check("no runtime errors", errors, []);
          runs.push({ mode, width, entry: scene.entry, status: scene.status, checks, requests });
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
    kind: "ORG-READ-STATE-VUE-C-r1",
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
      "Actual App; baseline is prior C refresh proposal, review adds first-read/error presentation and reload focus. Original local guard/profile facts. Initial HTTP401/403/409/429/500/503 and background401/403, original retries, synthetic recovery only. Removes previous stale profile name/time after denial. No production changes, real permissions, saving, draft policy, other roles/routes or production acceptance.",
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>组织概览读取状态审核</title><style>body{font:16px/1.7 sans-serif;margin:24px;background:#f3f6fb;color:#172d4c}img{max-width:100%}article{margin:32px 0}</style><h1>组织概览 · 首次读取与访问状态</h1><p>本地测试样例，待审核；只核对展示区域，不代表保存、真实权限、其他页面或生产验收。</p><a href="evidence.json">机器证据</a>' +
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
