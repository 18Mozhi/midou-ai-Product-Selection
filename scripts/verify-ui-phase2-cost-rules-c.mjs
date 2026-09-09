import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { verifyCostRulesSource } from "./verify-ui-phase2-cost-rules-source.mjs";

const root = "design-plans/ui-phase-2-2026-09-07/design/cost-rules-direction-c";
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sources = [
  "apps/web/src/components/CostRuleConsole.vue",
  "apps/web/src/components/shared/QualityGateSetupSummary.vue",
  "apps/web/src/use-modal-dialog.ts",
  "apps/api/src/profit-service.ts",
  "apps/api/src/profit-routes.ts",
  "apps/api/src/mysql-profit-repository.ts",
  "tests/e2e/m04-04-profit.spec.ts",
  "design-plans/ui-phase-2-2026-09-07/sourcing-cost-contract-review.md",
  "design-plans/ui-phase-2-2026-09-07/DIRECTION-DECISION-C.md",
  "scripts/verify-ui-phase2-cost-rules-source.mjs",
  "scripts/verify-ui-phase2-cost-rules-c.mjs",
  ...["index.html", "cost-rules.js", "cost-rules.css"].map((f) => root + "/" + f),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [f, hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
  ),
);
const sourceProof = await verifyCostRulesSource();
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(root + "/evidence.json", "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(root + "/" + s.file)), s.sha256);
}
const screenshots = [],
  checks = [],
  errors = [],
  http = [],
  actions = new Set();
let scenes;
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " overflow",
  );
  const bad = await page
    .locator(
      "#app button,#app a,#app input,#app select,#modal button,#modal input,#modal select,#modal textarea",
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => n.getClientRects().length)
        .filter((n) => {
          const b = n.getBoundingClientRect();
          return b.width < 43.9 || b.height < 43.9 || parseFloat(getComputedStyle(n).fontSize) < 16;
        })
        .map((n) => n.outerHTML.slice(0, 100)),
    );
  assert.deepEqual(bad, [], label + " touch/font");
  if (await page.locator("dialog[open]").count()) {
    const b = await page.locator("dialog").boundingBox(),
      v = page.viewportSize();
    assert.ok(
      b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1,
      label + " dialog",
    );
  }
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size, label + " IDs");
}
async function shot(page, width, scene) {
  const file = `${width}-${scene}.png`;
  if (capture) {
    await page.screenshot({
      path: root + "/" + file,
      fullPage: !(await page.locator("dialog[open]").count()),
      animations: "disabled",
    });
    screenshots.push({
      file,
      pageId: "P22",
      width,
      scene,
      sha256: hash(await readFile(root + "/" + file)),
    });
  } else
    assert.ok(
      previous.screenshots.some((s) => s.file === file),
      file,
    );
}
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
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
      const choose = async (id) => {
        await page.evaluate((v) => window.costRulesReview.choose(v), id);
        await layout(page, width + ":" + id);
      };
      const click = (id) => page.locator(`[data-action="${id}"]`).first().click();
      const count = () => page.evaluate(() => window.costRulesReview.intents.length),
        last = () => page.evaluate(() => window.costRulesReview.intents.at(-1));
      scenes = await page.evaluate(() => window.costRulesReview.scenes);
      for (const s of scenes) {
        await choose(s.id);
        for (const a of await page
          .locator("[data-action]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.action)))
          actions.add(a);
        await shot(page, width, s.id);
        if (await page.locator("dialog[open]").count()) {
          if (await page.locator("dialog").evaluate((n) => n.scrollHeight > n.clientHeight + 2)) {
            await page.locator("dialog").evaluate((n) => (n.scrollTop = n.scrollHeight));
            await shot(page, width, s.id + "-lower");
          }
        }
      }
      await choose("directory");
      await page.locator("#search").fill("no-match");
      assert.equal(await page.locator(".version").count(), 0);
      await click("SC-R-RESET");
      assert.equal(await page.locator(".version").count(), 4);
      await page.locator("#filter").selectOption("draft");
      assert.equal(await page.locator(".version").count(), 1);
      assert.equal(await page.locator("[data-action=submit]").count(), 1);
      await choose("page-two");
      assert.equal(await page.locator(".version").count(), 2);
      await click("SC-R-PAGE-PREV");
      assert.equal(await page.locator(".version").count(), 10);
      assert.equal(await page.locator("[data-action=SC-R-PAGE-PREV]").isDisabled(), true);
      await choose("readonly");
      assert.equal(await page.locator("[data-action=SC-R-CREATE],.actions button").count(), 0);
      await choose("manager-only");
      assert.equal(await page.locator(".actions button").count(), 0);
      await choose("selection-only");
      assert.equal(await page.locator("[data-action=selection-approve]").count(), 1);
      assert.equal(await page.locator("[data-action=admin-approve]").count(), 0);
      await choose("one-approved");
      assert.equal(await page.locator("[data-action=selection-approve]").count(), 0);
      await choose("no-rollback");
      assert.equal(await page.locator("[data-action=rollback]").count(), 0);
      await choose("directory");
      await click("SC-R-CREATE");
      const before = await count();
      await page.locator("#create-form button[type=submit]").click();
      assert.equal(await count(), before);
      assert.equal(await page.locator("[name=platform_fee]").inputValue(), "");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(
        await page
          .locator("[data-action=SC-R-CREATE]")
          .evaluate((n) => n === document.activeElement),
        true,
      );
      await choose("create-zero");
      await page.locator("#create-form button[type=submit]").click();
      let b = (await last()).body;
      assert.equal(b.fee_lines.length, 4);
      assert.ok(b.fee_lines.every((f) => f.value === 0));
      assert.deepEqual(b.conversion_rates, []);
      assert.equal(b.automatic_scope, null);
      await page.locator("[name=logistics]").fill("0");
      await page.locator("[name=currency]").fill("EUR");
      await page.locator("#create-form button[type=submit]").click();
      b = (await last()).body;
      assert.equal(b.fee_lines.at(-1).type, "logistics");
      assert.equal(b.fee_lines.at(-1).currency, "EUR");
      await page.keyboard.press("Escape");
      await click("SC-R-CREATE");
      assert.equal(await page.locator("[name=platform_fee]").inputValue(), "");
      for (let i = 0; i < 23; i++) {
        await page.keyboard.press("Tab");
        assert.ok(await page.evaluate(() => document.activeElement.closest("dialog")));
      }
      for (let i = 0; i < 23; i++) {
        await page.keyboard.press("Shift+Tab");
        assert.ok(await page.evaluate(() => document.activeElement.closest("dialog")));
      }
      const variants = [
        ["submit", "submit"],
        ["selection-approve", "approve", "selection_manager"],
        ["selection-reject", "reject", "selection_manager"],
        ["admin-approve", "approve", "organization_admin"],
        ["admin-reject", "reject", "organization_admin"],
        ["publish", "publish"],
        ["rollback", "rollback"],
      ];
      for (const [id, action, role] of variants) {
        await choose(id + "-confirm");
        const n = await count();
        await page.locator("textarea").fill(" ");
        await page.locator("#action-form button[type=submit]").click();
        assert.equal(await count(), n);
        await page.locator("textarea").fill("  核对依据  ");
        await page.locator("#action-form button[type=submit]").click();
        b = (await last()).body;
        assert.deepEqual(b, {
          action,
          reason: "核对依据",
          expected_revision: 7,
          ...(role ? { approval_role: role } : {}),
          ...(action === "rollback" ? { target_rule_id: "rule-2" } : {}),
        });
        assert.equal(await page.locator("textarea").inputValue(), "  核对依据  ");
        await page.keyboard.press("Escape");
        assert.equal(await count(), n + 1);
        await choose(id + "-busy");
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 1);
        assert.equal(await page.locator("#action-form button[type=submit]").isDisabled(), true);
      }
      await choose("create-busy");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 1);
      await choose("exchange-basis");
      assert.equal(
        await page.locator("[data-action=SC-R-SOURCE]").getAttribute("rel"),
        "noopener noreferrer",
      );
      await click("SC-R-SOURCE");
      assert.equal(await page.locator("#app .notice[role=status]").count(), 1);
      await choose("directory");
      await page.locator("[data-action=SC-R-CREATE]").focus();
      await shot(page, width, "button-focus");
      await page.locator("[data-action=SC-R-CREATE]").hover();
      await shot(page, width, "button-hover");
      checks.push(
        `${width}: all scenes; filters/pagination/roles; explicit0/reset/logistics/currency; seven action payloads and busy/cancel/retention; native modal focus containment and return; no HTTP`,
      );
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({
    viewport: { width: 768, height: 1000 },
    timezoneId: "America/New_York",
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
    for (const width of [320, 519, 520, 521, 768, 819, 820, 821, 1024, 1099, 1100, 1101]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const id of ["directory", "long-name", "create-automatic", "rollback-confirm"]) {
        await page.evaluate((v) => window.costRulesReview.choose(v), id);
        await layout(page, width + ":" + id);
      }
    }
    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => window.costRulesReview.choose("directory"));
      await shot(page, width, "directory");
    }
    await page.setViewportSize({ width: 720, height: 500 });
    await page.evaluate(() => window.costRulesReview.choose("create-blank"));
    await layout(page, "equivalent200-reflow");
    const expected = await page.evaluate(() =>
      new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );
    assert.equal(await page.locator("[name=effective_from]").inputValue(), expected);
    checks.push(
      "12 widths x4 representatives and 720x500 equivalent reflow; local date in New York. Not actual browser zoom/assistive-technology or full theme-dialog cross-product proof.",
    );
  } finally {
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(http, []);
  if (capture) {
    await writeFile(
      root + "/evidence.json",
      JSON.stringify(
        {
          proposal: "COST-RULES-C-r1",
          kind: "page-or-section-proposal",
          approval: "pending-user-review",
          baselineRevision: "c79a062616ea0d83e63e004fcf8d5c3acb22974b",
          sourceHashes,
          sourceProof,
          scenes,
          screenshots,
          actionIds: [...actions].sort(),
          checks,
          http,
          errors,
          limits: [
            "Synthetic offline HTML, not production Vue or SQL/real approval/publish/rollback.",
            "Source checks reproduce late read overwrite without fixing it. Modal snapshot/lock/error association only a proposal.",
            "All action/dialog/theme/lifecycle denominators and concrete approval remain pending.",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    const cards = screenshots
      .map(
        (s) =>
          `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.width}"></a><figcaption>${s.scene} · ${s.width}px</figcaption></figure>`,
      )
      .join("\n");
    await writeFile(
      root + "/gallery.html",
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P22 费用版本 C 图册</title>
<style>
body{margin:24px;font:16px/1.7 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:24px}
figure{margin:0;background:white;padding:16px;border-radius:12px}img{width:100%;height:420px;object-fit:contain;object-position:top}
a{color:#254a9c}figcaption{overflow-wrap:anywhere}
</style><h1>P22 · COST-RULES-C-r1 待审图册</h1><p>合成样本 · 不连接生产 · 具体图稿待审核</p><p><a href="index.html">交互原型</a> · <a href="README.md">范围与复验</a></p><main>${cards}</main></html>\n`,
    );
  }
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "check",
      scenes: scenes.length,
      screenshots: capture ? screenshots.length : previous.screenshots.length,
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
