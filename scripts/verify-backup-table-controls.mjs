import assert from "node:assert/strict";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { chromium } from "playwright";
import { backupPagePlugin, backupPageSources } from "./lib/backup-page-preview.mjs";
import { backupReviewFixtures, backupFixtureFile } from "./lib/backup-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length ? path.resolve(`output/playwright/p64-table-controls-${args[1]}`) : null;
if (output) await mkdir(output);
const { fixture, nav: navigationFixture } = await backupReviewFixtures(),
  probe = reservePort();
const envelope = (data) => ({
  data,
  request_id: "p64-focus-fixture",
  trace_id: "p64-focus-fixture",
});
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [backupPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
    ...backupPageSources,
    backupFixtureFile,
    "scripts/lib/backup-review-fixtures.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "scripts/verify-backup-table-controls.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "apps/web/vite.config.ts",
  ]),
  images = [],
  results = [];
const hash = (b) => createHash("sha256").update(b).digest("hex");
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P64 table controls ${origin}`);
  const outcomes = await Promise.allSettled(
    [1440, 1024, 768, 390].flatMap((width) =>
      ["reduce", "no-preference"].map(async (motion) => {
        const context = await browser.newContext({
            viewport: { width, height: width === 390 ? 844 : 1000 },
            locale: "zh-CN",
            reducedMotion: motion,
          }),
          page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [];
        let mode = "success",
          held,
          checks = 0;
        context.setDefaultTimeout(8000);
        const check = (a, b, label) => {
          assert.deepEqual(a, b, `${width}/${motion}: ${label}`);
          checks++;
        };
        const failure = {
          status: 400,
          json: {
            error: {
              code: "local_focus_read_failed",
              message: "本地读取失败",
              action_hint: "本地样例：重新核验读取。",
            },
            request_id: "p64-focus-failed",
          },
        };
        const capture = async (name, locator) => {
          if (motion !== "reduce") return;
          await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
          const box = await locator.boundingBox(),
            viewport = page.viewportSize();
          assert.ok(box && viewport);
          const x = Math.max(0, box.x - 6),
            y = Math.max(0, box.y - 6);
          const clip = {
            x,
            y,
            width: Math.min(viewport.width, box.x + box.width + 6) - x,
            height: Math.min(viewport.height, box.y + box.height + 6) - y,
          };
          assert.equal(
            await locator.evaluate((el) =>
              Array.from(el.querySelectorAll("button"))
                .filter((button) => button.checkVisibility())
                .every((button) => {
                  const rect = button.getBoundingClientRect();
                  return button.contains(
                    document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
                  );
                }),
            ),
            true,
            "captured buttons are not obscured",
          );
          const isMenu = await locator.evaluate((el) => el.tagName === "FIELDSET");
          if (isMenu)
            assert.deepEqual(
              await locator.evaluate((el) =>
                Array.from(el.querySelectorAll("legend,input,label"))
                  .filter((item) => item.checkVisibility())
                  .filter((item) => {
                    const r = item.getBoundingClientRect();
                    return (
                      r.top < 0 ||
                      r.bottom > innerHeight ||
                      !item.contains(
                        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
                      )
                    );
                  })
                  .map((item) => item.getAttribute("aria-label") || item.textContent.trim()),
              ),
              [],
              "menu capture content not occluded",
            );
          if (!output) return;
          const b = isMenu
              ? await locator.screenshot({ animations: "disabled" })
              : await page.screenshot({ animations: "disabled", clip }),
            file = `${width}-${name}.png`;
          await writeFile(path.join(output, file), b);
          images.push({
            file,
            sha256: hash(b),
            pixelWidth: b.readUInt32BE(16),
            pixelHeight: b.readUInt32BE(20),
          });
        };
        try {
          page.on("pageerror", (e) => errors.push(e.message));
          await page.route("**/*", async (route) => {
            const req = route.request(),
              url = new URL(req.url()),
              key = req.method() + " " + url.pathname;
            if (url.origin !== origin) {
              unexpected.push("external");
              return route.abort();
            }
            if (!url.pathname.startsWith("/api/")) return route.continue();
            if (key === "GET /api/v1/me/navigation")
              return route.fulfill({ json: envelope(navigationFixture) });
            if (key === "GET /api/v1/auth/session-status")
              return route.fulfill({ json: envelope({ authenticated: true }) });
            if (key === "GET /api/v1/me/ui-preferences")
              return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
            if (key !== "GET /api/v1/platform/operations/backup-recovery" || url.search) {
              unexpected.push(key);
              return route.abort();
            }
            requests.push({ mode, body: req.postData() });
            if (mode === "hold") {
              held = route;
              return;
            }
            return route.fulfill(mode === "failure" ? failure : { json: envelope(fixture) });
          });

          await page.goto(origin + "/platform-admin/operations");
          const surface = page.locator(".backup-center--review"),
            assets = surface.locator("#p64-assets"),
            controls = assets.locator(".table-view-controls"),
            toolbar = controls.locator(".table-view-controls__toolbar"),
            table = controls.locator("table"),
            summary = toolbar.locator("summary"),
            menu = toolbar.locator("fieldset"),
            freeze = toolbar.getByRole("button"),
            density = toolbar.getByRole("combobox"),
            boxes = menu.getByRole("checkbox");
          await assets.waitFor();
          const hit = async (locator) =>
            locator.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            });
          const visibleLabels = async () =>
            table
              .locator("thead th")
              .evaluateAll((cells) =>
                cells.filter((c) => !c.hidden).map((c) => c.textContent.trim()),
              );
          const expected = ["对象", "角色", "区域", "数量", "体积", "完整性", "技术信息"];
          const frozenLabels = async () =>
            table.locator("thead .table-view-controls__frozen").allTextContents();
          if (width === 390) {
            check(await toolbar.isVisible(), false, "mobile has no hidden desktop toolbar");
            check(
              await assets.locator(".responsive-data-view__mobile button").count(),
              1,
              "mobile detail remains available",
            );
            await capture("mobile-assets", assets);
          } else {
            check(await toolbar.isVisible(), true, "desktop toolbar visible");
            check(await visibleLabels(), expected, "all seven columns initially visible");
            check(await frozenLabels(), ["对象"], "first visible column initially frozen");
            check(await freeze.getAttribute("aria-pressed"), "true", "freeze state announced");
            check(
              await table.getAttribute("data-table-density"),
              "standard",
              "initial standard density",
            );
            await capture("default-toolbar", toolbar);
            await summary.focus();
            await page.keyboard.press("Enter");
            await menu.waitFor();
            check(await boxes.count(), 7, "all column checkboxes exist");
            for (let i = 0; i < 7; i++) {
              check(
                await boxes.nth(i).getAttribute("aria-label"),
                `切换第 ${i + 1} 列`,
                "existing checkbox name",
              );
              const id = await boxes.nth(i).getAttribute("aria-describedby");
              check(
                await menu.locator(`[id="${id}"]`).innerText(),
                expected[i],
                "column description is attached",
              );
              check(
                await menu
                  .locator(`[id="${id}"]`)
                  .evaluate(
                    (el) =>
                      el.tagName === "LABEL" &&
                      el.control?.id === el.htmlFor &&
                      el.getBoundingClientRect().height >= 44,
                  ),
                true,
                "full native label target",
              );
            }
            check(
              await boxes.first().evaluate((el) => el.getBoundingClientRect().width),
              20,
              "checkbox graphic stays compact",
            );
            await capture("columns-open", menu);
            await boxes.nth(0).focus();
            await page.keyboard.press("Space");
            await page.waitForFunction(
              () => document.querySelector("#p64-assets th")?.hidden === true,
            );
            check(await visibleLabels(), expected.slice(1), "Space hides first column");
            check(await frozenLabels(), ["角色"], "freeze follows first visible column");
            await capture("first-hidden", menu);
            await menu.locator("label").first().click();
            check(await boxes.first().isChecked(), true, "clicking native label restores checkbox");
            await menu.locator("label").first().click();
            check(await boxes.first().isChecked(), false, "clicking label toggles once");
            for (let i = 1; i < 6; i++) await boxes.nth(i).uncheck();
            check(await visibleLabels(), ["技术信息"], "one visible column remains");
            check(await boxes.nth(6).isChecked(), true, "last visible remains selected");
            check(await boxes.nth(6).isDisabled(), true, "last visible native disabled");
            check(await frozenLabels(), ["技术信息"], "last column can be frozen");
            await boxes.nth(6).scrollIntoViewIfNeeded();
            check(await hit(boxes.nth(6)), true, "last disabled checkbox is not occluded");
            await capture("last-column", menu);
            await boxes.nth(0).check();
            check(
              await boxes.nth(6).isDisabled(),
              false,
              "restoring column enables former last toggle",
            );
            for (let i = 1; i < 6; i++) await boxes.nth(i).check();
            check(await visibleLabels(), expected, "all columns restored");
            await summary.focus();
            await page.keyboard.press("Enter");
            check(await menu.isVisible(), false, "Enter closes disclosure");
            const standard = await table
              .locator("tbody td")
              .first()
              .evaluate((el) => getComputedStyle(el).paddingTop);
            await density.selectOption("compact");
            check(
              await table.getAttribute("data-table-density"),
              "compact",
              "compact selection applied",
            );
            await page.waitForFunction(
              () =>
                getComputedStyle(document.querySelector("#p64-assets tbody td")).paddingTop ===
                "6px",
              null,
              { timeout: 8000 },
            );
            const compact = await table
              .locator("tbody td")
              .first()
              .evaluate((el) => getComputedStyle(el).paddingTop);
            check(
              parseFloat(compact) < parseFloat(standard),
              true,
              "compact changes actual cell spacing",
            );
            await capture("compact", controls);
            await freeze.focus();
            await page.keyboard.press("Space");
            check(await freeze.getAttribute("aria-pressed"), "false", "keyboard removes freeze");
            check(await frozenLabels(), [], "all frozen cells removed");
            await capture("unfrozen", controls);
            await page.keyboard.press("Enter");
            check(await freeze.getAttribute("aria-pressed"), "true", "keyboard restores freeze");
            const scroller = controls.locator(".table-view-controls__content");
            await scroller.evaluate((el) => {
              el.scrollLeft = el.scrollWidth;
            });
            check(
              await table
                .locator("th")
                .first()
                .evaluate((el) => getComputedStyle(el).position),
              "sticky",
              "freeze uses sticky positioning",
            );
            check(
              await hit(table.locator("th").first()),
              true,
              "frozen first column stays visible after horizontal scroll",
            );
            await capture("frozen-scrolled", controls);
            await scroller.evaluate((el) => {
              el.scrollLeft = 0;
            });
            await density.selectOption("standard");
            await page.waitForFunction(
              () =>
                getComputedStyle(document.querySelector("#p64-assets tbody td")).paddingTop ===
                "12px",
              null,
              { timeout: 8000 },
            );
            check(
              await table
                .locator("tbody td")
                .first()
                .evaluate((el) => getComputedStyle(el).paddingTop),
              standard,
              "standard spacing restores",
            );
            const technical = table.locator("tbody details");
            await technical.locator("summary").focus();
            await page.keyboard.press("Enter");
            check(
              await technical.locator("dd").allTextContents(),
              ["mysql_full", "primary_backup"],
              "original technical codes retained",
            );
            await capture("technical", controls);
            await surface.getByRole("button", { name: "刷新事实", exact: true }).click();
            await surface.getByRole("button", { name: "刷新事实", exact: true }).waitFor();
            check(await visibleLabels(), expected, "refresh keeps seven-column content");
            check(
              await table.getAttribute("data-table-density"),
              "standard",
              "refresh does not change presentation choice",
            );
            check(requests.length, 2, "only explicit refresh dispatches a second read");
          }
          check(unexpected, [], "controls do not persist or write");
          check(errors, [], "no browser errors");
          results.push({ width, motion, checks, requests });
          console.log(JSON.stringify({ width, motion, checks, reads: requests.length }));
        } finally {
          if (held) await held.abort().catch(() => {});
          await context.close();
        }
      }),
    ),
  );
  const failures = outcomes.filter((o) => o.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((o) => o.reason),
      "P64 table checks failed",
    );
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const f = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css|json)$/.test(f))
      sources.add(f);
  }
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  images.sort((a, b) => a.file.localeCompare(b.file));
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all([...sources].sort().map(async (f) => [f, hash(await readFile(f))])),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P64",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue local table control checks; no real backup/restore or permission acceptance",
          sources: sourceHashes,
          images,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      path.join(output, "index.html"),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P64表格控件审核</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P64表格控件局部待审</h1><p>本地样例；不代表真实权限、恢复或全页验收。</p>' +
        images
          .map(
            (i) =>
              `<article><h2>${i.file}</h2><img src="${i.file}" alt="${i.file} 待审"></article>`,
          )
          .join("\n") +
        "</html>",
    );
  }
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((sum, r) => sum + r.checks, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
