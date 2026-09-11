import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p47-table-tools-review",
  css =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-table-tools-preview.css",
  fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ["navigation", "base", "items"].includes(node.name.getText(ast))
  )
    declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
const box = {};
vm.runInNewContext(
  ts.transpileModule(
    ["navigation", "base", "items"]
      .map((name) => {
        const matches = declarations.filter((node) => node.name.getText(ast) === name);
        assert.equal(matches.length, 1);
        return `const ${name}=${matches[0].initializer.getText(ast)};`;
      })
      .join("\n") + "globalThis.data={navigation,items};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data)),
  sources = new Set([
    fixture,
    css,
    "scripts/verify-ui-phase2-provider-adapter-table-tools.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  comparisons = [],
  ports = [];
let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const mode of ["baseline", "review"]) {
    const reserve = reservePort();
    await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
    const port = reserve.address().port;
    await new Promise((resolve) => reserve.close(resolve));
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
                name: "p47-table-tools-review-only",
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p47-table-tools-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`P47 table tools ${mode} ${origin}`);
    for (const width of [390, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1200 },
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
        let reads = 0;
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}:${name}`);
          checks.push({ name, actual });
        };
        const picture = async (locator, suffix) => {
          if (!capture) return;
          const file = `${mode}-${width}-${suffix}.png`,
            bytes = await locator.screenshot({ animations: "disabled" });
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            mode,
            width,
            suffix,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };
        await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });
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
          if (
            ![
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/provider-adapters",
            ].includes(key)
          ) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: req.postData() });
          if (url.pathname.endsWith("navigation"))
            return route.fulfill({ json: { data: data.navigation, request_id: "nav" } });
          if (url.pathname.endsWith("session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          reads++;
          return route.fulfill({ json: { data: data.items, request_id: "table-tools" } });
        });
        await page.goto(origin + "/platform-admin/providers/adapters");
        const center = page.locator(".adapter-center"),
          controls = center.locator(".table-view-controls"),
          toolbar = controls.locator(".table-view-controls__toolbar"),
          mobile = center.locator(".responsive-data-view__mobile"),
          table = center.locator(".adapter-table-wrap table");
        await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
        if (width === 390) {
          check("desktop controls hidden on mobile", await toolbar.isVisible(), false);
          check("two mobile records remain", await mobile.locator("article").count(), 2);
          await picture(mobile.locator("article").first(), "mobile-unchanged");
        } else {
          await expect(toolbar).toBeVisible();
          await expect(table).toBeVisible();
          const details = toolbar.locator("details"),
            summary = details.locator("summary"),
            freeze = toolbar.locator("button[aria-pressed]"),
            density = toolbar.getByRole("combobox", { name: "表格密度", exact: true });
          await expect(freeze).toHaveText("首列已冻结");
          await expect(summary).toHaveText("列设置");
          await expect(freeze).toHaveAttribute("aria-pressed", "true");
          await expect(density).toHaveValue("standard");
          await summary.focus();
          await expect(summary).toBeFocused();
          const controlHeights = await toolbar
            .locator("summary, button, select")
            .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
          check(
            "desktop controls have usable height",
            controlHeights.every((height) => height >= 36),
          );
          checks.push({ name: "desktop control heights measured", actual: controlHeights });
          if (mode === "review")
            check(
              "review controls at least44px",
              await toolbar
                .locator("summary, button, select")
                .evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height >= 44)),
            );
          await page.evaluate(() => document.fonts.ready);
          await picture(controls, "default");
          await page.keyboard.press("Enter");
          await expect(details).toHaveAttribute("open", "");
          const fieldset = details.locator("fieldset"),
            boxes = fieldset.getByRole("checkbox"),
            labels = await fieldset.locator("span").allTextContents();
          check("five source-derived columns", labels, [
            "程序与来源",
            "健康探针",
            "24 小时实际采集",
            "暂停与恢复",
            "操作",
          ]);
          check(
            "five checked columns",
            await boxes.evaluateAll((els) => els.map((el) => el.checked)),
            [true, true, true, true, true],
          );
          check(
            "column rows at least44px in review",
            await fieldset
              .locator("div")
              .evaluateAll(
                (els, minimumHeight) =>
                  els.every((el) => el.getBoundingClientRect().height >= minimumHeight),
                mode === "review" ? 44 : 36,
              ),
          );
          await picture(controls, "columns-open");
          const third = boxes.nth(2);
          await third.focus();
          await page.keyboard.press("Space");
          await expect(third).not.toBeChecked();
          await expect(third).toBeFocused();
          check("third header hidden", await table.locator("thead th").nth(2).isHidden());
          check(
            "third cells hidden",
            await table
              .locator("tbody tr td:nth-child(3)")
              .evaluateAll((els) => els.every((el) => el.hidden)),
          );
          const standardHeight = await table
            .locator("tbody tr")
            .first()
            .evaluate((el) => el.getBoundingClientRect().height);
          await density.selectOption("compact");
          await expect(table).toHaveAttribute("data-table-density", "compact");
          await density.focus();
          await expect(density).toBeFocused();
          const compactHeight = await table
            .locator("tbody tr")
            .first()
            .evaluate((el) => el.getBoundingClientRect().height);
          check("compact does not increase row height", compactHeight <= standardHeight);
          await picture(controls, "column-hidden-compact");
          await summary.focus();
          await page.keyboard.press("Enter");
          await freeze.focus();
          await page.keyboard.press("Enter");
          await expect(freeze).toHaveText("首列未冻结");
          await expect(freeze).toHaveAttribute("aria-pressed", "false");
          await expect(freeze).toBeFocused();
          check(
            "freeze off removes all sticky cells",
            await table.locator(".table-view-controls__frozen").count(),
            0,
          );
          await picture(controls, "freeze-off");
          await page.keyboard.press("Enter");
          await expect(freeze).toHaveAttribute("aria-pressed", "true");
          await summary.click();
          for (const index of [0, 1, 3]) await boxes.nth(index).uncheck();
          check("one visible column protected", await table.locator("thead th:visible").count(), 1);
          await expect(boxes.nth(4)).toBeDisabled();
          check(
            "remaining visible column is frozen",
            await table
              .locator("thead th:visible")
              .first()
              .evaluate((el) => el.classList.contains("table-view-controls__frozen")),
          );
          for (const index of [0, 1, 2, 3]) await boxes.nth(index).check();
          check("all five columns restore", await table.locator("thead th:visible").count(), 5);
        }
        check("one adapters GET", reads, 1);
        check(
          "controls create no write",
          requests.filter((request) => !request.key.startsWith("GET ")).length,
          0,
        );
        check(
          "no request bodies",
          requests.every((request) => request.body === null),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        check(
          "no page horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
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
  if (capture) {
    const comparisonPage = await browser.newPage(),
      pair = screenshots.filter((shot) => shot.mode === "review" && shot.width === 390);
    for (const shot of pair) {
      const before = screenshots.find(
          (item) => item.mode === "baseline" && item.width === 390 && item.suffix === shot.suffix,
        ),
        urls = await Promise.all(
          [before, shot].map(
            async (item) =>
              "data:image/png;base64," +
              (await readFile(`${output}/${item.file}`)).toString("base64"),
          ),
        ),
        pixels = await comparisonPage.evaluate(async (images) => {
          const decode = async (url) => {
            const image = new Image();
            image.src = url;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            return {
              width: image.width,
              height: image.height,
              bytes: context.getImageData(0, 0, image.width, image.height).data,
            };
          };
          const [a, b] = await Promise.all(images.map(decode));
          if (a.width !== b.width || a.height !== b.height) return { sameSize: false };
          let changedPixels = 0,
            maxChannelDelta = 0;
          for (let index = 0; index < a.bytes.length; index += 4) {
            let different = false;
            for (let channel = 0; channel < 4; channel++) {
              const delta = Math.abs(a.bytes[index + channel] - b.bytes[index + channel]);
              maxChannelDelta = Math.max(maxChannelDelta, delta);
              different ||= delta > 0;
            }
            if (different) changedPixels++;
          }
          return { sameSize: true, changedPixels, maxChannelDelta };
        }, urls);
      assert.equal(pixels.sameSize, true);
      assert.ok(pixels.changedPixels <= 64 && pixels.maxChannelDelta <= 2, JSON.stringify(pixels));
      comparisons.push({ width: 390, suffix: shot.suffix, ...pixels });
    }
    await comparisonPage.close();
  }
  await browser.close();
  browser = null;
  if (capture) {
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          kind: "P47-TABLE-TOOLS-REVIEW-r1",
          reviewOnly: true,
          processesClosed: true,
          ports,
          runs,
          screenshots,
          comparisons,
          sourceHashes: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await read(file))]),
            ),
          ),
          boundary:
            "Actual App, untransformed ProviderAdapterCenter/ResponsiveDataView/TableViewControls. Review CSS only for active P47 desktop controls. Original column,freeze,density behavior and table facts unchanged. Local two-row GET; no real API/probe/write/deploy or shared-component/full-a11y acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 表格工具审核</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 桌面表格工具 · 独立审核稿</h1><p>实际Vue和共享TableViewControls，仅审核CSS；生产未改。390图片验证桌面工具不泄漏，不代表手机卡片重审。</p>' +
        screenshots
          .map(
            (shot) =>
              `<article><h2>${shot.mode} / ${shot.width} / ${shot.suffix}</h2><img loading="lazy" alt="${shot.suffix}" src="${shot.file}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
      comparisons,
      ports,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
