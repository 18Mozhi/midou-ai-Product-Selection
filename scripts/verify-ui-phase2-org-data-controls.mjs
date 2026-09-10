import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const design = "design-plans/ui-phase-2-2026-09-07/design/org-data-controls";
const original = "design-plans/ui-phase-2-2026-09-07/design/org-data-direction-c";
const output = "output/playwright/p35-controls-review";
const sourceFile = "apps/web/src/components/OrganizationDataPanel.vue";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const retained = JSON.parse(await text(`${original}/evidence.json`));
const sourceHashes = { ...retained.sourceHashes };
for (const [f, sha] of Object.entries(sourceHashes)) assert.equal(hash(await text(f)), sha, f);
for (const shot of retained.screenshots)
  assert.equal(hash(await readFile(`${original}/${shot.file}`)), shot.sha256, shot.file);
for (const f of ["index.html", "controls.js", "controls.css"]
  .map((f) => `${design}/${f}`)
  .concat("scripts/verify-ui-phase2-org-data-controls.mjs", "scripts/lib/ui-phase2-inventory.mjs"))
  sourceHashes[f] = hash(await text(f));
const signatures = scanSource(await text(sourceFile), sourceFile)
  .candidates.map((c) => c.candidateId.split("#")[1])
  .sort();
assert.equal(signatures.length, 10);
let previous;
if (!smoke && !capture) {
  previous = JSON.parse(await text(`${output}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${shot.file}`)), shot.sha256, shot.file);
}
if (capture) await mkdir(output, { recursive: true });
const checks = [],
  interactions = [],
  screenshots = [];
let controls;
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
      await page.goto(pathToFileURL(path.resolve(design, "index.html")).href);
      await page.waitForFunction(() => !!window.ORG_DATA_CONTROLS_C);
      controls = await page.evaluate(() => window.ORG_DATA_CONTROLS_C.controls);
      assert.equal(controls.length, 25);
      assert.deepEqual(
        controls.flatMap((c) => c.signatures).sort(),
        signatures,
        "10 real child actions each mapped once; variants/proposals cannot replace a source action",
      );
      const prepare = (id, variant = "default") =>
        page.evaluate(
          ([id, variant]) => window.ORG_DATA_CONTROLS_C.prepare(id, variant),
          [id, variant],
        );
      const state = () => page.evaluate(() => window.ORG_DATA_C.state());
      for (const c of controls.filter((c) => c.widths.includes(width))) {
        const target = () => page.locator(c.selector).first();
        for (const variant of smoke ? [c.disabledOnly ? "disabled" : "focus"] : c.states) {
          await prepare(c.id, variant);
          await page.mouse.move(0, 0);
          await page.evaluate(() => document.activeElement?.blur());
          const before = await state();
          await target().scrollIntoViewIfNeeded();
          if (variant === "focus") {
            await page.keyboard.press("Tab");
            await target().focus();
          }
          if (["hover", "pressed"].includes(variant)) await target().hover();
          if (variant === "pressed") await page.mouse.down();
          const disabled = ["disabled", "busy"].includes(variant);
          assert.equal(await target().isDisabled(), disabled, `${c.id}/${variant}`);
          if (c.selected !== undefined)
            assert.equal(await target().getAttribute("aria-pressed"), String(c.selected));
          if (c.open !== undefined)
            assert.equal(await target().evaluate((n) => n.parentElement.open), c.open);
          if (c.action === "filters")
            assert.equal(await target().getAttribute("aria-expanded"), String(c.filtersOpen));
          if (["focus", "hover", "pressed"].includes(variant))
            assert.ok(
              await target().evaluate(
                (n, pseudo) => n.matches(pseudo),
                { focus: ":focus-visible", hover: ":hover", pressed: ":active" }[variant],
              ),
            );
          const metrics = await target().evaluate((n) => {
            const r = n.getBoundingClientRect(),
              s = getComputedStyle(n),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(s.fontSize),
              outline: s.outlineColor,
              outlineWidth: s.outlineWidth,
              background: s.backgroundColor,
              hit: hit === n || n.contains(hit),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
          assert.ok(
            metrics.width >= 44 &&
              metrics.height >= 44 &&
              metrics.font >= 16 &&
              metrics.hit &&
              !metrics.overflow,
            JSON.stringify({ c: c.id, variant, width, metrics }),
          );
          if (variant === "focus") {
            assert.equal(metrics.outline, "rgb(40, 94, 199)");
            assert.equal(metrics.outlineWidth, "3px");
          }
          if (disabled) {
            assert.equal(metrics.background, "rgb(230, 235, 241)");
            await target().evaluate((n) => n.click());
          }
          assert.deepEqual(
            await state(),
            before,
            "presentation/disabled clicks do not change facts, filters or intents",
          );
          if (capture) {
            // Browser-native region screenshot with padding retains focus ring and adjacent context.
            const box = await target().boundingBox();
            const x = Math.max(0, box.x - 16),
              y = Math.max(0, box.y - 24);
            const file = `${c.id}-${variant}-${width}.png`;
            await page.screenshot({
              path: `${output}/${file}`,
              clip: {
                x,
                y,
                width: Math.min(width - x, box.width + 32),
                height: Math.min(page.viewportSize().height - y, box.height + 48),
              },
              animations: "disabled",
            });
            screenshots.push({
              file,
              width,
              controlId: c.id,
              variant,
              proposalOnly: !!c.proposalOnly,
              scope: "offline-native-control-region-not-production",
              sha256: hash(await readFile(`${output}/${file}`)),
            });
          }
          checks.push({ controlId: c.id, variant, width, nativeState: true, noSideEffect: true });
          if (variant === "pressed") {
            await page.mouse.move(0, 0);
            await page.mouse.up();
          }
        }
        if (c.disabledOnly) continue;
        await prepare(c.id);
        const before = await state();
        await target().click();
        const after = await state();
        assert.deepEqual(after.data, before.data, "controls never edit data");
        const other = c.kind === "workspace" ? "export" : "workspace";
        if (c.action === "read") {
          assert.deepEqual(after.intents, [
            { method: "GET", path: "/org/admin/summary" },
            { method: "GET", path: "/org/admin/data" },
          ]);
          assert.deepEqual(after.workspace, before.workspace);
          assert.deepEqual(after.export, before.export);
        } else if (c.action === "navigate")
          assert.deepEqual(after.intents, [{ navigation: "/reports" }]);
        else {
          assert.deepEqual(after.intents, []);
          if (c.action === "view") {
            assert.equal(after.view, c.view);
            assert.deepEqual(after.workspace, before.workspace);
            assert.deepEqual(after.export, before.export);
          }
          if (c.action === "page") {
            assert.equal(after[c.kind].page, before[c.kind].page + c.delta);
            assert.deepEqual(after[other], before[other]);
          }
          if (c.action === "reset") {
            assert.equal(after[c.kind].query, "");
            assert.equal(after[c.kind].page, 1);
            assert.equal(
              after[c.kind].sort,
              c.kind === "workspace" ? "total_desc" : "created_desc",
            );
            assert.deepEqual(after[other], before[other]);
          }
          if (c.action === "technical") {
            assert.equal(await target().evaluate((n) => n.parentElement.open), !c.open);
            assert.deepEqual(after, before);
            await target().focus();
            await page.keyboard.press("Space");
            assert.equal(await target().evaluate((n) => n.parentElement.open), c.open);
          }
          if (c.action === "filters") {
            assert.equal(after.filtersOpen, !before.filtersOpen);
            assert.deepEqual(after[c.kind], before[c.kind]);
          }
        }
        interactions.push({ controlId: c.id, width, action: c.action, checked: true });
      }
      for (const [id, name] of [
        ["view-workspaces-selected", "workspace-composition"],
        ["technical-open", "export-details-composition"],
      ]) {
        await prepare(id);
        assert.equal(await page.locator("dialog,[role=dialog]").count(), 0);
        assert.equal(await page.locator("a[download],a[href*='file_url']").count(), 0);
        if (capture) {
          const file = `${name}-${width}.png`;
          if (name === "export-details-composition")
            await page
              .locator(".export-row")
              .first()
              .screenshot({ path: `${output}/${file}` });
          else await page.screenshot({ path: `${output}/${file}`, fullPage: true });
          screenshots.push({
            file,
            width,
            scope: "offline-composition-not-production",
            sha256: hash(await readFile(`${output}/${file}`)),
          });
        }
      }
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (!smoke && !capture) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(interactions, previous.interactions);
  assert.deepEqual(controls, previous.controls);
}
if (capture) {
  const evidence = {
    pageId: "P35",
    status: "pending-user-review",
    scope: "offline-design-controls-not-mounted-Vue-API-SQL-or-production",
    sourceHashes,
    retainedOriginalImages: retained.screenshots.length,
    sourceSignatures: signatures,
    controls,
    checks,
    interactions,
    screenshots,
    businessDialogs: 0,
    businessWrites: 0,
    externalRequests: 0,
    pageErrors: 0,
  };
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const labels = {
    default: "默认",
    hover: "悬停",
    focus: "键盘焦点",
    pressed: "按下",
    disabled: "禁用",
    busy: "忙碌",
  };
  const entries = controls
    .map(
      (c) =>
        `<section><h2>${c.label}${c.proposalOnly ? "（新增提案）" : ""}</h2><div>${screenshots
          .filter((s) => s.controlId === c.id)
          .map(
            (s) =>
              `<figure><figcaption>${s.width}px · ${labels[s.variant]}</figcaption><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${c.label} ${labels[s.variant]} ${s.width}px"></a></figure>`,
          )
          .join("")}</div></section>`,
    )
    .join("");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P35 控件审核图册</title><style>body{margin:24px;background:#edf1f6;color:#202c3d;font:16px/1.6 'Microsoft YaHei',sans-serif}section{background:white;padding:20px;margin:24px 0}section>div{display:flex;gap:16px;flex-wrap:wrap}figure{margin:0;max-width:100%;border:1px solid #dbe1e9}figcaption{padding:8px}img{max-width:100%;height:auto}a{color:#254a9c}h2{font-size:20px}</style><h1>P35 组织数据 · 25控件/变体审核</h1><p>设计提案，非生产截图。10个真实子组件动作逐一映射；6个新增便捷入口单列提案。手机悬停是390px窄视口鼠标态，不代表触屏hover。禁用/忙碌只在真实场景有条件时展示，不虚构只读操作的提交状态。</p><p><a href="../../../${design}/index.html">交互原型</a> · <a href="evidence.json">证据清单</a></p>${entries}<h2>页面组合</h2>${screenshots
      .filter((s) => !s.controlId)
      .map((s) => `<p><a href="${s.file}">${s.file}</a></p>`)
      .join("")}</html>`,
  );
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    controls: controls.length,
    sourceSites: signatures.length,
    checks: checks.length,
    interactions: interactions.length,
    screenshots: capture ? screenshots.length : (previous?.screenshots.length ?? 0),
    oldImagesPreserved: retained.screenshots.length,
    browserClosed: true,
  }),
);
