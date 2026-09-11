import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-source-page-review",
  component = "apps/web/src/components/ProviderSourceCenter.vue",
  css = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex");

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
    css,
    fixture,
    "scripts/verify-ui-phase2-provider-sources-page.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  ports = [];
const collectLoadedSource = {
  name: "p48-source-page-source-collector",
  enforce: "pre",
  transform(_code, id) {
    const bare = id.split("?", 1)[0];
    if (!path.isAbsolute(bare)) return null;
    const relative = path.relative(process.cwd(), bare).replaceAll("\\", "/");
    if (
      !relative.includes("/node_modules/") &&
      (relative.startsWith("apps/") || relative.startsWith("packages/"))
    )
      sources.add(relative);
    return null;
  },
};

let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const mode of ["baseline", "review"]) {
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
        collectLoadedSource,
        ...(mode === "baseline"
          ? []
          : [
              {
                name: "p48-source-page-review-only",
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p48-source-page-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ]),
      ],
    });
    server.watcher.on("add", (file) =>
      sources.add(path.relative(process.cwd(), file).replaceAll("\\", "/")),
    );
    server.watcher.on("change", (file) =>
      sources.add(path.relative(process.cwd(), file).replaceAll("\\", "/")),
    );
    await server.listen();
    console.log(`P48 source page ${mode} ${origin}`);
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
          guide = center.locator(".source-guide"),
          metrics = center.locator(".source-metrics"),
          help = center.locator(".source-help"),
          filters = center.locator(".source-filter"),
          records = center.locator(".source-list article"),
          firstRecord = records.first(),
          pagination = center.getByRole("navigation", { name: "热点来源分页" });
        await expect(
          center.getByRole("heading", { name: "多平台、多国家来源已自动登记" }),
        ).toBeVisible();
        await expect(center.locator(".source-result-count")).toHaveText("找到 146 个来源");
        check("four global metrics", await metrics.locator("article").count(), 4);
        check("three help statements", await help.locator("li").count(), 3);
        check("seven labeled filters", await filters.locator("input, select").count(), 7);
        check("page one has20 records", await records.count(), 20);
        check("one catalog GET", reads, 1);
        check(
          "first page range",
          (await pagination.textContent())
            .replaceAll(/\s+/g, " ")
            .trim()
            .includes("当前 1–20，共 146 个来源"),
        );
        for (const [controlName, locator] of [
          ["refresh", guide.getByRole("button", { name: "刷新来源" })],
          ["manage", guide.getByRole("link", { name: "管理来源规则" })],
          ["search", filters.getByLabel("搜索来源")],
          ["reset", filters.getByRole("button", { name: "重置筛选" })],
          ["next", pagination.getByRole("button", { name: "下一页" })],
        ]) {
          await locator.focus();
          await expect(locator).toBeFocused();
          if (mode === "review")
            check(
              `review target44 ${controlName}`,
              await locator.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width >= 44 && rect.height >= 44;
              }),
            );
        }
        await page.evaluate(() => document.fonts.ready);
        await picture(guide, "heading");
        await picture(metrics, "metrics");
        await picture(help, "help");
        await picture(filters, "filters");
        await firstRecord.scrollIntoViewIfNeeded();
        await picture(firstRecord, "first-record");
        const next = pagination.getByRole("button", { name: "下一页" });
        await next.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/page=2/);
        await expect(records).toHaveCount(20);
        check("page two retains20 records", await records.count(), 20);
        check(
          "page two range",
          (await pagination.textContent()).replaceAll(/\s+/g, " ").trim().includes("当前 21–40"),
        );
        check("pagination adds no GET", reads, 1);
        await picture(pagination, "page-two");
        await filters.getByLabel("业务类型").selectOption("product_supply");
        await expect(center.getByRole("heading", { name: "供应链找货" })).toBeVisible();
        check("category filter adds no GET", reads, 1);
        await filters.getByRole("button", { name: "重置筛选" }).click();
        await expect(center.locator(".source-result-count")).toHaveText("找到 146 个来源");
        check("reset restores page one", new URL(page.url()).searchParams.get("page"), null);
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
    await server.close();
    server = undefined;
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
  kind: "P48-SOURCE-PAGE-REVIEW-r1",
  reviewOnly: true,
  processesClosed: true,
  ports,
  runs,
  screenshots,
  sourceHashes,
  boundary:
    "Actual App and untransformed ProviderSourceCenter. Review-only CSS for P48 default directory. Authoritative146-row fixture, seven filters, groups and pagination retained. Local GET only; no source test/config/version/sample/matrix write, external navigation, production change or deploy.",
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const cards = screenshots
    .map(
      (shot) =>
        `<article><h2>${shot.mode} · ${shot.width} · ${shot.suffix}</h2><img src="${shot.file}" alt="${shot.mode} ${shot.width} ${shot.suffix}"></article>`,
    )
    .join("");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 来源频道实际 Vue 审核</title><style>body{margin:0;padding:24px;background:#e9eef5;color:#142a46;font-family:sans-serif}main{display:grid;gap:24px}article{padding:16px;background:white;border:1px solid #cfd9e7}h1,h2{margin:0 0 12px}h2{font-size:16px}img{display:block;max-width:100%;height:auto;border:1px solid #d8e0eb}</style><main><h1>P48 来源频道实际 Vue · 默认目录</h1>${cards}</main></html>`,
  );
}
console.log(
  JSON.stringify({
    runs: runs.length,
    checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
    screenshots: screenshots.length,
    sources: Object.keys(sourceHashes).length,
    ports,
  }),
);
