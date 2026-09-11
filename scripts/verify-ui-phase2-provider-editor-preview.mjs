import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { providerPagePreview } from "./lib/ui-phase2-provider-page-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p46-provider-editor-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");

const parent = "apps/web/src/components/ProviderRuntimeSurface.vue";
const child = "apps/web/src/components/ProviderRegistry.vue";
const pageStyle = "design-plans/ui-phase-2-2026-09-07/implementation/provider-page-preview.css";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/provider-editor-preview.css";
const originals = { [child]: await read(child) };
const transformed = { [child]: providerPagePreview(originals[child]) };
const fixtureFile = "tests/e2e/m03-01-provider-registry.spec.ts";
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const box = {};
vm.runInNewContext(
  ["definition", "blockedDefinition", "definitions"]
    .map((name) => {
      const matches = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(matches.length, 1);
      return "const " + name + "=" + matches[0].initializer.getText(ast) + ";";
    })
    .join("\n") + "globalThis.result=definitions;",
  box,
);
const definitions = JSON.parse(JSON.stringify(box.result));
assert.equal(definitions.length, 25);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => "apps/web/src/" + m[1]);
const sources = new Set([
  parent,
  child,
  style,
  pageStyle,
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "apps/web/src/navigation-shell-route-state.ts",
  "scripts/lib/ui-phase2-provider-page-preview.mjs",
  "scripts/verify-ui-phase2-provider-editor-preview.mjs",
]);
const entry = "/__p46_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/ProviderRuntimeSurface.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(pageStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p46-page-review','p46-editor-review');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/providers',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P46 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',routePath:'/platform-admin/providers',capabilities:['platform:superadmin']})])}).use(router);await router.isReady();app.mount('#app');`;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p46-review",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(source, id) {
        const file = Object.keys(originals).find(
          (f) => path.resolve(f).replaceAll("\\", "/") === id.replaceAll("\\", "/"),
        );
        if (!file) return null;
        assert.equal(source.replaceAll("\r\n", "\n"), originals[file]);
        return { code: transformed[file], map: null };
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/platform-admin/providers") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46 来源设置审核</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});

const checks = [],
  screenshots = [],
  observations = [];
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + port;
  console.log("p46_editor_host " + origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      requests = [],
      errors = [],
      unexpected = [];
    let writeStatus = 503,
      gate,
      release;
    const hold = () => (gate = new Promise((r) => (release = r))),
      unhold = () => {
        release?.();
        gate = undefined;
      };
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, width + ":" + name);
      checks.push({ width, name, actual });
    };
    try {
      await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push(req.url());
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (req.method() === "GET" && url.pathname === "/api/v1/platform/providers") {
          requests.push({ method: "GET", path: url.pathname });
          return route.fulfill({
            json: { data: definitions, request_id: "p46-editor-read", trace_id: "p46-editor-read" },
          });
        }
        if (
          (req.method() === "POST" && url.pathname === "/api/v1/platform/providers") ||
          (req.method() === "PUT" &&
            url.pathname === "/api/v1/platform/providers/" + definitions[0].id)
        ) {
          const code = writeStatus;
          requests.push({
            method: req.method(),
            path: url.pathname,
            body: req.postDataJSON(),
            status: code,
            idempotencyPresent: Boolean(req.headers()["idempotency-key"]),
          });
          if (gate) await gate;
          return route.fulfill({
            status: code,
            json: {
              error: {
                code: code === 409 ? "version_conflict" : "dependency_unavailable",
                message: "审核样例保存失败",
                action_hint:
                  code === 409 ? "版本已变化，请核对后重试。" : "依赖暂时不可用，请稍后重试。",
              },
              request_id: "p46-editor-error",
              trace_id: "p46-editor-error",
            },
          });
        }
        unexpected.push(req.method() + " " + url.pathname);
        return route.abort();
      });
      await page.goto(origin + "/platform-admin/providers?keep=p46");
      await page.locator(".provider-list-tools").waitFor();
      const create = page.locator(".provider-hero > button"),
        dialog = page.locator(".provider-editor");
      const field = (name) =>
        dialog
          .locator(".provider-fields label")
          .filter({ hasText: new RegExp("^" + name) })
          .locator("input,select");
      const step = async (n) => {
        await dialog
          .locator(".provider-editor-steps button")
          .nth(n - 1)
          .click();
        await page.waitForFunction(
          (n) =>
            document
              .querySelector('.provider-editor-steps [aria-current="step"]')
              ?.textContent.trim()
              .startsWith(String(n)),
          n,
        );
      };
      const shot = async (state, bottom = false) => {
        await dialog.evaluate((n, bottom) => {
          n.scrollTop = bottom ? n.scrollHeight : 0;
        }, bottom);
        await page.evaluate(() => document.fonts.ready);
        check(
          state + ":dialog fits width",
          await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        );
        check(
          state + ":page fits width",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (capture) {
          const bytes = await page.screenshot({ animations: "disabled" }),
            file = width + "-" + state + ".png";
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            file,
            width,
            state,
            sha256: hash(bytes),
            imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          });
        }
      };
      const close = async () => {
        await dialog.getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
        await dialog.waitFor({ state: "hidden" });
      };
      const openCreate = async () => {
        await create.click();
        await dialog.waitFor();
      };
      await openCreate();
      check(
        "new dialog accessible title",
        await dialog.getAttribute("aria-labelledby"),
        "provider-editor-title",
      );
      check(
        "code receives initial focus",
        await field("来源代码").evaluate((n) => n === document.activeElement),
      );
      check(
        "list hidden while editor open",
        await page.locator(".responsive-data-view").count(),
        0,
      );
      const labels = [
        ["来源代码（技术标识）", "名称", "目标 URL", "负责人", "接入模式"],
        ["市场", "语言", "字段清单", "去重键", "解析器版本", "健康检查 URL"],
        ["频率（分钟）", "并发", "超时 ms", "重试", "熔断阈值", "保留天数", "失败规则"],
        ["平台条款复核", "发布状态", "条款参考 URL", "条款版本", "条款到期时间"],
      ];
      for (let n = 1; n <= 4; n++) {
        await step(n);
        check(
          "step " + n + " exact fields",
          await dialog
            .locator(".provider-fields label")
            .evaluateAll((nodes) => nodes.map((n) => n.firstChild.textContent.trim())),
          labels[n - 1],
        );
        await shot("create-step-" + n);
        await shot("create-step-" + n + "-bottom", true);
        check(
          "step " + n + " controls meet 44px and 16px",
          await dialog
            .locator(".provider-fields input,.provider-fields select")
            .evaluateAll((nodes) =>
              nodes.every(
                (n) =>
                  n.getBoundingClientRect().height >= 44 &&
                  parseFloat(getComputedStyle(n).fontSize) >= 16,
              ),
            ),
        );
      }
      check("new public RSS remains disabled", await field("发布状态").inputValue(), "disabled");
      check(
        "incomplete create disabled",
        await dialog.locator('button[type="submit"]').isDisabled(),
      );
      check(
        "invalid save gray background",
        await dialog
          .locator('button[type="submit"]')
          .evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(232, 237, 244)",
      );
      await step(1);
      await dialog.getByRole("button", { name: "下一步", exact: true }).click();
      check(
        "invalid step stays first",
        await dialog.locator('[aria-current="step"]').innerText(),
        "1\n基本信息",
      );
      await shot("basic-errors", true);
      await field("来源代码").fill("review_source");
      await field("名称").fill("审核来源");
      await field("目标 URL").fill("https://example.test/feed");
      await dialog.getByRole("button", { name: "下一步", exact: true }).click();
      check(
        "next passes valid first group",
        await dialog.locator('[aria-current="step"]').innerText(),
        "2\n范围与字段",
      );
      await field("市场").fill("");
      await field("健康检查 URL").fill("invalid");
      await shot("scope-errors", true);
      await field("市场").fill("US");
      await field("健康检查 URL").fill("");
      await step(3);
      const numericNames = ["频率", "并发", "超时 ms", "重试", "熔断阈值", "保留天数"];
      for (const name of numericNames) await field(name).fill("-1");
      check(
        "all six numeric errors visible",
        await dialog.locator(".provider-fields small").count(),
        6,
      );
      await shot("execution-errors");
      await shot("execution-errors-bottom", true);
      for (const [i, v] of [30, 1, 15000, 2, 5, 365].entries())
        await field(numericNames[i]).fill(String(v));
      await step(4);
      await field("发布状态").selectOption("enabled");
      check(
        "public enable missing terms disables save",
        await dialog.locator('button[type="submit"]').isDisabled(),
      );
      await shot("publish-errors");
      await shot("publish-errors-bottom", true);
      await field("发布状态").selectOption("disabled");
      for (const mode of [
        "public_page",
        "public_rss",
        "authenticated_browser",
        "import",
        "manual",
      ]) {
        await step(1);
        await field("接入模式").selectOption(mode);
        await dialog.getByRole("button", { name: "应用技术模板", exact: true }).click();
        await step(2);
        const expected =
          mode === "public_rss"
            ? "title,summary,published_at,canonical_url,publisher"
            : ["public_page", "authenticated_browser"].includes(mode)
              ? "title,canonical_url,observed_at"
              : "title,external_id,observed_at";
        check("template fields " + mode, await field("字段清单").inputValue(), expected);
        await shot("template-" + mode, true);
      }
      await step(1);
      await field("接入模式").selectOption("public_rss");
      await dialog.getByRole("button", { name: "应用技术模板", exact: true }).click();
      await step(4);
      hold();
      await dialog.locator('button[type="submit"]').click();
      await page.getByRole("button", { name: "保存中…", exact: true }).waitFor();
      check("busy disables save", await dialog.locator('button[type="submit"]').isDisabled());
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector('.provider-editor button[type="submit"]'))
            .backgroundColor === "rgb(232, 237, 244)",
      );
      check(
        "busy save gray background",
        await dialog
          .locator('button[type="submit"]')
          .evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(232, 237, 244)",
      );
      await shot("create-saving", true);
      unhold();
      await dialog.getByText("依赖暂时不可用，请稍后重试。", { exact: true }).waitFor();
      await shot("create-failed", true);
      await dialog.getByText("技术详情", { exact: true }).click();
      await shot("create-error-trace", true);
      const firstPost = requests.find((r) => r.method === "POST");
      check(
        "fresh create body keys",
        Object.keys(firstPost.body).sort(),
        [
          "code",
          "name",
          "target_url",
          "access_mode",
          "markets",
          "languages",
          "fields",
          "schedule_minutes",
          "concurrency_limit",
          "timeout_ms",
          "retry_limit",
          "circuit_failure_threshold",
          "dedupe_key",
          "retention_days",
          "failure_rules",
          "parser_version",
          "healthcheck_url",
          "owner_label",
          "terms_review_status",
          "terms_reference_url",
          "terms_version",
          "terms_expires_at",
          "status",
        ].sort(),
      );
      check(
        "fresh defaults no made-up release data",
        [
          firstPost.body.status,
          firstPost.body.terms_review_status,
          firstPost.body.terms_reference_url,
          firstPost.body.terms_version,
          firstPost.body.terms_expires_at,
        ],
        ["disabled", "pending", null, null, null],
      );
      check("fresh arrays preserve comma contract", firstPost.body.markets, ["US"]);
      check("failed save keeps same title", await dialog.locator("h3").innerText(), "登记来源");
      await close();
      check(
        "create close returns focus",
        await create.evaluate((n) => n === document.activeElement),
      );
      if (width <= 760) {
        await page.getByRole("button", { name: /公开趋势 RSS.*未进入调度/ }).click();
        await page
          .getByRole("dialog", { name: "公开趋势 RSS", exact: true })
          .getByRole("button", { name: "编辑来源", exact: true })
          .click();
      } else {
        await page
          .locator(".provider-table-wrap tbody tr")
          .filter({ hasText: "public_signal_rss" })
          .getByRole("button", { name: "编辑", exact: true })
          .click();
      }
      await dialog.waitFor();
      check(
        "edit correct existing source",
        await field("来源代码").inputValue(),
        definitions[0].code,
      );
      check(
        "one dialog after mobile handoff",
        await page.locator('[role="dialog"]:visible').count(),
        1,
      );
      for (let n = 1; n <= 4; n++) {
        await step(n);
        await shot("edit-step-" + n);
        await shot("edit-step-" + n + "-bottom", true);
      }
      check(
        "current edit local timestamp slicing",
        await field("条款到期时间").inputValue(),
        "2027-08-07T17:00",
      );
      writeStatus = 409;
      await dialog.locator('button[type="submit"]').click();
      await dialog.getByText("版本已变化，请核对后重试。", { exact: true }).waitFor();
      await shot("edit-conflict", true);
      const put = requests.find((r) => r.method === "PUT");
      check("edit expected version", put.body.expected_version, 1);
      check(
        "actual readonly property retention",
        ["id", "version", "updated_at", "terms_reviewed_at"].every(
          (k) => put.body[k] === definitions[0][k],
        ),
      );
      check(
        "current timezone behavior observed not fixed",
        put.body.terms_expires_at,
        "2027-08-07T09:00:00.000Z",
      );
      await close();
      await openCreate();
      await field("来源代码").fill("review_after_edit");
      await field("名称").fill("编辑后新建");
      await field("目标 URL").fill("https://example.test/new");
      await step(4);
      await dialog.locator('button[type="submit"]').click();
      await dialog.getByText("版本已变化，请核对后重试。", { exact: true }).waitFor();
      const posts = requests.filter((r) => r.method === "POST");
      check(
        "edit then create still retains original readonly keys",
        ["id", "version", "updated_at", "terms_reviewed_at"].every(
          (k) => posts[1].body[k] === definitions[0][k],
        ),
      );
      check(
        "create after edit has no expected_version",
        Object.hasOwn(posts[1].body, "expected_version"),
        false,
      );
      await shot("create-after-edit-failed", true);
      await close();
      await openCreate();
      await dialog.getByRole("button", { name: "关闭来源设置编辑", exact: true }).focus();
      await page.keyboard.press("Tab");
      check(
        "Tab reaches first step",
        await dialog
          .locator(".provider-editor-steps button")
          .first()
          .evaluate((n) => n === document.activeElement),
      );
      await shot("step-focus");
      if (width === 390) {
        await page.setViewportSize({ width, height: 568 });
        await shot("short-screen");
        await shot("short-screen-bottom", true);
        await page.setViewportSize({ width, height: 900 });
      }
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      check(
        "Escape returns create focus",
        await create.evaluate((n) => n === document.activeElement),
      );
      check(
        "only one initial read and three rejected writes",
        requests.map((r) => r.method),
        ["GET", "POST", "PUT", "POST"],
      );
      check(
        "all write idempotency headers present",
        requests.filter((r) => r.method !== "GET").every((r) => r.idempotencyPresent),
      );
      check("no unexpected requests", unexpected, []);
      check("no page errors", errors, []);
      observations.push({ width, requests, errors, unexpected });
      console.log("passed " + width);
    } finally {
      unhold();
      await context.close();
    }
  }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css)$/.test(file)
    )
      sources.add(file);
  }
  const sourceHashes = Object.fromEntries(
    await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
  );
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P46-PROVIDER-EDITOR-VUE-PREVIEW-r1",
          approval: "pending-user-review",
          scope:
            "Actual current ProviderRegistry editor template/script unchanged; existing page review transform outside editor, new scoped editor CSS only. Original fixture, explicit new-form values, GET plus rejected POST/PUT intercepted only. All23 fields/four steps and five templates reviewed. Original read-only property residual and local timezone conversion observed, not fixed. No real persistence/permissions/admission/collection, no successful save/reload, stale write ownership or full App/KeepAlive/modal accessibility acceptance. Page-layout approval does not approve this editor.",
          sourceHashes,
          transformedHashes: { [child]: hash(transformed[child]) },
          checks,
          screenshots,
          observations,
          processesClosed: true,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46 四步编辑审核</title><style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#eef2f7;color:#142a46;margin:24px}article{background:white;padding:20px;margin:24px 0}img{max-width:100%;height:auto}</style><h1>P46 四步编辑 · 实际Vue审核</h1><p>测试数据，未上线、待审核。原保存/校验/时区与字段残留未改，非真实持久化验收。</p>' +
        screenshots
          .map(
            (s) =>
              "<article><h2>" +
              s.width +
              "px · " +
              s.state +
              '</h2><img loading="lazy" src="' +
              s.file +
              '" alt="' +
              s.state +
              '"></article>',
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({ checks: checks.length, images: screenshots.length, sources: sources.size }),
  );
} finally {
  await browser?.close();
  await server.close();
}
