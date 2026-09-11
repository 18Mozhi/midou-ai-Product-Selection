import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const preview =
  "design-plans/ui-phase-2-2026-09-07/implementation/ProviderAdapterCenterPreview.vue";
const css = "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-vue-preview.css";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const output = "output/playwright/p47-adapters-vue";
const source = await read(component),
  replacement = await read(preview);
assert.equal(source.split("</script>")[0], replacement.split("</script>")[0]);
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = [];
function visit(n) {
  if (ts.isVariableDeclaration(n)) declarations.push(n);
  ts.forEachChild(n, visit);
}
visit(ast);
const code =
  ["navigation", "base", "items", "catalog"]
    .map((name) => {
      const matches = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(matches.length, 1, name);
      return `const ${name} = ${matches[0].initializer.getText(ast)};`;
    })
    .join("\n") + "globalThis.data={navigation,base,items,catalog};";
const box = {};
vm.runInNewContext(
  ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
// Existing catalog omits runtime fields. Explicitly complete it with the same fixture's
// base, not an assumed production response; this is labeled in the evidence.
const catalog = data.catalog.map((item) => ({ ...data.base, ...item }));
const sources = new Set([
  component,
  preview,
  css,
  fixture,
  "scripts/verify-ui-phase2-provider-adapters-vue.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p47-review-only",
      enforce: "pre",
      transform(text, id) {
        if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/")) return null;
        assert.equal(text.replaceAll("\r\n", "\n"), source);
        return { code: replacement, map: null };
      },
      transformIndexHtml(html) {
        return html
          .replace("<body>", '<body class="p47-adapter-review">')
          .replace(
            "</head>",
            '<link rel="stylesheet" href="/@fs/' +
              path.resolve(css).replaceAll("\\", "/") +
              '"></head>',
          );
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  observations = [],
  network = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log("p47_review_host " + origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        unexpected = [],
        errors = [],
        requests = [];
      let rows = data.items,
        status = 200,
        heldRead = false,
        heldProbe = false,
        releaseRead,
        releaseProbe;
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, width + ":" + name);
        checks.push({ width, name, actual });
      };
      await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push("external");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const key = req.method() + " " + url.pathname;
        const isProbe =
          req.method() === "POST" &&
          url.pathname === `/api/v1/platform/provider-adapters/${data.items[0].id}/health-check`;
        if (
          ![
            "GET /api/v1/me/navigation",
            "GET /api/v1/auth/session-status",
            "GET /api/v1/platform/provider-adapters",
          ].includes(key) &&
          !isProbe
        ) {
          unexpected.push(key);
          return route.abort();
        }
        requests.push({ key, body: req.postData() });
        if (isProbe) {
          if (heldProbe)
            await new Promise((resolve) => {
              releaseProbe = resolve;
            });
          return route.fulfill({
            status: 409,
            json: {
              error: {
                code: "version_conflict",
                message: "检查冲突",
                action_hint: "请重新读取状态后检查。",
              },
              request_id: "probe-sample",
              trace_id: "probe-sample",
            },
          });
        }
        if (url.pathname.endsWith("navigation"))
          return route.fulfill({ json: { data: data.navigation, request_id: "nav-sample" } });
        if (url.pathname.endsWith("session-status"))
          return route.fulfill({ json: { data: { authenticated: true } } });
        if (heldRead)
          await new Promise((resolve) => {
            releaseRead = resolve;
          });
        return route.fulfill(
          status === 200
            ? { json: { data: rows, request_id: "list-sample", trace_id: "list-sample" } }
            : {
                status,
                json: {
                  error: {
                    code: status === 403 ? "authorization_denied" : "internal_error",
                    message: "读取未完成",
                    action_hint: "请稍后重新读取状态。",
                  },
                  request_id: "read-error",
                  trace_id: "read-error",
                },
              },
        );
      });
      const center = page.locator(".adapter-center");
      const settle = async () => {
        await page.clock.runFor(100);
        await page.evaluate(() => document.fonts.ready);
      };
      const shot = async (state, target = null, fullPage = true) => {
        await settle();
        check(
          state + " no page overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        const bytes = target
          ? await target.screenshot({ animations: "disabled" })
          : await page.screenshot({ fullPage, animations: "disabled" });
        const file = `${width}-${state}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          width,
          state,
          file,
          sha256: hash(bytes),
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
        });
      };
      const result = (n) =>
        expect(center.locator(".adapter-toolbar > span")).toHaveText(`${n} 个结果`);
      const displayed = () =>
        width <= 760
          ? center.locator(".responsive-data-view__mobile article")
          : center.locator(".adapter-table-wrap tbody tr");
      const refresh = () => center.getByRole("button", { name: "刷新状态", exact: true }).click();
      await page.goto(origin + "/platform-admin/providers/adapters");
      await result(2);
      await shot("default");
      await page.evaluate(() => scrollTo(0, 0));
      await shot("first-screen", null, false);
      check("two displayed records", await displayed().count(), 2);
      const firstRow = await displayed().first().boundingBox();
      const mobileNav = width <= 840 ? await page.locator(".role-mobile-nav").boundingBox() : null;
      check(
        "first record has visible44px before fixed nav",
        firstRow !== null && firstRow.y + 44 <= (mobileNav?.y ?? 1000),
      );
      check(
        "advanced initially closed",
        await center.locator(".adapter-advanced").getAttribute("open"),
        null,
      );
      await center.locator(".adapter-advanced > summary").click();
      await shot("filters-open", center.locator(".adapter-toolbar"));
      const initialRequests = requests.length;
      await center.getByLabel("搜索来源", { exact: true }).fill("no-such-adapter");
      await result(0);
      await shot("no-match", center);
      await center.getByRole("button", { name: "清除筛选", exact: true }).click();
      await result(2);
      for (const [label, value] of [
        ["接入模式", "all"],
        ["来源状态", "all"],
        ["登记状态", "all"],
        ["健康状态", "all"],
        ["排序", "attention"],
      ])
        await expect(center.getByRole("combobox", { name: label, exact: true })).toHaveValue(value);
      check("reset no request", requests.length, initialRequests);
      await center
        .getByRole("combobox", { name: "登记状态", exact: true })
        .selectOption("unregistered");
      await result(1);
      await shot("unregistered", center);
      await center.getByRole("button", { name: "重置", exact: true }).click();
      await center.locator(".adapter-advanced > summary").click();
      await center.getByLabel("搜索来源", { exact: true }).focus();
      await shot("search-focus", center.locator(".adapter-toolbar"));
      await page.keyboard.press("Tab");
      await expect(center.getByRole("button", { name: "重置", exact: true })).toBeFocused();
      check("search Tab reaches reset", true);
      if (width <= 760) {
        const trigger = center.getByRole("button", { name: /公开趋势 RSS.*查看详情/ });
        await trigger.click();
        const drawer = page.locator(".responsive-data-view__drawer");
        await expect(drawer).toBeVisible();
        await shot("original-detail", drawer);
        await drawer.locator("details > summary").click();
        await shot("original-technical", drawer.locator("details"));
        await page.keyboard.press("Escape");
        await expect(drawer).toHaveCount(0);
        await expect(trigger).toBeFocused();
        check("original detail returns trigger", true);
      }
      status = 500;
      await refresh();
      await expect(center.locator(".adapter-message")).toContainText("重新读取");
      await result(2);
      await shot("refresh-error", center);
      status = 200;
      rows = catalog;
      await refresh();
      await result(45);
      check("catalog page1", await displayed().count(), 20);
      await shot("catalog-first", center, false);
      await center.getByRole("button", { name: "下一页", exact: true }).click();
      check("catalog page2", await displayed().count(), 20);
      await center.getByRole("button", { name: "下一页", exact: true }).click();
      check("catalog page3", await displayed().count(), 5);
      await shot("catalog-last", center);
      await center.getByLabel("搜索来源", { exact: true }).fill("catalog_source_45");
      await result(1);
      await expect(center.locator(".adapter-pagination")).toContainText("第 1 / 1 页");
      check("filter resets page", true);
      await center.getByRole("button", { name: "重置", exact: true }).click();
      rows = [
        {
          ...data.items[0],
          last_latency_ms: 0,
          latest_runtime_category: "network",
          runtime_sample_count_24h: 1,
          runtime_success_rate_basis_points_24h: 0,
          runtime_duration_p95_ms_24h: 0,
          runtime_network_failure_count_24h: 1,
        },
      ];
      await refresh();
      await result(1);
      await shot("synthetic-zero-runtime", center);
      if (width > 760)
        await expect(center.locator(".adapter-table-wrap")).toContainText(
          "成功率 0.0% · P95 0 ms · 1 个样本",
        );
      heldProbe = true;
      if (width <= 760) {
        await center.getByRole("button", { name: /公开趋势 RSS.*查看详情/ }).click();
        await page
          .locator(".responsive-data-view__drawer")
          .getByRole("button", { name: "执行健康检查", exact: true })
          .click();
      } else await center.getByRole("button", { name: "健康检查", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "检查中…", exact: true }).filter({ visible: true }),
      ).toBeDisabled();
      await shot("probing", width <= 760 ? page.locator(".responsive-data-view__drawer") : center);
      assert.ok(releaseProbe);
      releaseProbe();
      heldProbe = false;
      await expect(center.locator(".adapter-message")).toContainText("重新读取状态后检查");
      if (width <= 760) await page.keyboard.press("Escape");
      await shot("probe-rejected", center);
      check(
        "probe request has no body",
        requests.find((r) => r.key.startsWith("POST ")).body,
        null,
      );
      for (const kind of ["empty", "forbidden", "error"]) {
        rows = [];
        status = kind === "empty" ? 200 : kind === "forbidden" ? 403 : 500;
        await page.reload();
        await expect(
          center.locator(
            kind === "empty" ? ".adapter-empty" : `.ui-state-panel[data-kind="${kind}"]`,
          ),
        ).toBeVisible();
        await shot("first-" + kind, center);
        if (kind !== "empty") {
          await expect(
            center.getByRole("button", { name: "重新读取状态", exact: true }),
          ).toBeVisible();
          check(
            kind + " only reload action",
            await center.locator(".ui-state-panel footer button:visible").count(),
            1,
          );
        }
      }
      status = 200;
      rows = data.items;
      heldRead = true;
      await page.reload();
      await expect(center.locator('[data-kind="loading"]')).toBeVisible();
      await shot("loading", center);
      assert.ok(releaseRead);
      releaseRead();
      heldRead = false;
      await result(2);
      await shot("recovered", center);
      check("no unexpected network", unexpected, []);
      check("no browser errors", errors, []);
      network.push({ width, requests });
      observations.push({
        width,
        catalog: [20, 20, 5],
        defaultRows: 2,
        rawScriptUnchanged: true,
        originalDetailNotRedesigned: width <= 760,
      });
      console.log("p47 passed " + width);
    } finally {
      await context.close();
    }
  }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const f = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css|json)$/.test(f))
      sources.add(f);
  }
  const sourceHashes = Object.fromEntries(
    await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
  );
  await browser.close();
  browser = null;
  await server.close();
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P47-ADAPTERS-ACTUAL-VUE-r1",
          sourceHashes,
          screenshots,
          checks,
          observations,
          network,
          processesClosed: true,
          fixtureBoundary:
            "Original two records; original45 catalog completed with the same test base; separate synthetic zero runtime. All API supplied locally, health POST rejected409, no actual probe/persistence. Original mobile detail only exercised, not redesigned. Review SFC script unchanged, original production files untouched; no full a11y/auth/lifecycle/production acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47实际Vue审核</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 采集程序 · 实际Vue审核</h1><p>本地样例、独立审核模板/CSS、未上线。详情两类图仍为原生产样式，不算C重构或批准。</p>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.width} · ${s.state}</h2><img loading="lazy" src="${s.file}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      checks: checks.length,
      screenshots: screenshots.length,
      sources: sources.size,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
