import assert from "node:assert/strict";
import { historicalAdapterFeedbackSource } from "./lib/ui-phase2-adapter-feedback-baseline.mjs";
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
  "design-plans/ui-phase-2-2026-09-07/implementation/ProviderAdapterDetailPreview.vue";
const css = "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-vue-preview.css";
const detailCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-detail-preview.css";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const feedbackCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-feedback-review.css";
const output = "output/playwright/p47-probe-feedback";
const source = await read(component),
  replacement = await read(preview);
const baseline = historicalAdapterFeedbackSource(component, source);
assert.equal(baseline.split("</script>")[0], replacement.split("</script>")[0]);
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = [];
function visit(n) {
  if (ts.isVariableDeclaration(n)) declarations.push(n);
  ts.forEachChild(n, visit);
}
visit(ast);
const code =
  ["navigation", "base", "items"]
    .map((name) => {
      const matches = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(matches.length, 1, name);
      return `const ${name} = ${matches[0].initializer.getText(ast)};`;
    })
    .join("\n") + "globalThis.data={navigation,base,items};";
const box = {};
vm.runInNewContext(
  ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data));

const feedback = source.match(
  /\n          <div class="adapter-detail-feedback">[\s\S]*?\n          <\/div>/,
)[0];
const probeButton =
  /<button type="button" :disabled="probing !== null" @click="probe\(row\)">[\s\S]*?<\/button>/;
assert.ok(probeButton.test(replacement));
const review =
  source.split("</script>")[0] +
  "</script>" +
  replacement
    .slice(replacement.indexOf("</script>") + 9)
    .replace(probeButton, (m) => m.replace("probe(row)", "probe(row, $event)") + feedback) +
  source.slice(source.indexOf("<style scoped>"));
const modes = ["baseline", "current", "review"],
  checks = [],
  screenshots = [],
  network = [],
  runs = [];
const sources = new Set([
  component,
  preview,
  css,
  detailCss,
  feedbackCss,
  fixture,
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-provider-adapter-feedback.mjs",
  "scripts/lib/ui-phase2-adapter-feedback-baseline.mjs",
]);
let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const mode of modes) {
    const rendered = mode === "baseline" ? baseline : mode === "review" ? review : source;
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
          name: "p47-feedback-evidence",
          enforce: "pre",
          transform(text, id) {
            if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
              return null;
            assert.equal(text.replaceAll("\r\n", "\n"), source);
            return mode === "current" ? null : { code: rendered, map: null };
          },
          transformIndexHtml(html) {
            if (mode !== "review") return html;
            return html
              .replace("<body>", '<body class="p47-adapter-review">')
              .replace(
                "</head>",
                [css, detailCss, feedbackCss]
                  .map(
                    (f) =>
                      '<link rel="stylesheet" href="/@fs/' +
                      path.resolve(f).replaceAll("\\", "/") +
                      '">',
                  )
                  .join("") + "</head>",
              );
          },
        },
      ],
    });
    await server.listen();
    const origin = "http://127.0.0.1:" + port;
    console.log("p47 feedback host " + mode + " " + origin);
    for (const width of mode === "review" ? [390, 760] : [390, 760, 1440]) {
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
          releaseRead,
          releaseProbe,
          probeStatus = 409,
          probeRow = data.items[0];
        let readNumber = 0,
          probeNumber = 0;
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, mode + ":" + width + ":" + name);
          checks.push({ mode, width, name, actual });
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
          const isProbe = data.items.some(
            (r) => key === "POST /api/v1/platform/provider-adapters/" + r.id + "/health-check",
          );
          if (
            !isProbe &&
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
          if (isProbe) {
            probeNumber++;
            const id = "probe-" + probeNumber;
            await new Promise((resolve) => {
              releaseProbe = resolve;
            });
            return route.fulfill(
              probeStatus === 200
                ? { json: { data: probeRow, request_id: id, trace_id: id } }
                : {
                    status: 409,
                    json: {
                      error: {
                        code: "version_conflict",
                        message: "检查冲突",
                        action_hint: "请重新读取状态后检查。",
                      },
                      request_id: id,
                      trace_id: id,
                    },
                  },
            );
          }
          if (url.pathname.endsWith("navigation"))
            return route.fulfill({ json: { data: data.navigation, request_id: "nav" } });
          if (url.pathname.endsWith("session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          const id = "read-" + ++readNumber;
          if (heldRead)
            await new Promise((resolve) => {
              releaseRead = resolve;
            });
          return route.fulfill({ json: { data: data.items, request_id: id, trace_id: id } });
        });
        const center = page.locator(".adapter-center"),
          drawer = page.locator(".responsive-data-view__drawer");
        const local = drawer.locator(".adapter-detail-feedback"),
          status = local.getByRole("status");
        const trigger = (name) =>
          center
            .locator(".responsive-data-view__mobile")
            .getByRole("button")
            .filter({ hasText: name });
        const open = async (name) => {
          await trigger(name).click();
          await expect(drawer).toBeVisible();
        };
        const close = async (name) => {
          if (
            mode === "baseline" &&
            !(await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))))
          )
            await drawer.getByRole("button", { name: "关闭详情", exact: true }).click();
          else await page.keyboard.press("Escape");
          await expect(drawer).toHaveCount(0);
          await expect(trigger(name)).toBeFocused();
        };
        const startProbe = async () => {
          await drawer.getByRole("button", { name: "执行健康检查", exact: true }).click();
          await expect(drawer.getByRole("button", { name: "检查中…", exact: true })).toBeDisabled();
          await expect.poll(() => Boolean(releaseProbe)).toBe(true);
        };
        const settleProbe = async () => {
          assert.ok(releaseProbe);
          releaseProbe();
          releaseProbe = undefined;
          await expect(center.locator(".adapter-message")).not.toHaveCount(0);
          await expect(
            drawer.getByRole("button", { name: "执行健康检查", exact: true }),
          ).toBeEnabled();
        };
        const shot = async (name, target = null) => {
          await page.clock.runFor(100);
          await page.evaluate(() => document.fonts.ready);
          if (target) await target.scrollIntoViewIfNeeded();
          if (!capture) return;
          const bytes = target
            ? await target.screenshot({ animations: "disabled" })
            : await page.screenshot({ animations: "disabled" });
          const file = mode + "-" + width + "-" + name + ".png";
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            mode,
            width,
            state: name,
            file,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };
        await page.goto(origin + "/platform-admin/providers/adapters");
        await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
        if (width > 760) {
          const button = center
            .locator("tbody tr")
            .filter({ hasText: "公开趋势 RSS" })
            .getByRole("button", { name: "健康检查", exact: true });
          await button.click();
          await expect(center.getByRole("button", { name: "检查中…", exact: true })).toBeDisabled();
          await expect.poll(() => Boolean(releaseProbe)).toBe(true);
          releaseProbe();
          await expect(center.locator(".adapter-message")).toContainText("重新读取状态后检查");
          check("desktop original feedback", true);
          check(
            "desktop no detail feedback",
            await page.locator(".adapter-detail-feedback").count(),
            0,
          );
          await shot("desktop-feedback", center.locator(".adapter-message"));
        } else {
          const a = data.items[0].name,
            b = data.items[1].name;
          await open(a);
          check(
            "local region exists before request",
            await status.count(),
            mode === "baseline" ? 0 : 1,
          );
          if (mode !== "baseline") await expect(status).toHaveText("");
          await startProbe();
          check(
            "pending focus remains inside drawer",
            await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))),
            mode !== "baseline",
          );
          if (mode !== "baseline") {
            await expect(status).toHaveText("正在检查此来源，请稍候。");
            await expect(status).toBeFocused();
            check("pending focus is the live region", true);
          }
          await shot("pending", mode === "baseline" ? drawer : local);
          await close(a);
          await open(a);
          if (mode !== "baseline") await expect(status).toContainText("正在检查此来源");
          check("same source reopen pending", true);
          await close(a);
          await open(b);
          if (mode !== "baseline") await expect(status).toContainText("另一来源正在检查");
          check("different source pending explanation", mode !== "baseline", mode !== "baseline");
          await shot("other-source-pending", mode === "baseline" ? drawer : local);
          await settleProbe();
          await expect(drawer.getByRole("button", { name: "关闭详情", exact: true })).toBeFocused();
          check("late other-source result does not steal focus", true);
          if (mode !== "baseline") {
            await expect(status).toHaveText("");
            await expect(local.locator("details")).toHaveCount(0);
          }
          check("different source never shows result or trace", true);
          await close(b);
          await open(a);
          if (mode !== "baseline") {
            await expect(status).toHaveText("请重新读取状态后检查。");
            check(
              "owned feedback outside inert background",
              await status.evaluate((el) => !el.closest("[inert]")),
            );
            const same = await status.evaluate((el) =>
              el.closest('[role="dialog"]')?.getAttribute("aria-label"),
            );
            check("owned feedback source identity", same, a);
            await local.getByText("本次检查追踪", { exact: true }).click();
            await expect(local.locator("code")).toHaveText("probe-1");
          } else
            check("baseline missing owned result", await drawer.getByRole("status").count(), 0);
          await shot("rejected-detail", mode === "baseline" ? drawer : local);
          await shot("rejected-viewport");
          // A later GET must not overwrite the already completed probe's content/trace.
          await close(a);
          heldRead = true;
          await center.getByRole("button", { name: "刷新状态", exact: true }).click();
          await expect.poll(() => Boolean(releaseRead)).toBe(true);
          await open(a);
          releaseRead();
          releaseRead = undefined;
          heldRead = false;
          await expect(center.locator(".adapter-message")).toContainText("已刷新");
          if (mode !== "baseline") {
            await expect(status).toHaveText("请重新读取状态后检查。");
            await local.getByText("本次检查追踪", { exact: true }).click();
            await expect(local.locator("code")).toHaveText("probe-1");
          }
          check("later GET keeps owned result", mode !== "baseline", mode !== "baseline");
          await shot("after-refresh", mode === "baseline" ? drawer : local);
          // GET completes during probe; probe result must then carry its own trace.
          await close(a);
          heldRead = true;
          await center.getByRole("button", { name: "刷新状态", exact: true }).click();
          await expect.poll(() => Boolean(releaseRead)).toBe(true);
          await open(a);
          await startProbe();
          if (mode !== "baseline") await expect(local.locator("details")).toHaveCount(0);
          releaseRead();
          releaseRead = undefined;
          heldRead = false;
          await expect(center.locator(".adapter-message")).toContainText("已刷新");
          probeStatus = 200;
          probeRow = data.items[0];
          await settleProbe();
          if (mode !== "baseline") {
            await expect(status).toHaveText(a + " 健康检查通过");
            await expect(status).toBeFocused();
            check("completion leaves current focus unchanged", true);
            await local.getByText("本次检查追踪", { exact: true }).click();
            await expect(local.locator("code")).toHaveText("probe-2");
            const summary = local.locator("summary");
            await summary.focus();
            const box = await summary.boundingBox();
            check("trace44px", box.width >= 44 && box.height >= 44);
            await page.keyboard.press("Tab");
            check(
              "trace Tab remains in drawer",
              await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))),
            );
          }
          await shot("success-after-concurrent-read", mode === "baseline" ? drawer : local);
          check("success same source", true);
          await close(a);
          await open(b);
          await startProbe();
          probeRow = data.items[1];
          await settleProbe();
          if (mode !== "baseline") {
            await expect(status).toHaveText(b + " 已记录受阻原因");
            await local.getByText("本次检查追踪", { exact: true }).click();
            await expect(local.locator("code")).toHaveText("probe-3");
          }
          await shot("blocked-result", mode === "baseline" ? drawer : local);
          await close(b);
          await open(a);
          if (mode !== "baseline") {
            await expect(status).toHaveText("");
            await expect(local.locator("details")).toHaveCount(0);
          }
          check("new source result cannot leak to previous source", true);
          await close(a);
          check(
            "final background released",
            await page.locator("#app").evaluate((el) => !el.inert),
          );
        }
        check(
          "all local requests bodyless",
          requests.every((r) => r.body === null),
        );
        check(
          "probe count",
          requests.filter((r) => r.key.startsWith("POST ")).length,
          width > 760 ? 1 : 3,
        );
        check("no unexpected network", unexpected, []);
        check("no browser errors", errors, []);
        network.push({ mode, width, requests });
        runs.push({
          mode,
          width,
          renderedComponentHash: hash(rendered),
          rawComponentHash: hash(source),
          productionUntransformed: mode === "current",
        });
        console.log("p47 feedback passed " + mode + " " + width);
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
          kind: "P47-PROBE-FEEDBACK-IMPLEMENTATION-r1",
          sourceHashes,
          checks,
          screenshots,
          network,
          runs,
          processesClosed: true,
          fixtureBoundary:
            "Original two test records, with simulated409 and same-record200 probe responses. All API locally fulfilled, no real probe, collection, permission, persistence or recovery validation. Baseline immutable pre-fix; current production SFC untransformed; review uses current full script/feedback with approved detail composition and still-pending page design.",
          remaining:
            "Only source-owned feedback fixed. Original stale GET/data/route lifecycles and unknown-write policies unchanged; real screen-reader behavior not verified.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47检查反馈前后与C组合</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 检查反馈 · 修复前后与C组合</h1><p>baseline为旧生产；current为未经模板注入的当前生产；review为当前脚本叠加C审核组合。全部本地样例，无真实健康写入或生产验收。</p>' +
        screenshots
          .map(
            (s) =>
              "<article><h2>" +
              s.mode +
              " · " +
              s.width +
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
