import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { chromium } from "playwright";
import { createServer } from "vite";
import ts from "typescript";
import { buildWorkspacesDesignData } from "./lib/ui-phase2-workspaces-design-data.mjs";

const repo = process.cwd(),
  output = "output/playwright/p32-approved-restore-review";
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const fixtureFile = "tests/e2e/m06-01-organization-admin.spec.ts";
const fixture = await readFile(fixtureFile, "utf8");
const ast = ts.createSourceFile(fixtureFile, fixture, ts.ScriptTarget.Latest, true);
const declarations = ast.statements.filter(
  (n) => ts.isVariableStatement(n) || (ts.isFunctionDeclaration(n) && n.name?.text === "setup"),
);
const { setup, env } = new Function(
  ts.transpileModule(declarations.map((n) => n.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText + "\nreturn {setup,env};",
)();
const data = await buildWorkspacesDesignData(repo);
const sourceFiles = [
  fixtureFile,
  "scripts/verify-ui-phase2-workspaces-vue-restore.mjs",
  "scripts/lib/ui-phase2-workspaces-design-data.mjs",
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "apps/web/src/components/OrganizationWorkspacePanel.vue",
  "apps/web/src/components/AuditedReasonDialog.vue",
  "apps/web/src/use-audited-reason.ts",
  "apps/web/src/use-modal-dialog.ts",
  "apps/web/src/design/workspace-restore-tokens.css",
  "apps/web/src/design/roles-tokens.css",
  "apps/web/src/organization-admin.css",
  "apps/web/src/styles.css",
  "apps/web/src/design/tokens.css",
  "apps/web/src/signal-ledger.css",
  "apps/web/src/responsive-baselines.css",
  "apps/web/src/accessibility.css",
  "apps/web/src/main.ts",
  "apps/api/src/organization-admin-service.ts",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (f) => [f, hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
  ),
);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${shot.file}`)), shot.sha256);
}
if (capture) await mkdir(output, { recursive: true });
const portProbe = reservePort();
await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port, strictPort: true, open: false },
});
let browser;
const checks = [],
  screenshots = [];
try {
  await server.listen();
  const base = `http://127.0.0.1:${port}`;
  console.log(`workspaces_restore_vue_started ${base}`);
  browser = await chromium.launch({ headless: true });
  for (const width of smoke ? [390] : [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    let release;
    try {
      const page = await context.newPage(),
        errors = [],
        unexpected = [],
        writes = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date("2026-08-26T10:00:00.000Z"));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === base && !url.pathname.startsWith("/api/")) return route.continue();
        if (url.pathname === "/api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        unexpected.push(url.pathname);
        return route.abort();
      });
      await setup(page);
      await page.unroute("**/api/v1/org/admin/workspaces");
      const rows = structuredClone(data.workspaceRows);
      let outcome = "failure";
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      await page.route("**/api/v1/org/admin/workspaces**", async (route) => {
        if (route.request().method() === "GET") return route.fulfill({ json: env(rows) });
        writes.push({
          path: new URL(route.request().url()).pathname,
          method: route.request().method(),
          body: route.request().postDataJSON(),
        });
        if (outcome === "failure") {
          await gate;
          return route.fulfill({
            status: 409,
            json: {
              error: { code: "workspace_version_conflict", message: "隔离版本冲突" },
              request_id: "p32-restore-fixture",
            },
          });
        }
        const row = rows.find((r) => r.id === writes.at(-1).path.split("/").at(-2));
        row.status = "active";
        row.version += 1;
        return route.fulfill({ json: env(row) });
      });
      const check = (name, value, expected = true) => {
        assert.deepEqual(value, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const shot = async (scene, locator) => {
        check(
          `${scene}: no document overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (capture) {
          const file = `${width}-${scene}.png`,
            bytes = await locator.screenshot();
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({ file, width, scene, sha256: hash(bytes) });
        }
      };
      await page.goto(`${base}/org-admin/workspaces`);
      await page.locator(".org-workspace-panel").waitFor();
      await page.getByLabel("搜索工作区").fill(rows[9].name);
      await page.getByLabel(`选择工作区 ${rows[9].name}`, { exact: true }).click();
      const trigger = page.getByRole("button", { name: "恢复工作区", exact: true });
      const dialog = page.getByRole("dialog", { name: "恢复工作区原因", exact: true });
      await trigger.click();
      const reason = dialog.getByRole("textbox"),
        confirm = dialog.getByRole("button", { name: "确认提交" });
      check(
        "restore context is scoped",
        await dialog.evaluate((n) => n.classList.contains("workspace-restore-reason")),
      );
      check(
        "target name and version are displayed",
        await dialog
          .locator("#workspace-restore-target")
          .textContent()
          .then(
            (s) =>
              s.includes(rows[9].name) && s.includes("第 1 版") && s.includes("明确范围成员 1"),
          ),
      );
      check("initial reason unchanged", await reason.inputValue(), "恢复工作区");
      check("initial focus", await reason.evaluate((n) => n === document.activeElement));
      check("no new upper length rule", await reason.getAttribute("maxlength"), null);
      check("minimum stays two", await reason.getAttribute("minlength"), "2");
      check(
        "help text remains 16px",
        await dialog.locator("small").evaluate((n) => getComputedStyle(n).fontSize),
        "16px",
      );
      for (const theme of ["deep-ocean", "aurora-purple", "cloud-white"]) {
        await page.evaluate((theme) => {
          document.documentElement.dataset.theme = theme;
        }, theme);
        check(
          `${theme}: blue confirm`,
          await confirm.evaluate((n) => getComputedStyle(n).backgroundColor),
          "rgb(37, 74, 156)",
        );
        check(
          `${theme}: readable and usable`,
          await dialog.evaluate((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.top >= 0 &&
              r.bottom <= innerHeight + 1 &&
              [...n.querySelectorAll("button,textarea")].every(
                (e) =>
                  e.getBoundingClientRect().height >= 44 &&
                  parseFloat(getComputedStyle(e).fontSize) >= 16,
              )
            );
          }),
        );
        await shot(`restore-${theme}`, dialog);
      }
      await reason.fill("短");
      check("short remains disabled", await confirm.isDisabled());
      await confirm.evaluate((n) => n.click());
      check("short sends no request", writes.length, 0);
      await shot("restore-short", dialog);
      await reason.fill("长".repeat(501));
      check("501 chars not truncated", (await reason.inputValue()).length, 501);
      await reason.fill("  核对恢复  ");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      check("Tab reaches confirm", await confirm.evaluate((n) => n === document.activeElement));
      await page.keyboard.press("Tab");
      check(
        "Tab wraps",
        await dialog
          .getByRole("button", { name: "关闭原因填写" })
          .evaluate((n) => n === document.activeElement),
      );
      await page.keyboard.press("Shift+Tab");
      check("ShiftTab wraps", await confirm.evaluate((n) => n === document.activeElement));
      await shot("restore-keyboard", dialog);
      for (const close of ["escape", "cancel", "header"]) {
        if (close !== "escape") await trigger.click();
        if (close === "escape") await page.keyboard.press("Escape");
        else
          await dialog
            .getByRole("button", {
              name: close === "cancel" ? "取消" : "关闭原因填写",
              exact: true,
            })
            .click();
        await dialog.waitFor({ state: "hidden" });
        check(
          `${close}: focus restored`,
          await trigger.evaluate((n) => n === document.activeElement),
        );
        check(`${close}: no request`, writes.length, 0);
      }
      await trigger.click();
      await reason.fill("  核对恢复  ");
      await confirm.click();
      await page.waitForFunction(
        () => document.querySelector(".org-workspace-actions button")?.disabled,
      );
      check("confirmation closes before response", await dialog.isVisible(), false);
      check("exact first POST", writes, [
        {
          path: `/api/v1/org/admin/workspaces/${rows[9].id}/actions`,
          method: "POST",
          body: { action: "restore", expected_version: 1, reason: "核对恢复" },
        },
      ]);
      await trigger.evaluate((n) => n.click());
      check("busy prevents duplicate", writes.length, 1);
      await shot("restore-pending", page.locator(".org-admin-center"));
      release();
      release = null;
      await page.locator(".org-admin-notice").filter({ hasText: "数据已被其他操作更新" }).waitFor();
      check(
        "failed response retains archived facts",
        await page
          .locator(".org-workspace-detail")
          .textContent()
          .then((s) => s.includes("已归档")),
      );
      await shot("restore-failed", page.locator(".org-admin-center"));
      await trigger.click();
      check("reopening resets reason", await reason.inputValue(), "恢复工作区");
      outcome = "success";
      await reason.fill("确认恢复");
      await confirm.click();
      await page
        .locator(".org-admin-notice")
        .filter({ hasText: "工作区已恢复并写入审计" })
        .waitFor();
      check("success exact version unchanged", writes[1].body, {
        action: "restore",
        expected_version: 1,
        reason: "确认恢复",
      });
      await shot("restore-success", page.locator(".org-admin-center"));
      const archive = page.getByRole("button", { name: "归档工作区", exact: true });
      await archive.click();
      const archiveDialog = page.getByRole("dialog", { name: "归档工作区原因" });
      check(
        "archive does not inherit restore style",
        await archiveDialog.evaluate((n) => n.classList.contains("workspace-restore-reason")),
        false,
      );
      check(
        "archive has no restore target",
        await archiveDialog.locator("#workspace-restore-target").count(),
        0,
      );
      await shot("archive-unchanged", archiveDialog);
      await page.keyboard.press("Escape");
      await page.goto(`${base}/org-admin/members`);
      await page
        .locator(".org-admin-line")
        .filter({ hasText: "new@example.test" })
        .getByRole("button", { name: "撤销邀请", exact: true })
        .click();
      const memberDialog = page.getByRole("dialog", { name: "撤销邀请原因" });
      check(
        "P30 does not inherit restore style",
        await memberDialog.evaluate((n) => n.classList.contains("workspace-restore-reason")),
        false,
      );
      check(
        "P30 default reason unchanged",
        await memberDialog.getByRole("textbox").inputValue(),
        "撤销邀请",
      );
      await shot("members-unchanged", memberDialog);
      await page.keyboard.press("Escape");
      check("no page error", errors, []);
      check("no unexpected external request", unexpected, []);
    } finally {
      release?.();
      await context.close();
    }
  }
  if (capture) {
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          kind: "P32-approved-restore-Vue-r1",
          boundary:
            "Actual Vue; isolated API fixtures only,not production/audit acceptance. Approved mobile composition,desktop and remaining states pending review. Other shared callers retain existing behavior.",
          sourceHashes,
          checks,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
    const cards = screenshots
      .map(
        (s) =>
          `<figure><figcaption>${s.width} · ${s.scene}</figcaption><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene}"></a></figure>`,
      )
      .join("");
    await writeFile(
      `${output}/index.html`,
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P32 恢复原因窗 · 真实 Vue</title><style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;background:#edf1f6;color:#202c3d}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}figure{margin:0}img{max-width:100%;max-height:600px;object-fit:contain;object-position:top left}</style><h1>P32 恢复原因窗 · 真实 Vue</h1><p>已批准手机组合进入真实路由；其他状态与桌面待审核。请求由隔离夹具拦截，不代表生产写入或审计验收。归档/P30为相邻调用回归。</p><main>${cards}</main></html>`,
    );
  } else if (!smoke) assert.deepEqual(checks, previous.checks);
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : smoke ? "smoke" : "check",
      checks: checks.length,
      screenshots: screenshots.length,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
