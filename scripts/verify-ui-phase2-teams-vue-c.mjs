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
import { buildShellOrgFixture, orgFixtureFile } from "./lib/ui-phase2-shell-org-fixture.mjs";
import { buildTeamsDesignData } from "./lib/ui-phase2-teams-design-data.mjs";
import { previewTeamsVue, teamsVueFile, teamsVueCss } from "./lib/ui-phase2-teams-vue-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(
  process.argv.slice(2).length <= 1 &&
    process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)),
);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const output = "output/playwright/p33-teams-vue-c-r4";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const shellFile = "apps/web/src/components/NavigationShell.vue";
const originals = new Map(
  await Promise.all([shellFile, teamsVueFile].map(async (file) => [file, await read(file)])),
);
const replacements = new Map([
  [shellFile, previewShellVue(originals.get(shellFile))],
  [teamsVueFile, previewTeamsVue(originals.get(teamsVueFile))],
]);
const fixture = await buildShellOrgFixture(),
  teams = await buildTeamsDesignData(process.cwd());
const sources = new Set([
  ...originals.keys(),
  shellReviewCss,
  shellReviewModule,
  teamsVueCss,
  orgFixtureFile,
  "scripts/verify-ui-phase2-teams-vue-c.mjs",
  "scripts/lib/ui-phase2-teams-vue-preview.mjs",
  "scripts/lib/ui-phase2-teams-design-data.mjs",
  "scripts/lib/ui-phase2-shell-org-fixture.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/api/src/organization-admin-service.ts",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [],
  ports = [];
if (capture) await mkdir(output); // Exclusive permanent review package; no overwrite.
let browser, server;
try {
  browser = await chromium.launch();
  for (const mode of smoke ? ["review"] : ["baseline", "review"]) {
    const reservation = reservePort();
    await new Promise((done) => reservation.listen(0, "127.0.0.1", done));
    const port = reservation.address().port;
    await new Promise((done) => reservation.close(done));
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
                name: "teams-c-actual-vue-review",
                enforce: "pre",
                transform(text, id) {
                  const file = path.relative(process.cwd(), id).replaceAll("\\", "/");
                  if (!replacements.has(file)) return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), originals.get(file));
                  return { code: replacements.get(file), map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="shell-vue-c teams-vue-c">')
                    .replace(
                      "</head>",
                      [shellReviewCss, teamsVueCss]
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
    console.log(JSON.stringify({ mode, origin }));
    for (const width of smoke ? [390] : mode === "baseline" ? [390, 1440] : [390, 840, 841, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          checks = [],
          requests = [],
          unexpected = [],
          errors = [];
        page.setDefaultTimeout(15000);
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}: ${name}`);
          checks.push({ name, actual });
        };
        const shot = async (scene, selector) => {
          if (!capture) return;
          await page.evaluate(() => document.fonts.ready);
          // Region proof uses a taller viewport so fixed navigation does not cover controls.
          // Interaction checks continue at the original 1000px height after each capture.
          const captureHeight = selector
            ? Math.max(1000, Math.ceil((await page.locator(selector).boundingBox()).height) + 300)
            : 1000;
          assert.ok(captureHeight <= 4000, "Inspect unusually long P33 region before capture");
          await page.setViewportSize({ width, height: captureHeight });
          if (selector) {
            await page.locator(selector).scrollIntoViewIfNeeded();
            await page.locator(selector).evaluate((n) =>
              scrollTo({
                top: scrollY + n.getBoundingClientRect().top - 100,
                behavior: "instant",
              }),
            );
          } else await page.evaluate(() => scrollTo(0, 0));
          if (selector && selector !== ".audited-reason-dialog" && width <= 840) {
            check(
              scene + " region not covered by fixed navigation",
              await page.locator(selector).evaluate((n) => {
                const bar = document.querySelector(".role-mobile-nav"),
                  target = n.getBoundingClientRect();
                if (!bar || !bar.getClientRects().length) return true;
                const nav = bar.getBoundingClientRect();
                return (
                  target.bottom <= nav.top ||
                  target.top >= nav.bottom ||
                  target.right <= nav.left ||
                  target.left >= nav.right
                );
              }),
            );
          }
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
            captureViewport: { width, height: captureHeight },
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
          await page.setViewportSize({ width, height: 1000 });
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
          requests.push({ key, body: req.postData() });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({ status: 500, json: {} });
          const values = {
            "GET /api/v1/me/navigation?shell=organization_admin": fixture.navigation,
            "GET /api/v1/auth/session-status": { authenticated: true },
            "GET /api/v1/org/admin/summary": fixture.summary,
            "GET /api/v1/org/admin/teams": teams.teamRows,
            "GET /api/v1/org/admin/members": teams.members,
          };
          if (!(key in values)) {
            unexpected.push(key);
            return route.abort();
          }
          return route.fulfill({
            json: { data: values[key], request_id: "teams-vue-local", trace_id: "teams-vue-local" },
          });
        });
        await page.goto(origin + "/org-admin/teams");
        await page.waitForSelector('.role-shell[data-state="ready"] .org-team-panel');
        const panel = page.locator(".org-team-panel"),
          directory = panel.locator(".org-team-directory"),
          detail = panel.locator(".org-team-detail");
        const rows = panel.locator(".org-team-list button");
        const countRows = async (n) => {
          await page.waitForFunction(
            (count) => document.querySelectorAll(".org-team-list button").length === count,
            n,
          );
          check(`page rows ${n}`, await rows.count(), n);
        };
        // Baseline buttons themselves have role=listitem; CSS selectors keep this real defect observable.
        await countRows(8);
        check("six actual metrics", await panel.locator(".org-team-metrics b").allTextContents(), [
          "10",
          "9",
          "1",
          "13",
          "5",
          "4",
        ]);
        check(
          "no page overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        await shot("default");
        await shot("directory", ".org-team-directory");
        if (mode === "review") {
          check(
            "native list buttons",
            await rows.evaluateAll((nodes) =>
              nodes.every((n) => !n.hasAttribute("role") && n.parentElement.tagName === "LI"),
            ),
          );
          check(
            "blue page index",
            await panel
              .locator(".teams-c-index")
              .evaluate((n) => getComputedStyle(n).backgroundColor),
            "rgb(37, 74, 156)",
          );
          check(
            "team canvas is cool, not legacy cream",
            await panel.evaluate((n) => getComputedStyle(n).backgroundColor),
            "rgb(243, 246, 251)",
          );
          check(
            "status group has no legacy frame",
            await panel
              .locator(".org-team-status-tabs")
              .evaluate((n) => [
                getComputedStyle(n).backgroundColor,
                getComputedStyle(n).borderTopWidth,
              ]),
            ["rgba(0, 0, 0, 0)", "0px"],
          );
          check(
            "workflow labels have no legacy border",
            await panel
              .locator(".org-team-list em")
              .evaluateAll((nodes) =>
                nodes.every((n) => getComputedStyle(n).borderTopWidth === "0px"),
              ),
          );
          check(
            "index links target real regions",
            await panel
              .locator(".teams-c-index a")
              .evaluateAll((nodes) =>
                nodes.every((n) => !!document.querySelector(n.getAttribute("href"))),
              ),
          );
          await shot("collaboration", ".org-team-detail");
        }
        await directory.getByRole("button", { name: "下一页", exact: true }).click();
        await countRows(2);
        await rows.last().click();
        check(
          "archived team selected",
          await detail.locator("h3").textContent(),
          teams.teamRows[9].name,
        );
        check(
          "archived membership remains actionable",
          await detail.getByRole("button", { name: "分配成员", exact: true }).isEnabled(),
        );
        await directory.locator('input[type="search"]').fill("workflow-10");
        await countRows(1);
        await directory.getByRole("button", { name: "重置筛选", exact: true }).click();
        await countRows(8);
        await rows.nth(1).click();
        await detail.getByRole("button", { name: "分配成员", exact: true }).click();
        await page.waitForSelector(".org-team-membership small[role=status]");
        check(
          "missing member stays local",
          await detail.locator("small[role=status]").textContent(),
          "请先选择一位当前组织的活动成员。",
        );
        check(
          "original active members include locked account",
          await panel.locator("#team-member-select option").count(),
          4,
        );
        await panel.locator("#team-member-select").selectOption(teams.members.items[1].id);
        for (const action of ["分配成员", "移除成员"]) {
          await detail.getByRole("button", { name: action, exact: true }).click();
          const dialog = page.locator(".audited-reason-dialog:modal");
          await dialog.waitFor();
          check(
            action + " reason has no default maximum",
            await dialog.locator("textarea").getAttribute("maxlength"),
            null,
          );
          if (mode === "review")
            await shot(
              action === "分配成员" ? "assign-reason" : "remove-reason",
              ".audited-reason-dialog",
            );
          await dialog.getByRole("button", { name: "取消", exact: true }).click();
          await page.waitForFunction(() => !document.querySelector(".audited-reason-dialog:modal"));
        }
        await panel
          .locator(".org-team-overview")
          .getByRole("button", { name: "新建团队", exact: true })
          .click();
        const form = panel.locator(".org-team-create");
        await form.waitFor();
        if (mode === "review")
          check(
            "create fields have white background, not inherited warning color",
            await form
              .locator(".org-team-create-grid")
              .evaluate((n) => getComputedStyle(n).backgroundColor),
            "rgb(255, 255, 255)",
          );
        await page.waitForFunction(() => document.activeElement?.id === "team-name");
        check(
          "original name maximum",
          await form.locator("#team-name").getAttribute("maxlength"),
          "120",
        );
        check(
          "original reason maximum",
          await form.locator("#team-reason").getAttribute("maxlength"),
          "500",
        );
        check(
          "original workflow maximum",
          await form.locator("#team-workflow").getAttribute("maxlength"),
          "80",
        );
        await form.locator("#team-name").fill("本地团队布局审核");
        await form.locator("#team-reason").fill("仅供审核，不提交创建");
        await shot("create", ".org-team-create");
        check(
          "form inside viewport horizontally",
          await form.evaluate((n) => {
            const r = n.getBoundingClientRect();
            return r.left >= 0 && r.right <= innerWidth + 1;
          }),
        );
        await form.getByRole("button", { name: "取消", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector(".org-team-create"));
        await directory.locator('input[type="search"]').fill("没有匹配的团队审核词");
        await page.waitForSelector(".org-team-directory .org-team-empty");
        if (mode === "review") await shot("filtered-empty", ".org-team-directory .org-team-empty");
        check(
          "filter preserves selected team",
          await detail.locator("h3").textContent(),
          teams.teamRows[1].name,
        );
        await directory.getByRole("button", { name: "清除筛选", exact: true }).click();
        await countRows(8);
        check(
          "one teams read",
          requests.filter((r) => r.key === "GET /api/v1/org/admin/teams").length,
          1,
        );
        check(
          "GET only, no bodies",
          requests.every((r) => r.key.startsWith("GET ") && r.body === null),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ mode, width, checks, requests });
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
    kind: "P33-ACTUAL-VUE-C-r4",
    reviewOnly: true,
    approval: "pending-user-review",
    runs,
    screenshots,
    ports,
    processesClosed: true,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    transformedHashes: Object.fromEntries(
      [...replacements].map(([file, code]) => [file, hash(code)]),
    ),
    boundary:
      "Actual App/router/organization parent/team Vue; local original ten-row fixture, no writes. Review adds layout, CSS and native list semantics only; current team script/events/models preserved. Shared reason dialogs unchanged, not redesigned. OG-G02 remains; no production, permissions, theme matrix, full lifecycle or user acceptance proof.",
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P33 真实Vue C审核</title><style>body{font:16px/1.6 sans-serif;margin:24px;background:#edf1f6;color:#202c3d}img{max-width:100%;height:auto}article{margin:32px 0}</style><h1>P33 团队 · 实际Vue C组合</h1><p>本地样例，待审核。default为1000px高首屏；区域截图临时加高视口以避开固定导航，尺寸详见证据。交互仍在1000px高视口验证，不代表全部短屏。原因窗沿用当前组件，不是新设计。</p><a href="evidence.json">来源与验证证据</a>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.mode} / ${s.width} / ${s.scene}</h2><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.mode} ${s.width} ${s.scene}"></a></article>`,
          )
          .join(""),
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
