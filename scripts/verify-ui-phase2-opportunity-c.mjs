import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildOpportunityDesignData } from "./lib/ui-phase2-opportunity-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/opportunity-direction-c",
  root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const sources = ["index.html", "opportunity.css", "opportunity.js", "view.js", "data.js"]
  .map((v) => `${relative}/${v}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    ...[
      "OpportunityWorkspace.vue",
      "OpportunityListPanel.vue",
      "OpportunityWorkspaceDialogs.vue",
      "AutomaticSelectionReadinessPanel.vue",
      "ResponsiveFilterDrawer.vue",
      "opportunity-workspace-forms.ts",
      "opportunity-workspace-types.ts",
    ].map((v) => `apps/web/src/components/${v}`),
    "apps/web/src/automatic-selection-readiness.ts",
    "apps/api/src/opportunity-service.ts",
    "apps/api/src/opportunity-routes.ts",
    "apps/api/src/opportunity-selection-policy.ts",
    "apps/api/src/erp-product-import-routes.ts",
    "apps/api/src/erp-product-import-service.ts",
    "tests/e2e/ui-phase2-opportunity-contracts.spec.ts",
    "tests/e2e/m04-02-opportunities.spec.ts",
    "scripts/lib/ui-phase2-opportunity-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-opportunity-c.mjs",
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
const data = await buildOpportunityDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.OP_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [],
  expected = [],
  browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const viewport = { width, height: width === 390 ? 844 : 1000 },
      context = await browser.newContext({
        viewport,
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
      await page.waitForFunction(() => Boolean(window.OP_C));
      const state = () => page.evaluate(() => window.OP_C.state());
      const scene = async (name) => {
        await page.evaluate((n) => window.OP_C.resetScene(n), name);
        await page.evaluate(() => document.fonts.ready);
      };
      const action = (name) => page.locator(`[data-action="${name}"]`).first();
      const idle = () => page.waitForFunction(() => !window.OP_C.state().busy);
      const names = await page.evaluate(() => Object.keys(window.OP_C.scenes));
      assert.equal(names.length, 60);
      for (const name of names) {
        await scene(name);
        assert.deepEqual(errors, [], name);
        await checkPrototypeMetrics(page);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${width}/${name} overflow`,
        );
        const modal = await page.locator("dialog[open]").count();
        async function shot(suffix, fullPage) {
          const file = `${width}-${name}${suffix}.png`;
          expected.push(file);
          if (capture) {
            const image = await page.screenshot({
              path: path.join(root, file),
              fullPage,
              animations: "disabled",
            });
            screenshots.push({ file, scene: name, width, sha256: hash(image) });
          }
        }
        await shot("", !modal);
        const overflows =
          modal &&
          (await page
            .locator("dialog")
            .evaluate((node) => node.scrollHeight > node.clientHeight + 1));
        if (overflows) {
          await page.locator("dialog").evaluate((node) => {
            node.scrollTop = node.scrollHeight;
          });
          await shot("-lower", false);
        }
      }
      for (const [queue, sample] of [
        ["recommended", "recommended"],
        ["rule-candidates", "rule_candidates"],
        ["evidence-pending", "evidence_pending"],
        ["all", "all"],
      ]) {
        await scene(queue);
        const snap = await state();
        const displayedFacts = await page.locator(".op-row").evaluateAll((rows) =>
          rows.map((row) =>
            [...row.querySelectorAll("dl > div")].map((fact) => ({
              label: fact.querySelector("dt").textContent,
              value: fact.querySelector("dd").textContent,
            })),
          ),
        );
        assert.deepEqual(displayedFacts, data.facts[sample]);
        assert.equal(
          new URL(snap.lastRead, "https://local.test").searchParams.get("selection_view"),
          sample,
        );
        assert.equal(await page.locator(".op-check").count(), sample === "all" ? 2 : 0);
        const href = await page.locator(".row-end a").first().getAttribute("href");
        assert.equal(new URL(href, "https://local.test").searchParams.get("from"), snap.url);
        await page.locator(".row-end a").first().click();
        assert.equal((await state()).navigation, href);
        assert.equal((await state()).intents.length, 0);
      }
      await scene("filter-edited");
      assert.deepEqual((await state()).applied, data.filters);
      await page.locator("dialog").press("Escape");
      assert.equal((await state()).url, "/opportunities?view=all");
      await action("filter").click();
      assert.equal(await page.locator('[name="q"]').inputValue(), "候选");
      await page.locator('[type="submit"]').click();
      const applied = await state(),
        query = new URL(applied.lastRead, "https://local.test").searchParams;
      for (const [k, val] of Object.entries(applied.applied)) assert.equal(query.get(k), val);
      assert.equal(query.get("page"), "1");
      assert.equal(query.get("page_size"), "20");
      await action("view:rule_candidates").click();
      assert.equal(
        new URL((await state()).url, "https://local.test").searchParams.has("decision_status"),
        false,
      );
      await action("reset").click();
      assert.equal((await state()).url, "/opportunities?view=rule_candidates");
      for (const kind of ["filter", "create", "erp", "assign", "review", "archive"]) {
        await scene("selected");
        await action(kind).click();
        const dialog = page.locator("dialog");
        assert.equal(await dialog.getAttribute("aria-labelledby"), "op-modal-title");
        assert.equal(await page.locator("#op-modal-title").count(), 1);
        await dialog.locator("button").first().focus();
        await page.keyboard.press("Shift+Tab");
        assert.ok(
          await page.evaluate(() =>
            document.querySelector("dialog").contains(document.activeElement),
          ),
        );
        await page.keyboard.press("Tab");
        assert.ok(
          await page.evaluate(() =>
            document.querySelector("dialog").contains(document.activeElement),
          ),
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog").count(), 0);
        assert.equal(await action(kind).evaluate((el) => el === document.activeElement), true);
        assert.equal((await state()).intents.length, 0);
      }
      await scene("create-open");
      await page.locator('[type="submit"]').click();
      assert.equal((await state()).intents.length, 0);
      assert.equal(
        await page.locator('[name="name"]').evaluate((el) => el === document.activeElement),
        true,
      );
      for (const [k, val] of Object.entries(data.edited))
        await page.locator(`[name="${k}"]`).fill(val);
      await page.keyboard.press("Escape");
      await action("create").click();
      assert.deepEqual((await state()).form, data.edited);
      await page.locator('[type="submit"]').click();
      await page.keyboard.press("Escape");
      assert.equal((await state()).modal, "create");
      await idle();
      assert.deepEqual((await state()).lastIntent, data.createIntent);
      assert.equal((await state()).navigation, `/opportunities/${data.manual.id}`);
      await scene("create-failed");
      await page.locator('[type="submit"]').click();
      await idle();
      assert.equal((await state()).modal, "create");
      assert.deepEqual((await state()).form, data.edited);
      for (const kind of ["assign", "review", "archive"]) {
        await scene(`${kind}-edited`);
        await page.locator('[type="submit"]').click();
        await idle();
        assert.deepEqual((await state()).lastIntent, data.batchIntents[kind]);
        assert.deepEqual((await state()).selected, []);
        await scene(`${kind}-failed`);
        await page.locator('[type="submit"]').click();
        await idle();
        assert.equal((await state()).modal, kind);
        assert.equal((await state()).reason, "  已核对当前页范围  ");
        await page.keyboard.press("Escape");
        await action(kind).click();
        assert.equal((await state()).reason, "");
        assert.equal((await state()).assignee, "");
      }
      await scene("review-edited");
      await page.locator('[name="reason"]').fill("   ");
      await page.locator('[type="submit"]').click();
      assert.equal((await state()).intents.length, 0);
      assert.equal(await page.locator('[name="reason"]').getAttribute("aria-invalid"), "true");
      await scene("cross-page");
      await action("review").click();
      assert.match(await page.locator("dialog").innerText(), /本次实际处理 1 项/);
      await page.locator('[name="reason"]').fill("核对当前范围");
      await page.locator('[type="submit"]').click();
      await idle();
      assert.deepEqual((await state()).lastIntent.body.items, [
        { id: "00000000-0000-4000-8000-000000000439", expected_version: 7 },
      ]);
      await scene("hidden-selection");
      assert.equal(await action("review").isDisabled(), true);
      await action("prev").click();
      assert.equal((await state()).selected.length, 2);
      assert.equal(await action("review").isDisabled(), false);
      await action("view:recommended").click();
      assert.deepEqual((await state()).selected, []);
      for (const name of ["members-failed", "members-empty"]) {
        await scene(name);
        assert.equal(await action("assign").isDisabled(), true);
        assert.equal(await action("review").isDisabled(), false);
      }
      await scene("readonly");
      for (const name of ["create", "erp", "assign", "review", "archive"])
        assert.equal(await page.locator(`[data-action="${name}"]`).count(), 0);
      await scene("erp-open");
      await page.locator('[name="limit"]').fill("501");
      await page.locator('[type="submit"]').click();
      assert.equal((await state()).intents.length, 0);
      await page.locator('[name="limit"]').fill("50");
      await page.locator('[type="submit"]').click();
      await action("close").click();
      assert.equal((await state()).busy, true);
      assert.equal((await state()).modal, null);
      await idle();
      assert.deepEqual((await state()).bridgeIntent, {
        action: "erp.products.read",
        payload: { limit: 50 },
      });
      assert.equal((await state()).lastIntent.body.total, 1);
      for (const listFormat of [false, true]) {
        await scene("erp-open");
        await page.locator('[name="erp-file"]').setInputFiles({
          name: "isolated-erp.json",
          mimeType: "application/json",
          buffer: Buffer.from(
            JSON.stringify(listFormat ? { list: data.erpFile.items } : data.erpFile.items),
          ),
        });
        await idle();
        const intent = (await state()).lastIntent;
        assert.deepEqual(intent.body.items, data.erpFile.items);
        assert.equal(intent.body.source_url, data.erpFile.source_url);
        assert.equal("total" in intent.body, false);
        assert.equal(new Date(intent.body.captured_at).toISOString(), intent.body.captured_at);
        assert.equal((await state()).intents.length, 1);
      }
      await scene("erp-open");
      await page.locator('[name="erp-file"]').setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from("{"),
      });
      await page.waitForFunction(() => window.OP_C.state().modalError.includes("格式无效"));
      assert.equal((await state()).intents.length, 0);
      for (const name of ["erp-login-opened", "erp-login-required", "erp-helper-missing"]) {
        await scene(name);
        await page.locator('[type="submit"]').click();
        assert.equal((await state()).intents.length, 0);
      }
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `opportunity_c width=${width} scenes=${names.length} source/create/batch/filters/ERP/modal/readonly passed; HTTP=0 storage=0; no Vue or production acceptance`,
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
    `${JSON.stringify({ version: data.version, approval: "pending", capturedAt: new Date().toISOString(), sourceHashes, knownGaps: data.knownGaps, boundary: "Isolated C proposal only, historical fixture plus explicit synthetic variants. Six dialog variants, source function payload extraction, current-page effective selection, ERP close not cancellation. No actual Vue fixes, API writes, ERP helper, DB/RBAC, approval or production deployment. Draft/applied distinction, image fallback, modal protections and influence preview are pending proposals.", screenshots }, null, 2)}\n`,
  );
else
  assert.deepEqual(
    previous.screenshots.map((v) => v.file),
    expected,
  );
