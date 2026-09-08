import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildPlatformOverviewDesignData } from "./lib/ui-phase2-platform-overview-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/platform-overview-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildPlatformOverviewDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.PLATFORM_OVERVIEW_C_DATA)), data);
const sources = [
  ...["index.html", "overview.css", "overview.js", "data.js"].map((f) => relative + "/" + f),
  "scripts/lib/ui-phase2-platform-overview-design-data.mjs",
  "scripts/verify-ui-phase2-platform-overview-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...[
    "PlatformDashboard.vue",
    "ResponsiveDataView.vue",
    "TableViewControls.vue",
    "TechnicalDetails.vue",
  ].map((f) => "apps/web/src/components/" + f),
  ...[
    "platform-dashboard-service.ts",
    "platform-dashboard-routes.ts",
    "mysql-platform-dashboard-repository.ts",
    "mysql-platform-dashboard-scale-metrics.ts",
    "mysql-platform-dashboard-collection-metrics.ts",
    "mysql-platform-dashboard-risk-metrics.ts",
    "mysql-platform-dashboard-storage-metrics.ts",
  ].map((f) => "apps/api/src/" + f),
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
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
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    await page
      .locator("input,select")
      .evaluateAll((ns) => ns.every((n) => document.querySelector('label[for="' + n.id + '"]'))),
    true,
  );
}
async function shot(page, width, name, selector) {
  const file = width + "-" + name + ".png";
  expected.push(file);
  if (capture) {
    const bytes = selector
      ? await page
          .locator(selector)
          .screenshot({ path: path.join(root, file), animations: "disabled" })
      : await page.screenshot({
          path: path.join(root, file),
          fullPage: true,
          animations: "disabled",
        });
    screenshots.push({ file, width, scene: name, sha256: hash(bytes) });
  }
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
      const scene = (name) => page.evaluate((n) => window.PLATFORM_OVERVIEW_C.scene(n), name),
        state = () => page.evaluate(() => window.PLATFORM_OVERVIEW_C.state());
      const names = await page.evaluate(() => Object.keys(window.PLATFORM_OVERVIEW_C.scenes));
      assert.equal(names.length, 43);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        if (
          [
            "loading",
            "blocked",
            "timeout",
            "offline",
            "forbidden",
            "expired",
            "rate_limited",
            "empty",
            "only_trend",
          ].includes(name)
        )
          assert.equal(await page.locator("#attention,#providers,#scale").count(), 0);
        if (["hover", "pressed"].includes(name)) {
          await page.locator("#refresh").hover();
          if (name === "pressed") await page.mouse.down();
        }
        if (name === "focus") await page.locator("#refresh").focus();
        await shot(page, width, name);
        if (name === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
      }
      await scene("normal");
      await shot(page, width, "attention-detail", "#attention");
      assert.equal(await page.locator('a[data-route="/platform-admin/organizations"]').count(), 0);
      await scene("superadmin");
      assert.ok((await page.locator('a[data-route="/platform-admin/organizations"]').count()) > 0);
      assert.ok((await page.locator('a[data-route="/platform-admin/users"]').count()) > 0);
      for (const target of [
        "/platform-admin/organizations",
        "/platform-admin/users",
        "/platform-admin/providers/sources",
        "/platform-admin/collection",
        "/platform-admin/collection/overview?root_cause=1",
        "/platform-admin/collection/overview",
        "/platform-admin/data",
      ]) {
        await page
          .locator('a[data-route="' + target + '"]')
          .first()
          .click();
        assert.equal((await state()).nav.at(-1), target);
      }
      await scene("expired");
      await page.locator('a[data-route="/login"]').click();
      assert.equal((await state()).nav.at(-1), "/login");
      await scene("many_providers");
      assert.equal((await page.evaluate(() => window.PLATFORM_OVERVIEW_C.visible())).length, 8);
      assert.equal(
        (await page.evaluate(() => window.PLATFORM_OVERVIEW_C.visible()))[0].id,
        "provider-15",
      );
      await page.locator("#expand").click();
      assert.equal((await page.evaluate(() => window.PLATFORM_OVERVIEW_C.visible())).length, 15);
      await page.locator("#expand").click();
      assert.equal((await state()).expanded, false);
      assert.equal((await state()).intents.length, 0);
      await scene("trend");
      for (const key of ["succeeded", "failed"])
        assert.equal(
          await page.locator('[data-trend="' + key + '"]').getAttribute("points"),
          data.points[key],
        );
      await page.locator("#trend-text summary").click();
      assert.match(await page.locator("#trend-text").innerText(), /成功 21 \/ 失败 0/);
      await scene("null_rate");
      assert.equal(await page.locator("#success-rate").innerText(), "暂无样本");
      await scene("zero_rate");
      assert.equal(await page.locator("#success-rate").innerText(), "0.0%");
      for (const code of ["15m", "24h", "7d", "30d"]) {
        await scene("normal");
        await page.evaluate(() => window.PLATFORM_OVERVIEW_C.setMode("hold"));
        await page.locator("#window").selectOption(code);
        assert.equal((await state()).intents[0].path, data.windows[code]);
        await page.evaluate(() => window.PLATFORM_OVERVIEW_C.read());
        assert.equal((await state()).intents.length, 1);
        assert.equal(await page.locator("#refresh").isDisabled(), true);
        assert.equal(await page.locator("#window").isDisabled(), true);
        await page.evaluate(() => window.PLATFORM_OVERVIEW_C.complete("success"));
        assert.equal((await state()).data.window, code);
      }
      await scene("normal");
      await page.evaluate(() => window.PLATFORM_OVERVIEW_C.setMode("hold"));
      await page.locator("#window").selectOption("7d");
      await page.evaluate(() => window.PLATFORM_OVERVIEW_C.complete("blocked"));
      assert.equal((await state()).window, "7d");
      assert.equal((await state()).data.window, "24h");
      assert.match(await page.locator(".notice").innerText(), /旧快照/);
      await page.locator("#retry").click();
      await page.evaluate(() => window.PLATFORM_OVERVIEW_C.complete("success"));
      assert.equal((await state()).data.window, "7d");
      assert.equal(await page.locator(".notice").count(), 0);
      for (const fail of ["timeout", "expired", "forbidden"]) {
        await scene("normal");
        await page.evaluate(() => window.PLATFORM_OVERVIEW_C.setMode("hold"));
        await page.locator("#refresh").click();
        await page.evaluate((r) => window.PLATFORM_OVERVIEW_C.complete(r), fail);
        assert.equal((await state()).state, "ready");
        assert.equal((await state()).data.window, "24h");
      }
      await scene("blocked");
      await page.locator("#retry").click();
      assert.equal((await state()).state, "ready");
      await scene("normal");
      await page.evaluate(() => window.PLATFORM_OVERVIEW_C.setMode("hold"));
      await page.locator("#refresh").click();
      const old = (await state()).pending.id;
      await page.evaluate(() => {
        window.PLATFORM_OVERVIEW_C.leave();
        window.PLATFORM_OVERVIEW_C.activate();
      });
      assert.equal(
        await page.evaluate((id) => window.PLATFORM_OVERVIEW_C.complete("success", id), old),
        false,
      );
      await scene("technical");
      await page.locator("#copy").click();
      assert.equal((await state()).copy, "copied");
      await page.waitForFunction(() => window.PLATFORM_OVERVIEW_C.state().copy === "");
      await scene("copy_failed");
      await page.locator("#copy").click();
      assert.equal((await state()).copy, "failed");
      await scene("technical");
      await page.evaluate(() => {
        window.PLATFORM_OVERVIEW_C_CLIPBOARD = () =>
          new Promise((r) => {
            window.resolveCopy = r;
          });
      });
      await page.locator("#copy").click();
      await page.locator("#refresh").click();
      await page.evaluate(async () => {
        window.resolveCopy();
        await Promise.resolve();
      });
      assert.equal((await state()).copy, "");
      if (width === 1440) {
        await scene("normal");
        await page.locator("#columns summary").click();
        for (const i of [0, 1, 2]) await page.locator("#col-" + i).uncheck();
        assert.equal(await page.locator("#col-3").isDisabled(), true);
        assert.equal(await page.locator("#provider-table th:not([hidden])").count(), 1);
        assert.equal(await page.locator("#provider-table th.frozen").innerText(), "最近观测");
        await page.locator("#freeze").click();
        assert.equal(await page.locator("#provider-table .frozen").count(), 0);
        await page.locator("#density").selectOption("compact");
        assert.equal((await state()).density, "compact");
        assert.equal((await state()).intents.length, 0);
      } else {
        for (const variant of ["normal", "unknown_provider", "long_fields"]) {
          await scene(variant);
          const button = page.locator("[data-preview]").first();
          await button.click();
          assert.equal(await page.locator("dialog").evaluate((n) => n.open), true);
          assert.equal(
            await page.locator("#preview-close").evaluate((n) => n === document.activeElement),
            true,
          );
          if (variant !== "normal") await page.locator("#provider-technical summary").click();
          await metrics(page);
          assert.equal(
            await page.locator("dialog").evaluate((n) => {
              const r = n.getBoundingClientRect();
              return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
            }),
            true,
          );
          await shot(page, width, "preview-" + variant, "dialog");
          for (let i = 0; i < 8; i++) {
            await page.keyboard.press("Tab");
            assert.equal(
              await page.evaluate(() => !!document.activeElement.closest("dialog")),
              true,
            );
          }
          await page.locator("#preview-close").focus();
          await page.keyboard.press("Shift+Tab");
          assert.equal(
            await page
              .locator("#provider-technical summary")
              .evaluate((n) => n === document.activeElement),
            true,
          );
          await page.keyboard.press("Tab");
          assert.equal(
            await page.locator("#preview-close").evaluate((n) => n === document.activeElement),
            true,
          );
          await page.keyboard.press("Escape");
          assert.equal(await page.locator("dialog").evaluate((n) => n.open), false);
          assert.equal(await button.evaluate((n) => n === document.activeElement), true);
          await button.click();
          await page.locator("#preview-close").click();
          assert.equal(await button.evaluate((n) => n === document.activeElement), true);
          await button.click();
          await page.mouse.click(1, 1);
          assert.equal(await page.locator("dialog").evaluate((n) => n.open), false);
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(http, []);
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push({
        width,
        scenes: names.length,
        interactions: "passed",
        mobilePreviewVariants: width === 390 ? 3 : 0,
        httpRequests: 0,
        browserErrors: 0,
        storageEntries: 0,
        clipboard: "synthetic in-memory adapter only",
      });
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    for (const width of [759, 760, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of ["normal", "long_fields", "columns", "refresh_failed"]) {
        await page.evaluate((v) => window.PLATFORM_OVERVIEW_C.scene(v), name);
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
        proposal: "PLATFORM-OVERVIEW-C-r1",
        sourceHashes,
        screenshots,
        checks,
        sourceChecks: data.sourceChecks,
        scope:
          "Standalone synthetic prototype; not mounted Vue, real API/MySQL, permissions, OS clipboard or production. All browser contexts closed.",
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
