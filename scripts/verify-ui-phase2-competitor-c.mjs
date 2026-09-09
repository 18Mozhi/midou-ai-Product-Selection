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
const pointerStates = states.slice(0, 4);
const secondaryControls = [
  {
    key: "create-close",
    actionId: "CP-CREATE-CLOSE",
    pageId: "P19",
    ready: "create-link",
    disabled: "create-busy",
    busy: "create-busy",
    region: "header",
    kind: "close",
  },
  {
    key: "create-cancel",
    actionId: "CP-CREATE-CLOSE",
    pageId: "P19",
    ready: "create-link",
    region: "footer",
    states: pointerStates,
    kind: "close",
    variantOnly: true,
  },
  {
    key: "create-previous",
    actionId: "CP-CREATE-PREVIOUS",
    pageId: "P19",
    ready: "create-market",
    disabled: "create-busy",
    busy: "create-busy",
    region: "footer",
    kind: "previous",
  },
  {
    key: "rule-close",
    actionId: "CP-RULE-CLOSE",
    pageId: "P20",
    ready: "rule-global",
    disabled: "rule-busy",
    busy: "rule-busy",
    region: "header",
    kind: "close",
  },
  {
    key: "rule-cancel",
    actionId: "CP-RULE-CLOSE",
    pageId: "P20",
    ready: "rule-global",
    disabled: "rule-busy",
    busy: "rule-busy",
    region: "footer",
    kind: "close",
    variantOnly: true,
  },
  {
    key: "delete-close",
    actionId: "CP-DELETE-CLOSE",
    pageId: "P19",
    ready: "delete",
    disabled: "delete-busy",
    busy: "delete-busy",
    region: "header",
    kind: "close",
  },
  {
    key: "delete-cancel",
    actionId: "CP-DELETE-CLOSE",
    pageId: "P19",
    ready: "delete",
    disabled: "delete-busy",
    busy: "delete-busy",
    region: "footer",
    kind: "close",
    variantOnly: true,
  },
].map((control) => ({
  ...control,
  selector: `#modal ${control.region} [data-action="${control.actionId}"]`,
}));
const navigationControls = [
  {
    key: "rule-nav",
    actionId: "CP-RULE-NAV",
    pageId: "P19",
    ready: "directory",
    href: "/competitors/monitoring-rules",
  },
  {
    key: "rule-current",
    actionId: "CP-RULE-NAV",
    pageId: "P19",
    ready: "directory",
    href: "/competitors/monitoring-rules?competitor=00000000-0000-4000-8000-000000000019",
    selector: '[data-action="CP-RULE-NAV-CURRENT"]',
    variantOnly: true,
  },
  {
    key: "rule-back",
    actionId: "CP-RULE-BACK",
    pageId: "P20",
    ready: "rules",
    href: "/competitors",
  },
  {
    key: "source",
    actionId: "CP-SOURCE",
    pageId: "P19",
    ready: "directory",
    href: "https://www.amazon.com/dp/B000000019",
  },
].map((control) => ({
  selector: `[data-action="${control.actionId}"]`,
  ...control,
  kind: "navigation",
  states: pointerStates,
}));
const objectControls = [
  {
    key: "detail",
    actionId: "CP-DETAIL",
    kind: "detail",
    selector: '[data-object="00000000-0000-4000-8000-000000000020"]',
    states: pointerStates,
  },
  {
    key: "detail-selected",
    actionId: "CP-DETAIL",
    kind: "detail",
    selector: '[data-object="00000000-0000-4000-8000-000000000019"]',
    states: pointerStates,
    variantOnly: true,
  },
  {
    key: "toggle",
    actionId: "CP-TOGGLE",
    kind: "object-write",
    openMore: true,
    disabled: "task-busy",
    busy: "toggle-busy",
  },
  {
    key: "resume",
    actionId: "CP-TOGGLE",
    kind: "object-write",
    ready: "paused",
    openMore: true,
    disabled: "resume-busy",
    busy: "resume-busy",
    variantOnly: true,
  },
  {
    key: "delete-open",
    actionId: "CP-DELETE-OPEN",
    kind: "object-open",
    openMore: true,
    disabled: "task-busy",
    busy: "task-busy",
  },
  {
    key: "task-create",
    actionId: "CP-TASK-CREATE",
    kind: "object-write",
    disabled: "toggle-busy",
    busy: "task-busy",
  },
  {
    key: "task-review",
    actionId: "CP-TASK-CREATE",
    kind: "object-write",
    selector: '[data-action="CP-TASK-CREATE-REVIEW"]',
    disabled: "toggle-busy",
    busy: "review-task-busy",
    variantOnly: true,
  },
  {
    key: "more",
    actionId: "CP-MORE",
    kind: "disclosure",
    selector: '[data-action="CP-MORE"] > summary',
    states: pointerStates,
  },
  {
    key: "more-expanded",
    actionId: "CP-MORE",
    kind: "disclosure",
    selector: '[data-action="CP-MORE"] > summary',
    states: pointerStates,
    openMore: true,
    variantOnly: true,
  },
  {
    key: "help",
    actionId: "CP-HELP",
    kind: "disclosure",
    selector: '[data-action="CP-HELP"] > summary',
    states: pointerStates,
  },
  {
    key: "help-expanded",
    actionId: "CP-HELP",
    kind: "disclosure",
    selector: '[data-action="CP-HELP"] > summary',
    states: pointerStates,
    openHelp: true,
    variantOnly: true,
  },
  {
    key: "task-link",
    actionId: "CP-TASK-LINK",
    kind: "navigation",
    ready: "task-created",
    href: "/tasks?task=00000000-0000-4000-8000-000000000023",
    states: pointerStates,
  },
].map((control) => ({
  pageId: "P19",
  ready: "directory",
  selector: `[data-action="${control.actionId}"]`,
  ...control,
}));
const recoveryControls = [
  {
    key: "p19-retry",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "error",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "reload",
  },
  {
    key: "p19-back",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "error",
    selector: '.empty [data-action="CP-STATE-SECONDARY"]',
    expect: "back",
  },
  {
    key: "p19-login",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "expired",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "login",
  },
  {
    key: "p19-forbidden-primary",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "forbidden",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "home",
  },
  {
    key: "p19-forbidden-secondary",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "forbidden",
    selector: '.empty [data-action="CP-STATE-SECONDARY"]',
    expect: "home",
  },
  {
    key: "p19-blocked-retry",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "recovery-blocked",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "reload",
  },
  {
    key: "p19-blocked-home",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "recovery-blocked",
    selector: '.empty [data-action="CP-STATE-SECONDARY"]',
    expect: "home",
  },
  {
    key: "p20-retry",
    pageId: "P20",
    actionId: "CP-STATE-RECOVERY",
    ready: "rules-error",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "reload",
  },
  {
    key: "p20-back",
    pageId: "P20",
    actionId: "CP-STATE-RECOVERY",
    ready: "rules-error",
    selector: '.empty [data-action="CP-STATE-SECONDARY"]',
    expect: "back",
  },
  {
    key: "p20-login",
    pageId: "P20",
    actionId: "CP-STATE-RECOVERY",
    ready: "rules-expired",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "login",
  },
  {
    key: "p20-forbidden-primary",
    pageId: "P20",
    actionId: "CP-STATE-RECOVERY",
    ready: "rules-forbidden",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "home",
  },
  {
    key: "p20-forbidden-secondary",
    pageId: "P20",
    actionId: "CP-STATE-RECOVERY",
    ready: "rules-forbidden",
    selector: '.empty [data-action="CP-STATE-SECONDARY"]',
    expect: "home",
  },
  {
    key: "p20-blocked-retry",
    pageId: "P20",
    actionId: "CP-STATE-RECOVERY",
    ready: "rules-blocked",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "reload",
  },
  {
    key: "p20-blocked-home",
    pageId: "P20",
    actionId: "CP-STATE-RECOVERY",
    ready: "rules-blocked",
    selector: '.empty [data-action="CP-STATE-SECONDARY"]',
    expect: "home",
  },
  {
    key: "p20-login-query",
    pageId: "P20",
    actionId: "CP-STATE-RECOVERY",
    ready: "rules-expired-query",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "login",
  },
  {
    key: "p19-empty-create",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "empty",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "create",
  },
  {
    key: "p19-empty-refresh",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "empty",
    selector: '.empty [data-action="CP-STATE-SECONDARY"]',
    expect: "reload",
  },
  {
    key: "p19-empty-readonly-refresh",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "empty-readonly",
    selector: '.empty [data-action="CP-STATE-PRIMARY"]',
    expect: "reload",
  },
  {
    key: "p19-empty-readonly-home",
    pageId: "P19",
    actionId: "CP-STATE-RECOVERY",
    ready: "empty-readonly",
    selector: '.empty [data-action="CP-STATE-SECONDARY"]',
    expect: "home",
  },
  {
    key: "p19-search-clear",
    pageId: "P19",
    actionId: "CP-SEARCH-RECOVERY",
    ready: "search-empty",
    selector: '.empty [data-action="CP-SEARCH-CLEAR"]',
    expect: "clear",
  },
  {
    key: "p19-search-create",
    pageId: "P19",
    actionId: "CP-SEARCH-RECOVERY",
    ready: "search-empty",
    selector: '.empty [data-action="CP-SEARCH-SECONDARY"]',
    expect: "create",
  },
  {
    key: "p19-search-readonly-refresh",
    pageId: "P19",
    actionId: "CP-SEARCH-RECOVERY",
    ready: "search-empty-readonly",
    selector: '.empty [data-action="CP-SEARCH-SECONDARY"]',
    expect: "reload",
  },
].map((control) => ({ ...control, kind: "recovery", states: pointerStates, variantOnly: true }));
const allControls = [
  ...controls,
  ...secondaryControls,
  ...navigationControls,
  ...objectControls,
  ...recoveryControls,
];
const hash = (v) => createHash("sha256").update(v).digest("hex");
const files = [
  "apps/web/src/components/CompetitorMonitor.vue",
  "apps/web/src/components/UiStatePanel.vue",
  "apps/web/src/ui/state-contract.ts",
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
  const prepare = async (control) => {
    for (const [flag, id] of [
      [control.openMore, "CP-MORE"],
      [control.openHelp, "CP-HELP"],
    ]) {
      if (flag && !(await page.locator(`[data-action="${id}"]`).getAttribute("open"))) {
        // Boolean attribute may be an empty string; use the reflected open property.
        if (!(await page.locator(`[data-action="${id}"]`).evaluate((el) => el.open)))
          await page.locator(`[data-action="${id}"] > summary`).click();
      }
    }
  };
  for (const control of allControls) {
    for (const state of control.states || states) {
      const baseScene = control[state] || control.ready;
      await page.mouse.move(0, 0);
      await choose(baseScene);
      await prepare(control);
      const target = page.locator(control.selector);
      assert.equal(await target.count(), 1);
      await target.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.activeElement?.blur());
      const before = await count();
      assert.equal(await target.isDisabled(), ["disabled", "busy"].includes(state));
      if (control.key === "resume")
        assert.match(await page.locator(".detail-head > .badge").innerText(), /已暂停/);
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
        if (control.kind === "object-open") {
          assert.equal(
            await page.locator("[data-object-operation]").getAttribute("aria-busy"),
            "true",
          );
          assert.equal(await target.getAttribute("aria-busy"), null);
        } else if (["close", "previous"].includes(control.kind)) {
          assert.equal(await page.locator("#modal form").getAttribute("aria-busy"), "true");
          assert.equal(
            await target.getAttribute("aria-busy"),
            null,
            "cancel is not a submitting command",
          );
        } else {
          assert.equal(await target.getAttribute("aria-busy"), "true");
          assert.match(await target.innerText(), /正在/);
        }
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
        let ancestor = el,
          background = s.backgroundColor;
        while (/^rgba\([^)]*,\s*0\)$/.test(background) && ancestor.parentElement) {
          ancestor = ancestor.parentElement;
          background = getComputedStyle(ancestor).backgroundColor;
        }
        return { foreground: s.color, background };
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
    if (control.kind) {
      await choose(control.ready);
      await prepare(control);
      const before = await count();
      const target = page.locator(control.selector);
      if (control.kind === "navigation") {
        assert.equal(await target.getAttribute("href"), control.href);
        if (control.key === "source") {
          assert.equal(await target.getAttribute("target"), "_blank");
          assert.equal(await target.getAttribute("rel"), "noopener noreferrer");
        }
        await target.focus();
        await page.keyboard.press("Enter");
        assert.equal(await count(), before + 1);
        assert.deepEqual(await page.evaluate(() => window.competitorReview.intents.at(-1)), {
          path: control.href,
          method: "NAVIGATE",
        });
        assert.equal(
          await page.locator("dialog[open]").count(),
          control.key === "rule-current" ? 1 : 0,
        );
      } else if (control.kind === "recovery") {
        await target.focus();
        await page.keyboard.press("Enter");
        if (control.expect === "create") {
          assert.equal(await count(), before, "opening create cannot write");
          assert.equal(await page.locator("dialog[open]").count(), 1);
          assert.equal(await page.locator('[name="product_url"]').count(), 1);
          await page.locator('#modal header [data-action="CP-CREATE-CLOSE"]').click();
          assert.ok(
            await page.locator(control.selector).evaluate((el) => el === document.activeElement),
          );
        } else if (control.expect === "clear") {
          assert.equal(await count(), before, "clear search is local");
          assert.equal(await page.locator("#search").inputValue(), "");
          assert.equal(await page.locator(".object").count(), 3);
        } else {
          assert.equal(await count(), before + 1);
          const route =
            control.pageId === "P20"
              ? "/competitors/monitoring-rules" +
                (control.key === "p20-login-query"
                  ? "?competitor=00000000-0000-4000-8000-000000000019"
                  : "")
              : "/competitors";
          const expected =
            control.expect === "reload"
              ? { path: "/competitors", method: "GET" }
              : control.expect === "back"
                ? { path: "history.back()", method: "LOCAL" }
                : {
                    path:
                      control.expect === "login"
                        ? "/login?return_to=" + encodeURIComponent(route)
                        : "/home",
                    method: "NAVIGATE",
                  };
          assert.deepEqual(
            await page.evaluate(() => window.competitorReview.intents.at(-1)),
            expected,
          );
          assert.equal(await page.locator("dialog[open]").count(), 0);
          if (control.expect === "reload") {
            assert.equal(await page.locator('section[aria-busy="true"]').count(), 1);
            assert.equal(
              await page.locator(".empty [data-action]").count(),
              0,
              "load hides recovery footer",
            );
          }
        }
      } else if (control.kind === "detail") {
        const id = await target.getAttribute("data-object");
        await target.focus();
        await page.keyboard.press("Enter");
        assert.equal(await count(), before + 1);
        assert.deepEqual(await page.evaluate(() => window.competitorReview.intents.at(-1)), {
          path: "/competitors/" + id,
          method: "GET",
        });
        assert.equal(await page.locator(control.selector).getAttribute("aria-pressed"), "true");
      } else if (control.kind === "disclosure") {
        const wasOpen = await target.evaluate((el) => el.parentElement.open);
        await target.focus();
        await page.keyboard.press("Enter");
        assert.equal(await target.evaluate((el) => el.parentElement.open), !wasOpen);
        await page.keyboard.press("Space");
        assert.equal(await target.evaluate((el) => el.parentElement.open), wasOpen);
        assert.equal(await count(), before, "disclosure must not request");
      } else if (control.kind === "object-open") {
        await target.focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("dialog[open]").count(), 1);
        assert.equal(await page.locator('[name="reason"]').inputValue(), "");
        assert.equal(await count(), before, "opening delete is not DELETE");
      } else if (control.kind === "object-write") {
        await page.evaluate(() => {
          window.competitorReview.outcome = "pending";
        });
        await target.click();
        assert.equal(await count(), before + 1);
        const submitted = await page.evaluate(() => window.competitorReview.intents.at(-1));
        if (control.actionId === "CP-TOGGLE")
          assert.deepEqual(submitted, {
            path: "/competitors/00000000-0000-4000-8000-000000000019/actions",
            method: "POST",
            body: { status: control.key === "resume" ? "active" : "paused", expected_revision: 7 },
          });
        else {
          assert.equal(submitted.path, "/tasks");
          assert.equal(submitted.method, "POST");
          assert.deepEqual(Object.keys(submitted.body).sort(), [
            "description",
            "due_at",
            "priority",
            "title",
          ]);
          assert.equal(submitted.body.priority, "high");
          assert.equal(submitted.body.due_at, null);
          assert.match(submitted.body.description, /00000000-0000-4000-8000-000000000019/);
          assert.ok(
            submitted.body.description.includes(
              control.key === "task-review" ? "synthetic-evidence-18" : "synthetic-evidence-us-19",
            ),
          );
          assert.equal(await page.locator('[data-action="CP-TASK-LINK"]').count(), 0);
        }
        const current = page.locator(control.selector);
        assert.equal(await current.isDisabled(), true);
        assert.equal(await current.getAttribute("aria-busy"), "true");
        await current.dispatchEvent("click");
        assert.equal(await count(), before + 1);
        await page.locator('[data-object="00000000-0000-4000-8000-000000000020"]').click();
        await prepare(control);
        assert.equal(
          await page.locator("[data-object-operation]").getAttribute("data-object-operation"),
          "00000000-0000-4000-8000-000000000019",
        );
        assert.equal(
          await page.locator(control.selector).getAttribute("aria-busy"),
          null,
          "do not attach A submission to B",
        );
        assert.equal(
          await page.locator(control.selector).isDisabled(),
          true,
          "shared write lock still applies",
        );
        await page.locator(control.selector).dispatchEvent("click");
        assert.equal(await count(), before + 2, "only selecting B adds GET");
        await page.locator('[data-object="00000000-0000-4000-8000-000000000019"]').click();
        await prepare(control);
        assert.equal(await page.locator(control.selector).getAttribute("aria-busy"), "true");
      } else {
        if (control.key.startsWith("create")) {
          await page
            .locator(control.ready === "create-link" ? '[name="product_url"]' : '[name="title"]')
            .fill(
              control.ready === "create-link"
                ? "https://www.amazon.com/dp/B000000020"
                : "保留的竞品标题",
            );
        }
        await target.focus();
        await page.keyboard.press("Enter");
        assert.equal(await count(), before, "secondary action must not write");
        if (control.kind === "previous") {
          assert.equal(await page.locator("dialog[open]").count(), 1);
          assert.equal(await page.locator('[name="product_url"]').count(), 1);
          await page.locator('[data-action="CP-CREATE-SUBMIT"]').click();
          assert.equal(await page.locator('[name="title"]').inputValue(), "保留的竞品标题");
          assert.equal(await count(), before, "step navigation is local");
        } else {
          assert.equal(await page.locator("dialog[open]").count(), 0);
          const openerId = control.key.startsWith("create")
            ? "CP-CREATE-OPEN"
            : control.key.startsWith("rule")
              ? "CP-RULE-OPEN"
              : "CP-DELETE-OPEN";
          assert.equal(
            await page
              .locator(`[data-action="${openerId}"]`)
              .evaluate((el) => el === document.activeElement),
            true,
            control.key +
              ": focus return active=" +
              (await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 220))),
          );
          await page.locator(`[data-action="${openerId}"]`).click();
          if (control.key.startsWith("create"))
            assert.equal(
              await page.locator('[name="product_url"]').inputValue(),
              "https://www.amazon.com/dp/B000000020",
            );
          if (control.key.startsWith("delete"))
            assert.equal(await page.locator('[name="reason"]').inputValue(), "");
          assert.equal(await count(), before, "reopen must not write");
        }
      }
      continue;
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
  for (const scene of ["expired", "rules-expired", "rules-expired-query"]) {
    await choose(scene);
    assert.equal(
      await page.locator('.empty [data-action="CP-STATE-SECONDARY"]').count(),
      0,
      "expired has no secondary",
    );
  }
  for (const scene of ["empty-readonly", "search-empty-readonly"]) {
    await choose(scene);
    assert.equal(
      await page.locator('[data-action="CP-CREATE-OPEN"]').count(),
      0,
      "readonly never offers create",
    );
  }
  await choose("rules-empty");
  assert.equal(await page.locator('[aria-busy="true"]').count(), 0);
  assert.equal(
    await page.locator('[data-action="CP-STATE-PRIMARY"]').count(),
    0,
    "empty rules are ready, not empty UiStatePanel",
  );
  checks.push(
    `${width}: recovery variants preserve page-specific login fullPath, history.back semantics, empty/search role split and zero-write opening; reload records only first real load GET then shows loading, no fabricated recovery success; four pointer states only`,
  );
  await choose("pending");
  assert.equal(await page.locator('[data-action="CP-COLLECT"]').getAttribute("aria-busy"), null);
  assert.match(await page.locator('[data-action="CP-COLLECT"]').innerText(), /采集中/);
  checks.push(
    `${width}: four exact primary selectors x six representative states; native hover/focus/press, disabled no-click, contrast >=4.5, reduced motion, actual offline submit-to-pending and explicit event reentry guard; collection POST pending != accepted task running; not real Vue`,
  );
  checks.push(
    `${width}: object selection/disclosure/task links plus toggle/resume/delete-open/price+review task states; exact POST target/payload and shared write lock, A-to-B-to-A progress ownership, no task link before response; offline only`,
  );
  checks.push(
    `${width}: seven secondary variants (40 states) and four navigation variants (16 states), Enter activation, exact href, external-link safety, secondary zero writes/focus return/create draft retention/delete reopen reset; disabled secondary controls only model proposed form-busy lock, not existing Vue or abort semantics`,
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
        allControls
          .filter((control) => !control.variantOnly)
          .map((control) => [
            control.actionId,
            {
              selector: control.selector,
              scope: "representative-control-only-not-all-variants-or-Vue",
              pageId: control.pageId,
              states: Object.fromEntries(
                (control.states || states).map((state) => [
                  state,
                  `control-${control.key}-${state}`,
                ]),
              ),
              limitation:
                control.kind === "navigation"
                  ? "four pointer/keyboard states only; no source disabled or request-busy state"
                  : ["object-write", "object-open", "detail", "disclosure"].includes(control.kind)
                    ? "object/disclosure representative only; shared write lock follows source busy, owner-specific progress is proposed; read/disclosure has no fabricated disabled/busy screenshot"
                    : control.kind
                      ? "secondary disabled/busy represent existing offline proposal lock while form submits; source Vue still permits closing/back; cancellation never aborts an already sent request"
                      : control.key === "collect"
                        ? "paused represents disabled; POST in-flight differs from accepted queued/running task"
                        : "disabled and busy use the same source busy condition; no invented independent business blocker; create is final step, rule is global price, delete is populated reason",
            },
          ]),
      ),
      controlVariantReferences: Object.fromEntries(
        allControls
          .filter((control) => control.variantOnly)
          .map((control) => [
            control.key,
            {
              actionId: control.actionId,
              pageId: control.pageId,
              selector: control.selector,
              scope: "additional-control-variant-not-new-action",
              states: Object.fromEntries(
                (control.states || states).map((state) => [
                  state,
                  `control-${control.key}-${state}`,
                ]),
              ),
            },
          ]),
      ),
      actionIds: [...actions].sort(),
      checks,
      errors,
      http,
      limits: [
        "Synthetic offline HTML, not real Vue template/backend/SQL/worker/notification acceptance.",
        "Recovery variants are page-keyed additional references, not representative-slot promotion. Forbidden secondary and blocked secondary use truthful home-navigation copy proposals; source default labels still say apply-permission/view-impact. Reload records only the first load GET, not later requests or actual recovery. No disabled/busy footer invented: source loading hides the footer.",
        "CP-B02/B03 ownership is locally fixed and source-regressed; other source gaps remain. No global action/dialog denominator or approval promotion.",
        "History-window scene elides middle98 rows; all-history/long-list lifecycle remains unverified.",
        "Three-theme/two-density matrix is representative P19 only, not every dialog/P20 combination.",
        "Four primary controls have 24 representative states at two widths; dialog disabled and busy share one real busy condition. Not all control variants/fields/themes or P20 create-query background.",
        "Seven secondary variants add40 states and four navigation variants add16; cancel/back locking is proposed and does not change Vue or abort in-flight writes. P20 abnormal create query and all themes/fields remain outside these representative screenshots.",
        "Twelve object-operation variants add58 states and five scenes; only detail-pane write controls share pending lock, with progress tied to captured object. Modal/top-level concurrent writes, real async completion/failure and full Vue lifecycle are not proven. Selected/read and disclosures have only four representative pointer/keyboard states.",
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
