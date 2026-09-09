import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildJourneyDesignData } from "./lib/ui-phase2-journey-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/journey-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture" || v === "--smoke"));
const capture = process.argv.includes("--capture");
const smoke = process.argv.includes("--smoke");
assert.ok(!(capture && smoke));
const pointerStates = ["default", "hover", "focus", "pressed"];
const allStates = [...pointerStates, "disabled", "busy"];
const additionalControls = [
  {
    key: "list",
    actionId: "J-NAV-LIST",
    selector: '.j-head a[href="/opportunities"]',
    ready: "keyword",
    states: pointerStates,
  },
  {
    key: "source",
    actionId: "J-SOURCE",
    selector: '.candidate:first-of-type a[data-source="true"]',
    ready: "results",
    states: pointerStates,
  },
  {
    key: "opportunity",
    actionId: "J-NAV-OPPORTUNITY",
    selector: '.completion a[href^="/opportunities/"]',
    ready: "adopt-decided",
    states: pointerStates,
  },
  {
    key: "task",
    actionId: "J-NAV-TASK",
    selector: '.completion a[href^="/tasks/"]',
    ready: "adopt-decided",
    states: pointerStates,
  },
  {
    key: "retry",
    actionId: "J-STATE-RECOVERY",
    selector: '[data-action="retry"]',
    ready: "restore-failed",
    disabled: "retry-busy",
    busy: "retry-busy",
    states: allStates,
  },
  {
    key: "reset",
    actionId: "J-RESET",
    selector: '.j-footer [data-action="reset"]',
    ready: "results",
    disabled: "observe-busy",
    busy: "observe-busy",
    states: allStates,
  },
  {
    key: "secondary",
    selector: '[data-action="explain"]',
    ready: "restore-forbidden",
    states: pointerStates,
  },
];
const fieldControls = [
  {
    key: "kind",
    field: "form.input_kind",
    selector: '[name="kind"][value="asin"]',
    ready: "asin",
    disabled: "restoring",
    busy: "create-busy",
  },
  {
    key: "candidate",
    field: "selectedResultId",
    selector: '.candidate:first-of-type [name="candidate"]',
    ready: "results",
    disabled: "read-busy",
    busy: "observe-busy",
  },
  {
    key: "observe",
    field: "decision.action",
    selector: '[name="decision"][value="observe"]',
    ready: "observe-edited",
    disabled: "read-busy",
    busy: "observe-busy",
  },
  {
    key: "reject",
    field: "decision.action",
    selector: '[name="decision"][value="reject"]',
    ready: "reject-edited",
    disabled: "read-busy",
    busy: "reject-busy",
  },
  {
    key: "keyword-value",
    field: "form.input_value",
    selector: '[name="input_value"]',
    ready: "keyword-edited",
    disabled: "restoring",
    busy: "create-busy",
    invalid: "keyword-required",
  },
  {
    key: "asin-value",
    field: "form.input_value",
    selector: '[name="input_value"]',
    ready: "asin-edited",
    disabled: "asin-restoring",
    busy: "asin-create-busy",
    invalid: "asin-invalid",
  },
  {
    key: "url-value",
    field: "form.input_value",
    selector: '[name="input_value"]',
    ready: "url-edited",
    disabled: "url-restoring",
    busy: "url-create-busy",
    invalid: "url-invalid",
  },
  {
    key: "reason",
    field: "decision.reason",
    selector: '[name="reason"]',
    ready: "observe-edited",
    disabled: "read-busy",
    busy: "observe-busy",
    invalid: "reason-required",
  },
];
const sources = ["index.html", "data.js", "journey.js", "journey.css"]
  .map((v) => `${relative}/${v}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/SelectionJourney.vue",
    "apps/web/src/components/UiStatePanel.vue",
    "apps/web/src/ui/state-contract.ts",
    "apps/api/src/selection-journey-service.ts",
    "apps/api/src/selection-journey-routes.ts",
    "apps/api/src/mysql-selection-journey-repository.ts",
    "apps/api/src/opportunity-selection-policy.ts",
    "tests/e2e/ui-phase2-journey-contracts.spec.ts",
    "tests/e2e/ui-phase2-journey-reads.spec.ts",
    "scripts/lib/ui-phase2-journey-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-journey-c.mjs",
  ]);
const texts = Object.fromEntries(
    await Promise.all(
      sources.map(async (f) => [
        f,
        (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n"),
      ]),
    ),
  ),
  sourceHashes = Object.fromEntries(Object.entries(texts).map(([f, t]) => [f, hash(t)]));
const data = await buildJourneyDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.JOURNEY_C_DATA)), data);
for (const control of fieldControls)
  assert.ok(
    texts["apps/web/src/components/SelectionJourney.vue"].includes(`v-model="${control.field}"`),
    `missing source model ${control.field}`,
  );
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  controlStates = [];
try {
  for (const width of [1440, 390]) {
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
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      page.on("request", (r) => {
        if (/^https?:/.test(r.url())) requests.push(r.url());
      });
      await page.route(/^https?:/, (route) => route.abort());
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.JOURNEY_C));
      const state = () => page.evaluate(() => window.JOURNEY_C.state()),
        scene = async (name) => {
          await page.evaluate((n) => window.JOURNEY_C.scene(n), name);
          await page.evaluate(() => document.fonts.ready);
        },
        idle = () =>
          page.waitForFunction(
            () => !window.JOURNEY_C.state().busy && !window.JOURNEY_C.state().reading,
          );
      const names = await page.evaluate(() => Object.keys(window.JOURNEY_C.scenes));
      assert.equal(names.length, 67);
      for (const name of smoke
        ? ["adopt-ready", "gate-cost", "adopt-conflict", "adopt-decided"]
        : names) {
        await scene(name);
        await checkPrototypeMetrics(page);
        assert.deepEqual(errors, [], name);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${width}/${name}`,
        );
        assert.equal(await page.locator("dialog").count(), 0);
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const image = await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({ file, scene: name, width, sha256: hash(image) });
        }
      }
      const controls = [
        {
          key: "create",
          selector: '#create-form [type="submit"]',
          ready: "keyword-edited",
          disabled: "restoring",
          busy: "create-busy",
        },
        {
          key: "adopt",
          selector: '[name="decision"][value="adopt"]',
          ready: "adopt-ready",
          disabled: "gate-cost",
          busy: "adopt-busy",
        },
        {
          key: "save",
          selector: '#decision-form [type="submit"]',
          ready: "adopt-ready",
          disabled: "gate-cost",
          busy: "adopt-busy",
        },
      ];
      for (const control of [...controls, ...additionalControls, ...fieldControls])
        for (const variant of control.states ||
          (control.invalid ? [...allStates, "invalid"] : allStates)) {
          const baseScene = control[variant] || control.ready;
          await page.mouse.move(0, 0);
          await scene(baseScene);
          const target = page.locator(control.selector);
          await target.scrollIntoViewIfNeeded();
          if (["disabled", "busy"].includes(variant)) assert.equal(await target.isDisabled(), true);
          else assert.equal(await target.isEnabled(), true);
          if (variant === "invalid") {
            assert.equal(await target.getAttribute("aria-invalid"), "true");
            const id = await target.getAttribute("aria-describedby");
            assert.ok(await page.locator(`#${id}`).innerText());
            const errorBorder = await target.evaluate((el) => getComputedStyle(el).borderColor);
            await target.hover();
            assert.equal(
              await target.evaluate((el) => getComputedStyle(el).borderColor),
              errorBorder,
            );
            await page.mouse.move(0, 0);
          }
          if (variant === "hover" || variant === "pressed") {
            await target.hover();
            assert.equal(await target.evaluate((el) => el.matches(":hover")), true);
          }
          if (variant === "focus") {
            await page.keyboard.press("Tab");
            await target.focus();
            assert.equal(await target.evaluate((el) => el.matches(":focus-visible")), true);
            assert.notEqual(
              await target.evaluate((el) => getComputedStyle(el).outlineStyle),
              "none",
            );
          }
          if (variant === "pressed") {
            await page.mouse.down();
            assert.equal(await target.evaluate((el) => el.matches(":active")), true);
          }
          const record = {
            key: control.key,
            ...(control.field ? { field: control.field } : {}),
            state: variant,
            selector: control.selector,
            scene: `control-${control.key}-${variant}`,
            baseScene,
            width,
          };
          controlStates.push(record);
          const file = `${width}-control-${control.key}-${variant}.png`;
          expected.push(file);
          if (capture) {
            const buffer = await page.screenshot({
              path: path.join(root, file),
              fullPage: true,
              animations: "disabled",
            });
            screenshots.push({
              file,
              scene: record.scene,
              width,
              sha256: hash(buffer),
              control: record,
            });
          }
          if (variant === "pressed") {
            await page.mouse.move(0, 0);
            await page.mouse.up();
          }
          assert.equal(
            (await state()).intents.length,
            0,
            `${control.key}/${variant} must not submit`,
          );
          assert.equal(
            (await state()).navigation,
            null,
            `${control.key}/${variant} must not navigate`,
          );
          await checkPrototypeMetrics(page);
        }
      for (const entry of [
        { scene: "keyword", value: "", error: "请填写商品线索。", valid: data.values.keyword },
        {
          scene: "asin",
          value: "short",
          error: "ASIN 必须为 10 位字母或数字。",
          valid: data.values.asin,
        },
        {
          scene: "url",
          value: "not-a-url",
          error: "请填写有效的商品链接。",
          valid: data.values.product_url,
        },
      ]) {
        await scene(entry.scene);
        await page.locator('[name="input_value"]').fill(entry.value);
        await page.locator('#create-form [type="submit"]').click();
        assert.equal(await page.locator("#field-error").innerText(), entry.error);
        assert.equal(
          await page
            .locator('[name="input_value"]')
            .evaluate((el) => el === document.activeElement),
          true,
        );
        assert.equal((await state()).intents.length, 0);
        await page.locator('[name="input_value"]').fill(entry.valid);
        assert.equal(await page.locator("#field-error").count(), 0);
        assert.equal(await page.locator('[name="input_value"]').getAttribute("aria-invalid"), null);
        assert.equal(await page.locator('[name="input_value"]').getAttribute("maxlength"), "200");
      }
      await scene("observe-edited");
      await page.locator('[name="reason"]').fill("");
      await page.locator('#decision-form [type="submit"]').click();
      assert.equal(await page.locator("#reason-error").innerText(), "请填写非空决策原因。");
      assert.equal((await state()).intents.length, 0);
      await page.locator('[name="reason"]').fill("独立保留的审核原因");
      assert.equal(await page.locator("#reason-error").count(), 0);
      assert.equal(await page.locator('[name="reason"]').getAttribute("maxlength"), "1000");
      await page.locator('[name="reason"]').fill("因".repeat(1000));
      await page.keyboard.press("End");
      await page.keyboard.insertText("超");
      assert.equal((await state()).decision.reason.length, 1000);
      await page.locator('[name="reason"]').fill("独立保留的审核原因");
      await page.locator('[name="decision"][value="observe"]').focus();
      await page.keyboard.press("ArrowRight");
      assert.equal((await state()).decision.action, "reject");
      assert.equal((await state()).decision.reason, "独立保留的审核原因");
      assert.equal(
        await page
          .locator('[name="decision"][value="reject"]')
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await scene("keyword-edited");
      await page.locator('[name="kind"][value="keyword"]').focus();
      await page.keyboard.press("ArrowRight");
      assert.equal((await state()).form.input_kind, "asin");
      assert.equal((await state()).form.input_value, data.values.keyword);
      assert.equal(
        await page
          .locator('[name="kind"][value="asin"]')
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await scene("adopt-ready");
      await page.locator('.candidate:last-of-type [name="candidate"]').focus();
      await page.keyboard.press("ArrowLeft");
      assert.equal((await state()).selected, data.sample.results[0].raw_evidence_id);
      assert.equal((await state()).decision.reason, "  核对来源后继续验证  ");
      assert.equal(await page.locator('[name="decision"][value="adopt"]').isDisabled(), true);
      assert.equal(await page.locator('#decision-form [type="submit"]').isDisabled(), true);
      assert.equal((await state()).intents.length, 0);
      await scene("keyword-edited");
      await page.locator('[name="input_value"]').fill("词".repeat(200));
      await page.keyboard.press("End");
      await page.keyboard.insertText("超");
      assert.equal((await state()).form.input_value.length, 200);
      await scene("asin-invalid");
      await page.locator('[name="kind"][value="keyword"]').check();
      assert.equal((await state()).form.input_value, "short");
      assert.equal(await page.locator("#field-error").count(), 0);
      for (const [kind, value] of Object.entries(data.values)) {
        await scene(kind === "product_url" ? "url" : kind);
        await page.locator('#create-form [type="submit"]').click();
        assert.equal((await state()).intents.length, 0);
        if (kind === "asin") {
          await page.locator('[name="input_value"]').fill("short");
          await page.locator('#create-form [type="submit"]').click();
          assert.equal((await state()).intents.length, 0);
        }
        await page.locator('[name="input_value"]').fill(value);
        await page.locator('#create-form [type="submit"]').click();
        await idle();
        assert.deepEqual((await state()).lastIntent, data.createIntents[kind]);
        assert.equal((await state()).journey.state, "accepted");
        assert.equal((await state()).savedId, data.sample.id);
        assert.equal(await page.locator("#decision-form").count(), 0);
        await page.locator("#advance").click();
        assert.equal((await state()).journey.state, "result_ready");
        assert.equal((await state()).selected, "");
        assert.equal((await state()).journey.input_value, value.trim());
      }
      await scene("keyword");
      await page.locator(".skip").focus();
      assert.equal(await page.locator(".skip").evaluate((el) => getComputedStyle(el).opacity), "1");
      await page.keyboard.press("Enter");
      assert.equal(
        await page.locator("#work").evaluate((el) => el === document.activeElement),
        true,
      );
      assert.equal(await page.locator(".skip").evaluate((el) => getComputedStyle(el).opacity), "0");
      await scene("keyword-edited");
      await page.locator('[name="kind"][value="asin"]').check();
      assert.equal((await state()).form.input_value, data.values.keyword);
      for (const bad of data.urlErrors) {
        await scene("url");
        await page.locator('[name="input_value"]').fill(bad.input_value);
        await page.locator('#create-form [type="submit"]').click();
        await idle();
        assert.equal((await state()).journey, null);
        assert.equal((await state()).form.input_value, bad.input_value);
        assert.equal((await state()).error, "error");
      }
      await scene("create-failed");
      await page.locator('#create-form [type="submit"]').click();
      await idle();
      assert.equal((await state()).journey, null);
      assert.equal((await state()).savedId, null);
      await page.locator('#create-form [type="submit"]').click();
      await idle();
      assert.equal((await state()).journey.state, "accepted");
      assert.equal((await state()).intents.length, 2);
      for (const name of ["restoring", "read-busy"]) {
        await scene(name);
        assert.equal(await page.locator('form [type="submit"]').isDisabled(), true);
        assert.equal(await page.locator("#work").getAttribute("aria-busy"), "true");
      }
      await scene("restore-failed");
      await page.locator('[data-action="retry"]').click();
      await idle();
      assert.deepEqual((await state()).lastIntent, {
        method: "GET",
        path: `/selection-journeys/${data.sample.id}`,
      });
      assert.equal((await state()).error, "");
      assert.equal((await state()).intents.length, 0);
      for (const name of ["create-failed", "url-rejected"]) {
        await scene(name);
        await page.locator('.notice [data-action="reset"]').click();
        assert.equal((await state()).journey, null);
        assert.equal((await state()).intents.length, 0);
        assert.equal((await state()).form.input_value, "");
      }
      for (const name of ["restore-failed", "read-failed", "create-failed"]) {
        await scene(name);
        await page.locator('[data-action="explain"]').click();
        assert.equal((await state()).navigation, "history.back");
        assert.equal((await state()).intents.length, 0);
      }
      for (const name of ["restore-forbidden", "read-blocked"]) {
        await scene(name);
        await page.locator('[data-action="explain"]').click();
        assert.equal((await state()).navigation, null);
        assert.equal((await state()).intents.length, 0);
      }
      for (const name of ["restore-expired", "read-expired"]) {
        await scene(name);
        assert.equal(await page.locator('[data-action="explain"]').count(), 0);
      }
      await scene("retry-busy");
      await page.locator('[data-action="retry"]').evaluate((el) => el.click());
      assert.equal((await state()).lastIntent, null);
      await scene("restore-failed");
      await page.locator('[data-action="retry"]').click();
      assert.equal(await page.locator('[data-action="retry"]').isDisabled(), true);
      await idle();
      assert.equal((await state()).journey.id, data.sample.id);
      for (const control of additionalControls.filter(
        (v) => v.actionId?.startsWith("J-NAV") || v.key === "source",
      )) {
        await scene(control.ready);
        const href = await page.locator(control.selector).getAttribute("href");
        await page.locator(control.selector).focus();
        await page.keyboard.press("Enter");
        assert.equal((await state()).navigation, href);
        assert.equal((await state()).intents.length, 0);
      }
      for (const name of ["create-busy", "observe-busy", "read-busy"]) {
        await scene(name);
        await page.locator('.j-head a[href="/opportunities"]').click();
        assert.equal((await state()).navigation, "/opportunities");
        assert.equal((await state()).intents.length, 0);
      }
      await scene("results");
      await page.locator('[name="candidate"]').nth(1).check();
      const selected = (await state()).selected;
      const source = page.locator('a[data-source="true"]').first();
      assert.equal(await source.getAttribute("target"), "_blank");
      assert.equal(await source.getAttribute("rel"), "noopener noreferrer");
      await source.click();
      assert.equal((await state()).selected, selected);
      assert.equal((await state()).intents.length, 0);
      await scene("single-result");
      assert.equal((await state()).selected, data.sample.results[1].raw_evidence_id);
      await scene("first-result");
      assert.equal((await state()).selected, data.sample.results[0].raw_evidence_id);
      assert.equal(await page.locator(".candidate").count(), 1);
      await scene("twenty-results");
      assert.equal(await page.locator(".candidate").count(), 20);
      assert.equal((await state()).journey.available_result_count, 28);
      for (const action of ["observe", "reject"]) {
        await scene(`${action}-edited`);
        await page.locator('#decision-form [type="submit"]').click();
        await idle();
        assert.deepEqual((await state()).lastIntent, data.decisionIntents[action]);
        assert.equal((await state()).savedId, null);
        assert.equal((await state()).journey.opportunity_id, null);
        assert.equal(
          (await state()).journey.verification_task_id,
          "00000000-0000-4000-8000-000000007630",
        );
        assert.equal(
          await page.locator('a[href^="/tasks/"]').getAttribute("href"),
          "/tasks/00000000-0000-4000-8000-000000007630",
        );
        await scene(`${action}-failed`);
        await page.locator('#decision-form [type="submit"]').click();
        await idle();
        assert.equal((await state()).decision.reason, "  核对来源后继续验证  ");
        assert.equal((await state()).error, "error");
        await page.locator('#decision-form [type="submit"]').click();
        await idle();
        assert.equal((await state()).error, "");
        assert.equal((await state()).journey.state, "decided");
        assert.equal((await state()).decision.reason, "");
      }
      await scene("observe-edited");
      await page.locator('[name="reason"]').fill("   ");
      await page.locator('#decision-form [type="submit"]').click();
      assert.equal((await state()).intents.length, 0);
      assert.equal(await page.locator('[name="reason"]').getAttribute("aria-invalid"), "true");
      await scene("adoption-pending");
      assert.equal(await page.locator('[name="decision"][value="adopt"]').isDisabled(), true);
      assert.match(await page.locator("#decision-form").innerText(), /尚无已评估机会/);
      for (const gate of Object.keys(data.missingGates)) {
        await scene(`gate-${gate}`);
        assert.equal(await page.locator('[name="decision"][value="adopt"]').isDisabled(), true);
        assert.equal(await page.locator('#decision-form [type="submit"]').isDisabled(), true);
        assert.equal(await page.locator('.gate-summary [data-passed="false"]').count(), 1);
        await page.locator("#decision-form").evaluate((el) => el.requestSubmit());
        assert.equal((await state()).intents.length, 0);
        assert.equal((await state()).decision.reason, "  核对来源后继续验证  ");
      }
      await scene("adopt-ready");
      assert.equal(await page.locator('.gate-summary [data-passed="true"]').count(), 5);
      await page.locator('#decision-form [type="submit"]').click();
      await idle();
      assert.deepEqual((await state()).lastIntent, data.decisionIntents.adopt);
      assert.equal((await state()).journey.opportunity_id, data.qualified.opportunity_id);
      assert.equal(
        await page.locator(`a[href="/opportunities/${data.qualified.opportunity_id}"]`).count(),
        1,
      );
      assert.equal((await state()).savedId, null);
      await scene("adopt-conflict");
      await page.locator('#decision-form [type="submit"]').click();
      await idle();
      assert.equal((await state()).journey.state, "result_ready");
      assert.equal((await state()).journey.opportunity_id, null);
      assert.equal((await state()).decision.reason, "  核对来源后继续验证  ");
      await page.locator('[data-action="retry"]').click();
      await idle();
      assert.equal(await page.locator('[name="decision"][value="adopt"]').isDisabled(), true);
      assert.equal((await state()).decision.reason, "  核对来源后继续验证  ");
      await page.locator('[name="decision"][value="observe"]').check();
      await page.locator('#decision-form [type="submit"]').click();
      await idle();
      assert.deepEqual((await state()).lastIntent, data.decisionIntents.observe);
      assert.equal((await state()).journey.opportunity_id, null);
      await scene("deadline-running");
      assert.equal(await page.locator('#decision-form [type="submit"]').isDisabled(), true);
      await scene("running-evidence");
      assert.equal(await page.locator("#decision-form").count(), 0);
      assert.equal(await page.locator(".candidate").count(), 2);
      await scene("reject-edited");
      await page.locator('[data-action="reset"]').click();
      assert.equal((await state()).journey, null);
      assert.equal((await state()).decision.action, "observe");
      assert.equal((await state()).decision.reason, "");
      assert.equal((await state()).intents.length, 0);
      await scene("observe-busy");
      assert.equal(await page.locator('[data-action="reset"]').isDisabled(), true);
      await scene("decided-no-links");
      assert.equal(await page.locator('a[href^="/tasks/"]').count(), 0);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `journey_c width=${width} scenes=${names.length} source-inputs/adopt/five-gates/conflict/observe/reject/results/recovery/reset passed; HTTP=0 storage=0`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const actionVisualReferences = Object.fromEntries(
  [
    ["J-CREATE", "create", '#create-form [type="submit"]', allStates],
    ["J-DECIDE", "save", '#decision-form [type="submit"]', allStates],
    ...additionalControls
      .filter((v) => v.actionId)
      .map((v) => [v.actionId, v.key, v.selector, v.states]),
  ].map(([id, key, selector, states]) => [
    id,
    {
      scope: "representative-control-only-not-all-variants-or-Vue",
      selector,
      states: Object.fromEntries(states.map((v) => [v, `control-${key}-${v}`])),
    },
  ]),
);
const fieldVisualReferences = Object.fromEntries(
  fieldControls.map((control) => [
    control.key,
    {
      field: control.field,
      selector: control.selector,
      scope: "field-variant-only-not-Vue-acceptance",
      states: Object.fromEntries(
        (control.invalid ? [...allStates, "invalid"] : allStates).map((state) => [
          state,
          `control-${control.key}-${state}`,
        ]),
      ),
    },
  ]),
);
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    `${JSON.stringify(
      {
        version: data.version,
        approval: "pending",
        capturedAt: new Date().toISOString(),
        sourceHashes,
        knownGaps: data.knownGaps,
        controlStates,
        actionVisualReferences,
        fieldVisualReferences,
        boundary:
          "67 full scenes and102 representative control states at two widths; zero business dialogs. Overall layout approved, controls pending. Field validation/focus/busy/error clearing are proposals; real Vue, HTTP, storage, SQL, authorization and production not accepted.",
        screenshots,
      },
      null,
      2,
    )}\n`,
  );
else if (!smoke)
  assert.deepEqual(
    previous.screenshots.map((v) => v.file),
    expected,
  );
