import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { chromium } from "playwright";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/status-direction-c";
const root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const sources = ["index.html", "data.js", "status.js", "status.css"]
  .map((file) => `${relative}/${file}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/PlatformManagementCenter.vue",
    "apps/web/src/components/platform-status-topology.ts",
    "apps/web/src/components/use-platform-status.ts",
    "apps/web/src/components/platform-management-presentation.ts",
    "apps/web/src/realtime-client-metrics.ts",
    "apps/api/src/mysql-platform-dashboard-repository.ts",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "config/route-catalog.json",
    "scripts/verify-ui-phase2-status-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ]);
const sourceTexts = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
    ]),
  ),
);
const sourceHashes = Object.fromEntries(
  Object.entries(sourceTexts).map(([file, value]) => [file, hash(value)]),
);
const plain = (value) => JSON.parse(JSON.stringify(value));
const fixtureSource = ts.createSourceFile(
  "fixture.ts",
  sourceTexts["tests/e2e/m06-02-platform-dashboard.spec.ts"],
  ts.ScriptTarget.Latest,
  true,
);
const fixtures = [],
  metrics = [];
function visit(node) {
  if (ts.isObjectLiteralExpression(node)) {
    const text = node.getText(fixtureSource);
    if (/^\{\s*domain: "status",/.test(text)) fixtures.push(vm.runInNewContext(`(${text})`));
    if (/^\{\s*session_started_at: "2026-08-18T11:30:00.000Z",/.test(text))
      metrics.push(vm.runInNewContext(`(${text})`));
  }
  ts.forEachChild(node, visit);
}
visit(fixtureSource);
assert.equal(fixtures.length, 1);
assert.equal(metrics.length, 1);
const sandbox = { window: {} };
vm.runInNewContext(sourceTexts[`${relative}/data.js`], sandbox);
const original = plain(sandbox.window.SCOUTOPS_STATUS_DESIGN);
const { domain, ...expected } = plain(fixtures[0]);
assert.equal(domain, "status");
assert.deepEqual(
  original,
  { ...expected, metrics: plain(metrics[0]) },
  "Design sample must equal reviewed status fixture",
);
const topologyContext = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(sourceTexts["apps/web/src/components/platform-status-topology.ts"], {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  topologyContext,
);
assert.deepEqual(
  plain(sandbox.window.SCOUTOPS_STATUS_TOPOLOGY),
  plain(topologyContext.exports.statusTopologyDefinitions),
);
const scenes = [
  "attention",
  "dependencies",
  "session",
  "activity",
  "technical",
  "refresh-busy",
  "refresh-failed",
  "refresh-timeout",
  "recovered",
  "initial-loading",
  "initial-network",
  "initial-server",
  "initial-permission",
  "initial-timeout",
  "missing-redis",
  "missing-all",
  "counts-empty",
  "no-warnings",
  "session-reconnecting",
  "session-zero",
];
const controlScenes = ["refresh-hover", "refresh-focus", "refresh-pressed"];
if (!capture) {
  const prior = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(prior.sourceHashes, sourceHashes, "Source drift; review before recapture");
  assert.deepEqual(
    prior.screenshots.map((shot) => shot.file),
    [1440, 390].flatMap((width) =>
      [...scenes, ...controlScenes].map((scene) => `${width}-${scene}.png`),
    ),
  );
  for (const shot of prior.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [];
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
      async function shot(scene) {
        const metrics = await checkPrototypeMetrics(page);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${width}/${scene} horizontal overflow`,
        );
        const linkViolations = await page
          .locator("a.action-link:visible, summary:visible")
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => {
                const rect = node.getBoundingClientRect();
                return (
                  rect.height < 43.9 ||
                  rect.width < 43.9 ||
                  Number.parseFloat(getComputedStyle(node).fontSize) < 16
                );
              })
              .map((node) => node.textContent),
          );
        assert.deepEqual(linkViolations, []);
        if (capture) {
          const file = `${width}-${scene}.png`;
          await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({
            file,
            pageId: "P61",
            scene,
            viewport,
            fullPage: true,
            environment: "isolated-html-fixture",
            approval: "pending",
            sha256: hash(await readFile(path.join(root, file))),
            metrics,
          });
        }
      }
      for (const scene of scenes) {
        await page.locator("#scene").selectOption(scene);
        await page.mouse.move(0, 0);
        if (
          ["attention", "recovered", "refresh-busy", "refresh-failed", "refresh-timeout"].includes(
            scene,
          )
        ) {
          assert.equal(await page.locator(".alert-row").count(), 2);
          assert.match(
            await page.locator('[data-code="redis"] .affected').textContent(),
            /Node API、Node Worker、Python Crawler/,
          );
          assert.match(
            await page.locator('[data-code="files"] .affected').textContent(),
            /Node Worker、Python Crawler/,
          );
          assert.match(await page.locator("#observation").textContent(), /2026-08-18 20:00:00/);
        }
        if (scene === "dependencies") {
          assert.equal(await page.locator(".dependency-row").count(), 6);
          assert.match(
            await page.locator('.dependency-row[data-code="api"] dd').first().textContent(),
            /MySQL、Redis/,
          );
          assert.match(
            await page.locator('.dependency-row[data-code="crawler"] dd').first().textContent(),
            /Node API、Node Worker、文件存储/,
          );
        }
        if (scene.startsWith("initial-")) {
          assert.equal(await page.locator("#content").isVisible(), false);
          assert.equal(await page.locator("#unavailable").isVisible(), true);
        }
        if (scene === "initial-timeout")
          assert.match(await page.locator("#failure").textContent(), /尚无成功数据可保留/);
        if (scene.includes("busy") || scene === "initial-loading")
          assert.equal(await page.locator("#refresh").isDisabled(), true);
        if (scene === "refresh-failed" || scene === "refresh-timeout")
          assert.match(await page.locator("#failure").textContent(), /保留上次成功数据/);
        if (scene === "recovered") assert.equal(await page.locator("#failure").isVisible(), false);
        if (scene === "missing-redis") {
          assert.match(
            await page.locator('.alert-row[data-code="redis"]').textContent(),
            /待检查.*尚无运行观测/s,
          );
          assert.equal(await page.locator(".alert-row").count(), 2);
        }
        if (scene === "missing-all") {
          assert.equal(await page.locator('.dependency-row[data-state="unknown"]').count(), 6);
          assert.equal(await page.locator('.dependency-row[data-state="ready"]').count(), 0);
        }
        if (scene === "counts-empty") {
          assert.match(
            await page.locator("#collections").textContent(),
            /当前没有采集任务状态记录/,
          );
          assert.match(await page.locator("#sources").textContent(), /当前没有来源配置记录/);
        }
        if (scene === "no-warnings") {
          assert.equal(await page.locator(".alert-row").count(), 0);
          assert.match(await page.locator("#alerts").textContent(), /当前未观测到/);
        }
        if (scene === "session" || scene === "session-reconnecting") {
          assert.equal(await page.locator("#rate").textContent(), "20.00%");
          assert.match(await page.locator("#events").textContent(), /2 次重连 \/ 10 次连接事件/);
          assert.match(
            await page.locator("#session-view").textContent(),
            /仅统计当前浏览器标签页会话/,
          );
        }
        if (scene === "session-reconnecting")
          assert.equal(await page.locator("#reconnecting").textContent(), "正在自动重连");
        if (scene === "session-zero") {
          assert.equal(await page.locator("#rate").textContent(), "0.00%");
          assert.deepEqual(await page.locator("#session-times dd").allTextContents(), [
            "2026-08-18 19:30:00",
            "—",
            "—",
          ]);
        }
        if (scene === "activity") {
          assert.deepEqual(await page.locator("#summary dd").allTextContents(), [
            "正常",
            "正常",
            "5",
            "2",
            "8",
          ]);
          assert.equal(await page.locator("#sources strong").textContent(), "138");
        }
        if (scene === "technical")
          assert.equal(await page.locator("#technical").evaluate((node) => node.open), true);
        await shot(scene);
      }
      // Six refresh states: default, hover, focus, pressed, disabled, in progress.
      await page.locator("#scene").selectOption("attention");
      const refresh = page.locator("#refresh");
      await refresh.hover();
      await shot("refresh-hover");
      await page.mouse.move(0, 0);
      await refresh.focus();
      // A keyboard event ensures the native :focus-visible modality.
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      assert.equal(await refresh.evaluate((node) => node.matches(":focus-visible")), true);
      await shot("refresh-focus");
      await refresh.hover();
      await page.mouse.down();
      assert.equal(await refresh.evaluate((node) => node.matches(":active")), true);
      await shot("refresh-pressed");
      await page.mouse.move(0, 0);
      await page.mouse.up();
      // Local single-flight and recovery; do not misrepresent as real AbortController/API coverage.
      await page.locator("#scene").selectOption("attention");
      const initialCount = (await page.evaluate(() => window.STATUS_DESIGN_DIAGNOSTICS())).requests;
      await page.locator("#outcome").selectOption("network");
      await page.evaluate(() => {
        document.querySelector("#refresh").click();
        document.querySelector("#refresh").click();
      });
      assert.equal(
        (await page.evaluate(() => window.STATUS_DESIGN_DIAGNOSTICS())).requests,
        initialCount + 1,
      );
      assert.equal(await refresh.isDisabled(), true);
      await page.waitForFunction(() => !window.STATUS_DESIGN_DIAGNOSTICS().busy);
      assert.match(await page.locator("#failure").textContent(), /已保留上次成功数据/);
      assert.equal(await page.locator(".alert-row").count(), 2);
      for (const outcome of ["timeout", "permission", "server", "success"]) {
        await page.locator("#outcome").selectOption(outcome);
        await refresh.click();
        await page.waitForFunction(() => !window.STATUS_DESIGN_DIAGNOSTICS().busy);
        assert.equal(await page.locator("#failure").isVisible(), outcome !== "success");
        assert.equal(await page.locator(".alert-row").count(), 2);
        assert.match(await page.locator("#observation").textContent(), /2026-08-18 20:00:00/);
      }
      await page.locator("#scene").selectOption("initial-network");
      await page.locator("#retry").click();
      await page.waitForFunction(() => !window.STATUS_DESIGN_DIAGNOSTICS().busy);
      assert.equal(await page.locator("#content").isVisible(), true);
      // Management refresh cannot replace the independent browser-session metrics.
      await page.locator("#scene").selectOption("session-zero");
      await refresh.click();
      await page.waitForFunction(() => !window.STATUS_DESIGN_DIAGNOSTICS().busy);
      assert.equal(await page.locator("#rate").textContent(), "0.00%");
      await page.locator("#scene").selectOption("session-reconnecting");
      await refresh.click();
      await page.waitForFunction(() => !window.STATUS_DESIGN_DIAGNOSTICS().busy);
      assert.equal(await page.locator("#reconnecting").textContent(), "正在自动重连");
      // Switching a review fixture invalidates an in-flight preview response.
      await refresh.click();
      await page.locator("#scene").selectOption("missing-all");
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.dependency-row[data-state="unknown"]').count(), 6);
      // All links retain real catalog destinations, but preview intercepts navigation.
      await page.locator("#scene").selectOption("attention");
      const visited = new Set();
      for (const section of ["attention", "dependencies", "session", "activity"]) {
        await page.locator(`[data-section="${section}"]`).click();
        assert.equal(
          await page.locator(`[data-section="${section}"]`).getAttribute("aria-pressed"),
          "true",
        );
        for (const link of await page.locator("a.action-link:visible").all()) {
          const href = await link.getAttribute("href");
          assert.ok(sourceTexts["config/route-catalog.json"].includes(`"${href}"`), href);
          await link.click();
          assert.ok((await page.locator("#review-note").textContent()).includes(href));
          visited.add(href);
        }
      }
      assert.equal(visited.size, 7);
      await page.locator("#technical summary").click();
      assert.equal(await page.locator("#technical").evaluate((node) => node.open), true);
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#technical").evaluate((node) => node.open), false);
      assert.deepEqual(await page.evaluate(() => window.SCOUTOPS_STATUS_DESIGN), original);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `status_c width=${width} 20 scenarios + 3 control states; fixture/topology/links/retention/single-flight/metrics passed; HTTP=0 errors=0`,
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
    `${JSON.stringify({ version: "STATUS-C-r1", pageId: "P61", kind: "formal-design-proposal-not-vue-not-production", approval: "pending", observedAt: original.observed_at, capturedAt: new Date().toISOString(), boundary: "Historical M06-02 fixture plus explicitly labeled derived boundary scenarios. Accelerated local reads are not network/15s timeout/RBAC/production proof. No service actions, no storage, no new dialogs. First-timeout copy correction is proposed only; existing Vue unchanged.", sourceHashes, screenshots }, null, 2)}\n`,
  );
