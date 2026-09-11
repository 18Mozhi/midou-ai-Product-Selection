import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { previewAdapterAccess, accessCopy } from "./lib/ui-phase2-adapter-access-preview.mjs";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p47-access-review",
  component = "apps/web/src/components/ProviderAdapterCenter.vue",
  css = "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-access-preview.css",
  fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewAdapterAccess(source);
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
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
const cases = [
  { name: "expired", status: 401, kind: "expired", attempts: 1 },
  { name: "forbidden", status: 403, kind: "forbidden", attempts: 1 },
  { name: "rate", status: 429, kind: "blocked", attempts: 3 },
  { name: "dependency", status: 503, kind: "blocked", attempts: 3 },
  { name: "error-unchanged", status: 500, kind: "error", attempts: 1 },
];
const sources = new Set([
    component,
    css,
    fixture,
    "scripts/lib/ui-phase2-adapter-access-preview.mjs",
    "scripts/verify-ui-phase2-provider-adapter-access.mjs",
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
                name: "p47-access-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: replacement, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p47-access-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`P47 access ${mode} ${origin}`);
    for (const width of [390, 760, 1440])
      for (const scene of cases) {
        const context = await browser.newContext({
          viewport: { width, height: 1200 },
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
          reducedMotion: "reduce",
        });
        let releaseRecovery;
        try {
          const page = await context.newPage(),
            requests = [],
            unexpected = [],
            errors = [],
            checks = [];
          let reads = 0,
            failedReads = 0,
            recovering = false;
          const recoveryGate = new Promise((resolve) => (releaseRecovery = resolve));
          const check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${mode}/${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
          };
          const picture = async (locator, suffix) => {
            if (!capture) return;
            const file = `${mode}-${width}-${scene.name}-${suffix}.png`,
              bytes = await locator.screenshot({ animations: "disabled" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              mode,
              width,
              scene: scene.name,
              suffix,
              sha256: hash(bytes),
              pixelWidth: bytes.readUInt32BE(16),
              pixelHeight: bytes.readUInt32BE(20),
            });
          };
          await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });
          page.on("pageerror", (error) => errors.push(error.message));
          await page.route("**/*", async (route) => {
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
            if (recovering) {
              await recoveryGate;
              return route.fulfill({ json: { data: data.items, request_id: "access-recovered" } });
            }
            failedReads++;
            return route.fulfill({
              status: scene.status,
              json: {
                error: {
                  code: `access_${scene.name}`,
                  message: "本地访问状态样例",
                  action_hint: "本地测试动作提示",
                },
                request_id: `access-${scene.name}-${failedReads}`,
              },
            });
          });
          await page.goto(origin + "/platform-admin/providers/adapters");
          const center = page.locator(".adapter-center"),
            panel = center.locator(".ui-state-panel"),
            primary = panel.locator("footer .primary");
          await expect(panel).toHaveAttribute("data-kind", scene.kind);
          await expect(panel).toHaveAttribute("aria-live", "assertive");
          check("safe initial attempts", failedReads, scene.attempts);
          check("no fabricated metrics", await center.locator(".adapter-metrics").count(), 0);
          check("one visible action", await panel.getByRole("button").count(), 1);
          check(
            "sanitized final request ID",
            await panel.locator("dd").textContent(),
            `access-${scene.name}-${scene.attempts}`,
          );
          if (mode === "review" && scene.name !== "error-unchanged") {
            await expect(panel.getByRole("heading")).toHaveText(accessCopy[scene.kind].title);
            await expect(panel).toContainText(accessCopy[scene.kind].description);
            await expect(primary).toHaveText(accessCopy[scene.kind].action);
            check(
              "decorative symbol hidden",
              await panel.locator(".ui-state-symbol").isVisible(),
              false,
            );
            check(
              "generic English eyebrow hidden",
              await panel.locator(":scope > p").isVisible(),
              false,
            );
          }
          await primary.scrollIntoViewIfNeeded();
          await primary.focus();
          await expect(primary).toBeFocused();
          check(
            "action is at least44px",
            await primary.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return r.width >= 44 && r.height >= 44;
            }),
          );
          check(
            "no horizontal overflow",
            await panel.evaluate(
              (el) =>
                el.scrollWidth <= el.clientWidth + 1 &&
                document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          await page.evaluate(() => document.fonts.ready);
          await picture(panel, "state");
          const accessState = scene.name !== "error-unchanged";
          if (mode === "review" && scene.kind === "expired") {
            await page.keyboard.press("Enter");
            await expect(page.locator(".identity-page[data-mode='login']")).toBeVisible();
            check("expired reaches verified login route", new URL(page.url()).pathname, "/login");
            check("expired does not reread adapters", reads, scene.attempts);
            await picture(page.locator(".identity-card"), "action");
          } else {
            recovering = true;
            await page.keyboard.press("Enter");
            await expect.poll(() => reads).toBe(scene.attempts + 1);
            const focus =
              mode === "review" && accessState
                ? center.locator(".adapter-heading")
                : page.locator("body");
            await expect(focus).toBeFocused();
            check(
              "pending focus target",
              await page.evaluate(() =>
                document.activeElement?.matches(".adapter-heading")
                  ? "heading"
                  : document.activeElement?.tagName,
              ),
              mode === "review" && accessState ? "heading" : "BODY",
            );
            await picture(center.locator(".adapter-heading"), "action");
            releaseRecovery();
            await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
            check(
              "settled recovery keeps chosen focus",
              await focus.evaluate((el) => document.activeElement === el),
            );
            check("one explicit recovery GET", reads, scene.attempts + 1);
          }
          check("no write requests", requests.filter((r) => !r.key.startsWith("GET ")).length, 0);
          check(
            "no request bodies",
            requests.every((r) => r.body === null),
          );
          check("no unexpected network", unexpected, []);
          check("no runtime errors", errors, []);
          runs.push({ mode, width, scene: scene.name, kind: scene.kind, checks, requests });
        } finally {
          releaseRecovery?.();
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
      (item) => item.mode === "review" && item.scene === "error-unchanged",
    )) {
      const before = screenshots.find(
          (item) =>
            item.mode === "baseline" &&
            item.width === shot.width &&
            item.scene === shot.scene &&
            item.suffix === shot.suffix,
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
      // Preserve measured font-raster noise explicitly; never claim byte-identical PNGs.
      assert.ok(pixels.changedPixels <= 64 && pixels.maxChannelDelta <= 2, JSON.stringify(pixels));
      comparisons.push({ width: shot.width, suffix: shot.suffix, ...pixels });
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
          kind: "P47-ACCESS-REVIEW-r1",
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
            "Actual App and UiStatePanel. Review-only P47 access copy/CSS plus verified /login action and local heading-focus handler. 401/403/429/503 plus unchanged500, local recovery only. Original APIs/status mapping/retries/data/permissions unchanged; no real auth/permission/dependency/probe/write/deploy or full a11y acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 访问状态审核</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 访问状态 · 独立审核稿</h1><p>实际Vue，本地401/403/429/503及未改500。生产未改；动作图用于验证路由/焦点，不代表目标页或权限恢复通过。</p>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.mode} / ${s.width} / ${s.scene} / ${s.suffix}</h2><img loading="lazy" alt="${s.scene} ${s.suffix}" src="${s.file}"></article>`,
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
      ports,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
