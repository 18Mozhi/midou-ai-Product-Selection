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
  "design-plans/ui-phase-2-2026-09-07/implementation/ProviderAdapterDetailPreview.vue";
const css = "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-vue-preview.css";
const detailCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-detail-preview.css";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const output = "output/playwright/p47-adapters-detail-vue";
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
const sources = new Set([
  component,
  preview,
  css,
  fixture,
  "scripts/verify-ui-phase2-provider-adapters-detail-vue.mjs",
  detailCss,
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
              '"><link rel="stylesheet" href="/@fs/' +
              path.resolve(detailCss).replaceAll("\\", "/") +
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

  for (const width of [390, 760]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        requests = [],
        unexpected = [],
        errors = [];
      let rows = data.items,
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
          key === "POST /api/v1/platform/provider-adapters/" + data.items[0].id + "/health-check";
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
              request_id: "detail-probe-sample",
              trace_id: "detail-probe-sample",
            },
          });
        }
        if (url.pathname.endsWith("navigation"))
          return route.fulfill({ json: { data: data.navigation, request_id: "nav-sample" } });
        if (url.pathname.endsWith("session-status"))
          return route.fulfill({ json: { data: { authenticated: true } } });
        return route.fulfill({ json: { data: rows, request_id: "list-sample" } });
      });
      const drawer = page.locator(".responsive-data-view__drawer");
      const shot = async (name) => {
        await page.clock.runFor(100);
        await page.evaluate(() => document.fonts.ready);
        if (!capture) return;
        const bytes = await page.screenshot({ animations: "disabled" });
        const file = width + "-" + name + ".png";
        await writeFile(output + "/" + file, bytes);
        screenshots.push({
          width,
          state: name,
          file,
          sha256: hash(bytes),
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
        });
      };
      const parts = async (name) => {
        const metrics = await drawer.evaluate((el) => ({
          height: el.clientHeight,
          max: el.scrollHeight - el.clientHeight,
          header: el.querySelector("header").getBoundingClientRect().height,
        }));
        check(name + " header leaves readable body", metrics.header + 44 < metrics.height);
        const step = metrics.height - metrics.header - 24;
        const positions = [0];
        while (positions.at(-1) < metrics.max)
          positions.push(Math.min(metrics.max, positions.at(-1) + step));
        for (let i = 0; i < positions.length; i++) {
          await drawer.evaluate((el, y) => {
            el.scrollTop = y;
          }, positions[i]);
          await shot(name + "-part" + (i + 1));
        }
        observations.push({ width, state: name, positions, ...metrics });
      };
      const cases = [
        { name: "registered", rows: data.items, target: "公开趋势 RSS" },
        { name: "unregistered", rows: data.items, target: data.items[1].name },
        {
          name: "synthetic-zero-recovery",
          rows: [
            {
              ...data.items[0],
              latest_runtime_category: "network",
              runtime_sample_count_24h: 1,
              runtime_success_rate_basis_points_24h: 0,
              runtime_duration_p95_ms_24h: 0,
              runtime_network_failure_count_24h: 1,
              runtime_circuit_state: "open",
              runtime_recovery_gate_met: true,
            },
          ],
          target: "公开趋势 RSS",
        },
        {
          name: "synthetic-long",
          rows: [
            {
              ...data.items[0],
              name: "长名称审核样例 · " + "公开趋势来源".repeat(8),
              code: "long_review_code_".repeat(12),
              adapter_version: "review_version_".repeat(10),
              last_checked_at: null,
            },
          ],
          target: "长名称审核样例",
        },
      ];
      for (const scene of cases) {
        rows = scene.rows;
        await page.goto(origin + "/platform-admin/providers/adapters");
        const trigger = page
          .locator(".responsive-data-view__mobile")
          .getByRole("button")
          .filter({ hasText: scene.target });
        await expect(trigger).toHaveCount(1);
        await trigger.click();
        await expect(drawer).toBeVisible();
        const close = drawer.getByRole("button", { name: "关闭详情", exact: true });
        await expect(close).toBeFocused();
        check(scene.name + " initial close focus", true);
        check(
          scene.name + " background inert",
          await page.locator("#app").evaluate((el) => el.inert),
        );
        check(
          scene.name + " source title",
          await drawer.getAttribute("aria-label"),
          rows.find((r) => r.name.includes(scene.target)).name,
        );
        check(
          scene.name + " four diagnostic sections",
          await drawer.locator(".p47-detail-section").count(),
          4,
        );
        check(
          scene.name + " twelve facts",
          await drawer.locator(".p47-detail-section dt").count(),
          12,
        );
        const tech = drawer.locator(".p47-diagnostic-detail > details > summary");
        const probeButton = drawer.getByRole("button", { name: "执行健康检查", exact: true });
        const recover = drawer.getByRole("link", { name: "前往采集调度解除暂停", exact: true });
        await close.focus();
        await page.keyboard.press("Shift+Tab");
        await expect(tech).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(close).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(probeButton).toBeFocused();
        check(scene.name + " closed-details Tab cycle", true);
        await parts(scene.name);
        await tech.click();
        check(
          scene.name + " seven technical facts",
          await drawer.locator(".p47-diagnostic-detail > details dt").count(),
          7,
        );
        await parts(scene.name + "-technical");
        const geometry = await drawer.evaluate((el) => ({
          fits:
            el.scrollWidth <= el.clientWidth + 1 &&
            document.documentElement.scrollWidth <= innerWidth + 1,
          controls: [...el.querySelectorAll("button,a,summary")]
            .filter((n) => n.checkVisibility())
            .map((n) => {
              const r = n.getBoundingClientRect();
              return { width: r.width, height: r.height };
            }),
        }));
        check(scene.name + " no horizontal overflow", geometry.fits);
        check(
          scene.name + "44px controls",
          geometry.controls.every((r) => r.width >= 44 && r.height >= 44),
        );
        if (scene.name === "synthetic-zero-recovery") {
          await expect(drawer).toContainText("0.0%（1 个样本）");
          await expect(drawer).toContainText("0 ms");
          await expect(recover).toHaveAttribute("href", "/platform-admin/crawler-scheduler");
          check("recovery link is original conditional deep-link", true);
        } else {
          await expect(recover).toHaveCount(0);
        }
        if (scene.name === "registered") {
          await probeButton.click();
          const busy = drawer.getByRole("button", { name: "检查中…", exact: true });
          await expect(busy).toBeDisabled();
          await close.focus();
          await page.keyboard.press("Tab");
          await expect(tech).toBeFocused();
          check("busy button skipped in Tab", true);
          await busy.scrollIntoViewIfNeeded();
          await shot("probe-pending");
          assert.ok(releaseProbe);
          releaseProbe();
          await expect(page.locator(".adapter-message")).toContainText("重新读取状态后检查");
          await expect(probeButton).toBeEnabled();
          // Existing ownership issue is recorded, not styled into a false claim of feedback.
          check(
            "known background-only probe feedback",
            await page.locator(".adapter-message").evaluate((el) => Boolean(el.closest("[inert]"))),
          );
          check(
            "drawer has no owned live result",
            await drawer.locator('[role="status"]').count(),
            0,
          );
          await shot("probe-rejected-detail-no-feedback");
        }
        await close.focus();
        await drawer.evaluate((el) => {
          el.scrollTop = 0;
        });
        await shot(scene.name + "-close-focus");
        if (scene.name === "unregistered") await close.click();
        else await page.keyboard.press("Escape");
        await expect(drawer).toHaveCount(0);
        await expect(trigger).toBeFocused();
        check(scene.name + " restores trigger", true);
        check(
          scene.name + " releases inert",
          await page.locator("#app").evaluate((el) => el.inert),
          false,
        );
        await page.reload();
      }
      check("no unexpected network", unexpected, []);
      check("no browser errors", errors, []);
      check(
        "one bodyless local probe",
        requests.filter((r) => r.key.startsWith("POST ")).map((r) => r.body),
        [null],
      );
      network.push({ width, requests });
      console.log("p47 detail passed " + width);
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
          kind: "P47-ADAPTERS-DETAIL-ACTUAL-VUE-r1",
          sourceHashes,
          screenshots,
          checks,
          observations,
          network,
          processesClosed: true,
          fixtureBoundary:
            "Original two records; explicit synthetic zero/recovery and long text. All API supplied locally, one health POST per width rejected409, no real probe or persistence. Complete original script retained. Background-only feedback remains unresolved, not full a11y/auth/lifecycle/production acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47详情实际Vue审核</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 采集程序 · 详情实际Vue审核</h1><p>本地样例、独立审核模板/CSS、未上线。详情独立C审核；零值/恢复门/长文本为显式合成样例，真实探针、全部交互及生产验收未完成。</p>' +
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
