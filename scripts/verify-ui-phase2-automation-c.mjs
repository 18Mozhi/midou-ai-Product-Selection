import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildAutomationDesignData } from "./lib/ui-phase2-automation-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/automation-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture"),
  data = await buildAutomationDesignData(repo),
  files = [
    ...["index.html", "automation.css", "automation.js", "data.js"].map((f) => `${relative}/${f}`),
    "apps/web/src/components/AutomationRuleCenter.vue",
    "apps/web/src/use-modal-dialog.ts",
    "apps/api/src/automation-service.ts",
    "apps/api/src/automation-routes.ts",
    "apps/api/src/mysql-automation-repository.ts",
    "apps/worker/src/automation-worker.ts",
    "tests/e2e/m05-05-automation-rules.spec.ts",
    "scripts/lib/ui-phase2-automation-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-automation-c.mjs",
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
assert.deepEqual(JSON.parse(JSON.stringify(box.window.AUTOMATION_C_DATA)), data);
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
  assert.equal(
    await page
      .locator("dialog[open]")
      .evaluateAll((nodes) => nodes.some((n) => n.scrollWidth > n.clientWidth + 1)),
    false,
    "modal overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length, "duplicate IDs");
  const links = await page.locator("a,summary").evaluateAll((nodes) =>
    nodes
      .filter((n) => n.getClientRects().length)
      .filter((n) => {
        const r = n.getBoundingClientRect();
        return r.height < 43.9 || r.width < 43.9;
      })
      .map((n) => n.textContent),
  );
  assert.deepEqual(links, [], "link/disclosure targets");
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
          const url = pathToFileURL(path.join(root, "index.html"));
          url.search = query;
          await page.goto(url.href);
          await page.waitForFunction(() => window.AUTOMATION_C?.state());
        },
        scene = async (name) => {
          await page.evaluate((v) => window.AUTOMATION_C.scene(v), name);
          await page.evaluate(() => document.fonts.ready);
        },
        state = () => page.evaluate(() => window.AUTOMATION_C.state());
      await start();
      const names = await page.evaluate(() => Object.keys(window.AUTOMATION_C.scenes));
      assert.equal(names.length, 52);
      async function shot(name, section = "initial") {
        const file = `${width}-${name}${section === "initial" ? "" : `-${section}`}.png`;
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
            section,
            sha256: hash(bytes),
          });
        }
      }
      for (const name of names) {
        await scene(name);
        await metrics(page);
        await shot(name);
      }
      for (const name of [
        "create",
        "template_competitor",
        "edit",
        "preview_samples",
        "create_busy",
        "long_history",
      ]) {
        await scene(name);
        await page.locator("dialog[open]").evaluate((n) => {
          n.scrollTop = n.scrollHeight;
        });
        await metrics(page);
        await shot(name, "bottom");
      }
      for (const name of ["create", "template_competitor", "edit"]) {
        await scene(name);
        await page.locator("#action-section").evaluate((n) => n.scrollIntoView({ block: "start" }));
        await metrics(page);
        await shot(name, "actions");
      }
      await scene("normal");
      assert.equal(await page.locator(".rule").count(), 1);
      assert.match(await page.locator(".rule-run").innerText(), /最终失败/);
      assert.doesNotMatch(await page.locator(".rule-run").innerText(), /将按策略重试/);
      for (const name of ["删除", "立即运行", "复制规则", "批量暂停"])
        assert.equal(await page.getByRole("button", { name, exact: true }).count(), 0);
      await page.locator("[data-detail]").click();
      assert.match((await state()).path, /rule=/);
      assert.equal((await state()).selected.executions[0].status, "succeeded");
      assert.equal(
        await page.locator("#execution-close").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page
          .locator("#execution-tech-0 summary")
          .evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#execution-close").evaluate((n) => n === document.activeElement),
        true,
      );
      const notificationLink = await page.locator("[data-detail-link]").getAttribute("href");
      assert.equal(
        new URL(notificationLink, "https://fixture.invalid").searchParams.get("from"),
        "/automations",
      );
      await page.locator("[data-detail-link]").click();
      assert.match(await page.locator("#detail-result").innerText(), /离线导航预览/);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(
        await page.locator("[data-detail]").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.goBack();
      assert.equal(await page.locator("#execution").getAttribute("open"), "");
      await page.goForward();
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await scene("execution_suppressed");
      assert.match(await page.locator(".execution-detail").innerText(), /未产生动作/);
      assert.equal(await page.getByRole("link", { name: "查看关联人工任务" }).count(), 0);
      await scene("execution_task");
      assert.equal(await page.getByRole("link", { name: "查看关联人工任务" }).count(), 1);
      await scene("execution_unknown");
      assert.match(await page.locator(".execution-meta").innerText(), /状态待确认/);
      await scene("long_history");
      assert.equal(await page.locator(".execution-item").count(), 100);
      assert.equal(await page.getByRole("button", { name: "下一页", exact: true }).count(), 0);
      await scene("create");
      assert.equal(
        await page.locator("#editor-close").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(await page.locator("#save").evaluate((n) => n === document.activeElement), true);
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#editor-close").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#save").click();
      assert.equal((await state()).intents.length, 0);
      assert.equal(await page.locator("#name").getAttribute("aria-invalid"), "true");
      assert.equal(await page.locator("#name").evaluate((n) => n === document.activeElement), true);
      for (const [index, label] of data.templates.entries()) {
        await page.locator(`[data-template="${index}"]`).click();
        assert.equal((await state()).form.name, label.name);
        assert.equal(await page.locator("#owner_id").inputValue(), "");
      }
      await page.locator('[data-template="1"]').click();
      await page.locator("#owner_id").selectOption(data.members[0].id);
      await page.locator("#action_assignee_id").selectOption(data.members[0].id);
      await page.locator("#trigger_event_type").selectOption("task.created");
      assert.equal((await state()).form.action_type, "notify_owner");
      assert.equal((await state()).form.action_assignee_id, "");
      assert.equal(await page.locator("#action_assignee_id").count(), 0);
      assert.equal(await page.locator('#action_type option[value="create_task"]').count(), 0);
      await page.keyboard.press("Escape");
      await page.locator("#create-rule").click();
      assert.equal(
        await page.locator("#name").inputValue(),
        "",
        "new creator resets previous form",
      );
      for (const [key, name] of [
        ["preview", "template_overdue"],
        ["create", "template_overdue"],
        ["edit", "edit"],
        ["pause", "normal"],
        ["resume", "paused"],
      ]) {
        await scene(name);
        const before = (await state()).rows;
        if (key === "preview" || key === "create")
          await page.locator("#owner_id").selectOption(data.members[0].id);
        if (key === "edit") await page.locator("#reason").fill("核验后调整频率");
        await page
          .locator(
            key === "preview"
              ? "#preview"
              : key === "create" || key === "edit"
                ? "#save"
                : "[data-status]",
          )
          .click();
        assert.deepEqual((await state()).intents.at(-1), data.contracts[key], `source body ${key}`);
        assert.deepEqual((await state()).rows, before, "no fabricated write facts");
      }
      for (const name of ["members_empty", "members_error"]) {
        await scene(name);
        assert.equal(await page.locator("#owner_id option").count(), 1);
        await page.locator("#preview").click();
        assert.equal((await state()).intents.length, 0);
      }
      await scene("preview");
      assert.equal((await state()).preview.matched_30d, 17);
      assert.equal((await state()).preview.samples.length, 0);
      assert.match(await page.locator(".preview-empty").innerText(), /不等于历史匹配数为零/);
      await page.locator("#rate_limit_count").fill("1");
      assert.equal((await state()).preview, null);
      assert.equal((await state()).form.rate_limit_count, 1);
      await scene("preview_samples");
      const sample = page.locator("[data-preview-link]");
      assert.match(await page.locator(".sample").innerText(), /2026\/6\/1/);
      assert.match(await page.locator(".preview-box").innerText(), /没有最近30天限制/);
      await sample.click();
      assert.match(await page.locator("#editor-result").innerText(), /离线导航预览/);
      await scene("preview_task");
      assert.equal((await state()).preview.projected_task_count, 3);
      assert.equal((await state()).preview.projected_notification_count, 0);
      await scene("preview_empty");
      assert.equal((await state()).preview.matched_30d, 0);
      for (const outcome of ["success", "error"]) {
        await scene("preview_busy");
        const old = (await state()).token,
          count = (await state()).intents.length;
        assert.equal(await page.locator("#preview").isDisabled(), true);
        await page.locator("#name").fill("修改后的草稿");
        assert.equal(await page.locator("#preview").isEnabled(), true);
        const accepted = await page.evaluate(
          ({ token, response, fail }) => window.AUTOMATION_C.completePreview(token, response, fail),
          { token: old, response: data.fixturePreview, fail: outcome === "error" },
        );
        assert.equal(accepted, false);
        assert.equal((await state()).preview, null);
        assert.equal((await state()).form.name, "修改后的草稿");
        assert.equal((await state()).intents.length, count);
      }
      await scene("preview_busy");
      const oldToken = (await state()).token;
      await page.keyboard.press("Escape");
      await page.locator("#create-rule").click();
      assert.equal(
        await page.evaluate(
          ({ token, response }) => window.AUTOMATION_C.completePreview(token, response),
          { token: oldToken, response: data.fixturePreview },
        ),
        false,
      );
      assert.equal((await state()).preview, null);
      for (const name of ["create_error", "edit_conflict"]) {
        await scene(name);
        assert.match(await page.locator("#editor-result").innerText(), /失败/);
        const resultBox = await page.locator("#editor-result").boundingBox();
        assert.ok(
          resultBox.y + resultBox.height < (width === 390 ? 680 : 900),
          "modal error visible without scrolling",
        );
        assert.ok((await state()).form.name.length);
        if (name === "edit_conflict")
          assert.equal(await page.locator("#reason").inputValue(), "核验后调整频率");
      }
      for (const name of ["create_busy", "edit_busy"]) {
        await scene(name);
        const before = (await state()).intents.length;
        assert.equal(await page.locator("#save").isDisabled(), true);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal((await state()).busy, true);
        assert.equal((await state()).intents.length, before);
      }
      await start(`context=review&rule=${data.list[0].id}&action=edit`);
      assert.equal(await page.locator("#name").inputValue(), data.list[0].name);
      assert.equal(await page.locator("#reason").inputValue(), "");
      await page.keyboard.press("Escape");
      assert.equal((await state()).path, "/automations?context=review");
      await start("rule=missing&context=review");
      assert.equal((await state()).path, "/automations?context=review");
      assert.match((await state()).message, /不存在或不在当前工作区/);
      await scene("error");
      await page.locator("#retry").click();
      assert.equal((await state()).read, "error");
      assert.match((await state()).message, /未取得新响应/);
      await scene("normal");
      const button = page.locator("[data-edit]");
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
            "template_competitor",
            "edit_conflict",
            "preview_samples",
            "long_history",
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
        sourceBodies: 5,
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
assert.equal(expected.length, 122);
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
