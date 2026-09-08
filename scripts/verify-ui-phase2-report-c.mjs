import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildReportDesignData } from "./lib/ui-phase2-report-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/report-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildReportDesignData(repo),
  sources = [
    ...["index.html", "report.css", "report.js", "data.js"].map((f) => `${relative}/${f}`),
    "apps/web/src/components/ReportCenter.vue",
    "apps/web/src/use-modal-dialog.ts",
    "apps/api/src/report-service.ts",
    "apps/api/src/report-routes.ts",
    "apps/api/src/mysql-report-repository.ts",
    "tests/e2e/m05-06-reports.spec.ts",
    "scripts/lib/ui-phase2-report-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-report-c.mjs",
  ],
  sourceHashes = Object.fromEntries(
    await Promise.all(
      sources.map(async (f) => [
        f,
        hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
      ]),
    ),
  );
const box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.REPORT_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots) {
    assert.match(s.file, /^[a-z0-9_-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
  }
}
const screenshots = [],
  expected = [],
  checks = [],
  browser = await chromium.launch({ headless: true });
async function metrics(page) {
  await checkPrototypeMetrics(page);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "page overflow",
  );
  assert.equal(
    await page
      .locator("dialog[open]")
      .evaluateAll((nodes) => nodes.some((n) => n.scrollWidth > n.clientWidth + 1)),
    false,
    "dialog overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual(
    await page.locator("a,summary").evaluateAll((nodes) =>
      nodes
        .filter((n) => n.getClientRects().length)
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.width < 43.9 || r.height < 43.9;
        })
        .map((n) => n.textContent),
    ),
    [],
  );
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      timezoneId: "Asia/Shanghai",
      locale: "zh-CN",
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
      const start = async (query = "") => {
          const url = pathToFileURL(path.join(root, "index.html"));
          url.search = query;
          await page.goto(url.href);
          await page.waitForFunction(() => window.REPORT_C?.state());
        },
        scene = (name) => page.evaluate((v) => window.REPORT_C.scene(v), name),
        state = () => page.evaluate(() => window.REPORT_C.state());
      await start();
      const names = await page.evaluate(() => Object.keys(window.REPORT_C.scenes));
      assert.equal(names.length, 41);
      async function shot(name, section = "initial") {
        const file = `${width}-${name}${section === "initial" ? "" : `-${section}`}.png`;
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: !(await page.locator("dialog[open]").count()),
            animations: "disabled",
          });
          screenshots.push({ file, width, scene: name, section, sha256: hash(bytes) });
        }
      }
      for (const name of names) {
        await scene(name);
        await metrics(page);
        await shot(name);
      }
      for (const name of [
        "detail_queued",
        "detail_status_mismatch",
        "technical",
        "regenerate_error",
      ]) {
        await scene(name);
        await page.locator("dialog[open]").evaluate((n) => {
          n.scrollTop = n.scrollHeight;
        });
        await metrics(page);
        await shot(name, "bottom");
      }
      await scene("opportunity");
      assert.equal(await page.locator(".export-row").count(), 4);
      for (const name of ["删除", "取消导出", "PDF", "Excel"])
        assert.equal(await page.getByRole("button", { name, exact: true }).count(), 0);
      await page.locator("[data-detail]").first().click();
      assert.equal(
        await page.locator("#detail-close").evaluate((n) => n === document.activeElement),
        true,
      );
      assert.equal(await page.locator("dialog [data-download]").count(), 0);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(
        await page
          .locator("[data-detail]")
          .first()
          .evaluate((n) => n === document.activeElement),
        true,
      );
      await page.goBack();
      await page.waitForFunction(() => document.querySelector("dialog").open);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "趋势分析", exact: true }).click();
      assert.match((await state()).path, /report=trend/);
      await page.locator("[data-create]").click();
      assert.deepEqual((await state()).intents.at(-1), {
        url: "/report-exports",
        method: "POST",
        body: { report_type: "trend", format: "csv" },
      });
      assert.equal((await state()).exports.length, 4, "intent must not fake creation");
      await scene("empty");
      assert.equal(await page.locator("[data-create]").isEnabled(), true);
      assert.match(await page.locator(".fact-grid").innerText(), /数据不足/);
      await page.locator("[data-create]").click();
      assert.equal((await state()).intents.at(-1).body.report_type, "trend");
      await scene("no_series");
      assert.match(await page.locator(".conclusion").innerText(), /28/);
      await scene("team");
      assert.match(await page.locator(".scope").innerText(), /组织活跃成员/);
      assert.equal(await page.locator(".bar-row").count(), 3);
      await scene("zero_series");
      assert.equal(
        await page
          .locator(".track span")
          .first()
          .evaluate((n) => n.getBoundingClientRect().width),
        0,
      );
      await scene("detail_no_sample");
      assert.match(await page.locator(".estimate").innerText(), /尚无成功导出样本/);
      assert.doesNotMatch(await page.locator(".estimate").innerText(), /分钟/);
      await scene("detail_zero");
      assert.match(await page.locator(".detail-grid").innerText(), /数据行数\n0/);
      await scene("detail_boundary");
      assert.equal(await page.locator("dialog [data-regenerate]").count(), 1);
      await scene("detail_status_mismatch");
      await page.locator("#detail-close").focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page
          .locator("dialog [data-regenerate]")
          .evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#detail-close").evaluate((n) => n === document.activeElement),
        true,
      );
      assert.match(await page.locator(".modal-notice").innerText(), /API 会拒绝/);
      await scene("detail_expired");
      await page.locator("dialog [data-regenerate]").click();
      assert.deepEqual((await state()).intents.at(-1), {
        url: `/report-exports/${data.exports[2].id}/regenerate`,
        method: "POST",
      });
      assert.equal((await state()).selected.id, data.exports[2].id);
      await scene("detail_expired");
      await page.evaluate(() => window.REPORT_C.setMode("failure"));
      await page.locator("dialog [data-regenerate]").click();
      assert.match(await page.locator(".modal-notice").innerText(), /未创建新记录/);
      assert.equal(await page.locator("dialog [data-regenerate]").isEnabled(), true);
      await scene("detail_expired");
      await page.evaluate(() => window.REPORT_C.setMode("hold"));
      await page.locator("dialog [data-regenerate]").click();
      assert.equal(await page.locator("dialog [data-regenerate]").isDisabled(), true);
      await page.keyboard.press("Escape");
      assert.equal((await state()).busy, "regenerate", "closing does not cancel the held intent");
      await scene("regenerated");
      assert.equal((await state()).selected.id, data.replacement.id);
      assert.equal(
        (await state()).exports.some((v) => v.id === data.exports[2].id),
        true,
      );
      await scene("opportunity");
      await page.evaluate(() => window.REPORT_C.setMode("failure"));
      await page.locator("[data-download]").click();
      await page.locator("[data-download]").click();
      assert.equal((await state()).intents.filter((v) => v.url.endsWith("/download")).length, 2);
      await page.evaluate(() => window.REPORT_C.setMode("hold"));
      await page.locator("[data-download]").click();
      assert.equal(await page.locator("[data-download]").isDisabled(), true);
      await scene("refresh_error");
      const before = (await state()).report;
      await page.locator("[data-refresh]").click();
      assert.deepEqual((await state()).report, before);
      await page.locator("[data-tasks]").click();
      assert.equal((await state()).intents.at(-1).url, "/tasks?view=exports");
      await start("report=team&export=missing&context=review");
      assert.doesNotMatch((await state()).path, /export=/);
      assert.match((await state()).path, /context=review/);
      assert.equal((await state()).type, "team");
      await start(`report=trend&export=${data.exports[0].id}&context=review`);
      assert.equal(await page.locator("dialog[open]").count(), 1);
      await page.reload();
      await page.waitForFunction(() => window.REPORT_C?.state());
      assert.equal(await page.locator("dialog[open]").count(), 1);
      await page.keyboard.press("Escape");
      assert.match((await state()).path, /report=trend/);
      assert.match((await state()).path, /context=review/);
      await start("report=invalid");
      assert.equal((await state()).type, "opportunity");
      if (width === 1440)
        for (const intermediate of [768, 1024]) {
          await page.setViewportSize({ width: intermediate, height: 1000 });
          for (const name of ["team", "long_email", "detail_queued", "regenerate_error"]) {
            await scene(name);
            await metrics(page);
          }
        }
      assert.deepEqual(http, []);
      assert.deepEqual(errors, []);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push({
        width,
        scenes: names.length,
        interactionContracts: "passed",
        httpRequests: http.length,
        browserErrors: errors.length,
        storageEntries: 0,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        boundary:
          "Independent C proposal; source adapters and synthetic browser cases, not mounted Vue, actual API, database, Worker, file download or production verification.",
        sourceHashes,
        sourceChecks: data.sourceChecks,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
else
  assert.deepEqual(
    previous.screenshots.map((v) => v.file),
    expected,
  );
assert.deepEqual(
  (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
  [...expected].sort(),
);
console.log(
  JSON.stringify(
    {
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      sourceChecks: data.sourceChecks,
      checks,
      temporaryProcesses: "browser and contexts closed",
    },
    null,
    2,
  ),
);
