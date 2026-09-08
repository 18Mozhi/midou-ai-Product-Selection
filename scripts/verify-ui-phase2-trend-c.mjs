import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildTrendDesignData } from "./lib/ui-phase2-trend-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/trend-direction-c",
  root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const sources = ["index.html", "trend.css", "trend.js", "view.js", "data.js"]
  .map((v) => `${relative}/${v}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    ...[
      "TrendDashboard.vue",
      "TrendFilterPanel.vue",
      "TrendDetailPanel.vue",
      "TrendEvidenceTimeline.vue",
      "TrendRuleDialog.vue",
      "TrendChangeQueue.vue",
      "ResponsiveFilterDrawer.vue",
      "trend-workspace-types.ts",
      "shared/monitoring-readiness.ts",
    ].map((v) => `apps/web/src/components/${v}`),
    "apps/api/src/trend-service.ts",
    "apps/api/src/trend-routes.ts",
    "apps/api/src/mysql-trend-repository.ts",
    "apps/api/src/data-quality-routes.ts",
    "apps/api/src/provider-source-routes.ts",
    "tests/e2e/ui-phase2-trend-contracts.spec.ts",
    "scripts/lib/ui-phase2-trend-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-trend-c.mjs",
  ]);
const texts = Object.fromEntries(
    await Promise.all(
      sources.map(async (f) => [
        f,
        (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n"),
      ]),
    ),
  ),
  sourceHashes = Object.fromEntries(Object.entries(texts).map(([f, s]) => [f, hash(s)]));
const data = await buildTrendDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.TREND_C_DATA)), data);
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
      await page.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.evaluate(() => document.fonts.ready);
      const scene = (n) => page.evaluate((v) => window.TREND_C_REVIEW.showScene(v), n),
        info = () => page.evaluate(() => window.TREND_C_DIAGNOSTICS()),
        idle = () => page.waitForFunction(() => !window.TREND_C_DIAGNOSTICS().busy);
      const scenes = await page.evaluate(() => window.TREND_C_REVIEW.scenes);
      assert.equal(scenes.length, 68);
      for (const name of scenes) {
        await scene(name);
        const metrics = await checkPrototypeMetrics(page);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          name,
        );
        const tiny = await page
          .locator("dialog[open] a,dialog[open] summary,main a,main summary")
          .evaluateAll((nodes) =>
            nodes
              .filter((n) => n.getClientRects().length)
              .filter((n) => {
                const r = n.getBoundingClientRect();
                return r.width < 43.9 || r.height < 43.9;
              })
              .map((n) => n.textContent),
          );
        assert.deepEqual(tiny, [], name);
        if (name === "detail-no-evidence")
          assert.equal(await page.locator(".evidence-row").count(), 0);
        if (name === "detail-readonly")
          assert.equal(
            await page
              .locator('[data-action="follow"],[data-evidence],[data-action="irrelevant"]')
              .count(),
            0,
          );
        if (name === "rules-readonly")
          assert.equal(await page.locator('[data-toggle-rule],[data-action="rule"]').count(), 0);
        if (name === "rules")
          assert.match(await page.locator(".rule-facts").textContent(), /尚未设置/);
        if (name === "governance-error" || name === "rules-error")
          assert.equal(await page.locator(".queue-record,.rule-record").count(), 0);
        if (name === "all-status") assert.ok((await info()).url.includes("status="));
        const take = async (suffix = "") => {
          const file = `${width}-${name}${suffix}.png`;
          expected.push(file);
          if (capture) {
            const fullPage = !(await page.locator("#modal").evaluate((node) => node.open));
            await page.screenshot({
              path: path.join(root, file),
              fullPage,
              animations: "disabled",
            });
            screenshots.push({
              file,
              scene: name,
              viewport,
              fullPage,
              approval: "pending",
              metrics,
              sha256: hash(await readFile(path.join(root, file))),
            });
          }
        };
        await take();
        const overflow = await page
          .locator("#modal")
          .evaluate((n) => n.open && n.scrollHeight > n.clientHeight + 2);
        if (overflow) {
          await page.locator("#modal").evaluate((n) => {
            n.scrollTop = n.scrollHeight;
          });
          await take("-lower");
        }
      }
      await scene("topics");
      await page.locator(`[data-topic="${data.detail.id}"]`).click();
      assert.equal((await info()).query.topic, data.detail.id);
      assert.equal(await page.locator("#topic-detail").isVisible(), true);
      await page.locator('a[href^="/opportunities?"]').click();
      assert.equal((await info()).lastRoute, data.opportunityRoute);
      for (const a of await page.locator(".evidence-row a").all()) {
        assert.equal(await a.getAttribute("rel"), "noopener noreferrer");
        assert.equal(await a.getAttribute("target"), "_blank");
        await a.click();
      }
      await page.locator('[data-action="back"]').click();
      assert.equal((await info()).query.topic, data.detail.id);
      assert.equal((await info()).detailOpen, false);
      await scene("detail-source");
      await page.locator("#timeline-source").selectOption("");
      assert.equal((await info()).timelineSource, "");
      assert.equal(await page.locator(".timeline li").count(), 1);
      await page.locator('[data-action="back"]').click();
      await page.locator(`[data-topic="${data.secondary.id}"]`).click();
      assert.equal((await info()).timelineSource, "");
      await scene("topics");
      if (width === 390) await page.locator('[data-action="filter"]').click();
      const filter =
        width === 390 ? page.locator("#modal #filter-form") : page.locator("main #filter-form");
      await filter.locator('[name="status"]').selectOption("");
      await filter.locator('[name="q"]').fill("skincare");
      await filter.locator('[type="submit"]').click();
      const current = await info();
      assert.ok(current.url.includes("status="));
      assert.ok(!current.lastIntent.paths[0].includes("status="));
      assert.ok(current.lastIntent.paths[0].includes("q=skincare"));
      assert.ok(!current.lastIntent.paths[0].includes("sort="));
      await scene("detail");
      await page.locator('[data-action="follow"]').click();
      await idle();
      assert.deepEqual((await info()).lastIntent, {
        path: `/trends/${data.detail.id}/follow`,
        method: "PUT",
      });
      assert.equal((await info()).detail.followed, true);
      await page.locator('[data-action="follow"]').click();
      await idle();
      assert.equal((await info()).lastIntent.method, "DELETE");
      assert.equal("body" in (await info()).lastIntent, false);
      await scene("follow-failed");
      await page.locator('[data-action="follow"]').click();
      await idle();
      assert.equal((await info()).detail.followed, false);
      // Four modal variants: focus containment, cancel/no write, Escape return, exact inputs and failure retention.
      for (const kind of ["rule", "anomaly", "irrelevant", "restore"]) {
        await scene(kind === "restore" ? "irrelevant-saved" : "detail");
        const selector = kind === "anomaly" ? "[data-evidence]" : `[data-action="${kind}"]`;
        await page.locator(selector).first().click();
        const first = page.locator("#modal button").first(),
          last = page.locator("#modal button:not(:disabled)").last();
        await first.focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(await last.evaluate((n) => n === document.activeElement), true);
        await page.keyboard.press("Tab");
        assert.equal(await first.evaluate((n) => n === document.activeElement), true);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#modal").getAttribute("open"), null);
        assert.equal((await info()).lastIntent, null);
        assert.equal(
          await page
            .locator(selector)
            .first()
            .evaluate((n) => n === document.activeElement),
          true,
        );
      }
      await scene("rule-edited");
      await page.locator('#modal [type="submit"]').click();
      await idle();
      assert.deepEqual((await info()).lastIntent, {
        method: "POST",
        path: "/trends/monitoring-rules",
        body: data.rulePayload,
      });
      assert.equal((await info()).mode, "rules");
      await scene("rule-duplicate");
      await page.locator('#modal [type="submit"]').click();
      await idle();
      assert.equal((await info()).modalError, data.duplicate.actionHint);
      assert.equal((await info()).modal, "rule");
      await scene("rule-failed");
      await page.locator('#modal [type="submit"]').click();
      await idle();
      assert.equal((await info()).modal, "rule");
      assert.deepEqual((await info()).ruleForm, data.ruleEdited);
      await scene("rules");
      await page.locator("[data-toggle-rule]").click();
      await idle();
      assert.deepEqual((await info()).lastIntent.body, {
        status: "paused",
        expected_version: 4,
        collection_interval_minutes: 180,
        recommendation_min_source_count: 3,
      });
      await page.locator("[data-toggle-rule]").click();
      await idle();
      assert.equal((await info()).lastIntent.body.expected_version, 5);
      await page.locator("[data-rule-results]").click();
      assert.equal((await info()).filters.q, data.rule.include_keywords[0]);
      assert.equal((await info()).mode, "topics");
      await scene("anomaly-edited");
      await page.locator('#modal [type="submit"]').click();
      await idle();
      assert.equal(
        (await info()).lastIntent.path,
        `/trends/${data.detail.id}/evidence/${data.detail.evidence[0].id}/quality-issues`,
      );
      assert.deepEqual((await info()).lastIntent.body, {
        severity: "critical",
        reason: "隔离复核原因：证据标题与主题不一致。",
      });
      assert.equal(await page.locator("[data-evidence]").first().isDisabled(), true);
      for (const name of ["anomaly-failed", "irrelevant-failed", "restore-failed"]) {
        await scene(name);
        const reason = (await info()).reason;
        await page.locator('#modal [type="submit"]').click();
        await idle();
        assert.equal((await info()).reason, reason);
        assert.equal(await page.locator("#modal").getAttribute("open"), "");
      }
      await scene("irrelevant-open");
      await page.locator("#modal textarea").fill("  与研究方向无关  ");
      await page.locator('#modal [type="submit"]').click();
      await idle();
      assert.deepEqual((await info()).lastIntent.body, {
        status: "irrelevant",
        reason: "与研究方向无关",
        expected_version: 3,
      });
      assert.equal((await info()).detail.evidence.length, 2);
      await page.locator('[data-action="restore"]').click();
      await page.locator("#modal textarea").fill("已补充相关证据");
      await page.locator('#modal [type="submit"]').click();
      await idle();
      assert.equal((await info()).lastIntent.body.expected_version, 4);
      for (const operation of ["merge", "split"]) {
        await scene(`${operation}-edited`);
        await page.locator('#proposal-form [type="submit"]').click();
        await idle();
        assert.deepEqual((await info()).lastIntent.body, data.proposals[operation]);
        assert.equal((await info()).requests[0].status, "pending");
        assert.equal((await info()).detail.evidence.length, 2);
      }
      for (const action of ["confirm", "reject"]) {
        await scene(`${action}-open`);
        await page.locator("#decision-form textarea").fill("  已核对本次提议  ");
        await page.locator('#decision-form [type="submit"]').click();
        await idle();
        assert.deepEqual((await info()).lastIntent.body, {
          decision: action,
          reason: "已核对本次提议",
          expected_version: 2,
        });
        assert.equal(
          (await info()).requests[0].status,
          action === "confirm" ? "confirmed" : "rejected",
        );
      }
      await scene("self-decision-failed");
      await page.locator('#decision-form [type="submit"]').click();
      await idle();
      assert.equal((await info()).requests[0].status, "pending");
      assert.match((await info()).message, /不同的活动用户/);
      await scene("detail-readonly");
      await page.locator('[data-action="refresh"]').click();
      await idle();
      assert.deepEqual((await info()).lastIntent, {
        method: "POST",
        path: "/provider-sources/refresh",
        body: {
          organization_id: "00000000-0000-4000-8000-000000000401",
          workspace_id: "00000000-0000-4000-8000-000000000402",
        },
      });
      assert.equal((await info()).detail.signal_count, 2);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `trend_c width=${width} scenes=68 source-payloads/filters/modals/governance/readonly-refresh passed HTTP=0 storage=0; known source gaps not fixed`,
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
    `${JSON.stringify({ version: "TREND-C-r1", approval: "pending", capturedAt: new Date().toISOString(), sourceHashes, sourceKnownGaps: data.knownGaps, boundary: "68 scenes at two widths plus modal lower scroll captures. Historical isolated UI2-TR fixture and explicit synthetic variants, source-extracted payloads and backend duplicate rejection. No actual Vue fix, SQL/RBAC, external originals, clipboard, API, collection or governance execution. New failure retention, status URL, missing-time copy and modal focus/busy protections are proposals.", screenshots }, null, 2)}\n`,
  );
else
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expected,
  );
