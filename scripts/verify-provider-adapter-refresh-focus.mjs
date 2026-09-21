import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { beforeAdapterRefreshFocus } from "./lib/ui-phase2-adapter-refresh-focus-baseline.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const root = "output/playwright/p47-refresh-focus";
const file = "apps/web/src/components/ProviderAdapterCenter.vue";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (x) => createHash("sha256").update(x).digest("hex");
const source = await read(file),
  before = beforeAdapterRefreshFocus(source);
assert.notEqual(source, before);
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
        const found = declarations.filter((n) => n.name.getText(ast) === name);
        assert.equal(found.length, 1);
        return `const ${name}=${found[0].initializer.getText(ast)};`;
      })
      .join("\n") + "globalThis.data={navigation,items};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
const sources = new Set([
  file,
  fixture,
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "scripts/verify-provider-adapter-refresh-focus.mjs",
  "scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs",
]);
const runs = [],
  pictures = [],
  ports = [];
let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(root, { recursive: true });
  for (const mode of ["before", "current"]) {
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
      plugins:
        mode === "before"
          ? [
              {
                name: "exact-refresh-focus-before",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(file).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: before, map: null };
                },
              },
            ]
          : [],
    });
    await server.listen();
    console.log(`P47 refresh focus ${mode} ${origin}`);
    for (const width of [390, 760, 761, 1440])
      for (const outcome of ["success", "failure"]) {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
          reducedMotion: "reduce",
        });
        let release;
        try {
          const page = await context.newPage(),
            requests = [],
            errors = [],
            unexpected = [],
            checks = [];
          let reads = 0;
          const check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${mode}/${width}/${outcome}: ${name}`);
            checks.push({ name, actual });
          };
          page.on("pageerror", (error) => errors.push(error.message));
          await page.clock.install({ time: new Date("2026-09-12T04:00:00Z") });
          await page.route("**/*", async (route) => {
            const req = route.request(),
              url = new URL(req.url()),
              key = req.method() + " " + url.pathname;
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
            if (reads > 1)
              await new Promise((resolve) => {
                release = resolve;
              });
            return reads === 1 || outcome === "success"
              ? route.fulfill({ json: { data: data.items, request_id: "refresh-result" } })
              : route.fulfill({
                  status: 409,
                  json: {
                    error: {
                      code: "conflict",
                      message: "本地刷新失败",
                      action_hint: "请稍后重新读取最新状态。",
                    },
                    request_id: "refresh-result",
                  },
                });
          });
          await page.goto(origin + "/platform-admin/providers/adapters");
          const center = page.locator(".adapter-center"),
            heading = center.locator(".adapter-heading"),
            button = heading.getByRole("button", { name: "刷新状态", exact: true }),
            input = center.getByRole("searchbox", { name: "搜索来源" });
          await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
          await input.fill("公开趋势");
          for (const action of ["Enter", "Space", "pointer"]) {
            await button.scrollIntoViewIfNeeded();
            await button.focus();
            await expect(button).toBeFocused();
            const scroll = await page.evaluate(() => [scrollX, scrollY]);
            if (action === "pointer") await button.click();
            else await page.keyboard.press(action);
            await expect.poll(() => Boolean(release)).toBe(true);
            const pending = heading.getByRole("button", { name: "刷新中…", exact: true });
            await expect(pending).toBeDisabled();
            const target = mode === "current" ? heading : page.locator("body");
            await expect(target).toBeFocused();
            check(
              action + " pending focus",
              mode === "current" ? "heading" : "BODY",
              mode === "current" ? "heading" : "BODY",
            );
            check(
              action + " no forced scroll",
              await page.evaluate(() => [scrollX, scrollY]),
              scroll,
            );
            if (mode === "current" && action !== "pointer") {
              check(
                action + " visible focus",
                await heading.evaluate(
                  (el) =>
                    el.matches(":focus-visible") &&
                    getComputedStyle(el).outlineStyle === "solid" &&
                    parseFloat(getComputedStyle(el).outlineWidth) >= 3,
                ),
              );
            }
            if (capture && action === "Enter" && outcome === "success") {
              await page.evaluate(() => document.fonts.ready);
              const bytes = await page.screenshot({ animations: "disabled" }),
                name = `${mode}-${width}-keyboard-pending.png`;
              await writeFile(`${root}/${name}`, bytes);
              pictures.push({
                file: name,
                mode,
                width,
                sha256: hash(bytes),
                pixelWidth: bytes.readUInt32BE(16),
                pixelHeight: bytes.readUInt32BE(20),
              });
            }
            if (action === "Space") {
              if (mode === "current") {
                await page.keyboard.press("Tab");
                await expect(
                  heading.getByRole("link", { name: "返回来源定义", exact: true }),
                ).toBeFocused();
                check("Tab skips disabled refresh to existing link", true);
              }
              await input.focus();
              await expect(input).toBeFocused();
            }
            release();
            release = undefined;
            await expect(button).toBeEnabled();
            await expect(action === "Space" ? input : target).toBeFocused();
            check(action + " settlement does not steal focus", true);
            await expect(input).toHaveValue("公开趋势");
            await expect(center.locator(".adapter-toolbar > span")).toHaveText("1 个结果");
            await expect(center.locator(".adapter-message")).toContainText(
              outcome === "success" ? "已刷新 2 个来源适配器状态" : "请稍后重新读取最新状态。",
            );
            check(action + " retained snapshot and real fixture outcome", true);
          }
          check("one initial and three explicit GETs", reads, 4);
          check(
            "bodyless local reads only",
            requests.every((r) => r.key.startsWith("GET ") && r.body === null),
          );
          check("no unexpected transport", unexpected, []);
          check("no browser errors", errors, []);
          runs.push({ mode, width, outcome, checks, requests });
          console.log(`P47 refresh focus passed ${mode} ${width} ${outcome}`);
        } finally {
          release?.();
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
  sources.add("scripts/lib/ui-imported-style-sources.mjs");
  await includeImportedStyleSources(sources, read);
  await browser.close();
  browser = null;
  if (capture) {
    await writeFile(
      `${root}/evidence.json`,
      JSON.stringify(
        {
          kind: "P47-REFRESH-FOCUS-r1",
          beforeSha: hash(before),
          currentSha: hash(source),
          sourceHashes: Object.fromEntries(
            await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
          ),
          ports,
          processesClosed: true,
          runs,
          pictures,
          boundary:
            "Exact pre-fix Vue/current raw Vue. Local GET fixtures only; no real API or permission acceptance. Existing styles; native Enter/Space/pointer, focus ownership, Tab, explicit read counts and settlement. Default reduced-motion only; not all page states or visual approval.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${root}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47刷新键盘焦点</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}</style><h1>P47刷新键盘焦点</h1><p>原布局不变。当前版本将焦点移到持久标题区域；本地样例，不代表生产验收。</p>' +
        pictures
          .map(
            (p) =>
              `<h2>${p.mode} · ${p.width}</h2><img src="${p.file}" alt="${p.mode} ${p.width} 刷新等待焦点">`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, r) => n + r.checks.length, 0),
      pictures: pictures.length,
      ports,
      processesClosed: true,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
