import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as createPortProbe } from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import ts from "typescript";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proposal = process.argv.includes("--proposal");
if (process.argv.slice(2).some((argument) => argument !== "--proposal"))
  throw new Error("Only --proposal is supported");
const outputPrefix = proposal ? "design/tasks" : "runtime/tasks";
const evidenceKind = proposal
  ? "vue-style-proposal-isolated-not-approved"
  : "vue-contract-fixture-baseline-not-production";
const output = path.join(root, "design-plans/ui-phase-2-2026-09-07", outputPrefix);
const proposalPath = "design-plans/ui-phase-2-2026-09-07/design/task-ledger-proposal.css";
const proposalSource = proposal ? await readFile(path.join(root, proposalPath), "utf8") : null;
const fixturePath = "tests/e2e/helpers/business-tasks.ts";
const fixtureSource = await readFile(path.join(root, fixturePath), "utf8");
// Only the repository's existing, reviewed fixture is compiled; no user input is evaluated.
const compiled = ts.transpileModule(fixtureSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { setupBusinessTasks, taskId, task } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const inventoryRoot = path.join(root, "design-plans/ui-phase-2-2026-09-07");
const baseline = JSON.parse(await readFile(path.join(inventoryRoot, "baseline.json"), "utf8"));
const inventory = JSON.parse(
  await readFile(path.join(inventoryRoot, "actions.json"), "utf8"),
).candidates;
const sha = (value) => createHash("sha256").update(value).digest("hex");
const textSha = (value) => sha(value.replace(/\r\n/g, "\n"));
for (const source of baseline.sources) {
  assert.equal(
    sha(await readFile(path.join(root, source.file), "utf8")),
    source.sha256,
    `stale source inventory: ${source.file}; regenerate inventory before capturing`,
  );
}
const site = (file, event, expression) => {
  const matches = inventory.filter(
    (item) =>
      item.file === `apps/web/src/components/${file}.vue` && item.events?.[event] === expression,
  );
  assert.equal(matches.length, 1, `source site must resolve uniquely: ${file} ${expression}`);
  return matches[0].candidateId;
};
const actionSites = {
  "task.list.create.open": site("TaskWorkspace", "@click", "showCreate = true"),
  "task.detail.progress.open": site("TaskDetailPanel", "@click", "$emit('action', 'progress')"),
  "task.detail.progress.submit": site(
    "TaskDetailPanel",
    "@submit.prevent",
    "$emit('submitAction')",
  ),
};
const variants = [
  { action: "pause", label: "暂停" },
  { action: "delay", label: "调整期限" },
  { action: "transfer", label: "转交负责人" },
  { action: "cancel", label: "取消任务" },
];
for (const variant of variants) {
  actionSites[`task.detail.${variant.action}.open`] = site(
    "TaskDetailPanel",
    "@click",
    `$emit('action', '${variant.action}')`,
  );
}
let server, browser;
const cases = [],
  screenshots = [];
try {
  // Vite treats port=0 as its default; reserve an OS-selected port and fail closed on a race.
  const probe = createPortProbe();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  server = await createServer({
    configFile: path.join(root, "apps/web/vite.config.ts"),
    server: { host: "127.0.0.1", port, strictPort: true, open: false },
    logLevel: "error",
  });
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  await mkdir(output, { recursive: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const unexpectedRequests = [],
      errors = [],
      operations = [];
    await page.route("**/api/**", async (route) => {
      unexpectedRequests.push({
        method: route.request().method(),
        path: new URL(route.request().url()).pathname,
      });
      await route.fulfill({
        status: 503,
        json: { error: { code: "uncovered_fixture", message: "Uncovered local fixture" } },
      });
    });
    const observed = await setupBusinessTasks(page);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === `/api/v1/tasks/${taskId}/actions`
      )
        operations.push(request.postDataJSON());
    });
    async function snapshot(routeId, state, file) {
      await page.evaluate(() => document.fonts.ready);
      const controls = await page
        .locator(
          "button, a[href], summary, input, select, textarea, [role=button], [role=tab], [role=menuitem]",
        )
        .evaluateAll((nodes) =>
          nodes
            .filter(
              (node) =>
                node.getClientRects().length && getComputedStyle(node).visibility !== "hidden",
            )
            .map((node) => {
              const bounds = node.getBoundingClientRect();
              return {
                tag: node.tagName.toLowerCase(),
                role: node.getAttribute("role"),
                name: (
                  node.getAttribute("aria-label") ||
                  node.textContent ||
                  node.getAttribute("placeholder") ||
                  ""
                )
                  .trim()
                  .replace(/\s+/g, " ")
                  .slice(0, 240),
                disabled:
                  node.matches(":disabled") || node.getAttribute("aria-disabled") === "true",
                expanded: node.getAttribute("aria-expanded"),
                width: Math.round(bounds.width),
                height: Math.round(bounds.height),
                insideDialog: Boolean(node.closest("dialog[open]")),
              };
            }),
        );
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `${routeId}/${state}: page must not overflow`);
      assert.doesNotMatch(
        await page.locator("body").innerText(),
        /\bNaN\b/,
        "fixture contract must not produce NaN",
      );
      if (proposal) {
        const radii = await page
          .locator(".task-detail, .task-action-dialog[open]")
          .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).borderRadius));
        assert.ok(
          radii.every((radius) => radius === "0px"),
          "proposal detail/dialog must have zero radius",
        );
      }
      await page.screenshot({
        path: path.join(output, file),
        fullPage: !state.endsWith("dialog"),
        animations: "disabled",
      });
      const item = {
        routeId,
        state,
        viewport,
        file: `${outputPrefix}/${file}`,
        kind: evidenceKind,
        capturedAt: new Date().toISOString(),
        browser: browser.version(),
        sourceFingerprint: baseline.sourceFingerprint,
        sourceRevision: baseline.sourceRevision,
        concretePath: new URL(page.url()).pathname,
        role: "fixture-selection-manager-not-real-RBAC",
        theme: "deep-ocean",
        os: process.platform,
        sha256: sha(await readFile(path.join(output, file))),
        pageOverflow: overflow,
        controls,
      };
      screenshots.push(item);
      return item;
    }
    await page.goto(`${origin}/tasks`, { waitUntil: "domcontentloaded" });
    if (proposal) {
      await page.addStyleTag({ content: proposalSource });
      await page.evaluate(() => document.body.classList.add("phase2-task-study"));
    }
    await page.locator(".task-row-main").first().waitFor();
    assert.equal(await page.locator(".task-row-main").count(), 2);
    await snapshot("P23", "business-list", `${viewport.width}-P23-list.png`);
    await page
      .getByRole("button", { name: /新建任务/ })
      .first()
      .click();
    await page.locator("dialog[open]").waitFor();
    await snapshot("P23", "create-dialog", `${viewport.width}-P23-create.png`);
    cases.push({
      id: "task.list.create.open",
      candidateId: actionSites["task.list.create.open"],
      viewport,
      status: "vue-fixture-passed",
      evidence: screenshots.at(-1).file,
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page.locator(".task-row-main").filter({ hasText: "核验便携净水杯供应商报价" }).click();
    await page.waitForURL(new RegExp(`/tasks/${taskId}`));
    await page.getByText("已完成亚马逊竞品初筛", { exact: true }).waitFor();
    await snapshot("P24", "detail", `${viewport.width}-P24-detail.png`);
    await page.getByText("更多任务操作", { exact: true }).click();
    await snapshot("P24", "more-actions", `${viewport.width}-P24-more.png`);
    for (const variant of variants) {
      const opener = page.getByRole("button", { name: variant.label, exact: true });
      await opener.click();
      const dialog = page.locator(".task-action-dialog[open]");
      await dialog.waitFor();
      assert.ok(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
        "modal gets focus",
      );
      await snapshot(
        "P24",
        `${variant.action}-dialog`,
        `${viewport.width}-P24-${variant.action}.png`,
      );
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.ok(
        await opener.evaluate((node) => node === document.activeElement),
        "Escape restores opener focus",
      );
      assert.equal(observed.actionRequests, 0, "cancelled modal must not submit");
      const id = `task.detail.${variant.action}.open`;
      cases.push({
        id,
        candidateId: actionSites[id],
        viewport,
        status: "vue-fixture-open-cancel-passed",
        evidence: screenshots.at(-1).file,
        initialFocus: "inside-dialog",
        escape: "closed",
        focusReturn: "opener",
        writeRequests: 0,
        limitation: "Final submit, validation errors and other roles are not covered by this case.",
      });
    }
    await page.getByText("更多任务操作", { exact: true }).click();
    await page.getByRole("button", { name: "更新进度", exact: true }).click();
    await page.locator(".task-action-dialog[open]").waitFor();
    await snapshot("P24", "progress-dialog", `${viewport.width}-P24-progress.png`);
    cases.push({
      id: "task.detail.progress.open",
      candidateId: actionSites["task.detail.progress.open"],
      viewport,
      status: "vue-fixture-passed",
      evidence: screenshots.at(-1).file,
    });
    await page.getByLabel("完成进度（0–100）").fill("45");
    await page.getByLabel("本次进展说明").fill("隔离验收：已核对报价，等待交期证据。");
    await page
      .locator(".task-action-dialog")
      .getByRole("button", { name: "确认提交", exact: true })
      .click();
    await page.locator(".task-action-dialog[open]").waitFor({ state: "hidden" });
    assert.equal(observed.actionRequests, 1);
    assert.equal(operations.length, 1);
    assert.equal(operations[0].action, "progress");
    assert.equal(operations[0].progress_percent, 45);
    assert.equal(operations[0].expected_version, 2);
    cases.push({
      id: "task.detail.progress.submit",
      candidateId: actionSites["task.detail.progress.submit"],
      viewport,
      status: "vue-contract-fixture-passed-not-database-execution",
      request: { method: "POST", path: "/tasks/{taskId}/actions", body: operations[0] },
      requests: observed.actionRequests,
    });
    assert.deepEqual(
      unexpectedRequests,
      [],
      "every API used by this local chain must have an explicit existing fixture",
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  if (proposal) {
    await writeFile(
      path.join(inventoryRoot, "design/task-concept-data.js"),
      `window.SCOUTOPS_TASK_CONCEPT = ${JSON.stringify({ task, fixturePath, fixtureSha256: textSha(fixtureSource), kind: "isolated-fixture-design-only" }).replaceAll("<", "\\u003c")};\n`,
    );
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(inventoryRoot, "design/task-review.html")).href);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator("#viewport").selectOption(String(width));
      const scenes = await page
        .locator("#scene option")
        .evaluateAll((nodes) => nodes.map((node) => node.value));
      assert.equal(scenes.length, 9);
      for (const scene of scenes) {
        await page.locator("#scene").selectOption(scene);
        await page.waitForFunction(() =>
          [...document.querySelectorAll(".comparison img")].every(
            (img) => img.complete && img.naturalWidth > 0,
          ),
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
    const conceptProof = [];
    const conceptDir = path.join(inventoryRoot, "design/directions");
    await mkdir(conceptDir, { recursive: true });
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const conceptContext = await browser.newContext({ viewport });
      const conceptPage = await conceptContext.newPage();
      const conceptErrors = [];
      const externalRequests = [];
      conceptPage.on("pageerror", (error) => conceptErrors.push(error.message));
      await conceptPage.route(/^https?:/, async (route) => {
        externalRequests.push(route.request().url());
        await route.abort();
      });
      await conceptPage.goto(
        pathToFileURL(path.join(inventoryRoot, "design/task-directions.html")).href,
      );
      for (const direction of ["focus", "brief"]) {
        await conceptPage.locator("#direction").selectOption(direction);
        for (const state of ["list", "detail", "progress"]) {
          if (state === "detail") await conceptPage.locator("#open-detail").click();
          if (state === "detail") {
            const actionBounds = await conceptPage.locator("#open-progress").boundingBox();
            assert.ok(
              actionBounds &&
                actionBounds.y >= 0 &&
                actionBounds.y + actionBounds.height <= viewport.height,
              "prototype main action must be visible in first viewport",
            );
          }
          if (state === "progress") await conceptPage.locator("#open-progress").click();
          await conceptPage.evaluate(() => document.fonts.ready);
          assert.equal(
            await conceptPage.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
          );
          const filename = `${viewport.width}-${direction}-${state}.png`;
          const metrics = await checkPrototypeMetrics(conceptPage);
          await conceptPage.screenshot({
            path: path.join(conceptDir, filename),
            fullPage: state !== "progress",
            animations: "disabled",
          });
          conceptProof.push({
            metrics,
            direction,
            state,
            viewport,
            file: `design/directions/${filename}`,
            sha256: sha(await readFile(path.join(conceptDir, filename))),
            capturedAt: new Date().toISOString(),
          });
        }
        await conceptPage.locator("#percent-input").fill("101");
        await conceptPage.locator("#progress-form button[type=submit]").click();
        assert.equal(await conceptPage.locator("#preview-result").isVisible(), false);
        await conceptPage.locator("#percent-input").fill("45");
        await conceptPage.locator("#progress-form button[type=submit]").click();
        assert.equal(await conceptPage.locator("#preview-result").isVisible(), true);
        await conceptPage.locator("#progress-form button[type=submit]").focus();
        await conceptPage.keyboard.press("Tab");
        assert.ok(
          await conceptPage
            .locator("#percent-input")
            .evaluate((node) => node === document.activeElement),
        );
        await conceptPage.keyboard.press("Shift+Tab");
        assert.ok(
          await conceptPage
            .locator("#progress-form button[type=submit]")
            .evaluate((node) => node === document.activeElement),
        );
        await conceptPage.keyboard.press("Escape");
        assert.ok(
          await conceptPage
            .locator("#open-progress")
            .evaluate((node) => node === document.activeElement),
        );
        await conceptPage.locator("#back").click();
        assert.equal(await conceptPage.locator("#queue").isVisible(), true);
      }
      assert.deepEqual(conceptErrors, []);
      assert.deepEqual(externalRequests, []);
      await conceptContext.close();
    }
    await writeFile(
      path.join(conceptDir, "evidence.json"),
      JSON.stringify(
        {
          kind: "independent-html-design-prototypes-not-vue-not-production",
          approval: "pending-user-review",
          source: "design/task-directions.html",
          sourceSha256: textSha(
            await readFile(path.join(inventoryRoot, "design/task-directions.html"), "utf8"),
          ),
          sharedStyle: {
            source: "design/representative-directions.css",
            sha256: textSha(
              await readFile(
                path.join(inventoryRoot, "design/representative-directions.css"),
                "utf8",
              ),
            ),
          },
          fixturePath,
          fixtureSha256: textSha(fixtureSource),
          textHashEncoding: "utf8-lf",
          screenshots: conceptProof,
          checks: [
            "list-detail-return",
            "progress-modal",
            "0-100-validation",
            "preview-only-submit",
            "escape-focus-return",
            "forward-and-reverse-tab-loop",
            "no-network",
            "no-page-overflow",
          ],
          limitations: [
            "Only one sample task; not the full task action/role/state contract.",
            "Independent HTML prototypes, not approved Vue implementation.",
            "No data persistence or backend authorization is tested.",
          ],
        },
        null,
        2,
      ) + "\n",
    );
  }
  await writeFile(
    path.join(output, "evidence.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        kind: evidenceKind,
        fixturePath,
        fixtureSha256: textSha(fixtureSource),
        textHashEncoding: "utf8-lf",
        proposal: proposal
          ? {
              path: proposalPath,
              sha256: textSha(proposalSource),
              approval: "pending-user-review",
              productionImported: false,
            }
          : null,
        sourceFingerprint: baseline.sourceFingerprint,
        pages: ["P23", "P24"],
        cases,
        screenshots,
        limitations: [
          "Existing route fixtures, not a live database or real authorization service.",
          "Visible DOM sites are not a complete runtime action/role/state denominator.",
          "Task action API success is simulated by the existing fixture; persisted progress is not proven.",
          proposal
            ? "CSS injected only in this isolated browser; proposal not approved or imported into production."
            : "These are pre-redesign baseline images, not approved design or final implementation evidence.",
        ],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(
    `ui_phase2_tasks_captured pages=2 screenshots=${screenshots.length} cases=${cases.length}`,
  );
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
}
