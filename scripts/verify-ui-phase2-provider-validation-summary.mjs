import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const baseline = process.argv.includes("--baseline"),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => ["--baseline", "--capture"].includes(v)));
const mode = baseline ? "baseline" : "current";
const output = `output/playwright/p46-validation-summary/${mode}`;
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const registry = "apps/web/src/components/ProviderRegistry.vue";
const source = await read(registry);
const previous = execFileSync("git", ["show", "fa69ae75:" + registry], {
  encoding: "utf8",
}).replaceAll("\r\n", "\n");
const names = [...source.matchAll(/<span id="provider-field-(\w+)-label">([^<]+)<\/span\s*>/g)].map(
  (m) => ({ key: m[1], name: m[2] }),
);
assert.equal(names.length, 23);
const groups = [names.slice(0, 5), names.slice(5, 11), names.slice(11, 18), names.slice(18)];
const fixture = "tests/e2e/m03-01-provider-registry.spec.ts";
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const box = {};
vm.runInNewContext(
  ["definition", "navigation"]
    .map((name) => {
      const matches = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(matches.length, 1);
      return `const ${name}=${matches[0].initializer.getText(ast)};`;
    })
    .join("\n") + "globalThis.data={definition,navigation};",
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
const sources = new Set([
  registry,
  fixture,
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-provider-validation-summary.mjs",
]);
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p46-summary-baseline",
      enforce: "pre",
      transform(text, id) {
        if (id.replaceAll("\\", "/") !== path.resolve(registry).replaceAll("\\", "/")) return null;
        assert.equal(text.replaceAll("\r\n", "\n"), source);
        return baseline ? { code: previous, map: null } : null;
      },
    },
  ],
});
const observations = [],
  screenshots = [],
  checks = [],
  network = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  console.log("p46_desktop_host " + origin);
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
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}:${name}`);
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
        if (
          ![
            "GET /api/v1/auth/session-status",
            "GET /api/v1/me/navigation",
            "GET /api/v1/platform/providers",
            "POST /api/v1/platform/providers",
          ].includes(key)
        ) {
          unexpected.push(key);
          return route.abort();
        }
        requests.push({ key, body: req.postDataJSON() });
        if (req.method() === "POST")
          return route.fulfill({
            status: 409,
            json: {
              error: {
                code: "VERSION_CONFLICT",
                message: "版本冲突",
                action_hint: "请核对来源版本后重试。",
              },
              request_id: "summary-conflict",
              trace_id: "summary-conflict",
            },
          });
        return route.fulfill({
          json: {
            data: url.pathname.endsWith("session-status")
              ? { authenticated: true }
              : url.pathname.endsWith("navigation")
                ? data.navigation
                : [data.definition],
            request_id: "field-sample",
            trace_id: "field-sample",
          },
        });
      });
      await page.goto(origin + "/platform-admin/providers");
      await expect(page.locator(".provider-list-tools")).toBeVisible();
      check("production body marker", await page.locator("body").getAttribute("class"), null);
      await page.getByRole("button", { name: "＋ 新建来源", exact: true }).click();
      const panel = page.locator(".provider-editor");
      const settle = async () => {
        await page.clock.runFor(100);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(async () => {
          await Promise.all(
            document
              .getAnimations()
              .filter(
                (a) =>
                  a.playState === "running" &&
                  Number.isFinite(a.effect?.getComputedTiming().endTime),
              )
              .map((a) =>
                a.finished.catch((e) => {
                  if (e?.name !== "AbortError") throw e;
                }),
              ),
          );
        });
      };
      const shot = async (state, locator = null) => {
        await settle();
        if (locator) await locator.scrollIntoViewIfNeeded();
        else
          await panel.evaluate((n) => {
            n.scrollTop = 0;
          });
        await settle();
        check(
          state + " width",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        const bytes = locator
          ? await locator.screenshot({ animations: "allow" })
          : await page.screenshot({ animations: "allow" });
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

      const input = (key) => panel.locator('[aria-labelledby="provider-field-' + key + '-label"]');
      const summary = panel.locator(".provider-editor-message");
      const next = () => panel.getByRole("button", { name: "下一步", exact: true }).click();
      const step = (n) =>
        panel
          .locator(".provider-editor-steps button")
          .nth(n - 1)
          .click();
      const record = async (state, expected) => {
        await settle();
        const value = (await summary.count())
          ? (await summary.locator(":scope > span").innerText()).trim()
          : "";
        check(state + " summary", value, expected);
        observations.push({
          width,
          state,
          message: value,
          fieldErrors: await panel.locator(".provider-fields small").count(),
          traceVisible: await summary.locator("details").count(),
        });
        await shot(state, (await summary.count()) ? summary : panel.locator(".provider-fields"));
      };
      await next();
      await record("step1-three", "当前步骤还有 3 项需要修正。");
      await input("code").fill("public_signal_rss");
      await record(
        "step1-two",
        baseline ? "当前步骤还有 3 项需要修正。" : "当前步骤还有 2 项需要修正。",
      );
      await input("name").fill("公开趋势 RSS");
      await record(
        "step1-one",
        baseline ? "当前步骤还有 3 项需要修正。" : "当前步骤还有 1 项需要修正。",
      );
      await input("target_url").fill("https://example.test/feed");
      await record("step1-cleared", baseline ? "当前步骤还有 3 项需要修正。" : "");
      await next(); // Existing successful Next resets feedback in both versions.
      await step(1);
      await input("name").fill("");
      await next();
      await step(2);
      await record("direct-step", baseline ? "当前步骤还有 1 项需要修正。" : "");
      await input("markets").fill("");
      await next();
      await record("step2-one", "当前步骤还有 1 项需要修正。");
      await panel.getByRole("button", { name: "应用技术模板", exact: true }).click();
      const templateText = await summary.locator(":scope > span").innerText();
      await input("markets").fill("US");
      await record("template-preserved", templateText);
      await step(3);
      await input("schedule_minutes").fill("0");
      await next();
      await record("step3-one", "当前步骤还有 1 项需要修正。");
      await input("schedule_minutes").fill("30");
      await record("step3-cleared", baseline ? "当前步骤还有 1 项需要修正。" : "");
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await page.getByRole("button", { name: "＋ 新建来源", exact: true }).click();
      await record("reopen-cleared", "");
      await input("code").fill("public_signal_rss");
      await input("name").fill("公开趋势 RSS");
      await input("target_url").fill("https://example.test/feed");
      await step(4);
      await panel.locator('button[type="submit"]').click();
      await expect(summary).toBeVisible();
      const serverText = await summary.locator(":scope > span").innerText();
      check("server failure returned", serverText.includes("版本"), true);
      await step(1);
      await input("name").fill("");
      await record("server-message-preserved", serverText);
      check("server trace preserved", await summary.locator("details").count(), 1);
      await next();
      await record("new-validation", "当前步骤还有 1 项需要修正。");
      check(
        "validation trace detached",
        await summary.locator("details").count(),
        baseline ? 1 : 0,
      );
      await input("name").fill("公开趋势 RSS");
      await record("final-cleared", baseline ? "当前步骤还有 1 项需要修正。" : "");
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(page.getByRole("button", { name: "＋ 新建来源", exact: true })).toBeFocused();
      check("close restores trigger", true);
      check("no unexpected network", unexpected, []);
      check("no browser errors", errors, []);
      check("one rejected write", requests.filter((r) => r.key.startsWith("POST ")).length, 1);
      network.push({ width, requests });
      console.log(`fields passed ${width}`);
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
          kind: "P46-VALIDATION-SUMMARY-r1",
          mode,
          sourceHashes,
          renderedRegistryHash: hash(baseline ? previous : source),
          observations,
          screenshots,
          checks,
          network,
          processesClosed: true,
          scope:
            "Real current App and production CSS. Existing validation summary updates/clears, template and server errors retain ownership; two GET and one rejected POST per width. No real permissions or persistence, no full a11y or production acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46错误汇总交互</title><style>body{font:16px/1.6 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P46 错误汇总前后对照 · ' +
        mode +
        "</h1><p>真实 Vue、本地样例、未上线。语义观察见 evidence.json；截图不能证明读屏器播报。</p>" +
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
      observations: observations.length,
      screenshots: screenshots.length,
      sources: sources.size,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
