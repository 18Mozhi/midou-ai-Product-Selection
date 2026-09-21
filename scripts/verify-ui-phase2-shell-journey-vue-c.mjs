import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { shellReviewCss, shellReviewModule } from "./lib/ui-phase2-shell-vue-preview.mjs";
import {
  buildShellJourneyFixture,
  journeyCompositionCss,
  journeyFixtureFile,
  previewShellJourney,
} from "./lib/ui-phase2-shell-journey-vue-data.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
assert.ok(process.argv.slice(2).length <= 1);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const output = "output/playwright/shell-journey-vue-c-r3";
const shellFile = "apps/web/src/components/NavigationShell.vue";
const journeyFile = "apps/web/src/components/SelectionJourney.vue";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = await read(shellFile),
  replacement = previewShellJourney(source);
const fixture = await buildShellJourneyFixture();
const sources = new Set([
  shellFile,
  journeyFile,
  journeyFixtureFile,
  shellReviewCss,
  shellReviewModule,
  journeyCompositionCss,
  "scripts/verify-ui-phase2-shell-journey-vue-c.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/ui-phase2-shell-journey-vue-data.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [],
  ports = [];
if (capture) await mkdir(output);
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
                name: "shell-journey-vue-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(shellFile).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: replacement, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="shell-vue-c shell-journey-vue-c">')
                    .replace(
                      "</head>",
                      [shellReviewCss, journeyCompositionCss]
                        .map(
                          (css) =>
                            `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}">`,
                        )
                        .join("") + "</head>",
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`Shell journey Vue ${mode} ${origin}`);
    for (const width of mode === "baseline" || smoke ? [390, 1440] : [390, 840, 841, 1440]) {
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
        let journey = structuredClone(fixture.journey),
          reads = 0;
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}: ${name}`);
          checks.push({ name, actual });
        };
        const shot = async (scene, target = "full") => {
          check(
            `${scene} no page overflow`,
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          if (!capture) return;
          await page.evaluate(() => document.fonts.ready);
          if (target !== "gates") await page.evaluate(() => window.scrollTo(0, 0));
          else {
            await page
              .locator(".selection-quality-gates")
              .evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
            assert.ok(
              await page.locator(".selection-quality-gates").evaluate((node) => {
                const r = node.getBoundingClientRect();
                return [r.top + 2, r.bottom - 2].every((y) =>
                  node.contains(document.elementFromPoint(r.x + r.width / 2, y)),
                );
              }),
              "Gate crop must be unobscured by fixed navigation",
            );
          }
          const bytes =
            target === "gates"
              ? await page
                  .locator(".selection-quality-gates")
                  .screenshot({ animations: "disabled" })
              : await page.screenshot({ fullPage: target === "full", animations: "disabled" });
          const file = `${mode}-${width}-${scene}.png`;
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            mode,
            width,
            scene,
            target,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", (route) => {
          const req = route.request(),
            url = new URL(req.url()),
            key = `${req.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          requests.push({ key, search: url.search, body: req.postData() });
          let value;
          if (key === "GET /api/v1/me/navigation" && url.searchParams.get("shell") === "member")
            value = fixture.navigation;
          else if (key === "GET /api/v1/auth/session-status") value = { authenticated: true };
          else if (key === "GET /api/v1/me/ui-preferences")
            value = { theme: "deep-ocean", version: 1 };
          else if (key === `GET /api/v1/selection-journeys/${journey.id}`) {
            reads++;
            value = journey;
          } else {
            unexpected.push(key);
            return route.abort();
          }
          return route.fulfill({
            json: { data: value, request_id: "ui2-journey-request", trace_id: "ui2-journey-trace" },
          });
        });
        await page.goto(origin + "/opportunities/start");
        await page.waitForSelector('.role-shell[data-state="ready"] .selection-start');
        check(
          "actual member shell",
          await page.locator(".role-shell").getAttribute("data-shell"),
          "member",
        );
        check("one original authorized menu", await page.locator(".role-nav-menu a").count(), 1);
        check(
          "no borrowed organization name",
          await page
            .locator(".role-content")
            .textContent()
            .then((text) => text.includes("未命名组织")),
        );
        check(
          "four actual source stages",
          await page.locator(".selection-stage-rail li").count(),
          4,
        );
        await page.getByLabel("商品关键词", { exact: true }).fill("组合审核草稿");
        await shot("input-overview", "viewport");
        if (mode === "review") {
          check(
            "content beside sidebar and in first viewport",
            await page.evaluate(() => {
              const rect = document.querySelector(".role-content").getBoundingClientRect();
              const frame = document
                .querySelector(".role-navigation-frame")
                .getBoundingClientRect();
              return rect.y < 150 && (innerWidth <= 840 || rect.x >= frame.right - 1);
            }),
          );
          if (width <= 840) {
            check(
              "old fluorescent context accent removed",
              await page
                .locator(".role-context-drawer > summary")
                .evaluate((node) => parseFloat(getComputedStyle(node).borderLeftWidth)),
              0,
            );
            check(
              "mobile columns equal visible action count",
              await page
                .locator(".role-mobile-nav")
                .evaluate(
                  (node) =>
                    getComputedStyle(node).gridTemplateColumns.split(" ").length ===
                    node.children.length,
                ),
            );
            check(
              "only one mobile current item",
              await page.locator('.role-mobile-nav [aria-current="page"]').count(),
              1,
            );
          }
          await shot("input-full");
        }
        if (!smoke) {
          await page.evaluate(({ key, id }) => localStorage.setItem(key, id), {
            key: fixture.storageKey,
            id: journey.id,
          });
          await page.reload();
          await page.waitForSelector(".selection-decision");
          check("one stored-id read", reads, 1);
          const adopt = page.getByRole("radio", { name: "采纳合格机会", exact: true });
          check("selection required before adoption", await adopt.isDisabled());
          check(
            "unselected gates are unknown",
            await page.locator('.selection-quality-gates dd[data-passed="true"]').count(),
            0,
          );
          await shot("candidate-unselected");
          await page.getByText("隔离候选 2", { exact: true }).click();
          check(
            "five individual gates pass",
            await page.locator('.selection-quality-gates dd[data-passed="true"]').count(),
            5,
          );
          check("qualified adoption available", await adopt.isEnabled());
          await page.getByLabel("决策原因", { exact: true }).fill("已核对来源，保留审核草稿");
          await adopt.check();
          await shot("qualified-five-gates");
          if (mode === "review") {
            await shot("qualified-gate-region", "gates");
            const before = await page.locator(".selection-journey").innerText();
            if (width <= 840) {
              await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
              await page.waitForSelector(".role-navigation-frame:modal");
              await shot("navigation-open", "viewport");
              await page.keyboard.press("Escape");
              check(
                "menu close restores original opener",
                await page
                  .getByRole("button", { name: "打开导航菜单", exact: true })
                  .evaluate((node) => node === document.activeElement),
              );
            }
            check(
              "navigation does not alter candidate facts",
              await page.locator(".selection-journey").innerText(),
              before,
            );
            check(
              "decision draft preserved across navigation disclosure",
              await page.getByLabel("决策原因", { exact: true }).inputValue(),
              "已核对来源，保留审核草稿",
            );
          }
          for (const [gate, label] of [
            ["score", "评分"],
            ["market", "市场"],
            ["competition", "竞争"],
            ["cost", "成本"],
            ["risk", "风险"],
          ]) {
            journey = structuredClone(fixture.journey);
            journey.results[1].quality_gates[gate] = false; // Same stale aggregate test as UI2-J07.
            await page.reload();
            await page.waitForSelector(".selection-decision");
            await page.getByText("隔离候选 2", { exact: true }).click();
            check(`${gate} alone blocks adoption despite aggregate true`, await adopt.isDisabled());
            check(
              `${gate} shows four actual passed gates`,
              await page.locator('.selection-quality-gates dd[data-passed="true"]').count(),
              4,
            );
            check(
              `${gate} explains missing gate`,
              (await page.locator(".selection-quality-gates").textContent()).includes(label),
            );
            if (mode === "review") await shot(`missing-${gate}`, "gates");
          }
          check("one read for each reload", reads, 6);
          const reset = page.getByRole("button", { name: "开始下一次", exact: true });
          await reset.scrollIntoViewIfNeeded();
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
          check(
            "last action reachable above fixed navigation",
            await reset.evaluate((node) => {
              const r = node.getBoundingClientRect();
              return node.contains(
                document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
              );
            }),
          );
          await page.evaluate((key) => localStorage.removeItem(key), fixture.storageKey);
        }
        check(
          "no write or request body",
          requests.every((item) => item.key.startsWith("GET ") && item.body === null),
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
    kind: "SHELL-JOURNEY-ACTUAL-VUE-C-r3",
    reviewOnly: true,
    userReview: "pending",
    processesClosed: true,
    runs,
    screenshots,
    ports,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    boundary:
      "Actual App/Router/NavigationShell/SelectionJourney; new shell and horizontal stages are review-only. Original UI2-J fixture guard, one authorized menu, no grants or writes. All five individual gates tested with stale aggregate true. No real collection/decision writes, account/discovery/theme overlays, route-leave draft retention, production permissions or full-page acceptance.",
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C 成员壳与创建选品实际 Vue</title><style>body{font:16px/1.7 sans-serif;margin:24px;background:#f3f6fb;color:#172d4c}img{max-width:100%;height:auto}article{margin:32px 0}a{color:#244bb0}</style><h1>C 成员壳 × 创建选品 · 实际 Vue 装配</h1><p>待审核；本地原测试样例。baseline 是未变换 App，review 是新全局壳与横向阶段栏提案。五项质量门与所有生产 P16 代码不变，不代表真实采纳或完整生产验收。</p><a href="evidence.json">机器证据</a>' +
        screenshots
          .map(
            (shot) =>
              `<article><h2>${shot.mode} / ${shot.width} / ${shot.scene} / ${shot.target}</h2><a href="${shot.file}"><img loading="lazy" alt="${shot.mode} ${shot.width} ${shot.scene}" src="${shot.file}"></a></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, run) => n + run.checks.length, 0),
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
