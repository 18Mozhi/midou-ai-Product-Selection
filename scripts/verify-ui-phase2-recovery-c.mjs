import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildRecoveryDesignData } from "./lib/ui-phase2-recovery-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/recovery-direction-c",
  root = path.join(repo, relative);
const hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture");
const sourceFiles = [
  ...["index.html", "not-found.html", "showcase.js", "not-found.js", "recovery.css", "data.js"].map(
    (f) => `${relative}/${f}`,
  ),
  "apps/web/src/components/UiStateShowcase.vue",
  "apps/web/src/components/UiStatePanel.vue",
  "apps/web/src/components/ConfirmDialog.vue",
  "apps/web/src/components/NotFoundPage.vue",
  "apps/web/src/ui/state-contract.ts",
  "apps/web/src/navigation-memory.ts",
  "apps/web/src/route-catalog.ts",
  "apps/web/src/route-catalog.generated.json",
  "apps/web/src/router.ts",
  "apps/web/src/App.vue",
  "scripts/lib/ui-phase2-recovery-design-data.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "scripts/verify-ui-phase2-recovery-c.mjs",
];
const sourceTexts = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (f) => [
      f,
      (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n"),
    ]),
  ),
);
const sourceHashes = Object.fromEntries(Object.entries(sourceTexts).map(([f, s]) => [f, hash(s)]));
const data = await buildRecoveryDesignData(repo),
  box = { window: {} };
vm.runInNewContext(sourceTexts[`${relative}/data.js`], box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.RECOVERY_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^[A-Za-z0-9_.-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
  }
}
const screenshots = [],
  expected = [],
  reports = [];
async function common(page) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "horizontal overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length, "unique ids");
}
async function nfMetrics(page) {
  await common(page);
  const metrics = await page.locator("a").evaluateAll((ns) =>
    ns.map((n) => ({
      width: n.getBoundingClientRect().width,
      height: n.getBoundingClientRect().height,
      font: parseFloat(getComputedStyle(n).fontSize),
    })),
  );
  assert.ok(metrics.length >= 2);
  assert.ok(metrics.every((m) => m.width >= 44 && m.height >= 44 && m.font >= 16));
}
async function shot(page, width, name, fullPage = true) {
  const file = `${width}-${name}.png`;
  expected.push(file);
  if (capture) {
    const bytes = await page.screenshot({
      path: path.join(root, file),
      fullPage,
      animations: "disabled",
    });
    screenshots.push({ file, width, scene: name, sha256: hash(bytes) });
  }
}
const browser = await chromium.launch({ headless: true });
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
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      page.on("request", (r) => {
        if (/^https?:/.test(r.url())) requests.push(r.url());
      });
      await page.route(/^https?:/, (r) => r.abort());
      const entry = pathToFileURL(path.join(root, "index.html"));
      const start = async (query) => {
        const url = new URL(entry);
        url.search = query;
        await page.goto(url.href);
        await page.waitForFunction(() => window.RECOVERY_C?.state());
      };
      const scene = async (name) => {
        await page.evaluate((n) => window.RECOVERY_C.scene(n), name);
        await page.evaluate(() => document.fonts.ready);
      };
      const state = () => page.evaluate(() => window.RECOVERY_C.state());
      await start("state=error&context=review");
      assert.equal(
        await page.locator("h1").evaluate((n) => getComputedStyle(n).display !== "none"),
        true,
      );
      const names = await page.evaluate(() => Object.keys(window.RECOVERY_C.scenes));
      assert.equal(names.length, 22);
      for (const name of names) {
        await scene(name);
        await checkPrototypeMetrics(page);
        await common(page);
        await shot(page, width, `p72-${name}`, !(await page.locator("dialog[open]").count()));
      }
      for (const kind of data.kinds) {
        await scene(kind);
        const buttons = await page.locator("#preview button").count();
        assert.equal(buttons, Object.keys(data.actions[kind]).length);
        assert.equal(
          await page.locator("#preview").getAttribute("aria-busy"),
          String(kind === "loading"),
        );
        for (const which of Object.keys(data.actions[kind])) {
          await scene(kind);
          await page.locator(`#${which}`).click();
          const s = await state(),
            result = data.actions[kind][which];
          assert.equal(s.kind, result.kind);
          assert.deepEqual(
            s.navigation,
            result.navigation.filter((n) => typeof n === "string"),
          );
          if (!(kind === "blocked" && which === "secondary") && !s.navigation.length)
            assert.equal(s.message, result.message);
          if (s.navigation.length) assert.match(s.message, /离线演示/);
        }
      }
      for (const query of [
        "state=unknown&context=review",
        "state=error&state=blocked&context=review",
      ]) {
        await start(query);
        assert.equal((await state()).kind, "empty");
        assert.equal(new URL(page.url()).search, `?${query}`);
        await page.locator("[data-state=error]").click();
        assert.equal(new URL(page.url()).searchParams.get("context"), "review");
        const n = await page.evaluate(() => history.length);
        await page.locator("[data-state=error]").click();
        assert.equal(await page.evaluate(() => history.length), n);
      }
      await start("state=empty");
      await page.locator("#primary").click();
      assert.ok((await state()).message);
      await page.locator("[data-state=blocked]").click();
      assert.equal((await state()).message, "");
      await page.goBack();
      assert.equal((await state()).kind, "empty");
      assert.equal((await state()).message, "");
      await page.goForward();
      assert.equal((await state()).kind, "blocked");
      await page.reload();
      assert.equal((await state()).kind, "blocked");
      await scene("empty");
      const trigger = page.locator("#open-confirm");
      await trigger.click();
      assert.equal(
        await page.locator("#cancel").evaluate((n) => n === document.activeElement),
        true,
      );
      for (const index of [0, 1, 2, 3, 4]) {
        const c = data.confirmations[index];
        await page.locator("#ack").setChecked(c.acknowledged);
        await page.locator("#phrase").fill(c.typedText);
        assert.equal(await page.locator("#confirm").isEnabled(), c.enabled);
        for (const key of ["Tab", "Shift+Tab"])
          for (let j = 0; j < 6; j++) {
            await page.keyboard.press(key);
            assert.equal(
              await page.evaluate(() =>
                document.querySelector("dialog").contains(document.activeElement),
              ),
              true,
            );
          }
      }
      await page.locator("#confirm").click();
      assert.equal((await state()).confirmed, true);
      assert.equal(await trigger.evaluate((n) => n === document.activeElement), true);
      await page.locator("[data-state=error]").click();
      assert.equal((await state()).confirmed, true);
      for (const method of ["escape", "cancel", "backdrop"]) {
        await trigger.click();
        assert.equal(await page.locator("#ack").isChecked(), false);
        assert.equal(await page.locator("#phrase").inputValue(), "");
        if (method === "escape") await page.keyboard.press("Escape");
        if (method === "cancel") await page.locator("#cancel").click();
        if (method === "backdrop") await page.mouse.click(2, 2);
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal(await trigger.evaluate((n) => n === document.activeElement), true);
        assert.equal(await page.evaluate(() => document.body.style.overflow), "");
      }
      await scene("self-return");
      assert.equal(await page.locator("#demo-recent").innerText(), "/ui-states?state=blocked");
      await page.locator("#primary").click();
      assert.equal((await state()).kind, "empty");
      assert.equal((await state()).message, data.selfReturn.message);
      assert.deepEqual((await state()).navigation, []);
      await scene("invalid-ids");
      assert.equal(await page.locator(".correlations").count(), 0);
      assert.equal(await page.locator("script:not([src])").count(), 0);
      await scene("long-ids");
      assert.equal((await page.locator("dd").first().innerText()).length, 128);
      if (width === 390) {
        await page.setViewportSize({ width: 390, height: 667 });
        await scene("confirm-ready");
        await checkPrototypeMetrics(page);
        const b = await page.locator("#confirm").boundingBox();
        assert.ok(b.y + b.height <= 667);
        await shot(page, 390, "p72-confirm-short-667", false);
        await page.keyboard.press("Escape");
        await page.setViewportSize({ width: 390, height: 844 });
      }
      for (const [name, row] of Object.entries(data.notFound)) {
        const url = pathToFileURL(path.join(root, "not-found.html"));
        url.searchParams.set("case", name);
        url.searchParams.set("filter", "qa-only");
        url.hash = "details";
        await page.goto(url.href);
        await page.waitForFunction(() => window.NOT_FOUND_C?.state());
        await page.evaluate(() => document.fonts.ready);
        await nfMetrics(page);
        assert.equal(
          await page.locator("#not-found-title").evaluate((n) => n === document.activeElement),
          true,
        );
        assert.equal(await page.locator("#requested-path").innerText(), row.requestedPath);
        assert.equal(await page.locator("#requested-path").getAttribute("title"), row.input.path);
        assert.equal(await page.locator("#recovery-actions a").count(), row.distinct ? 2 : 1);
        assert.equal(
          await page.locator("#recovery-actions a").first().getAttribute("data-target"),
          row.recent.fullPath,
        );
        const text = await page.locator("body").innerText();
        for (const forbidden of [
          "qa-only",
          "state=blocked",
          "filter=",
          "状态示例",
          "m02-04-request",
          "权限申请",
        ])
          assert.ok(!text.includes(forbidden), forbidden);
        assert.equal(await page.locator("dialog,select,input,button").count(), 0);
        await shot(page, width, `p73-${name}`);
        await page.locator("#recovery-actions a").first().click();
        assert.deepEqual(await page.evaluate(() => window.NOT_FOUND_C.state().navigation), [
          row.recent.fullPath,
        ]);
        await page.locator("#brand").click();
        assert.deepEqual(await page.evaluate(() => window.NOT_FOUND_C.state().navigation), [
          row.recent.fullPath,
          "/home",
        ]);
        await page.reload();
        assert.equal(
          await page.locator("#not-found-title").evaluate((n) => n === document.activeElement),
          true,
        );
      }
      if (width === 1440) {
        for (const w of [320, 768, 780, 781, 1024]) {
          await page.setViewportSize({ width: w, height: 900 });
          await nfMetrics(page);
          await start("state=blocked");
          await checkPrototypeMetrics(page);
          await common(page);
          await page.locator("#open-confirm").click();
          await checkPrototypeMetrics(page);
          await page.keyboard.press("Escape");
          const nf = pathToFileURL(path.join(root, "not-found.html"));
          nf.search = "case=long";
          await page.goto(nf.href);
          await page.waitForFunction(() => window.NOT_FOUND_C?.state());
          await nfMetrics(page);
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
        { local: 0, session: 0 },
      );
      reports.push({
        width,
        p72: 22,
        p73: 9,
        shortModal: width === 390,
        httpRequests: 0,
        storageEntries: 0,
        errors: 0,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
assert.equal(expected.length, 63);
assert.deepEqual(
  (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
  [...expected].sort(),
);
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: data.version,
        approval: "pending",
        sourceHashes,
        screenshots,
        reports,
        boundary: data.boundary,
      },
      null,
      2,
    ) + "\n",
  );
else
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expected,
  );
console.log(JSON.stringify({ passed: true, capture, screenshots: expected.length, reports }));
