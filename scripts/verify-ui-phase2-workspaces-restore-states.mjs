import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

// Reuse the approved composition's renderer without changing its bytes or shared Vue rules.
const base = "design-plans/ui-phase-2-2026-09-07/design";
const input = `${base}/workspaces-controls-direction-c`;
const output = `${base}/workspaces-restore-states-direction-c`;
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
assert.ok(!(capture && smoke));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const approvedHash = "640c22bdbccc5a6f7fc24b427487f6d0e25f23418d2080a453035aff17c49176";
const approvedFile = `${input}/composition-restore-390.png`;
assert.equal(hash(await readFile(approvedFile)), approvedHash);
const parent = JSON.parse(await readFile(`${input}/evidence.json`, "utf8"));
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
for (const file of [
  `${output}/index.html`,
  `${output}/states.js`,
  `${input}/evidence.json`,
  "scripts/verify-ui-phase2-workspaces-restore-states.mjs",
])
  sourceHashes[file] = hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n"));
const scenes = {
  empty: "清空原因：确认禁用",
  short: "一个字：确认仍禁用",
  valid: "两个字：蓝色确认可用",
  "keyboard-loop": "键盘焦点：在原因窗内循环",
  "cancel-return": "取消：不提交，返回恢复入口",
  "close-return": "关闭：不提交，返回恢复入口",
  "escape-return": "Escape：不提交，返回恢复入口",
  waiting: "已确认：原因窗关闭，页面等待",
  failure: "隔离失败反馈：不冒充恢复成功",
  reopen: "失败后重开：回到默认原因",
};
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^[a-z-]+-(1440|390)\.png$/u);
    assert.equal(hash(await readFile(`${output}/${shot.file}`)), shot.sha256);
  }
}
if (capture) await mkdir(output, { recursive: true });
const screenshots = [],
  checks = [],
  observations = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [1440, 390]) {
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
      await page.route(/^https?:/u, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.resolve(output, "index.html")).href);
      await page.waitForFunction(() => !!window.WORKSPACE_CONTROLS_C);
      const state = () => page.evaluate(() => window.WORKSPACES_C.state());
      const dialog = page.locator("#reason-dialog"),
        reason = page.locator("#reason-input");
      const confirm = page.locator("#reason-confirm"),
        trigger = page.locator("#state-action");
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const open = async () => {
        await page.locator("#restore-demo-open").click();
        check(
          "initial focus on reason",
          await reason.evaluate((n) => n === document.activeElement),
        );
        check("restore target is archived", (await state()).dialog.status, "archived");
      };
      const shot = async (scene, modal = true) => {
        await page.mouse.move(1, 1);
        const locator = modal ? dialog : page.locator("#workspace");
        check(
          `${scene}: no horizontal overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (modal)
          check(
            `${scene}: dialog inside viewport`,
            await dialog.evaluate((n) => {
              const r = n.getBoundingClientRect();
              return (
                r.top >= 0 && r.bottom <= innerHeight + 1 && n.scrollWidth <= n.clientWidth + 1
              );
            }),
          );
        if (capture) {
          const file = `${scene}-${width}.png`;
          const bytes = await locator.screenshot();
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            scene,
            width,
            sha256: hash(bytes),
            pageId: "P32",
            scope: "restore-state-proposal-not-Vue-or-production",
          });
        }
      };
      await open();
      const initial = await state();
      for (const [scene, value] of [
        ["empty", ""],
        ["short", "短"],
      ]) {
        await reason.fill(value);
        check(`${scene}: disabled`, await confirm.isDisabled());
        await confirm.evaluate((n) => n.click());
        check(`${scene}: no intent`, (await state()).intents, []);
        check(`${scene}: stays open`, await dialog.evaluate((n) => n.open));
        await shot(scene);
      }
      await reason.fill("  恢复  ");
      check("two trimmed characters enable confirmation", await confirm.isEnabled());
      check(
        "valid restore button is blue",
        await confirm.evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(37, 74, 156)",
      );
      await shot("valid");
      await page.keyboard.press("Tab"); // textarea -> cancel
      await page.keyboard.press("Tab"); // cancel -> confirm
      check(
        "keyboard reaches confirm",
        await confirm.evaluate((n) => n === document.activeElement && n.matches(":focus-visible")),
      );
      await page.keyboard.press("Tab");
      check(
        "Tab wraps to close",
        await page.locator("#reason-close").evaluate((n) => n === document.activeElement),
      );
      await page.keyboard.press("Shift+Tab");
      check(
        "Shift+Tab wraps to confirm",
        await confirm.evaluate((n) => n === document.activeElement),
      );
      await shot("keyboard-loop");
      for (const method of ["cancel", "close", "escape"]) {
        if (method !== "cancel") await open();
        await reason.fill("尚未提交的原因");
        if (method === "escape") await page.keyboard.press("Escape");
        else await page.locator(`#reason-${method}`).click();
        check(`${method}: closed`, await dialog.evaluate((n) => n.open), false);
        check(`${method}: zero intent`, (await state()).intents, []);
        check(
          `${method}: trigger focus restored`,
          await trigger.evaluate((n) => n === document.activeElement),
        );
        await shot(`${method}-return`, false);
      }
      await open();
      await page.evaluate(() => window.WORKSPACES_C.setMode("hold"));
      await reason.fill("  核验后恢复  ");
      await confirm.click();
      const pending = await state();
      check(
        "confirmation closes reason before waiting",
        await dialog.evaluate((n) => n.open),
        false,
      );
      check("pending action", pending.busy, "action");
      check("exact restore intent", pending.intents, [
        {
          url: `/org/admin/workspaces/${initial.dialog.id}/actions`,
          method: "POST",
          body: {
            action: "restore",
            expected_version: initial.dialog.version,
            reason: "核验后恢复",
          },
        },
      ]);
      check("pending entry disabled", await trigger.isDisabled());
      await page.locator("#restore-pending").waitFor();
      check(
        "pending status is announced",
        await page.locator("#restore-pending").getAttribute("role"),
        "status",
      );
      await trigger.evaluate((n) => n.click());
      check("disabled entry does not duplicate intent", (await state()).intents, pending.intents);
      await shot("waiting", false);
      await page.locator("#restore-demo-fail").click();
      const failed = await state();
      check("failure removes pending notice", await page.locator("#restore-pending").count(), 0);
      check("failure clears busy", failed.busy, "");
      check("failure does not reopen reason", await dialog.evaluate((n) => n.open), false);
      check("failure preserves original facts", failed.items, initial.items);
      check("failure has no automatic retry", failed.intents, pending.intents);
      check("failure is announced", await page.locator("#feedback").getAttribute("role"), "alert");
      await shot("failure", false);
      await trigger.click();
      check("reopening resets to existing default reason", await reason.inputValue(), "恢复工作区");
      check("reopening is not a retry", (await state()).intents, pending.intents);
      await shot("reopen");
      observations.push({
        width,
        actionId: "OG-W-STATE",
        dialogId: "D-OG-REASON",
        intents: pending.intents,
        factsUnchanged: true,
        frontendMaxPolicyTested: false,
      });
      check("no browser errors", errors, []);
      check("no HTTP request", requests, []);
      check("no cookies", await context.cookies(), []);
      check(
        "no storage writes",
        await page.evaluate(() => localStorage.length + sessionStorage.length),
        0,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
assert.equal(hash(await readFile(approvedFile)), approvedHash);
if (capture) {
  assert.equal(screenshots.length, Object.keys(scenes).length * 2);
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "P32-RESTORE-STATES-r1",
        approval: "pending-user-review",
        boundary:
          "Offline existing C renderer only. No Vue/API/database/permission/audit acceptance. Maxlength policy excluded.",
        approvedReference: {
          file: approvedFile,
          sha256: approvedHash,
          scope: "previous mobile composition only",
        },
        sourceHashes,
        scenes,
        checks,
        observations,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const sections = Object.entries(scenes)
    .map(
      ([scene, title]) =>
        `<section><h2>${title}</h2><div class="shots">${screenshots
          .filter((s) => s.scene === scene)
          .map(
            (s) =>
              `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${title} ${s.width}px"></a><figcaption>${s.width}px · ${scene}</figcaption></figure>`,
          )
          .join("")}</div></section>`,
    )
    .join("\n");
  await writeFile(
    `${output}/gallery.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P32 恢复工作区 · 后续状态审核</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;background:#edf1f6;color:#202c3d}header{max-width:1000px}section{background:white;padding:20px;margin:24px 0;border-left:4px solid #254a9c}a{color:#193b80}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}figure{margin:0}img{max-width:100%;height:440px;object-fit:contain;object-position:top left}h2{font-size:21px}</style>
<header><h1>P32 恢复工作区 · 后续状态审核</h1><p>10组、20张桌面/手机图。沿用已批手机组合的原渲染器；本批仍待审核。点击图片看原尺寸。</p>
<p>确认之后原原因窗关闭；等待和失败位于原页面，不设计成仍在弹窗内保存。失败重开回到默认原因。本原型最多500字与真实共享前端差异继续保留，不在本批决定上限。</p>
<nav><a href="README.md">范围与验证</a> · <a href="index.html">交互原型</a> · <a href="../workspaces-controls-direction-c/composition-restore-390.png">原已批准图（未修改）</a></nav></header>${sections}</html>`,
  );
} else if (!smoke) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(observations, previous.observations);
  assert.deepEqual(scenes, previous.scenes);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "check",
    checks: checks.length,
    screenshots: capture ? screenshots.length : 0,
    approvedImageUnchanged: true,
    noProductionWrite: true,
    browserClosed: true,
  }),
);
