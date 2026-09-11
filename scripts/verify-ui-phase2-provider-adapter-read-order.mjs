import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { historicalAdapterReadSource } from "./lib/ui-phase2-adapter-read-baseline.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const source = await read(component),
  baseline = historicalAdapterReadSource(component, source);
const output = "output/playwright/p47-read-order";
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = [];
function visit(n) {
  if (ts.isVariableDeclaration(n)) declarations.push(n);
  ts.forEachChild(n, visit);
}
visit(ast);
const box = {};
const fixtureCode =
  ["navigation", "base", "items"]
    .map((name) => {
      const matches = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(matches.length, 1);
      return "const " + name + "=" + matches[0].initializer.getText(ast) + ";";
    })
    .join("\n") + "globalThis.data={navigation,items};";
vm.runInNewContext(
  ts.transpileModule(fixtureCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
    .outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
const checks = [],
  screenshots = [],
  network = [],
  runs = [];
const sources = new Set([
  component,
  fixture,
  "scripts/verify-ui-phase2-provider-adapter-read-order.mjs",
  "scripts/lib/ui-phase2-adapter-read-baseline.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const mode of ["baseline", "current"]) {
    const reserve = reservePort();
    await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
    const port = reserve.address().port;
    await new Promise((resolve) => reserve.close(resolve));
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
      plugins: [
        {
          name: "p47-read-order-baseline",
          enforce: "pre",
          transform(text, id) {
            if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
              return null;
            assert.equal(text.replaceAll("\r\n", "\n"), source);
            return mode === "baseline" ? { code: baseline, map: null } : null;
          },
        },
      ],
    });
    await server.listen();
    const origin = "http://127.0.0.1:" + port;
    console.log("p47 read-order host " + mode + " " + origin);
    for (const width of [390, 760, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          requests = [],
          errors = [],
          unexpected = [];
        let heldRead = false,
          readStatus = 200,
          rows = data.items,
          releaseRead,
          releaseProbe;
        let nextReadId = "initial",
          scenario = "",
          readFinished = false;
        const updated = { ...data.items[0], adapter_version: "rss-read-order-v3", version: 3 };
        const fresh = { ...data.items[0], adapter_version: "rss-read-order-v4", version: 4 };
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, mode + ":" + width + ":" + scenario + ":" + name);
          checks.push({ mode, width, scenario, name, actual });
        };
        await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
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
          const probe =
            key === "POST /api/v1/platform/provider-adapters/" + data.items[0].id + "/health-check";
          if (
            !probe &&
            ![
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/provider-adapters",
            ].includes(key)
          ) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ scenario, key, body: req.postData() });
          if (probe) {
            await new Promise((resolve) => {
              releaseProbe = resolve;
            });
            return route.fulfill({
              json: { data: updated, request_id: "new-probe", trace_id: "new-probe" },
            });
          }
          if (url.pathname.endsWith("navigation"))
            return route.fulfill({ json: { data: data.navigation, request_id: "nav" } });
          if (url.pathname.endsWith("session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          const snapshot = { rows, status: readStatus, id: nextReadId },
            isHeld = heldRead;
          if (isHeld)
            await new Promise((resolve) => {
              releaseRead = resolve;
            });
          await route.fulfill(
            snapshot.status === 200
              ? { json: { data: snapshot.rows, request_id: snapshot.id, trace_id: snapshot.id } }
              : {
                  status: 500,
                  json: {
                    error: {
                      code: "internal_error",
                      message: "旧读取错误",
                      action_hint: "旧读取失败，请稍后刷新。",
                    },
                    request_id: snapshot.id,
                    trace_id: snapshot.id,
                  },
                },
          );
          if (isHeld) readFinished = true;
        });
        const center = page.locator(".adapter-center"),
          drawer = page.locator(".responsive-data-view__drawer");
        const rowA = center.locator("tbody tr").filter({ hasText: data.items[0].name });
        const trigger = center
          .locator(".responsive-data-view__mobile")
          .getByRole("button")
          .filter({ hasText: data.items[0].name });
        const open = async () => {
          if (width <= 760) {
            await trigger.click();
            await expect(drawer).toBeVisible();
          }
        };
        const close = async () => {
          if (width <= 760 && (await drawer.count())) {
            await page.keyboard.press("Escape");
            await expect(drawer).toHaveCount(0);
          }
        };
        const startRead = async () => {
          await center.getByRole("button", { name: "刷新状态", exact: true }).click();
          await expect.poll(() => Boolean(releaseRead)).toBe(true);
        };
        const startProbe = async () => {
          if (width <= 760)
            await drawer.getByRole("button", { name: "执行健康检查", exact: true }).click();
          else await rowA.getByRole("button", { name: "健康检查", exact: true }).click();
          await expect.poll(() => Boolean(releaseProbe)).toBe(true);
        };
        const settleRead = async () => {
          releaseRead();
          releaseRead = undefined;
          heldRead = false;
          await expect.poll(() => readFinished).toBe(true);
          await expect(center.getByRole("button", { name: "刷新状态", exact: true })).toBeEnabled();
        };
        const settleProbe = async () => {
          releaseProbe();
          releaseProbe = undefined;
          await expect(center.locator(".adapter-message")).toContainText("健康检查通过");
        };
        const shot = async (name) => {
          await page.clock.runFor(100);
          await page.evaluate(() => document.fonts.ready);
          if (width <= 760 && (await drawer.count())) {
            const tech = drawer.getByText("技术详情", { exact: true });
            if (!(await tech.locator("..").getAttribute("open"))) await tech.click();
            await drawer.evaluate((el) => {
              el.scrollTop = el.scrollHeight;
            });
          } else if (await rowA.count()) await rowA.scrollIntoViewIfNeeded();
          if (!capture) return;
          const bytes = await page.screenshot({ animations: "disabled" });
          const file = mode + "-" + width + "-" + scenario + "-" + name + ".png";
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            mode,
            width,
            scenario,
            state: name,
            file,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };
        for (const kind of ["pre-success", "pre-error", "during-early", "during-late"]) {
          scenario = kind;
          rows = data.items;
          readStatus = 200;
          heldRead = false;
          readFinished = false;
          nextReadId = "initial";
          await page.goto(origin + "/platform-admin/providers/adapters");
          await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
          heldRead = true;
          nextReadId = "obsolete-read";
          readStatus = kind === "pre-error" ? 500 : 200;
          rows = kind.startsWith("during") ? [] : data.items;
          if (kind.startsWith("pre")) {
            await startRead();
            await open();
            await startProbe();
            await settleProbe();
            await settleRead();
          } else {
            await open();
            await startProbe();
            await close();
            await startRead();
            await open();
            if (kind === "during-early") {
              await settleRead();
              await settleProbe();
            } else {
              await settleProbe();
              await settleRead();
            }
          }
          const disappeared = mode === "baseline" && kind.startsWith("during");
          await expect(center.locator(".adapter-toolbar > span")).toHaveText(
            disappeared ? "0 个结果" : "2 个结果",
          );
          if (!disappeared) {
            const version =
              mode === "baseline" && kind === "pre-success" ? "rss-v1" : "rss-read-order-v3";
            await expect(rowA).toContainText(version);
            check("visible adapter version", version, version);
          }
          check("rows retained", await center.locator("tbody tr").count(), disappeared ? 0 : 2);
          if (width <= 760) {
            check("detail remains open", await drawer.count(), disappeared ? 0 : 1);
            if (!disappeared) {
              await expect(drawer.locator(".adapter-detail-feedback")).toContainText(
                "健康检查通过",
              );
              check("owned probe feedback preserved", true);
            }
          }
          const message = await center.locator(".adapter-message > span").textContent();
          if (mode === "current") assert.equal(message, data.items[0].name + " 健康检查通过");
          if (mode === "baseline" && kind === "pre-error")
            assert.equal(message, "旧读取失败，请稍后刷新。");
          check("page message", message, message);
          await shot("after-obsolete-read");
          await close();
          readStatus = 200;
          rows = [fresh, data.items[1]];
          nextReadId = "fresh-read";
          heldRead = false;
          await center.getByRole("button", { name: "刷新状态", exact: true }).click();
          await expect(rowA).toContainText("rss-read-order-v4");
          await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
          check("fresh post-probe read accepted", true);
          await open();
          await shot("fresh-read");
          await close();
          if (width <= 760) {
            await expect(trigger).toBeFocused();
            check("close restores trigger", true);
          }
          console.log("p47 read-order passed " + mode + " " + width + " " + kind);
        }
        scenario = "all";
        check("no unexpected network", unexpected, []);
        check("no browser errors", errors, []);
        check(
          "four bodyless probe requests",
          requests.filter((r) => r.key.startsWith("POST ")).map((r) => r.body),
          [null, null, null, null],
        );
        network.push({ mode, width, requests });
        runs.push({
          mode,
          width,
          rawComponentHash: hash(source),
          renderedComponentHash: hash(mode === "baseline" ? baseline : source),
          productionUntransformed: mode === "current",
        });
      } finally {
        await context.close();
      }
    }
    for (const mod of server.moduleGraph.idToModuleMap.values()) {
      const f = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
      if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css|json)$/.test(f))
        sources.add(f);
    }
    await server.close();
    server = null;
  }
  await browser.close();
  browser = null;
  if (capture) {
    const sourceHashes = Object.fromEntries(
      await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
    );
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P47-READ-ORDER-IMPLEMENTATION-r1",
          sourceHashes,
          checks,
          screenshots,
          network,
          runs,
          processesClosed: true,
          fixtureBoundary:
            "Original two fixture rows. Explicit synthetic same-source probe adapter version v3, late old/empty/error GET and fresh version v4. All API locally fulfilled; no real health checks, external sources, DB or permission validation.",
          remaining:
            "Only read/read and read/probe ordering; no route/unmount/probe cancellation, unknown-write policy, real screen-reader or full UI/production acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47读取顺序修复前后</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47读取顺序修复前后</h1><p>旧生产与当前实际Vue，未注入C样式；同来源版本v3/v4、旧空列表及错误均为受控样例，不代表真实采集或生产验收。</p>' +
        screenshots
          .map(
            (s) =>
              "<article><h2>" +
              s.mode +
              " · " +
              s.width +
              " · " +
              s.scenario +
              " · " +
              s.state +
              '</h2><img loading="lazy" src="' +
              s.file +
              '"></article>',
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      checks: checks.length,
      screenshots: screenshots.length,
      sources: sources.size,
      runs: runs.length,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
