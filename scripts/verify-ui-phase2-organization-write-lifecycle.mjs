import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { withVueReview, reviewHash } from "./lib/ui-phase2-vue-review-host.mjs";
import {
  organizationListPreview,
  organizationRecordPreview,
} from "./lib/ui-phase2-organization-list-preview.mjs";
import {
  organizationDetailPreview,
  organizationReasonPreview,
} from "./lib/ui-phase2-organization-detail-preview.mjs";
import { buildAccountOverviewDesignData } from "./lib/ui-phase2-account-overview-design-data.mjs";

// Diagnostic assertions below describe observed defects, not accepted product behavior.
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const output = "output/playwright/p42-write-lifecycle";
const listPath = "/platform-admin/organizations";
const fixtures = await buildAccountOverviewDesignData(process.cwd());
const sourceRecord = fixtures.overview.organizations[0];
const checks = [],
  scenarios = [],
  screenshots = [];
if (capture) await mkdir(output, { recursive: true });
const bindings = await withVueReview(
  {
    pageId: "P42",
    routePath: listPath,
    transforms: {
      "apps/web/src/components/PlatformAccountCenter.vue": organizationListPreview,
      "apps/web/src/components/PlatformOrganizationRecords.vue": organizationRecordPreview,
      "apps/web/src/components/PlatformOrganizationDetailDialog.vue": organizationDetailPreview,
      "apps/web/src/components/PlatformAccountDialogs.vue": organizationReasonPreview,
    },
    styles: [
      "account-filter-preview.css",
      "account-create-preview.css",
      "account-page-preview.css",
      "organization-list-preview.css",
      "organization-detail-preview.css",
    ].map((f) => "design-plans/ui-phase-2-2026-09-07/implementation/" + f),
    files: [
      "scripts/verify-ui-phase2-organization-write-lifecycle.mjs",
      "scripts/lib/ui-phase2-organization-detail-preview.mjs",
      "scripts/lib/ui-phase2-organization-list-preview.mjs",
      "scripts/lib/ui-phase2-account-overview-design-data.mjs",
      "tests/e2e/m06-01-platform-accounts.spec.ts",
    ],
  },
  async ({ browser, origin, sourceHashes, transformedHashes }) => {
    for (const width of [390, 1440])
      for (const action of ["profile", "status"])
        for (const mode of ["success-close", "failure-close", "refresh-failure", "reason-back"]) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            locale: "zh-CN",
            timezoneId: "Asia/Shanghai",
            reducedMotion: "reduce",
          });
          let release;
          try {
            const page = await context.newPage();
            const requests = [],
              errors = [],
              unexpected = [];
            let completed = false,
              record = structuredClone(sourceRecord);
            const held = new Promise((resolve) => (release = resolve));
            page.on("pageerror", (error) => errors.push(error.message));
            await page.route("**/*", async (route) => {
              const req = route.request(),
                url = new URL(req.url());
              const fail = (hint) =>
                route.fulfill({
                  status: 500,
                  json: {
                    error: { code: "fixture_failure", message: "测试失败", action_hint: hint },
                    request_id: "p42-lifecycle-fixture",
                    trace_id: "p42-lifecycle-fixture",
                  },
                });
              if (
                url.origin === origin &&
                url.pathname === "/api/v1/platform/accounts" &&
                req.method() === "GET"
              ) {
                requests.push({ method: "GET", path: url.pathname, afterWrite: completed });
                if (completed && mode === "refresh-failure") return fail("测试：重新读取失败。");
                const data = structuredClone(fixtures.overview);
                data.organizations = data.organizations.map((o) =>
                  o.id === record.id ? structuredClone(record) : o,
                );
                return route.fulfill({
                  json: {
                    data,
                    request_id: "p42-lifecycle-fixture",
                    trace_id: "p42-lifecycle-fixture",
                  },
                });
              }
              const target =
                "/api/v1/platform/accounts/organizations/" +
                sourceRecord.id +
                (action === "status" ? "/status" : "");
              if (
                url.origin === origin &&
                url.pathname === target &&
                req.method() === (action === "status" ? "POST" : "PATCH")
              ) {
                const body = req.postDataJSON();
                requests.push({
                  method: req.method(),
                  path: url.pathname,
                  body,
                  hasIdempotencyKey: Boolean(req.headers()["idempotency-key"]),
                });
                await held;
                completed = true;
                if (mode === "failure-close") return fail("测试：原组织写入失败。");
                record =
                  action === "status"
                    ? { ...record, status: body.status }
                    : {
                        ...record,
                        name: body.name,
                        timezone: body.timezone,
                        data_retention_days: body.data_retention_days,
                      };
                return route.fulfill({
                  json: {
                    data: structuredClone(record),
                    request_id: "p42-lifecycle-fixture",
                    trace_id: "p42-lifecycle-fixture",
                  },
                });
              }
              if (url.origin === origin && !url.pathname.startsWith("/api/"))
                return route.continue();
              unexpected.push(`${req.method()} ${url.pathname}`);
              return route.abort();
            });
            const check = (name, actual, expected = true) => {
              assert.deepEqual(actual, expected, `${width}/${action}/${mode}: ${name}`);
              checks.push({ width, action, mode, name });
            };
            const detail = page.locator(".organization-detail-dialog"),
              reason = page.locator(".p42-reason-dialog");
            const snapshot = async (phase) => {
              const state = {
                url: new URL(page.url()).pathname,
                detailVisible: await detail.isVisible(),
                reasonVisible: await reason.isVisible(),
                identity: await detail.locator(".p42-identity h3").textContent(),
                feedback: await detail.locator('[role="status"]').allTextContents(),
                errors: await detail.locator('[role="alert"]').allTextContents(),
                field: await detail
                  .getByRole("textbox", { name: "组织名称", exact: true, includeHidden: true })
                  .inputValue(),
              };
              if (capture) {
                const file = `${width}-${action}-${mode}-${phase}.png`;
                const bytes = await page.screenshot({ animations: "disabled" });
                await writeFile(`${output}/${file}`, bytes);
                screenshots.push({
                  file,
                  width,
                  action,
                  mode,
                  phase,
                  sha256: reviewHash(bytes),
                  sourceSha: reviewHash(JSON.stringify(sourceHashes)),
                  state,
                });
              }
              return state;
            };
            await page.goto(`${origin}${listPath}/${sourceRecord.id}`);
            await detail.waitFor();
            await page.waitForFunction(
              () => !document.querySelector(".p39-results-head button")?.disabled,
            );
            if (mode === "reason-back") {
              // Build a genuine same-instance history entry; no injected component refs or events.
              await detail.getByRole("button", { name: "关闭组织详情", exact: true }).click();
              if (width === 1440)
                await page
                  .locator("tbody tr")
                  .filter({ hasText: sourceRecord.name })
                  .getByRole("button", { name: "查看详情", exact: true })
                  .click();
              else {
                await page.getByRole("button").filter({ hasText: sourceRecord.name }).click();
                await page.getByRole("button", { name: "打开组织详情", exact: true }).click();
              }
              await detail.waitFor();
            }
            if (action === "profile")
              await detail
                .getByRole("textbox", { name: "组织名称", exact: true })
                .fill("已提交的组织资料");
            await detail
              .getByRole("button", {
                name: action === "profile" ? "保存组织资料" : "停用组织",
                exact: true,
              })
              .click();
            await reason.waitFor();
            if (mode === "reason-back") {
              await page.goBack();
              await page.waitForURL((url) => url.pathname === listPath);
              check(
                "unsubmitted reason persists after history leaves detail",
                await reason.isVisible(),
              );
              check("detail closed after history leaves", await detail.isVisible(), false);
              await snapshot("left-before-confirm");
            }
            await reason
              .getByRole("textbox", { name: "操作原因", exact: true })
              .fill("生命周期测试");
            const dispatched = page.waitForRequest(
              (req) => req.method() === (action === "status" ? "POST" : "PATCH"),
            );
            await reason.getByRole("button", { name: "确认执行", exact: true }).click();
            await dispatched;
            if (mode.endsWith("-close")) {
              await detail.getByRole("button", { name: "关闭组织详情", exact: true }).click();
              await page.waitForURL((url) => url.pathname === listPath);
              check("detail closed before server response", await detail.isVisible(), false);
              await snapshot("closed-pending");
            }
            release();
            await page.waitForFunction(() => !document.querySelector(".p42-save")?.disabled);
            if (mode === "failure-close") {
              check("failed write does not reopen closed detail", await detail.isVisible(), false);
            } else if (mode === "refresh-failure") {
              check(
                "success is shown despite failed reread",
                await detail.getByRole("status").innerText(),
                action === "profile" ? "操作成功\n组织资料已更新。" : "操作成功\n组织已停用。",
              );
              check(
                "identity still comes from old overview",
                await detail.locator(".p42-identity h3").innerText(),
                sourceRecord.name,
              );
              if (action === "status")
                check(
                  "status remains active after successful stop and failed reread",
                  await detail.getByRole("button", { name: "停用组织", exact: true }).isVisible(),
                );
              check(
                "reread failure remains in parent",
                (await page.locator("body").innerText()).includes("测试：重新读取失败。"),
              );
            } else {
              check("BUG late success reopens detail", await detail.isVisible());
              check("BUG URL still names list", new URL(page.url()).pathname, listPath);
            }
            const finalState = await snapshot("settled");
            const writes = requests.filter((r) => r.method !== "GET");
            check("exactly one intercepted write", writes.length, 1);
            check("original idempotency header", writes[0].hasIdempotencyKey);
            check(
              "no unexpected network or browser errors",
              { errors, unexpected },
              { errors: [], unexpected: [] },
            );
            scenarios.push({
              width,
              action,
              mode,
              requests,
              finalState,
              observedOutcome:
                mode === "failure-close"
                  ? "closed-but-hidden-error-set"
                  : mode === "refresh-failure"
                    ? "success-with-old-overview"
                    : "detail-reopened-at-list-url",
            });
          } finally {
            release?.();
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
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        kind: "actual-vue-diagnostic-defects-not-acceptance",
        scope:
          "P42 original scripts with existing review layout. All requests intercepted. Not full App/KeepAlive, production or authorization testing.",
        ...bindings,
        checks,
        scenarios,
        screenshots,
        processesClosed: true,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P42写入生命周期问题证据</title><style>body{max-width:1440px;margin:24px auto;padding:20px;font-family:'Microsoft YaHei',sans-serif;background:#edf1f6}img{max-width:100%}section{margin:36px 0}</style><h1>P42 原逻辑问题证据 · 不是通过验收</h1><p>合成响应，未修改真实组织。原Vue脚本未改，复用审核布局；非完整App/KeepAlive验证。</p>
${screenshots.map((s) => `<section><h2>${s.width} / ${s.action} / ${s.mode} / ${s.phase}</h2><p>URL: ${s.state.url}；详情显示: ${s.state.detailVisible}</p><img src="${s.file}" alt="${s.action} ${s.mode} ${s.phase}"></section>`).join("\n")}`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    scenarios: scenarios.length,
    images: screenshots.length,
    processesClosed: true,
    output,
  }),
);
