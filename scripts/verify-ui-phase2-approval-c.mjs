import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildApprovalDesignData } from "./lib/ui-phase2-approval-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/approval-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture"),
  data = await buildApprovalDesignData(repo);
const sources = [
  ...["index.html", "approval.js", "approval.css", "data.js"].map((f) => `${relative}/${f}`),
  "apps/web/src/components/ApprovalWorkspace.vue",
  "apps/web/src/components/ApprovalQueuePanel.vue",
  "apps/web/src/components/approval-workspace-types.ts",
  "apps/api/src/approval-service.ts",
  "apps/api/src/approval-routes.ts",
  "apps/api/src/mysql-approval-repository.ts",
  "tests/e2e/m05-02-approval-workflow.spec.ts",
  "scripts/lib/ui-phase2-approval-design-data.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "scripts/verify-ui-phase2-approval-c.mjs",
];
const texts = Object.fromEntries(
    await Promise.all(
      sources.map(async (f) => [
        f,
        (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n"),
      ]),
    ),
  ),
  sourceHashes = Object.fromEntries(Object.entries(texts).map(([f, v]) => [f, hash(v)]));
const box = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.APPROVAL_C_DATA)), data);
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
async function metrics(page) {
  await checkPrototypeMetrics(page);
  const result = await page.evaluate(() => {
    const dialogs = [...document.querySelectorAll("dialog[open]")],
      active = dialogs.at(-1) || document.body;
    const controls = [...active.querySelectorAll("button,input,select,textarea")]
      .filter((n) => n.getClientRects().length)
      .map((n) => ({
        id: n.id,
        width: n.getBoundingClientRect().width,
        height: n.getBoundingClientRect().height,
        font: parseFloat(getComputedStyle(n).fontSize),
      }));
    return {
      overflow:
        document.documentElement.scrollWidth > innerWidth + 1 ||
        dialogs.some((d) => d.scrollWidth > d.clientWidth + 1),
      violations: controls.filter((r) => r.width < 43.9 || r.height < 43.9 || r.font < 16),
      ids: [...document.querySelectorAll("[id]")].map((n) => n.id),
    };
  });
  assert.equal(result.overflow, false, "horizontal overflow");
  assert.deepEqual(result.violations, [], "top dialog controls");
  assert.equal(new Set(result.ids).size, result.ids.length);
}
async function shot(page, width, name) {
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
        await page.waitForFunction(() => window.APPROVAL_C?.state());
      };
      const scene = async (name) => {
          await page.evaluate((v) => window.APPROVAL_C.scene(v), name);
          await page.evaluate(() => document.fonts.ready);
        },
        state = () => page.evaluate(() => window.APPROVAL_C.state());
      await start();
      const names = await page.evaluate(() => Object.keys(window.APPROVAL_C.scenes));
      assert.equal(names.length, 43);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        await shot(page, width, name);
        if (name.startsWith("template")) {
          await page.locator("#form-dialog").evaluate((n) => (n.scrollTop = n.scrollHeight));
          await shot(page, width, `${name}-bottom`);
        }
        if (name === "basis") {
          await page.locator(".requested-decision").scrollIntoViewIfNeeded();
          await shot(page, width, "basis-bottom");
        }
      }
      await scene("normal");
      assert.equal(await page.locator("[data-open]").count(), 1);
      assert.match(await page.locator(".page-facts").innerText(), /1 项本页可审批/);
      await page.locator("#status-all").click();
      assert.equal(new URL(page.url()).searchParams.get("status"), "");
      await page.reload();
      await page.waitForFunction(() => window.APPROVAL_C);
      assert.equal((await state()).status, "", "all survives reload in proposal");
      await page.locator("#queue-requested").click();
      assert.equal((await state()).queue, "requested");
      await page.locator("[data-open]").click();
      await page.locator("#detail-title").click();
      assert.equal(await page.locator("#detail-dialog").getAttribute("open"), "");
      await page.keyboard.press("Escape");
      assert.equal(new URL(page.url()).searchParams.has("approval"), false);
      await scene("pagination");
      assert.equal(await page.locator("[data-open]").count(), 20);
      await page.locator("#next").click();
      assert.equal((await state()).page, 2);
      assert.equal(await page.locator("[data-open]").count(), 1);
      await page.locator("#previous").click();
      await scene("readonly");
      assert.doesNotMatch(await page.locator(".page-facts").innerText(), /可审批/);
      assert.equal(await page.locator("#manage,#new-request").count(), 0);
      await page.locator("[data-open]").click();
      assert.equal(await page.locator("#approve,#reject,#decision-reason").count(), 0);
      await scene("no_templates");
      assert.equal(await page.locator("#new-request").count(), 0);
      assert.equal(await page.locator("#manage").innerText(), "配置模板");
      for (const name of [
        "detail",
        "fallback",
        "task",
        "unchanged",
        "removed",
        "context_missing",
        "escalated",
      ]) {
        await scene(name);
        const snapshot = (await state()).currentDetail;
        if (name === "detail") {
          assert.deepEqual(snapshot, data.detail);
          assert.match(await page.locator("#section-compare").innerText(), /75%/);
          assert.match(await page.locator("#section-compare").innerText(), /100%/);
        }
        if (name === "fallback") {
          assert.equal(await page.locator("#section-compare .change-table").count(), 0);
          assert.match(await page.locator("#section-compare").innerText(), /提交时完整度未知/);
        }
        if (name === "task") {
          assert.match(await page.locator("#section-compare").innerText(), /不适用/);
          assert.doesNotMatch(await page.locator("#section-compare").innerText(), /100%/);
        }
        if (name === "unchanged")
          assert.match(await page.locator("#section-compare").innerText(), /保持一致/);
        if (name === "removed")
          assert.match(await page.locator("#section-compare").innerText(), /未提供/);
        if (name === "context_missing")
          assert.equal(await page.locator(".comparison strong").count(), 0);
        if (name === "escalated") {
          assert.equal(await page.locator("#approve").count(), 0);
          assert.equal(snapshot.status, "pending");
        }
      }
      for (const action of ["approve", "reject"]) {
        await scene("decision");
        const original = (await state()).currentDetail;
        assert.equal(await page.locator(`#${action}`).isDisabled(), true);
        await page.locator("#decision-reason").fill("  ");
        assert.equal(await page.locator(`#${action}`).isDisabled(), true);
        await page.locator("#decision-reason").fill(data.contracts[action].body.reason);
        await page.locator(`#${action}`).click();
        assert.deepEqual((await state()).intents[0], data.contracts[action]);
        assert.deepEqual((await state()).currentDetail, original);
        assert.match(await page.locator("#decision-message").innerText(), /未发送API/);
        await page.evaluate(() => window.APPROVAL_C.setMode("detail", "error"));
        await page.locator(`#${action}`).click();
        assert.match(await page.locator("#decision-message").innerText(), /输入已保留/);
        assert.equal(
          await page.locator("#decision-reason").inputValue(),
          data.contracts[action].body.reason,
        );
      }
      async function fillTemplate() {
        const f = data.forms.template;
        await page.locator("#template-name").fill(f.name);
        await page.locator("#resource-type").selectOption(f.resource_type);
        await page.locator("#node-name").fill(f.node_name);
        await page.locator("#sla").fill(String(f.sla_minutes));
        await page.locator("#approver").selectOption(f.approver_id);
        await page.locator("#escalation").selectOption(f.escalation_assignee_id);
      }
      await scene("template");
      await page.locator("#form-submit").click();
      assert.equal((await state()).intents.length, 0);
      await fillTemplate();
      await page.locator("#sla").fill("1.5");
      await page.locator("#form-submit").click();
      assert.equal((await state()).intents.length, 0);
      await page.locator("#sla").fill("60");
      await page.locator("#form-submit").click();
      assert.deepEqual((await state()).intents[0], data.contracts.template);
      assert.deepEqual((await state()).templates, data.templates);
      await page.keyboard.press("Escape");
      await page.locator("#manage").click();
      assert.equal(await page.locator("#template-name").inputValue(), data.forms.template.name);
      await page.evaluate(() => window.APPROVAL_C.setMode("template", "error"));
      await page.locator("#form-submit").click();
      assert.match(await page.locator("#form-message").innerText(), /输入已保留/);
      await scene("publish");
      assert.equal(await page.locator("dialog[open]").count(), 2);
      assert.equal(
        await page.locator("#publish-close").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.locator("#publish-confirm").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#publish-close").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#publish-confirm").click();
      assert.equal((await state()).intents.length, 0);
      await page.locator("#publish-reason").fill(" 核验后发布 ");
      await page.locator("#publish-confirm").click();
      assert.deepEqual((await state()).intents[0], data.contracts.publish);
      await page.evaluate(() => window.APPROVAL_C.setMode("publish", "error"));
      await page.locator("#publish-confirm").click();
      assert.match(await page.locator("#publish-message").innerText(), /输入已保留/);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 1);
      assert.equal(
        await page.locator(`[data-publish]`).evaluate((n) => n === document.activeElement),
        true,
      );
      assert.equal(await page.locator("#template-name").inputValue(), data.forms.template.name);
      await page.locator("[data-publish]").click();
      assert.equal(await page.locator("#publish-reason").inputValue(), "");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("dialog[open]").count(), 1);
      await scene("request");
      await page.locator("#form-submit").click();
      assert.deepEqual((await state()).intents[0], data.contracts.request);
      assert.equal((await state()).requestDraft.resource_type, "opportunity_decision");
      assert.equal(await page.locator("#form-dialog [name=resource_type]").count(), 0);
      await page.locator("#request-title").fill("保留发起草稿");
      await page.keyboard.press("Escape");
      await page.locator("#new-request").click();
      assert.equal(await page.locator("#request-title").inputValue(), "保留发起草稿");
      await page.evaluate(() => window.APPROVAL_C.setMode("request", "error"));
      await page.locator("#form-submit").click();
      assert.match(await page.locator("#form-message").innerText(), /输入已保留/);
      for (const name of ["template_busy", "publish_busy", "request_busy", "decision_busy"]) {
        await scene(name);
        const selector = name.startsWith("publish")
          ? "#publish-confirm"
          : name.startsWith("decision")
            ? "#approve"
            : "#form-submit";
        assert.equal(await page.locator(selector).isDisabled(), true);
        assert.equal(
          await page.locator(selector).evaluate((n) => getComputedStyle(n).backgroundColor),
          "rgb(233, 237, 243)",
        );
        await page.keyboard.press("Escape");
        assert.equal((await state()).intents.length, 0);
      }
      for (const name of ["detail", "template", "request"]) {
        await scene(name);
        const dialog = page.locator("dialog[open]").last();
        const controls = dialog.locator("button,input,select,textarea,a[href],summary");
        await controls.first().focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.evaluate(() => Boolean(document.activeElement.closest("dialog[open]"))),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(await controls.first().evaluate((n) => n === document.activeElement), true);
      }
      await start(
        `approval=${data.detail.id}&from=${encodeURIComponent("/notifications?unread=1")}&context=review`,
      );
      assert.equal(
        await page.getByRole("link", { name: "返回通知中心" }).getAttribute("href"),
        "/notifications?unread=1",
      );
      await page.keyboard.press("Escape");
      assert.equal((await state()).extra.context, "review");
      assert.equal(new URL(page.url()).searchParams.has("approval"), false);
      await start(`approval=${data.detail.id}&from=${encodeURIComponent("//evil.invalid")}`);
      assert.equal(await page.getByRole("link", { name: "返回通知中心" }).count(), 0);
      await start("approval=does-not-exist&context=review");
      assert.equal((await state()).detailState, "missing");
      assert.equal(await page.locator("[data-open]").count(), 1);
      assert.equal(new URL(page.url()).searchParams.has("approval"), false);
      await scene("error");
      await page.locator("#reload").click();
      assert.equal((await state()).read, "error");
      assert.match((await state()).message, /未请求API/);
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
          for (const name of ["normal", "detail", "template", "publish", "request"]) {
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
assert.equal(expected.length, 94);
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
