import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import {
  previewAdapterReadError,
  readErrorTitle,
  readErrorDescription,
} from "./lib/ui-phase2-adapter-read-error-preview.mjs";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const output = "output/playwright/p47-read-error-review";
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const css =
  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-preview.css";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const source = await read(component),
  replacement = previewAdapterReadError(source);
assert.equal(source.split("</script>")[0], replacement.split("</script>")[0]);
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
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
const data = JSON.parse(JSON.stringify(box.data));
const sources = new Set([
  component,
  css,
  fixture,
  "scripts/lib/ui-phase2-adapter-read-error-preview.mjs",
  "scripts/verify-ui-phase2-provider-adapter-read-error.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [],
  comparisons = [];
const cases = [
  { name: "error", status: 409, id: "read-state-review" },
  { name: "no-id", status: 500, id: "" },
  { name: "long-id", status: 409, id: "read-state-" + "x".repeat(110) },
  { name: "forbidden-unchanged", status: 403, id: "read-state-review" },
  { name: "blocked-unchanged", status: 503, id: "read-state-review" },
];
let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const mode of ["baseline", "review"]) {
    const reserve = reservePort();
    await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
    const port = reserve.address().port;
    await new Promise((resolve) => reserve.close(resolve));
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
                name: "p47-initial-error-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: replacement, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p47-read-error-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`P47 read-error ${mode} ${origin}`);
    for (const width of [390, 760, 1440])
      for (const scene of cases) {
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
          let reads = 0,
            recover = false;
          const initialReads = scene.status === 503 ? 3 : 1;
          const check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${mode}/${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
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
            return !recover
              ? route.fulfill({
                  status: scene.status,
                  json: {
                    error: { code: "read_test_error", message: "本地测试读取失败" },
                    request_id: scene.id,
                  },
                })
              : route.fulfill({ json: { data: data.items, request_id: "retry-success" } });
          });
          await page.goto(origin + "/platform-admin/providers/adapters");
          const panel = page.locator(".adapter-center .ui-state-panel"),
            retry = panel.getByRole("button", { name: "重新读取状态", exact: true });
          const kind =
            scene.status === 403 ? "forbidden" : scene.status === 503 ? "blocked" : "error";
          await expect(panel).toHaveAttribute("data-kind", kind);
          await expect(retry).toBeEnabled();
          await page.evaluate(() => document.fonts.ready);
          check("original initial GET attempt count", reads, initialReads);
          check(
            "existing assertive state announcement",
            await panel.getAttribute("aria-live"),
            "assertive",
          );
          check("no fabricated content", await page.locator(".adapter-metrics").count(), 0);
          check(
            "original correlation ID visibility",
            await panel.locator("dd").allTextContents(),
            scene.id ? [scene.id] : [],
          );
          if (mode === "review" && kind === "error") {
            await expect(panel.getByRole("heading")).toHaveText(readErrorTitle);
            await expect(panel).toContainText(readErrorDescription);
            check("no write-result claim", !(await panel.textContent()).includes("没有写入成功"));
            check(
              "decorative English hidden",
              await panel.locator(":scope > p").isVisible(),
              false,
            );
          }
          await retry.scrollIntoViewIfNeeded();
          await retry.focus();
          await expect(retry).toBeFocused();
          await expect(retry).toBeInViewport();
          check(
            "keyboard retry target fits",
            await retry.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return r.width >= 44 && r.height >= 44;
            }),
          );
          check(
            "no page or panel horizontal overflow",
            await panel.evaluate(
              (el) =>
                el.scrollWidth <= el.clientWidth + 1 &&
                document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          if (capture) {
            const file = `${mode}-${width}-${scene.name}.png`,
              bytes = await panel.screenshot({ animations: "disabled" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              mode,
              width,
              scene: scene.name,
              sha256: hash(bytes),
              pixelWidth: bytes.readUInt32BE(16),
              pixelHeight: bytes.readUInt32BE(20),
            });
          }
          recover = true;
          await page.keyboard.press("Enter");
          await expect(page.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
          check("explicit retry alone adds one GET", reads, initialReads + 1);
          check("no probe writes", requests.filter((req) => req.key.startsWith("POST")).length, 0);
          check(
            "no request body",
            requests.every((req) => req.body === null),
          );
          check("no unexpected network", unexpected, []);
          check("no runtime errors", errors, []);
          runs.push({ mode, width, scene: scene.name, checks, requests });
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
    const comparisonPage = await browser.newPage();
    for (const shot of screenshots.filter(
      (s) => s.mode === "review" && s.scene.endsWith("unchanged"),
    )) {
      const before = screenshots.find(
        (s) => s.mode === "baseline" && s.width === shot.width && s.scene === shot.scene,
      );
      const urls = await Promise.all(
        [before, shot].map(
          async (s) =>
            "data:image/png;base64," + (await readFile(`${output}/${s.file}`)).toString("base64"),
        ),
      );
      const pixels = await comparisonPage.evaluate(async (urls) => {
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
        const [a, b] = await Promise.all(urls.map(decode));
        if (a.width !== b.width || a.height !== b.height) return { sameSize: false };
        let changedPixels = 0,
          maxChannelDelta = 0;
        for (let i = 0; i < a.bytes.length; i += 4) {
          let different = false;
          for (let c = 0; c < 4; c++) {
            const delta = Math.abs(a.bytes[i + c] - b.bytes[i + c]);
            maxChannelDelta = Math.max(maxChannelDelta, delta);
            different ||= delta > 0;
          }
          if (different) changedPixels++;
        }
        return { sameSize: true, changedPixels, maxChannelDelta };
      }, urls);
      assert.equal(pixels.sameSize, true);
      // Preserve measured raster noise explicitly; never claim PNG byte equality from this tolerance.
      assert.ok(pixels.changedPixels <= 8 && pixels.maxChannelDelta <= 1, JSON.stringify(pixels));
      comparisons.push({ width: shot.width, scene: shot.scene, ...pixels });
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
          kind: "P47-READ-ERROR-REVIEW-r1",
          reviewOnly: true,
          processesClosed: true,
          runs,
          screenshots,
          comparisons,
          sourceHashes: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await read(file))]),
            ),
          ),
          boundary:
            "Only two title/description props and error-only CSS in an isolated host. Actual script and GET retries unchanged. Locally rejected reads, no real API/probe. Not production implementation, other states or full a11y acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 首次读取失败审核</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 首次读取失败 · 独立审核稿</h1><p>实际Vue、局部展示覆盖；本地测试数据，生产组件未改。图片仅截状态区域，不代表整页通过。</p>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.mode} / ${s.width} / ${s.scene}</h2><img loading="lazy" alt="${s.mode} ${s.scene}" src="${s.file}"></article>`,
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
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
