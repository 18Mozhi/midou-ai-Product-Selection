import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import { inflateSync } from "node:zlib";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { previewProviderSourcesMobile } from "./lib/ui-phase2-provider-sources-mobile-preview.mjs";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-source-mobile-review",
  component = "apps/web/src/components/ProviderSourceCenter.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  mobileCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-mobile-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewProviderSourcesMobile(source);

const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
const sourceFor = (name) => {
    const matches = declarations.filter((node) => node.name.getText(ast) === name);
    assert.equal(matches.length, 1, `fixture declaration ${name}`);
    return `const ${name}=${matches[0].initializer.getText(ast)};`;
  },
  box = {};
vm.runInNewContext(
  ts.transpileModule(
    ["org", "ws", "navigation", "automatic", "setup", "manual", "sources"]
      .map(sourceFor)
      .join("\n") + '\nglobalThis.data={navigation:navigation("platform_admin"),sources};',
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data)),
  sources = new Set([
    component,
    pageCss,
    mobileCss,
    fixture,
    "scripts/lib/ui-phase2-provider-sources-mobile-preview.mjs",
    "scripts/verify-ui-phase2-provider-sources-mobile.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  comparisons = [],
  ports = [];

function decodeScreenshotPng(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "PNG signature");
  let offset = 8,
    width,
    height,
    bitDepth,
    colorType,
    interlace,
    compressed = Buffer.alloc(0);
  while (offset < bytes.length) {
    const size = bytes.readUInt32BE(offset),
      type = bytes.toString("ascii", offset + 4, offset + 8),
      body = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === "IDAT") compressed = Buffer.concat([compressed, body]);
    else if (type === "IEND") break;
    offset += size + 12;
  }
  assert.equal(bitDepth, 8, "screenshot PNG bit depth");
  assert.ok(colorType === 2 || colorType === 6, "screenshot PNG RGB/RGBA color type");
  assert.equal(interlace, 0, "screenshot PNG is not interlaced");
  const channels = colorType === 6 ? 4 : 3,
    stride = width * channels,
    encoded = inflateSync(compressed),
    pixels = Buffer.alloc(stride * height),
    paeth = (left, above, upperLeft) => {
      const estimate = left + above - upperLeft,
        leftDistance = Math.abs(estimate - left),
        aboveDistance = Math.abs(estimate - above),
        upperLeftDistance = Math.abs(estimate - upperLeft);
      return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
        ? left
        : aboveDistance <= upperLeftDistance
          ? above
          : upperLeft;
    };
  assert.equal(encoded.length, (stride + 1) * height, "screenshot PNG payload length");
  for (let row = 0; row < height; row++) {
    const filter = encoded[row * (stride + 1)],
      sourceStart = row * (stride + 1) + 1,
      targetStart = row * stride;
    for (let column = 0; column < stride; column++) {
      const raw = encoded[sourceStart + column],
        left = column >= channels ? pixels[targetStart + column - channels] : 0,
        above = row > 0 ? pixels[targetStart + column - stride] : 0,
        upperLeft =
          row > 0 && column >= channels ? pixels[targetStart + column - stride - channels] : 0;
      pixels[targetStart + column] =
        filter === 0
          ? raw
          : filter === 1
            ? raw + left
            : filter === 2
              ? raw + above
              : filter === 3
                ? raw + Math.floor((left + above) / 2)
                : filter === 4
                  ? raw + paeth(left, above, upperLeft)
                  : assert.fail(`unsupported PNG filter ${filter}`);
    }
  }
  return { width, height, channels, pixels };
}

let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const mode of ["page", "mobile"]) {
    const reservation = reservePort();
    await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    ports.push(port);
    const origin = `http://127.0.0.1:${port}`;
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
      plugins: [
        {
          name: "p48-source-mobile-review-only",
          enforce: "pre",
          transform(text, id) {
            const bare = id.split("?", 1)[0];
            if (path.isAbsolute(bare)) {
              const relative = path.relative(process.cwd(), bare).replaceAll("\\", "/");
              if (
                !relative.includes("/node_modules/") &&
                (relative.startsWith("apps/") || relative.startsWith("packages/"))
              )
                sources.add(relative);
            }
            if (
              mode === "mobile" &&
              bare.replaceAll("\\", "/") === path.resolve(component).replaceAll("\\", "/")
            ) {
              assert.equal(text.replaceAll("\r\n", "\n"), source);
              return { code: replacement, map: null };
            }
            return null;
          },
          transformIndexHtml(html) {
            const bodyClass =
                mode === "mobile"
                  ? "p48-source-page-review p48-mobile-detail-review"
                  : "p48-source-page-review",
              styles = [pageCss, ...(mode === "mobile" ? [mobileCss] : [])]
                .map(
                  (file) =>
                    `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
                )
                .join("");
            return html
              .replace("<body>", `<body class="${bodyClass}">`)
              .replace("</head>", `${styles}</head>`);
          },
        },
      ],
    });
    await server.listen();
    console.log(`P48 source mobile ${mode} ${origin}`);
    for (const width of [390, 760, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 1200 : 1400 },
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
          },
          picture = async (locator, suffix) => {
            if (!capture) return;
            if (width <= 760) {
              await locator.evaluate((element) => {
                const top = window.scrollY + element.getBoundingClientRect().top - 60;
                window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
              });
              await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
            }
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
          const request = route.request(),
            url = new URL(request.url()),
            key = `${request.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push(`external ${key}`);
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (
            ![
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/provider-sources",
            ].includes(key)
          ) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: request.postData() });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: data.navigation, request_id: "p48-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          reads++;
          return route.fulfill({ json: { data: data.sources, request_id: "p48-list" } });
        });
        await page.goto(origin + "/platform-admin/providers/sources");
        const center = page.locator(".source-center"),
          filters = center.locator(".source-filter"),
          records = center.locator(".source-list article"),
          firstRecord = records.first(),
          toggle = filters.locator(".p48-mobile-filter-toggle"),
          detailTrigger = firstRecord.locator(".p48-mobile-detail-trigger"),
          detailBack = firstRecord.locator(".p48-mobile-detail-back");
        await expect(center.locator(".source-result-count")).toHaveText("找到 146 个来源");
        await expect(records).toHaveCount(20);
        check("one catalog GET", reads, 1);
        if (width <= 760) {
          if (mode === "page") {
            check("page review has no disclosure control", await toggle.count(), 0);
            check(
              "page review shows six selects",
              await filters.locator("select:visible").count(),
              6,
            );
            check(
              "page review shows complete first record",
              await firstRecord.locator("footer:visible").count(),
              1,
            );
            await picture(filters, "filters-full");
            await firstRecord.scrollIntoViewIfNeeded();
            await picture(firstRecord, "record-full");
          } else {
            await expect(toggle).toBeVisible();
            await expect(toggle).toHaveAttribute("aria-expanded", "false");
            check(
              "collapsed hides six selects",
              await filters.locator("select:visible").count(),
              0,
            );
            check("search remains visible", await filters.getByLabel("搜索来源").isVisible());
            check(
              "result count remains visible",
              await center.locator(".source-result-count").isVisible(),
            );
            check(
              "filter toggle44",
              await toggle.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width >= 44 && rect.height >= 44;
              }),
            );
            await picture(filters, "filters-collapsed");
            await toggle.focus();
            await page.keyboard.press("Enter");
            await expect(toggle).toHaveAttribute("aria-expanded", "true");
            await expect(toggle).toHaveText("收起筛选");
            await expect(toggle).toBeFocused();
            check("expanded shows six selects", await filters.locator("select:visible").count(), 6);
            check(
              "expanded fields are bounded",
              await filters.locator(".p48-mobile-filter-fields").evaluate((element) => {
                const style = getComputedStyle(element);
                return (
                  style.overflowY === "auto" &&
                  element.clientHeight <= 440 &&
                  element.scrollHeight > element.clientHeight
                );
              }),
            );
            await picture(filters, "filters-expanded");
            const filterFields = filters.locator(".p48-mobile-filter-fields");
            await filterFields.evaluate((element) => {
              element.scrollTop = element.scrollHeight;
            });
            await expect(filters.getByRole("button", { name: "重置筛选" })).toBeInViewport();
            await picture(filters, "filters-expanded-bottom");
            await page.keyboard.press("Enter");
            await expect(toggle).toHaveAttribute("aria-expanded", "false");
            await expect(toggle).toBeFocused();
            await firstRecord.scrollIntoViewIfNeeded();
            await expect(firstRecord.locator(".p48-mobile-record-summary")).toBeVisible();
            await expect(firstRecord.locator(".p48-source-record-body")).toBeHidden();
            await expect(detailTrigger).toBeVisible();
            await picture(firstRecord, "record-summary");
            await detailTrigger.focus();
            await page.keyboard.press("Enter");
            await expect(center).toHaveClass(/p48-mobile-detail-open/);
            await expect(firstRecord).toHaveClass(/p48-mobile-selected/);
            await expect(detailBack).toBeFocused();
            check(
              "only selected record remains",
              await center.locator(".source-list article:visible").count(),
              1,
            );
            check(
              "only selected group remains",
              await center.locator(".source-purpose-group:visible").count(),
              1,
            );
            check(
              "detail preserves source facts",
              await firstRecord.locator(".p48-source-record-body dl:visible dt").count(),
              7,
            );
            check(
              "detail preserves original actions",
              await firstRecord
                .locator(".p48-source-record-body footer :is(a, button):visible")
                .count(),
              3,
            );
            check(
              "back target44",
              await detailBack.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width >= 44 && rect.height >= 44;
              }),
            );
            await picture(firstRecord, "record-detail");
            await page.keyboard.press("Enter");
            await expect(center).not.toHaveClass(/p48-mobile-detail-open/);
            await expect(detailTrigger).toBeFocused();
            await expect(records).toHaveCount(20);
            check("detail cycle adds no GET", reads, 1);
            await picture(firstRecord, "record-restored");
          }
        } else {
          check("mobile filter toggle hidden on desktop", await toggle.isVisible(), false);
          check(
            "mobile summaries hidden on desktop",
            await center.locator(".p48-mobile-record-summary:visible").count(),
            0,
          );
          check("desktop keeps six selects", await filters.locator("select:visible").count(), 6);
          check(
            "desktop keeps complete record body",
            await firstRecord.locator(".p48-source-record-body footer:visible").count(),
            mode === "mobile" ? 1 : 0,
          );
          await picture(filters, "filters-desktop");
          await picture(firstRecord, "record-desktop");
        }
        check(
          "no write requests",
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
          "no horizontal overflow",
          await center.evaluate(
            (element) =>
              element.scrollWidth <= element.clientWidth + 1 &&
              document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        );
        runs.push({ mode, width, checks, requests });
      } finally {
        await context.close();
      }
    }
    for (const id of server.moduleGraph.idToModuleMap.keys()) {
      const bare = id.split("?", 1)[0],
        file = path.isAbsolute(bare)
          ? path.relative(process.cwd(), bare).replaceAll("\\", "/")
          : "";
      if (
        file &&
        !file.startsWith("..") &&
        !file.includes("node_modules") &&
        /\.(vue|ts|css|json)$/.test(file)
      )
        sources.add(file);
    }
    await server.close();
    server = undefined;
  }
  if (capture) {
    for (const width of [1024, 1440])
      for (const suffix of ["filters-desktop", "record-desktop"]) {
        const before = screenshots.find(
            (shot) => shot.mode === "page" && shot.width === width && shot.suffix === suffix,
          ),
          after = screenshots.find(
            (shot) => shot.mode === "mobile" && shot.width === width && shot.suffix === suffix,
          ),
          [beforePng, afterPng] = await Promise.all(
            [before, after].map(async (shot) =>
              decodeScreenshotPng(await readFile(`${output}/${shot.file}`)),
            ),
          ),
          sameSize =
            beforePng.width === afterPng.width &&
            beforePng.height === afterPng.height &&
            beforePng.channels === afterPng.channels;
        let changedPixels = 0,
          maxChannelDelta = 0;
        if (sameSize)
          for (let index = 0; index < beforePng.pixels.length; index += beforePng.channels) {
            let different = false;
            for (let channel = 0; channel < beforePng.channels; channel++) {
              const delta = Math.abs(
                beforePng.pixels[index + channel] - afterPng.pixels[index + channel],
              );
              maxChannelDelta = Math.max(maxChannelDelta, delta);
              different ||= delta > 0;
            }
            if (different) changedPixels++;
          }
        const pixels = { sameSize, changedPixels, maxChannelDelta };
        assert.equal(pixels.sameSize, true);
        assert.ok(
          pixels.changedPixels <= 64 && pixels.maxChannelDelta <= 2,
          JSON.stringify(pixels),
        );
        comparisons.push({ width, suffix, ...pixels });
      }
  }
} finally {
  if (server) await server.close();
  if (browser) await browser.close();
}

await new Promise((resolve) => setTimeout(resolve, 50));
const sourceHashes = {};
for (const file of [...sources].sort()) {
  try {
    sourceHashes[file] = hash(await read(file));
  } catch {}
}
const evidence = {
  kind: "P48-SOURCE-MOBILE-REVIEW-r1",
  reviewOnly: true,
  processesClosed: true,
  ports,
  runs,
  screenshots,
  comparisons,
  sourceHashes,
  boundary:
    "Actual App/current ProviderSourceCenter. Page mode reuses P48 C directory CSS; mobile mode adds review-only template state/handlers and mobile CSS. Search, six advanced filters,146-row catalog,all facts/actions and GET contract retained. No production/API/permission/write/external/deploy change. Desktop image comparisons protect prior page review.",
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 手机筛选与来源详情审核</title><style>body{margin:0;padding:24px;background:#e9eef5;color:#142a46;font-family:sans-serif}main{display:grid;gap:24px}article{padding:16px;background:white;border:1px solid #cfd9e7}h1,h2{margin:0 0 12px}h2{font-size:16px}img{display:block;max-width:100%;height:auto;border:1px solid #d8e0eb}</style><main><h1>P48 手机筛选与来源详情</h1>${screenshots.map((shot) => `<article><h2>${shot.mode} · ${shot.width} · ${shot.suffix}</h2><img src="${shot.file}" alt="${shot.mode} ${shot.width} ${shot.suffix}"></article>`).join("")}</main></html>`,
  );
}
console.log(
  JSON.stringify({
    runs: runs.length,
    checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
    screenshots: screenshots.length,
    sources: Object.keys(sourceHashes).length,
    comparisons,
    ports,
  }),
);
