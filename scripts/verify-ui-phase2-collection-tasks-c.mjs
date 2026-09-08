import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
import { buildCollectionDesignData } from "./lib/ui-phase2-collection-tasks-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/collection-tasks-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const { data, logic } = await buildCollectionDesignData(repo);
for (const [name, content] of [
  ["data.js", `window.COLLECTION_C_DATA=${JSON.stringify(data)};`],
  ["source-logic.js", logic],
]) {
  const f = path.join(root, name),
    formatted = await format(content, { ...(await resolveConfig(f)), parser: "babel" });
  if (capture) await writeFile(f, formatted);
  else assert.equal((await readFile(f, "utf8")).replaceAll("\r\n", "\n"), formatted);
}
const contract = await readFile(
  path.join(repo, "design-plans/ui-phase-2-2026-09-07/collection-runtime-contract-review.md"),
  "utf8",
);
const contracts = [...contract.matchAll(/^\| ([^|]+?) \| ([a-f0-9]{64}) \|\r?$/gm)];
assert.equal(contracts.length, 31);
for (const [, f, h] of contracts)
  assert.equal(hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")), h, f);
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-collection-tasks-design-data.mjs",
  "scripts/verify-ui-phase2-collection-tasks-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/credential-assets-direction-c/credentials.css",
  ...["index.html", "collection.css", "collection.js", "data.js", "source-logic.js"].map(
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
  for (const p of prior.screenshots)
    assert.equal(hash(await readFile(path.join(root, p.file))), p.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  checks = [],
  errors = [],
  requests = [];
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " IDs");
  for (const d of await page.locator("dialog[open]").all()) {
    assert.ok(
      await d.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
      label + " dialog overflow",
    );
    assert.ok(await d.getAttribute("aria-labelledby"));
  }
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
      const scene = (k) => page.evaluate((k) => window.COLLECTION_C.scene(k), k),
        state = () => page.evaluate(() => window.COLLECTION_C.state());
      const complete = (outcome = "success", id) =>
        page.evaluate(({ outcome, id }) => window.COLLECTION_C.complete(outcome, id), {
          outcome,
          id,
        });
      const scenes = await page.evaluate(() => window.COLLECTION_C.scenes);
      for (const [key, label] of Object.entries(scenes)) {
        await scene(key);
        if (["hover", "pressed"].includes(key)) await page.locator("#refresh").hover();
        if (key === "pressed") await page.mouse.down();
        await layout(page, key);
        assert.equal((await state()).intents.length, 0);
        const count = await page.locator("dialog[open]").count(),
          dialog = page.locator("dialog[open]").last();
        let part = 0;
        while (true) {
          const file = `${width}-${key}${part ? "-part" + part : ""}.png`;
          expected.push(file);
          if (capture) {
            const bytes = await page.screenshot({
              path: path.join(root, file),
              fullPage: !count,
              animations: "disabled",
            });
            screenshots.push({
              file,
              width,
              scene: key,
              label,
              pageId: "P51",
              proposal: "COLLECTION-TASKS-C-r1",
              part,
              sha256: hash(bytes),
            });
          }
          if (!count) break;
          const moved = await dialog.evaluate((n) => {
            const before = n.scrollTop;
            n.scrollTop = Math.min(
              n.scrollHeight - n.clientHeight,
              n.scrollTop + n.clientHeight * 0.8,
            );
            return n.scrollTop > before + 1;
          });
          if (!moved) break;
          part++;
          assert.ok(part < 14);
        }
        if (key === "pressed") await page.mouse.up();
      }
      await scene("default");
      assert.deepEqual((await state()).items, data.original.tasks);
      if (width === 390) await page.locator("#scope summary").click();
      for (const [query, expectedIds] of Object.entries(data.filterSequences)) {
        await page.locator("#query").fill(query);
        assert.equal((await state()).query, query);
        const ids = await page
          .locator(width === 390 ? "[data-record]" : "[data-task]")
          .evaluateAll((ns) => ns.map((n) => n.dataset.record || n.dataset.task));
        assert.deepEqual(ids, expectedIds);
      }
      await scene("paged");
      await page.locator("#next").click();
      assert.equal(
        (await state()).intents[0].path,
        "/platform/collection/tasks?page=2&page_size=50",
      );
      await complete();
      assert.equal((await state()).items.length, 1);
      assert.match(page.url(), /page=2/);
      const trigger = width === 390 ? "#record-0" : "#task-0";
      await page.locator(trigger).click();
      if (width === 390) {
        assert.equal((await state()).panel, "preview");
        await page.locator("#full-detail").click();
      }
      assert.equal((await state()).detailLoading, true);
      assert.ok(await page.locator("#detail-close").isVisible());
      const op = (await state()).pending.id;
      await page.goBack();
      await page.waitForFunction(() => !document.querySelector("#detail").open);
      assert.equal(await complete("success", op), false);
      await page.goForward();
      await page.waitForFunction(() => window.COLLECTION_C.state().detailLoading);
      await complete();
      assert.equal((await state()).detail.task.id, data.original.ids.dead);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("#detail").open);
      assert.equal(await page.evaluate(() => document.activeElement.id), trigger.slice(1));
      for (const key of ["preview", "detail-loading", "detail-error", "detail", "confirm"]) {
        await scene(key);
        const top = page.locator("dialog[open]").last();
        const id = await top.getAttribute("id");
        for (const direction of ["Tab", "Shift+Tab"])
          for (let i = 0; i < 18; i++) {
            await page.keyboard.press(direction);
            assert.ok(
              await page.evaluate(
                (id) => document.getElementById(id).contains(document.activeElement),
                id,
              ),
            );
          }
        await page.keyboard.press("Escape");
        if (key === "confirm") {
          assert.ok((await page.locator("#detail").getAttribute("open")) !== null);
          assert.equal(await page.evaluate(() => document.activeElement.id), "preview-replay");
        } else assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      for (const outcome of ["error", "unknown", "success"]) {
        await scene("reason-filled");
        await page.locator("#preview-replay").click();
        assert.equal(await page.locator('#confirm input[type="checkbox"]').count(), 0);
        assert.ok(await page.locator("#confirm-replay").isDisabled());
        await page.locator("#typed").fill(" 确认重放 ");
        await page.locator("#confirm-replay").click();
        const writes = (await state()).intents;
        assert.deepEqual(writes, [
          {
            method: "POST",
            path: `/platform/collection/tasks/${data.original.ids.dead}/replay`,
            body: { reason: "来源依赖已恢复，重新核对采集结果" },
          },
        ]);
        assert.equal(await page.evaluate(() => window.COLLECTION_C.replay()), false);
        await complete(outcome);
        if (outcome === "success") {
          assert.equal((await state()).detail.task.id, data.original.ids.replay);
          assert.match(page.url(), new RegExp(data.original.ids.replay));
          await complete("error");
          assert.match((await state()).writeNotice, /已创建/);
          assert.match((await state()).readNotice, /重读失败/);
        } else {
          assert.equal((await state()).reason, "来源依赖已恢复，重新核对采集结果");
          if (outcome === "unknown") assert.ok(await page.locator("#preview-replay").isDisabled());
        }
      }
      await scene("confirm-typed");
      await page.locator("#confirm-replay").click();
      const old = (await state()).pending.id;
      await page.evaluate(
        (id) => window.COLLECTION_C.requestDetail(id, { url: false }),
        data.original.ids.task,
      );
      await complete();
      assert.equal(await complete("success", old), false);
      assert.equal((await state()).detail.task.id, data.original.ids.task);
      await scene("default");
      await page.locator("#refresh").click();
      assert.equal(await page.evaluate(() => window.COLLECTION_C.read()), false);
      assert.ok(await page.locator("#status").isDisabled());
      await complete("error");
      assert.deepEqual((await state()).items, data.original.tasks);
      if (width === 390) await page.locator("#scope summary").click();
      await page.locator("#status").selectOption("dead_letter");
      await complete();
      assert.equal((await state()).items.length, 1);
      assert.equal((await state()).loadedStatus, "dead_letter");
      for (const [status, to] of [
        ["blocked_login", "/platform-admin/credentials"],
        ["blocked_robots", "/platform-admin/providers/sources"],
        ["failed_terminal", "/platform-admin/collection/overview"],
      ]) {
        await scene("state-" + status);
        await page.locator(".recovery a").click();
        assert.deepEqual((await state()).intents.at(-1), { method: "NAVIGATE", path: to });
      }
      await scene("detail-rss");
      assert.ok((await page.locator("#detail").innerText()).includes("空成功"));
      await page.locator("#robots-0 summary").click();
      assert.ok(await page.locator("#robots-0 small").isVisible());
      if (width === 1440) {
        await scene("columns");
        for (let i = 0; i < 6; i++) await page.locator(`[data-column="${i}"]`).uncheck();
        assert.ok(await page.locator('[data-column="6"]').isDisabled());
        await page.locator("#freeze").click();
        assert.equal((await state()).freeze, false);
        await page.locator("#density").selectOption("compact");
        assert.equal((await state()).density, "compact");
      }
      for (const w of [320, 759, 760, 761, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        for (const key of ["default", "long-content", "confirm-typed"]) {
          await scene(key);
          await layout(page, w + " " + key);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await scene("detail");
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      await layout(page, "CSS zoom2");
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push(
        `${width}: ${Object.keys(scenes).length} scenes, three modal variants including nested confirmation, original metrics/filter/page fixtures, exact reason POST, late response rejection, browser back/forward, preserved read/write outcomes, three recovery routes, columns/freeze/density, six breakpoints and CSS zoom2. Static prototype, not VueRouter/auth/SQL/worker/full theme/lifecycle proof.`,
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
          proposal: "COLLECTION-TASKS-C-r1",
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
    const f = path.join(root, "README.md"),
      text = await readFile(f, "utf8");
    const gallery =
      `正式 PNG：${screenshots.length} 张。\n\n| 场景 | 桌面 1440 | 移动 390 |\n| --- | --- | --- |\n` +
      [...new Set(screenshots.map((s) => s.scene))]
        .map((key) => {
          const group = screenshots.filter((s) => s.scene === key);
          const links = (w) =>
            group
              .filter((s) => s.width === w)
              .map((s) => `[${s.part ? "连续 " + s.part : "主图"}](${s.file})`)
              .join(" · ");
          return `| ${group[0].label} | ${links(1440)} | ${links(390)} |`;
        })
        .join("\n");
    await writeFile(
      f,
      text.replace(
        /<!-- GALLERY:START -->[\s\S]*<!-- GALLERY:END -->/,
        `<!-- GALLERY:START -->\n\n${gallery}\n\n<!-- GALLERY:END -->`,
      ),
    );
  } else
    assert.deepEqual(
      prior.screenshots.map((s) => s.file),
      expected,
    );
  assert.deepEqual(
    (await readdir(root)).sort(),
    [
      ...expected,
      "index.html",
      "collection.css",
      "collection.js",
      "data.js",
      "source-logic.js",
      "README.md",
      "evidence.json",
    ].sort(),
  );
  const links = [
    ...(await readFile(path.join(root, "README.md"), "utf8")).matchAll(/\]\(([^)]+)\)/g),
  ];
  for (const [, link] of links) await readFile(path.resolve(root, link));
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      errors,
      httpRequests: requests.length,
      contractSources: contracts.length,
      readmeLinks: links.length,
    }),
  );
} finally {
  await browser.close();
}
