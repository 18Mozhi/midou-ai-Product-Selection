import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { adminPageAssemblyPreview } from "./lib/ui-phase2-admin-page-assembly-preview.mjs";
import { adminDetailPreview } from "./lib/ui-phase2-admin-detail-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p44-admin-detail-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/admin-page-preview.css";
const roleStyle = "design-plans/ui-phase-2-2026-09-07/implementation/admin-comparison-preview.css";
const assemblyStyle =
  "design-plans/ui-phase-2-2026-09-07/implementation/admin-page-assembly-preview.css";
const sharedStyle = "design-plans/ui-phase-2-2026-09-07/implementation/user-page-preview.css";
const detailStyle = "design-plans/ui-phase-2-2026-09-07/implementation/admin-detail-preview.css";
const originals = { [parent]: await read(parent), [detailFile]: await read(detailFile) };
const transformed = {
  [parent]: adminPageAssemblyPreview(originals[parent], "parent"),
  [detailFile]: adminDetailPreview(originals[detailFile]),
};
const fixtureFile = "tests/e2e/m06-01-platform-accounts.spec.ts";
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const code = ["user", "org", "session", "overview", "platformRoles"]
  .map((name) => {
    const nodes = declarations.filter((n) => n.name.getText(ast) === name);
    assert.equal(nodes.length, 1);
    return `const ${name}=${nodes[0].initializer.getText(ast)};`;
  })
  .join("\n");
const details = [];
function find(node) {
  if (
    ts.isObjectLiteralExpression(node) &&
    ["user", "memberships", "sessions"].every((key) =>
      node.properties.some((p) => p.name?.getText(ast) === key),
    ) &&
    node.getText(ast).includes("id: adminId") &&
    node.getText(ast).includes('email: "admin@example.test"')
  )
    details.push(node);
  ts.forEachChild(node, find);
}
find(ast);
assert.equal(details.length, 1);
const fixture = JSON.parse(
  JSON.stringify(
    vm.runInNewContext(
      `${code}\nconst adminId=overview.admins[0].id;\n({overview,platformRoles,detail:${details[0].getText(ast)}})`,
    ),
  ),
);
// Exact existing administrator fixture: no memberships or sessions, not a buyer impersonation.
assert.deepEqual(fixture.detail.memberships, []);
assert.deepEqual(fixture.detail.sessions, []);
assert.equal(fixture.detail.user.id, fixture.overview.admins[0].id);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => "apps/web/src/" + m[1]);
const sources = new Set([
  parent,
  detailFile,
  style,
  sharedStyle,
  detailStyle,
  "scripts/lib/ui-phase2-admin-detail-preview.mjs",
  roleStyle,
  assemblyStyle,
  "scripts/lib/ui-phase2-admin-page-assembly-preview.mjs",
  "scripts/lib/ui-phase2-user-page-preview.mjs",
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/lib/ui-phase2-admin-page-preview.mjs",
  "scripts/verify-ui-phase2-admin-detail-preview.mjs",
]);
const entry = "/__p44_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(sharedStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(roleStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(assemblyStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(detailStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p43-page-preview','p44-page-preview','p44-role-review','p44-assembled');
document.body.classList.add('p44-detail-review');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/admins',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P44 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',initialTab:'admins',routePath:'/platform-admin/admins'})])}).use(router);await router.isReady();app.mount('#app');`;
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
      name: "p44-review",
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
          if (req.url?.split("?")[0] !== "/platform-admin/admins") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P44 管理员管理审核</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});

const checks = [],
  screenshots = [],
  observations = [];
const variants = [
  "normal",
  "password-pending",
  "mfa-pending",
  "both-pending",
  "disabled",
  "all-roles",
  "no-roles",
  "long-email",
];
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + port;
  console.log("p44_admin_detail_host " + origin);
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
      unexpected = [],
      errors = [];
    let variant = "normal",
      detailStatus = 200,
      gate,
      release;
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, width + ":" + variant + ":" + name);
      checks.push({ width, variant, name, actual });
    };
    const hold = () => {
      gate = new Promise((r) => (release = r));
    };
    const unhold = () => {
      release?.();
      gate = undefined;
    };
    const current = () => {
      const overview = structuredClone(fixture.overview),
        detail = structuredClone(fixture.detail);
      const admin = overview.admins[0];
      if (variant === "disabled") admin.status = detail.user.status = "disabled";
      if (variant === "all-roles") admin.roles = fixture.platformRoles.map((r) => r.code);
      if (variant === "no-roles") admin.roles = [];
      if (variant === "long-email")
        admin.email = detail.user.email = "platform.administration.".repeat(5) + "@example.test";
      detail.user.must_change_password = ["password-pending", "both-pending"].includes(variant);
      detail.user.must_enroll_mfa = ["mfa-pending", "both-pending"].includes(variant);
      return { overview, detail, admin };
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
        const target =
          url.pathname === "/api/v1/platform/accounts"
            ? "accounts"
            : url.pathname === "/api/v1/platform/roles"
              ? "roles"
              : url.pathname === "/api/v1/platform/accounts/users/" + fixture.detail.user.id
                ? "detail"
                : null;
        if (!target || req.method() !== "GET") {
          unexpected.push(req.method() + " " + url.pathname);
          return route.abort();
        }
        const status = target === "detail" ? detailStatus : 200,
          sample = current();
        requests.push({ method: req.method(), target, path: url.pathname, status, variant });
        if (target === "detail" && gate) await gate;
        return route.fulfill(
          status === 200
            ? {
                json: {
                  data:
                    target === "accounts"
                      ? sample.overview
                      : target === "roles"
                        ? fixture.platformRoles
                        : sample.detail,
                  request_id: "p44-admin-detail-fixture",
                  trace_id: "p44-admin-detail-fixture",
                },
              }
            : {
                status,
                json: {
                  error: {
                    code: "review_read_failure",
                    message: "测试读取失败",
                    action_hint: "详情暂未读到，请重试。",
                  },
                  request_id: "p44-admin-detail-error",
                  trace_id: "p44-admin-detail-error",
                },
              },
        );
      });
      const dialog = page.locator("dialog.p43-user-detail");
      const shot = async (state, target = dialog, align) => {
        await page.evaluate(() => document.fonts.ready);
        if (align === "top") await dialog.evaluate((n) => (n.scrollTop = 0));
        else if (align) await dialog.locator(align).scrollIntoViewIfNeeded();
        check(
          state + ":page fits",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        check(
          state + ":surface fits",
          await target.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        );
        if (capture) {
          const file = width + "-" + variant + "-" + state + ".png";
          const bytes = await target.screenshot({ animations: "disabled" });
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            file,
            width,
            variant,
            state: variant + "-" + state,
            sha256: hash(bytes),
            viewport: page.viewportSize(),
            imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          });
        }
      };
      const open = async (capturePreview = false) => {
        const records =
          width <= 760
            ? page.locator(".account-table-wrap .responsive-data-view__mobile article")
            : page.locator(".account-table-wrap tbody tr");
        const record = records.first();
        check("directory identity", (await record.innerText()).includes(current().admin.email));
        if (width <= 760) {
          await record.getByRole("button").click();
          const preview = page.locator(".responsive-data-view__drawer");
          if (capturePreview) {
            await shot("preview", preview);
            await preview.locator("summary").click();
            check(
              "preview exact admin UUID",
              (await preview.locator("details").innerText()).includes(fixture.detail.user.id),
            );
            await shot("preview-technical", preview);
          }
          await preview.getByRole("button", { name: "打开账号详情", exact: true }).click();
        } else await record.getByRole("button", { name: "账号详情", exact: true }).click();
        await dialog.waitFor({ state: "visible" });
        check("actual native detail dialog", await dialog.evaluate((n) => n.matches(":modal")));
      };
      const ready = () => dialog.locator(".detail-grid").waitFor();
      const close = async () => {
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        check(
          "Escape remains on admin route",
          new URL(page.url()).pathname,
          "/platform-admin/admins",
        );
        check(
          "Escape leaves no visible dialog",
          await page.locator('dialog[open],[role="dialog"]:visible').count(),
          0,
        );
      };
      for (variant of variants) {
        detailStatus = 200;
        await page.goto(origin + "/platform-admin/admins?keep=detail");
        await page.waitForFunction(
          () =>
            document.querySelector(".account-table-wrap") &&
            !document.querySelector(".account-hero .hero-actions button:last-child")?.disabled,
        );
        if (variant === "normal") hold();
        await open(variant === "normal");
        if (variant === "normal") {
          await dialog.getByText("正在读取账号详情…", { exact: true }).waitFor();
          await shot("loading");
          unhold();
        }
        await ready();
        const sample = current();
        check(
          "detail belongs to selected administrator",
          await dialog.locator("h3").innerText(),
          sample.admin.email,
        );
        check(
          "native dialog accessible name matches identity",
          await dialog.getAttribute("aria-label"),
          sample.admin.email,
        );
        check(
          "facts match original or explicit variant",
          await dialog.locator(".detail-grid strong").allTextContents(),
          [
            variant === "disabled" ? "已停用" : "正常使用",
            variant.endsWith("pending") ? "待完成" : "已完成",
            "0",
            "0",
          ],
        );
        check(
          "empty memberships explicit",
          await dialog.getByText("尚未加入组织。", { exact: true }).isVisible(),
        );
        check(
          "empty sessions explicit",
          await dialog.getByText("暂无会话。", { exact: true }).isVisible(),
        );
        const roles = dialog.locator(".role-actions button");
        const labels = [
          ["platform_operations_admin", "运营管理员"],
          ["platform_security_admin", "安全管理员"],
          ["platform_super_admin", "超级管理员"],
        ].map(([code, label]) => (sample.admin.roles.includes(code) ? "撤销" : "授予") + label);
        check(
          "role actions match selected record roles",
          await roles.allTextContents().then((a) => a.map((s) => s.trim())),
          labels,
        );
        check(
          "disabled account role actions",
          await roles.evaluateAll((ns) => ns.every((n) => n.disabled)),
          variant === "disabled",
        );
        check(
          "membership submit matches account status",
          await dialog.locator(".p43-memberships form button").isDisabled(),
          variant === "disabled",
        );
        check(
          "blue identity header",
          await dialog
            .locator("header")
            .first()
            .evaluate((n) => getComputedStyle(n).backgroundColor),
          "rgb(41, 76, 175)",
        );
        await shot("default", dialog, "top");
        const statusAction = dialog.locator("footer button").first();
        check(
          "status action label unchanged",
          await statusAction.innerText(),
          variant === "disabled" ? "恢复登录" : "停用登录",
        );
        check(
          "restore-only presentation class",
          await statusAction.evaluate((n) => n.classList.contains("p44-detail-reenable")),
          variant === "disabled",
        );
        check(
          "status action tone",
          await statusAction.evaluate((n) => getComputedStyle(n).color),
          variant === "disabled" ? "rgb(255, 255, 255)" : "rgb(174, 51, 69)",
        );
        if (variant === "disabled")
          check(
            "restore blue background",
            await statusAction.evaluate((n) => getComputedStyle(n).backgroundColor),
            "rgb(41, 76, 175)",
          );
        await shot("actions", dialog, "footer");
        if (variant === "normal") {
          await shot("facts", dialog.locator(".detail-grid"));
          await shot("access", dialog.locator(".p43-access"));
          const closeButton = dialog.getByRole("button", { name: "关闭账号详情", exact: true });
          await closeButton.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          check(
            "close reached by keyboard",
            await closeButton.evaluate(
              (n) => n === document.activeElement && n.matches(":focus-visible"),
            ),
          );
          await shot("close-focus", dialog, "top");
          await close();
          detailStatus = 500;
          await open();
          await dialog.getByText("账号详情暂时无法读取", { exact: true }).waitFor();
          check(
            "error hides prior facts and actions",
            await dialog.locator(".detail-grid,.role-actions").count(),
            0,
          );
          await shot("first-error");
          detailStatus = 200;
          hold();
          await dialog.getByRole("button", { name: "重试", exact: true }).click();
          await dialog.getByText("正在读取账号详情…", { exact: true }).waitFor();
          await shot("retry-wait");
          unhold();
          await ready();
          check(
            "retry restores same admin identity",
            await dialog.locator("h3").innerText(),
            fixture.detail.user.email,
          );
          if (width === 390) {
            await page.setViewportSize({ width, height: 568 });
            await shot("short-top", dialog, "top");
            await shot("short-actions", dialog, "footer");
            check(
              "short screen footer close reachable",
              await dialog
                .locator("footer button")
                .last()
                .evaluate((n) => {
                  const r = n.getBoundingClientRect();
                  return r.top >= 0 && r.bottom <= innerHeight;
                }),
            );
            await page.setViewportSize({ width, height: 900 });
          }
        }
        await close();
      }
      check(
        "all requests GET",
        requests.every((r) => r.method === "GET"),
      );
      check("no unexpected traffic", unexpected, []);
      check("no browser errors", errors, []);
      observations.push({ width, requests, unexpected, errors });
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
    await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
  );
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P44-ADMIN-DETAIL-VUE-PREVIEW-r1",
          approval: "pending-user-review",
          scope:
            "Current P44 admins-route Vue scripts preserved; review-only C composition adds one restore-label presentation class and scoped blue restore style. Exact existing administrator fixture, not buyer detail; explicit security-flag/status/role/long-email variants preserve global summary. " +
            "GET-only intercepted API; no real accounts or authorization. Identity, facts, empty memberships/sessions, selected-record role controls, read failure/retry and Escape checked. No role/status/password/session or membership writes. " +
            "No full App/NavigationShell/KeepAlive, database, real MFA/RBAC, theme/density or whole-page acceptance. New detail combinations pending review, previous approvals not expanded.",
          sourceHashes,
          transformedHashes: Object.fromEntries(
            Object.entries(transformed).map(([f, s]) => [f, hash(s)]),
          ),
          checks,
          screenshots,
          observations,
          processesClosed: true,
        },
        null,
        2,
      ) + "\n",
    );
    const gallery =
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P44 管理员详情状态审核</title><style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#eef2f7;color:#142a46;margin:24px}article{margin:24px 0;padding:20px;background:white}img{max-width:100%;height:auto}nav{display:flex;gap:12px;flex-wrap:wrap}</style><h1>P44 管理员详情 · 实际Vue C审核</h1><p>测试数据，未上线，待用户审核。详情及比较仅证明入口组合，不代表所有子区域C设计或权限通过。</p><nav>' +
      [390, 760, 761, 1440]
        .map((w) => '<a href="#' + w + '-normal-default">' + w + "px</a>")
        .join("") +
      "</nav>" +
      screenshots
        .map(
          (s) =>
            '<article id="' +
            s.width +
            "-" +
            s.state +
            '"><h2>' +
            s.width +
            "px · " +
            s.state +
            '</h2><a href="' +
            s.file +
            '"><img loading="lazy" src="' +
            s.file +
            '" alt="P44 ' +
            s.state +
            '"></a></article>',
        )
        .join("\n");
    await writeFile(output + "/index.html", gallery);
  }
  console.log(
    JSON.stringify({ checks: checks.length, images: screenshots.length, sources: sources.size }),
  );
} finally {
  await browser?.close();
  await server.close();
}
