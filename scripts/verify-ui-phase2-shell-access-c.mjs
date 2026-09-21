import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { shellReviewCss, shellReviewModule } from "./lib/ui-phase2-shell-vue-preview.mjs";
import {
  previewShellAccess,
  shellAccessCopy,
  shellAccessCss,
} from "./lib/ui-phase2-shell-access-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
assert.ok(process.argv.slice(2).length <= 1);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const output = "output/playwright/shell-access-vue-c-r1";
const shellFile = "apps/web/src/components/NavigationShell.vue";
const fixtureFile = "tests/e2e/m02-03-navigation-shell.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const candidates = [];
const visit = (node) => {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(ast) === "JSON.stringify" &&
    node.arguments[0]?.getText(ast).includes('request_id: "m02-03-forbidden"')
  )
    candidates.push(node.arguments[0]);
  ts.forEachChild(node, visit);
};
visit(ast);
assert.equal(candidates.length, 1);
const box = {};
vm.runInNewContext(
  ts.transpileModule(`globalThis.value=${candidates[0].getText(ast)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText,
  box,
);
const forbidden = JSON.parse(JSON.stringify(box.value));
const source = await read(shellFile),
  replacement = previewShellAccess(source);
const shells = [
  { shell: "member", path: "/home" },
  { shell: "organization_admin", path: "/org-admin" },
  { shell: "platform_admin", path: "/platform-admin" },
];
const scenes = [
  { status: 401, state: "expired", link: "/login" },
  { status: 403, state: "forbidden", link: "/home" },
  { status: 409, state: "context_required", link: "/select-context" },
  { status: 429, state: "rate_limited", attempts: 3 },
  { status: 503, state: "blocked", attempts: 3 },
];
const sources = new Set([
  shellFile,
  fixtureFile,
  shellReviewCss,
  shellReviewModule,
  shellAccessCss,
  "scripts/verify-ui-phase2-shell-access-c.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/ui-phase2-shell-access-preview.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [],
  ports = [];
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
if (capture) await mkdir(output); // Never overwrite a captured design revision.
let browser, server;
try {
  browser = await chromium.launch();
  for (const mode of smoke ? ["review"] : ["baseline", "review"]) {
    const reserved = reservePort();
    await new Promise((done) => reserved.listen(0, "127.0.0.1", done));
    const port = reserved.address().port;
    await new Promise((done) => reserved.close(done));
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
                name: "shell-access-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(shellFile).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: replacement, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="shell-vue-c shell-access-c">')
                    .replace(
                      "</head>",
                      [shellReviewCss, shellAccessCss]
                        .map(
                          (css) =>
                            `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}">`,
                        )
                        .join("") + "</head>",
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`Shell access ${mode} ${origin}`);
    for (const width of [390, 1440])
      for (const entry of smoke ? [shells[2]] : shells)
        for (const scene of smoke ? [scenes[1], scenes[3]] : scenes) {
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            locale: "zh-CN",
            timezoneId: "Asia/Shanghai",
            reducedMotion: "reduce",
          });
          const initial = deferred(),
            retry = deferred();
          let disposed = false;
          try {
            const page = await context.newPage(),
              checks = [],
              requests = [],
              unexpected = [],
              errors = [];
            let phase = "initial",
              navCalls = 0;
            const check = (name, actual, expected = true) => {
              assert.deepEqual(
                actual,
                expected,
                `${mode}/${width}/${entry.shell}/${scene.state}: ${name}`,
              );
              checks.push({ name, actual });
            };
            const shot = async (state) => {
              if (!capture) return;
              await page.evaluate(() => document.fonts.ready);
              await page.evaluate(() => window.scrollTo(0, 0));
              const bytes = await page.screenshot({ animations: "disabled" });
              const file = `${mode}-${width}-${entry.shell}-${state}.png`;
              assert.ok(!screenshots.some((item) => item.file === file));
              await writeFile(`${output}/${file}`, bytes);
              screenshots.push({
                file,
                mode,
                width,
                shell: entry.shell,
                state,
                sha256: hash(bytes),
                pixelWidth: bytes.readUInt32BE(16),
                pixelHeight: bytes.readUInt32BE(20),
              });
            };
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
              requests.push({ key, search: url.search, body: req.postData() });
              if (key === "GET /api/v1/auth/session-status")
                return route.fulfill({ json: { data: { authenticated: true } } });
              // Keep the existing local default theme. Preference failure is an explicit fixture, not saved preference proof.
              if (key === "GET /api/v1/me/ui-preferences")
                return route.fulfill({ status: 500, json: {} });
              if (
                key !== "GET /api/v1/me/navigation" ||
                url.searchParams.get("shell") !== entry.shell
              ) {
                unexpected.push(key);
                return route.abort();
              }
              navCalls++;
              await (phase === "initial" ? initial.promise : retry.promise);
              if (disposed) return;
              // Only 403 uses the original server-style fixture; other cases exercise status-only client fallbacks.
              return route.fulfill({
                status: scene.status,
                json: scene.status === 403 ? forbidden : { request_id: "", trace_id: "" },
              });
            });
            await page.goto(origin + entry.path);
            await page.waitForSelector('.role-shell[data-state="loading"] .role-gate-state');
            const gate = page.locator(".role-gate-state"),
              heading = gate.locator("h1");
            check(
              "loading has no authorized entries",
              await page.locator(".role-nav-menu a").count(),
              0,
            );
            check("loading has no retry control", await gate.locator("button").count(), 0);
            if (mode === "review" && scene.state === "expired") await shot("loading");
            initial.resolve();
            await page.waitForSelector(`.role-shell[data-state="${scene.state}"]`);
            check(
              "actual shell kind",
              await page.locator(".role-shell").getAttribute("data-shell"),
              entry.shell,
            );
            check(
              "state matches actual HTTP classification",
              await page.locator(".role-shell").getAttribute("data-state"),
              scene.state,
            );
            check("original automatic attempt count", navCalls, scene.attempts ?? 1);
            check(
              "no authorization menu leaked",
              await page.locator(".role-nav-menu a, .role-mobile-nav a").count(),
              0,
            );
            check("existing polite announcement", await gate.getAttribute("aria-live"), "polite");
            check(
              "trace availability follows payload",
              await gate.locator("details").count(),
              scene.status === 403 ? 1 : 0,
            );
            if (scene.link)
              check(
                "unchanged recovery link",
                await gate.locator(":scope > a").getAttribute("href"),
                scene.link,
              );
            if (mode === "review") {
              check(
                "gentle state-specific title",
                await heading.textContent(),
                shellAccessCopy.find(([key]) => key === scene.state)[2][0],
              );
              check(
                "no unimplemented return promise",
                !(await gate.textContent()).includes("重新登录后返回当前页面"),
              );
              check(
                "state fits first viewport",
                await gate.evaluate((node) => {
                  const rect = node.getBoundingClientRect();
                  return rect.y >= 60 && rect.bottom < innerHeight && rect.width <= innerWidth;
                }),
              );
              check(
                "page and panel no horizontal overflow",
                await gate.evaluate(
                  (node) =>
                    node.scrollWidth <= node.clientWidth + 1 &&
                    document.documentElement.scrollWidth <= innerWidth + 1,
                ),
              );
              check(
                "readable and touchable recovery",
                await gate
                  .locator(":scope > a, :scope > button")
                  .evaluateAll((nodes) =>
                    nodes.every(
                      (node) =>
                        node.getBoundingClientRect().height >= 44 &&
                        parseFloat(getComputedStyle(node).fontSize) >= 16,
                    ),
                  ),
              );
            }
            await shot(scene.state);
            if (scene.status === 403) {
              check(
                "trace initially folded",
                await gate.locator("details").getAttribute("open"),
                null,
              );
              await gate.locator("summary").focus();
              await page.keyboard.press("Enter");
              check("trace IDs unchanged", await gate.locator("code").allTextContents(), [
                `关联编号：${forbidden.request_id}`,
                `链路编号：${forbidden.trace_id}`,
              ]);
              if (mode === "review") await shot("forbidden-technical");
            }
            if (!scene.link) {
              phase = "retry";
              await gate.locator("button").focus();
              await page.keyboard.press("Enter");
              await page.waitForSelector('.role-shell[data-state="loading"]');
              check("retry clears prior identifiers", await gate.locator("details").count(), 0);
              check("retry cannot be submitted twice", await gate.locator("button").count(), 0);
              if (mode === "review") {
                check(
                  "retry focuses persistent state heading",
                  await heading.evaluate((node) => node === document.activeElement),
                );
                await shot(`${scene.state}-recheck-loading`);
              }
              retry.resolve();
              await page.waitForSelector(`.role-shell[data-state="${scene.state}"]`);
              check(
                "explicit retry preserves safe attempt count",
                navCalls,
                (scene.attempts ?? 1) * 2,
              );
              if (mode === "review")
                check(
                  "repeat failure retains heading focus",
                  await heading.evaluate((node) => node === document.activeElement),
                );
            }
            check(
              "no writes or request body",
              requests.every((item) => item.key.startsWith("GET ") && item.body === null),
            );
            check("no unexpected network", unexpected, []);
            check("no runtime errors", errors, []);
            runs.push({ mode, width, shell: entry.shell, state: scene.state, checks, requests });
          } finally {
            disposed = true;
            initial.resolve();
            retry.resolve();
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
  await includeImportedStyleSources(sources, (file) =>
    file.startsWith("apps/web/src/") ? read(file) : "",
  );
  await browser.close();
  browser = null;
  const evidence = {
    kind: "SHELL-ACCESS-VUE-C-r1",
    reviewOnly: true,
    userReview: "pending",
    processesClosed: true,
    runs,
    screenshots,
    ports,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    boundary:
      "Actual App and NavigationShell, three real route shells; review-only six copy pairs, gate styling and retry focus wrapper. Local error GET fixtures, original 403 payload and derived status-only fallbacks. Recheck returns the same error, not successful restoration. Recovery hrefs checked, destination login/context flows not exercised. No production permissions, theme saving, business pages or full acceptance.",
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C 导航访问状态审核</title><style>body{font:16px/1.7 sans-serif;margin:24px;background:#f3f6fb;color:#172d4c}img{max-width:100%;height:auto}article{margin:32px 0}a{color:#244bb0}</style><h1>C 导航壳 · 三壳层访问状态</h1><p>待审核；baseline 为原界面，review 为本地真实 Vue 提案。菜单授权没有放宽。重查仍返回原错误，不代表已恢复权限；登录和工作区目标仅核对链接。</p><a href="evidence.json">机器证据</a>' +
        screenshots
          .map(
            (shot) =>
              `<article><h2>${shot.mode} / ${shot.shell} / ${shot.width} / ${shot.state}</h2><a href="${shot.file}"><img loading="lazy" alt="${shot.mode} ${shot.shell} ${shot.state}" src="${shot.file}"></a></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, run) => n + run.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
      ports,
      processesClosed: true,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
