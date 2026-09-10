import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const base = "design-plans/ui-phase-2-2026-09-07/design/org-approvals-parent-direction-c";
const output = "output/playwright/p34-permission-tone-r2";
const original = JSON.parse(await readFile(`${base}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sourceHashes = { ...original.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
for (const file of [
  `${base}/permission-tone-r2.html`,
  `${base}/permission-tone-r2.js`,
  "scripts/verify-ui-phase2-org-approvals-permission-tone-r2.mjs",
])
  sourceHashes[file] = hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n"));
const retainedImages = {
  "initial-server-error-390.png":
    "44e14492c3d39be78b50ec6c0536000065a003c585e2a54f5523ab150ede0c30",
  "background-permission-forbidden-focus-390.png":
    "ec9a3d9c909a2386ee6cae41533fe3203e21b23920e82d819da6ee1555474bef",
};
for (const [file, sha] of Object.entries(retainedImages))
  assert.equal(hash(await readFile(`${base}/${file}`)), sha);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
} else await mkdir(output, { recursive: true });
const checks = [],
  screenshots = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      reducedMotion: "reduce",
      locale: "zh-CN",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(/^https?:/u, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const show = async (file, scene) => {
        await page.goto(pathToFileURL(path.resolve(base, file)).href);
        await page.waitForFunction(() => !!window.P34_PARENT_C);
        await page.evaluate((s) => window.P34_PARENT_C.show(s), scene);
        if (file.includes("r2"))
          await page.waitForFunction(
            () =>
              document.querySelector(".parent-region h2")?.textContent === "当前无法查看审批内容",
          );
      };
      const shot = async (scene, selector) => {
        if (!capture) return;
        const file = `${scene}-${width}.png`,
          bytes = await page.locator(selector).screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          scene,
          width,
          sha256: hash(bytes),
          scope: "permission-tone-only-r2-proposal",
        });
      };
      const snapshot = () =>
        page.evaluate(() => {
          const card = document.querySelector(".parent-region"),
            clone = card.cloneNode(true);
          const selectors = [".state-kicker", "h2", ".state-copy", ".data-boundary"];
          const text = selectors.map((s) => clone.querySelector(s).textContent);
          selectors.forEach((s) => {
            clone.querySelector(s).textContent = "COPY_SLOT";
          });
          const button = card.querySelector("button"),
            css = getComputedStyle(button);
          return {
            structure: clone.outerHTML,
            text,
            styles: [
              css.backgroundColor,
              css.color,
              css.borderRadius,
              css.fontSize,
              css.minHeight,
              css.padding,
              css.width,
            ],
            header: document.querySelector(".heading").innerHTML,
          };
        });
      for (const phase of ["initial", "background"]) {
        const scene = `${phase}-permission-forbidden`;
        await show("index.html", scene);
        const before = await snapshot();
        await show("permission-tone-r2.html", scene);
        const after = await snapshot();
        check(`${phase}: only four text slots change`, after.structure, before.structure);
        check(`${phase}: header unchanged`, after.header, before.header);
        check(`${phase}: button styling unchanged`, after.styles, before.styles);
        check(`${phase}: softened copy`, after.text, [
          "查看权限提示",
          "当前无法查看审批内容",
          "当前权限还不能读取这些内容。权限调整后，可以重新加载。",
          "审批内容目前未显示，不代表记录或模板为空。",
        ]);
        check(`${phase}: no content exposed`, await page.locator(".retained-content").count(), 0);
        check(
          `${phase}: no overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        await shot(`${scene}-r2-page`, ".shell");
        await shot(`${scene}-r2-region`, ".parent-region");
        await page.keyboard.press("Tab");
        await page.locator("#parent-retry").focus();
        check(
          `${phase}: keyboard focus retained`,
          await page
            .locator("#parent-retry")
            .evaluate(
              (n) => n.matches(":focus-visible") && getComputedStyle(n).outlineWidth === "3px",
            ),
        );
        await shot(`${scene}-r2-focus`, ".parent-region");
        await page.locator("#parent-retry").click();
        await page.waitForFunction(() => window.P34_PARENT_C.state().scene === "initial-loading");
        check(
          `${phase}: retry still only existing read intentions`,
          await page.evaluate(() => window.P34_PARENT_C.state().intents),
          [
            { method: "GET", path: "/org/admin/summary" },
            { method: "GET", path: "/org/admin/approvals" },
          ],
        );
      }
      await page.evaluate(() => window.P34_PARENT_C.show("initial-server-error"));
      check(
        "approved first failure wording untouched",
        await page.locator(".parent-region h2").textContent(),
        "组织后台暂不可用",
      );
      check("zero requests", requests, []);
      check("zero page errors", errors, []);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture)
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "P34-PERMISSION-TONE-r2",
        approval: "pending-specific-r2-review",
        boundary:
          "Four copy slots only; layout,buttons,focus and permission behavior unchanged. Offline proposal,not production.",
        sourceHashes,
        retainedImages,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
else assert.deepEqual(checks, previous.checks);
console.log(
  JSON.stringify({ checks: checks.length, screenshots: screenshots.length, browserClosed: true }),
);
