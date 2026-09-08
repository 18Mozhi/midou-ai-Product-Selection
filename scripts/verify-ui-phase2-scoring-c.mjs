import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/scoring-direction-c";
const root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const sources = ["index.html", "scoring.css", "scoring.js", "data.js"]
  .map((file) => `${relative}/${file}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/ScoreRuleConsole.vue",
    "apps/web/src/components/shared/QualityGateSetupSummary.vue",
    "tests/e2e/m04-03-scoring.spec.ts",
    "tests/e2e/ui-phase2-scoring-contracts.spec.ts",
    "scripts/verify-ui-phase2-scoring-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ]);
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
const dimensions = [
  "market_demand",
  "competition",
  "profit",
  "fulfillment_efficiency",
  "customer_experience",
  "content_fit",
  "risk",
  "data_quality",
];
const actions = ["submit", "approve", "reject", "activate", "rollback"];
const scenes = [
  "versions",
  "empty",
  "readonly-empty",
  "readonly",
  "decide-only",
  "create-basics",
  ...dimensions.map((code) => `create-${code}`),
  "preview",
  "preview-error",
  "preview-loading",
  ...actions,
  "action-conflict",
  "action-busy",
];
if (!capture) {
  const prior = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(prior.sourceHashes, sourceHashes, "Source drift; review before recapture");
  assert.deepEqual(
    prior.screenshots.map((shot) => shot.file),
    [1440, 390].flatMap((width) => scenes.map((scene) => `${width}-${scene}.png`)),
  );
  for (const shot of prior.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const browser = await chromium.launch({ headless: true });
const screenshots = [];
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
        errors = [],
        requests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (event) => {
        if (event.type() === "error") errors.push(event.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.evaluate(() => document.fonts.ready);
      const original = await page.evaluate(() =>
        JSON.stringify({
          rules: window.SCOUTOPS_SCORING_DESIGN.rules,
          preview: window.SCOUTOPS_SCORING_DESIGN.preview,
        }),
      );
      const dialog = page.locator("#modal");
      for (const scene of scenes) {
        await page.locator("#scene").selectOption(scene);
        const modalScene = ![
          "versions",
          "empty",
          "readonly-empty",
          "readonly",
          "decide-only",
        ].includes(scene);
        assert.equal(await dialog.evaluate((node) => node.open), modalScene);
        if (scene === "versions") {
          assert.equal(await page.locator(".version-card").count(), 2);
          assert.match(
            await page.locator(".coverage-item.warning").textContent(),
            /风险维度.*缺项/,
          );
          assert.match(await page.locator("#coverage").textContent(), /org-v1/);
        }
        if (scene.startsWith("readonly"))
          assert.equal(await page.locator("#new-rule").isVisible(), false);
        if (scene === "readonly") assert.equal(await page.locator("#versions button").count(), 0);
        if (scene === "decide-only") {
          assert.equal(
            await page
              .locator("[data-action='approve'],[data-action='reject'],[data-action='preview']")
              .count(),
            0,
          );
          assert.match(await page.locator("#versions").textContent(), /等待有审批权限/);
        }
        if (scene.startsWith("create-")) {
          assert.equal(await page.locator("#save").isDisabled(), true);
          for (const id of ["recommend_min", "observe_min"])
            assert.equal(await page.locator(`#${id}`).inputValue(), "");
          assert.equal(await page.locator("#version_code").getAttribute("maxlength"), "64");
          assert.equal(await page.locator("#rule_name").getAttribute("maxlength"), "160");
          for (let i = 0; i < 8; i++) {
            assert.equal(await page.locator(`#weight-${i}`).inputValue(), "0");
            assert.equal(await page.locator(`#group-${i}`).inputValue(), "other");
            assert.equal(await page.locator(`#required-${i}`).isChecked(), false);
          }
          const index = dimensions.findIndex((code) => scene === `create-${code}`);
          if (index >= 0) {
            assert.equal(await page.locator(`#dimension-${index}`).isVisible(), true);
            // Show the complete selected editor, not only the navigation at the top of a long dialog.
            await page.locator(`#dimension-${index}`).evaluate((node) => {
              const scroll = node.closest(".modal-scroll");
              const delta =
                node.getBoundingClientRect().bottom - scroll.getBoundingClientRect().bottom;
              if (delta > 0) scroll.scrollTop += delta + 8;
            });
            const panel = await page.locator(`#dimension-${index}`).boundingBox();
            const scroll = await page.locator(".modal-scroll").boundingBox();
            assert.ok(panel.y >= scroll.y && panel.y + panel.height <= scroll.y + scroll.height);
          }
        }
        if (scene === "preview") {
          assert.match(await page.locator("#preview-content").textContent(), /80\.20/);
          assert.match(await page.locator("#preview-content").textContent(), /78\.40/);
          assert.match(await page.locator("#preview-content").textContent(), /-1\.80/);
          assert.deepEqual(await page.locator(".preview-summary dd").allTextContents(), [
            "0",
            "1",
            "0",
            "0",
            "0",
          ]);
          assert.equal(await page.locator(".pagination button:disabled").count(), 2);
          const pagination = await page.locator(".pagination").boundingBox();
          const previewScroll = await page.locator(".modal-scroll").boundingBox();
          assert.ok(
            pagination.y + pagination.height <= previewScroll.y + previewScroll.height,
            "Preview pagination is fully visible, not covered by the fixed footer",
          );
          assert.match(await page.locator(".preview-meta").textContent(), /缺失字段.*样本未列出/);
        }
        if (actions.includes(scene) || scene.startsWith("action-")) {
          assert.equal(await page.locator("#reason").getAttribute("maxlength"), "1000");
          assert.equal(await page.locator("#reason").evaluate((node) => node.required), true);
          assert.equal(await page.locator("#rollback-field").isVisible(), scene === "rollback");
          if (scene === "rollback") {
            assert.equal(await page.locator("#rollback-target option").count(), 2);
            assert.match(
              await page.locator("#rollback-target option").last().textContent(),
              /org-v2.*已停用/,
            );
          }
          assert.equal(
            await page.locator("#action-error").isVisible(),
            scene === "action-conflict",
          );
          assert.equal(await page.locator("#save").isDisabled(), scene === "action-busy");
        }
        if (modalScene) {
          const bounds = await dialog.boundingBox();
          assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
        } else await page.evaluate(() => window.scrollTo(0, 0));
        const metrics = await checkPrototypeMetrics(page);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        if (capture) {
          const file = `${width}-${scene}.png`;
          await page.screenshot({
            path: path.join(root, file),
            fullPage: !modalScene,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene,
            viewport,
            fullPage: !modalScene,
            sha256: hash(await readFile(path.join(root, file))),
            metrics,
          });
        }
        if (modalScene) {
          await page.locator("#close").focus();
          await page.keyboard.press("Shift+Tab");
          assert.equal(
            await page.evaluate(() => document.activeElement.id),
            scene.startsWith("create-") || scene.startsWith("preview") || scene === "action-busy"
              ? "cancel"
              : "save",
          );
          await page.keyboard.press("Tab");
          assert.equal(await page.evaluate(() => document.activeElement.id), "close");
          await page.keyboard.press("Escape");
          assert.equal(await page.evaluate(() => document.activeElement.id), "scene");
        }
      }
      // Mirror UI2-S02's explicit inputs; changing sections and cancelling must preserve the draft.
      await page.locator("#scene").selectOption("versions");
      await page.locator("#new-rule").click();
      await page.locator("#version_code").fill("org-v3");
      await page.locator("#rule_name").fill("显式双维规则");
      await page.locator("#recommend_min").fill("70");
      await page.locator("#observe_min").fill("70");
      assert.match(await page.locator("#validation").textContent(), /必须大于/);
      await page.locator("#observe_min").fill("50");
      await page.locator("#show-dimensions").click();
      const choose = async (index) => {
        if (width === 390) await page.locator("#dimension-choice").selectOption(String(index));
        else await page.locator(`#pick-${index}`).click();
      };
      await choose(0);
      await page.locator("#weight-0").fill("60");
      assert.match(await page.locator("#validation").textContent(), /至少配置2个/);
      await page.locator("#required-0").check();
      await page.locator("#group-0").selectOption("market");
      await choose(1);
      await page.locator("#weight-1").fill("30");
      assert.match(await page.locator("#validation").textContent(), /合计 90%/);
      await page.locator("#weight-1").fill("40");
      await page.locator("#group-1").selectOption("competition");
      assert.equal(await page.locator("#save").isEnabled(), true);
      await page.locator("#cancel").click();
      assert.equal(await page.evaluate(() => document.activeElement.id), "new-rule");
      await page.locator("#new-rule").click();
      assert.equal(await page.locator("#version_code").inputValue(), "org-v3");
      await page.locator("#save").click();
      assert.equal(await dialog.evaluate((node) => node.open), false);
      assert.match(await page.locator("#review-note").textContent(), /未请求API/);
      for (const action of actions) {
        await page.locator("#scene").selectOption(action);
        await page.keyboard.press("Escape");
        await page.locator(`[data-action='${action}']`).click();
        await page.locator("#save").click();
        assert.equal(await dialog.evaluate((node) => node.open), true);
        await page.locator("#reason").fill("核验该版本操作");
        if (action === "rollback")
          await page
            .locator("#rollback-target")
            .selectOption("00000000-0000-4000-8000-000000000436");
        await page.locator("#save").click();
        assert.equal(await dialog.evaluate((node) => node.open), false);
        assert.equal(await page.evaluate(() => document.activeElement.dataset.action), action);
      }
      await page.locator("#scene").selectOption("preview-error");
      await page.locator("#retry-preview").click();
      assert.match(await page.locator("#preview-content").textContent(), /78\.40/);
      await page.keyboard.press("Escape");
      await page.locator("#scene").selectOption("approve");
      await page.keyboard.press("Escape");
      await page.locator("[data-action='preview']").click();
      assert.match(await page.locator("#preview-content").textContent(), /未提供该版本的预览样本/);
      assert.equal(await page.locator(".score-comparison").count(), 0);
      assert.equal(
        await page.evaluate(() =>
          JSON.stringify({
            rules: window.SCOUTOPS_SCORING_DESIGN.rules,
            preview: window.SCOUTOPS_SCORING_DESIGN.preview,
          }),
        ),
        original,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
      console.log(
        `scoring_c width=${width} scenes=${scenes.length} create/8dimensions/5actions/preview/capabilities/focus=passed HTTP=0 errors=0`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "SCORE-C-r1",
        kind: "formal-design-proposal-not-vue-not-production",
        pageId: "P17",
        approval: "pending-user-review",
        capturedAt: new Date().toISOString(),
        browser: browser.version(),
        sourceHashes,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
