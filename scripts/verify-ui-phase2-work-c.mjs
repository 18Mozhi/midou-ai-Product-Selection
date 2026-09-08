import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildWorkDesignData } from "./lib/ui-phase2-work-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/work-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture"),
  data = await buildWorkDesignData(repo);
const files = [
  ...["index.html", "work.js", "work.css", "data.js"].map((f) => `${relative}/${f}`),
  "apps/web/src/components/TaskWorkspace.vue",
  "apps/web/src/components/TaskListPanel.vue",
  "apps/web/src/components/TaskBatchActions.vue",
  "apps/api/src/business-task-service.ts",
  "apps/api/src/business-task-routes.ts",
  "apps/api/src/mysql-business-task-repository.ts",
  "tests/e2e/helpers/business-tasks.ts",
  "scripts/lib/ui-phase2-work-design-data.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "scripts/verify-ui-phase2-work-c.mjs",
];
const texts = Object.fromEntries(
    await Promise.all(
      files.map(async (f) => [
        f,
        (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n"),
      ]),
    ),
  ),
  sourceHashes = Object.fromEntries(Object.entries(texts).map(([f, v]) => [f, hash(v)]));
const box = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.WORK_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const item of previous.screenshots) {
    assert.match(item.file, /^[A-Za-z0-9_.-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, item.file))), item.sha256);
  }
}
const screenshots = [],
  expected = [],
  reports = [];
async function metrics(page) {
  await checkPrototypeMetrics(page);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "page overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length, "duplicate id");
  const overflow = await page
    .locator("dialog[open]")
    .evaluateAll((ns) => ns.some((n) => n.scrollWidth > n.clientWidth + 1));
  assert.equal(overflow, false, "modal overflow");
  const smallTargets = await page.locator(".check,.row-actions summary").evaluateAll(
    (nodes) =>
      nodes.filter((n) => {
        const r = n.getBoundingClientRect();
        return r.width < 43.9 || r.height < 43.9;
      }).length,
  );
  assert.equal(smallTargets, 0, "checkbox and menu touch targets");
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
      const start = async (query = "") => {
        const u = pathToFileURL(path.join(root, "index.html"));
        u.search = query;
        await page.goto(u.href);
        await page.waitForFunction(() => window.WORK_C?.state());
      };
      const scene = async (name) => {
        await page.evaluate((v) => window.WORK_C.scene(v), name);
        await page.evaluate(() => document.fonts.ready);
      };
      const state = () => page.evaluate(() => window.WORK_C.state());
      await start();
      const names = await page.evaluate(() => Object.keys(window.WORK_C.scenes));
      assert.equal(names.length, 33);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: !(await page.locator("dialog[open]").count()),
            animations: "disabled",
          });
          screenshots.push({ file, width, scene: name, sha256: hash(bytes) });
        }
      }
      await scene("normal");
      assert.equal(await page.locator(".task").count(), 2);
      assert.equal(await page.locator("#status-all span").last().innerText(), "7");
      assert.match(await page.locator(".fixture-note").innerText(), /不是一致快照/);
      assert.equal(await page.getByRole("button", { name: "导出任务", exact: true }).count(), 0);
      await page.locator("#select-page").check();
      assert.equal((await state()).selected.length, 2);
      await page.locator("#status-todo").click();
      assert.equal((await state()).selected.length, 0);
      assert.equal(await page.locator(".task").count(), 1);
      await page.locator("#filter-toggle").click();
      await page.locator("#search").fill("  证据  ");
      await page.locator("#sort").selectOption("due_asc");
      assert.equal((await state()).query, "证据");
      assert.equal((await state()).sort, "due_asc");
      assert.equal(await page.locator("#status-all span").last().innerText(), "7");
      const href = await page.locator("[data-detail]").first().getAttribute("href");
      assert.equal(
        new URL(href, "https://fixture.invalid").searchParams.get("from"),
        (await state()).path,
      );
      await page.locator("[data-detail]").first().click();
      assert.match((await state()).message, /离线导航预览/);
      await page.locator("#reset").click();
      assert.equal((await state()).query, "");
      assert.equal((await state()).status, "");
      await page.locator("#search").fill("未应用草稿");
      await page.locator("#select-page").check();
      assert.equal(await page.locator("#search").inputValue(), "未应用草稿");
      assert.equal((await state()).query, "");
      await scene("pagination");
      await page.locator("#select-page").check();
      assert.equal((await state()).selected.length, 10);
      await page.locator("#next").click();
      assert.equal((await state()).page, 2);
      assert.equal((await state()).selected.length, 0);
      assert.equal(await page.locator(".task").count(), 1);
      await page.locator("#previous").click();
      assert.equal(await page.locator(".task").count(), 10);
      for (const name of ["readonly", "create_only", "no_assign"]) {
        await scene(name);
        if (name !== "no_assign") {
          assert.equal(await page.locator("[data-select],[data-batch],[data-remove]").count(), 0);
          assert.equal(await page.locator("#create-task").count(), name === "create_only" ? 1 : 0);
        } else assert.equal(await page.locator("#batch-transfer").count(), 0);
      }
      for (const action of Object.keys(data.contracts)) {
        await scene(action);
        const original = (await state()).rows;
        assert.equal(await page.locator("dialog[open]").count(), 1);
        assert.equal(
          await page.locator("#dialog-close").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.locator("#confirm").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#dialog-close").evaluate((n) => n === document.activeElement),
          true,
        );
        if (action !== "resume") {
          await page.locator("#confirm").click();
          assert.equal((await state()).intent.length, 0);
        }
        if (action === "create") {
          await page.locator("#title").fill("復");
          await page.locator("#title").fill("复核供应商交期");
          await page.locator("#description").fill("核对原始证据");
        } else if (action !== "resume") await page.locator("#reason").fill(" 核验后调整 ");
        if (action === "delay") await page.locator("#due_at").fill("2026-08-10T18:00");
        if (action === "transfer")
          await page.locator("#assignee_id").selectOption(data.members[0].id);
        await page.locator("#confirm").click();
        const result = await state(),
          expectedRequest = structuredClone(data.contracts[action]);
        if (action === "resume") expectedRequest.url = `/tasks/${result.rows[0].id}/actions`;
        assert.deepEqual(result.intent[0], expectedRequest, `source body ${action}`);
        assert.deepEqual(result.rows, original, "no fake write success");
        assert.match(await page.locator("#dialog-result").innerText(), /未发送API/);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement?.tagName), "BUTTON");
      }
      for (const action of Object.keys(data.contracts)) {
        await scene(action);
        await page.evaluate(() => {
          const m = window.WORK_C.state().modal;
          window.WORK_C.open(
            m.action,
            m.action === "delete" ? m.targets[0] : null,
            document.activeElement.id,
            "error",
          );
        });
        if (action === "create") {
          await page.locator("#title").fill("  ");
          await page.locator("#confirm").click();
          assert.equal((await state()).intent.length, 0);
          await page.locator("#title").fill("保留创建输入");
        } else if (action !== "resume") await page.locator("#reason").fill("保留操作原因");
        if (action === "delay") await page.locator("#due_at").fill("2026-08-11T18:00");
        if (action === "transfer")
          await page.locator("#assignee_id").selectOption(data.members[0].id);
        await page.locator("#confirm").click();
        assert.match(await page.locator("#dialog-result").innerText(), /输入已保留/);
        if (action !== "resume")
          assert.match(
            await page.locator(action === "create" ? "#title" : "#reason").inputValue(),
            /保留/,
          );
      }
      await scene("no_eligible");
      assert.equal(await page.locator("#confirm").isDisabled(), true);
      await scene("transfer_error");
      assert.equal(await page.locator("#confirm").isDisabled(), true);
      assert.equal(
        await page.locator("#confirm").evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(233, 237, 243)",
      );
      assert.equal(await page.locator("#assignee_id option").count(), 1);
      await scene("create_busy");
      assert.equal(await page.locator("#confirm").isDisabled(), true);
      assert.equal(await page.locator("#title").getAttribute("readonly"), "");
      await page.keyboard.press("Escape");
      assert.equal((await state()).intent.length, 0);
      await start(
        "status=todo&query=证据&sort=due_asc&context=review&create=1&title=快捷草稿&description=保留说明",
      );
      assert.equal(await page.locator("#title").inputValue(), "快捷草稿");
      await page.keyboard.press("Escape");
      const quick = await state();
      assert.equal(quick.query, "证据");
      assert.equal(quick.status, "todo");
      assert.equal(quick.extra.context, "review");
      assert.equal(quick.extra.create, undefined);
      await page.locator("#create-task").click();
      assert.equal(await page.locator("#title").inputValue(), "快捷草稿");
      await scene("error");
      await page.locator("#retry-read").click();
      assert.equal((await state()).read, "error");
      assert.match((await state()).message, /尚无新的读取结果/);
      await scene("normal");
      await scene("search");
      const secondary = page.locator("#reset");
      await secondary.hover();
      assert.equal(
        await secondary.evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(238, 243, 252)",
      );
      await page.mouse.down();
      assert.equal(
        await secondary.evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(220, 231, 251)",
      );
      await page.mouse.up();
      await scene("normal");
      const button = page.locator("#create-task");
      await button.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      assert.match(await button.evaluate((n) => getComputedStyle(n).outlineStyle), /solid/);
      if (width === 390) {
        for (const viewport of [
          { width: 320, height: 844 },
          { width: 768, height: 1000 },
          { width: 780, height: 1000 },
          { width: 781, height: 1000 },
          { width: 1024, height: 1000 },
          { width: 390, height: 667 },
        ]) {
          await page.setViewportSize(viewport);
          for (const name of ["normal", "selection", "create", "transfer_error"]) {
            await scene(name);
            await metrics(page);
          }
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
        scenes: names.length,
        sourceBodies: 7,
        errorRetainsInput: 7,
        httpRequests: 0,
        storageEntries: 0,
        consoleErrors: 0,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
assert.equal(expected.length, 66);
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
    previous.screenshots.map((v) => v.file),
    expected,
  );
console.log(JSON.stringify({ passed: true, capture, screenshots: expected.length, reports }));
