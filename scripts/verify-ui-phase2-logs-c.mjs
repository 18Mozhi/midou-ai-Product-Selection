import assert from "node:assert/strict";
import { responsiveFocusContractHash } from "./lib/ui-phase2-responsive-focus-contract.mjs";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildLogDesignData } from "./lib/ui-phase2-log-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/logs-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex"),
  lf = (v) => v.replaceAll("\r\n", "\n"),
  { data, logic } = await buildLogDesignData(repo);
for (const dataset of Object.values(data.datasets))
  for (let i = 1; i < dataset.items.length; i++)
    assert.ok(
      Date.parse(dataset.items[i - 1].occurred_at) >= Date.parse(dataset.items[i].occurred_at),
      "Synthetic returned window must keep descending source order",
    );
for (const [name, content] of [
  ["data.js", `window.LOG_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const file = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(file)), parser: "babel" });
  if (capture) await writeFile(file, formatted);
  else assert.equal(lf(await readFile(file, "utf8")), formatted);
}
const contract = await readFile(
    path.join(repo, "design-plans/ui-phase-2-2026-09-07/log-backup-release-contract-review.md"),
    "utf8",
  ),
  contracts = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)].filter(([, f]) =>
    data.sourcePaths.includes(f),
  );
assert.equal(contracts.length, 12);
for (const [, f, h] of contracts)
  assert.equal(
    hash(lf(await readFile(path.join(repo, f), "utf8"))),
    responsiveFocusContractHash(f, h),
    f,
  );
const sourcePaths = [
    "scripts/lib/ui-phase2-responsive-focus-contract.mjs",
    ...data.sourcePaths,
    "scripts/lib/ui-phase2-log-design-data.mjs",
    "scripts/verify-ui-phase2-logs-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    ...["index.html", "logs.css", "logs.js", "data.js", "source-logic.js"].map(
      (f) => relative + "/" + f,
    ),
  ],
  sourceHashes = Object.fromEntries(
    await Promise.all(
      sourcePaths.map(async (f) => [f, hash(lf(await readFile(path.join(repo, f), "utf8")))]),
    ),
  );
if (!capture) {
  const old = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(old.sourceHashes, sourceHashes);
  for (const p of old.screenshots)
    assert.equal(hash(await readFile(path.join(root, p.file))), p.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  errors = [],
  requests = [],
  checks = [];
let scenes;
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate IDs");
  for (const d of await page.locator("dialog[open]").all())
    assert.ok(
      await d.evaluate(
        (n) =>
          n.scrollWidth <= n.clientWidth + 1 &&
          document.getElementById(n.getAttribute("aria-labelledby")) &&
          document.getElementById(n.getAttribute("aria-describedby")),
      ),
      label + " dialog ARIA/overflow",
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
      await context.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      assert.deepEqual(errors, []);
      scenes = await page.evaluate(() => window.LOG_C.scenes);
      const scene = (k) => page.evaluate((k) => window.LOG_C.scene(k), k),
        state = () => page.evaluate(() => window.LOG_C.state()),
        done = (o = "success") => page.evaluate((o) => window.LOG_C.completeRead(o), o);
      async function shot(key, suffix = "") {
        const file = `${width}-${key}${suffix}.png`;
        expected.push(file);
        if (capture) {
          await page.screenshot({
            path: path.join(root, file),
            fullPage:
              !(await page.locator("dialog[open]").count()) &&
              !(width === 390 && ["large", "large-last"].includes(key)),
          });
          screenshots.push({
            scene: key,
            width,
            file,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
      }
      for (const key of Object.keys(scenes)) {
        await scene(key);
        assert.deepEqual(errors, [], key);
        if (key === "large-last" && width === 390)
          await page.locator("[data-detail]").last().scrollIntoViewIfNeeded();
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, `${width}/${key}`);
        if (key === "dark")
          assert.equal(
            await page.locator("body").evaluate((n) => getComputedStyle(n).color),
            "rgb(239, 244, 255)",
          );
        await shot(key);
        if (key === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
        const d = page.locator("dialog[open]");
        let part = 0;
        if (await d.count())
          while (await d.evaluate((n) => n.scrollTop + n.clientHeight < n.scrollHeight - 2)) {
            const before = await d.evaluate((n) => n.scrollTop);
            await d.evaluate((n) => (n.scrollTop += Math.floor(n.clientHeight * 0.8)));
            assert.ok((await d.evaluate((n) => n.scrollTop)) > before);
            await shot(key, `-part${++part}`);
          }
      }
      await scene("original");
      assert.equal(await page.locator(".mobile.event-list").isVisible(), width === 390);
      assert.equal(await page.locator(".table-tools").isVisible(), width === 1440);
      assert.equal((await state()).data.items.length, 3);
      assert.equal(await page.locator("[data-chain]").count(), 2);
      assert.deepEqual(
        await page.locator("tbody tr").evaluateAll((ns) => ns.map((n) => n.dataset.event)),
        ["api:api-event", "crawler:crawler-event"],
      );
      await page.locator("[data-chain]").last().click();
      assert.equal((await state()).reads.length, 0);
      assert.equal(await page.locator("#work").evaluate((n) => n === document.activeElement), true);
      for (const source of ["api", "worker", "crawler"]) {
        await scene("source-" + source);
        const s = await state();
        assert.ok(s.data.items.every((r) => r.source === source));
        assert.equal(s.data.summary.total, s.data.items.length);
        assert.equal(s.reads[0].query.status, source);
        assert.equal(s.url.source, source);
        assert.equal(s.url.keep, "review");
      }
      await scene("default");
      assert.equal(await page.locator("#reset").isDisabled(), true);
      const p = width === 390 ? "m-" : "";
      if (p) await page.locator("#mobile-filter").click();
      await page.locator(`#${p}query`).fill("trace-shared");
      await page.locator(`#${p}source`).selectOption("crawler");
      await page.locator(`#${p}apply`).click();
      assert.equal((await state()).applied.query, "");
      await done("error");
      assert.equal((await state()).data.items.length, 11);
      await page.locator("#refresh").click();
      await done();
      assert.equal((await state()).data.items.length, 1);
      assert.equal((await state()).applied.source, "crawler");
      if (p) await page.locator("#mobile-filter").click();
      await page.locator(`#${p}reset`).click();
      await done();
      assert.equal((await state()).data.items.length, 11);
      assert.deepEqual((await state()).url, { keep: "review" });
      await scene("read-pending");
      const old = (await state()).read.id;
      await page.evaluate(() => window.LOG_C.read());
      assert.equal(
        await page.evaluate((id) => window.LOG_C.completeRead("success", id), old),
        false,
      );
      await done();
      assert.equal((await state()).data.items.length, 1);
      await scene("missing");
      assert.equal(await page.locator("[data-chain]").count(), 3);
      await page.locator("#trace summary").click();
      assert.ok((await page.locator("#trace").innerText()).includes("不是服务端trace_id"));
      await scene("large");
      assert.equal((await state()).data.items.length, 200);
      assert.equal(await page.locator("tbody tr").count(), 200);
      assert.equal(await page.locator("[data-detail]").count(), 200);
      assert.ok((await page.locator("#app").innerText()).includes("已达到200条上限"));
      await scene("default");
      if (width === 1440) {
        await page.locator(".column-menu summary").click();
        for (let i = 0; i < 6; i++) await page.locator(`[data-col="${i}"]`).uncheck();
        assert.equal(await page.locator("[data-col]:disabled").count(), 1);
        assert.equal(await page.locator("th.frozen").count(), 1);
        await page.locator("#freeze").click();
        assert.equal(await page.locator("th.frozen").count(), 0);
        await page.locator("#density").selectOption("compact");
        const before = await state();
        await page.locator("[data-chain]").last().click();
        const after = await state();
        assert.notEqual(before.selected, after.selected);
        assert.deepEqual(after.settings[after.selected], {
          hidden: [],
          freeze: true,
          density: "standard",
        });
      }
      for (const source of ["api", "worker", "crawler"]) {
        await scene("detail-" + source);
        const d = page.locator("dialog");
        for (const text of ["时间", "运行面", "事件", "状态", "资源", "来源名称", "错误代码"])
          assert.ok((await d.innerText()).includes(text));
        await d.locator(".row-tech summary").click();
        assert.ok((await d.innerText()).includes("请求ID"));
        const expectedLinks = source === "crawler" ? 2 : source === "worker" ? 1 : 0;
        assert.equal(await d.locator("[data-link]").count(), expectedLinks);
        await page.keyboard.press("Escape");
      }
      await scene("detail-crawler");
      const href = await page.locator("dialog [data-link]").first().getAttribute("href");
      assert.ok(href.includes("&from=%2Fplatform-admin%2Flogs"));
      await page.locator("dialog [data-link]").first().click();
      assert.deepEqual((await state()).navigation, [href]);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      for (const k of ["filter-open", "detail-crawler", "export-reason"]) {
        await scene(k);
        const d = page.locator("dialog");
        const controls = d.locator("button:not(:disabled),input,select,textarea,a[href],summary");
        await controls.first().focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(await controls.last().evaluate((n) => n === document.activeElement), true);
        await page.keyboard.press("Tab");
        assert.equal(await controls.first().evaluate((n) => n === document.activeElement), true);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement === document.body), false);
      }
      await scene("filter-open");
      await page.locator("#m-query").fill("draft-kept");
      await page.locator("#close").click();
      assert.equal((await state()).draft.query, "draft-kept");
      assert.equal((await state()).reads.length, 0);
      await scene("export-draft");
      assert.deepEqual((await state()).dialog.target, { query: "", source: "" });
      assert.equal(
        await page.locator("#reason").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#reason").fill(" ");
      await page.locator("#submit").click();
      assert.equal(await page.locator("#reason").getAttribute("aria-invalid"), "true");
      assert.equal((await state()).writes.length, 0);
      await page.locator("#reason").fill("  合成导出原因  ");
      await page.locator("#submit").click();
      await page.evaluate(() => window.LOG_C.submitExport());
      assert.equal((await state()).writes.length, 1);
      assert.deepEqual((await state()).writes[0].body, { query: "", reason: "合成导出原因" });
      await page.evaluate(() => window.LOG_C.completeExport("success"));
      assert.ok((await page.locator("#app").innerText()).includes("不等于用户已保存"));
      await scene("export-over");
      assert.equal(await page.locator("#reason").getAttribute("aria-invalid"), "true");
      await page.locator("#cancel").click();
      assert.equal((await state()).writes.length, 0);
      await scene("export-pending");
      const exportId = (await state()).exportPending.id;
      await scene("default");
      assert.equal(
        await page.evaluate((id) => window.LOG_C.completeExport("success", id), exportId),
        false,
      );
      for (const k of ["loading", "timeout", "forbidden", "expired", "rate_limited", "error"]) {
        await scene(k);
        assert.equal(await page.locator(".counts").count(), 0);
        if (k === "loading") {
          assert.equal(await page.locator("#export").isDisabled(), true);
          assert.equal(await page.locator("#retry").isDisabled(), true);
          await done("error");
          assert.equal((await state()).first, "error");
        }
        await page.locator("#retry").click();
        await done("error");
        assert.equal(await page.locator(".counts").count(), 0);
      }
      await scene("export-reason");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal((await state()).writes.length, 0);
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const k of ["default", "long", "filter-open", "export-reason", "detail-crawler"]) {
          await scene(k);
          await layout(page, `${w}/${k}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("default");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      await page.evaluate(() => (document.documentElement.style.zoom = ""));
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push(
        `${width}: original chronological groups, three source mappings, query/reset URL and snapshot ownership, late GET/export IDs, missing traces, 200 returned rows, per-chain columns/freeze/density desktop, three complete event details and exact links, three modal keyboard/Escape/return/cancel consumers, reason boundaries/frozen body/no duplicate, six first-read states, six breakpoints and CSS zoom2, no HTTP/storage/download.`,
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  if (capture) {
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          proposal: "LOGS-C-r1",
          sourceHashes,
          sourceChecks: data.sourceChecks,
          checks,
          errors,
          httpRequests: 0,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
    const file = path.join(root, "README.md"),
      readme = await readFile(file, "utf8"),
      gallery =
        `正式PNG：${screenshots.length}张；${Object.keys(scenes).length}场景。200条手机窗口只取顶部/尾部代表图，完整记录仍可滚动操作。\n\n| 场景 | 桌面1440 | 手机390 |\n| --- | --- | --- |\n` +
        Object.entries(scenes)
          .map(
            ([k, label]) =>
              `| ${label} (${k}) | ` +
              [1440, 390]
                .map((w) =>
                  screenshots
                    .filter((p) => p.scene === k && p.width === w)
                    .map((p) => `[${p.file.includes("-part") ? "续图" : "主图"}](${p.file})`)
                    .join(" · "),
                )
                .join(" | ") +
              " |",
          )
          .join("\n");
    await writeFile(
      file,
      readme.replace(
        /<!-- GALLERY:START -->[\s\S]*?<!-- GALLERY:END -->/,
        `<!-- GALLERY:START -->\n${gallery}\n<!-- GALLERY:END -->`,
      ),
    );
  }
  assert.deepEqual(
    (await readdir(root)).sort(),
    [
      ...expected,
      "index.html",
      "logs.css",
      "logs.js",
      "data.js",
      "source-logic.js",
      "README.md",
      "evidence.json",
    ].sort(),
  );
  const links = [
    ...(await readFile(path.join(root, "README.md"), "utf8")).matchAll(/\]\(([^)]+)\)/g),
  ];
  for (const [, l] of links) await readFile(path.resolve(root, l));
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      scenes: Object.keys(scenes).length,
      screenshots: expected.length,
      sourceChecks: data.sourceChecks.length,
      contractSources: contracts.length,
      readmeLinks: links.length,
      errors,
      httpRequests: requests.length,
      checks,
    }),
  );
} finally {
  await browser.close();
}
