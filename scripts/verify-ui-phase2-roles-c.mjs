import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/roles-direction-c";
const root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const sources = ["index.html", "data.js", "roles.js", "roles.css"]
  .map((file) => `${relative}/${file}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/components/OrganizationRolePanel.vue",
    "apps/web/src/components/AuditedReasonDialog.vue",
    "apps/web/src/use-audited-reason.ts",
    "tests/e2e/m06-01-organization-admin.spec.ts",
    "scripts/verify-ui-phase2-roles-c.mjs",
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
const scenes = [
  "roles",
  "role-auditor",
  "role-technical",
  "role-query-empty",
  "roles-empty",
  "matrix-empty",
  "scopes",
  "scopes-empty",
  "grants",
  "grant-technical",
  "grants-filter-empty",
  "grants-search-empty",
  "grants-none",
  "roles-no-grants",
  "grants-readonly",
  "create-task",
  "create-opportunity",
  "create-competitor",
  "create-sourcing",
  "create-invalid-expiry",
  "create-busy",
  "extend-busy",
  "revoke",
  "revoke-invalid",
];
const actions = {
  task: ["task:read", "task:update"],
  opportunity: ["opportunity:read", "opportunity:decide"],
  competitor: ["competitor:read"],
  sourcing: ["sourcing:read", "supplier_quote:manage", "cost:confirm"],
};
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
      const original = await page.evaluate(() => JSON.stringify(window.SCOUTOPS_ROLE_DESIGN));
      for (const scene of scenes) {
        await page.locator("#scene").selectOption(scene);
        const modal = scene.startsWith("revoke");
        assert.equal(await page.locator("#revoke-dialog").evaluate((node) => node.open), modal);
        if (["roles", "roles-no-grants"].includes(scene)) {
          assert.equal(await page.locator("#role-list button").count(), 2);
          assert.equal(await page.locator("#matrix tbody tr").count(), 3);
          assert.equal(await page.locator("#matrix input").count(), 0);
          if (width === 390)
            assert.equal(
              await page.locator(".matrix-scroll").evaluate((node) => {
                node.scrollLeft = 80;
                const result = node.scrollLeft > 0;
                node.scrollLeft = 0;
                return result;
              }),
              true,
            );
        }
        if (scene === "roles-empty")
          assert.equal(await page.locator("#matrix-section").isVisible(), false);
        if (scene === "role-query-empty") {
          assert.equal(await page.locator("#role-detail").isVisible(), false);
          assert.equal(await page.locator("#matrix tbody tr").count(), 3);
        }
        if (scene === "role-auditor")
          assert.match(await page.locator("#role-detail").textContent(), /审计员.*查看组织审计/);
        if (scene === "matrix-empty")
          assert.equal(await page.locator("#matrix-empty").isVisible(), true);
        if (scene === "scopes") {
          assert.deepEqual(await page.locator("#scope-definitions b").allTextContents(), [
            "0 名成员",
            "0 名成员",
            "1 名成员",
            "2 名成员",
          ]);
          assert.equal(await page.locator(".member-row").count(), 3);
        }
        if (scene === "scopes-empty") assert.equal(await page.locator(".member-row").count(), 0);
        if (scene === "grants-none")
          assert.match(await page.locator("#grant-list").textContent(), /RBAC与数据范围继续生效/);
        if (scene === "grants-filter-empty") {
          assert.match(await page.locator("#grant-list").textContent(), /当前状态没有资源授权/);
          assert.equal(await page.locator("#pagination").isVisible(), false);
        }
        if (scene === "grants-search-empty") {
          assert.match(await page.locator("#grant-list").textContent(), /这里只搜索当前页/);
          assert.equal(await page.locator("#pagination").isVisible(), true);
        }
        if (scene === "grants-readonly") {
          for (const id of ["toggle-create", "extend-form"])
            assert.equal(await page.locator(`#${id}`).isVisible(), false);
          assert.equal(await page.locator("#grant-detail").isVisible(), true);
        }
        if (scene.startsWith("create-")) {
          assert.equal(await page.locator("#create-form").isVisible(), true);
          assert.equal(
            await page.getByRole("dialog").count(),
            0,
            "Create stays inline, never a dialog",
          );
          const type = actions[scene.slice(7)] ? scene.slice(7) : "opportunity";
          assert.deepEqual(
            await page
              .locator("#grant-actions input")
              .evaluateAll((nodes) => nodes.map((node) => node.value)),
            actions[type],
          );
          assert.deepEqual(
            await page
              .locator("#grant-actions input:checked")
              .evaluateAll((nodes) => nodes.map((node) => node.value)),
            [actions[type][0]],
          );
          assert.equal(await page.locator("#member-target option").count(), 2);
          assert.equal(
            await page.locator("#member-target option").last().getAttribute("value"),
            "00000000-0000-4000-8000-000000000612",
          );
          assert.equal(await page.locator("#create-reason").getAttribute("maxlength"), "500");
          assert.equal(await page.locator("#create-submit").isDisabled(), scene === "create-busy");
          if (scene === "create-invalid-expiry")
            assert.equal(
              await page.locator("#expires-at").evaluate((node) => node.validity.rangeOverflow),
              true,
            );
        }
        if (scene === "extend-busy") {
          assert.equal(await page.locator("#extend-submit").isDisabled(), true);
          assert.equal(await page.locator("#revoke").isDisabled(), true);
        }
        if (["create-busy", "extend-busy"].includes(scene)) {
          assert.equal(await page.locator("#grant-statuses button:disabled").count(), 4);
          assert.equal(await page.locator("#extend-submit").isDisabled(), true);
          assert.equal(await page.locator("#revoke").isDisabled(), true);
        }
        if (modal) {
          const bounds = await page.locator("#revoke-dialog").boundingBox();
          assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
          assert.equal(await page.locator("#revoke-reason").getAttribute("maxlength"), null);
          assert.equal(await page.locator("#revoke-reason").getAttribute("minlength"), "2");
          assert.equal(
            await page.locator("#revoke-reason").inputValue(),
            scene === "revoke" ? "撤销指定资源授权" : "无",
          );
          assert.equal(
            await page.locator("#confirm-revoke").isDisabled(),
            scene === "revoke-invalid",
          );
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
            fullPage: !modal,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene,
            viewport,
            fullPage: !modal,
            sha256: hash(await readFile(path.join(root, file))),
            metrics,
          });
        }
        if (modal) {
          await page.locator("#close-revoke").focus();
          await page.keyboard.press("Shift+Tab");
          assert.equal(
            await page.evaluate(() => document.activeElement.id),
            scene === "revoke-invalid" ? "cancel-revoke" : "confirm-revoke",
          );
          await page.keyboard.press("Tab");
          assert.equal(await page.evaluate(() => document.activeElement.id), "close-revoke");
          await page.keyboard.press("Escape");
          assert.equal(await page.evaluate(() => document.activeElement.id), "scene");
        }
        if (scene === "create-busy") {
          await page.locator("#resource-type").selectOption("sourcing");
          await page.locator("#grant-actions input").last().check();
          assert.equal(
            await page.locator("#create-submit").isDisabled(),
            true,
            "Changing type or actions cannot clear busy state",
          );
        }
      }
      await page.locator("#scene").selectOption("roles");
      await page.locator("#role-query").fill("审计");
      assert.equal(await page.locator("#role-list button").count(), 1);
      assert.match(await page.locator("#role-detail").textContent(), /审计员/);
      await page.locator("#role-query").fill("");
      await page.locator("#capability-group").selectOption("安全审计");
      assert.equal(await page.locator("#matrix tbody tr").count(), 1);
      await page.locator("#reset-capabilities").click();
      assert.equal(await page.locator("#matrix tbody tr").count(), 3);
      await page.locator("[data-section='scopes']").click();
      await page.locator("#member-query").fill("陈采购");
      await page.locator("#scope-filter").selectOption("workspace");
      assert.equal(await page.locator(".member-row").count(), 1);
      await page.locator("#reset-scopes").click();
      assert.equal(await page.locator(".member-row").count(), 3);
      await page.locator("[data-section='grants']").click();
      await page.locator("[data-status='revoked']").click();
      await page.locator("#all-grants").click();
      assert.equal(await page.locator("#grant-detail").isVisible(), true);
      await page.locator("#toggle-create").click();
      await page.locator("#resource-id").fill("1234");
      await page.locator("#create-submit").click();
      assert.equal(
        await page.locator("#resource-id").evaluate((node) => node.validity.patternMismatch),
        true,
      );
      await page.locator("#resource-id").fill("00000000-0000-4000-8000-000000000624");
      await page.locator("#member-target").selectOption("00000000-0000-4000-8000-000000000612");
      await page.locator("#create-reason").fill("临时协作核价");
      await page.locator("#grant-actions input").first().uncheck();
      assert.equal(await page.locator("#create-submit").isDisabled(), true);
      await page.locator("#resource-type").selectOption("sourcing");
      assert.deepEqual(
        await page
          .locator("#grant-actions input:checked")
          .evaluateAll((nodes) => nodes.map((node) => node.value)),
        ["sourcing:read"],
      );
      await page.locator("#resource-type").selectOption("opportunity");
      await page.locator("#expires-at").fill("2026-09-28T18:00");
      await page.locator("#create-submit").click();
      assert.equal(
        await page.locator("#expires-at").evaluate((node) => node.validity.rangeOverflow),
        true,
      );
      await page.locator("#expires-at").fill("2026-08-28T18:00");
      await page.locator("#create-submit").click();
      assert.equal(
        await page.locator("#expires-at").evaluate((node) => node.validity.rangeUnderflow),
        true,
      );
      await page.locator("#expires-at").fill("2026-09-04T18:00");
      await page.locator("#toggle-create").click();
      await page.locator("#toggle-create").click();
      assert.equal(await page.locator("#create-reason").inputValue(), "临时协作核价");
      await page.locator("#create-submit").click();
      assert.match(await page.locator("#review-note").textContent(), /未请求API/);
      await page.locator("#extend-reason").fill("延长核价窗口");
      await page.locator("#extend-submit").click();
      assert.match(await page.locator("#review-note").textContent(), /延长授权输入演示/);
      await page.locator("#revoke").click();
      await page.locator("#revoke-reason").fill("  ");
      assert.equal(await page.locator("#confirm-revoke").isDisabled(), true);
      await page.locator("#revoke-reason").fill("协作已经结束");
      await page.locator("#confirm-revoke").click();
      assert.equal(await page.evaluate(() => document.activeElement.id), "revoke");
      assert.equal(
        await page.evaluate(() => JSON.stringify(window.SCOUTOPS_ROLE_DESIGN)),
        original,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
      console.log(
        `roles_c width=${width} scenes=${scenes.length} filters/matrix/scopes/4allowlists/expiry/reason/focus=passed HTTP=0 errors=0`,
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
        version: "ROLE-C-r1",
        kind: "formal-design-proposal-not-vue-not-production",
        pageId: "P31",
        approval: "pending-user-review",
        reviewClock: "2026-08-28T10:00:00.000Z",
        capturedAt: new Date().toISOString(),
        browser: browser.version(),
        sourceHashes,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
