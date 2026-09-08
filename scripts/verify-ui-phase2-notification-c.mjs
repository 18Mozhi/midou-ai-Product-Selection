import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildNotificationDesignData } from "./lib/ui-phase2-notification-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/notification-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture"),
  data = await buildNotificationDesignData(repo),
  files = [
    ...["index.html", "notification.js", "notification.css", "data.js"].map(
      (f) => `${relative}/${f}`,
    ),
    "apps/web/src/components/NotificationCenter.vue",
    "apps/web/src/use-modal-dialog.ts",
    "apps/web/src/realtime-client-metrics.ts",
    "apps/api/src/notification-service.ts",
    "apps/api/src/notification-routes.ts",
    "apps/api/src/mysql-notification-repository.ts",
    "tests/e2e/m05-03-notifications.spec.ts",
    "scripts/lib/ui-phase2-notification-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-notification-c.mjs",
  ],
  texts = Object.fromEntries(
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
assert.deepEqual(JSON.parse(JSON.stringify(box.window.NOTIFICATION_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const image of previous.screenshots) {
    assert.match(image.file, /^[A-Za-z0-9_.-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, image.file))), image.sha256);
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
  assert.equal(
    await page
      .locator("dialog[open]")
      .evaluateAll((nodes) => nodes.some((n) => n.scrollWidth > n.clientWidth + 1)),
    false,
    "modal overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length);
  const targets = await page
    .locator(".check,.preference-row,.source,summary")
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => n.getClientRects().length)
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.width < 43.9 || r.height < 43.9;
        })
        .map((n) => n.textContent),
    );
  assert.deepEqual(targets, [], "label, link and disclosure touch target");
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
          await page.waitForFunction(() => window.NOTIFICATION_C?.state());
        },
        scene = async (name) => {
          await page.evaluate((v) => window.NOTIFICATION_C.scene(v), name);
          await page.evaluate(() => document.fonts.ready);
        },
        state = () => page.evaluate(() => window.NOTIFICATION_C.state());
      await start();
      const names = await page.evaluate(() => Object.keys(window.NOTIFICATION_C.scenes));
      assert.equal(names.length, 45);
      async function shot(name, bottom = false) {
        const file = `${width}-${name}${bottom ? "-bottom" : ""}.png`;
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
            scene: name,
            section: bottom ? "bottom" : "initial",
            sha256: hash(bytes),
          });
        }
      }
      for (const name of names) {
        await scene(name);
        await metrics(page);
        await shot(name);
      }
      for (const name of ["detail_long", "read_error", "detail_technical", "preferences_busy"]) {
        await scene(name);
        await page.locator("dialog[open]").evaluate((n) => {
          n.scrollTop = n.scrollHeight;
        });
        await metrics(page);
        await shot(name, true);
      }
      await scene("normal");
      if (width === 390) {
        const firstTitle = await page.locator(".row-copy strong").boundingBox();
        assert.ok(
          firstTitle.y + firstTitle.height < 844,
          "first message title in mobile first fold",
        );
      }
      assert.equal(await page.locator(".notification-row").count(), 1);
      assert.equal(await page.locator("#category-all b").innerText(), "3");
      assert.equal(await page.locator("#unread-total").innerText(), "0");
      assert.match(await page.locator(".list-heading").innerText(), /1 组/);
      assert.match(
        await page.locator(".workspace > .fixture-note").innerText(),
        /分页meta为100而Vue请求20/,
      );
      assert.equal(await page.getByRole("button", { name: "标记未读", exact: true }).count(), 0);
      await page.locator(".notification-row").click();
      assert.equal((await state()).intents.length, 0, "already read does not send auto-read");
      assert.equal(
        await page.locator("#detail-close").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.locator("#technical summary").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#detail-close").evaluate((n) => n === document.activeElement),
        true,
      );
      assert.equal(await page.locator("#technical").getAttribute("open"), null);
      assert.equal(await page.locator(".message-content article").innerText(), data.displayBody);
      const href = await page.locator("#source-link").getAttribute("href");
      assert.equal(
        new URL(href, "https://fixture.invalid").searchParams.get("from"),
        (await state()).path,
      );
      await page.locator("#source-link").click();
      assert.match((await state()).detailMessage, /离线导航预览/);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(
        await page.evaluate(() => document.activeElement.classList.contains("notification-row")),
        true,
      );
      await page.locator("#category-task").click();
      assert.equal(await page.locator(".notification-row").count(), 0);
      assert.match((await state()).path, /category=task/);
      assert.equal(await page.locator("#category-all b").innerText(), "3");
      await page.locator("#reset").click();
      await page.locator("#status-in_progress").click();
      assert.match((await state()).path, /status=in_progress/);
      await page.locator("#unread-filter").check();
      assert.match((await state()).path, /unread=1/);
      await page.reload();
      await page.waitForFunction(() => window.NOTIFICATION_C);
      assert.equal((await state()).status, "in_progress");
      assert.equal((await state()).unread, true);
      await scene("pagination");
      await page.locator("#next").click();
      assert.equal(await page.locator(".notification-row").count(), 1);
      assert.equal((await state()).page, 2);
      await page.locator("#category-approval").click();
      assert.equal((await state()).page, 1);
      assert.equal(await page.locator(".notification-row").count(), 20);
      for (const [action, name] of [
        ["start", "detail"],
        ["close", "detail_progress"],
        ["reopen", "detail_closed"],
      ]) {
        await scene(name);
        const before = (await state()).selected;
        await page.locator(`#action-${action}`).click();
        assert.deepEqual((await state()).intents.at(-1), data.contracts[action]);
        assert.deepEqual((await state()).selected, before);
        assert.match(await page.locator("#detail-result").innerText(), /未发送API/);
        await page.evaluate(() => window.NOTIFICATION_C.setMode("error"));
        await page.locator(`#action-${action}`).click();
        assert.match(await page.locator("#detail-result").innerText(), /失败/);
        assert.deepEqual((await state()).selected, before);
        await page.evaluate(() => window.NOTIFICATION_C.setMode("busy"));
        await page.locator(`#action-${action}`).click();
        const count = (await state()).intents.length;
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#detail").getAttribute("open"), "");
        assert.equal((await state()).intents.length, count);
        assert.equal(await page.locator("#detail-close").isDisabled(), true);
      }
      await scene("detail_unread");
      assert.deepEqual((await state()).intents[0], data.contracts.read);
      assert.equal((await state()).selected.read_at, null);
      assert.equal((await state()).summary.unread, 1);
      await scene("read_busy");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#detail").getAttribute("open"), "");
      await scene("read_error");
      assert.match(await page.locator("#detail-result").innerText(), /阅读状态仍为未读/);
      assert.equal((await state()).selected.read_at, null);
      await scene("read_ack");
      assert.equal((await state()).selected.version, 2);
      assert.equal((await state()).selected.workflow_status, "open");
      for (const name of ["detail_missing", "detail_unknown"]) {
        await scene(name);
        assert.equal(await page.locator("#source-link").count(), 0);
      }
      assert.match(await page.locator(".message-content .meta").innerText(), /待确认/);
      assert.match(await page.locator(".workflow-panel").innerText(), /系统记录/);
      for (const mode of ["intent", "error", "busy"]) {
        await scene("unread");
        await page.locator("#category-approval").click();
        await page.evaluate((m) => window.NOTIFICATION_C.setMode(m), mode);
        await page.locator("#all-read").click();
        assert.deepEqual((await state()).intents[0], data.contracts.markAll);
        assert.equal((await state()).summary.unread, 1);
      }
      await scene("normal");
      await page.locator("#preferences-open").click();
      assert.equal(await page.locator("#email_enabled").isDisabled(), true);
      await page.locator("#task_enabled").uncheck();
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await page.locator("#preferences-open").click();
      assert.equal(await page.locator("#task_enabled").isChecked(), false);
      await page.locator("#task_enabled").check();
      await page.locator("#preferences-save").click();
      assert.deepEqual((await state()).intents[0], data.contracts.preferences);
      assert.match(await page.locator("#preference-result").innerText(), /未发送API/);
      assert.equal(await page.locator("#preferences").getAttribute("open"), "");
      await page.locator("#task_enabled").uncheck();
      await page.evaluate(() => window.NOTIFICATION_C.setMode("error"));
      await page.locator("#preferences-save").click();
      assert.equal(await page.locator("#task_enabled").isChecked(), false);
      assert.match(await page.locator("#preference-result").innerText(), /保留输入/);
      await scene("preferences_busy");
      assert.equal(await page.locator("#preferences-save").isDisabled(), true);
      assert.equal(await page.locator("#preferences-cancel").isEnabled(), true);
      const pendingCount = (await state()).intents.length;
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal((await state()).pending, true);
      assert.equal((await state()).intents.length, pendingCount);
      await start(
        `category=approval&status=open&context=review&notification_id=${data.list.data[0].id}`,
      );
      assert.match(page.url(), /notification=/);
      assert.doesNotMatch(page.url(), /notification_id=/);
      await page.keyboard.press("Escape");
      assert.match((await state()).path, /category=approval/);
      assert.match((await state()).path, /context=review/);
      assert.doesNotMatch((await state()).path, /notification=/);
      await scene("error");
      await page.locator("#retry-read").click();
      assert.equal((await state()).read, "error");
      assert.match((await state()).message, /尚无新响应/);
      await scene("loading");
      assert.equal(await page.locator("#unread-total").innerText(), "—");
      await scene("normal");
      const button = page.locator("#preferences-open");
      await button.hover();
      assert.equal(
        await button.evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(238, 243, 252)",
      );
      await page.mouse.down();
      assert.equal(
        await button.evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(220, 231, 251)",
      );
      await page.mouse.up();
      await page.keyboard.press("Escape");
      await button.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      assert.equal(await button.evaluate((n) => getComputedStyle(n).outlineStyle), "solid");
      if (width === 390)
        for (const viewport of [
          { width: 320, height: 844 },
          { width: 768, height: 1000 },
          { width: 780, height: 1000 },
          { width: 781, height: 1000 },
          { width: 1024, height: 1000 },
          { width: 390, height: 667 },
        ]) {
          await page.setViewportSize(viewport);
          for (const name of [
            "normal",
            "detail_long",
            "read_error",
            "preferences_busy",
            "pagination",
          ]) {
            await scene(name);
            await metrics(page);
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
        sourceWriteBodies: 6,
        httpRequests: 0,
        consoleErrors: 0,
        storageEntries: 0,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
assert.equal(expected.length, 98);
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
