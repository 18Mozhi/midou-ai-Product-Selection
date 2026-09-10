import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const folder = "design-plans/ui-phase-2-2026-09-07/design/org-approvals-parent-direction-c";
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)) && !(capture && smoke),
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const actualFile = "output/playwright/p34-parent-read-states/evidence.json";
const actual = JSON.parse(await readFile(actualFile, "utf8"));
const sourceHashes = { ...actual.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
const additional = [
  actualFile,
  "scripts/verify-ui-phase2-org-approvals-parent-c.mjs",
  ...["index.html", "parent.css", "parent.js"].map((f) => `${folder}/${f}`),
  ...["approvals.css", "approvals.js", "data.js"].map(
    (f) => `design-plans/ui-phase-2-2026-09-07/design/org-approvals-direction-c/${f}`,
  ),
  "design-plans/ui-phase-2-2026-09-07/design/org-approvals-controls-direction-c/controls.css",
  ...["fields.css", "fields.js"].map(
    (f) => `design-plans/ui-phase-2-2026-09-07/design/org-approvals-fields-direction-c/${f}`,
  ),
];
for (const file of additional)
  sourceHashes[file] = hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n"));
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${folder}/evidence.json`, "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${folder}/${s.file}`)), s.sha256);
}
const checks = [],
  screenshots = [];
let scenes;
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
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
      await page.waitForFunction(() => !!window.P34_PARENT_C);
      scenes = await page.evaluate(() => window.P34_PARENT_C.scenes);
      const check = (name, value, expected = true) => {
        assert.deepEqual(value, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const show = async (id) => {
        await page.evaluate((s) => window.P34_PARENT_C.show(s), id);
        await page.waitForFunction(
          (s) => document.querySelector("[data-parent-ready]")?.dataset.parentReady === s,
          id,
        );
      };
      const shot = async (scene, locator) => {
        if (!capture) return;
        const file = `${scene}-${width}.png`,
          bytes = await locator.screenshot({ animations: "disabled" });
        await writeFile(`${folder}/${file}`, bytes);
        screenshots.push({
          file,
          scene,
          width,
          pageId: "P34",
          scope: "parent-section-proposal-not-production-or-user-approval",
          sha256: hash(bytes),
        });
      };
      for (const scene of smoke
        ? scenes.filter((s) =>
            [
              "initial-loading",
              "background-refreshing",
              "initial-server-error",
              "background-service-blocked",
              "background-permission-forbidden",
            ].includes(s.id),
          )
        : scenes) {
        await show(scene.id);
        if (scene.failure) {
          const matched = actual.scenarios.filter(
            (s) => s.width === width && s.phase === scene.phase && s.failure === scene.failure.id,
          );
          check(`${scene.id}: actual both-read evidence exists`, matched.length, 2);
          check(
            `${scene.id}: visibility agrees with actual parent`,
            matched.every((s) => s.childVisible === !scene.replace),
          );
        }
        check(
          `${scene.id}: child visibility`,
          await page.locator(".retained-content").count(),
          scene.replace ? 0 : 1,
        );
        check(
          `${scene.id}: busy semantics`,
          await page.locator(".main").getAttribute("aria-busy"),
          String(scene.busy),
        );
        check(
          `${scene.id}: refresh disabled only while reading`,
          await page.locator("#parent-refresh").isDisabled(),
          scene.busy,
        );
        check(
          `${scene.id}: only existing retry entry`,
          await page.locator("#parent-retry").count(),
          scene.replace && scene.failure ? 1 : 0,
        );
        check(
          `${scene.id}: no overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (scene.failure)
          check(
            `${scene.id}: error alert`,
            await page.locator(".parent-region").getAttribute("role"),
            "alert",
          );
        if (scene.replace)
          check(`${scene.id}: no stale summary`, await page.locator(".summary").count(), 0);
        else
          check(
            `${scene.id}: local search editable`,
            await page.locator("#template-query").isEnabled(),
          );
        await shot(scene.id, page.locator(".shell"));
        if (!scene.busy) {
          const action = page.locator(scene.replace ? "#parent-retry" : "#parent-refresh");
          await page.keyboard.press("Tab");
          await action.focus();
          check(
            `${scene.id}: keyboard focus ring`,
            await action.evaluate(
              (n) =>
                n.matches(":focus-visible") && parseFloat(getComputedStyle(n).outlineWidth) >= 3,
            ),
          );
          await shot(
            `${scene.id}-focus`,
            page.locator(scene.replace ? ".parent-region" : ".heading"),
          );
        }
      }
      await show("background-service-blocked");
      const search = page.locator("#template-query");
      await search.fill("采购");
      await page.waitForFunction(
        () =>
          document.querySelector("[data-parent-ready]")?.dataset.parentReady ===
          "background-service-blocked",
      );
      check("failed refresh keeps edited filter", await search.inputValue(), "采购");
      const before = await page.evaluate(() => window.P34_PARENT_C.state().intents.length);
      await page.locator("#parent-refresh").click();
      await page.waitForFunction(
        () =>
          document.querySelector("[data-parent-ready]")?.dataset.parentReady ===
          "background-refreshing",
      );
      check("new refresh retains edited filter", await search.inputValue(), "采购");
      check(
        "new refresh records only both existing GET intentions",
        await page.evaluate((n) => window.P34_PARENT_C.state().intents.slice(n), before),
        [
          { method: "GET", path: "/org/admin/summary" },
          { method: "GET", path: "/org/admin/approvals" },
        ],
      );
      check(
        "pending refresh is native disabled",
        await page.locator("#parent-refresh").isDisabled(),
      );
      for (const id of ["initial-server-error", "ready"]) {
        await show(id);
        const action = page.locator(id === "ready" ? "#parent-refresh" : "#parent-retry");
        await action.hover();
        await shot(`${id}-hover`, page.locator(id === "ready" ? ".heading" : ".parent-region"));
        await page.mouse.down();
        check(`${id}: pressed native state`, await action.evaluate((n) => n.matches(":active")));
        await shot(`${id}-pressed`, page.locator(id === "ready" ? ".heading" : ".parent-region"));
        await page.mouse.up();
      }
      await show("initial-permission-forbidden");
      await page.locator(".trace summary").click();
      check(
        "trace example expands without request",
        await page.locator(".trace").getAttribute("open"),
        "",
      );
      await shot("initial-permission-forbidden-trace", page.locator(".parent-region"));
      check("no fabricated business dialog", await page.locator("dialog").count(), 0);
      check("no external or API requests", external, []);
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
    `${folder}/evidence.json`,
    JSON.stringify(
      {
        kind: "P34-PARENT-DIRECTION-C-r1",
        approval: "pending-concrete-parent-section-review",
        boundary:
          "Offline HTML proposal reuses existing child prototype; actual parent behavior linked,not production Vue or authorization proof. New parent wording,trace fold and placement require review. 409 is synthetic client classification. No new endpoints or business dialogs.",
        sourceHashes,
        scenes,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const gallery =
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P34 父状态 C 图册</title><style>body{margin:24px;background:#edf1f6;color:#202c3d;font:16px/1.6 "Microsoft YaHei",sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}figure{margin:0;background:white;padding:18px;border-radius:12px}img{width:100%;max-height:560px;object-fit:contain;object-position:top}a{color:#254a9c}</style><h1>P34 父级状态 C-r1</h1><p>全部为待审核提案；下方子页面仅作上下文，不扩大已批准范围。</p><p><a href="index.html">打开交互原型</a> · <a href="README.md">范围与依据</a></p><main>' +
    screenshots
      .map(
        (s) =>
          `<figure><figcaption>${s.scene} · ${s.width}</figcaption><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene}，${s.width}像素"></a></figure>`,
      )
      .join("") +
    "</main></html>";
  await writeFile(`${folder}/gallery.html`, gallery + "\n");
} else if (!smoke) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(scenes, previous.scenes);
}
console.log(
  JSON.stringify({
    scenes: scenes.length,
    checks: checks.length,
    screenshots: screenshots.length,
    browserClosed: true,
  }),
);
