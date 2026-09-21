import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { accountFixtureFile } from "./lib/ui-phase2-account-app-fixture.mjs";
import { accountPairFixture } from "./lib/ui-phase2-account-pair-fixture.mjs";
import {
  accountPairCss,
  accountPairSupport,
  previewAccountPair,
} from "./lib/ui-phase2-account-pair-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every((arg) => ["--smoke", "--capture"].includes(arg)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
const output = "output/playwright/account-pair-app-c-r2";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixture = accountPairFixture(await read(accountFixtureFile));
const targets = {
  "apps/web/src/components/NavigationShell.vue": "shell",
  "apps/web/src/components/PlatformAccountCenter.vue": "parent",
  "apps/web/src/components/PlatformAccountDialogs.vue": "create",
  "apps/web/src/components/PlatformUserDetailDialog.vue": "detail",
};
const originals = Object.fromEntries(
  await Promise.all(Object.keys(targets).map(async (file) => [file, await read(file)])),
);
const transformed = Object.fromEntries(
  Object.entries(targets).map(([file, surface]) => [
    file,
    previewAccountPair(originals[file], surface),
  ]),
);
const sources = new Set([
  ...Object.keys(targets),
  ...accountPairSupport,
  accountFixtureFile,
  "scripts/lib/ui-phase2-account-app-fixture.mjs",
  "scripts/lib/ui-phase2-account-pair-fixture.mjs",
  "scripts/verify-ui-phase2-account-pair-app.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
if (capture) await mkdir(output); // Never overwrite a previous user-facing review packet.
const runs = [],
  screenshots = [],
  ports = [];
let server, browser;
try {
  browser = await chromium.launch();
  for (const mode of smoke ? ["review"] : ["baseline", "review"]) {
    const probe = reservePort();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    ports.push(port);
    const origin = `http://127.0.0.1:${port}`;
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
      plugins:
        mode === "baseline"
          ? []
          : [
              {
                name: "account-pair-c-review-only",
                enforce: "pre",
                transform(source, id) {
                  const file = Object.keys(targets).find(
                    (file) => path.resolve(file).replaceAll("\\", "/") === id.replaceAll("\\", "/"),
                  );
                  if (!file) return null;
                  assert.equal(source.replaceAll("\r\n", "\n"), originals[file]);
                  return { code: transformed[file], map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace(
                      "<body>",
                      '<body class="account-pair-review shell-vue-c p43-page-preview p43-user-form-review p44-role-review p44-assembled">',
                    )
                    .replace(
                      "</head>",
                      accountPairCss
                        .map(
                          (file) =>
                            `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
                        )
                        .join("\n") + "</head>",
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`Account pair ${mode} ${origin}`);
    for (const width of smoke ? [390] : [390, 840, 1200, 1440]) {
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
          unexpected = [],
          checks = [];
        page.setDefaultTimeout(15000);
        page.on("pageerror", (error) => errors.push(error.message));
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}: ${name}`);
          checks.push({ name, actual });
        };
        await page.route("**/*", (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            key = `${request.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const values = {
            "GET /api/v1/auth/session-status": { authenticated: true },
            "GET /api/v1/me/navigation": fixture.navigation,
            "GET /api/v1/platform/accounts": fixture.overview,
            "GET /api/v1/platform/roles": fixture.platformRoles,
            [`GET /api/v1/platform/accounts/users/${fixture.detail.user.id}`]: fixture.detail,
            [`GET /api/v1/platform/accounts/users/${fixture.adminDetail.user.id}`]:
              fixture.adminDetail,
          };
          if (key === "GET /api/v1/me/ui-preferences") {
            requests.push({ key, expectedFailure: true });
            return route.fulfill({
              status: 503,
              json: { error: { code: "local_fixture_unavailable" } },
            });
          }
          if (!(key in values)) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key });
          return route.fulfill({
            json: {
              data: values[key],
              request_id: "account-pair-local",
              trace_id: "account-pair-local",
            },
          });
        });
        const shot = async (pageId, scene, locator = null) => {
          if (!capture) return;
          await page.evaluate(() => document.fonts.ready);
          const bytes = locator
            ? await locator.screenshot({ animations: "disabled" })
            : await page.screenshot({ fullPage: true, animations: "disabled" });
          const file = `${mode}-${width}-${pageId}-${scene}.png`;
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            mode,
            width,
            pageId,
            scene,
            file,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };
        await page.goto(origin + "/platform-admin/users");
        await page.locator(".account-table-wrap").waitFor();
        const account = await page.locator(".account-center").elementHandle();
        for (const pageId of ["P43", "P44"]) {
          if (pageId === "P44") {
            await page
              .getByRole("navigation", { name: "账号与组织二级导航" })
              .getByRole("link", { name: "管理员管理", exact: true })
              .click();
            await page.waitForURL(origin + "/platform-admin/admins");
            await page.locator(".role-comparison").waitFor();
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          check(
            `${pageId} same shared Vue DOM`,
            await account.evaluate(
              (node) => node.isConnected && node === document.querySelector(".account-center"),
            ),
          );
          if (mode === "review") {
            check(
              `${pageId} one correct directory heading`,
              await page.locator(".p43-directory-heading:visible h3").allTextContents(),
              [pageId === "P43" ? "用户目录" : "可授权账号"],
            );
            check(
              `${pageId} complete C shell`,
              await page.locator(".role-shell--review").count(),
              1,
            );
          }
          check(
            `${pageId} no page overflow`,
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          await shot(pageId, "whole-page");
          await shot(pageId, "directory", page.locator(".account-table-wrap"));
          const trigger = page.locator(".hero-actions").getByRole("button", {
            name: pageId === "P43" ? "新建用户" : "新建管理员",
            exact: true,
          });
          await trigger.click();
          const create = page.getByRole("dialog", { name: "新建用户或平台管理员", exact: true });
          await create.waitFor();
          check(
            `${pageId} native create modal`,
            await create.evaluate((node) => node.matches(":modal")),
          );
          check(
            `${pageId} correct default role`,
            await create.getByLabel(/^平台角色/).inputValue(),
            pageId === "P43" ? "" : "platform_operations_admin",
          );
          await shot(pageId, "create", create);
          await create.getByRole("button", { name: "取消", exact: true }).click();
          await create.waitFor({ state: "hidden" });
          check(
            `${pageId} create focus returns`,
            await trigger.evaluate((node) => node === document.activeElement),
          );
          const email =
            pageId === "P43" ? fixture.detail.user.email : fixture.adminDetail.user.email;
          if (width <= 760) {
            await page
              .getByRole("button", {
                name: new RegExp(`${email.replaceAll(".", "\\.")}.*查看详情`),
              })
              .click();
            await page
              .getByRole("dialog", { name: email, exact: true })
              .getByRole("button", { name: "打开账号详情" })
              .click();
          } else
            await page
              .getByRole("row")
              .filter({ hasText: email })
              .getByRole("button", { name: "账号详情" })
              .click();
          const detail = page.locator("dialog.detail-dialog");
          await detail.getByRole("button", { name: "强制改密", exact: true }).waitFor();
          check(`${pageId} detail identity`, await detail.getAttribute("aria-label"), email);
          await shot(pageId, "detail", detail);
          await detail.getByRole("button", { name: "关闭账号详情", exact: true }).click();
          if (pageId === "P44") {
            const comparison = page.locator(".role-comparison");
            if (mode === "review") {
              const geometry = await comparison.evaluate((node) => {
                const box = node.getBoundingClientRect();
                const header = node.querySelector(":scope > header").getBoundingClientRect();
                const heading = node.querySelector(":scope > header h3").getBoundingClientRect();
                const fields = [
                  ...node.querySelectorAll(
                    ".role-comparison__selectors select, .role-comparison__filters input",
                  ),
                ].map((field) => field.getBoundingClientRect());
                return {
                  headerContained: header.left >= box.left && header.right <= box.right,
                  headingInset: heading.left - box.left,
                  fieldsInset: Math.min(...fields.map((field) => field.left - box.left)),
                };
              });
              check("P44 comparison header contained", geometry.headerContained);
              check("P44 heading has readable inset", geometry.headingInset >= 15);
              check("P44 fields have readable inset", geometry.fieldsInset >= 15);
            }
            check(
              "P44 default differences",
              (await comparison.locator(".role-comparison__result").innerText()).trim(),
              "当前显示 6 项能力",
            );
            await shot(pageId, "comparison", comparison);
            await comparison.getByLabel("右侧角色").selectOption("platform_operations_admin");
            await page.waitForFunction(() =>
              document.querySelector(".role-comparison__result")?.textContent.includes("0 项能力"),
            );
            check(
              "P44 same-role zero differences",
              await comparison.locator(".role-comparison__matrix article").count(),
              0,
            );
            await shot(pageId, "same-role", comparison);
          }
        }
        await page.goBack();
        await page.waitForURL(origin + "/platform-admin/users");
        check(
          "history restores users title",
          (await page.locator(".account-hero h2").innerText()).includes("用户"),
        );
        if (mode === "review")
          check(
            "history restores one users heading",
            await page.locator(".p43-directory-heading:visible h3").allTextContents(),
            ["用户目录"],
          );
        check(
          "no writes",
          requests.some((request) => !request.key.startsWith("GET ")),
          false,
        );
        check("no unexpected requests", unexpected, []);
        check("no page errors", errors, []);
        runs.push({ mode, width, checks, requests });
        console.log(`${mode}/${width}: ${checks.length} checks`);
      } finally {
        await context.close();
      }
    }
    for (const module of server.moduleGraph.idToModuleMap.values()) {
      const file = module.file && path.relative(process.cwd(), module.file).replaceAll("\\", "/");
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
    kind: "P43-P44-ACTUAL-APP-C-r2",
    reviewOnly: true,
    approval: "pending",
    processesClosed: true,
    ports,
    runs,
    screenshots,
    boundary:
      "Actual App/router/shared account instance with review-only shell and template/CSS composition; local GET fixtures only. No runtime script changes in account surfaces. Existing narrow approvals do not approve this whole composition. Original detail fixture lacks membership organization_id; no real permissions, writes, all states/themes or production acceptance.",
    transformedHashes: Object.fromEntries(
      Object.entries(transformed).map(([file, value]) => [file, hash(value)]),
    ),
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P43/P44 完整应用 C 审核</title><style>body{font:16px/1.7 Microsoft YaHei,sans-serif;background:#eef2f7;color:#142a46;margin:24px}img{max-width:100%;height:auto}details{background:white;padding:16px;margin:16px 0}</style><h1>P43 / P44 · 真实应用 C 组合 r2</h1><p>review 是新整页提案，baseline 是现有应用。均为本地样例，未上线；已有局部批准不代表本组合通过。</p><a href="evidence.json">完整检查与来源</a>' +
        screenshots
          .map(
            (shot) =>
              `<details ${shot.mode === "review" && shot.scene === "whole-page" ? "open" : ""}><summary>${shot.mode} / ${shot.width} / ${shot.pageId} / ${shot.scene}</summary><img loading="lazy" src="${shot.file}" alt="${shot.file}"></details>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
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
