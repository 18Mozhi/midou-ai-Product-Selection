import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { verifySourcingSource } from "./verify-ui-phase2-sourcing-source.mjs";

const root = "design-plans/ui-phase-2-2026-09-07/design/sourcing-direction-c";
const capture = process.argv.includes("--capture");
const smoke = process.argv.includes("--smoke");
assert.ok(process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)));
assert.ok(!(capture && smoke), "capture and smoke are exclusive");
const states = ["default", "hover", "focus", "pressed", "disabled", "busy"];
const controls = [
  { key: "search", actionId: "SC-S-SUBMIT", ready: "search-keyword", domId: "SC-SEARCH-SUBMIT" },
  { key: "quote", actionId: "SC-QUOTE-SUBMIT", ready: "quote", domId: "SC-QUOTE-SUBMIT" },
  {
    key: "purchase",
    actionId: "SC-PURCHASE-SUBMIT",
    ready: "purchase",
    domId: "SC-PURCHASE-SUBMIT",
  },
  { key: "delete", actionId: "SC-DELETE-SUBMIT", ready: "delete", domId: "SC-DELETE-SUBMIT" },
].map((control) => ({
  ...control,
  selector: '#modal button[data-action="' + control.domId + '"]',
}));
const controlStates = [];
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sourcePaths = [
  ...[
    "SourcingWorkspace.vue",
    "SourcingWorkspaceDialogs.vue",
    "SourcingComparisonPanel.vue",
    "SourcingCostConfirmationPanel.vue",
    "OpportunityProfitPanel.vue",
    "OpportunityCostReviewQueue.vue",
    "sourcing-workspace-types.ts",
  ].map((f) => "apps/web/src/components/" + f),
  "apps/api/src/sourcing-service.ts",
  "apps/api/src/mysql-sourcing-repository.ts",
  "apps/api/src/sourcing-routes.ts",
  "tests/e2e/m04-06-sourcing.spec.ts",
  "design-plans/ui-phase-2-2026-09-07/sourcing-cost-contract-review.md",
  "design-plans/ui-phase-2-2026-09-07/DIRECTION-DECISION-C.md",
  "scripts/verify-ui-phase2-sourcing-source.mjs",
  "scripts/verify-ui-phase2-sourcing-c.mjs",
  ...["index.html", "sourcing.css", "sourcing.js"].map((f) => root + "/" + f),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (f) => [f, hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
  ),
);
const sourceProof = await verifySourcingSource();
let old;
if (!capture && !smoke) {
  old = JSON.parse(await readFile(root + "/evidence.json", "utf8"));
  assert.deepEqual(old.sourceHashes, sourceHashes);
  for (const s of old.screenshots)
    assert.equal(hash(await readFile(root + "/" + s.file)), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  errors = [],
  http = [],
  checks = [],
  actions = new Set();
let scenes;
async function layout(page, label) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " overflow",
  );
  const bad = await page
    .locator(
      "#app button,#app a,#app summary,.check,#modal button,#modal input,#modal select,#modal textarea",
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => n.getClientRects().length)
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.width < 43.9 || r.height < 43.9 || parseFloat(getComputedStyle(n).fontSize) < 16;
        })
        .map((n) => n.textContent.slice(0, 30)),
    );
  assert.deepEqual(bad, [], label + " touch/font");
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size);
  if (await page.locator("dialog[open]").count()) {
    const r = await page.locator("dialog").boundingBox(),
      v = page.viewportSize();
    assert.ok(
      r.x >= 0 && r.y >= 0 && r.x + r.width <= v.width + 1 && r.y + r.height <= v.height + 1,
      label + " dialog bounds",
    );
  }
}
async function shot(page, width, scene, control) {
  const file = `${width}-${scene}.png`;
  if (capture) {
    await page.screenshot({
      path: root + "/" + file,
      fullPage: !(await page.locator("dialog[open]").count()),
      animations: "disabled",
    });
    screenshots.push({
      file,
      pageId: "P21",
      width,
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
    const c = rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const n = value / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
async function verifyControls(page, width) {
  const count = () => page.evaluate(() => window.sourcingReview.intents.length);
  const prepare = async (control) => {
    await page.evaluate((scene) => {
      window.sourcingReview.outcome = "success";
      window.sourcingReview.choose(scene);
    }, control.ready);
    if (control.key === "quote") {
      await page.locator("[name=specification]").fill("30x20cm / 1pc");
      await page.locator("[name=moq]").fill("100");
      await page.locator("[name=lead_time_days]").fill("7");
    }
    if (control.key === "delete") await page.locator("#modal [name=reason]").fill("重复找货记录");
    assert.equal(await page.locator("#modal-form").evaluate((form) => form.checkValidity()), true);
  };
  for (const control of controls) {
    for (const state of states) {
      await page.mouse.move(0, 0);
      await prepare(control);
      const target = page.locator(control.selector);
      assert.equal(await target.count(), 1);
      let pending = state === "busy" || (state === "disabled" && control.key !== "purchase");
      if (pending) {
        await page.evaluate(() => (window.sourcingReview.outcome = "pending"));
        const before = await count();
        await target.click();
        assert.equal(await count(), before + 1, "valid pending snapshot records one intent");
      } else if (state === "disabled") {
        await page.locator("[name=quantity]").fill("99");
        assert.match(await page.locator("#modal-submit-hint").innerText(), /少于最小起订量 100/);
      }
      await target.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.activeElement?.blur());
      const before = await count();
      assert.equal(await target.isDisabled(), ["disabled", "busy"].includes(state));
      assert.equal(await target.getAttribute("aria-busy"), String(pending));
      assert.equal(await target.getAttribute("aria-describedby"), "modal-submit-hint");
      if (["hover", "pressed"].includes(state)) {
        await target.hover();
        assert.ok(await target.evaluate((el) => el.matches(":hover")));
      }
      if (state === "focus") {
        await page.keyboard.press("Tab");
        await target.focus();
        assert.ok(await target.evaluate((el) => el.matches(":focus-visible")));
        assert.equal(await target.evaluate((el) => getComputedStyle(el).outlineWidth), "3px");
        assert.equal(
          await target.evaluate((el) => getComputedStyle(el).outlineColor),
          "rgb(25, 59, 128)",
        );
      }
      if (state === "pressed") {
        await page.mouse.down();
        assert.ok(await target.evaluate((el) => el.matches(":active")));
        assert.notEqual(await target.evaluate((el) => getComputedStyle(el).boxShadow), "none");
      }
      if (pending) {
        assert.match(await target.innerText(), /正在/);
        assert.match(await page.locator("#modal-submit-hint").innerText(), /尚未确认|尚未.*确认/);
        assert.equal(
          await target.evaluate((el) => getComputedStyle(el, "::before").animationName),
          "none",
        );
      }
      if (["disabled", "busy"].includes(state)) {
        const background = await target.evaluate((el) => getComputedStyle(el).backgroundColor);
        await target.hover({ force: true });
        assert.equal(
          await target.evaluate((el) => getComputedStyle(el).backgroundColor),
          background,
        );
        await page.mouse.move(0, 0);
      }
      const colors = await target.evaluate((el) => {
        const s = getComputedStyle(el);
        return { foreground: s.color, background: s.backgroundColor, opacity: s.opacity };
      });
      const ratio = contrast(colors.foreground, colors.background);
      assert.equal(colors.opacity, "1");
      assert.ok(ratio >= 4.5, control.key + "/" + state + " contrast " + ratio);
      await layout(page, width + "/" + control.key + "/" + state);
      const rect = await target.boundingBox();
      assert.ok(
        rect.y >= 6 && rect.y + rect.height <= page.viewportSize().height - 6,
        `control/focus inside viewport ${width}/${control.key}/${state}: ${JSON.stringify(rect)}`,
      );
      assert.ok(
        await target.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return [
            [r.left + 6, r.top + 6],
            [r.right - 6, r.top + 6],
            [r.left + 6, r.bottom - 6],
            [r.right - 6, r.bottom - 6],
          ].every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
        }),
        `all four inset button corners visible ${width}/${control.key}/${state}`,
      );
      const record = {
        key: control.key,
        actionId: control.actionId,
        selector: control.selector,
        state,
        baseScene: control.ready,
        pageId: "P21",
        width,
        scene: "control-" + control.key + "-" + state,
        contrast: ratio,
        condition: pending
          ? "request-in-flight"
          : state === "disabled"
            ? "quantity-below-current-quote-moq"
            : "valid-input",
      };
      controlStates.push(record);
      await shot(page, width, record.scene, record);
      if (state === "pressed") {
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      if (["disabled", "busy"].includes(state)) {
        await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      }
      assert.equal(await count(), before, "preview/disabled click must not submit");
      if (pending) {
        await page.keyboard.press("Escape");
        assert.equal(
          await page.locator("dialog[open]").count(),
          1,
          "in-flight close lock is proposal only",
        );
        await page
          .locator("#modal-form")
          .evaluate((form) =>
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
          );
        assert.equal(await count(), before, "pending duplicate intent rejected");
      }
    }
    await prepare(control);
    const before = await count();
    await page.evaluate(() => (window.sourcingReview.outcome = "pending"));
    await page.locator(control.selector).focus();
    await page.keyboard.press("Enter");
    assert.equal(await count(), before + 1, "keyboard submit exactly once");
    const last = await page.evaluate(() => window.sourcingReview.intents.at(-1));
    const expected = {
      search: {
        path: "/sourcing/searches",
        method: "POST",
        body: { input_type: "keyword", input_ref: "桌面收纳托盘" },
      },
      quote: {
        path: "/sourcing/quotes",
        method: "POST",
        body: {
          candidate_id: "00000000-0000-4000-8000-000000000102",
          moq: 100,
          specification: "30x20cm / 1pc",
          lead_time_days: 7,
          location: "广东",
          confidence_value: 80,
          stability_status: "unknown",
          risk_level: "unknown",
          observed_at: "2026-09-09T00:00:00.000Z",
          evidence_id: "00000000-0000-4000-8000-000000000202",
        },
      },
      purchase: {
        path: "/sourcing/purchase-tasks",
        method: "POST",
        body: {
          quote_id: "00000000-0000-4000-8000-000000000300",
          quantity: 100,
          reason: "从供应链找货页面创建采购任务",
        },
      },
      delete: {
        path: "/sourcing/searches/00000000-0000-4000-8000-000000000021",
        method: "DELETE",
        body: { reason: "重复找货记录" },
      },
    };
    assert.deepEqual(last, expected[control.key], "exact inert intent, not actual API execution");
    assert.equal(
      await page.locator("#modal-submit-hint").evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Enter");
    assert.equal(await count(), before + 1);
    if (control.key === "purchase") {
      await prepare(control);
      await page.locator("#modal [name=reason]").fill(" ");
      assert.equal(await page.locator(control.selector).isDisabled(), true);
      await page.locator("#modal [name=reason]").fill("核对报价");
      assert.equal(await page.locator(control.selector).isDisabled(), false);
    } else {
      await prepare(control);
      const field = { search: "input_ref", quote: "specification", delete: "reason" }[control.key];
      await page.locator('#modal [name="' + field + '"]').fill("");
      assert.equal(
        await page.locator(control.selector).isDisabled(),
        false,
        "required is not an invented disabled rule",
      );
      const beforeInvalid = await count();
      await page.locator("#modal-form").evaluate((form) => form.requestSubmit());
      assert.equal(
        await count(),
        beforeInvalid,
        "native required validation prevents an empty submit",
      );
    }
  }
}
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
        await page.evaluate((v) => window.sourcingReview.choose(v), id);
        await layout(page, width + ":" + id);
      };
      const click = (id) => page.locator(`[data-action="${id}"]`).first().click();
      const count = () => page.evaluate(() => window.sourcingReview.intents.length),
        last = () => page.evaluate(() => window.sourcingReview.intents.at(-1));
      scenes = await page.evaluate(() => window.sourcingReview.scenes);
      for (const s of scenes) {
        await choose(s.id);
        for (const a of await page
          .locator("[data-action]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.action)))
          actions.add(a);
        await shot(page, width, s.id);
        if (await page.locator("dialog[open]").count()) {
          const overflow = await page
            .locator("dialog")
            .evaluate((n) => n.scrollHeight > n.clientHeight + 2);
          if (overflow) {
            await page.locator("dialog").evaluate((n) => (n.scrollTop = n.scrollHeight));
            await shot(page, width, s.id + "-lower");
          }
        }
      }
      await choose("workspace");
      await page.locator("#search").fill("无匹配");
      await page.getByRole("heading", { name: "没有匹配的找货记录" }).waitFor();
      await click("SC-SEARCH-CLEAR");
      assert.equal(await page.locator(".record").count(), 2);
      await page.getByRole("tab", { name: "货源候选" }).focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.getByRole("tab", { name: "报价对比" }).getAttribute("aria-selected"),
        "true",
      );
      await page.keyboard.press("End");
      assert.equal(
        await page.getByRole("tab", { name: "机会成本" }).getAttribute("aria-selected"),
        "true",
      );
      await choose("keyword-record");
      assert.equal(await page.getByRole("tab", { name: "机会成本" }).count(), 0);
      await choose("readonly");
      assert.equal(
        await page
          .locator(
            "[data-action=SC-S-OPEN],[data-action=SC-SELECT],[data-action=SC-REFRESH],[data-action=SC-QUOTE-OPEN],[data-action=SC-PURCHASE-OPEN]",
          )
          .count(),
        0,
      );
      await choose("cost-only");
      assert.equal(await page.locator("[data-action=SC-PURCHASE-OPEN]").count(), 0);
      await page.getByRole("tab", { name: "机会成本" }).click();
      assert.equal(await page.locator("#cost-form").count(), 1);
      await choose("select-five");
      assert.equal(await page.locator("input[type=checkbox]:checked").count(), 5);
      await page.locator("input[type=checkbox]").nth(5).click();
      assert.equal(await page.locator("input[type=checkbox]:checked").count(), 5);
      await shot(page, width, "sixth-rejected");
      await click("SC-COMPARE");
      assert.equal((await last()).body.quote_ids.length, 5);
      assert.equal(new Set((await last()).body.quote_ids).size, 5);
      await page.locator("input[type=checkbox]").first().uncheck();
      assert.equal(await page.locator("input[type=checkbox]:checked").count(), 4);
      await choose("select-one");
      assert.equal(await page.locator("[data-action=SC-COMPARE]").isDisabled(), true);
      for (const kind of ["keyword", "image", "opportunity", "product_url"]) {
        await choose("search-" + kind);
        const n = await count();
        await page.locator("[name=input_ref]").fill("");
        await click("SC-SEARCH-SUBMIT");
        assert.equal(await count(), n);
        await page.locator("[name=input_ref]").fill("  保留输入  ");
        await page.keyboard.press("Escape");
        assert.equal(await count(), n);
        await click("SC-S-OPEN");
        assert.equal(await page.locator("[name=input_ref]").inputValue(), "  保留输入  ");
        await page.evaluate(() => (window.sourcingReview.outcome = "error"));
        await click("SC-SEARCH-SUBMIT");
        assert.deepEqual((await last()).body, { input_type: kind, input_ref: "  保留输入  " });
        assert.equal(await page.locator("dialog[open]").count(), 1);
      }
      await choose("quote");
      await page.locator("[name=specification]").fill("30x20cm / 1pc");
      await page.locator("[name=moq]").fill("100");
      await page.locator("[name=confidence_value]").fill("0");
      await page.locator("[name=stability_status]").selectOption("variable");
      await click("SC-QUOTE-SUBMIT");
      const q = (await last()).body;
      assert.equal(q.confidence_value, 0);
      assert.equal(q.stability_status, "variable");
      assert.equal(q.observed_at, "2026-09-09T00:00:00.000Z");
      assert.ok(!("quoted_price" in q));
      assert.ok(!("currency" in q));
      assert.equal(await page.locator("[name=moq]").inputValue(), "100");
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press("Tab");
        assert.ok(await page.evaluate(() => document.activeElement.closest("dialog")));
      }
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press("Shift+Tab");
        assert.ok(await page.evaluate(() => document.activeElement.closest("dialog")));
      }
      await choose("workspace");
      await click("SC-PURCHASE-OPEN");
      const b = await count();
      await page.locator("[name=quantity]").fill("99");
      assert.equal(await page.locator("[data-action=SC-PURCHASE-SUBMIT]").isDisabled(), true);
      assert.equal(await count(), b);
      await shot(page, width, "purchase-below-moq");
      await page.locator("[name=quantity]").fill("100");
      await page.locator("textarea").fill("  核实报价  ");
      await click("SC-PURCHASE-SUBMIT");
      assert.equal((await last()).body.quantity, 100);
      assert.equal((await last()).body.reason, "核实报价");
      assert.equal((await last()).body.quote_id.endsWith("000000000300"), true);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(
        await page
          .locator("[data-action=SC-PURCHASE-OPEN]")
          .first()
          .evaluate((n) => n === document.activeElement),
        true,
      );
      await click("SC-PURCHASE-OPEN");
      assert.equal(
        await page.locator("[name=reason]").inputValue(),
        "从供应链找货页面创建采购任务",
      );
      await page.keyboard.press("Escape");
      await page.locator(".more summary").click();
      await click("SC-DELETE-OPEN");
      const d = await count();
      await page.locator("textarea").fill("   ");
      await click("SC-DELETE-SUBMIT");
      assert.equal(await count(), d);
      await page.locator("textarea").fill("  重复记录  ");
      await click("SC-DELETE-SUBMIT");
      assert.deepEqual((await last()).body, { reason: "重复记录" });
      await page.keyboard.press("Escape");
      await click("SC-DELETE-OPEN");
      assert.equal(await page.locator("textarea").inputValue(), "  重复记录  ");
      await page.keyboard.press("Escape");
      await choose("cost-missing");
      assert.equal(await page.locator(".profit-number").count(), 0);
      const form = page.locator("#cost-form");
      await form.locator("[name=source_ref_id]").fill("quote-id");
      await form.locator("[name=evidence_id]").fill("00000000-0000-4000-8000-000000000200");
      await form.locator("[name=reviewer_id]").selectOption({ index: 1 });
      await click("SC-COST-SUBMIT");
      const body = (await last()).body;
      assert.equal(body.amount_value, 0);
      assert.equal(body.expected_version, 7);
      assert.equal(body.observed_at, "2026-09-09T00:00:00.000Z");
      assert.ok(body.reviewer_id);
      assert.equal(await page.locator(".profit-number").count(), 0);
      await click("SC-COST-RECALCULATE");
      assert.deepEqual((await last()).body, { platform: "amazon", expected_version: 7 });
      for (const decision of ["approved", "rejected"]) {
        await choose("cost-review-" + decision);
        await page.locator("#review-form textarea").fill("  核对原始证据  ");
        await click("SC-COST-REVIEW");
        assert.deepEqual((await last()).body, {
          decision,
          reason: "核对原始证据",
          expected_version: 3,
        });
        const n = await count();
        await click("SC-REVIEW-CANCEL");
        assert.equal(await count(), n);
        assert.equal(await page.locator("#review-form").count(), 0);
      }
      await choose("cost-reviewers-empty");
      assert.equal(await page.locator("[data-action=SC-COST-SUBMIT]").isDisabled(), true);
      await choose("search-busy");
      const n = await count();
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 1);
      assert.equal(await count(), n);
      await choose("workspace");
      await click("SC-S-OPEN");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await page.locator("[data-action=SC-S-OPEN]").focus();
      await shot(page, width, "button-focus");
      await page.locator("[data-action=SC-S-OPEN]").hover();
      await shot(page, width, "button-hover");
      assert.equal(
        await page.locator("[data-action=SC-SOURCE]").first().getAttribute("rel"),
        "noopener noreferrer",
      );
      await verifyControls(page, width);
      checks.push(
        `${width}: four submit controls x six states; real pointer/keyboard pseudo states, >=4.5 text contrast, unoccluded corners, exact inert keyboard payload, pending duplicate guard/close lock proposal, required versus disabled/MOQ distinctions`,
      );
      checks.push(
        `${width}: all scenes, tabs/search/roles; max5, four input kinds, quote exact fields/zero/local instant, MOQ/reason/reset, delete trim/retention, independent cost/review versions, no numeric ROI on missing, busy/Escape/backdrop/focus return/trap; no real writes`,
      );
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({
    viewport: { width: 768, height: 1000 },
    reducedMotion: "reduce",
    timezoneId: "America/New_York",
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
    for (const width of [320, 519, 520, 521, 768, 819, 820, 821, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const id of ["workspace", "comparison", "cost-missing", "quote", "purchase"]) {
        await page.evaluate((v) => window.sourcingReview.choose(v), id);
        await layout(page, width + ":" + id);
      }
    }
    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const id of ["workspace", "cost-calculated"]) {
        await page.evaluate((v) => window.sourcingReview.choose(v), id);
        await shot(page, width, id);
      }
    }
    await page.evaluate(() => window.sourcingReview.choose("quote"));
    assert.equal(await page.locator("[name=observed_at]").inputValue(), "2026-09-08T20:00");
    await page.setViewportSize({ width: 720, height: 500 });
    await layout(page, "equivalent200-reflow");
    checks.push(
      "nine widths x5 representative surfaces; New York quote local display; 720x500 equivalent reflow only, not actual browser zoom or complete timezone/assistive technology coverage",
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
          proposal: "SOURCING-C-r1",
          kind: "page-or-section-proposal",
          approval: "pending-user-review",
          baselineRevision: "b30fb8a2f07a84825037a4a52dba7796109801c5",
          sourceHashes,
          sourceProof,
          scenes,
          screenshots,
          controlStates,
          pageActionVisualReferences: {
            P21: Object.fromEntries(
              controls.map((control) => [
                control.actionId,
                {
                  pageId: "P21",
                  selector: control.selector,
                  scope: "representative-control-only-not-all-variants-or-Vue",
                  states: Object.fromEntries(
                    states.map((state) => [state, "control-" + control.key + "-" + state]),
                  ),
                  limitation:
                    control.key === "purchase"
                      ? "disabled uses current MOQ; busy is request in-flight, not accepted purchase task; full reason/field variants pending"
                      : "disabled and busy are the same source busy condition, not a new business restriction; other inputs/variants remain pending",
                },
              ]),
            ),
          },
          actionIds: [...actions].sort(),
          checks,
          http,
          errors,
          limits: [
            "Offline synthetic HTML only, not Vue/SQL/RBAC/collection/purchase/notification acceptance.",
            "All-state/role/theme/dialog/lifecycle denominators unproven; P22 remains separate and unfinished.",
            "No production edits, approval promotion or new dependencies.",
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
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P21 供应链 C 图册</title>
<style>body{margin:24px;font:16px/1.7 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}figure{margin:0;background:white;padding:16px;border-radius:12px}img{width:100%;height:420px;object-fit:contain;object-position:top}a{color:#254a9c}figcaption{overflow-wrap:anywhere}</style>
<h1>P21 · SOURCING-C-r1 待审图册</h1><p>合成样本，不连接生产。具体图稿待审核，不是实施完成证明。</p><p><a href="index.html">交互原型</a> · <a href="README.md">边界与复验</a></p><main>${cards}</main></html>\n`;
    await writeFile(root + "/gallery.html", html);
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
