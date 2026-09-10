import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/workspaces-controls-direction-c",
  root = path.join(repo, relative);
const args = process.argv.slice(2),
  capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(args.every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const parent = JSON.parse(
  await readFile(path.join(root, "../workspaces-direction-c/evidence.json"), "utf8"),
);
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(
    hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    sha,
    file,
  );
for (const file of ["index.html", "controls.js", "controls.css"]
  .map((f) => `${relative}/${f}`)
  .concat("scripts/verify-ui-phase2-workspaces-controls-c.mjs"))
  sourceHashes[file] = hash(
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
  );
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^[\w-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
  }
}
const screenshots = [],
  checks = [],
  interactions = [],
  controlReferences = {},
  actionVisualReferences = {},
  controlVariantReferences = {};
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
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.WORKSPACE_CONTROLS_C));
      const controls = await page.evaluate(() => window.WORKSPACE_CONTROLS_C.controls);
      assert.equal(controls.length, 36);
      for (const c of controls) {
        const ref = (controlReferences[c.id] ??= {
          actionId: c.actionId,
          scope: c.scope,
          label: c.label,
          selector: c.selector,
          states: {},
        });
        for (const state of smoke ? [c.disabledOnly ? "disabled" : "focus"] : c.states) {
          await page.evaluate(({ id, state }) => window.WORKSPACE_CONTROLS_C.prepare(id, state), {
            id: c.id,
            state,
          });
          const before = await page.evaluate(() => window.WORKSPACES_C.state()),
            target = page.locator(c.selector);
          assert.equal(await target.count(), 1, c.id);
          await page.mouse.move(1, 1);
          if (state === "focus") {
            await page.keyboard.press("Tab");
            for (
              let i = 0;
              i < 80 && !(await target.evaluate((el) => el === document.activeElement));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(await target.evaluate((el) => el.matches(":focus-visible")), true, c.id);
          } else await page.evaluate(() => document.activeElement?.blur());
          await target.scrollIntoViewIfNeeded();
          if (["hover", "pressed"].includes(state)) await target.hover();
          if (state === "pressed") await page.mouse.down();
          assert.equal(
            await target.isDisabled(),
            ["disabled", "busy"].includes(state),
            `${c.id}/${state}`,
          );
          if (Object.hasOwn(c, "selected"))
            assert.equal(await target.getAttribute("aria-pressed"), String(c.selected), c.id);
          if (["hover", "pressed"].includes(state))
            assert.equal(
              await target.evaluate(
                (el, s) => el.matches(s),
                state === "pressed" ? ":active" : ":hover",
              ),
              true,
            );
          const metrics = await target.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              s = getComputedStyle(el),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(s.fontSize),
              hit: el === hit || el.contains(hit),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              outline: s.outlineColor,
            };
          });
          assert.ok(
            metrics.width >= 44 &&
              metrics.height >= 44 &&
              metrics.font >= 16 &&
              metrics.hit &&
              !metrics.overflow,
            JSON.stringify({ id: c.id, state, width, metrics }),
          );
          if (state === "focus") assert.equal(metrics.outline, "rgb(40, 94, 199)");
          assert.deepEqual(
            await page.evaluate(() => window.WORKSPACES_C.state()),
            before,
            "state styling must not execute a business action",
          );
          if (["busy", "disabled"].includes(state)) {
            await target.evaluate((el) => el.click());
            assert.deepEqual(
              await page.evaluate(() => window.WORKSPACES_C.state()),
              before,
              "native disabled control cannot execute",
            );
          }
          const scene = `${c.id}-${state}`,
            file = `${scene}-${width}.png`;
          if (capture) {
            await page.evaluate(() => window.getSelection()?.removeAllRanges());
            await page.screenshot({ path: path.join(root, file) });
            screenshots.push({
              scene,
              width,
              file,
              sha256: hash(await readFile(path.join(root, file))),
              control: {
                selector: c.selector,
                actionId: c.actionId,
                state,
                ...(!c.primary ? { key: `P32-${c.id}` } : {}),
              },
            });
          }
          ref.states[state] = scene;
          checks.push({ id: c.id, state, width, metrics, unchangedFacts: true });
          if (state === "pressed") {
            await page.mouse.move(1, 1);
            await page.mouse.up();
          }
        }
        if (c.primary)
          actionVisualReferences[c.actionId] = {
            scope: c.scope,
            selector: c.selector,
            states: ref.states,
          };
        else
          controlVariantReferences[`P32-${c.id}`] = {
            scope: c.scope,
            pageId: "P32",
            actionId: c.actionId,
            selector: c.selector,
            states: ref.states,
          };
        if (!c.disabledOnly) {
          await page.evaluate((id) => window.WORKSPACE_CONTROLS_C.prepare(id), c.id);
          const before = await page.evaluate(() => window.WORKSPACES_C.state());
          const selectedTarget = await page.locator(c.selector).getAttribute("data-select");
          await page.locator(c.selector).click();
          const after = await page.evaluate(() => window.WORKSPACES_C.state());
          if (["OG-REFRESH", "OG-RETRY"].includes(c.actionId))
            assert.deepEqual(after.intents, [
              { url: "/org/admin/summary", method: "GET" },
              { url: "/org/admin/workspaces", method: "GET" },
            ]);
          else if (c.actionId === "OG-W-CREATE")
            assert.deepEqual(after.intents, [
              { url: "/org/admin/workspaces", method: "POST", body: before.form },
            ]);
          else if (c.id.endsWith("-confirm")) {
            assert.equal(after.dialog, null);
            assert.equal(after.intents.length, 1);
            assert.deepEqual(after.intents[0], {
              url: `/org/admin/workspaces/${before.dialog.id}/actions`,
              method: "POST",
              body: {
                action: before.dialog.status === "active" ? "archive" : "restore",
                expected_version: before.dialog.version,
                reason: before.dialog.status === "active" ? "归档工作区" : "恢复工作区",
              },
            });
          } else if (c.id.startsWith("reason-")) {
            assert.equal(after.dialog, null);
            assert.deepEqual(after.intents, []);
          } else if (c.actionId === "OG-W-OPEN") {
            assert.equal(after.createOpen, true);
            assert.deepEqual(after.intents, []);
          } else if (c.actionId === "OG-W-CANCEL") {
            assert.equal(after.createOpen, false);
            assert.deepEqual(after.form, { name: "", slug: "", reason: "" });
          } else if (c.actionId.startsWith("OG-W-STATUS-")) {
            assert.equal(after.status, c.selector.match(/'([^']+)'/)[1]);
            assert.equal(after.page, 1);
          } else if (["OG-W-RESET", "OG-W-CLEAR-EMPTY"].includes(c.actionId)) {
            assert.equal(after.query, "");
            assert.equal(after.status, "all");
            assert.equal(after.sort, "name_asc");
            assert.equal(after.selectedId, before.selectedId);
          } else if (c.actionId === "OG-W-SELECT") {
            assert.equal(after.selectedId, selectedTarget);
            assert.deepEqual(after.intents, []);
          } else if (c.actionId === "OG-W-PREVIOUS") assert.equal(after.page, before.page - 1);
          else if (c.actionId === "OG-W-NEXT") assert.equal(after.page, before.page + 1);
          else if (c.actionId === "OG-W-STATE") {
            assert.equal(after.dialog.id, before.selectedId);
            assert.deepEqual(after.intents, []);
            assert.equal(
              await page
                .locator("#reason-confirm")
                .evaluate((el) => getComputedStyle(el).backgroundColor),
              after.dialog.status === "active" ? "rgb(173, 41, 60)" : "rgb(37, 74, 156)",
            );
          } else if (["OG-W-TEAMS", "OG-W-PROFILE"].includes(c.actionId))
            assert.deepEqual(after.intents, [
              {
                url: c.actionId === "OG-W-TEAMS" ? "/org-admin/teams" : "/org-admin",
                method: "NAVIGATE",
              },
            ]);
          else if (c.actionId === "OG-W-TECH")
            assert.equal(
              await page.locator("#technical").evaluate((el) => el.open),
              c.scene !== "technical",
            );
          else assert.fail(`Unchecked action ${c.id}`);
          assert.deepEqual(
            after.items,
            before.items,
            "offline actions never fabricate persisted rows",
          );
          interactions.push({ id: c.id, width, passed: true });
        }
      }
      for (const kind of ["archive", "restore"]) {
        await page.evaluate(
          (id) => window.WORKSPACE_CONTROLS_C.prepare(id),
          `reason-${kind}-confirm`,
        );
        const dialog = page.locator("#reason-dialog");
        assert.equal(await dialog.evaluate((el) => el.open), true);
        assert.ok(await page.locator("#reason-input").isEditable());
        assert.equal(await page.locator("#reason-confirm").isEnabled(), true);
        if (capture) {
          const scene = `composition-${kind}`,
            file = `${scene}-${width}.png`;
          await dialog.screenshot({ path: path.join(root, file) });
          screenshots.push({
            scene,
            width,
            file,
            sha256: hash(await readFile(path.join(root, file))),
            scope: "dialog-composition-not-control-acceptance",
          });
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.cookies(), []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  const evidence = {
    boundary: "P32 controls proposal only,not Vue/API/database/runtime acceptance",
    sourceHashes,
    controlReferences,
    actionVisualReferences,
    controlVariantReferences,
    checks,
    interactions,
    screenshots,
  };
  await writeFile(path.join(root, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  const esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  await writeFile(
    path.join(root, "gallery.html"),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P32 控件图册</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}header{max-width:1100px}section{margin:30px 0;padding:20px;background:white;border-left:4px solid #254a9c}h2{margin:0}nav{display:flex;gap:16px;flex-wrap:wrap}
.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}img{width:100%;height:260px;object-fit:contain;background:#edf1f6}figure{margin:0}a{color:#193b80}figcaption{font-size:14px}</style>
<header><h1>P32 工作区 · 控件状态审核</h1><p>36控件/变体，${screenshots.length}张双端图（含4张原因窗组合）。点击图片看原尺寸；只代表设计稿，不代表已批准或生产完成。悬停/按下是实际鼠标状态，焦点为键盘状态。</p><nav><a href="index.html">交互原型</a><a href="README.md">范围与差异</a></nav></header>
<section><h2>原因窗组合</h2><div class="shots">${screenshots
      .filter((s) => s.scope)
      .map(
        (s) =>
          `<figure><a href="${s.file}"><img src="${s.file}" alt="${s.scene} ${s.width}"></a><figcaption>${s.scene} / ${s.width}px</figcaption></figure>`,
      )
      .join("")}</div></section>
${Object.entries(controlReferences)
  .map(
    ([id, c]) =>
      `<section><h2>${esc(c.label)}</h2><p>${esc(c.actionId)} · ${esc(c.selector)}</p><div class="shots">${screenshots
        .filter((s) => s.scene.startsWith(id + "-") && Object.values(c.states).includes(s.scene))
        .map(
          (s) =>
            `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${esc(c.label)} ${s.control.state} ${s.width}"></a><figcaption>${s.control.state} / ${s.width}px</figcaption></figure>`,
        )
        .join("")}</div></section>`,
  )
  .join("")}</html>`,
  );
} else if (!smoke) {
  assert.deepEqual(controlReferences, previous.controlReferences);
  assert.deepEqual(actionVisualReferences, previous.actionVisualReferences);
  assert.deepEqual(controlVariantReferences, previous.controlVariantReferences);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    controls: Object.keys(controlReferences).length,
    checks: checks.length,
    interactions: interactions.length,
    screenshots: screenshots.length,
    browsers: "closed",
    http: 0,
  }),
);
