import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildPermissionComparisonDesignData } from "./lib/ui-phase2-permission-comparison-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/permission-comparison-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildPermissionComparisonDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.PERMISSION_C_DATA)), data);
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-permission-comparison-design-data.mjs",
  "scripts/verify-ui-phase2-permission-comparison-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/platform-organizations-direction-c/organizations.css",
  ...["index.html", "permissions.css", "permissions.js", "data.js"].map((f) => relative + "/" + f),
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
async function layout(page, contextName) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    contextName + " page overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(await page.locator("dialog").count(), 0);
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
      const url = pathToFileURL(path.join(root, "index.html")).href;
      await page.goto(url);
      const scene = (key) =>
        page.evaluate((key) => {
          window.PERMISSION_C.scene(key);
          window.scrollTo(0, 0);
        }, key);
      const state = () => page.evaluate(() => window.PERMISSION_C.state());
      const allScenes = await page.evaluate(() => Object.keys(window.PERMISSION_C.scenes));
      for (const key of allScenes) {
        await scene(key);
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        if (key === "focus")
          assert.equal(await page.evaluate(() => document.activeElement.id), "refresh");
        await layout(page, key);
        const expectedCase = data.cases.find((c) => c.key === key);
        if (expectedCase)
          assert.deepEqual(
            await page.evaluate(() => window.PERMISSION_C.comparison()),
            expectedCase.rows,
            key + " exact source rows",
          );
        const file = `${width}-${key}.png`;
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({
            file,
            width,
            height: width === 390 ? 844 : 1000,
            scene: key,
            pageId: "P45",
            proposal: "PERMISSION-C-r1",
            sha256: hash(bytes),
          });
        }
        if (key === "pressed") await page.mouse.up();
      }
      await scene("default");
      if (width === 390) {
        const summary = page.locator(".mobile-descriptions summary");
        await summary.click();
        assert.equal(await page.locator(".mobile-descriptions").getAttribute("open"), "");
        await summary.press("Enter");
        assert.equal(await page.locator(".mobile-descriptions").getAttribute("open"), null);
      }
      assert.equal(await page.locator("#reset").isDisabled(), true);
      await page.locator("#right").selectOption(data.roles[0].code);
      assert.equal((await page.evaluate(() => window.PERMISSION_C.comparison())).length, 0);
      await page.locator("#only").uncheck();
      assert.equal((await page.evaluate(() => window.PERMISSION_C.comparison())).length, 3);
      assert.equal(await page.locator("#reset").isDisabled(), true);
      await page.locator("#query").fill("  PLATFORM:  ");
      assert.equal((await page.evaluate(() => window.PERMISSION_C.comparison())).length, 1);
      assert.equal(new URL(page.url()).searchParams.get("capability_query"), "PLATFORM:");
      await page.locator("#reset").click();
      assert.deepEqual((await state()).controls, data.cases[0].controls);
      for (const key of [
        "left_role",
        "right_role",
        "show_all",
        "capability_query",
        "capability_group",
      ])
        assert.equal(new URL(page.url()).searchParams.has(key), false);
      await page.locator("#group").selectOption("安全治理");
      await page.locator("#query").fill("会话");
      assert.equal((await page.evaluate(() => window.PERMISSION_C.comparison())).length, 1);
      assert.equal(await page.evaluate(() => document.activeElement.id), "query");
      assert.match(await page.locator("#left-count").textContent(), /3 项/);
      assert.match(await page.locator("#directory-meta").textContent(), /3 个角色 · 7 项/);
      assert.match(await page.locator("#result-count").textContent(), /并集 6 项/);
      checks.push(
        `${width}: all ${allScenes.length} scenes, zero dialogs, 15 exact source-row comparisons; real select/search/group/toggle/reset and separated 7/6/1 scopes`,
      );
      const restore = new URL(url);
      for (const [k, v] of Object.entries({
        keep: "retained",
        left_role: data.roles[2].code,
        right_role: data.roles[0].code,
        show_all: "1",
        capability_query: "管理",
        capability_group: "平台治理",
      }))
        restore.searchParams.set(k, v);
      await page.goto(restore.href);
      assert.equal((await state()).left, data.roles[2].code);
      assert.equal((await state()).only, false);
      await page.locator("#query").fill("角色");
      await page.reload();
      assert.equal((await state()).query, "角色");
      assert.equal(new URL(page.url()).searchParams.get("keep"), "retained");
      await page.locator("#reset").click();
      assert.equal(new URL(page.url()).searchParams.get("keep"), "retained");
      assert.equal(new URL(page.url()).searchParams.has("left_role"), false);
      await page.goto(
        url +
          "?left_role=retired&right_role=retired&capability_query=" +
          "x".repeat(100) +
          "&capability_group=" +
          "y".repeat(60),
      );
      assert.equal((await state()).left, data.roles[0].code);
      assert.equal((await state()).query.length, 80);
      assert.equal((await state()).group.length, 40);
      await scene("single-role");
      await page.locator("#query").fill("管理");
      await page.locator("#reset").click();
      assert.equal(await page.locator("#left").inputValue(), "");
      assert.match(await page.locator("#matrix").textContent(), /默认角色不在当前目录/);
      await page.locator("#left").selectOption(data.roles[2].code);
      await page.locator("#right").selectOption(data.roles[2].code);
      await page.locator("#only").uncheck();
      assert.equal((await page.evaluate(() => window.PERMISSION_C.comparison())).length, 7);
      checks.push(
        `${width}: file-URL five-key initialization/update/reload/default omission, unrelated key retained, invalid role fallback, 80/40 bounds; single-role reset boundary retained. Not VueRouter back/forward proof`,
      );
      for (const outcome of ["success", "empty", "error", "timeout", "forbidden", "expired"]) {
        for (const from of ["default", "error", "empty"]) {
          await scene(from);
          await page.locator(from === "default" ? "#refresh" : "#retry").click();
          assert.equal((await state()).busy, true);
          assert.equal(await page.locator("#refresh").isDisabled(), true);
          assert.equal(await page.evaluate(() => window.PERMISSION_C.read()), null);
          assert.deepEqual(
            (await state()).intents.map(({ method, path }) => ({ method, path })),
            [{ method: "GET", path: "/api/v1/platform/roles" }],
          );
          assert.equal(
            await page.evaluate(() => window.PERMISSION_C.complete("success", -1)),
            false,
          );
          if (from === "default") await page.locator("#left").selectOption(data.roles[2].code);
          await page.evaluate((outcome) => window.PERMISSION_C.complete(outcome), outcome);
          assert.equal((await state()).busy, false);
          assert.equal(
            (await state()).roles.length,
            outcome === "empty" ? 0 : outcome === "success" || from === "default" ? 3 : 0,
          );
          if (!["success", "empty"].includes(outcome) && from === "default") {
            assert.match((await state()).error, /已保留/);
            assert.equal((await state()).time, "09:20");
            assert.equal((await state()).left, data.roles[2].code);
          }
          await layout(page, from + outcome);
        }
      }
      checks.push(
        `${width}: 18 offline read-result paths, refresh/retry/empty-recheck single-flight, selection usable during read, timeout/401/403 old matrix and time retained. No network or actual authentication`,
      );
      await scene("default");
      await page.locator("#left").focus();
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), "right");
      assert.match(
        await page.locator("#admins").getAttribute("href"),
        /user-admin-direction-c\/index.html\?mode=admins$/,
      );
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      for (const w of [320, 759, 760, 761, 768, 1024, 1100, 1101]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await scene("long-content");
        await layout(page, `${w} long-content`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("default");
      await page.evaluate(() => {
        document.documentElement.style.zoom = "2";
      });
      await layout(page, "CSS zoom2");
      checks.push(
        `${width}: keyboard Tab, P44 draft link, no storage; 320/759/760/761/768/1024/1100/1101 long-content and CSS zoom2 checks (not native mobile keyboard or full AT coverage)`,
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
          proposal: "PERMISSION-C-r1",
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
