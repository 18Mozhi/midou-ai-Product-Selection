import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildJourneyDesignData } from "./lib/ui-phase2-journey-design-data.mjs";
import { journeyControlCapture } from "./lib/ui-phase2-journey-vue-controls.mjs";
import { verifyJourneyControlsHistory } from "./lib/ui-phase2-journey-controls-history.mjs";

// Real route and Vue, isolated HTTP fixtures. Never connects to production or a database.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  relative = "output/playwright/p16-c-r2-review",
  root = path.join(repo, relative),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  data = await buildJourneyDesignData(repo),
  savedKey = "scoutops.selection-journey.active-id",
  envelope = (value) => ({ data: value, request_id: "p16-layout", trace_id: "p16-layout" }),
  screenshots = [],
  checks = [],
  controlStates = [];
const sources = [
  "apps/web/src/components/SelectionJourney.vue",
  "apps/web/src/selection-journey.css",
  "apps/web/src/design/selection-tokens.css",
  "apps/web/src/components/NavigationShell.vue",
  "apps/web/src/components/UiStatePanel.vue",
  "apps/web/src/ui/state-contract.ts",
  "apps/web/src/main.ts",
  "apps/web/src/styles.css",
  "apps/web/src/accessibility.css",
  "apps/web/src/signal-ledger.css",
  "apps/web/src/responsive-baselines.css",
  "apps/web/src/design/tokens.css",
  "apps/web/src/member-workspace-polish.css",
  "apps/web/src/navigation-shell-scoped.css",
  "apps/web/src/styles/onboarding-navigation.css",
  "apps/web/src/signal-ledger-workflows.css",
  "tests/e2e/ui-phase2-journey-contracts.spec.ts",
  "scripts/lib/ui-phase2-journey-design-data.mjs",
  "scripts/lib/ui-phase2-journey-vue-controls.mjs",
  "scripts/verify-ui-phase2-journey-vue.mjs",
  "scripts/lib/ui-phase2-journey-controls-history.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
let previous;
if (capture) await mkdir(root, { recursive: true });
else {
  // Historical evidence is version-bound; the browser below still loads current source.
  previous = await verifyJourneyControlsHistory(repo);
  assert.equal(previous.screenshots.length, 114);
  assert.equal(previous.controlStates.length, 90);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^(1440|390)-[a-z-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256, shot.file);
  }
}
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5175, strictPort: true, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
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
        unexpected = [],
        requests = [];
      let journey = structuredClone(data.sample),
        holdWrite = null,
        holdRead = null,
        failRead = false,
        rejectWrite = false;
      journey.results[1] = structuredClone(data.qualified);
      journey.first_result = journey.results[0];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (!url.pathname.startsWith("/api/")) {
          if (url.origin === "http://127.0.0.1:5175") return route.continue();
          unexpected.push(url.origin + url.pathname);
          return route.abort();
        }
        if (url.pathname === "/api/v1/me/ui-preferences")
          return route.fulfill({ json: envelope({ theme: "deep-ocean", version: 1 }) });
        if (url.pathname === "/api/v1/me/navigation")
          return route.fulfill({
            json: envelope({
              shell: "member",
              organization_id: journey.organization_id,
              workspace_id: journey.workspace_id,
              roles: ["member"],
              capabilities: ["task:create", "opportunity:read", "opportunity:decide"],
              platform_roles: [],
              platform_capabilities: [],
              guard_reason: "allowed",
            }),
          });
        if (url.pathname.startsWith("/api/v1/selection-journeys")) {
          requests.push({
            method: request.method(),
            path: url.pathname,
            body: request.postDataJSON(),
          });
          if (request.method() === "GET") {
            if (holdRead) await holdRead;
            if (failRead)
              return route.fulfill({
                status: 503,
                json: {
                  error: {
                    code: "service_unavailable",
                    message: "隔离恢复受阻",
                    action_hint: "恢复读取暂时受阻，请稍后核对原任务。",
                  },
                  request_id: "p16-read-blocked",
                  trace_id: "p16-read-blocked",
                },
              });
          }
          if (request.method() !== "GET") {
            if (holdWrite) await holdWrite;
            if (rejectWrite)
              return route.fulfill({
                status: 503,
                json: {
                  error: {
                    code: "service_unavailable",
                    message: "隔离测试：暂不可用",
                    action_hint: "请求未获成功确认，请保留输入并核对。",
                  },
                  request_id: "p16-failure",
                  trace_id: "p16-failure",
                },
              });
          }
          return route.fulfill({
            status: request.method() === "GET" ? 200 : 202,
            json: envelope(journey),
          });
        }
        unexpected.push(request.method() + " " + url.pathname);
        return route.fulfill({
          status: 404,
          json: { error: { code: "unexpected_fixture_route" } },
        });
      });
      const check = async (name, condition) => {
        const passed = await condition();
        const diagnostic = passed
          ? ""
          : await page.evaluate(() =>
              JSON.stringify({
                viewport: innerWidth,
                documentWidth: document.documentElement.scrollWidth,
                overflow: [...document.querySelectorAll("body *")]
                  .map((node) => ({
                    tag: node.tagName,
                    className: node.className,
                    x: node.getBoundingClientRect().x,
                    right: node.getBoundingClientRect().right,
                  }))
                  .filter((row) => row.right > innerWidth + 1)
                  .slice(0, 12),
              }),
            );
        assert.ok(passed, `${width} ${name}: ${diagnostic}`);
        checks.push({ width, name });
      };
      const shot = async (scene) => {
        const fullPage = scene !== "create-hover";
        if (fullPage) await page.evaluate(() => scrollTo(0, 0));
        else
          assert.ok(
            await page
              .locator(".selection-start button")
              .evaluate((node) => node.matches(":hover")),
            "hover capture must preserve pointer hit",
          );
        await check(`${scene}: no document overflow`, () =>
          page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        const file = `${width}-${scene}.png`;
        if (capture) {
          const bytes = await page.screenshot({ fullPage, animations: "disabled" });
          await writeFile(path.join(root, file), bytes);
          screenshots.push({
            file,
            scene,
            width,
            captureType: fullPage ? "full-page" : "hover-viewport",
            sha256: hash(bytes),
          });
        }
      };
      const restore = async (selector = ".selection-decision") => {
        await page.evaluate(({ key, id }) => localStorage.setItem(key, id), {
          key: savedKey,
          id: journey.id,
        });
        await page.reload();
        await page.locator(selector).waitFor();
      };
      const controls = journeyControlCapture({
        page,
        width,
        root,
        capture,
        screenshots,
        checks,
        requests,
      });
      await page.goto("http://127.0.0.1:5175/opportunities/start");
      await page.locator(".selection-start").waitFor();
      await check("C palette and typography override legacy skin locally", () =>
        page
          .locator(".selection-stage-rail h2")
          .evaluate(
            (node) =>
              getComputedStyle(node).color === "rgb(255, 255, 255)" &&
              getComputedStyle(node).fontFamily.includes("Microsoft YaHei"),
          ),
      );
      await check("C panel radius overrides legacy square panel", () =>
        page
          .locator(".selection-start")
          .evaluate((node) => parseFloat(getComputedStyle(node).borderRadius) >= 16),
      );
      await check("input phase", () =>
        page
          .locator('.selection-stage-rail [aria-current="step"]')
          .innerText()
          .then((text) => text.includes("输入线索")),
      );
      await shot("create-default");
      await controls.take("create", "J-CREATE", '.selection-start button[type="submit"]');
      await controls.take("list", "J-NAV-LIST", ".selection-workspace > header a");
      await check("radio mark is 20px within a 52px label target", () =>
        page
          .locator(".selection-kind input")
          .first()
          .evaluate(
            (node) =>
              node.getBoundingClientRect().width === 20 &&
              node.getBoundingClientRect().height === 20 &&
              node.closest("label").getBoundingClientRect().height >= 52,
          ),
      );
      const create = page.getByRole("button", { name: "创建真实选品任务", exact: true });
      await create.hover();
      await shot("create-hover");
      await create.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await check("create keyboard focus", () =>
        create.evaluate(
          (node) =>
            node.matches(":focus-visible") && getComputedStyle(node).outlineStyle !== "none",
        ),
      );
      await shot("create-focus");
      await page.getByLabel("商品关键词", { exact: true }).fill("portable blender");
      let release;
      holdWrite = new Promise((resolve) => {
        release = resolve;
      });
      rejectWrite = true;
      await create.click();
      await page.getByRole("button", { name: "正在创建真实任务…" }).waitFor();
      await check("create busy disabled", () =>
        page.locator(".selection-start button").isDisabled(),
      );
      await check("busy text is not faded by legacy opacity", () =>
        page
          .locator(".selection-start button")
          .evaluate((node) => getComputedStyle(node).opacity === "1"),
      );
      await shot("create-busy");
      await controls.take(
        "create",
        "J-CREATE",
        '.selection-start button[type="submit"]',
        ["disabled", "busy"],
        "正在创建真实任务…",
      );
      release();
      holdWrite = null;
      await page.locator(".ui-state-panel").waitFor();
      await check("failed create keeps input", () =>
        page
          .getByLabel("商品关键词", { exact: true })
          .inputValue()
          .then((value) => value === "portable blender"),
      );
      await shot("create-failed");
      const beforeCreateExplanation = requests.length;
      await page.getByRole("button", { name: "查看影响", exact: true }).click();
      await check(
        "new create blocked explanation remains creation-specific without HTTP",
        async () =>
          requests.length === beforeCreateExplanation &&
          (await page.locator(".ui-state-panel").innerText()).includes(
            "本次创建未获得服务端成功确认",
          ),
      );
      rejectWrite = false;
      await restore();
      await check("review phase", () =>
        page
          .locator('.selection-stage-rail [aria-current="step"]')
          .innerText()
          .then((text) => text.includes("审阅候选")),
      );
      const panels = await Promise.all(
        [".selection-candidates", ".selection-decision"].map((selector) =>
          page.locator(selector).boundingBox(),
        ),
      );
      await check("responsive candidate and decision regions", async () =>
        width === 1440
          ? panels[1].x > panels[0].x && Math.abs(panels[1].y - panels[0].y) < 2
          : panels[1].y >= panels[0].y + panels[0].height,
      );
      await check("unselected gates are unknown", () =>
        page
          .locator(".selection-quality-gates dd")
          .allTextContents()
          .then(
            (values) => values.length === 5 && values.every((value) => value.trim() === "未返回"),
          ),
      );
      await shot("candidate-unselected");
      await page.getByText("隔离候选 2", { exact: true }).click();
      await check("five gate rows pass", () =>
        page
          .locator('.selection-quality-gates dd[data-passed="true"]')
          .count()
          .then((count) => count === 5),
      );
      const adopt = page.getByRole("radio", { name: "采纳合格机会", exact: true });
      await check("five gates enable adoption", () => adopt.isEnabled());
      await adopt.check();
      await page.getByLabel("决策原因").fill("隔离样例：核对五项质量门与来源后记录判断。");
      await shot("adopt-ready");
      await controls.take("source", "J-SOURCE", ".selection-candidate-grid > label:first-child a");
      await controls.take("save", "J-DECIDE", '.selection-decision button[type="submit"]');
      await controls.take("reset", "J-RESET", ".selection-footer button");
      await controls.take("timeline", "J-TIMELINE", ".selection-timeline-disclosure > summary");
      const summary = page.locator(".selection-timeline-disclosure > summary"),
        before = requests.length;
      await summary.focus();
      await page.keyboard.press("Enter");
      await check("timeline keyboard expands", () =>
        page.locator(".selection-timeline").isVisible(),
      );
      await shot("timeline-open-focus");
      await page.keyboard.press("Space");
      await check(
        "timeline keyboard collapses without HTTP",
        async () =>
          !(await page.locator(".selection-timeline").isVisible()) && requests.length === before,
      );
      const save = page.getByRole("button", { name: "保存审计决策", exact: true });
      await save.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await shot("save-focus");
      holdWrite = new Promise((resolve) => {
        release = resolve;
      });
      rejectWrite = true;
      await save.click();
      await page.getByRole("button", { name: "正在保存…", exact: true }).waitFor();
      await check(
        "save and reset busy disabled",
        async () =>
          (await page.locator(".selection-decision button").isDisabled()) &&
          (await page.getByRole("button", { name: "开始下一次", exact: true }).isDisabled()),
      );
      await shot("save-busy");
      await controls.take(
        "save",
        "J-DECIDE",
        '.selection-decision button[type="submit"]',
        ["disabled", "busy"],
        "正在保存…",
      );
      await controls.take("reset", "J-RESET", ".selection-footer button", ["disabled"]);
      release();
      holdWrite = null;
      await page.locator(".ui-state-panel").waitFor();
      await check("save failure retains reason", () =>
        page
          .getByLabel("决策原因")
          .inputValue()
          .then((value) => value.startsWith("隔离样例")),
      );
      await shot("save-failed");
      const write = requests.at(-1);
      assert.deepEqual(write, {
        method: "POST",
        path: `/api/v1/selection-journeys/${journey.id}/decisions`,
        body: {
          action: "adopt",
          reason: "隔离样例：核对五项质量门与来源后记录判断。",
          selected_raw_evidence_id: journey.results[1].raw_evidence_id,
        },
      });
      journey.results[1].quality_gates.cost = false;
      journey.results[1].quality_gates.all_passed = false;
      await restore();
      await page.getByText("隔离候选 2", { exact: true }).click();
      await check(
        "four gates block adoption but keep observe and reject",
        async () =>
          (await adopt.isDisabled()) &&
          (await page.getByRole("radio", { name: "继续观察", exact: true }).isEnabled()) &&
          (await page.getByRole("radio", { name: "驳回", exact: true }).isEnabled()),
      );
      await check("cost gate shows missing", () =>
        page
          .locator(".selection-quality-gates")
          .innerText()
          .then((text) => text.includes("4 / 5") && text.includes("待补齐")),
      );
      await shot("gate-cost");
      // Terminal fixture exposes only server-returned links; no adoption POST is manufactured.
      journey.state = "decided";
      journey.decision = {
        action: "adopt",
        reason: "隔离返回的已保存决定",
        selected_raw_evidence_id: journey.results[1].raw_evidence_id,
        actor_id: "00000000-0000-4000-8000-000000007640",
        created_at: data.sample.accepted_at,
      };
      journey.opportunity_id = data.qualified.opportunity_id;
      journey.verification_task_id = "00000000-0000-4000-8000-000000007630";
      await restore(".selection-complete");
      await controls.take(
        "opportunity",
        "J-NAV-OPPORTUNITY",
        '.selection-complete a[href^="/opportunities/"]',
      );
      await controls.take("task", "J-NAV-TASK", '.selection-complete a[href^="/tasks/"]');
      journey.state = "result_ready";
      journey.decision = null;
      journey.opportunity_id = null;
      journey.verification_task_id = null;
      failRead = true;
      await restore('.ui-state-panel[data-kind="blocked"]');
      await controls.take(
        "retry",
        "J-STATE-RECOVERY",
        ".selection-workspace > .ui-state-panel .primary",
      );
      await controls.take(
        "secondary",
        "J-STATE-RECOVERY",
        ".selection-workspace > .ui-state-panel footer button:nth-child(2)",
      );
      const beforeExplanation = requests.length;
      await page.getByRole("button", { name: "查看影响", exact: true }).click();
      await check(
        "blocked secondary explains without HTTP",
        async () =>
          requests.length === beforeExplanation &&
          (await page.locator(".ui-state-panel").innerText()).includes("本次仅状态读取受阻"),
      );
      holdRead = new Promise((resolve) => {
        release = resolve;
      });
      failRead = false;
      const beforeRetry = requests.length;
      await page.getByRole("button", { name: "重试读取进度", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector(".selection-journey")?.getAttribute("aria-busy") === "true",
      );
      await check(
        "restoring retry is unrendered rather than disabled",
        async () =>
          (await page.locator(".selection-workspace > .ui-state-panel").count()) === 0 &&
          (await page.locator(".selection-start button").isDisabled()),
      );
      release();
      holdRead = null;
      await page.locator(".selection-decision").waitFor();
      await check(
        "retry rereads exact saved journey once without POST",
        async () =>
          requests.length === beforeRetry + 1 &&
          requests.at(-1).method === "GET" &&
          requests.at(-1).path === `/api/v1/selection-journeys/${journey.id}`,
      );
      controlStates.push(...controls.records);
      for (const intermediate of [768, 1024, 1280]) {
        await page.setViewportSize({ width: intermediate, height: 1000 });
        await page.waitForFunction((expected) => innerWidth === expected, intermediate);
        // Wait for responsive CSS and native details to paint; capture mode must not be the wait.
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        await check(`viewport ${intermediate} no overflow`, () =>
          page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
      }
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const beforeReset = requests.length;
      await page.getByRole("button", { name: "开始下一次", exact: true }).click();
      await page.locator(".selection-start").waitFor();
      await check(
        "visible reset activates and clears only active journey without HTTP",
        async () =>
          requests.length === beforeReset &&
          (await page.evaluate((key) => localStorage.getItem(key), savedKey)) === null,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      checks.push({ width, name: "no page errors or unmocked API/external requests" });
    } finally {
      await context.close();
    }
  }
  const expectedControls = [
    "create",
    "list",
    "source",
    "save",
    "reset",
    "timeline",
    "opportunity",
    "task",
    "retry",
    "secondary",
  ];
  const expectedStates = (key) => [
    "default",
    "hover",
    "focus",
    "pressed",
    ...(["create", "save"].includes(key)
      ? ["disabled", "busy"]
      : key === "reset"
        ? ["disabled"]
        : []),
  ];
  const cases = (rows) => rows.map((row) => `${row.width}/${row.key}/${row.state}`).sort();
  const expectedCases = [1440, 390]
    .flatMap((width) =>
      expectedControls.flatMap((key) =>
        expectedStates(key).map((state) => `${width}/${key}/${state}`),
      ),
    )
    .sort();
  assert.deepEqual(cases(controlStates), expectedCases, "missing/duplicate control state");
  if (!capture) {
    assert.deepEqual(
      cases(previous.controlStates),
      expectedCases,
      "stale saved control state matrix",
    );
  }
  if (capture)
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          version: "P16-C-r2-mounted-controls-2",
          capturedAt: new Date().toISOString(),
          approval: "pending-controls-review",
          boundary:
            "Real Vue route under existing shell; intercepted fixture HTTP, not real API/database/production. Only P16 overall layout approved. Buttons, themes and full page remain pending.",
          sourceHashes,
          checks,
          controlStates,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
  console.log(
    JSON.stringify({
      capture,
      checks: checks.length,
      screenshots: screenshots.length,
      path: relative,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
