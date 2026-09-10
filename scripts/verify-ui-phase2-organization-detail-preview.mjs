import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
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

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p42-detail-preview",
  routePath = "/platform-admin/organizations";
const data = await buildAccountOverviewDesignData(process.cwd()),
  originalRecord = data.overview.organizations[0];
const detailSource = "apps/web/src/components/PlatformOrganizationDetailDialog.vue",
  reasonSource = "apps/web/src/components/PlatformAccountDialogs.vue";
const checks = [],
  screenshots = [],
  observations = [];
if (capture) await mkdir(output, { recursive: true });
const bindings = await withVueReview(
  {
    pageId: "P42",
    routePath,
    transforms: {
      "apps/web/src/components/PlatformAccountCenter.vue": organizationListPreview,
      "apps/web/src/components/PlatformOrganizationRecords.vue": organizationRecordPreview,
      [detailSource]: organizationDetailPreview,
      [reasonSource]: organizationReasonPreview,
    },
    styles: [
      "account-filter-preview.css",
      "account-create-preview.css",
      "account-page-preview.css",
      "organization-list-preview.css",
      "organization-detail-preview.css",
    ].map((f) => "design-plans/ui-phase-2-2026-09-07/implementation/" + f),
    files: [
      "scripts/verify-ui-phase2-organization-detail-preview.mjs",
      "scripts/lib/ui-phase2-organization-detail-preview.mjs",
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
        let variant = "normal",
          resultStatus = 500,
          held,
          release,
          record = structuredClone(originalRecord);
        await page.clock.install({ time: new Date("2026-09-11T02:00:00Z") });
        page.on("pageerror", (e) => errors.push(e.message));
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
              variant,
              query: Object.fromEntries(url.searchParams),
            });
            const overview = structuredClone(data.overview),
              item = structuredClone(record);
            if (variant === "zero") {
              item.member_count = 0;
              item.workspace_count = 0;
            }
            if (variant === "unavailable") {
              delete item.member_count;
              delete item.workspace_count;
            }
            if (variant === "unknown") item.status = "fixture_unknown";
            if (variant === "long") {
              item.name = "跨境协同组织".repeat(15);
              item.slug = "fixture-long-".repeat(15);
            }
            overview.organizations = variant === "missing" ? [] : [item];
            return route.fulfill({
              json: {
                data: overview,
                request_id: "p42-read-fixture",
                trace_id: "p42-read-fixture",
              },
            });
          }
          const isProfile =
            url.pathname === `/api/v1/platform/accounts/organizations/${originalRecord.id}` &&
            req.method() === "PATCH";
          const isStatus =
            url.pathname ===
              `/api/v1/platform/accounts/organizations/${originalRecord.id}/status` &&
            req.method() === "POST";
          if (url.origin === origin && (isProfile || isStatus)) {
            const body = req.postDataJSON(),
              status = resultStatus;
            requests.push({
              method: req.method(),
              path: url.pathname,
              body,
              status,
              hasIdempotencyKey: Boolean(req.headers()["idempotency-key"]),
            });
            if (held) await held;
            if (status === 200) {
              record = isProfile
                ? {
                    ...record,
                    name: body.name,
                    timezone: body.timezone,
                    data_retention_days: body.data_retention_days,
                  }
                : { ...record, status: body.status };
              return route.fulfill({
                json: {
                  data: structuredClone(record),
                  request_id: "p42-write-fixture",
                  trace_id: "p42-write-fixture",
                },
              });
            }
            return route.fulfill({
              status,
              json: {
                error: {
                  code: "fixture_write_failure",
                  message: "测试写入失败",
                  action_hint: "本次操作未完成，请核对后重试。",
                },
                request_id: "p42-failure-fixture",
                trace_id: "p42-failure-fixture",
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
        const dialog = page.locator(".organization-detail-dialog"),
          reason = page.locator(".p42-reason-dialog");
        const name = () => dialog.getByRole("textbox", { name: "组织名称", exact: true });
        const timezone = () => dialog.getByRole("textbox", { name: "时区", exact: true });
        const days = () => dialog.getByRole("spinbutton", { name: "数据保留天数", exact: true });
        const save = () => dialog.getByRole("button", { name: "保存组织资料", exact: true });
        const writes = () => requests.filter((r) => r.method !== "GET");
        const ready = () =>
          page.waitForFunction(() => !document.querySelector(".p39-results-head button")?.disabled);
        const visit = async () => {
          await page.goto(`${origin}${routePath}/${originalRecord.id}?keep=p42`);
          await dialog.waitFor();
          await ready();
          await page.evaluate(() => document.fonts.ready);
        };
        const snap = async (state, label, target = dialog, bottom = false) => {
          if (!capture) return;
          await page.mouse.move(0, 0);
          await target.evaluate((n, end) => n.scrollTo(0, end ? n.scrollHeight : 0), bottom);
          const bytes = await page.screenshot({ fullPage: false, animations: "disabled" }),
            file = `${width}-${state}.png`;
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            state,
            label,
            routeId: "P42",
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
        const geometry = async (state, target = dialog) => {
          check(
            `${state} horizontal containment`,
            await target.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
          );
          check(
            `${state} controls44 and16`,
            await target.locator("button,input,textarea,summary").evaluateAll((ns) =>
              ns
                .filter((n) => n.checkVisibility({ visibilityProperty: true }))
                .every((n) => {
                  const r = n.getBoundingClientRect();
                  return (
                    r.width >= 44 &&
                    r.height >= 44 &&
                    parseFloat(getComputedStyle(n).fontSize) >= 16
                  );
                }),
            ),
          );
          check(
            `${state} dialog inside viewport`,
            await target.evaluate((n) => {
              const r = n.getBoundingClientRect();
              return (
                r.left >= 0 &&
                r.top >= 0 &&
                r.right <= innerWidth + 1 &&
                r.bottom <= innerHeight + 1
              );
            }),
          );
        };
        await visit();
        check("actual native detail modal", await dialog.evaluate((n) => n.matches(":modal")));
        check(
          "original complete counts",
          await dialog.locator(".detail-grid strong").allTextContents(),
          ["正常使用", "8 人", "2 个"],
        );
        check("three original editable fields", await dialog.locator("input").count(), 3);
        check(
          "original name/timezone/day constraints",
          await dialog.locator("input").evaluateAll((ns) =>
            ns.map((n) => ({
              min: n.min,
              max: n.max,
              minLength: n.minLength,
              maxLength: n.maxLength,
              required: n.required,
              type: n.type,
            })),
          ),
          [
            { min: "", max: "", minLength: 2, maxLength: 120, required: true, type: "text" },
            { min: "", max: "", minLength: -1, maxLength: 64, required: true, type: "text" },
            {
              min: "30",
              max: "3650",
              minLength: -1,
              maxLength: -1,
              required: true,
              type: "number",
            },
          ],
        );
        check(
          "status action separated from save footer",
          await dialog.locator(".p42-work > footer .p42-status-action").count(),
          0,
        );
        await geometry("normal");
        await snap("normal", "组织身份与资料 · 正常详情");
        if ([390, 1440].includes(width)) {
          await snap("normal-bottom", "资料与独立状态操作 · 下部", dialog, true);
          await dialog.getByText("技术详情", { exact: true }).click();
          await snap("technical", "技术详情展开", dialog, true);
          check(
            "technical UUID unchanged",
            (await dialog.locator("details").innerText()).includes(originalRecord.id),
          );
          await dialog.getByText("技术详情", { exact: true }).click();
          await name().fill("");
          await save().click();
          check(
            "required name blocks reason dialog",
            (await name().evaluate((n) => n.validity.valueMissing)) && !(await reason.isVisible()),
          );
          await name().fill("更新后的组织");
          await timezone().fill("UTC");
          await days().fill("29");
          await save().click();
          check(
            "day below30 blocks reason",
            (await days().evaluate((n) => n.validity.rangeUnderflow)) &&
              !(await reason.isVisible()),
          );
          await snap("invalid-days", "保留天数低于下限 · 原生校验");
          await days().fill("30");
          await save().click();
          await reason.waitFor();
          check(
            "save reason has original title/default",
            [
              await reason.getAttribute("aria-label"),
              await reason.locator("textarea").inputValue(),
            ],
            ["保存组织资料", "平台管理员人工操作"],
          );
          await geometry("reason", reason);
          await snap("save-reason", "保存资料 · 原生原因确认", reason);
          await reason.getByRole("button", { name: "取消", exact: true }).click();
          check("reason cancel does not write", writes().length, 0);
          check(
            "reason cancel restores save focus",
            await save().evaluate((n) => n === document.activeElement),
          );
          await save().click();
          await reason.waitFor();
          await reason.locator("textarea").fill("");
          await reason.getByRole("button", { name: "确认执行" }).click();
          check(
            "empty reason native validation",
            await reason.locator("textarea").evaluate((n) => n.validity.valueMissing),
          );
          await snap("reason-required", "原因必填 · 原生校验", reason);
          await reason.locator("textarea").fill("  核对资料  ");
          held = new Promise((resolve) => (release = resolve));
          await reason.getByRole("button", { name: "确认执行" }).click();
          await page.waitForFunction(() => document.querySelector(".p42-save")?.disabled);
          check("reason closes before pending write", !(await reason.isVisible()));
          check("PATCH exact original four fields", writes().at(-1).body, {
            name: "更新后的组织",
            timezone: "UTC",
            data_retention_days: 30,
            reason: "核对资料",
          });
          check(
            "busy disables save/status but keeps field and close",
            {
              status: await dialog.locator(".p42-status-action").isDisabled(),
              input: await name().isDisabled(),
              close: await dialog.getByRole("button", { name: "关闭组织详情" }).isDisabled(),
            },
            { status: true, input: false, close: false },
          );
          await snap("save-pending", "保存处理中 · 原因已关闭", dialog, true);
          release();
          held = null;
          await dialog.locator(".organization-feedback.is-error").waitFor();
          await snap("save-failure", "保存失败 · 原详情内反馈", dialog, true);
          check(
            "save failure preserves fields",
            [await name().inputValue(), await timezone().inputValue(), await days().inputValue()],
            ["更新后的组织", "UTC", "30"],
          );
          await name().fill("再次更新的组织");
          check(
            "input clears prior feedback",
            await dialog.locator(".organization-feedback").count(),
            0,
          );
          resultStatus = 200;
          await save().click();
          await reason.waitFor();
          await reason.locator("textarea").fill("保存复核");
          await reason.getByRole("button", { name: "确认执行" }).click();
          await dialog.locator(".organization-feedback.is-success").waitFor();
          await snap("save-success", "保存成功 · 已重读测试列表", dialog, true);
          check(
            "refreshed identity matches edited name",
            await dialog.locator(".p42-identity h3").innerText(),
            "再次更新的组织",
          );
          for (const [action, nextStatus, why, state] of [
            ["停用组织", "archived", "停用复核", "disable"],
            ["恢复组织", "active", "恢复复核", "restore"],
          ]) {
            await dialog.getByRole("button", { name: action, exact: true }).click();
            await reason.waitFor();
            check(
              `${state} original reason variant`,
              await reason.getAttribute("aria-label"),
              action,
            );
            await snap(`${state}-reason`, `${action} · 原生原因确认`, reason);
            await reason.locator("textarea").fill(why);
            await reason.getByRole("button", { name: "确认执行" }).click();
            await dialog.locator(".organization-feedback.is-success").waitFor();
            check(`${state} exact status body`, writes().at(-1).body, {
              status: nextStatus,
              reason: why,
            });
            await snap(`${state}-success`, `${action}成功 · 测试返回`, dialog, true);
          }
          check(
            "all writes have idempotency header",
            writes().every((r) => r.hasIdempotencyKey),
          );
          for (const value of ["zero", "unavailable", "unknown", "long", "missing"]) {
            variant = value;
            await visit();
            if (value === "zero")
              check(
                "zero not converted to fallback one",
                await dialog.locator(".detail-grid strong").allTextContents(),
                ["正常使用", "0 人", "0 个"],
              );
            if (value === "unavailable")
              check(
                "missing counts explicitly not invented",
                await dialog.locator(".detail-grid strong").allTextContents(),
                ["正常使用", "尚未读取", "尚未读取"],
              );
            if (value === "unknown")
              check(
                "unknown status preserved with original restore action",
                (await dialog.locator(".detail-grid strong").first().innerText()) ===
                  "fixture_unknown" &&
                  (await dialog.getByRole("button", { name: "恢复组织" }).isVisible()),
              );
            if (value === "missing")
              check(
                "missing copy does not infer deletion or denial",
                (await dialog.innerText()).includes("本次组织列表没有返回这个目标") &&
                  !(await dialog.innerText()).includes("删除"),
              );
            await geometry(value);
            await snap(
              value,
              {
                zero: "关系计数均为0",
                unavailable: "缺失计数 · 审核稿不补1",
                unknown: "未知状态 · 原值保留",
                long: "超长组织身份 · 合成数据",
                missing: "当前列表未返回目标",
              }[value],
            );
          }
          const before = requests.length;
          await dialog.getByRole("button", { name: "重新加载", exact: true }).click();
          await ready();
          check(
            "missing retry uses overview GET",
            requests.length > before && requests.at(-1).path === "/api/v1/platform/accounts",
          );
          await dialog.getByRole("button", { name: "返回组织列表" }).click();
          await page.waitForURL((url) => url.pathname === routePath && !url.search);
          check(
            "missing return uses bare organization list",
            new URL(page.url()).pathname,
            routePath,
          );
          variant = "normal";
          await visit();
          if (width === 390) {
            await page.setViewportSize({ width: 390, height: 600 });
            await snap("short-top", "600px短屏 · 身份与资料上部");
            await snap("short-bottom", "600px短屏 · 状态与保存操作", dialog, true);
            check(
              "short footer reachable",
              await dialog.locator(".p42-work footer").evaluate((n) => {
                const r = n.getBoundingClientRect();
                return r.top >= 0 && r.bottom <= innerHeight;
              }),
            );
            await page.setViewportSize({ width: 390, height: 900 });
          }
          await page.keyboard.press("Escape");
          await page.waitForURL((url) => url.pathname === routePath && !url.search);
          check("Escape returns bare list", !(await dialog.isVisible()));
        }
        check(
          "no unintended API or external traffic or browser errors",
          { unexpected, errors },
          { unexpected: [], errors: [] },
        );
        observations.push({
          width,
          requests,
          scope:
            "GET/PATCH/POST synthetic fixtures; actual parent/detail/reason logic, not real persistence, permissions, App/KeepAlive or late write ownership",
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
          "P42 actual Vue scripts with review-only grouping, C styles, missing-count and missing-target presentation. Not production correction, full App/KeepAlive, real API/RBAC/DB or late-write ownership acceptance.",
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
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P42组织详情审核</title><style>body{max-width:1440px;margin:24px auto;padding:20px;background:#edf1f6;color:#202c3d;font-family:'Microsoft YaHei',sans-serif}img{max-width:100%;border:1px solid #dbe1e9}section{margin:36px 0}</style><h1>P42 组织详情 · 待审核</h1><p>真实Vue逻辑，审核模板与样式；请求全部为拦截测试数据。未修改真实组织，未部署；不代表完整应用、写入归属或生产验收。</p>${sections}`,
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
