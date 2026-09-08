import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildOrgDataDesignData } from "./lib/ui-phase2-org-data-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/org-data-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildOrgDataDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.ORG_DATA_C_DATA)), data);
const sources = [
  ...["index.html", "org-data.css", "org-data.js", "data.js"].map((f) => relative + "/" + f),
  "scripts/lib/ui-phase2-org-data-design-data.mjs",
  "scripts/verify-ui-phase2-org-data-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "apps/web/src/components/OrganizationDataPanel.vue",
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "apps/api/src/organization-admin-routes.ts",
  "apps/api/src/organization-admin-service.ts",
  "apps/api/src/mysql-organization-admin-repository.ts",
  "tests/e2e/m06-01-organization-admin.spec.ts",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [
      f,
      hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  checks = [];
async function metrics(page) {
  await checkPrototypeMetrics(page);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "Page overflow",
  );
  assert.equal(await page.locator("dialog,[role=dialog]").count(), 0);
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    await page
      .locator("input,select")
      .evaluateAll((ns) => ns.every((n) => document.querySelector('label[for="' + n.id + '"]'))),
    true,
  );
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        http = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      page.on("request", (r) => {
        if (/^https?:/.test(r.url())) http.push(r.url());
      });
      await page.route(/^https?:/, (r) => r.abort());
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => window.ORG_DATA_C?.state());
      const scene = (n) => page.evaluate((v) => window.ORG_DATA_C.scene(v), n),
        state = () => page.evaluate(() => window.ORG_DATA_C.state());
      const names = await page.evaluate(() => Object.keys(window.ORG_DATA_C.scenes));
      assert.equal(names.length, 47);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        if (["hover", "pressed"].includes(name)) {
          await page.locator("#refresh").hover();
          if (name === "pressed") await page.mouse.down();
        }
        if (name === "focus") {
          if (width === 390) await page.locator("#filters-toggle").click();
          await page.locator("#workspace-query").focus();
        }
        if (name === "export_zero_null") {
          assert.equal(await page.locator(".export-row").count(), 2);
          assert.match(await page.locator(".history").innerText(), /0 行/);
          assert.match(await page.locator(".history").innerText(), /尚未生成/);
        }
        if (name === "workspace_missing")
          assert.match(await page.locator(".table").innerText(), /数据不全/);
        const file = width + "-" + name + ".png";
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({ file, width, scene: name, sha256: hash(bytes) });
        }
        if (name === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
      }
      await scene("normal");
      assert.equal(await page.locator("[data-workspace]").count(), 8);
      assert.equal(await page.getByRole("columnheader").count(), 6);
      assert.equal(await page.getByRole("rowheader").count(), 8);
      assert.match(await page.locator(".summary").innerText(), /390/);
      assert.match(await page.locator(".summary").innerText(), /54/);
      assert.match(await page.locator(".summary").innerText(), /23/);
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      assert.equal(await page.locator("[data-workspace]").count(), 4);
      assert.equal(
        await page.locator("#list-title").evaluate((n) => n === document.activeElement),
        true,
      );
      assert.match(page.url(), /org_data_workspace_page=2/);
      if (width === 390) await page.locator("#filters-toggle").click();
      await page.locator("#workspace-query").fill("历史归档");
      assert.equal(await page.locator("[data-workspace]").count(), 1);
      assert.equal((await state()).workspace.page, 1);
      await page.locator("#workspace-status").selectOption("active");
      assert.equal(await page.locator("[data-workspace]").count(), 0);
      await page.locator("#clear-filter").click();
      assert.equal(
        await page.locator("#workspace-query").evaluate((n) => n === document.activeElement),
        true,
      );
      for (const [sort, ids] of Object.entries(data.oracle.workspace)) {
        await page.locator("#workspace-sort").selectOption(sort);
        assert.deepEqual(
          await page.evaluate(() => window.ORG_DATA_C.filtered("workspace").map((r) => r.id)),
          ids,
        );
      }
      await page.locator("[data-view=exports]").click();
      assert.equal(await page.locator("[data-export]").count(), 10);
      for (const [sort, ids] of Object.entries(data.oracle.export)) {
        await page.locator("#export-sort").selectOption(sort);
        assert.deepEqual(
          await page.evaluate(() => window.ORG_DATA_C.filtered("export").map((r) => r.id)),
          ids,
        );
      }
      await page.locator("#reset").click();
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      assert.equal(await page.locator("[data-export]").count(), 10);
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      assert.equal(await page.locator("[data-export]").count(), 3);
      await page.locator("#export-query").fill("等待重试");
      assert.equal(await page.locator("[data-export]").count(), 4);
      assert.equal((await state()).export.page, 1);
      await page.locator("#reset").click();
      await page.locator("#export-workspace").selectOption("新品决策工作区");
      assert.equal((await page.evaluate(() => window.ORG_DATA_C.filtered("export"))).length, 12);
      await page.locator("#export-type").selectOption("team");
      assert.equal(await page.locator("[data-export]").count(), 4);
      await page.locator("#export-status").selectOption("succeeded");
      assert.equal(await page.locator("[data-export]").count(), 0);
      await page.locator("#clear-filter").click();
      for (const [s, n] of [
        ["queued", 4],
        ["leased", 4],
        ["retry_scheduled", 4],
        ["succeeded", 4],
        ["dead_letter", 4],
        ["expired", 3],
      ]) {
        await page.locator("#export-status").selectOption(s);
        assert.equal(await page.locator("[data-export]").count(), n);
      }
      await page.reload();
      assert.equal((await state()).view, "exports");
      assert.equal((await state()).export.status, "expired");
      assert.equal((await state()).workspace.sort, "exports_desc");
      if (width === 390) await page.locator("#filters-toggle").click();
      await page.locator("#reset").click();
      assert.equal(new URL(page.url()).searchParams.has("org_data_export_status"), false);
      await scene("exports");
      assert.equal(
        await page.getByText("导出记录 ID：" + data.exports[0].id, { exact: true }).isVisible(),
        false,
      );
      await page.locator(".technical summary").first().focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page.getByText("导出记录 ID：" + data.exports[0].id, { exact: true }).isVisible(),
        true,
      );
      assert.equal(await page.locator("a[download],a[href*=download]").count(), 0);
      const observed = (await state()).data.observed_at;
      await page.locator("#refresh").click();
      assert.deepEqual((await state()).intents, [
        { method: "GET", path: "/org/admin/summary" },
        { method: "GET", path: "/org/admin/data" },
      ]);
      assert.equal((await state()).data.observed_at, observed);
      await page.locator("#reports").click();
      assert.deepEqual((await state()).intents.at(-1), { navigation: "/reports" });
      for (const name of ["新建导出", "下载", "删除", "清洗", "修复", "质量评分"])
        assert.equal(await page.getByRole("button", { name, exact: true }).count(), 0);
      assert.deepEqual(http, []);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.equal((await context.cookies()).length, 0);
      checks.push({
        width,
        scenes: names.length,
        dialogVariants: 0,
        interactions: "passed",
        sortsComparedWithSource: 11,
        httpRequests: 0,
        browserErrors: 0,
        storageEntries: 0,
      });
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of [
        "normal",
        "exports",
        "long_workspace",
        "long_export",
        "export_zero_null",
      ]) {
        await page.evaluate((n) => window.ORG_DATA_C.scene(n), name);
        await metrics(page);
      }
    }
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual((await readdir(root)).filter((f) => f.endsWith(".png")).sort(), expected.sort());
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        proposal: "ORG-DATA-C-r1",
        sourceHashes,
        screenshots,
        checks,
        sourceChecks: data.sourceChecks,
        scope:
          "Standalone read-only prototype. No mounted Vue, SQL execution, API, permissions, production or approval proof. All browser contexts closed.",
      },
      null,
      2,
    ) + "\n",
  );
else assert.deepEqual(previous.screenshots.map((s) => s.file).sort(), expected);
console.log(
  JSON.stringify(
    {
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      sourceChecks: data.sourceChecks,
      temporaryProcesses: "All browser contexts closed",
    },
    null,
    2,
  ),
);
