import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { backupPagePlugin, backupPageSources } from "./lib/backup-page-preview.mjs";
import { backupReviewFixtures, backupFixtureFile } from "./lib/backup-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length
  ? path.resolve(`output/playwright/p64-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output);
const { fixture, nav } = await backupReviewFixtures(),
  probe = reservePort();
const envelope = (data) => ({
  data,
  request_id: "p64-local-fixture",
  trace_id: "p64-local-fixture",
});
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [backupPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
    ...backupPageSources,
    backupFixtureFile,
    "scripts/lib/backup-review-fixtures.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-backup-page-preview.mjs",
    "apps/web/vite.config.ts",
  ]),
  images = [],
  results = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P64 actual Vue review ${origin}`);
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: "reduce",
      }),
      page = await context.newPage(),
      requests = [],
      unexpected = [],
      errors = [];
    let current = structuredClone(fixture),
      failure = false,
      checks = 0;
    const check = (a, b, label) => {
      assert.deepEqual(a, b, `${width}: ${label}`);
      checks++;
    };
    const capture = async (name, locator) => {
      if (!output) return;
      await page.evaluate(() => document.fonts.ready);
      const b = locator
        ? await locator.screenshot({ animations: "disabled" })
        : await page.screenshot({ fullPage: true, animations: "disabled" });
      const file = `${width}-${name}.png`;
      await writeFile(path.join(output, file), b);
      images.push({
        file,
        sha256: hash(b),
        pixelWidth: b.readUInt32BE(16),
        pixelHeight: b.readUInt32BE(20),
      });
    };
    try {
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("download", () => unexpected.push("download"));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          key = req.method() + " " + url.pathname;
        if (url.origin !== origin) {
          unexpected.push("external");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: envelope(nav) });
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: envelope({ authenticated: true }) });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
        if (key !== "GET /api/v1/platform/operations/backup-recovery" || url.search) {
          unexpected.push(key + url.search);
          return route.abort();
        }
        requests.push({ method: req.method(), body: req.postData() });
        if (failure)
          return route.fulfill({
            status: 503,
            json: {
              error: {
                code: "local_backup_unavailable",
                message: "本地读取失败",
                action_hint: "本地测试暂未读取到更新。",
              },
              request_id: "p64-local-read-failure",
            },
          });
        return route.fulfill({ json: envelope(current) });
      });
      await page.goto(origin + "/platform-admin/operations");
      const surface = page.locator(".backup-center--review"),
        objectives = surface.locator("#p64-objectives"),
        evidence = surface.locator("#p64-evidence"),
        assets = surface.locator("#p64-assets"),
        refresh = surface.getByRole("button", { name: "刷新事实", exact: true });
      await surface.getByText("恢复链路受阻", { exact: true }).waitFor();
      check(await surface.getByRole("heading", { level: 1 }).count(), 1, "one page h1");
      check(
        await surface
          .getByRole("heading", { level: 1 })
          .evaluate((el) => getComputedStyle(el).fontFamily.includes("Microsoft YaHei")),
        true,
        "C heading font wins over legacy theme",
      );
      check(
        await page
          .locator('.platform-secondary-nav a[aria-current="page"]')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
        "rgb(237, 243, 255)",
        "C secondary navigation active surface",
      );
      check(await objectives.getByText("5 min", { exact: true }).count(), 1, "original actual RPO");
      check(
        await objectives.getByText("未记录", { exact: true }).count(),
        1,
        "missing actual RTO is not zero",
      );
      check(
        await evidence.getByText("尚无演练证据", { exact: true }).count(),
        1,
        "original missing drill",
      );
      check(
        await evidence.getByText("90 天有效期", { exact: true }).count(),
        1,
        "policy not hardcoded",
      );
      check(
        await assets.getByText("高强度加密", { exact: true }).count(),
        0,
        "no unconditional encryption claim",
      );
      check(
        await surface.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        true,
        "surface no horizontal overflow",
      );
      await capture("default", null);
      await capture("directory", surface.locator(".p64-directory"));
      await capture("objectives", objectives);
      await capture("evidence", evidence);
      await capture("assets", assets);
      const navLinks = surface
        .getByRole("navigation", { name: "备份恢复页内导航" })
        .getByRole("link");
      check(await navLinks.count(), 3, "three real section links");
      for (let i = 0; i < 3; i++) {
        await navLinks.nth(i).focus();
        await page.keyboard.press("Enter");
        check(
          new URL(page.url()).hash,
          ["#p64-objectives", "#p64-evidence", "#p64-assets"][i],
          "section anchor target",
        );
      }
      check(requests.length, 1, "navigation makes no API read");
      const detail = page.getByRole("dialog", { name: "数据库完整备份", exact: true });
      const inspectDetail = async (index, kind, title) => {
        const trigger = assets.locator(".responsive-data-view__mobile article button").nth(index);
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: title, exact: true });
        await dialog.waitFor();
        check(
          await dialog.evaluate((el) => getComputedStyle(el).borderTopWidth),
          "1px",
          "no legacy orange drawer stripe",
        );
        check(
          await dialog
            .getByRole("button", { name: "关闭详情", exact: true })
            .evaluate((el) => getComputedStyle(el).backgroundColor),
          "rgb(255, 255, 255)",
          "C white close button",
        );
        check(
          await dialog.locator(".responsive-data-view__details > dl dt").count(),
          6,
          "six original detail fields",
        );
        await dialog.getByText("技术详情", { exact: true }).click();
        check(await dialog.getByText(kind, { exact: true }).count(), 1, "original object code");
        check(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          true,
          "detail no overflow",
        );
        await capture("detail-" + kind, dialog);
        const roleCode = dialog.getByText(/^(primary_backup|recovery_copy)$/);
        await roleCode.scrollIntoViewIfNeeded();
        check(await roleCode.isVisible(), true, "complete storage role code reachable below fold");
        await capture("detail-" + kind + "-technical-bottom", dialog);
        const close = dialog.getByRole("button", { name: "关闭详情", exact: true }),
          technical = dialog.getByText("技术详情", { exact: true });
        await close.focus();
        await page.keyboard.press("Shift+Tab");
        check(
          await technical.evaluate((el) => document.activeElement === el),
          true,
          "detail backward Tab wraps",
        );
        await page.keyboard.press("Tab");
        check(
          await close.evaluate((el) => document.activeElement === el),
          true,
          "detail forward Tab wraps",
        );
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        check(
          await trigger.evaluate((el) => document.activeElement === el),
          true,
          "detail returns focus",
        );
      };
      if (width === 390) {
        await inspectDetail(0, "mysql_full", "数据库完整备份");
        check(await detail.isVisible(), false, "initial detail closed");
      } else {
        check(await assets.locator("table thead th").count(), 7, "all seven columns");
        check(await assets.locator("table tbody tr").count(), 1, "original one asset row");
        await assets.locator("tbody details summary").click();
        check(
          await assets.getByText("mysql_full", { exact: true }).isVisible(),
          true,
          "desktop code expanded",
        );
        await capture("asset-technical", assets);
      }
      await surface.locator(".blockers summary").click();
      check(
        await surface.getByText("recovery_copy_unverified", { exact: true }).isVisible(),
        true,
        "original blocker code",
      );
      await capture("blockers", surface.locator(".blockers"));
      const kinds = ["mysql_full", "mysql_binlog", "evidence", "export", "config"],
        titles = ["数据库完整备份", "数据库增量日志", "采集证据", "导出文件", "非秘密配置"];
      current = {
        ...structuredClone(fixture),
        policy: { ...fixture.policy, maximum_drill_age_days: 120 },
        targets: kinds.map((asset_kind, i) => ({
          ...fixture.targets[0],
          asset_kind,
          storage_role: i % 2 ? "recovery_copy" : "primary_backup",
          bundle_count: i + 1,
          encrypted: i !== 1,
          integrity_verified: i !== 1,
        })),
      };
      await refresh.click();
      await evidence.getByText("120 天有效期", { exact: true }).waitFor();
      check(
        await evidence.getByText("90 天有效期", { exact: true }).count(),
        0,
        "prior policy label removed",
      );
      if (width === 390) {
        check(
          await assets.locator(".responsive-data-view__mobile article").count(),
          5,
          "five synthetic asset cards",
        );
        for (let i = 1; i < kinds.length; i++) await inspectDetail(i, kinds[i], titles[i]);
      } else check(await assets.locator("tbody tr").count(), 5, "five synthetic asset rows");
      await capture("five-assets", assets);
      await capture("policy-120", evidence);
      check(requests.length, 2, "detail and technical actions are local only");
      current = {
        ...structuredClone(fixture),
        state: "empty",
        targets: [],
        blockers: [],
        latest_backup: null,
      };
      await refresh.click();
      await surface.getByText("尚无备份记录", { exact: true }).waitFor();
      check(
        await assets.getByText("没有可展示的备份资产。", { exact: true }).count(),
        1,
        "asset empty kept",
      );
      check(
        await objectives.getByText("未记录", { exact: true }).count(),
        2,
        "missing actual metrics not fabricated",
      );
      await capture("empty", surface.locator(".p64-content"));
      failure = true;
      await refresh.click();
      await surface.getByText("刷新未完成", { exact: true }).waitFor();
      check(
        await surface.getByText("尚无备份记录", { exact: true }).count(),
        1,
        "failed refresh retains prior empty snapshot",
      );
      await capture("refresh-failed", surface.locator(".refresh-notice"));
      check(requests.length, 6, "three successful reads plus original three-attempt 503 retry");
      check(unexpected, [], "no writes, exports or external requests");
      check(errors, [], "no browser errors");
      results.push({ width, checks, requests });
      console.log(JSON.stringify({ width, checks }));
    } finally {
      await context.close();
    }
  }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css|json)$/.test(file)
    )
      sources.add(file);
  }
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
      ),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P64",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue C review; original partial E2E and five explicitly synthetic assets; no backup or restore execution",
          sources: sourceHashes,
          images,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      path.join(output, "index.html"),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P64实际Vue审核</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#182739}img{max-width:100%;border:1px solid #c7d3e4;display:block}article{margin:28px 0}</style><h1>P64 实际Vue待审</h1><p>本地样例，只读展示；未执行备份/恢复，不代表真实演练或生产验收。</p>' +
        images
          .map(
            (i) =>
              `<article><h2>${i.file}</h2><img src="${i.file}" alt="${i.file} 待审"></article>`,
          )
          .join("\n") +
        "</html>",
    );
  }
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((sum, r) => sum + r.checks, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
