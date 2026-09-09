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
const secondaryControls = controls.flatMap((submit) =>
  ["close", "cancel"].map((variant) => ({
    key: submit.key + "-" + variant,
    actionId: submit.key === "search" ? "SC-S-CLOSE" : "SC-" + submit.key.toUpperCase() + "-CLOSE",
    ready: submit.ready,
    selector: '#modal button[data-close-variant="' + variant + '"]',
    submitSelector: submit.selector,
    parentKey: submit.key,
    secondary: true,
    variantOnly: variant === "cancel",
  })),
);
const allControls = [...controls, ...secondaryControls];
const mainControls = [
  {
    key: "main-search-open",
    actionId: "SC-S-OPEN",
    selector: '#app .scope > [data-action="SC-S-OPEN"]',
    kind: "entry",
    heading: "发起供应商找货",
  },
  {
    key: "main-quote-open",
    actionId: "SC-QUOTE-OPEN",
    selector: '#app [data-action="SC-QUOTE-OPEN"]',
    kind: "entry",
    heading: "确认完整供应商报价",
  },
  {
    key: "main-purchase-open",
    actionId: "SC-PURCHASE-OPEN",
    selector: '#app [data-action="SC-PURCHASE-OPEN"][data-offer$="000000000100"]',
    kind: "entry",
    heading: "创建采购任务",
  },
  {
    key: "main-delete-open",
    actionId: "SC-DELETE-OPEN",
    selector: '#app [data-action="SC-DELETE-OPEN"]',
    kind: "entry",
    heading: "删除找货记录",
    more: true,
  },
  {
    key: "main-record-current",
    actionId: "SC-DETAIL",
    selector: '#app [data-action="SC-DETAIL"][data-record$="000000000021"]',
    kind: "record",
    recordId: "00000000-0000-4000-8000-000000000021",
  },
  {
    key: "main-select",
    actionId: "SC-SELECT",
    selector: '#app input[data-action="SC-SELECT"][data-offer$="000000000100"]',
    kind: "checkbox",
    checked: false,
  },
  {
    key: "main-compare",
    actionId: "SC-COMPARE",
    selector: '#app [data-action="SC-COMPARE"]',
    kind: "write",
    ready: "select-two",
    states,
  },
  {
    key: "main-refresh",
    actionId: "SC-REFRESH",
    selector: '#app [data-action="SC-REFRESH"]',
    kind: "write",
    states,
  },
  {
    key: "main-purchase-second",
    actionId: "SC-PURCHASE-OPEN",
    selector: '#app [data-action="SC-PURCHASE-OPEN"][data-offer$="000000000101"]',
    kind: "entry",
    heading: "创建采购任务",
    variantOnly: true,
  },
  {
    key: "main-record-other",
    actionId: "SC-DETAIL",
    selector: '#app [data-action="SC-DETAIL"][data-record$="000000000022"]',
    kind: "record",
    recordId: "00000000-0000-4000-8000-000000000022",
    variantOnly: true,
  },
  {
    key: "main-select-checked",
    actionId: "SC-SELECT",
    selector: '#app input[data-action="SC-SELECT"][data-offer$="000000000100"]',
    kind: "checkbox",
    ready: "select-one",
    checked: true,
    variantOnly: true,
  },
].map((control) => ({ ready: "workspace", states: states.slice(0, 4), ...control }));
const navigationControls = [
  { key: "nav-self", actionId: "SC-NAV-SELF", domId: "SC-NAV-SELF", href: "/sourcing" },
  {
    key: "nav-rules",
    actionId: "SC-NAV-RULES",
    domId: "SC-NAV-RULES",
    href: "/sourcing/cost-rules",
  },
  {
    key: "nav-context",
    actionId: "SC-NAV-RULES-CONTEXT",
    domId: "SC-RULES",
    href:
      "/sourcing/cost-rules?from=" +
      encodeURIComponent("/sourcing?record=00000000-0000-4000-8000-000000000021"),
  },
  {
    key: "nav-collection",
    actionId: "SC-NAV-COLLECTION",
    domId: "SC-COLLECTION",
    ready: "platform-inspect",
    href: "/platform-admin/collection?task=00000000-0000-4000-8000-000000000070",
  },
  {
    key: "nav-erp",
    actionId: "SC-ERP",
    domId: "SC-ERP",
    ready: "erp",
    href: "https://example.com/synthetic-erp",
    external: true,
  },
  {
    key: "nav-source",
    actionId: "SC-SOURCE",
    domId: "SC-SOURCE",
    href: "https://example.com/synthetic-supplier/1",
    external: true,
  },
  {
    key: "nav-opportunity",
    actionId: "SC-NAV-OPPORTUNITY",
    domId: "SC-OPPORTUNITY",
    ready: "cost-missing",
    href: "/opportunities/00000000-0000-4000-8000-000000000018?tab=profit&from=/sourcing",
  },
  {
    key: "nav-profit-rules",
    actionId: "SC-NAV-PROFIT-RULES",
    domId: "SC-PROFIT-RULES",
    ready: "cost-missing",
    href: "/sourcing/cost-rules",
  },
  {
    key: "nav-source-second",
    actionId: "SC-SOURCE",
    domId: "SC-SOURCE",
    href: "https://example.com/synthetic-supplier/2",
    external: true,
    variantOnly: true,
  },
  {
    key: "nav-source-unconfirmed",
    actionId: "SC-SOURCE",
    domId: "SC-SOURCE",
    href: "https://example.com/synthetic-supplier/3",
    external: true,
    variantOnly: true,
  },
  {
    key: "nav-context-query",
    actionId: "SC-NAV-RULES-CONTEXT",
    domId: "SC-RULES",
    query: "桌面",
    href:
      "/sourcing/cost-rules?from=" +
      encodeURIComponent(
        "/sourcing?record=00000000-0000-4000-8000-000000000021&q=" + encodeURIComponent("桌面"),
      ),
    variantOnly: true,
  },
].map((control) => ({
  ready: "workspace",
  kind: "navigation",
  states: states.slice(0, 4),
  ...control,
  selector:
    '#app a[data-action="' +
    control.domId +
    '"]' +
    (control.actionId === "SC-SOURCE" ? '[href="' + control.href + '"]' : ""),
}));
const recoveryControls = [
  {
    key: "recovery-error-primary",
    ready: "error",
    variant: "primary",
    result: "load",
    variantOnly: false,
  },
  { key: "recovery-error-secondary", ready: "error", variant: "secondary", result: "load" },
  { key: "recovery-expired-primary", ready: "expired", variant: "primary", result: "load" },
  ...["forbidden", "rate-limited", "blocked"].flatMap((ready) =>
    ["primary", "secondary"].map((variant) => ({
      key: "recovery-" + ready + "-" + variant,
      ready,
      variant,
      result: "load",
    })),
  ),
  { key: "recovery-empty-primary", ready: "empty", variant: "primary", result: "open" },
  { key: "recovery-empty-secondary", ready: "empty", variant: "secondary", result: "clear" },
  {
    key: "recovery-empty-readonly-primary",
    ready: "empty-readonly",
    variant: "primary",
    result: "load",
  },
  {
    key: "recovery-empty-readonly-secondary",
    ready: "empty-readonly",
    variant: "secondary",
    result: "clear",
  },
  {
    key: "recovery-search-primary",
    ready: "search-empty",
    variant: "primary",
    result: "clear",
    variantOnly: false,
  },
  { key: "recovery-search-secondary", ready: "search-empty", variant: "secondary", result: "open" },
  {
    key: "recovery-search-readonly-primary",
    ready: "search-empty-readonly",
    variant: "primary",
    result: "clear",
  },
  {
    key: "recovery-search-readonly-secondary",
    ready: "search-empty-readonly",
    variant: "secondary",
    result: "load",
  },
].map((control) => ({
  kind: "recovery",
  states: states.slice(0, 4),
  variantOnly: true,
  ...control,
  actionId: control.ready.startsWith("search-empty") ? "SC-SEARCH-RECOVERY" : "SC-STATE",
  selector: '#app .empty [data-recovery="' + control.variant + '"]',
}));
const navigationRecoveryControls = [...navigationControls, ...recoveryControls];
const costControls = [
  {
    key: "cost-submit",
    actionId: "SC-COST-SUBMIT",
    selector: "#cost-form [data-action=SC-COST-SUBMIT]",
    operation: "input",
    ready: "cost-missing",
    states,
  },
  {
    key: "cost-recalculate",
    actionId: "SC-COST-RECALCULATE",
    selector: "#cost-form [data-action=SC-COST-RECALCULATE]",
    operation: "recalculate",
    ready: "cost-missing",
    states,
  },
  {
    key: "cost-open-approved",
    actionId: "SC-COST-REVIEW-OPEN",
    selector: '#cost-panel [data-action=SC-REVIEW-OPEN][data-decision="approved"]',
    operation: "open",
    ready: "cost-overdue",
    decision: "approved",
  },
  {
    key: "cost-review-approved",
    actionId: "SC-COST-REVIEW-SUBMIT",
    selector: "#review-form [data-action=SC-COST-REVIEW]",
    operation: "review",
    ready: "cost-review-approved",
    decision: "approved",
    states,
  },
  {
    key: "cost-cancel-approved",
    actionId: "SC-COST-REVIEW-CANCEL",
    selector: "#review-form [data-action=SC-REVIEW-CANCEL]",
    operation: "cancel",
    ready: "cost-review-approved",
    decision: "approved",
  },
  {
    key: "cost-open-rejected",
    actionId: "SC-COST-REVIEW-OPEN",
    selector: '#cost-panel [data-action=SC-REVIEW-OPEN][data-decision="rejected"]',
    operation: "open",
    ready: "cost-overdue",
    decision: "rejected",
    variantOnly: true,
  },
  {
    key: "cost-review-rejected",
    actionId: "SC-COST-REVIEW-SUBMIT",
    selector: "#review-form [data-action=SC-COST-REVIEW]",
    operation: "review",
    ready: "cost-review-rejected",
    decision: "rejected",
    states,
    variantOnly: true,
  },
  {
    key: "cost-cancel-rejected",
    actionId: "SC-COST-REVIEW-CANCEL",
    selector: "#review-form [data-action=SC-REVIEW-CANCEL]",
    operation: "cancel",
    ready: "cost-review-rejected",
    decision: "rejected",
    variantOnly: true,
  },
].map((control) => ({ kind: "cost", states: states.slice(0, 4), ...control }));
const visualControls = [
  ...allControls,
  ...mainControls,
  ...navigationRecoveryControls,
  ...costControls,
];
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
    "UiStatePanel.vue",
  ].map((f) => "apps/web/src/components/" + f),
  "apps/web/src/ui/state-contract.ts",
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
      fullPage: !control && !(await page.locator("dialog[open]").count()),
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
    if ((control.parentKey || control.key) === "quote") {
      await page.locator("[name=specification]").fill("30x20cm / 1pc");
      await page.locator("[name=moq]").fill("100");
      await page.locator("[name=lead_time_days]").fill("7");
    }
    if ((control.parentKey || control.key) === "delete")
      await page.locator("#modal [name=reason]").fill("重复找货记录");
    assert.equal(await page.locator("#modal-form").evaluate((form) => form.checkValidity()), true);
  };
  for (const control of allControls) {
    for (const state of states) {
      await page.mouse.move(0, 0);
      await prepare(control);
      const target = page.locator(control.selector);
      assert.equal(await target.count(), 1);
      let pending = state === "busy" || (state === "disabled" && control.key !== "purchase");
      if (pending) {
        await page.evaluate(() => (window.sourcingReview.outcome = "pending"));
        const before = await count();
        await page.locator(control.submitSelector || control.selector).click();
        assert.equal(await count(), before + 1, "valid pending snapshot records one intent");
      } else if (state === "disabled") {
        await page.locator("[name=quantity]").fill("99");
        assert.match(await page.locator("#modal-submit-hint").innerText(), /少于最小起订量 100/);
      }
      await target.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.activeElement?.blur());
      const before = await count();
      assert.equal(await target.isDisabled(), ["disabled", "busy"].includes(state));
      assert.equal(
        await target.getAttribute("aria-busy"),
        control.secondary ? null : String(pending),
      );
      assert.equal(
        await target.getAttribute("aria-describedby"),
        control.secondary && !pending ? null : "modal-submit-hint",
      );
      assert.equal(await page.locator("#modal-form").getAttribute("aria-busy"), String(pending));
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
        if (control.secondary) {
          assert.equal(await target.innerText(), control.variantOnly ? "取消" : "×");
          assert.equal(
            await target.evaluate((el) => getComputedStyle(el, "::before").content),
            "none",
          );
        } else assert.match(await target.innerText(), /正在/);
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
    if (control.secondary) {
      await verifyCloseBehavior(page, control, count);
      continue;
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
async function verifyMainControls(page, width) {
  const count = () => page.evaluate(() => window.sourcingReview.intents.length);
  const last = () => page.evaluate(() => window.sourcingReview.intents.at(-1));
  const choose = async (scene) => {
    await page.evaluate((id) => {
      window.sourcingReview.outcome = "success";
      window.sourcingReview.choose(id);
    }, scene);
  };
  const prepare = async (control, state) => {
    await choose(
      state === "disabled" && control.actionId === "SC-COMPARE" ? "select-one" : control.ready,
    );
    if (control.more) await page.locator(".more > summary").click();
  };
  for (const control of mainControls) {
    for (const state of control.states) {
      await page.mouse.move(0, 0);
      await prepare(control, state);
      const target = page.locator(control.selector);
      assert.equal(await target.count(), 1);
      const pending =
        state === "busy" || (state === "disabled" && control.actionId === "SC-REFRESH");
      if (pending) {
        await page.evaluate(() => (window.sourcingReview.outcome = "pending"));
        const n = await count();
        await target.click();
        assert.equal(await count(), n + 1);
      }
      const frame = control.kind === "checkbox" ? target.locator("..") : target;
      await frame.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
      await page.evaluate(() => document.activeElement?.blur());
      const before = await count();
      assert.equal(await target.isDisabled(), ["disabled", "busy"].includes(state));
      if (control.kind === "checkbox") assert.equal(await target.isChecked(), control.checked);
      if (control.kind === "write")
        assert.equal(await target.getAttribute("aria-busy"), String(pending));
      if (["hover", "pressed"].includes(state)) {
        await target.hover();
        assert.ok(await target.evaluate((el) => el.matches(":hover")));
      }
      if (state === "focus") {
        await page.keyboard.press("Tab");
        await target.focus();
        assert.ok(await target.evaluate((el) => el.matches(":focus-visible")));
        assert.equal(await frame.evaluate((el) => getComputedStyle(el).outlineWidth), "3px");
        await frame.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
      }
      if (state === "pressed") {
        await page.mouse.down();
        assert.ok(await target.evaluate((el) => el.matches(":active")));
        assert.notEqual(await frame.evaluate((el) => getComputedStyle(el).boxShadow), "none");
      }
      if (pending) {
        assert.match(await target.innerText(), /正在/);
        assert.match(await page.locator("#main-request-status").innerText(), /尚未确认/);
        assert.equal(
          await target.evaluate((el) => getComputedStyle(el, "::before").animationName),
          "none",
        );
      }
      const colors = await frame.evaluate((el) => {
        const s = getComputedStyle(el);
        let node = el,
          bg = s.backgroundColor;
        while (/^rgba\([^)]*,\s*0\)$/.test(bg) && node.parentElement) {
          node = node.parentElement;
          bg = getComputedStyle(node).backgroundColor;
        }
        return { foreground: s.color, background: bg };
      });
      const ratio = contrast(colors.foreground, colors.background);
      assert.ok(ratio >= 4.5, control.key + "/" + state + " contrast " + ratio);
      if (["disabled", "busy"].includes(state)) {
        await target.hover({ force: true });
        assert.equal(
          await target.evaluate((el) => getComputedStyle(el).backgroundColor),
          colors.background,
        );
        await page.mouse.move(0, 0);
      }
      await layout(page, width + "/" + control.key + "/" + state);
      const rect = await frame.boundingBox();
      assert.ok(
        rect.y >= 6 && rect.y + rect.height <= page.viewportSize().height - 6,
        control.key + "/" + state + " viewport",
      );
      assert.ok(
        await frame.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return [
            [r.left + 6, r.top + 6],
            [r.right - 6, r.top + 6],
            [r.left + 6, r.bottom - 6],
            [r.right - 6, r.bottom - 6],
          ].every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
        }),
        control.key + "/" + state + " unoccluded",
      );
      const record = {
        key: control.key,
        actionId: control.actionId,
        selector: control.selector,
        state,
        scene: "control-" + control.key + "-" + state,
        baseScene: control.ready,
        pageId: "P21",
        width,
        contrast: ratio,
        condition: pending
          ? "request-in-flight-not-task-running"
          : state === "disabled"
            ? "one-quote-selected"
            : "available-control",
      };
      controlStates.push(record);
      await shot(page, width, record.scene, record);
      if (state === "pressed") {
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      if (["disabled", "busy"].includes(state)) await target.evaluate((el) => el.click());
      assert.equal(await count(), before, "state preview must not activate");
    }
    await prepare(control, "default");
    const target = page.locator(control.selector);
    if (control.kind === "entry") {
      const n = await count();
      await target.focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#dialog-title").innerText(), control.heading);
      assert.equal(await count(), n, "opening only, no write");
      if (control.actionId === "SC-PURCHASE-OPEN") {
        assert.match(
          await page.locator(".locked").innerText(),
          control.variantOnly ? /澄木家居制品/ : /南岸收纳用品/,
        );
      }
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
    } else if (control.kind === "record") {
      await choose("select-two");
      await target.focus();
      await page.keyboard.press("Enter");
      assert.deepEqual(await last(), {
        path: "/sourcing/searches/" + control.recordId,
        method: "GET",
      });
      assert.equal(await target.getAttribute("aria-pressed"), "true");
      assert.equal(
        await page.locator("input[type=checkbox]:checked").count(),
        control.variantOnly ? 0 : 2,
      );
    } else if (control.kind === "checkbox") {
      const n = await count();
      await target.focus();
      await page.keyboard.press("Space");
      assert.equal(await target.isChecked(), !control.checked);
      assert.equal(await count(), n, "checkbox is local state, no API write");
    } else {
      await choose("select-two");
      const n = await count();
      await page.evaluate(() => (window.sourcingReview.outcome = "pending"));
      await target.focus();
      await page.keyboard.press("Enter");
      assert.equal(await count(), n + 1);
      const compare = control.actionId === "SC-COMPARE";
      const expected = compare
        ? {
            path: "/sourcing/comparisons",
            method: "POST",
            body: {
              name: "桌面收纳机会 · 货源核对 报价对比",
              quote_ids: [
                "00000000-0000-4000-8000-000000000300",
                "00000000-0000-4000-8000-000000000301",
              ],
            },
          }
        : {
            path: "/sourcing/searches/00000000-0000-4000-8000-000000000021/refresh",
            method: "POST",
            body: {},
          };
      assert.deepEqual(await last(), expected);
      const other = page.locator(
        compare ? '[data-action="SC-REFRESH"]' : '[data-action="SC-COMPARE"]',
      );
      assert.equal(await other.isDisabled(), true);
      assert.equal(
        await other.getAttribute("aria-busy"),
        "false",
        "another command is locked, not submitting itself",
      );
      await target.dispatchEvent("click");
      assert.equal(await count(), n + 1);
      if (compare) {
        await page.locator('input[data-offer$="000000000100"]').uncheck();
        assert.equal(await page.locator("input[type=checkbox]:checked").count(), 1);
        assert.match(await page.locator("#compare-request-status").innerText(), /2 家报价/);
        assert.deepEqual(
          await last(),
          expected,
          "editing selection must not rewrite submitted snapshot",
        );
      }
    }
  }
}
async function verifyNavigationRecovery(page, width) {
  const count = () => page.evaluate(() => window.sourcingReview.intents.length);
  const prepare = async (control) => {
    await page.evaluate((id) => {
      window.sourcingReview.outcome = "success";
      window.sourcingReview.choose(id);
    }, control.ready);
    if (control.query) await page.locator("#search").fill(control.query);
  };
  for (const control of navigationRecoveryControls) {
    for (const state of control.states) {
      await page.mouse.move(0, 0);
      await prepare(control);
      const target = page.locator(control.selector);
      assert.equal(await target.count(), 1, control.key);
      await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
      await page.evaluate(() => document.activeElement?.blur());
      const n = await count();
      assert.equal(await target.isDisabled(), false);
      assert.notEqual(await target.getAttribute("aria-busy"), "true");
      if (control.kind === "navigation") {
        assert.equal(await target.getAttribute("href"), control.href);
        assert.equal(await target.getAttribute("target"), control.external ? "_blank" : null);
        assert.equal(
          await target.getAttribute("rel"),
          control.external ? "noopener noreferrer" : null,
        );
        if (control.key === "nav-self")
          assert.equal(await target.getAttribute("aria-current"), "page");
      }
      if (["hover", "pressed"].includes(state)) {
        await target.hover();
        assert.ok(await target.evaluate((el) => el.matches(":hover")));
      }
      if (state === "focus") {
        await page.keyboard.press("Tab");
        await target.focus();
        assert.ok(await target.evaluate((el) => el.matches(":focus-visible")));
        assert.equal(await target.evaluate((el) => getComputedStyle(el).outlineWidth), "3px");
        await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
      }
      if (state === "pressed") {
        await page.mouse.down();
        assert.ok(await target.evaluate((el) => el.matches(":active")));
        assert.notEqual(await target.evaluate((el) => getComputedStyle(el).boxShadow), "none");
      }
      const colors = await target.evaluate((el) => {
        let ancestor = el;
        let background = getComputedStyle(el).backgroundColor;
        while (/^rgba\([^)]*,\s*0\)$/.test(background) && ancestor.parentElement) {
          ancestor = ancestor.parentElement;
          background = getComputedStyle(ancestor).backgroundColor;
        }
        return { foreground: getComputedStyle(el).color, background };
      });
      const ratio = contrast(colors.foreground, colors.background);
      assert.ok(ratio >= 4.5, control.key + "/" + state + " contrast " + ratio);
      await layout(page, control.key + "/" + state);
      const rect = await target.boundingBox();
      assert.ok(
        rect.y >= 6 && rect.y + rect.height <= page.viewportSize().height - 6,
        control.key + " viewport",
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
        control.key + " unoccluded",
      );
      const record = {
        key: control.key,
        actionId: control.actionId,
        selector: control.selector,
        state,
        scene: "control-" + control.key + "-" + state,
        baseScene: control.ready,
        pageId: "P21",
        width,
        contrast: ratio,
        condition: "source-navigation-or-recovery-no-disabled-busy",
      };
      controlStates.push(record);
      await shot(page, width, record.scene, record);
      if (state === "pressed") {
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      assert.equal(await count(), n, "preview does not activate");
    }
    await prepare(control);
    const n = await count();
    await page.locator(control.selector).focus();
    await page.keyboard.press("Enter");
    if (control.kind === "navigation") {
      assert.equal(await count(), n + 1);
      assert.deepEqual(await page.evaluate(() => window.sourcingReview.intents.at(-1)), {
        path: control.href,
        method: "NAVIGATE",
      });
    } else if (control.result === "load") {
      assert.equal(await count(), n + 1);
      assert.deepEqual(await page.evaluate(() => window.sourcingReview.intents.at(-1)), {
        path: "/sourcing/searches",
        method: "GET",
      });
      assert.equal(await page.locator(".workspace [aria-busy=true]").count(), 1);
      assert.equal(
        await page
          .locator(
            ".recovery-actions button,.record,.workspace [data-action=SC-REFRESH],.workspace [data-action=SC-DELETE-OPEN]",
          )
          .count(),
        0,
      );
      assert.equal(
        await page.locator(".workspace h1").evaluate((el) => document.activeElement === el),
        true,
      );
      assert.match(await page.locator(".scope").innerText(), /记录数量待读取/);
      if (control.ready.endsWith("readonly"))
        assert.equal(await page.locator("[data-action=SC-S-OPEN]").count(), 0);
    } else if (control.result === "open") {
      assert.equal(await count(), n);
      assert.equal(await page.locator("#dialog-title").innerText(), "发起供应商找货");
      await page.keyboard.press("Escape");
    } else {
      assert.equal(await count(), n);
      assert.equal(await page.locator("#search").inputValue(), "");
      assert.equal(
        await page.locator("#search").evaluate((el) => document.activeElement === el),
        true,
      );
      assert.equal(
        await page.locator(".record").count(),
        control.ready.startsWith("empty") ? 0 : 2,
      );
    }
  }
  for (const scene of [
    "loading",
    "empty",
    "empty-readonly",
    "error",
    "expired",
    "forbidden",
    "rate-limited",
    "blocked",
  ]) {
    await prepare({ ready: scene });
    assert.equal(
      await page
        .locator(
          ".record,.workspace [data-action=SC-REFRESH],.workspace [data-action=SC-DELETE-OPEN]",
        )
        .count(),
      0,
    );
    if (scene === "loading")
      assert.equal(await page.locator(".recovery-actions button").count(), 0);
    if (scene === "expired")
      assert.equal(await page.locator(".recovery-actions button").count(), 1);
  }
  for (const scene of ["workspace", "readonly", "keyword-record"]) {
    await prepare({ ready: scene });
    assert.equal(await page.locator("[data-action=SC-COLLECTION]").count(), 0);
    if (scene === "keyword-record")
      assert.equal(
        await page.locator("[data-action=SC-OPPORTUNITY],[data-action=SC-PROFIT-RULES]").count(),
        0,
      );
  }
  await prepare({ ready: "workspace" });
  const n = await count();
  await page.locator("#search").fill(" COMPLETED_WITH_WARNINGS ");
  assert.equal(await page.locator(".record").count(), 2);
  assert.equal(await count(), n);
  checks.push(
    width +
      ": exact navigation destinations and external rel/target; recovery source branches, role-specific empty/search, local clear, loading hides actions/data without inventing disabled/busy; no real router/network/recovery success",
  );
}
async function verifyCostControls(page, width) {
  const count = () => page.evaluate(() => window.sourcingReview.intents.length);
  const last = () => page.evaluate(() => window.sourcingReview.intents.at(-1));
  const choose = async (scene) =>
    page.evaluate((id) => {
      window.sourcingReview.outcome = "success";
      window.sourcingReview.choose(id);
    }, scene);
  const validCost = async () => {
    await page
      .locator("#cost-form [name=source_ref_id]")
      .fill("00000000-0000-4000-8000-000000000300");
    await page
      .locator("#cost-form [name=evidence_id]")
      .fill("00000000-0000-4000-8000-000000000200");
    await page
      .locator("#cost-form [name=reviewer_id]")
      .selectOption("00000000-0000-4000-8000-000000000090");
  };
  const prepare = async (control, state = "default") => {
    await choose(control.ready);
    if (control.operation === "input" && state !== "disabled") await validCost();
    if (["review", "cancel"].includes(control.operation))
      await page
        .locator("#review-form textarea")
        .fill(state === "disabled" ? " x " : "  原始证据已核对  ");
  };
  const expected = (control) => ({
    path:
      "/opportunities/00000000-0000-4000-8000-000000000018/" +
      (control.operation === "input"
        ? "cost-inputs"
        : control.operation === "recalculate"
          ? "profit-runs"
          : "cost-input-reviews/00000000-0000-4000-8000-000000000081/actions"),
    method: "POST",
    body:
      control.operation === "input"
        ? {
            platform: "amazon",
            input_type: "purchase_price",
            amount_value: 0,
            currency: "USD",
            source_type: "supplier_quote",
            source_ref_id: "00000000-0000-4000-8000-000000000300",
            evidence_id: "00000000-0000-4000-8000-000000000200",
            observed_at: "2026-09-09T00:00:00.000Z",
            reviewer_id: "00000000-0000-4000-8000-000000000090",
            expected_version: 7,
          }
        : control.operation === "recalculate"
          ? { platform: "amazon", expected_version: 7 }
          : { decision: control.decision, reason: "原始证据已核对", expected_version: 3 },
  });
  for (const control of costControls) {
    for (const state of control.states) {
      await page.mouse.move(0, 0);
      await prepare(control, state);
      const target = page.locator(control.selector);
      const pending =
        state === "busy" || (state === "disabled" && control.operation === "recalculate");
      if (pending) {
        await page.evaluate(() => (window.sourcingReview.outcome = "pending"));
        await target.click();
        assert.deepEqual(await last(), expected(control));
      }
      await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
      await page.evaluate(() => document.activeElement?.blur());
      const n = await count();
      assert.equal(await target.isDisabled(), ["disabled", "busy"].includes(state));
      if (["input", "review", "recalculate"].includes(control.operation))
        assert.equal(await target.getAttribute("aria-busy"), String(pending));
      else assert.equal(await target.getAttribute("aria-busy"), null);
      if (["hover", "pressed"].includes(state)) {
        await target.hover();
        assert.ok(await target.evaluate((el) => el.matches(":hover")));
      }
      if (state === "focus") {
        await page.keyboard.press("Tab");
        await target.focus();
        assert.ok(await target.evaluate((el) => el.matches(":focus-visible")));
        assert.equal(await target.evaluate((el) => getComputedStyle(el).outlineWidth), "3px");
        await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
      }
      if (state === "pressed") {
        await page.mouse.down();
        assert.ok(await target.evaluate((el) => el.matches(":active")));
        assert.notEqual(await target.evaluate((el) => getComputedStyle(el).boxShadow), "none");
      }
      if (pending) {
        assert.match(await target.innerText(), /正在提交/);
        assert.ok(
          await target.evaluate((el) => {
            const s = getComputedStyle(el);
            return (
              el.getBoundingClientRect().height <=
              parseFloat(s.lineHeight) +
                parseFloat(s.paddingTop) +
                parseFloat(s.paddingBottom) +
                parseFloat(s.borderTopWidth) +
                parseFloat(s.borderBottomWidth) +
                1
            );
          }),
          control.key + " pending label stays on one line",
        );
        assert.match(await page.locator("#cost-request-status").innerText(), /结果尚未确认/);
        assert.equal(
          await target.evaluate((el) => getComputedStyle(el, "::before").animationName),
          "none",
        );
      }
      const colors = await target.evaluate((el) => ({
        foreground: getComputedStyle(el).color,
        background: getComputedStyle(el).backgroundColor,
      }));
      const ratio = contrast(colors.foreground, colors.background);
      assert.ok(ratio >= 4.5, control.key + "/" + state + " contrast " + ratio);
      if (["disabled", "busy"].includes(state)) {
        await target.hover({ force: true });
        assert.equal(
          await target.evaluate((el) => getComputedStyle(el).backgroundColor),
          colors.background,
        );
        await page.mouse.move(0, 0);
      }
      await layout(page, control.key + "/" + state);
      const rect = await target.boundingBox();
      assert.ok(
        rect.y >= 6 && rect.y + rect.height <= page.viewportSize().height - 6,
        control.key + " viewport",
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
        control.key + " unoccluded",
      );
      const record = {
        key: control.key,
        actionId: control.actionId,
        selector: control.selector,
        state,
        scene: "control-" + control.key + "-" + state,
        baseScene: control.ready,
        pageId: "P21",
        width,
        contrast: ratio,
        condition: pending
          ? "cost-request-in-flight-not-effective-result"
          : state === "disabled"
            ? control.operation === "input"
              ? "reviewer-not-selected"
              : "trimmed-reason-too-short"
            : "available-source-condition",
      };
      controlStates.push(record);
      await shot(page, width, record.scene, record);
      if (state === "pressed") {
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      if (["disabled", "busy"].includes(state)) await target.evaluate((el) => el.click());
      assert.equal(await count(), n, "state preview must not write");
    }
    await prepare(control);
    const n = await count();
    const target = page.locator(control.selector);
    if (["open", "cancel"].includes(control.operation)) {
      if (control.operation === "open") {
        await target.focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#review-form textarea").inputValue(), "");
        assert.equal(
          await page
            .locator("#review-form textarea")
            .evaluate((el) => document.activeElement === el),
          true,
        );
        assert.equal(await page.locator("#review-form button[type=submit]").isDisabled(), true);
        assert.match(
          await page.locator("#review-form").innerText(),
          control.decision === "approved" ? /复核说明/ : /驳回原因/,
        );
      } else {
        await target.focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#review-form").count(), 0);
        assert.equal(
          await page
            .locator('[data-action=SC-REVIEW-OPEN][data-decision="' + control.decision + '"]')
            .evaluate((el) => document.activeElement === el),
          true,
        );
      }
      assert.equal(await count(), n);
      continue;
    }
    await page.evaluate(() => (window.sourcingReview.outcome = "pending"));
    await target.focus();
    await page.keyboard.press("Enter");
    assert.equal(await count(), n + 1);
    assert.deepEqual(await last(), expected(control));
    assert.equal(
      await page
        .locator(control.operation === "review" ? "#cost-review-hint" : "#cost-submit-hint")
        .evaluate((el) => document.activeElement === el),
      true,
    );
    assert.equal(
      await page.locator("[data-action=SC-REFRESH]").isDisabled(),
      false,
      "cost does not own sourcing busy",
    );
    const sibling = page.locator(
      control.operation === "recalculate"
        ? "[data-action=SC-COST-SUBMIT]"
        : "[data-action=SC-COST-RECALCULATE]",
    );
    assert.equal(await sibling.isDisabled(), true);
    assert.equal(
      await sibling.getAttribute("aria-busy"),
      "false",
      "shared cost lock is not own submission",
    );
    await target.dispatchEvent("click");
    assert.equal(await count(), n + 1);
    if (control.operation === "input") {
      await page.locator("#cost-form [name=amount_value]").fill("18");
      await page.locator("#cost-form [name=reviewer_id]").selectOption({ index: 1 });
      assert.equal(await target.isDisabled(), true);
      assert.deepEqual(await last(), expected(control));
    } else if (control.operation === "review") {
      await page.locator("#review-form textarea").fill("另一段未发送原因");
      assert.equal(await target.isDisabled(), true);
      assert.deepEqual(await last(), expected(control));
      const cancel = page.locator("[data-action=SC-REVIEW-CANCEL]");
      assert.equal(await cancel.isDisabled(), false);
      await cancel.click();
      assert.equal(await page.locator("#review-form").count(), 0);
      assert.equal(await count(), n + 1);
      assert.match(await page.locator("#cost-request-status").innerText(), /不会改写或撤回/);
      const opposite = control.decision === "approved" ? "rejected" : "approved";
      await page.locator('[data-action=SC-REVIEW-OPEN][data-decision="' + opposite + '"]').click();
      assert.equal(await page.locator("#review-form textarea").inputValue(), "");
      assert.equal(await page.locator("#review-form button[type=submit]").isDisabled(), true);
      assert.equal(
        await page.locator("#review-form button[type=submit]").getAttribute("aria-busy"),
        "false",
      );
      assert.deepEqual(await last(), expected(control));
    }
  }
  await choose("cost-missing");
  await validCost();
  await page.locator("#cost-form [name=evidence_id]").fill("");
  assert.equal(
    await page.locator("#cost-form button[type=submit]").isDisabled(),
    false,
    "required field is native validity, not a new disabled gate",
  );
  let n = await count();
  await page.locator("#cost-form button[type=submit]").click();
  assert.equal(await count(), n);
  await choose("cost-missing");
  await page.evaluate(() => (window.sourcingReview.outcome = "pending"));
  await page.locator("[data-action=SC-REFRESH]").click();
  assert.equal(
    await page.locator("#cost-form input:disabled, #cost-form select:disabled").count(),
    0,
  );
  await validCost();
  assert.equal(await page.locator("[data-action=SC-COST-SUBMIT]").isDisabled(), false);
  assert.equal(await page.locator("[data-action=SC-COST-RECALCULATE]").isDisabled(), false);
  n = await count();
  await page.locator("#cost-form button[type=submit]").click();
  assert.equal(
    await count(),
    n + 1,
    "sourcing pending must not suppress independent cost submission",
  );
  assert.equal((await last()).body.expected_version, 7);
  checks.push(
    width +
      ": cost/review controls use independent busy, own pending versus sibling lock, exact opportunity/review versions and zero amount, native required versus disabled, immutable pending payload, cancel/reopen cannot withdraw sent intent; not production async acceptance",
  );
}
async function verifyCloseBehavior(page, control, count) {
  await page.evaluate(() => {
    window.sourcingReview.outcome = "success";
    window.sourcingReview.choose("workspace");
  });
  const id = {
    search: "SC-S-OPEN",
    quote: "SC-QUOTE-OPEN",
    purchase: "SC-PURCHASE-OPEN",
    delete: "SC-DELETE-OPEN",
  }[control.parentKey];
  if (control.parentKey === "delete") await page.locator(".more > summary").click();
  // Use the second purchase source to catch accidental return to the first same-label button.
  const opener = page
    .locator('[data-action="' + id + '"]')
    .nth(control.parentKey === "purchase" ? 1 : 0);
  const openerHandle = await opener.elementHandle();
  const before = await count();
  await opener.click();
  const field = {
    search: "input_ref",
    quote: "specification",
    purchase: "reason",
    delete: "reason",
  }[control.parentKey];
  await page.locator('#modal [name="' + field + '"]').fill("尚未提交的核对内容");
  if (control.parentKey === "purchase") await page.locator("#modal [name=quantity]").fill("101");
  assert.equal(await page.locator(control.selector).getAttribute("type"), "button");
  await page.locator(control.selector).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  assert.equal(await count(), before, "close must not submit");
  assert.ok(
    await openerHandle.evaluate((el) => el === document.activeElement),
    "return to the exact opener",
  );
  await opener.click();
  const expected = ["search", "delete"].includes(control.parentKey)
    ? "尚未提交的核对内容"
    : control.parentKey === "quote"
      ? ""
      : "从供应链找货页面创建采购任务";
  assert.equal(await page.locator('#modal [name="' + field + '"]').inputValue(), expected);
  if (control.parentKey === "purchase")
    assert.equal(await page.locator("#modal [name=quantity]").inputValue(), "100");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  assert.ok(await openerHandle.evaluate((el) => el === document.activeElement));
  assert.equal(await count(), before, "Escape/reopen only changes local form visibility");
  await openerHandle.dispose();
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
      await verifyMainControls(page, width);
      await verifyNavigationRecovery(page, width);
      await verifyCostControls(page, width);
      checks.push(
        `${width}: main entry/record/checkbox/write controls; exact opening identity and GET/POST intent, current record retains selection, changed record clears, Space toggles only local state, comparison submission snapshot survives changed checkboxes; no task completion proof`,
      );
      checks.push(
        `${width}: four submit controls x six states; real pointer/keyboard pseudo states, >=4.5 text contrast, unoccluded corners, exact inert keyboard payload, pending duplicate guard/close lock proposal, required versus disabled/MOQ distinctions`,
        `${width}: four dialog close/cancel pairs x six states; parent in-flight lock only, no cancel-request spinner; keyboard close/Escape return to exact opener including second purchase button; search/delete draft retained and quote/purchase reprefilled; no close/reopen write`,
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
              visualControls
                .filter((control) => !control.variantOnly)
                .map((control) => [
                  control.actionId,
                  {
                    pageId: "P21",
                    selector: control.selector,
                    scope: "representative-control-only-not-all-variants-or-Vue",
                    states: Object.fromEntries(
                      (control.states || states).map((state) => [
                        state,
                        "control-" + control.key + "-" + state,
                      ]),
                    ),
                    limitation: control.kind
                      ? "Representative source-derived control only; navigation/recovery/local/read/checkbox do not invent disabled/busy. Destinations and inert requests are not router/server acceptance or resolved lifecycle."
                      : control.secondary
                        ? "disabled and busy represent the parent form's in-flight close lock proposal; source Vue permits closing; not a cancelling network command"
                        : control.key === "purchase"
                          ? "disabled uses current MOQ; busy is request in-flight, not accepted purchase task; full reason/field variants pending"
                          : "disabled and busy are the same source busy condition, not a new business restriction; other inputs/variants remain pending",
                  },
                ]),
            ),
          },
          controlVariantReferences: Object.fromEntries(
            visualControls
              .filter((control) => control.variantOnly)
              .map((control) => [
                control.key,
                {
                  pageId: "P21",
                  actionId: control.actionId,
                  selector: control.selector,
                  scope: "additional-control-variant-not-new-action",
                  states: Object.fromEntries(
                    (control.states || states).map((state) => [
                      state,
                      "control-" + control.key + "-" + state,
                    ]),
                  ),
                  limitation: control.kind
                    ? "Additional source/selection variant of the same semantic action, not a new action or runtime acceptance."
                    : "Footer cancel is the same close semantic group; parent busy lock is an unapproved offline proposal, not abort or rollback.",
                },
              ]),
          ),
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
