import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { withVueReview, reviewHash } from "./lib/ui-phase2-vue-review-host.mjs";
import {
  organizationListPreview,
  organizationRecordPreview,
} from "./lib/ui-phase2-organization-list-preview.mjs";
import { buildAccountOverviewDesignData } from "./lib/ui-phase2-account-overview-design-data.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p40-list-preview";
const routePath = "/platform-admin/organizations";
const component = "apps/web/src/components/PlatformAccountCenter.vue";
const records = "apps/web/src/components/PlatformOrganizationRecords.vue";
const data = await buildAccountOverviewDesignData(process.cwd());
const checks = [],
  screenshots = [],
  observations = [];
if (capture) await mkdir(output, { recursive: true });
const bindings = await withVueReview(
  {
    pageId: "P40",
    routePath,
    transforms: { [component]: organizationListPreview, [records]: organizationRecordPreview },
    styles: [
      "account-filter-preview.css",
      "account-create-preview.css",
      "account-page-preview.css",
      "organization-list-preview.css",
    ].map((f) => "design-plans/ui-phase-2-2026-09-07/implementation/" + f),
    files: [
      "scripts/verify-ui-phase2-organization-list-preview.mjs",
      "scripts/lib/ui-phase2-organization-list-preview.mjs",
      "scripts/lib/ui-phase2-account-overview-design-data.mjs",
      "tests/e2e/m06-01-platform-accounts.spec.ts",
      "apps/api/src/platform-account-service.ts",
      "apps/api/src/mysql-platform-account-repository.ts",
    ],
  },
  async ({ browser, origin, sourceHashes, transformedHashes }) => {
    for (const width of [390, 759, 760, 761, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          requests = [],
          errors = [],
          unexpected = [];
        let variant = "normal",
          responseStatus = 200,
          held,
          release;
        // Vue event invokers compare Date.now(); a permanently fixed time can discard
        // bubbling submit handlers. Keep the test clock advancing like a real browser.
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
            // Capture the response fixture at dispatch so a later test variant cannot change its identity.
            const requestVariant = variant,
              status = responseStatus;
            requests.push({
              method: req.method(),
              query: Object.fromEntries(url.searchParams),
              variant: requestVariant,
              status,
            });
            const overview = structuredClone(data.overview),
              base = overview.organizations[0];
            if (requestVariant === "empty") overview.organizations = [];
            if (requestVariant === "many")
              overview.organizations = Array.from({ length: 12 }, (_, n) => ({
                ...base,
                id: `00000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
                name: `合成组织 ${n + 1}`,
                slug: `fixture-org-${n + 1}`,
                status: n % 3 ? "active" : "archived",
              }));
            if (requestVariant === "long") {
              base.name = "跨境供应链协同组织".repeat(10);
              base.slug = "fixture-long-".repeat(20);
            }
            if (requestVariant === "zero") {
              base.member_count = 0;
              base.workspace_count = 0;
            }
            if (requestVariant === "unknown") base.status = "fixture_unknown";
            if (held) await held;
            return route.fulfill({
              status,
              json:
                status === 200
                  ? { data: overview, request_id: "p40-review", trace_id: "p40-review" }
                  : {
                      error: {
                        code: "fixture_read_failure",
                        message: "测试读取失败",
                        action_hint: "当前读取暂未完成，请稍后重试。",
                      },
                      request_id: "p40-error",
                      trace_id: "p40-error",
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
        const ready = () =>
          page.waitForFunction(
            () =>
              !!document.querySelector(".p39-results-head button") &&
              !document.querySelector(".p39-results-head button").disabled &&
              !document
                .querySelector(".p39-results > .account-state")
                ?.textContent.includes("正在读取"),
          );
        const visit = async (query = "keep=p40") => {
          await page.goto(`${origin}${routePath}?${query}`);
          await ready();
          await page.evaluate(() => document.fonts.ready);
        };
        const noOverflow = () =>
          page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
        const snap = async (state, label, overlay = false) => {
          if (!capture) return;
          await page.mouse.move(0, 0);
          await page.evaluate(() => window.scrollTo(0, 0));
          const bytes = await page.screenshot({ fullPage: !overlay, animations: "disabled" }),
            file = `${width}-${state}.png`;
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            state,
            label,
            sha256: reviewHash(bytes),
            routeId: "P40",
            kind: "actual-vue-review-template",
            viewport: page.viewportSize(),
            imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
            concreteUrl: page.url(),
            role: "fixture without authentication",
            theme: "review-only C",
            browser: `Chromium ${browser.version()}`,
            os: `${os.platform()} ${os.release()}`,
            capturedAt: new Date().toISOString(),
            sourceSha: reviewHash(JSON.stringify(sourceHashes)),
          });
        };
        await visit();
        check(
          "P40 route-specific title",
          await page.locator(".account-hero h2").innerText(),
          "组织管理",
        );
        check(
          "independent original global summary",
          await page.locator(".account-metrics strong").allTextContents(),
          ["2 / 3", "16 / 18", "2"],
        );
        check("no page overflow", await noOverflow());
        check(
          "no duplicate refresh",
          await page.getByRole("button", { name: "刷新数据", exact: true }).count(),
          1,
        );
        check(
          "original three navigation targets",
          await page
            .locator(".account-tabs a")
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href"))),
          [routePath, "/platform-admin/users", "/platform-admin/admins"],
        );
        check(
          "normal targets44 and text16",
          await page
            .locator(".account-center :is(button,a,input,select,summary)")
            .evaluateAll((nodes) =>
              nodes
                .filter((n) => n.checkVisibility({ visibilityProperty: true }))
                .every((n) => {
                  const rect = n.getBoundingClientRect();
                  return (
                    rect.width >= 44 &&
                    rect.height >= 44 &&
                    parseFloat(getComputedStyle(n).fontSize) >= 16
                  );
                }),
            ),
        );
        check(
          "actual record breakpoint",
          await page.locator(".responsive-data-view__mobile").isVisible(),
          width <= 760,
        );
        if (width <= 760)
          check(
            "mobile status has no legacy ledger marker",
            await page.locator(".p40-record-status").evaluate((node) => ({
              border: getComputedStyle(node).borderLeftWidth,
              shadow: getComputedStyle(node).boxShadow,
            })),
            { border: "0px", shadow: "none" },
          );
        await snap("normal", "原始组织列表 · 全局汇总独立");
        if ([390, 1440].includes(width)) {
          const openFilters = async () => {
            if (width <= 760) await page.locator(".responsive-filter-drawer__trigger").click();
          };
          const form = page.locator(".account-filter");
          await openFilters();
          check(
            "P40 exact status options excluding user disabled",
            await form.locator("select option").evaluateAll((ns) => ns.map((n) => n.value)),
            ["", "active", "archived"],
          );
          check(
            "organization-specific input label",
            await form.getByRole("textbox", { name: "组织名称或标识" }).count(),
            1,
          );
          await form.getByRole("textbox").fill("  米豆  ");
          await form.locator("select").selectOption("archived");
          await snap("filters", "组织名称/标识与三选项状态", width <= 760);
          await form.getByRole("button", { name: "搜索", exact: true }).click();
          await page.waitForURL(
            (url) =>
              url.searchParams.get("query") === "米豆" &&
              url.searchParams.get("status") === "archived",
            { timeout: 5000 },
          );
          await ready();
          check(
            "filter trims query and keeps unrelated key",
            Object.fromEntries(new URL(page.url()).searchParams),
            { keep: "p40", query: "米豆", status: "archived" },
          );
          check("GET contract keeps only query/status", requests.at(-1).query, {
            query: "米豆",
            status: "archived",
          });
          await openFilters();
          await form.getByRole("button", { name: "重置", exact: true }).click();
          await page.waitForURL(
            (url) => !url.searchParams.has("query") && !url.searchParams.has("status"),
          );
          await ready();
          if (
            width <= 760 &&
            (await page.getByRole("dialog", { name: "组织筛选", exact: true }).isVisible())
          )
            await page.keyboard.press("Escape");
          check("reset preserves unrelated query", new URL(page.url()).search, "?keep=p40");
          for (const state of ["many", "long", "zero", "unknown"]) {
            variant = state;
            await visit();
            check(`${state} no page overflow`, await noOverflow());
            if (state === "many")
              check(
                "twelve fixture rows not global total",
                await page
                  .locator(
                    width <= 760
                      ? ".responsive-data-view__mobile article"
                      : ".account-table-wrap tbody tr",
                  )
                  .count(),
                12,
              );
            if (state === "zero")
              check(
                "zero relation counts preserved",
                await page
                  .locator(
                    width <= 760
                      ? ".p40-record-counts b"
                      : ".account-table-wrap tbody tr td:nth-child(2), .account-table-wrap tbody tr td:nth-child(3)",
                  )
                  .allTextContents(),
                width <= 760 ? ["0", "0"] : ["0 人", "0 个"],
              );
            if (state === "unknown")
              check(
                "unknown status retained verbatim",
                (await page.locator(".account-table-wrap").innerText()).includes("fixture_unknown"),
              );
            await snap(
              state,
              {
                many: "12条合成记录 · 非真实分页",
                long: "超长名称与标识 · 鲁棒性样例",
                zero: "成员与工作区均为0",
                unknown: "未知状态原样保留",
              }[state],
            );
          }
          variant = "normal";
          await visit();
          if (width <= 760) {
            const trigger = page.locator(".responsive-data-view__mobile article button").first();
            await trigger.click();
            const drawer = page.locator(".responsive-data-view__drawer");
            await drawer.waitFor();
            await snap("preview", "移动记录预览 · 尚未进入组织详情", true);
            await drawer.locator("summary").click();
            await snap("technical", "移动预览技术详情", true);
            const before = requests.length;
            await drawer.getByRole("button", { name: "打开组织详情", exact: true }).click();
            await page.waitForURL(
              (url) => url.pathname === `${routePath}/${data.overview.organizations[0].id}`,
            );
            check("preview closes on detail navigation", await drawer.count(), 0);
            check(
              "detail navigation does not write",
              requests.slice(before).every((r) => r.method === "GET"),
            );
          } else {
            const toolbar = page.locator(".table-view-controls__toolbar");
            await toolbar.locator("summary").click();
            await snap("columns", "桌面显示列");
            for (const n of [2, 3, 4, 5])
              await toolbar.getByRole("checkbox", { name: `切换第 ${n} 列` }).uncheck();
            check(
              "last visible column cannot be hidden",
              await toolbar.getByRole("checkbox", { name: "切换第 1 列" }).isDisabled(),
            );
            await snap("last-column", "保留最后一列 · 禁用状态");
            for (const n of [2, 3, 4, 5])
              await toolbar.getByRole("checkbox", { name: `切换第 ${n} 列` }).check();
            await toolbar.locator("summary").click();
            const beforeHeight = await page
              .locator(".account-table-wrap tbody tr")
              .evaluate((n) => n.getBoundingClientRect().height);
            await toolbar.getByRole("combobox").selectOption("compact");
            check(
              "compact visibly reduces row height",
              (await page
                .locator(".account-table-wrap tbody tr")
                .evaluate((n) => n.getBoundingClientRect().height)) < beforeHeight,
            );
            check(
              "compact detail target remains44",
              (await page.locator(".account-table-wrap td button").boundingBox()).height >= 44,
            );
            await snap("compact", "紧凑密度 · 保留44px操作");
            await toolbar.getByRole("button", { name: "首列已冻结" }).click();
            check(
              "unfreeze removes sticky cells",
              await page.locator(".table-view-controls__frozen").count(),
              0,
            );
            await snap("unfrozen", "首列未冻结");
            await page.locator(".account-table-wrap td button").first().click();
            await page.waitForURL(
              (url) => url.pathname === `${routePath}/${data.overview.organizations[0].id}`,
            );
          }
          check(
            "original detail route reached",
            new URL(page.url()).pathname,
            `${routePath}/${data.overview.organizations[0].id}`,
          );
          await visit();
          await page
            .locator(".hero-actions")
            .getByRole("button", { name: "新建组织", exact: true })
            .click();
          await page.waitForURL((url) => url.pathname === `${routePath}/new`);
          check("original create route reached", new URL(page.url()).pathname, `${routePath}/new`);
          // P41/P42 are real original children but their old-styled views are not P40 review images.
          await visit();
          await page
            .locator(".hero-actions")
            .getByRole("button", { name: "新建用户", exact: true })
            .click();
          await page.getByRole("dialog", { name: "新建用户或平台管理员", exact: true }).waitFor();
          await snap("create-user", "P40内新建用户 · 复用P39局部样式", true);
          await page.keyboard.press("Escape");
          held = new Promise((resolve) => (release = resolve));
          responseStatus = 500;
          await page.locator(".p39-results-head button").click();
          await page.waitForFunction(
            () => document.querySelector(".p39-results-head button")?.disabled,
          );
          check(
            "refresh retains records",
            await page
              .locator(
                width <= 760
                  ? ".responsive-data-view__mobile article"
                  : ".account-table-wrap tbody tr",
              )
              .count(),
            1,
          );
          await snap("refreshing", "后台刷新 · 旧数据保留");
          release();
          held = null;
          await ready();
          check(
            "refresh error explains retained snapshot",
            (await page.locator(".account-message").innerText()).includes(
              "已保留上次成功读取的数据",
            ),
          );
          await snap("refresh-failed", "刷新失败 · 旧数据与提示");
          responseStatus = 200;
          variant = "empty";
          await visit();
          check(
            "empty list retains global summary",
            await page.locator(".account-metrics strong").allTextContents(),
            ["2 / 3", "16 / 18", "2"],
          );
          check(
            "unfiltered empty has original create action",
            await page.locator(".account-empty").getByRole("button", { name: "新建组织" }).count(),
            1,
          );
          await snap("empty", "本次未返回组织 · 非全平台零组织");
          await visit("query=不存在&keep=p40");
          await snap("filtered-empty", "已筛选无结果 · 原清除入口");
          await page.locator(".account-empty").getByRole("button", { name: "清除筛选" }).click();
          await page.waitForURL((url) => !url.searchParams.has("query"));
          await ready();
          check("empty reset preserves unrelated URL", new URL(page.url()).search, "?keep=p40");
          variant = "normal";
          responseStatus = 500;
          await visit();
          check(
            "first error does not invent totals",
            await page.locator(".account-metrics").count(),
            0,
          );
          await snap("first-failure", "首次读取失败");
          responseStatus = 200;
          held = new Promise((resolve) => (release = resolve));
          await page.goto(`${origin}${routePath}?keep=p40`);
          await page.locator(".p39-results > .account-state").waitFor();
          await snap("loading", "首次读取中");
          release();
          held = null;
          await ready();
        }
        check(
          "no writes or external requests or browser errors",
          { unexpected, errors },
          { unexpected: [], errors: [] },
        );
        observations.push({
          width,
          requests,
          scope:
            "Original parent/child Vue in isolated reactive router; no App/KeepAlive, authentication, backend filtering, writes or destination page acceptance",
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
          "P40 actual Vue parent and record scripts with review-only template/CSS. Not full App shell, P41/P42 design, real API/RBAC/filtering or production acceptance.",
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
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P40组织管理审核</title><style>body{max-width:1440px;margin:24px auto;padding:20px;background:#edf1f6;color:#202c3d;font-family:'Microsoft YaHei',sans-serif}img{max-width:100%;border:1px solid #dbe1e9}section{margin:36px 0}</style><h1>P40 组织管理 · 待审核</h1><p>实际Vue逻辑，审核模板与样式；所有数据为测试样例。未部署；不代表完整应用壳、真实权限/数据库、P41/P42或整页全部状态通过。</p>${screenshots.map((s) => `<section><h2>${s.viewport.width}px · ${s.label}</h2><img src="${s.file}" alt="${s.label}"></section>`).join("\n")}`,
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
