import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { assertRetainedProposalSources } from "./lib/ui-phase2-org-approvals-retained-sources.mjs";

const base = "design-plans/ui-phase-2-2026-09-07/design";
const output = `${base}/org-approvals-controls-direction-c`;
const sourceFile = "apps/web/src/components/OrganizationApprovalPanel.vue";
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke"),
  refreshSources = process.argv.includes("--refresh-sources");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke", "--refresh-sources"].includes(a)) &&
    [capture, smoke, refreshSources].filter(Boolean).length <= 1,
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const parent = JSON.parse(
  await readFile(`${base}/org-approvals-direction-c/evidence.json`, "utf8"),
);
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
for (const file of ["index.html", "controls.js", "controls.css"]
  .map((f) => `${output}/${f}`)
  .concat(
    "scripts/verify-ui-phase2-org-approvals-controls-c.mjs",
    "scripts/lib/ui-phase2-inventory.mjs",
  ))
  sourceHashes[file] = hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n"));
const sourceSignatures = scanSource(await readFile(sourceFile, "utf8"), sourceFile)
  .candidates.map((c) => c.candidateId.split("#")[1])
  .sort();
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  if (refreshSources) assertRetainedProposalSources(previous.sourceHashes, sourceHashes);
  else assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots) {
    assert.match(s.file, /^[a-z_-]+-(1440|390)\.png$/);
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
  }
}
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
      await page.goto(pathToFileURL(path.resolve(output, "index.html")).href);
      await page.waitForFunction(() => !!window.ORG_APPROVAL_CONTROLS_C);
      controls = await page.evaluate(() => window.ORG_APPROVAL_CONTROLS_C.controls);
      assert.deepEqual(
        controls.flatMap((c) => c.signatures).sort(),
        sourceSignatures,
        "each child source control appears exactly once",
      );
      const prepare = (id, variant) =>
        page.evaluate(([i, v]) => window.ORG_APPROVAL_CONTROLS_C.prepare(i, v), [id, variant]);
      const state = () => page.evaluate(() => window.ORG_APPROVALS_C.state());
      const shot = async (scene, extra = {}) => {
        if (!capture) return;
        const file = `${scene}-${width}.png`;
        if (extra.captureSelector)
          await page.locator(extra.captureSelector).screenshot({ path: `${output}/${file}` });
        else await page.screenshot({ path: `${output}/${file}` });
        screenshots.push({
          file,
          scene,
          width,
          pageId: "P34",
          scope: "offline-control-not-vue-or-production",
          sha256: hash(await readFile(`${output}/${file}`)),
          ...extra,
        });
      };
      for (const c of controls.filter((c) => c.widths.includes(width))) {
        const locate = () => page.locator(c.selector).first();
        for (const variant of smoke ? [c.disabledOnly ? "disabled" : "focus"] : c.states) {
          await prepare(c.id, variant);
          const before = await state(),
            target = locate();
          await page.mouse.move(1, 1);
          if (variant === "focus") {
            await page.keyboard.press("Tab");
            await target.focus();
            assert.ok(
              await target.evaluate(
                (n) => n === document.activeElement && n.matches(":focus-visible"),
              ),
            );
          } else await page.evaluate(() => document.activeElement?.blur());
          await target.scrollIntoViewIfNeeded();
          if (["hover", "pressed"].includes(variant)) await target.hover();
          if (variant === "pressed") await page.mouse.down();
          const disabled = ["disabled", "busy"].includes(variant);
          assert.equal(await target.isDisabled(), disabled, `${c.id}/${variant}`);
          if (Object.hasOwn(c, "selected"))
            assert.equal(await target.getAttribute("aria-pressed"), String(c.selected));
          if (Object.hasOwn(c, "open"))
            assert.equal(await target.evaluate((n) => n.parentElement.open), c.open);
          if (c.actionId === "PROPOSAL-FILTERS")
            assert.equal(await target.getAttribute("aria-expanded"), String(c.filtersOpen));
          if (["hover", "pressed"].includes(variant))
            assert.ok(
              await target.evaluate(
                (n, s) => n.matches(s),
                variant === "pressed" ? ":active" : ":hover",
              ),
            );
          const metrics = await target.evaluate((n) => {
            const r = n.getBoundingClientRect(),
              s = getComputedStyle(n),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(s.fontSize),
              hit: hit === n || n.contains(hit),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              outline: s.outlineColor,
              background: s.backgroundColor,
            };
          });
          assert.ok(
            metrics.width >= 44 &&
              metrics.height >= 44 &&
              metrics.font >= 16 &&
              metrics.hit &&
              !metrics.overflow,
            JSON.stringify({ id: c.id, variant, width, metrics }),
          );
          if (variant === "focus") assert.equal(metrics.outline, "rgb(40, 94, 199)");
          if (disabled) {
            assert.equal(metrics.background, "rgb(230, 235, 241)");
            await target.evaluate((n) => n.click());
          }
          assert.deepEqual(
            await state(),
            before,
            "native presentation and disabled clicks preserve data/intent",
          );
          await shot(`${c.id}-${variant}`, {
            control: { id: c.id, actionId: c.actionId, selector: c.selector, variant },
            proposalOnly: Boolean(c.proposalOnly),
          });
          checks.push({ id: c.id, variant, width, nativeStateVerified: true, noSideEffect: true });
          if (variant === "pressed") {
            await page.mouse.move(1, 1);
            await page.mouse.up();
          }
        }
        if (c.disabledOnly) continue;
        await prepare(c.id, "default");
        const before = await state(),
          selectedId = await locate().getAttribute("data-select");
        await locate().click();
        const after = await state();
        if (["OG-REFRESH", "OG-RETRY"].includes(c.actionId)) {
          assert.deepEqual(after.intents, [
            { method: "GET", path: "/org/admin/summary" },
            { method: "GET", path: "/org/admin/approvals" },
          ]);
          assert.deepEqual(after.request, before.request);
          assert.deepEqual(after.template, before.template);
        } else if (c.view) {
          assert.equal(after.view, c.view);
          assert.deepEqual(after.request, before.request);
          assert.deepEqual(after.template, before.template);
          assert.equal(
            await page.locator(`[data-view="${c.view}"]`).getAttribute("aria-pressed"),
            "true",
          );
        } else if (c.delta) {
          assert.equal(after[c.kind].page, before[c.kind].page + c.delta);
          assert.equal(
            after.selected,
            before.selected,
            "pagination must not select a different template",
          );
          assert.equal(
            new URL(page.url()).searchParams.get(`approval_${c.kind}_page`),
            after[c.kind].page === 1 ? null : String(after[c.kind].page),
          );
        } else if (c.actionId.endsWith("-FILTER")) {
          assert.deepEqual(after[c.kind], {
            query: "",
            status: "all",
            workspace: "all",
            resource: "all",
            sort: c.kind === "request" ? "created_desc" : "name_asc",
            page: 1,
          });
          const other = c.kind === "request" ? "template" : "request";
          assert.deepEqual(after[other], before[other]);
          assert.ok(
            await page.locator(`#${c.kind}-query`).evaluate((n) => n === document.activeElement),
          );
        } else if (c.actionId === "OG-A-SELECT") {
          assert.equal(after.selected, selectedId);
          assert.ok(await page.locator("#detail").evaluate((n) => n === document.activeElement));
          assert.equal(await page.evaluate(() => window.ORG_APPROVALS_C.selected().id), selectedId);
        } else if (c.actionId === "OG-TECH")
          assert.equal(await locate().evaluate((n) => n.parentElement.open), !c.open);
        else if (c.href) assert.deepEqual(after.intents, [{ navigation: c.href }]);
        else if (c.actionId === "PROPOSAL-FILTERS") assert.equal(after.filtersOpen, !c.filtersOpen);
        else if (c.actionId === "PROPOSAL-BACK")
          assert.ok(await page.locator("#directory").evaluate((n) => n === document.activeElement));
        else assert.fail(`Unverified control ${c.id}`);
        if (!["OG-REFRESH", "OG-RETRY", "OG-A-LINK"].includes(c.actionId))
          assert.deepEqual(after.intents, []);
        assert.deepEqual(after.items, before.items);
        assert.deepEqual(after.templates, before.templates);
        assert.deepEqual(after.summary, before.summary);
        assert.equal(await page.locator("dialog").count(), 0, "no fabricated business dialog");
        interactions.push({ id: c.id, width, actionId: c.actionId, intents: after.intents });
      }
      for (const scene of ["template_page_two", "template_multi_diff"]) {
        await page.evaluate((s) => window.ORG_APPROVALS_C.scene(s), scene);
        await page.locator("#detail").scrollIntoViewIfNeeded();
        await shot(`composition-${scene}`, {
          scope: "pending-template-detail-composition",
          captureSelector: scene === "template_multi_diff" ? "#detail" : ".paper",
        });
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
  assert.equal(
    screenshots.length,
    controls.reduce((n, c) => n + c.states.length * c.widths.length, 0) + 4,
  );
  const evidence = {
    kind: "ORG-APPROVALS-CONTROLS-C-r1",
    approval: "pending-user-review",
    boundary:
      "Offline control proposal only; 13 child source positions linked exactly once. Parent blocked/conflict, fields, full registry, real Vue C layout and production acceptance remain pending. No business writes or dialogs.",
    sourceHashes,
    sourceFile,
    sourceSignatures,
    controls,
    checks,
    interactions,
    screenshots,
  };
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const figure = (s) =>
    `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.width}px"></a><figcaption>${s.control?.variant || s.scene} / ${s.width}px</figcaption></figure>`;
  const sections = controls
    .map(
      (c) =>
        `<section><h2>${c.label}</h2><p>${c.actionId} · ${c.proposalOnly ? "新增提案入口" : c.parentControl ? "父组件已有读取入口" : "子组件源控件或变体"}</p><div class="shots">${screenshots
          .filter((s) => s.control?.id === c.id)
          .map(figure)
          .join("")}</div></section>`,
    )
    .join("\n");
  await writeFile(
    `${output}/gallery.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P34 审批治理控件图册</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}section{background:white;padding:20px;margin:24px 0;border-left:4px solid #254a9c}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}figure{margin:0}img{max-width:100%;height:350px;object-fit:contain;object-position:top left}a{color:#193b80}</style>
<h1>P34 审批治理 · 逐控件图册</h1><p>${controls.length}个控件/变体，${screenshots.length}张图。手机专有入口不补造桌面图；全部待审核，不代表真实Vue或生产验收。</p>
<p><a href="README.md">来源与边界</a> · <a href="index.html">离线交互</a></p><section><h2>模板详情组合</h2><div class="shots">${screenshots
      .filter((s) => !s.control)
      .map(figure)
      .join("")}</div></section>${sections}</html>`,
  );
} else if (!smoke) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(interactions, previous.interactions);
  if (refreshSources)
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify({ ...previous, sourceHashes }, null, 2) + "\n",
    );
}
console.log(
  JSON.stringify({
    controls: controls.length,
    sourcePositions: sourceSignatures.length,
    checks: checks.length,
    interactions: interactions.length,
    screenshots: screenshots.length,
    browserClosed: true,
    noHttpOrStorage: true,
  }),
);
