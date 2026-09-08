import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildProviderAdaptersDesignData } from "./lib/ui-phase2-provider-adapters-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/provider-adapters-direction-c";
const root = path.join(repo, relative),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const { data, sourceLogic } = await buildProviderAdaptersDesignData(repo);
const box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.ADAPTER_C_DATA)), data);
assert.equal(
  (await readFile(path.join(root, "source-logic.js"), "utf8")).replaceAll("\r\n", "\n"),
  await format(sourceLogic, {
    ...(await resolveConfig(path.join(root, "source-logic.js"))),
    parser: "babel",
  }),
);
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-provider-adapters-design-data.mjs",
  "scripts/verify-ui-phase2-provider-adapters-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/platform-organizations-direction-c/organizations.css",
  ...["index.html", "adapters.css", "adapters.js", "data.js", "source-logic.js"].map(
    (f) => relative + "/" + f,
  ),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [
      f,
      hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
let prior;
if (!capture) {
  prior = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(prior.sourceHashes, sourceHashes);
  for (const s of prior.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  checks = [],
  errors = [],
  requests = [];
async function layout(page, label) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    label + " page overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length, label + " duplicate IDs");
  assert.equal(
    await page.locator("button:visible").evaluateAll((ns) => ns.every((n) => n.type === "button")),
    true,
  );
  await checkPrototypeMetrics(page);
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
      await context.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      const scene = (key) =>
        page.evaluate((key) => {
          window.ADAPTER_C.scene(key);
          window.scrollTo(0, 0);
        }, key);
      const state = () => page.evaluate(() => window.ADAPTER_C.state());
      const all = await page.evaluate(() => Object.keys(window.ADAPTER_C.scenes));
      for (const key of all) {
        await scene(key);
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        if (key === "focus")
          assert.equal(await page.evaluate(() => document.activeElement.id), "refresh");
        await layout(page, key);
        const test = data.cases.find((t) => t.key === key);
        if (test)
          assert.deepEqual((await state()).ids, test.ids, key + " exact source computed IDs");
        const shot = async (suffix = "") => {
          const file = `${width}-${key}${suffix}.png`;
          expected.push(file);
          if (capture) {
            const bytes = await page.screenshot({
              path: path.join(root, file),
              fullPage: !(await page.locator("dialog[open]").count()),
              animations: "disabled",
            });
            screenshots.push({
              file,
              width,
              scene: key,
              pageId: "P47",
              proposal: "PROVIDER-ADAPTERS-C-r1",
              sha256: hash(bytes),
            });
          }
        };
        await shot();
        if (await page.locator("dialog[open]").count()) {
          const dimensions = await page.locator("#detail").evaluate((n) => ({
            max: n.scrollHeight - n.clientHeight,
            step: Math.max(1, Math.floor(n.clientHeight * 0.8)),
          }));
          let part = 0;
          for (let offset = dimensions.step; offset < dimensions.max; offset += dimensions.step) {
            await page.locator("#detail").evaluate((n, y) => (n.scrollTop = y), offset);
            await shot(`-part-${++part}`);
          }
          if (dimensions.max > 0) {
            await page.locator("#detail").evaluate((n) => (n.scrollTop = n.scrollHeight));
            await shot("-bottom");
          }
        }
        if (key === "pressed") await page.mouse.up();
      }
      await scene("catalog");
      if (width === 390) await page.locator("#filter-toggle").click();
      const rows = width === 390 ? "[data-mobile-row]" : "[data-row]";
      assert.equal(await page.locator(rows).count(), 20);
      await page.locator("#next").click();
      await page.locator("#next").click();
      assert.equal(await page.locator(rows).count(), 5);
      await page.locator("#query").fill(" CATALOG_SOURCE_45 ");
      assert.equal((await state()).page, 1);
      assert.equal((await state()).ids.length, 1);
      assert.equal(await page.evaluate(() => document.activeElement.id), "query");
      await page.locator("#reset").click();
      for (const [id, value] of Object.entries({
        query: "no-match",
        mode: "manual",
        providerStatus: "enabled",
        registration: "registered",
        health: "ready",
        sort: "recent",
      })) {
        if (id === "query") await page.locator("#query").fill(value);
        else await page.locator("#" + id).selectOption(value);
      }
      await page.getByRole("button", { name: "清除筛选", exact: true }).click();
      assert.deepEqual((await state()).controls, data.cases[0].controls);
      assert.deepEqual((await state()).intents, []);
      assert.equal((await state()).ids.length, 45);
      assert.match(await page.locator(".scope").textContent(), /全目录 45/);
      checks.push(
        `${width}: ${all.length} scenes, 13 exact computed ID sequences, 20/20/5 pagination and real six-control reset with zero requests`,
      );
      await scene("default");
      const target = data.items[1].id,
        trigger = `#${width === 390 ? "mobile" : "table"}-detail-${target}`;
      await page.locator(trigger).click();
      assert.equal(await page.evaluate(() => document.activeElement.id), "close-detail");
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement.closest("dialog")?.id),
        "detail",
      );
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), "close-detail");
      await page.locator("#technical summary").click();
      assert.equal(await page.locator("#technical").getAttribute("open"), "");
      assert.match(await page.locator("#technical").textContent(), /adapter_not_registered/);
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.activeElement.id), trigger.slice(1));
      for (const outcome of ["ready", "blocked", "error", "unknown"]) {
        await scene("default");
        await page.locator(trigger).click();
        await page.locator(`#detail-probe-${target}`).click();
        assert.equal(await page.locator(`#detail-probe-${target}`).isDisabled(), true);
        assert.equal(
          await page.evaluate((id) => window.ADAPTER_C.probe(id), data.items[0].id),
          null,
        );
        assert.deepEqual(
          (await state()).intents.map(({ method, path }) => ({ method, path })),
          [{ method: "POST", path: `/api/v1/platform/provider-adapters/${target}/health-check` }],
        );
        assert.equal(await page.evaluate(() => window.ADAPTER_C.completeProbe("ready", -1)), false);
        await page.evaluate((outcome) => window.ADAPTER_C.completeProbe(outcome), outcome);
        assert.equal((await state()).selected, target);
        assert.equal((await state()).rows[1].runtime_circuit_state, "open");
        assert.equal((await state()).rows[1].runtime_sample_count_24h, 0);
        assert.equal(
          await page.locator("dialog [data-route='/platform-admin/crawler-scheduler']").count(),
          outcome === "ready" ? 1 : 0,
        );
        if (outcome === "ready") {
          await page.locator("dialog [data-route='/platform-admin/crawler-scheduler']").click();
          assert.equal((await state()).intents.at(-1).method, "NAVIGATE");
        }
        await page.locator("#close-detail").click();
        if (outcome === "unknown") {
          assert.equal(await page.evaluate((id) => window.ADAPTER_C.probe(id), target), null);
          await page.locator("#refresh").click();
          await page.evaluate(() => window.ADAPTER_C.completeRead("success"));
          assert.equal((await state()).unknown, false);
        }
      }
      await scene("health"); // Filter is ready; switch to blocked before inspecting the paused row.
      if (width === 390) await page.locator("#filter-toggle").click();
      await page.locator("#health").selectOption("blocked");
      await page.locator(trigger).click();
      await page.locator(`#detail-probe-${target}`).click();
      await page.evaluate(() => window.ADAPTER_C.completeProbe("ready"));
      assert.equal((await state()).selected, null);
      assert.equal(await page.evaluate(() => document.activeElement.id), "refresh");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.match((await state()).note, /不在当前筛选/);
      for (const from of ["default", "empty"]) {
        for (const outcome of [
          "success",
          "empty",
          "error",
          "timeout",
          "expired",
          "forbidden",
          "blocked",
        ]) {
          await scene(from);
          await page.locator("#refresh").click();
          assert.equal(await page.evaluate(() => window.ADAPTER_C.read()), null);
          assert.equal(
            await page.evaluate(() => window.ADAPTER_C.completeRead("success", -1)),
            false,
          );
          await page.evaluate((outcome) => window.ADAPTER_C.completeRead(outcome), outcome);
          assert.equal((await state()).readPending, null);
          if (from === "default" && !["success", "empty"].includes(outcome)) {
            assert.equal((await state()).rows.length, 2);
            assert.match((await state()).note, /上一次快照/);
          }
          await layout(page, from + outcome);
        }
      }
      await scene("default");
      await page.locator("#refresh").click();
      await page.evaluate((id) => window.ADAPTER_C.probe(id), target);
      await page.evaluate(() => window.ADAPTER_C.completeProbe("ready"));
      assert.equal(await page.evaluate(() => window.ADAPTER_C.completeRead("success")), false);
      assert.equal((await state()).rows[1].health_status, "ready");
      checks.push(
        `${width}: modal focus loop/Escape/return, technical expansion, four probe outcomes with exact bodyless intent and global busy; no circuit close; filtered-row disappearance; 14 read outcomes and proposed stale-read protection`,
      );
      if (width === 1440) {
        await scene("default");
        await page.locator("#column-tools summary").click();
        await page.locator('[data-column="0"]').uncheck();
        assert.equal(await page.locator("th.frozen").textContent(), "健康探针");
        await page.locator("#freeze").uncheck();
        assert.equal(await page.locator("th.frozen").count(), 0);
        await page.locator("#density").selectOption("compact");
        assert.equal(await page.locator("table").getAttribute("class"), "compact");
        await page.locator("#column-tools summary").click();
        for (const k of [1, 2, 3]) await page.locator(`[data-column="${k}"]`).uncheck();
        assert.equal(await page.locator('[data-column="4"]').isDisabled(), true);
      }
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await scene("long-content");
        await layout(page, `${w} long-content`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("default");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: responsive long content 320/759/760/761/768/1024 and CSS zoom2; column/freeze/density desktop controls; no storage. Not full AT/theme/lifecycle coverage`,
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  if (capture)
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          proposal: "PROVIDER-ADAPTERS-C-r1",
          sourceHashes,
          sourceChecks: data.checks,
          checks,
          errors,
          httpRequests: 0,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
  else
    assert.deepEqual(
      prior.screenshots.map((s) => s.file),
      expected,
    );
  assert.deepEqual(
    (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
    [...expected].sort(),
  );
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      errors,
      httpRequests: requests.length,
    }),
  );
} finally {
  await browser.close();
}
