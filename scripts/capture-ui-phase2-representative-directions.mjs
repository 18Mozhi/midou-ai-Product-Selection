import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repo, "design-plans/ui-phase-2-2026-09-07/design");
const output = path.join(root, "representative-directions");
const check = process.argv.includes("--check");
if (process.argv.slice(2).some((value) => value !== "--check"))
  throw new Error("Only --check is supported");
const hash = (content) =>
  createHash("sha256")
    .update(typeof content === "string" ? content.replace(/\r\n/g, "\n") : content)
    .digest("hex");
const inputs = {};
for (const file of [
  "representative-directions.html",
  "representative-directions.css",
  "representative-directions.js",
  "button-states.html",
])
  inputs[file] = hash(await readFile(path.join(root, file), "utf8"));
const fixtures = {};
for (const file of [
  "tests/e2e/m04-03-scoring.spec.ts",
  "tests/e2e/m06-01-organization-admin.spec.ts",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
])
  fixtures[file] = hash(await readFile(path.join(repo, file), "utf8"));
const expectedStates = {
  rules: [
    "overview",
    "detail",
    "create",
    "create-middle",
    "create-bottom",
    "preview",
    "submit",
    "submit-feedback",
  ],
  roles: ["overview", "detail", "grants", "grant", "grant-bottom", "revoke"],
  status: ["overview", "detail", "refresh-failed", "refresh-recovered"],
  controls: ["six-states"],
};
function checkCoverage(shots) {
  assert.equal(shots.length, 76);
  for (const direction of ["focus", "brief"])
    for (const width of [1440, 390])
      for (const [surface, states] of Object.entries(expectedStates))
        for (const state of states) {
          assert.equal(
            shots.filter(
              (shot) =>
                shot.direction === direction &&
                shot.viewport.width === width &&
                shot.surface === surface &&
                shot.state === state,
            ).length,
            1,
            `${direction}/${width}/${surface}/${state}`,
          );
        }
}
if (check) {
  const evidence = JSON.parse(await readFile(path.join(output, "evidence.json"), "utf8"));
  assert.equal(evidence.kind, "independent-html-directions-not-vue-not-production");
  assert.equal(evidence.approval, "pending-user-review");
  assert.deepEqual(evidence.inputs, inputs);
  assert.deepEqual(evidence.fixtures, fixtures);
  checkCoverage(evidence.screenshots);
  for (const shot of evidence.screenshots) {
    assert.match(
      shot.file,
      /^(focus|brief)-(1440|390)-(rules|roles|status|controls)-[a-z-]+\.png$/,
    );
    assert.equal(shot.sha256, hash(await readFile(path.join(output, shot.file))));
    assert.equal(shot.horizontalOverflow, false);
    assert.ok(shot.metrics.minControlFont >= 16);
    assert.ok(shot.metrics.minTextFont >= 13);
    assert.deepEqual(shot.metrics.violations, []);
  }
  assert.equal(evidence.cases.length, 4);
  assert.ok(
    evidence.cases.every(
      (item) =>
        item.externalRequests === 0 &&
        item.consoleErrors === 0 &&
        item.validation === "passed" &&
        item.focus === "passed",
    ),
  );
  console.log("ui_phase2_representative_directions_verified screenshots=76");
  process.exit(0);
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const screenshots = [];
const cases = [];
try {
  for (const direction of ["focus", "brief"])
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      const network = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route(/^https?:/, (route) => {
        network.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "representative-directions.html")).href);
      await page.locator("#direction").selectOption(direction);
      async function capture(surface, state) {
        await page.evaluate(() => document.fonts.ready);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${direction}/${viewport.width}/${surface}/${state}: overflow`,
        );
        const modal = await page.locator("dialog[open]").count();
        if (!modal) await page.evaluate(() => window.scrollTo(0, 0));
        const file = `${direction}-${viewport.width}-${surface}-${state}.png`;
        const metrics = await checkPrototypeMetrics(page);
        await page.screenshot({
          path: path.join(output, file),
          fullPage: !modal,
          animations: "disabled",
        });
        screenshots.push({
          metrics,
          direction,
          viewport,
          surface,
          state,
          file,
          sha256: hash(await readFile(path.join(output, file))),
          horizontalOverflow: false,
          fullPage: !modal,
          visibleFields: modal
            ? await page.locator("#modal").evaluate((node) => {
                const bottom = node.querySelector(".modal-foot").getBoundingClientRect().top;
                const top = node.getBoundingClientRect().top;
                return Array.from(node.querySelectorAll("input,select,textarea"))
                  .filter((field) => {
                    const rect = field.getBoundingClientRect();
                    return rect.top >= top && rect.bottom <= bottom;
                  })
                  .map((field) => field.getAttribute("aria-label") || field.getAttribute("name"));
              })
            : [],
          capturedAt: new Date().toISOString(),
        });
      }
      async function open(kind, surface, state = kind) {
        const trigger = page.locator(`[data-action="${kind}"]`).filter({ visible: true }).first();
        await trigger.click();
        assert.equal(await page.locator("#modal").evaluate((node) => node.open), true);
        assert.ok(
          await page.locator("#modal").evaluate((node) => node.contains(document.activeElement)),
        );
        await capture(surface, state);
      }
      async function close() {
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#modal").evaluate((node) => node.open), false);
        assert.ok(
          await page.evaluate(() => document.activeElement?.matches("button[data-action]")),
        );
      }
      await capture("rules", "overview");
      await page.locator('[data-pick="1"]').click();
      await capture("rules", "detail");
      await open("create", "rules");
      await page.locator("#modal").evaluate((node) => {
        node.scrollTop = (node.scrollHeight - node.clientHeight) / 2;
      });
      await capture("rules", "create-middle");
      await page.locator("#modal").evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await capture("rules", "create-bottom");
      const ruleFields = new Set(
        screenshots
          .filter(
            (shot) =>
              shot.direction === direction &&
              shot.viewport.width === viewport.width &&
              shot.surface === "rules" &&
              shot.state.startsWith("create"),
          )
          .flatMap((shot) => shot.visibleFields),
      );
      for (const label of [
        "市场需求",
        "竞争",
        "利润",
        "履约效率",
        "客户体验",
        "场景与内容适配",
        "风险",
        "数据质量",
      ]) {
        for (const field of ["权重", "证据组", "必填"])
          assert.ok(ruleFields.has(label + field), `Uncaptured field: ${label}${field}`);
      }
      assert.equal(await page.locator('[name="recommend"]').inputValue(), "");
      assert.equal(await page.locator('[name="observe"]').inputValue(), "");
      await page.locator("#preview-submit").click();
      assert.match(await page.locator("#form-feedback").textContent(), /补齐/);
      await page.locator('[name="version_code"]').fill("design-demo");
      await page.locator('[name="name"]').fill("仅用于原型校验");
      await page.locator('[name="recommend"]').fill("75");
      await page.locator('[name="observe"]').fill("55");
      await page.locator('[name="weight-0"]').fill("40");
      await page.locator('[name="weight-1"]').fill("60");
      await page.locator('[name="required-0"]').check();
      await page.locator("#preview-submit").click();
      assert.match(await page.locator("#form-feedback").textContent(), /预览校验通过/);
      await close();
      await open("preview", "rules");
      assert.match(await page.locator("#modal-body").textContent(), /80.2/);
      await close();
      await open("submit", "rules");
      await page.locator('[name="reason"]').fill("仅用于原型审核，不提交业务数据");
      await page.locator("#preview-submit").click();
      assert.match(await page.locator("#form-feedback").textContent(), /没有发送请求/);
      await capture("rules", "submit-feedback");
      await page.locator("#preview-submit").focus();
      await page.keyboard.press("Tab");
      assert.ok(
        await page.locator("#modal").evaluate((node) => node.contains(document.activeElement)),
      );
      await close();
      await page.locator("#surface").selectOption("roles");
      await capture("roles", "overview");
      await page.locator('[data-pick="0"]').click();
      await capture("roles", "detail");
      assert.equal(await page.getByRole("table").count(), 1);
      await page.locator('[data-action="grants"]').last().click();
      await capture("roles", "grants");
      await open("grant", "roles");
      await page.locator("#modal").evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await capture("roles", "grant-bottom");
      await page.locator("#preview-submit").click();
      assert.match(await page.locator("#form-feedback").textContent(), /补齐/);
      await page.locator('[name="resource_id"]').fill("00000000-0000-4000-8000-000000000624");
      await page.locator('[name="member"]').selectOption("00000000-0000-4000-8000-000000000612");
      await page.getByLabel("查看机会", { exact: true }).check();
      await page.locator('[name="reason"]').fill("仅用于原型校验");
      const expiry = new Date(Date.now() + 7 * 86400000);
      const local = new Date(expiry.getTime() - expiry.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      await page.locator('[name="expires_at"]').fill(local);
      await page.locator("#preview-submit").click();
      assert.match(await page.locator("#form-feedback").textContent(), /预览校验通过/);
      await close();
      await open("revoke", "roles");
      await close();
      await page.locator("#surface").selectOption("status");
      await capture("status", "overview");
      await page.locator('[data-pick="0"]').click();
      await capture("status", "detail");
      await page.locator('[data-action="refresh-fail"]').click();
      assert.match(await page.getByRole("alert").textContent(), /保留/);
      await capture("status", "refresh-failed");
      await page.locator('[data-action="recover"]').click();
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.match(await page.locator(".service-grid").textContent(), /警告/);
      await capture("status", "refresh-recovered");
      await page.goto(pathToFileURL(path.join(root, "button-states.html")).href);
      await page.locator("#direction").selectOption(direction);
      assert.equal(await page.locator(".state-sample").count(), 24);
      assert.equal(await page.locator(".study-busy:disabled").count(), 4);
      await capture("controls", "six-states");
      assert.deepEqual(errors, []);
      assert.deepEqual(network, []);
      cases.push({
        direction,
        viewport,
        validation: "passed",
        focus: "passed",
        externalRequests: network.length,
        consoleErrors: errors.length,
      });
      await context.close();
    }
} finally {
  await browser.close();
}
checkCoverage(screenshots);
const evidence = {
  schemaVersion: 1,
  kind: "independent-html-directions-not-vue-not-production",
  approval: "pending-user-review",
  inputs,
  fixtures,
  cases,
  screenshots,
  limitations: [
    "Explicit fixture subset only; not all roles/actions/states.",
    "Local HTML interactions do not prove Vue, backend, database, authorization, or production.",
    "Button board hover/focus/pressed states are visual studies, not per-business-action coverage.",
  ],
};
await writeFile(path.join(output, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
await writeFile(
  path.join(output, "evidence-data.js"),
  `window.SCOUTOPS_DESIGN_DIRECTIONS = ${JSON.stringify(evidence).replaceAll("<", "\\u003c")};\n`,
);
console.log("ui_phase2_representative_directions_captured screenshots=76 variants=4 network=0");
