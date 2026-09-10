import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke"),
  base = "design-plans/ui-phase-2-2026-09-07/design/platform-overview-direction-c",
  proposal = "design-plans/ui-phase-2-2026-09-07/design/platform-overview-provider-detail",
  output = "output/playwright/p38-provider-compositions",
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
assert.ok(process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)));
assert.ok(!(capture && smoke), "Smoke does not write review artifacts");
const original = JSON.parse(await text(`${base}/evidence.json`));
for (const [file, digest] of Object.entries(original.sourceHashes))
  assert.equal(hash(await text(file)), digest, file);
for (const item of original.screenshots)
  assert.equal(hash(await readFile(`${base}/${item.file}`)), item.sha256, item.file);
const sourceFiles = [
    ...["index.html", "detail.css", "detail.js"].map((f) => `${proposal}/${f}`),
    ...["overview.js", "overview.css", "data.js", "evidence.json"].map((f) => `${base}/${f}`),
    ...["PlatformDashboard.vue", "ResponsiveDataView.vue", "TableViewControls.vue"].map(
      (f) => `apps/web/src/components/${f}`,
    ),
    "scripts/verify-ui-phase2-platform-provider-detail.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ],
  sourceHashes = Object.fromEntries(
    await Promise.all(sourceFiles.map(async (f) => [f, hash(await text(f))])),
  ),
  checks = [],
  screenshots = [],
  expected = [];
if (capture) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (/^https?:/.test(request.url())) requests.push(request.url());
      });
      await page.route(/^https?:/, (route) => route.abort());
      await page.goto(pathToFileURL(resolve(base, "index.html")).href);
      const attentionBefore = hash(await page.locator("#attention").screenshot());
      await page.goto(pathToFileURL(resolve(proposal, "index.html")).href);
      assert.equal(hash(await page.locator("#attention").screenshot()), attentionBefore);
      checks.push({ width, name: "Non-target attention region pixels unchanged" });
      const state = () => page.evaluate(() => window.PLATFORM_OVERVIEW_C.state());
      const scene = async (name) => {
        await page.evaluate((v) => window.PLATFORM_OVERVIEW_C.scene(v), name);
        await page.locator(".review-bar [data-detail-review]").waitFor();
      };
      const shot = async (name, selector) => {
        await checkPrototypeMetrics(page);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const bytes = await page.locator(selector).screenshot({
            path: `${output}/${file}`,
            animations: "disabled",
          });
          screenshots.push({ file, width, name, selector, sha256: hash(bytes) });
        }
        checks.push({ width, name: `Readable scoped composition: ${name}` });
      };
      if (width === 390) {
        const open = async (name) => {
          await scene(name);
          const data = (await state()).data.provider_health;
          const target = data[1];
          const trigger = page.locator(`[data-preview="${target.id}"]`);
          await trigger.click();
          await page.locator("#provider-name").waitFor();
          assert.equal(await page.locator("#provider-name").textContent(), target.name);
          assert.deepEqual(await page.locator(".preview-body > dl dd").allTextContents(), [
            String(target.success_count),
            String(target.failed_count),
            String(target.observed_count),
            target.last_observed_at
              ? new Date(target.last_observed_at).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                  hour12: false,
                })
              : "无样本",
          ]);
          assert.equal(
            await page.locator("#preview-close").evaluate((n) => n === document.activeElement),
            true,
          );
          assert.equal(
            await page.locator("dialog").getAttribute("aria-labelledby"),
            "preview-title provider-name",
          );
          checks.push({ width, name: `Original fields, dialog name and initial focus: ${name}` });
          return trigger;
        };
        const trigger = await open("normal");
        await shot("close-focus", "dialog");
        await page.locator("#preview-close").evaluate((n) => n.blur());
        await shot("preview-collapsed", "dialog");
        await page.locator("#provider-technical summary").click();
        const sourceRow = (await state()).data.provider_health[1];
        assert.deepEqual(await page.locator("#provider-technical dd").allTextContents(), [
          sourceRow.id,
          sourceRow.code,
          sourceRow.status,
        ]);
        await shot("preview-expanded", "dialog");
        await page.locator("#preview-close").focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page
            .locator("#provider-technical summary")
            .evaluate((n) => n === document.activeElement),
          true,
        );
        await shot("technical-focus", "dialog");
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#preview-close").evaluate((n) => n === document.activeElement),
          true,
        );
        checks.push({ width, name: "Tab and Shift+Tab wrap within modal" });
        await page.locator("#preview-close").evaluate((n) => n.blur());
        await page.locator("#preview-close").hover();
        await shot("close-hover", "dialog");
        await page.mouse.down();
        await shot("close-pressed", "dialog");
        await page.mouse.move(200, 160);
        await page.mouse.up();
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog").evaluate((n) => n.open), false);
        assert.equal(await trigger.evaluate((n) => n === document.activeElement), true);
        checks.push({ width, name: "Escape closes and restores original trigger" });
        await open("unknown_provider");
        await page.locator("#provider-technical summary").click();
        assert.equal(await page.locator(".preview-body > .badge").textContent(), "未知");
        assert.equal(await page.locator("#provider-technical dd").last().textContent(), "critical");
        await shot("unknown-expanded", "dialog");
        await page.locator("#preview-close").click();
        assert.equal(await page.locator("dialog").evaluate((n) => n.open), false);
        await open("long_fields");
        await page.locator("#provider-technical summary").click();
        await page.locator("dialog").evaluate((n) => {
          n.scrollTop = 0;
        });
        await shot("long-top", "dialog");
        await page.locator("dialog").evaluate((n) => {
          n.scrollTop = n.scrollHeight;
        });
        assert.equal(
          await page.locator("dialog").evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
          true,
        );
        await shot("long-bottom", "dialog");
        await page.setViewportSize({ width: 390, height: 568 });
        await page.locator("dialog").evaluate((n) => {
          n.scrollTop = n.scrollHeight;
        });
        const closeBox = await page.locator("#preview-close").boundingBox();
        assert.ok(closeBox.y >= 0 && closeBox.y + closeBox.height <= 568);
        await shot("short-screen", "dialog");
        await page.locator("#preview-close").click();
        checks.push({
          width,
          name: "Long identifiers wrap; short viewport retains visible close action",
        });
      } else {
        await shot("table-default", "#providers");
        await page.locator("#columns summary").click();
        assert.equal(await page.locator(".column-options input").count(), 4);
        assert.deepEqual(
          await page
            .locator(".column-options input")
            .evaluateAll((nodes) => nodes.map((n) => n.checked)),
          [true, true, true, true],
        );
        await shot("columns-expanded", "#providers");
        for (const index of [1, 2, 3]) await page.locator(`#col-${index}`).uncheck();
        assert.equal(await page.locator("#col-0").isDisabled(), true);
        assert.equal(await page.locator("#col-0").isChecked(), true);
        assert.equal(await page.locator("#provider-table th:visible").count(), 1);
        await shot("last-column-disabled", "#providers");
        await page.locator("#col-1").check();
        assert.equal(await page.locator("#col-0").isDisabled(), false);
        await page.locator("#col-0").uncheck();
        assert.equal(await page.locator("#provider-table th.frozen").textContent(), "状态");
        checks.push({
          width,
          name: "Four source columns; last selected disabled; first visible column frozen",
        });
        await scene("normal");
        await page.locator("#freeze").focus();
        await shot("freeze-focus", "#providers");
        await page.locator("#freeze").click();
        assert.equal(await page.locator("#freeze").getAttribute("aria-pressed"), "false");
        assert.equal(await page.locator("#provider-table .frozen").count(), 0);
        await shot("unfrozen", "#providers");
        await page.locator("#density").selectOption("compact");
        assert.equal(await page.locator("#provider-table").getAttribute("class"), "compact");
        assert.equal(await page.locator("#provider-table tbody tr").count(), 3);
        await shot("compact", "#providers");
        assert.deepEqual((await state()).intents, []);
        checks.push({
          width,
          name: "Freeze and density are local display changes; no read intents",
        });
      }
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      checks.push({ width, name: "No HTTP requests or browser errors" });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  const evidence = {
    proposal: "P38-PROVIDER-DETAIL-C-r1",
    sourceHashes,
    checks,
    screenshots,
    retainedOriginalImages: original.screenshots.length,
    acceptanceComplete: false,
    userApproved: false,
    limitations: [
      "Offline proposal, not mounted Vue",
      "No backend, permissions, production or native zoom verification",
      "Original unknown-status/raw-code proposal retained, not new runtime behavior",
    ],
    browserClosed: true,
  };
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>P38 来源预览与表格设置细化</title><style>
body{max-width:1100px;margin:32px auto;padding:20px;font:16px/1.7 "Microsoft YaHei",sans-serif;color:#202c3d;background:#edf1f6}
img{display:block;max-width:100%;height:auto;border:1px solid #dbe1e9;margin:12px 0 36px}h2{font-size:20px}a{color:#254a9c}</style>
<h1>P38 来源预览与表格设置 · C 细化稿</h1><p>16张独立组合图。离线设计，未批准、未上线。手机预览与桌面表格设置分别审核，不扩大整页/权限验收。</p>
<p><a href="../../../${proposal}/index.html">打开可操作原型</a></p>
${screenshots.map((s) => `<section><h2>${s.width} · ${s.name}</h2><img src="${s.file}" alt="${s.name}" loading="lazy"></section>`).join("")}</html>\n`,
  );
} else if (!smoke) {
  const evidence = JSON.parse(await text(`${output}/evidence.json`));
  assert.deepEqual(evidence.sourceHashes, sourceHashes);
  assert.deepEqual(evidence.checks, checks);
  assert.deepEqual(
    evidence.screenshots.map((s) => s.file),
    expected,
  );
  for (const item of evidence.screenshots)
    assert.equal(hash(await readFile(`${output}/${item.file}`)), item.sha256);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    checks: checks.length,
    screenshots: screenshots.length,
    originalImagesRetained: original.screenshots.length,
    browserClosed: true,
    acceptanceComplete: false,
  }),
);
