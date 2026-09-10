import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)) && !(capture && smoke),
);
const folder = "design-plans/ui-phase-2-2026-09-07/design/org-data-parent-c";
const original = "design-plans/ui-phase-2-2026-09-07/design/org-data-direction-c";
const output = "output/playwright/p35-parent-c-review";
const actualFile = "output/playwright/p35-parent-read-states/evidence.json";
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const actual = JSON.parse(await text(actualFile));
const sourceHashes = { ...actual.sourceHashes };
for (const [f, sha] of Object.entries(sourceHashes)) assert.equal(hash(await text(f)), sha, f);
for (const s of actual.screenshots)
  assert.equal(hash(await readFile(`${path.posix.dirname(actualFile)}/${s.file}`)), s.sha256);
for (const f of [
  actualFile,
  "scripts/verify-ui-phase2-org-data-parent-c.mjs",
  ...["index.html", "parent.js", "parent.css"].map((f) => `${folder}/${f}`),
  ...["data.js", "org-data.js", "org-data.css"].map((f) => `${original}/${f}`),
])
  sourceHashes[f] = hash(await text(f));
let previous;
if (!smoke && !capture) {
  previous = JSON.parse(await text(`${output}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
}
if (capture) await mkdir(output, { recursive: true });
const checks = [],
  screenshots = [];
let scenes;
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [1440, 390])
    for (const view of ["workspaces", "exports"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          errors = [],
          external = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route(/^https?:/u, (r) => {
          external.push(r.request().url());
          return r.abort();
        });
        await page.goto(pathToFileURL(path.resolve(folder, "index.html")).href);
        await page.waitForFunction(() => !!window.P35_PARENT_C);
        scenes = await page.evaluate(() => window.P35_PARENT_C.scenes);
        assert.equal(scenes.length, 17);
        const check = (name, value, expected = true) => {
          assert.deepEqual(value, expected, `${width}/${view}/${name}`);
          checks.push({ width, view, name });
        };
        const state = () => page.evaluate(() => window.P35_PARENT_C.state());
        const show = async (id) => {
          await page.evaluate(([id, view]) => window.P35_PARENT_C.show(id, view), [id, view]);
          await page.waitForFunction(
            (id) => document.querySelector("[data-parent-ready]")?.dataset.parentReady === id,
            id,
          );
          await page.mouse.move(0, 0);
          await page.evaluate(() => document.activeElement?.blur());
        };
        const shot = async (scene, variant, locator) => {
          if (!capture) return;
          const file = `${view}-${scene}-${variant}-${width}.png`;
          const bytes = await locator.screenshot({ animations: "disabled" });
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            view,
            scene,
            variant,
            width,
            pageId: "P35",
            sha256: hash(bytes),
            scope: "offline-parent-C-proposal-not-Vue-or-approval",
          });
        };
        const initialData = (await state()).child.data;
        for (const scene of smoke
          ? scenes.filter((s) =>
              [
                "initial-loading",
                "ready",
                "background-refreshing",
                "initial-server-error",
                "background-service-blocked",
                "background-permission-forbidden",
              ].includes(s.id),
            )
          : scenes) {
          await show(scene.id);
          if (scene.failure) {
            const matches = actual.scenarios.filter(
              (s) =>
                s.width === width &&
                s.view === view &&
                s.phase === scene.phase &&
                s.failure === scene.failure.id,
            );
            check(`${scene.id}: both actual endpoint cases`, matches.length, 2);
            check(
              `${scene.id}: source visibility agreement`,
              matches.every((s) => s.childVisible === !scene.replace),
            );
          }
          check(
            `${scene.id}: retained region`,
            await page.locator(".retained-content").count(),
            scene.replace ? 0 : 1,
          );
          check(
            `${scene.id}: reading semantics`,
            await page.locator(".main").getAttribute("aria-busy"),
            String(scene.busy),
          );
          check(
            `${scene.id}: refresh disabled`,
            await page.locator("#parent-refresh").isDisabled(),
            scene.busy,
          );
          check(
            `${scene.id}: retry only on replacing failure`,
            await page.locator("#parent-retry").count(),
            scene.replace && scene.failure ? 1 : 0,
          );
          check(`${scene.id}: data unchanged`, (await state()).child.data, initialData);
          check(
            `${scene.id}: no overflow`,
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          if (scene.replace)
            check(
              `${scene.id}: no stale totals`,
              await page.locator(".summary,.paper,.truth").count(),
              0,
            );
          if (scene.failure)
            check(
              `${scene.id}: alert semantics`,
              await page.locator(".parent-region").getAttribute("role"),
              "alert",
            );
          await shot(scene.id, "composition", page.locator(".shell"));
          const targets = [
            ...(!scene.busy ? ["#parent-refresh"] : []),
            ...(scene.replace && scene.failure ? ["#parent-retry"] : []),
            ...(scene.failure ? [".trace summary"] : []),
          ];
          for (const selector of targets) {
            const target = page.locator(selector);
            await page.keyboard.press("Tab");
            await target.focus();
            const metrics = await target.evaluate((n) => ({
              focus: n.matches(":focus-visible"),
              outline: getComputedStyle(n).outlineWidth,
              height: n.getBoundingClientRect().height,
              font: parseFloat(getComputedStyle(n).fontSize),
            }));
            check(
              `${scene.id}/${selector}: native focus and size`,
              metrics.focus &&
                metrics.outline === "3px" &&
                metrics.height >= 44 &&
                metrics.font >= 16,
            );
            await shot(
              scene.id,
              selector === "#parent-refresh"
                ? "refresh-focus"
                : selector === "#parent-retry"
                  ? "retry-focus"
                  : "trace-focus",
              page.locator(selector === "#parent-refresh" ? ".heading" : ".parent-region"),
            );
            if (selector !== ".trace summary") {
              const before = await state();
              await target.hover();
              check(
                `${scene.id}/${selector}: native hover`,
                await target.evaluate((n) => n.matches(":hover")),
              );
              await page.mouse.down();
              check(
                `${scene.id}/${selector}: native pressed`,
                await target.evaluate((n) => n.matches(":active")),
              );
              await page.mouse.move(0, 0);
              await page.mouse.up();
              check(
                `${scene.id}/${selector}: cancelled press no intent`,
                (await state()).intents,
                before.intents,
              );
            }
          }
          if (scene.failure) {
            await page.locator(".trace summary").focus();
            const before = await state();
            await page.keyboard.press("Enter");
            check(`${scene.id}: trace open`, await page.locator(".trace").evaluate((n) => n.open));
            await shot(scene.id, "trace-open", page.locator(".parent-region"));
            await page.keyboard.press("Space");
            check(`${scene.id}: trace closes without read`, await state(), before);
            check(
              `${scene.id}: trace closed`,
              await page.locator(".trace").evaluate((n) => n.open),
              false,
            );
          }
        }
        // An actual existing view-click re-render must not reset page or either filter set.
        await show("background-service-blocked");
        const kind = view === "workspaces" ? "workspace" : "export";
        if (width === 390) await page.locator("#filters-toggle").click();
        const query = page.locator(`#${kind}-query`);
        await query.fill(view === "workspaces" ? "工作区" : "报表");
        await page.locator('[data-page="1"]').click();
        const before = await state();
        check("page reached two before refresh", before.child[kind].page, 2);
        await page.locator("#parent-refresh").click();
        const after = await state();
        check("refresh starts background reading", after.scene, "background-refreshing");
        check(
          "refresh preserves both filter/page sets",
          [after.child.workspace, after.child.export],
          [before.child.workspace, before.child.export],
        );
        check("refresh preserves original facts", after.child.data, before.child.data);
        check("refresh exact GET intentions", after.intents.slice(before.intents.length), [
          { method: "GET", path: "/org/admin/summary" },
          { method: "GET", path: "/org/admin/data" },
        ]);
        const busyIntents = after.intents;
        await page.locator("#parent-refresh").evaluate((n) => n.click());
        check("disabled refresh has no repeated intention", (await state()).intents, busyIntents);
        await query.focus();
        await query.press("End");
        await query.pressSequentially(" ");
        check(
          "reading still allows input and preserves focus",
          await query.evaluate((n) => n === document.activeElement && n.value.endsWith(" ")),
        );
        await show("initial-server-error");
        const retryBefore = await state();
        await page.locator("#parent-retry").click();
        check("retry starts initial loading", (await state()).scene, "initial-loading");
        check(
          "retry records only two existing GETs",
          (await state()).intents.slice(retryBefore.intents.length),
          [
            { method: "GET", path: "/org/admin/summary" },
            { method: "GET", path: "/org/admin/data" },
          ],
        );
        check("no business dialogs", await page.locator("dialog").count(), 0);
        check("no HTTP or external requests", external, []);
        check("no page errors", errors, []);
      } finally {
        await context.close();
      }
    }
} finally {
  await browser.close();
}
if (capture) {
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        pageId: "P35",
        approval: "pending-parent-region-review",
        scope:
          "Offline HTML C proposal, visibility grounded in actual parent matrix; no new runtime/API/permissions or user approval",
        sourceHashes,
        scenes,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const cards = screenshots
    .map(
      (s) =>
        `<article><h2>${s.view} / ${s.scene} / ${s.variant} / ${s.width}</h2><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.variant}"></a></article>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>P35 父级 C 状态待审</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;background:#edf1f6;color:#202c3d}article{background:white;padding:20px;margin:24px 0}img{max-width:100%}</style>
<h1>P35 父级 C 状态稿</h1><p>全部为独立设计待审；不是真实Vue或生产验收。悬停/按下有原生检查，焦点/追踪另有图片。</p>${cards}</html>`,
  );
} else if (!smoke) assert.deepEqual(checks, previous.checks);
console.log(
  JSON.stringify({
    checks: checks.length,
    scenes: scenes.length,
    screenshots: screenshots.length,
    browserClosed: true,
    noServer: true,
  }),
);
