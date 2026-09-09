import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { verifyIdentitySource } from "./verify-ui-phase2-identity-source.mjs";

const root = "design-plans/ui-phase-2-2026-09-07/design/identity-direction-c";
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sources = ["LocalIdentity", "LandingRedirect", "TenancyChooser", "OnboardingGuide"].map(
  (s) => `apps/web/src/components/${s}.vue`,
);
sources.push(
  "apps/web/src/router.ts",
  "apps/web/src/App.vue",
  "apps/web/src/navigation-memory.ts",
  "config/route-catalog.json",
  "design-plans/ui-phase-2-2026-09-07/DIRECTION-DECISION-C.md",
  "design-plans/ui-phase-2-2026-09-07/identity-onboarding-contract-review.md",
  "scripts/verify-ui-phase2-identity-source.mjs",
  "scripts/verify-ui-phase2-identity-c.mjs",
  ...["index.html", "app.js", "style.css", "casebook.js"].map((f) => `${root}/${f}`),
);
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
const sourceProof = await verifyIdentitySource();
let old;
if (!capture) {
  old = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  assert.deepEqual(old.sourceHashes, sourceHashes);
  for (const s of old.screenshots)
    assert.equal(hash(await readFile(`${root}/${s.file}`)), s.sha256, s.file);
}
const browser = await chromium.launch({ headless: true });
const errors = [],
  http = [],
  screenshots = [],
  checks = [],
  actionIds = new Set();
let scenes;
async function layout(page, label) {
  const violations = await page.evaluate(() => {
    const visible = (el) =>
      el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
    const nodes = [
      ...document.querySelectorAll("#app button,#app input,#app a,#app summary"),
    ].filter(visible);
    return nodes
      .map((el) => ({
        name: el.id || el.textContent.trim().slice(0, 30),
        r: el.getBoundingClientRect().toJSON(),
        font: parseFloat(getComputedStyle(el).fontSize),
      }))
      .filter(
        (v) =>
          v.r.width < 43.9 || v.r.height < 43.9 || v.font < (v.name === "查看关联信息" ? 13 : 16),
      );
  });
  assert.deepEqual(violations, [], label);
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " horizontal overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((el) => el.id));
  assert.equal(ids.length, new Set(ids).size, label + " duplicate ID");
  assert.equal(await page.locator("dialog").count(), 0);
}
async function captureImage(page, width, s, suffix = "") {
  const file = `${width}-${s.id}${suffix}.png`;
  if (capture) {
    await page.screenshot({ path: `${root}/${file}`, fullPage: true, animations: "disabled" });
    screenshots.push({
      file,
      pageId: s.pageId,
      scene: s.id + suffix,
      width,
      sha256: hash(await readFile(`${root}/${file}`)),
    });
  } else
    assert.ok(
      old.screenshots.some((r) => r.file === file),
      file + " absent from manifest",
    );
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      await context.route(/^https?:/, (route) => {
        http.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(root, "index.html")).href);
      await page.evaluate(() => document.body.classList.add("capture"));
      scenes = await page.evaluate(() => window.identityReview.scenes);
      assert.equal(new Set(scenes.map((s) => s.id)).size, scenes.length);
      assert.equal(new Set(scenes.map((s) => s.pageId)).size, 9);
      const scene = async (id) => {
        await page.evaluate((v) => window.identityReview.render(v), id);
        await layout(page, `${width}:${id}`);
      };
      for (const s of scenes) {
        await scene(s.id);
        for (const id of await page
          .locator("[data-action]")
          .evaluateAll((nodes) => nodes.map((el) => el.dataset.action)))
          actionIds.add(id);
        for (const id of await page
          .locator("[data-submit]")
          .evaluateAll((nodes) => nodes.map((el) => el.dataset.submit)))
          actionIds.add(id);
        await captureImage(page, width, s);
      }
      // Real DOM validation and local transitions, never real identity operations.
      await scene("p03-idle");
      await page.getByRole("button", { name: "创建账号", exact: true }).click();
      assert.equal(await page.locator("#email").getAttribute("aria-invalid"), "true");
      await page.locator("#email").fill("synthetic@example.invalid");
      await page.locator("#password").fill("synthetic-only-password");
      await page.locator("#confirmPassword").fill("other-synthetic-password");
      await page.getByRole("button", { name: "创建账号", exact: true }).click();
      assert.match(await page.locator("#local-error").innerText(), /不一致/);
      await page.locator("#confirmPassword").fill("synthetic-only-password");
      await page.getByRole("button", { name: "创建账号", exact: true }).click();
      await page.waitForFunction(() => window.identityReview.current() === "p03-queued");
      assert.equal(
        await page.locator("#page-title").evaluate((el) => el === document.activeElement),
        true,
      );
      checks.push(`${width}: registration empty/mismatch and inline queued result, focus transfer`);
      const forms = [
        [
          "p02-idle",
          { identifier: "synthetic-user", password: "synthetic-only-password" },
          "p02-routing",
        ],
        ["p04-idle", { email: "synthetic@example.invalid" }, "p04-accepted"],
        ["p06-idle", { password: "synthetic-only-password" }, "p06-success"],
        ["p02-challenge", { code: "DEMO-RECOVERY-ONLY" }, "p02-routing"],
        [
          "p02-seed",
          { currentPassword: "synthetic-only-password", newPassword: "new-synthetic-password" },
          "p02-seed-relogin",
        ],
        ["p07-enroll", { currentPassword: "synthetic-only-password" }, "p07-secret"],
        [
          "p07-secret",
          { currentPassword: "synthetic-only-password", code: "000000" },
          "p07-recovery",
        ],
        [
          "p07-enabled",
          { currentPassword: "synthetic-only-password", code: "DEMO-RECOVERY-ONLY" },
          "p07-disabled",
        ],
      ];
      for (const [id, fields, target] of forms) {
        await scene(id);
        await page.evaluate(() => window.identityReview.reset());
        for (const [name, value] of Object.entries(fields))
          await page.locator(`#${name}`).fill(value);
        await page.locator("form button[type=submit]").focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction((v) => window.identityReview.current() === v, target);
        assert.equal((await page.evaluate(() => window.identityReview.events())).length, 1);
        assert.equal(
          await page
            .locator("input[type=password]")
            .evaluateAll((inputs) => inputs.every((el) => el.value === "")),
          true,
        );
      }
      checks.push(
        `${width}: eight local form transitions via keyboard; synthetic materials only, no field values in event log`,
      );
      await scene("p08-organizations");
      await page.locator("#organization-search").fill("NOTFOUND");
      await page.getByRole("button", { name: "清除搜索" }).click();
      assert.equal(await page.locator("#organization-search").inputValue(), "");
      await page.locator('[data-action="ID-ORG-CHOOSE"]').first().click();
      assert.equal(await page.getByRole("button", { name: /历史归档/ }).isDisabled(), true);
      await page.getByRole("button", { name: /新品研究工作区/ }).click();
      await page.waitForFunction(() => window.identityReview.current() === "p08-selected");
      await page.getByRole("link", { name: "继续快速引导" }).click();
      assert.equal(
        (await page.evaluate(() => window.identityReview.events())).at(-1).route,
        "/onboarding",
      );
      await scene("p08-empty");
      await page.getByRole("button", { name: "创建并进入选品空间" }).click();
      await page.waitForFunction(() => window.identityReview.events().at(-1)?.route === "/home");
      checks.push(
        `${width}: search/clear, organization/workspace, archived disabled, explicit continue vs personal auto-home`,
      );
      await scene("p09-step-1");
      await page.getByRole("button", { name: "下一步", exact: true }).click();
      await page.getByRole("button", { name: "下一步", exact: true }).click();
      await page.getByRole("link", { name: "进入智能选品 →" }).click();
      assert.equal((await page.evaluate(() => window.identityReview.events())).at(-1).route, "/");
      await page.getByRole("button", { name: "上一步" }).click();
      assert.equal(
        await page.getByRole("button", { name: "第 2 步" }).getAttribute("aria-current"),
        "step",
      );
      checks.push(`${width}: guide navigation/aria-current/root exit`);
      for (const [id, selector, route] of [
        ["p02-success-no-route", '[data-action="ID-CONTEXT-ROUTE"]', "/select-context"],
        ["p02-idle", '[data-action="ID-MFA-ROUTE"]', "/security/mfa"],
        ["p02-idle", '[data-action="ID-ACCOUNT-SECURITY"]', "/me?section=security"],
        ["p08-empty", '[data-action="ID-ACCOUNT-ROUTE"]', "/me"],
        ["p08-expired", '[data-action="ID-LOGIN-ROUTE"]', "/login"],
        ["p08-return", '[data-action="ID-CONTEXT-CONTINUE"]', "/tasks"],
        ["p09-step-1", '[data-action="ID-GUIDE-SKIP"]', "/"],
      ]) {
        await scene(id);
        await page.locator(selector).click();
        assert.equal(
          (await page.evaluate(() => window.identityReview.events())).at(-1).route,
          route,
        );
      }
      await scene("p08-organizations");
      await page.locator('[data-action="ID-ORG-CHOOSE"]').nth(1).click();
      assert.match(await page.locator(".content").innerText(), /国际商品研究/);
      await page.getByRole("button", { name: /新品研究工作区/ }).click();
      await page.waitForFunction(() => window.identityReview.current() === "p08-selected");
      assert.match(await page.locator(".content").innerText(), /国际商品研究/);
      checks.push(
        `${width}: seven auxiliary route targets and chosen organization name remain consistent`,
      );
      for (const [id, selector] of [
        ["p02-idle", "form button[type=submit]"],
        ["p07-enabled", ".danger button"],
        ["p08-organizations", ".choice"],
        ["p09-step-1", ".step-nav button"],
      ]) {
        await scene(id);
        const button = page.locator(selector).first();
        await button.hover();
        await captureImage(
          page,
          width,
          scenes.find((s) => s.id === id),
          "-hover",
        );
        await button.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        assert.notEqual(await button.evaluate((el) => getComputedStyle(el).outlineStyle), "none");
        await captureImage(
          page,
          width,
          scenes.find((s) => s.id === id),
          "-focus",
        );
        const box = await button.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await captureImage(
          page,
          width,
          scenes.find((s) => s.id === id),
          "-pressed",
        );
        await page.mouse.move(1, 1);
        await page.mouse.up();
      }
      for (const testWidth of [360, 768, 1024, 1920]) {
        await page.setViewportSize({ width: testWidth, height: 1000 });
        for (const id of [
          "p02-idle",
          "p03-mismatch",
          "p07-recovery",
          "p08-workspaces",
          "p09-step-3",
        ])
          await scene(id);
      }
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      for (const id of ["p02-idle", "p07-recovery", "p08-organizations", "p09-step-3"])
        await scene(id);
      await page.evaluate(() => (document.documentElement.style.zoom = ""));
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push(
        `${width}: four control families hover/focus/pressed screenshots; six widths, 200% zoom, 16px controls/44px touch, no dialogs, no cookie/storage writes`,
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(http, []);
  if (capture) {
    await writeFile(
      `${root}/evidence.json`,
      JSON.stringify(
        {
          proposal: "IDENTITY-C-r1",
          approval: "pending-user-review",
          kind: "page-proposal",
          sourceHashes,
          sourceProof,
          checks,
          actionIds: [...actionIds].sort(),
          scenes: scenes.length,
          screenshots,
          httpRequests: http.length,
          errors,
        },
        null,
        2,
      ) + "\n",
    );
    const gallery =
      `共${scenes.length}场景，${screenshots.length}张正式PNG（含四类控件的悬停、焦点、按下态）。\n\n| 页面/状态 | 桌面 | 手机 |\n| --- | --- | --- |\n` +
      scenes
        .map(
          (s) =>
            `| ${s.pageId} ${s.label} | [1440](${1440}-${s.id}.png) | [390](${390}-${s.id}.png) |`,
        )
        .join("\n") +
      "\n\n控件细节：\n\n" +
      screenshots
        .filter((s) => /-(hover|focus|pressed)\.png$/.test(s.file))
        .map((s) => `- [${s.file}](${s.file})`)
        .join("\n");
    await writeFile(
      `${root}/README.md`,
      (await readFile(`${root}/README.md`, "utf8")).replace(
        /<!-- GALLERY:START -->[\s\S]*?<!-- GALLERY:END -->/,
        `<!-- GALLERY:START -->\n${gallery}\n<!-- GALLERY:END -->`,
      ),
    );
  }
  const evidence = capture ? screenshots : old.screenshots;
  assert.deepEqual(
    (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
    evidence.map((s) => s.file).sort(),
  );
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      scenes: scenes.length,
      screenshots: evidence.length,
      sourceGroups: sourceProof.count,
      actionIds: actionIds.size,
      errors,
      http: http.length,
      checks,
    }),
  );
} finally {
  await browser.close();
}
