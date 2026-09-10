import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { withVueReview, reviewHash } from "./lib/ui-phase2-vue-review-host.mjs";
import {
  organizationListPreview,
  organizationRecordPreview,
} from "./lib/ui-phase2-organization-list-preview.mjs";
import { organizationCreatePreview } from "./lib/ui-phase2-organization-create-preview.mjs";
import { buildAccountOverviewDesignData } from "./lib/ui-phase2-account-overview-design-data.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p41-create-preview",
  routePath = "/platform-admin/organizations";
const wizardSource = "apps/web/src/components/OrganizationCreationWizard.vue";
const data = await buildAccountOverviewDesignData(process.cwd());
const disabledUser = {
  ...data.overview.users[0],
  id: "00000000-0000-4000-8000-000000000699",
  email: "disabled-fixture@example.test",
  status: "disabled",
};
const checks = [],
  screenshots = [],
  observations = [];
if (capture) await mkdir(output, { recursive: true });
const bindings = await withVueReview(
  {
    pageId: "P41",
    routePath,
    transforms: {
      "apps/web/src/components/PlatformAccountCenter.vue": organizationListPreview,
      "apps/web/src/components/PlatformOrganizationRecords.vue": organizationRecordPreview,
      [wizardSource]: organizationCreatePreview,
    },
    styles: [
      "account-filter-preview.css",
      "account-create-preview.css",
      "account-page-preview.css",
      "organization-list-preview.css",
      "organization-create-preview.css",
    ].map((f) => "design-plans/ui-phase-2-2026-09-07/implementation/" + f),
    files: [
      "scripts/verify-ui-phase2-organization-create-preview.mjs",
      "scripts/lib/ui-phase2-organization-create-preview.mjs",
      "scripts/lib/ui-phase2-organization-list-preview.mjs",
      "scripts/lib/ui-phase2-account-overview-design-data.mjs",
      "tests/e2e/m06-01-platform-accounts.spec.ts",
      "apps/api/src/platform-account-service.ts",
      "apps/api/src/mysql-platform-account-repository.ts",
    ],
  },
  async ({ browser, origin, sourceHashes, transformedHashes }) => {
    for (const width of [390, 699, 700, 701, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [];
        let postStatus = 500,
          held,
          release,
          created = null;
        await page.clock.install({ time: new Date("2026-09-11T02:00:00Z") });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", async (route) => {
          const req = route.request(),
            url = new URL(req.url());
          if (
            url.origin === origin &&
            url.pathname === "/api/v1/platform/accounts" &&
            req.method() === "GET"
          ) {
            requests.push({
              method: "GET",
              path: url.pathname,
              query: Object.fromEntries(url.searchParams),
            });
            const overview = structuredClone(data.overview);
            overview.users.push(disabledUser);
            if (created)
              overview.organizations.push({
                ...data.overview.organizations[0],
                ...created,
                member_count: 1,
                workspace_count: 1,
              });
            return route.fulfill({
              json: {
                data: overview,
                request_id: "p41-read-fixture",
                trace_id: "p41-read-fixture",
              },
            });
          }
          if (
            url.origin === origin &&
            url.pathname === "/api/v1/platform/accounts/organizations" &&
            req.method() === "POST"
          ) {
            const body = req.postDataJSON(),
              status = postStatus;
            requests.push({
              method: "POST",
              path: url.pathname,
              body,
              hasIdempotencyKey: Boolean(req.headers()["idempotency-key"]),
              status,
            });
            if (held) await held;
            if (status === 200) {
              created = {
                id: "00000000-0000-4000-8000-000000000698",
                name: body.name,
                slug: body.slug,
                status: "active",
                default_workspace_id: "00000000-0000-4000-8000-000000000697",
                initial_admin_user_id: body.initial_admin_user_id ?? data.overview.users[0].id,
              };
              return route.fulfill({
                json: {
                  data: created,
                  request_id: "p41-write-fixture",
                  trace_id: "p41-write-fixture",
                },
              });
            }
            return route.fulfill({
              status,
              json: {
                error: {
                  code: "fixture_create_failure",
                  message: "创建测试失败",
                  action_hint: "本次创建未完成，请核对后重试。",
                },
                request_id: "p41-failure-fixture",
                trace_id: "p41-failure-fixture",
              },
            });
          }
          if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
          unexpected.push(`${req.method()} ${url.pathname}`);
          return route.abort();
        });
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${width}: ${name}`);
          checks.push({ width, name });
        };
        const dialog = page.getByRole("dialog", { name: "新建组织", exact: true });
        const name = () => dialog.getByRole("textbox", { name: "组织名称", exact: true });
        const slug = () => dialog.getByRole("textbox", { name: "组织标识", exact: true });
        const next = () => dialog.getByRole("button", { name: "下一步：选择管理员", exact: true });
        const confirm = () => dialog.locator("button.p41-action-primary");
        const posts = () => requests.filter((r) => r.method === "POST");
        const settle = () =>
          page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
        const visit = async () => {
          await page.goto(`${origin}${routePath}/new?keep=p41`);
          await dialog.waitFor();
          await page.waitForFunction(
            () =>
              !!document.querySelector(".p39-results-head button") &&
              !document.querySelector(".p39-results-head button").disabled,
          );
          await page.evaluate(() => document.fonts.ready);
        };
        const snap = async (state, label, bottom = false) => {
          if (!capture) return;
          await page.mouse.move(0, 0);
          await dialog.evaluate(
            (element, scrollBottom) => element.scrollTo(0, scrollBottom ? element.scrollHeight : 0),
            bottom,
          );
          const bytes = await page.screenshot({ fullPage: false, animations: "disabled" }),
            file = `${width}-${state}.png`;
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            state,
            label,
            routeId: "P41",
            kind: "actual-vue-review-template",
            sha256: reviewHash(bytes),
            viewport: page.viewportSize(),
            imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
            concreteUrl: page.url(),
            role: "synthetic fixture without authentication",
            theme: "review-only C",
            browser: `Chromium ${browser.version()}`,
            os: `${os.platform()} ${os.release()}`,
            capturedAt: new Date().toISOString(),
            sourceSha: reviewHash(JSON.stringify(sourceHashes)),
          });
        };
        const geometry = async (step) => {
          check(
            `${step} dialog contains horizontal content`,
            await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
          );
          check(
            `${step} controls44 and16`,
            await dialog.locator("button,input,select").evaluateAll((ns) =>
              ns
                .filter((n) => n.checkVisibility({ visibilityProperty: true }))
                .every((n) => {
                  const r = n.getBoundingClientRect();
                  return (
                    r.height >= 44 &&
                    r.width >= 44 &&
                    parseFloat(getComputedStyle(n).fontSize) >= 16
                  );
                }),
            ),
          );
          check(
            `${step} viewport contains dialog`,
            await dialog.evaluate((n) => {
              const r = n.getBoundingClientRect();
              return (
                r.left >= 0 &&
                r.right <= innerWidth + 1 &&
                r.top >= 0 &&
                r.bottom <= innerHeight + 1
              );
            }),
          );
        };
        await visit();
        check(
          "direct deep-link native modal open",
          await dialog.evaluate((n) => n.matches(":modal")),
        );
        check("initial focus is name", await name().evaluate((n) => document.activeElement === n));
        check(
          "native name constraints unchanged",
          await name().evaluate((n) => ({
            required: n.required,
            min: n.minLength,
            max: n.maxLength,
          })),
          { required: true, min: 2, max: 120 },
        );
        check(
          "native slug constraints unchanged",
          await slug().evaluate((n) => ({
            required: n.required,
            min: n.minLength,
            max: n.maxLength,
            pattern: n.pattern,
          })),
          { required: true, min: 2, max: 63, pattern: "[a-z0-9](?:[a-z0-9]|-){1,62}" },
        );
        await geometry("step1");
        await snap("step1", "第一步 · 组织资料");
        await name().fill("南方选品团队");
        await slug().fill("south-team-");
        await next().click();
        await dialog.getByRole("combobox").waitFor();
        check("trailing hyphen moves to confirmation with no POST", posts().length, 0);
        check(
          "native selected and disabled user options",
          await dialog
            .locator("select option")
            .evaluateAll((ns) => ns.map((n) => ({ value: n.value, disabled: n.disabled }))),
          [
            { value: "", disabled: false },
            { value: data.overview.users[0].id, disabled: false },
            { value: disabledUser.id, disabled: true },
          ],
        );
        await geometry("step2");
        await snap("step2", "第二步 · 默认管理员与创建核对");
        if ([390, 1440].includes(width)) {
          await dialog.getByRole("combobox").selectOption(data.overview.users[0].id);
          await snap("selected-admin", "明确选择首位管理员");
          await dialog.getByRole("button", { name: "上一步", exact: true }).click();
          check(
            "back keeps name and slug",
            [await name().inputValue(), await slug().inputValue()],
            ["南方选品团队", "south-team-"],
          );
          await name().fill("");
          await next().click();
          check("required name blocks next", await name().evaluate((n) => n.validity.valueMissing));
          check(
            "invalid name first focus",
            await name().evaluate((n) => n === document.activeElement),
          );
          await snap("name-required", "名称必填 · 原生校验状态，不含浏览器气泡");
          await name().fill("南方选品团队");
          await slug().fill("Bad_Slug");
          await next().click();
          check(
            "invalid slug blocks next",
            await slug().evaluate((n) => n.validity.patternMismatch),
          );
          await snap("slug-invalid", "不合法标识 · 原生校验状态，不含浏览器气泡");
          await slug().fill("south-team-");
          await slug().press("Enter");
          await settle();
          check("Enter with two fields does not submit creation", posts().length, 0);
          check("Enter on step1 retains first step", await next().isVisible());
          await next().focus();
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          check(
            "next visible keyboard focus",
            await next().evaluate(
              (n) => n.matches(":focus-visible") && getComputedStyle(n).outlineWidth === "3px",
            ),
          );
          await snap("next-focus", "下一步 · 蓝色键盘焦点");
          await next().click();
          check(
            "back retained selected administrator",
            await dialog.getByRole("combobox").inputValue(),
            data.overview.users[0].id,
          );
          await dialog.getByRole("combobox").selectOption("");
          await confirm().hover();
          await snap("confirm-hover", "确认创建 · 悬停");
          await confirm().focus();
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          await snap("confirm-focus", "确认创建 · 蓝色键盘焦点");
          const before = posts().length;
          held = new Promise((resolve) => (release = resolve));
          await confirm().click();
          await page.waitForFunction(
            () => document.querySelector(".organization-wizard .p41-action-primary")?.disabled,
          );
          check("default POST omits optional administrator and reason", posts().at(-1).body, {
            name: "南方选品团队",
            slug: "south-team-",
          });
          check("idempotency header is present", posts().at(-1).hasIdempotencyKey);
          check(
            "pending only confirm disabled; select back cancel remain usable",
            {
              select: await dialog.getByRole("combobox").isDisabled(),
              back: await dialog.getByRole("button", { name: "上一步" }).isDisabled(),
              cancel: await dialog.getByRole("button", { name: "取消" }).isDisabled(),
            },
            { select: false, back: false, cancel: false },
          );
          await snap("pending", "提交中 · 原生禁用与保留的编辑入口");
          release();
          held = null;
          await dialog.getByRole("alert").waitFor();
          check("one request for confirm", posts().length, before + 1);
          check(
            "failed confirm keeps draft summary",
            await dialog.locator(".organization-wizard__summary dd").allTextContents(),
            ["南方选品团队", "south-team-", "同时创建默认工作区和组织级数据范围"],
          );
          await snap("failure", "创建失败 · 保留核对内容");
          await dialog.getByRole("combobox").selectOption(data.overview.users[0].id);
          check("admin change clears error", await dialog.getByRole("alert").count(), 0);
          await dialog.getByRole("button", { name: "取消", exact: true }).click();
          await page.waitForURL((url) => url.pathname === routePath && !url.search);
          check(
            "cancel returns focus to original create entry",
            await page
              .locator(".hero-actions button")
              .first()
              .evaluate((n) => n === document.activeElement),
          );
          await page.locator(".hero-actions button").first().click();
          await dialog.waitFor();
          check(
            "reopen keeps draft and starts at step1",
            [await name().inputValue(), await slug().inputValue(), await next().isVisible()],
            ["南方选品团队", "south-team-", true],
          );
          await snap("reopened", "取消后重开 · 草稿保留，回到第一步");
          await name().fill("组织".repeat(60));
          await slug().fill("a".repeat(63));
          await next().click();
          await dialog.getByRole("combobox").waitFor();
          await snap("long-summary", "120字符名称与63字符标识核对");
          await geometry("long");
          if (width === 390) {
            await page.setViewportSize({ width: 390, height: 600 });
            await snap("short-top", "600px短屏 · 顶部步骤与管理员");
            await snap("short-bottom", "600px短屏 · 核对下部与底部操作", true);
            check(
              "short footer remains reachable",
              await dialog.locator("footer").evaluate((n) => {
                const r = n.getBoundingClientRect();
                return r.bottom <= innerHeight && r.top >= 0;
              }),
            );
            await page.setViewportSize({ width: 390, height: 900 });
          }
          await page.keyboard.press("Escape");
          await page.waitForURL((url) => url.pathname === routePath);
          check("Escape does not create", posts().length, before + 1);
          await page.locator(".hero-actions button").first().click();
          await dialog.waitFor();
          await name().fill("成功创建样例");
          await slug().fill("created-fixture");
          await next().click();
          await dialog.getByRole("combobox").selectOption(data.overview.users[0].id);
          postStatus = 200;
          await confirm().click();
          await page.waitForURL(
            (url) => url.pathname === `${routePath}/00000000-0000-4000-8000-000000000698`,
          );
          check("explicit administrator is the only extra create field", posts().at(-1).body, {
            name: "成功创建样例",
            slug: "created-fixture",
            initial_admin_user_id: data.overview.users[0].id,
          });
          check(
            "success closes wizard and reads overview",
            !(await dialog.isVisible()) && requests.at(-1).method === "GET",
          );
          // P42's existing detail is not presented as an approved C design.
          await page.keyboard.press("Escape");
          await page.waitForURL((url) => url.pathname === routePath);
          await page.locator(".hero-actions button").first().click();
          await dialog.waitFor();
          check(
            "success clears prior name and slug",
            [await name().inputValue(), await slug().inputValue()],
            ["", ""],
          );
          await name().fill("新草稿");
          await slug().fill("fresh-fixture");
          await next().click();
          check(
            "success clears prior explicit administrator",
            await dialog.getByRole("combobox").inputValue(),
            "",
          );
        }
        check(
          "all traffic intercepted and no browser errors",
          { unexpected, errors },
          { unexpected: [], errors: [] },
        );
        observations.push({
          width,
          requests,
          scope:
            "Synthetic GET/POST only, original Vue parent/wizard logic; no real organization, MySQL, audit or authentication",
        });
      } finally {
        await context.close();
      }
    }
    return { sourceHashes, transformedHashes };
  },
);
if (capture) {
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        approval: "pending",
        scope:
          "P41 actual Vue wizard/parent scripts with review-only presentation and C CSS. Not full App/KeepAlive, real API/RBAC/database, late-write ownership, P42 design or production acceptance.",
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        ...bindings,
        checks,
        screenshots,
        observations,
        processesClosed: true,
      },
      null,
      2,
    ) + "\n",
  );
  const sections = screenshots
    .map(
      (s) =>
        `<section><h2>${s.viewport.width}px · ${s.label}</h2><img src="${s.file}" alt="${s.label}"></section>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P41新建组织审核</title><style>body{max-width:1440px;margin:24px auto;padding:20px;background:#edf1f6;color:#202c3d;font-family:'Microsoft YaHei',sans-serif}img{max-width:100%;border:1px solid #dbe1e9}section{margin:36px 0}</style><h1>P41 新建组织 · 待审核</h1><p>真实Vue逻辑，审核模板和样式；请求全部拦截为合成数据，没有创建真实组织。仅审核向导，不代表P42、完整应用或生产验收。</p>${sections}`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    output,
    processesClosed: true,
  }),
);
