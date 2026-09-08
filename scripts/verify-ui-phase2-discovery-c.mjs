import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildDiscoveryDesignData } from "./lib/ui-phase2-discovery-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/discovery-direction-c";
const root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((value) => value === "--capture"));
const capture = process.argv.includes("--capture");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sources = ["index.html", "data.js", "discovery.js", "discovery.css"]
  .map((file) => `${relative}/${file}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/DiscoveryOverlay.vue",
    "apps/web/src/components/UiStatePanel.vue",
    "apps/web/src/ui/state-contract.ts",
    "apps/web/src/use-modal-dialog.ts",
    "apps/web/src/use-navigation-discovery.ts",
    "apps/web/src/api-client.ts",
    "apps/api/src/discovery-service.ts",
    "apps/api/src/discovery-routes.ts",
    "tests/e2e/ui-phase2-discovery-shell-contracts.spec.ts",
    "scripts/lib/ui-phase2-discovery-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-discovery-c.mjs",
  ]);
const texts = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
    ]),
  ),
);
const sourceHashes = Object.fromEntries(
  Object.entries(texts).map(([file, text]) => [file, hash(text)]),
);
const data = await buildDiscoveryDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.SCOUTOPS_DISCOVERY_DESIGN)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [],
  expectedFiles = [],
  browser = await chromium.launch({ headless: true });
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
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.evaluate(() => document.fonts.ready);
      const scene = (name) =>
        page.evaluate((value) => window.DISCOVERY_DESIGN_REVIEW.showScene(value), name);
      const diagnostics = () => page.evaluate(() => window.DISCOVERY_DESIGN_DIAGNOSTICS());
      const ready = () =>
        page.waitForFunction(() => window.DISCOVERY_DESIGN_DIAGNOSTICS().state === "ready");
      const scenes = await page.evaluate(() => window.DISCOVERY_DESIGN_REVIEW.scenes);
      assert.equal(scenes.length, 29);
      for (const name of scenes) {
        await scene(name);
        const info = await diagnostics();
        assert.equal(await page.locator("#notifications").isVisible(), info.shell === "member");
        if (["401", "403", "409", "429", "500", "503"].some((code) => name.endsWith(code))) {
          assert.deepEqual(await page.locator(".state-actions button").allTextContents(), [
            "重新加载",
            "关闭",
          ]);
          assert.equal(info.requestId, data.failure.requestId);
          assert.equal(await page.locator(".directory-link").count(), 0);
        }
        if (info.state === "loading") assert.equal(await page.locator(".state-actions").count(), 0);
        const metrics = await checkPrototypeMetrics(page);
        assert.ok(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <= innerWidth &&
              document.querySelector(".dialog-scroll").scrollWidth <=
                document.querySelector(".dialog-scroll").clientWidth,
          ),
        );
        const bottomNeeded =
          width === 390 &&
          (name === "create-all_registered" ||
            (/^search-/.test(name) &&
              !["idle", "invalid"].some((suffix) => name.endsWith(suffix)) &&
              !name.includes("filter-")));
        for (const position of bottomNeeded ? ["top", "bottom"] : ["top"]) {
          if (position === "bottom")
            await page.locator(".dialog-scroll").evaluate((node) => {
              node.scrollTop = node.scrollHeight;
            });
          const file = `${width}-${name}${position === "bottom" ? "-bottom" : ""}.png`;
          expectedFiles.push(file);
          if (capture) {
            await page.screenshot({ path: path.join(root, file), animations: "disabled" });
            screenshots.push({
              file,
              scene: name,
              position,
              viewport,
              approval: "pending",
              metrics,
              sha256: hash(await readFile(path.join(root, file))),
            });
          }
        }
      }
      await scene("search-idle");
      if (width === 390) {
        assert.ok(
          await page.evaluate(() => {
            const top = (selector) => document.querySelector(selector).getBoundingClientRect().top;
            return (
              top("#query") < top("#resource-type") &&
              top("#resource-type") < top('label[for="assignee"]') &&
              top('label[for="assignee"]') < top("#assignee")
            );
          }),
          "Mobile field labels follow their visual and DOM sequence",
        );
      }
      assert.equal(
        await page.locator("#query").evaluate((node) => node === document.activeElement),
        true,
      );
      assert.equal(await page.locator("#query").getAttribute("maxlength"), "100");
      await page.locator("#query").fill("任");
      const before = (await diagnostics()).lastRequest;
      await page.locator("#query").press("Enter");
      assert.equal((await diagnostics()).lastRequest, before);
      assert.equal(await page.locator("#query").getAttribute("aria-invalid"), "true");
      for (const type of ["task", "opportunity", "evidence", "collection_task", ""]) {
        await page.locator("#resource-type").selectOption(type);
        assert.deepEqual(
          await page
            .locator("#status option")
            .evaluateAll((nodes) =>
              nodes.slice(1).map((node) => ({ value: node.value, label: node.textContent })),
            ),
          data.statusOptions[type] || [],
        );
        await page.locator("#query").fill("  合同查询  ");
        if (type) await page.locator("#status").selectOption(data.statusOptions[type][0].value);
        if (["task", "opportunity"].includes(type))
          await page.locator("#assignee").fill("  负责人甲  ");
        else assert.equal(await page.locator("#assignee").inputValue(), "");
        await page.locator("#query").press("Enter");
        const url = new URL((await diagnostics()).lastRequest, "https://example.invalid");
        assert.equal(url.searchParams.get("q"), "合同查询");
        assert.equal(url.searchParams.get("limit"), "10");
        assert.equal(url.searchParams.get("resource_type"), type || null);
        assert.equal(
          url.searchParams.get("assignee"),
          ["task", "opportunity"].includes(type) ? "负责人甲" : null,
        );
        assert.deepEqual(
          [...url.searchParams.keys()].filter(
            (key) => !["q", "limit", "resource_type", "status", "assignee"].includes(key),
          ),
          [],
        );
        await ready();
      }
      await page.locator("#resource-type").selectOption("task");
      await page.locator("#assignee").fill("负责人甲");
      await page.locator("#status").selectOption("todo");
      await page.locator("#resource-type").selectOption("opportunity");
      assert.equal(await page.locator("#status").inputValue(), "");
      assert.equal(await page.locator("#assignee").inputValue(), "负责人甲");
      await page.locator("#close").click();
      await page.locator("#open-search").click();
      assert.equal(await page.locator("#resource-type").inputValue(), "opportunity");
      assert.equal(await page.locator("#query").inputValue(), "  合同查询  ");
      assert.equal(await page.locator(".directory-link").count(), 0);
      for (const mode of ["search", "create"]) {
        for (const code of [401, 403, 409, 429, 500, 503]) {
          await scene(`${mode}-${code}`);
          await page.locator("#retry").click();
          assert.equal((await diagnostics()).requestId, "");
          assert.equal((await diagnostics()).traceId, "");
          await ready();
          assert.equal((await diagnostics()).mode, mode);
        }
      }
      await scene("search-results");
      await page.evaluate(() => window.DISCOVERY_DESIGN_REVIEW.lateRead("forbidden", 800));
      await page.locator("#query").fill("新的查询");
      await page.locator("#query").press("Enter");
      await ready();
      await page.waitForTimeout(850);
      assert.equal((await diagnostics()).state, "ready");
      await page.evaluate(() => window.DISCOVERY_DESIGN_REVIEW.lateRead("forbidden", 800));
      await page.locator("#close").click();
      await page.locator("#open-create").click();
      await ready();
      await page.waitForTimeout(850);
      assert.equal((await diagnostics()).state, "ready");
      await scene("create-ready");
      await page.locator('[data-action="sourcing"]').click({ modifiers: ["Control"] });
      assert.equal(await page.locator("#discovery").evaluate((node) => node.open), true);
      await page.locator('[data-action="sourcing"]').click();
      assert.equal((await diagnostics()).lastNavigation, "/sourcing?create=1");
      await page.locator("#open-create").click();
      await ready();
      assert.deepEqual(
        await page
          .locator("[data-action]")
          .evaluateAll((nodes) => nodes.map((node) => node.dataset.action)),
        ["sourcing", "task"],
      );
      assert.deepEqual((await diagnostics()).recent, ["sourcing"]);
      await page.locator("#close").click();
      await page.locator("#reset").click();
      assert.deepEqual((await diagnostics()).recent, []);
      for (const item of data.actionPreviews.all_registered) {
        await scene("create-all_registered");
        await page.locator(`[data-action="${item.id}"]`).click();
        assert.equal((await diagnostics()).lastNavigation, item.route);
        assert.equal(await page.locator("#discovery").evaluate((node) => node.open), false);
      }
      await page.locator("#open-search").click();
      await page.locator("#close").focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.locator("#notifications").evaluate((node) => node === document.activeElement),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#close").evaluate((node) => node === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("#open-search").evaluate((node) => node === document.activeElement),
        true,
      );
      await page.locator("#open-search").click();
      await page.locator("#title").click();
      assert.equal(await page.locator("#discovery").evaluate((node) => node.open), true);
      await page.mouse.click(2, 2);
      assert.equal(await page.locator("#discovery").evaluate((node) => node.open), false);
      await scene("search-403");
      await page.locator("#state-close").click();
      assert.equal(await page.locator("#discovery").evaluate((node) => node.open), false);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `discovery_c width=${width} scenes=29 filters/retry/supersede/recent/focus passed HTTP=0 storage=0`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
assert.equal(expectedFiles.length, 68);
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    `${JSON.stringify({ version: "DISCOVERY-C-r1", approval: "pending", kind: "independent-proposal-not-vue-not-production", capturedAt: new Date().toISOString(), boundary: "Fixed UI2-DI fixtures and labeled capability projections. Local timer tests do not prove real HTTP abort/retry or authorization. No navigation, persistence or business writes.", sourceHashes, screenshots }, null, 2)}\n`,
  );
else
  assert.deepEqual(
    previous.screenshots.map((shot) => shot.file),
    expectedFiles,
  );
