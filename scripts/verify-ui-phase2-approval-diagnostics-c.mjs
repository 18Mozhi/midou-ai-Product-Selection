import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { approvalDiagnosticsData } from "./lib/ui-phase2-approval-diagnostics-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07";
const relative = `${base}/design/approval-diagnostics-direction-c`,
  root = path.join(repo, relative);
const args = process.argv.slice(2),
  capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(args.every((arg) => ["--capture", "--smoke"].includes(arg)) && !(capture && smoke));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
const data = await approvalDiagnosticsData(repo);
const files = [
  "apps/web/src/components/ApprovalWorkspace.vue",
  "tests/e2e/m05-02-approval-workflow.spec.ts",
  `${base}/design/approval-direction-c/approval.js`,
  `${base}/design/approval-direction-c/approval.css`,
  `${base}/design/approval-direction-c/data.js`,
  `${relative}/index.html`,
  `${relative}/diagnostics.css`,
  `${relative}/diagnostics.js`,
  "scripts/lib/ui-phase2-approval-diagnostics-data.mjs",
  "scripts/verify-ui-phase2-approval-diagnostics-c.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(files.map(async (f) => [f, hash(await read(f))])),
);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await read(`${relative}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const screenshots = [],
  observations = [],
  expected = [],
  effects = [];
const states = ["default", "hover", "focus", "pressed", "expanded", "no-id"];
const actionVisualReferences = {
  "AN-TECH-REQUEST": {
    scope: "representative-control-only-not-all-variants-or-Vue",
    pageId: "P25",
    selector: "#request-summary",
    states: Object.fromEntries(states.slice(0, 4).map((s) => [s, `request-${s}`])),
  },
};
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const viewport = { width, height: width === 390 ? 844 : 1000 };
    const context = await browser.newContext({
      viewport,
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        requests = [],
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      await page.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => !!window.APPROVAL_DIAGNOSTICS_C);
      assert.deepEqual(await page.evaluate(() => window.APPROVAL_DIAGNOSTICS_C.samples), {
        conflict: data.conflict,
        unexpected: data.unexpected,
      });
      const facts = await page.evaluate(() => window.APPROVAL_C_DATA);
      const core = () => page.evaluate(() => window.APPROVAL_C.state());
      async function prepare(kind = "conflict") {
        await page.mouse.move(1, 1);
        await page.evaluate((value) => {
          window.APPROVAL_DIAGNOSTICS_C.show(value);
          document.activeElement?.blur();
        }, kind);
      }
      async function paint(target) {
        await target.scrollIntoViewIfNeeded();
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
      }
      for (const mode of smoke ? ["focus", "pressed", "expanded", "no-id"] : states) {
        await prepare(mode === "no-id" ? "unexpected" : "conflict");
        const before = await core();
        const target = page.locator(mode === "no-id" ? "#request-diagnostic" : "#request-summary");
        await paint(target);
        if (mode === "hover" || mode === "pressed") await target.hover();
        if (mode === "focus") {
          // Use real keyboard modality, then traverse to the native summary.
          await page.locator("#manage").focus();
          for (
            let i = 0;
            i < 4 && !(await target.evaluate((n) => n === document.activeElement));
            i++
          )
            await page.keyboard.press("Tab");
        }
        if (mode === "pressed") await page.mouse.down();
        if (mode === "expanded") await target.click();
        const info = await target.evaluate((node) => {
          const b = node.getBoundingClientRect(),
            css = getComputedStyle(node);
          const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return {
            width: b.width,
            height: b.height,
            font: parseFloat(css.fontSize),
            visible:
              b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1,
            hit: hit === node || node.contains(hit),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            hover: node.matches(":hover"),
            focus: node.matches(":focus-visible"),
            pressed: node.matches(":active"),
            open: !!document.querySelector("#request-technical")?.open,
            text: document.querySelector(".diagnostic-message").textContent,
            requestId: document.querySelector("#request-diagnostic code")?.textContent ?? "",
          };
        });
        assert.ok(info.visible && info.hit && !info.overflow, `${width}/${mode}: visibility`);
        if (mode !== "no-id") assert.ok(info.width >= 44 && info.height >= 44 && info.font >= 16);
        if (["hover", "focus", "pressed"].includes(mode)) assert.equal(info[mode], true, mode);
        if (mode === "default") assert.equal(info.hover || info.focus || info.pressed, false);
        assert.equal(info.open, mode === "expanded");
        assert.equal(info.text, (mode === "no-id" ? data.unexpected : data.conflict).notice);
        assert.equal(info.requestId, mode === "no-id" ? "" : data.conflict.requestId);
        if (mode === "no-id") assert.equal(await page.locator("#request-summary").count(), 0);
        observations.push({ viewportWidth: width, mode, ...info });
        const scene = `request-${mode}`,
          file = `${width}-${scene}.png`;
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: false,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene,
            pageId: "P25",
            viewport,
            fullPage: false,
            control: {
              actionId: "AN-TECH-REQUEST",
              selector: mode === "no-id" ? "#request-diagnostic" : "#request-summary",
              state: mode,
            },
            sha256: hash(bytes),
          });
        }
        if (mode === "pressed") {
          await page.mouse.move(width - 2, 2);
          await page.mouse.up();
          assert.equal(await page.locator("#request-technical").evaluate((n) => n.open), false);
        }
        assert.deepEqual(await core(), before, `${mode}: no business mutation`);
      }
      await prepare();
      const before = await core(),
        summary = page.locator("#request-summary");
      await summary.click();
      assert.equal(await page.locator("#request-technical").evaluate((n) => n.open), true);
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#request-technical").evaluate((n) => n.open), false);
      await page.keyboard.press("Space");
      assert.equal(await page.locator("#request-technical").evaluate((n) => n.open), true);
      assert.equal(await summary.evaluate((n) => document.activeElement === n), true);
      assert.deepEqual(await core(), before);
      // Switching scenes must remove old diagnostic identifiers instead of leaving a stale node.
      await page.locator("#review-unexpected").click();
      assert.equal(await page.locator("#request-diagnostic code").count(), 0);
      await page.locator("#scene-picker").selectOption("empty");
      assert.equal(await page.locator("#request-diagnostic").count(), 0);
      assert.deepEqual(await page.evaluate(() => window.APPROVAL_C_DATA), facts);
      assert.deepEqual(
        await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
        { local: {}, session: {} },
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      effects.push({
        width,
        pointerAndKeyboardDisclosure: true,
        noIdHidden: true,
        sceneClearsNotice: true,
        businessMutation: false,
        http: 0,
        errors: 0,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (!smoke) assert.equal(expected.length, 12);
if (capture) {
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "APPROVAL-DIAGNOSTICS-C-r1",
        approval: "pending",
        kind: "page-request-disclosure-not-Vue",
        sourceHashes,
        sourceEvidence: data,
        actionVisualReferences,
        screenshots,
        observations,
        effects,
        boundary:
          "4 native states + expanded + source no-ID fallback, each at1440/390. One source semantic group, no fake disabled/busy or trace/copy controls. Shared ID overwrite remains unchanged; no real request/decision or ownership fix.",
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P25 页级诊断审核</title>',
      '<style>body{font:16px "Microsoft YaHei",sans-serif;background:#eef3fc;color:#243650;margin:24px}summary{padding:16px;cursor:pointer}img{max-width:100%;height:auto}a{color:#234b9d}</style>',
      '<h1>P25 页级请求编号 · 待审核</h1><p>默认、悬停、键盘焦点、原生按下、展开和无编号回退。仅离线图稿，不是生产请求或独立弹窗请求归属证明。</p><a href="index.html">交互稿</a> · <a href="README.md">范围与差异</a>',
      ...screenshots.map(
        (s) =>
          `<details><summary>${s.scene} · ${s.viewport.width}</summary><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.viewport.width}"></details>`,
      ),
      "</html>",
    ].join("\n"),
  );
} else if (!smoke) {
  assert.deepEqual(previous.observations, observations);
  assert.deepEqual(previous.effects, effects);
  assert.deepEqual(previous.sourceEvidence, data);
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expected,
  );
}
if (!smoke)
  assert.deepEqual(
    (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
    [...expected].sort(),
  );
console.log(
  JSON.stringify({
    passed: true,
    smoke,
    capture,
    observations: observations.length,
    viewports: effects.length,
    sharedIdOverwriteUnfixed: true,
  }),
);
