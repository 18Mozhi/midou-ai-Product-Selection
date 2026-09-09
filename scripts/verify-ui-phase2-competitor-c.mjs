import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { verifyCompetitorSource } from "./verify-ui-phase2-competitor-source.mjs";
import { verifyCompetitorBoundaries } from "./verify-ui-phase2-competitor-boundaries.mjs";

const root = "design-plans/ui-phase-2-2026-09-07/design/competitor-direction-c";
const capture = process.argv.includes("--capture");
const smoke = process.argv.includes("--smoke");
assert.ok(process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)));
assert.ok(!(capture && smoke), "smoke is read-only");
const controlStates = [];
const states = ["default", "hover", "focus", "pressed", "disabled", "busy"];
const controls = [
  {
    key: "collect",
    actionId: "CP-COLLECT",
    pageId: "P19",
    ready: "directory",
    disabled: "paused",
    busy: "collect-busy",
  },
  {
    key: "create",
    actionId: "CP-CREATE-SUBMIT",
    pageId: "P19",
    ready: "create-confirm",
    disabled: "create-busy",
    busy: "create-busy",
  },
  {
    key: "rule",
    actionId: "CP-RULE-SUBMIT",
    pageId: "P20",
    ready: "rule-global",
    disabled: "rule-busy",
    busy: "rule-busy",
  },
  {
    key: "delete",
    actionId: "CP-DELETE-SUBMIT",
    pageId: "P19",
    ready: "delete",
    disabled: "delete-busy",
    busy: "delete-busy",
  },
].map((control) => ({ ...control, selector: `[data-action="${control.actionId}"]` }));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const files = [
  "apps/web/src/components/CompetitorMonitor.vue",
  "apps/web/src/components/shared/monitoring-readiness.ts",
  "apps/api/src/competitor-service.ts",
  "apps/api/src/competitor-routes.ts",
  "apps/api/src/mysql-competitor-repository.ts",
  "apps/worker/src/competitor-monitor-worker.ts",
  "tests/e2e/m04-05-competitors.spec.ts",
  "tests/e2e/ui-phase2-competitor-races.spec.ts",
  "design-plans/ui-phase-2-2026-09-07/competitor-contract-review.md",
  "design-plans/ui-phase-2-2026-09-07/DIRECTION-DECISION-C.md",
  "scripts/verify-ui-phase2-competitor-source.mjs",
  "scripts/verify-ui-phase2-competitor-boundaries.mjs",
  "scripts/verify-ui-phase2-competitor-c.mjs",
  ...["index.html", "competitor.css", "competitor.js"].map((f) => root + "/" + f),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [f, hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
  ),
);
const sourceProof = await verifyCompetitorSource();
const boundaryProof = await verifyCompetitorBoundaries();
let old;
if (!capture && !smoke) {
  old = JSON.parse(await readFile(root + "/evidence.json", "utf8"));
  assert.deepEqual(old.sourceHashes, sourceHashes);
  for (const s of old.screenshots)
    assert.equal(hash(await readFile(root + "/" + s.file)), s.sha256);
}
const screenshots = [],
  errors = [],
  http = [],
  checks = [],
  actions = new Set();
const browser = await chromium.launch({ headless: true });
let scenes;
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " horizontal overflow",
  );
  const bad = await page
    .locator(
      "#app button,#app a,#app summary,#modal button,#modal input,#modal select,#modal textarea",
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => n.getClientRects().length)
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.height < 43.9 || r.width < 43.9 || parseFloat(getComputedStyle(n).fontSize) < 16;
        })
        .map((n) => n.textContent.slice(0, 40)),
    );
  assert.deepEqual(bad, [], label + " touch/font");
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size);
  if (await page.locator("dialog[open]").count()) {
    const r = await page.locator("dialog").boundingBox(),
      vp = page.viewportSize();
    assert.ok(
      r.x >= 0 && r.y >= 0 && r.x + r.width <= vp.width + 1 && r.y + r.height <= vp.height + 1,
      label + " dialog bounds",
    );
    assert.ok(await page.getByRole("dialog").getAttribute("aria-labelledby"));
  }
}
async function shot(page, width, scene, pageId, control) {
  const file = `${width}-${scene}.png`;
  if (capture) {
    await page.screenshot({
      path: root + "/" + file,
      fullPage: !control && !(await page.locator("dialog[open]").count()),
      animations: "disabled",
    });
    screenshots.push({
      file,
      width,
      pageId,
      scene,
      ...(control ? { control, captureScope: "viewport-with-control-context" } : {}),
      sha256: hash(await readFile(root + "/" + file)),
    });
  } else if (!smoke)
    assert.ok(
      old.screenshots.some((s) => s.file === file),
      file,
    );
}
function contrast(foreground, background) {
  const luminance = (rgb) => {
    const values = rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const n = v / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
async function verifyControls(page, width) {
  const count = () => page.evaluate(() => window.competitorReview.intents.length);
  const choose = (id) =>
    page.evaluate((scene) => {
      window.competitorReview.outcome = "success";
      window.competitorReview.choose(scene);
    }, id);
  for (const control of controls) {
    for (const state of states) {
      const baseScene = control[state] || control.ready;
      await page.mouse.move(0, 0);
      await choose(baseScene);
      const target = page.locator(control.selector);
      assert.equal(await target.count(), 1);
      await target.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.activeElement?.blur());
      const before = await count();
      assert.equal(await target.isDisabled(), ["disabled", "busy"].includes(state));
      if (["hover", "pressed"].includes(state)) {
        await target.hover();
        assert.ok(await target.evaluate((el) => el.matches(":hover")));
      }
      if (state === "focus") {
        await page.keyboard.press("Tab");
        await target.focus();
        assert.ok(await target.evaluate((el) => el.matches(":focus-visible")));
        assert.equal(await target.evaluate((el) => getComputedStyle(el).outlineWidth), "3px");
      }
      if (state === "pressed") {
        await page.mouse.down();
        assert.ok(await target.evaluate((el) => el.matches(":active")));
        assert.notEqual(await target.evaluate((el) => getComputedStyle(el).boxShadow), "none");
      }
      if (state === "busy") {
        assert.equal(await target.getAttribute("aria-busy"), "true");
        assert.match(await target.innerText(), /正在/);
        assert.equal(
          await target.evaluate((el) => getComputedStyle(el, "::before").animationName),
          "none",
        );
      }
      if (state === "disabled") {
        const bg = await target.evaluate((el) => getComputedStyle(el).backgroundColor);
        await target.hover({ force: true });
        assert.equal(await target.evaluate((el) => getComputedStyle(el).backgroundColor), bg);
        await page.mouse.move(0, 0);
      }
      const colors = await target.evaluate((el) => {
        const s = getComputedStyle(el);
        return { foreground: s.color, background: s.backgroundColor };
      });
      const ratio = contrast(colors.foreground, colors.background);
      assert.ok(ratio >= 4.5, control.key + "/" + state + " text contrast " + ratio);
      await layout(page, `control-${control.key}-${state}/${width}`);
      const record = {
        key: control.key,
        actionId: control.actionId,
        state,
        baseScene,
        selector: control.selector,
        scene: `control-${control.key}-${state}`,
        width,
        contrast: ratio,
      };
      controlStates.push(record);
      await shot(page, width, record.scene, control.pageId, record);
      if (state === "pressed") {
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      if (["disabled", "busy"].includes(state)) {
        const rect = await target.boundingBox();
        await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      }
      assert.equal(await count(), before, "preview must not submit " + control.key + "/" + state);
    }
    // Exercise the real offline click/submit path, not just a forced busy CSS class.
    await choose(control.ready);
    await page.evaluate(() => {
      window.competitorReview.outcome = "pending";
    });
    const before = await count();
    await page.locator(control.selector).click();
    assert.equal(await count(), before + 1);
    const target = page.locator(control.selector);
    assert.equal(await target.isDisabled(), true);
    assert.equal(await target.getAttribute("aria-busy"), "true");
    await target.dispatchEvent("click");
    if (control.key !== "collect") {
      await page.locator("#modal form").dispatchEvent("submit");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 1);
    }
    assert.equal(await count(), before + 1, "pending reentry must not add intent");
    await page.evaluate(() => {
      window.competitorReview.outcome = "success";
    });
  }
  await choose("pending");
  assert.equal(await page.locator('[data-action="CP-COLLECT"]').getAttribute("aria-busy"), null);
  assert.match(await page.locator('[data-action="CP-COLLECT"]').innerText(), /采集中/);
  checks.push(
    `${width}: four exact primary selectors x six representative states; native hover/focus/press, disabled no-click, contrast >=4.5, reduced motion, actual offline submit-to-pending and explicit event reentry guard; collection POST pending != accepted task running; not real Vue`,
  );
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
      locale: "zh-CN",
    });
    try {
      await context.route(/^https?:/, (r) => {
        http.push(r.request().url());
        return r.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(pathToFileURL(path.resolve(root, "index.html")).href);
      await page.evaluate(() => document.body.classList.add("capture"));
      scenes = await page.evaluate(() => window.competitorReview.scenes);
      await verifyControls(page, width);
      if (smoke) continue;
      const choose = async (id) => {
        await page.evaluate((v) => window.competitorReview.choose(v), id);
        await layout(page, width + ":" + id);
      };
      const click = (id) => page.locator(`[data-action="${id}"]`).first().click();
      const count = () => page.evaluate(() => window.competitorReview.intents.length);
      const last = () => page.evaluate(() => window.competitorReview.intents.at(-1));
      for (const s of scenes) {
        await choose(s.id);
        for (const id of await page
          .locator("[data-action]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.action)))
          actions.add(id);
        await shot(page, width, s.id, s.pageId);
      }
      await choose("directory");
      const source = page.locator("[data-action=CP-SOURCE]");
      assert.equal(await source.getAttribute("rel"), "noopener noreferrer");
      assert.equal(await source.getAttribute("target"), "_blank");
      await page.locator("#search").fill("没有结果");
      await page.getByRole("heading", { name: "没有匹配的竞品" }).waitFor();
      await click("CP-SEARCH-CLEAR");
      assert.equal(await page.locator(".object").count(), 3);
      await choose("deep-link");
      assert.equal(await page.locator(".object").count(), 1);
      await page.locator("#search").fill("absent");
      assert.equal(await page.locator(".object").count(), 0);
      await choose("readonly");
      assert.equal(
        await page
          .locator(
            "[data-action=CP-COLLECT],[data-action=CP-CREATE-OPEN],[data-action=CP-TASK-CREATE]",
          )
          .count(),
        0,
      );
      await click("CP-RULE-NAV-CURRENT");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(await page.locator("[data-action=CP-RULE-OPEN]").count(), 0);
      await choose("task-only");
      await click("CP-TASK-CREATE");
      assert.equal((await last()).path, "/tasks");
      assert.equal((await last()).body.priority, "high");
      assert.equal(await page.locator("[data-action=CP-TASK-LINK]").count(), 1);
      await choose("pending");
      assert.equal(await page.locator("[data-action=CP-COLLECT]").isDisabled(), true);
      await choose("paused");
      assert.equal(await page.locator("[data-action=CP-COLLECT]").isDisabled(), true);
      await choose("rules");
      assert.ok(!(await page.locator(".rule-row").allTextContents()).join(" ").includes("USD"));
      assert.equal(await page.locator(".rule-row button").count(), 0);
      await choose("directory");
      await page.locator("[data-action=CP-MORE] summary").click();
      await layout(page, "more");
      await shot(page, width, "more-open", "P19");
      await click("CP-DELETE-OPEN");
      const before = await count();
      await page.locator("textarea").fill("   ");
      await click("CP-DELETE-SUBMIT");
      assert.equal(await count(), before);
      await page.getByRole("alert").waitFor();
      await shot(page, width, "delete-required", "P19");
      await page.locator("textarea").fill("  重复监控  ");
      await page.evaluate(() => (window.competitorReview.outcome = "error"));
      await click("CP-DELETE-SUBMIT");
      assert.deepEqual((await last()).body, { expected_revision: 7, reason: "重复监控" });
      assert.equal(await page.locator("textarea").inputValue(), "  重复监控  ");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(
        await page
          .locator("[data-action=CP-DELETE-OPEN]")
          .evaluate((n) => n === document.activeElement),
        true,
      );
      await click("CP-DELETE-OPEN");
      assert.equal(await page.locator("textarea").inputValue(), "");
      await page.keyboard.press("Escape");
      await click("CP-CREATE-OPEN");
      await page.locator("[name=product_url]").fill("bad");
      const b = await count();
      await click("CP-CREATE-SUBMIT");
      assert.equal(await count(), b);
      assert.equal(
        await page.locator("[name=product_url]").evaluate((n) => n.validity.valid),
        false,
      );
      await shot(page, width, "create-invalid", "P19");
      await page.locator("[name=product_url]").fill("https://www.amazon.com/dp/B000000019");
      await click("CP-CREATE-SUBMIT");
      await page.locator("[name=title]").fill("保留名称");
      await click("CP-CREATE-SUBMIT");
      assert.equal(await count(), b);
      await click("CP-CREATE-SUBMIT");
      assert.deepEqual(Object.keys((await last()).body).sort(), ["market", "product_url", "title"]);
      await page.keyboard.press("Escape");
      await click("CP-CREATE-OPEN");
      await click("CP-CREATE-SUBMIT");
      assert.equal(await page.locator("[name=title]").inputValue(), "保留名称");
      await page.keyboard.press("Escape");
      await choose("rule-global");
      await page.locator("[name=threshold_value]").fill("0");
      await click("CP-RULE-SUBMIT");
      assert.deepEqual((await last()).body, {
        competitor_id: null,
        metric: "price",
        direction: "decrease",
        threshold_value: 0,
      });
      await page.keyboard.press("Escape");
      await click("CP-RULE-OPEN");
      assert.equal(await page.locator("[name=threshold_value]").inputValue(), "1");
      await page.locator("[name=metric]").selectOption("availability");
      assert.equal(await page.locator("[name=threshold_value]").count(), 0);
      assert.equal(await page.locator("[name=direction]").inputValue(), "change");
      await page.locator("[name=direction]").selectOption("became_unavailable");
      await click("CP-RULE-SUBMIT");
      assert.deepEqual((await last()).body, {
        competitor_id: null,
        metric: "availability",
        direction: "became_unavailable",
      });
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        assert.ok(await page.evaluate(() => document.activeElement.closest("dialog")));
      }
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Shift+Tab");
        assert.ok(await page.evaluate(() => document.activeElement.closest("dialog")));
      }
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(
        await page
          .locator("[data-action=CP-RULE-OPEN]")
          .evaluate((n) => n === document.activeElement),
        true,
      );
      await choose("create-busy");
      const busyBefore = await count();
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 1);
      assert.equal(await count(), busyBefore);
      await choose("directory");
      await click("CP-CREATE-OPEN");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await page.locator("[data-action=CP-CREATE-OPEN]").focus();
      await shot(page, width, "button-focus", "P19");
      await page.locator("[data-action=CP-CREATE-OPEN]").hover();
      await shot(page, width, "button-hover", "P19");
      await choose("rules-unknown");
      assert.match(await page.locator(".notice").innerText(), /规则状态未知/);
      await choose("partial");
      assert.match(await page.locator(".evidence").innerText(), /0 \/ 未采到/);
      assert.match(await page.locator(".delta").innerText(), /币种未采到/);
      checks.push(
        `${width}: scenes/layout, search/deep link, independent permissions, pending/paused, source link, no rule writes beyond create, create validation/retention, rule threshold omission/null/zero/reset, delete trim/retention/cancel, keyboard trap/return/Escape/backdrop, busy guard, hover/focus; all intents inert`,
      );
    } finally {
      await context.close();
    }
  }
  if (!smoke) {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1000 },
      reducedMotion: "reduce",
    });
    try {
      await context.route(/^https?:/, (r) => {
        http.push(r.request().url());
        return r.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(pathToFileURL(path.resolve(root, "index.html")).href);
      await page.evaluate(() => document.body.classList.add("capture"));
      for (const width of [320, 519, 520, 521, 619, 620, 621, 768, 819, 820, 821, 1024]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const id of [
          "directory",
          "rules",
          "create-market",
          "rule-availability",
          "delete-error",
        ]) {
          await page.evaluate((v) => window.competitorReview.choose(v), id);
          await layout(page, width + ":" + id);
        }
      }
      for (const width of [768, 1024]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const id of ["directory", "rules"]) {
          await page.evaluate((v) => window.competitorReview.choose(v), id);
          await shot(page, width, id, id === "rules" ? "P20" : "P19");
        }
      }
      await page.setViewportSize({ width: 720, height: 500 });
      await page.evaluate(() => window.competitorReview.choose("rule-target"));
      await layout(page, "200%-equivalent-reflow");
      checks.push(
        "12 widths x5 representative scenes; 720x500 CSS-pixel reflow equivalent only, not actual browser zoom/assistive technology",
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(http, []);
  if (capture) {
    const evidence = {
      proposal: "COMPETITOR-C-r1",
      kind: "page-or-section-proposal",
      approval: "pending-user-review",
      baselineRevision: "7e589620ee9b321c489754afa739fba109c302f1",
      sourceHashes,
      sourceProof,
      boundaryProof,
      scenes,
      screenshots,
      controlStates,
      actionVisualReferences: Object.fromEntries(
        controls.map((control) => [
          control.actionId,
          {
            selector: control.selector,
            scope: "representative-control-only-not-all-variants-or-Vue",
            pageId: control.pageId,
            states: Object.fromEntries(
              states.map((state) => [state, `control-${control.key}-${state}`]),
            ),
            limitation:
              control.key === "collect"
                ? "paused represents disabled; POST in-flight differs from accepted queued/running task"
                : "disabled and busy use the same source busy condition; no invented independent business blocker; create is final step, rule is global price, delete is populated reason",
          },
        ]),
      ),
      actionIds: [...actions].sort(),
      checks,
      errors,
      http,
      limits: [
        "Synthetic offline HTML, not real Vue template/backend/SQL/worker/notification acceptance.",
        "CP-B02/B03 ownership is locally fixed and source-regressed; other source gaps remain. No global action/dialog denominator or approval promotion.",
        "History-window scene elides middle98 rows; all-history/long-list lifecycle remains unverified.",
        "Three-theme/two-density matrix is representative P19 only, not every dialog/P20 combination.",
        "Four primary controls have 24 representative states at two widths; dialog disabled and busy share one real busy condition. Not all control variants/fields/themes or P20 create-query background.",
      ],
    };
    await writeFile(root + "/evidence.json", JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      root + "/gallery.html",
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>竞品 C 图册</title><style>
body{margin:24px;font:16px/1.7 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d}nav{display:flex;gap:16px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}figure{margin:0;background:white;padding:16px;border-radius:12px}img{width:100%;height:420px;object-fit:contain;object-position:top}
a{color:#254a9c}figcaption{overflow-wrap:anywhere}</style>
<h1>P19 / P20 · C 方向正式待审图册</h1><p>合成样本，不连接生产；不是页面批准或实施证明。</p>
<nav><a href="index.html">交互原型</a><a href="README.md">边界与复验</a></nav>
<main>${screenshots.map((s) => `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.pageId} ${s.scene} ${s.width}"></a><figcaption>${s.pageId} · ${s.scene} · ${s.width}px</figcaption></figure>`).join("")}</main></html>\n`,
    );
  }
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : smoke ? "smoke" : "check",
      scenes: scenes.length,
      screenshots: capture ? screenshots.length : smoke ? 0 : old.screenshots.length,
      controlStates: controlStates.length,
      sourceChecks: sourceProof.checks.length,
      actions: actions.size,
      checks,
      http: http.length,
      errors: errors.length,
    }),
  );
} finally {
  await browser.close();
}
