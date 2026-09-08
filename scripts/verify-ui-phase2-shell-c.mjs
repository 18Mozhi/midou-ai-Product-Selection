import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildShellDesignData } from "./lib/ui-phase2-shell-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/shell-direction-c",
  root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const sources = ["index.html", "data.js", "shell.js", "shell.css"]
  .map((file) => `${relative}/${file}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/NavigationShell.vue",
    "apps/web/src/navigation-shell-permissions.ts",
    "apps/web/src/navigation-shell-route-state.ts",
    "apps/web/src/route-catalog.ts",
    "apps/web/src/navigation-memory.ts",
    "apps/web/src/use-navigation-discovery.ts",
    "apps/web/src/use-navigation-shell-theme.ts",
    "config/route-catalog.json",
    "tests/e2e/m02-03-navigation-shell.spec.ts",
    "tests/m02-03/navigation-shell.test.mjs",
    "scripts/lib/ui-phase2-shell-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-shell-c.mjs",
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
  Object.entries(texts).map(([file, value]) => [file, hash(value)]),
);
const sourceData = await buildShellDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(
  JSON.parse(JSON.stringify(sandbox.window.SCOUTOPS_SHELL_DESIGN)),
  sourceData,
  "Catalog/fixture/permission drift; review before regenerating",
);
const scenes = [
  "member",
  "organization",
  "platform",
  "security",
  "auditor",
  "member-platform",
  "member-menu",
  "platform-menu",
  "menu-query",
  "menu-group",
  "menu-empty",
  "context-open",
  "operations-secondary",
  "task-detail",
  "loading",
  "expired",
  "forbidden",
  "forbidden-technical",
  "context_required",
  "rate_limited",
  "blocked",
  "route-forbidden",
  "surface-missing",
  "recheck-busy",
  "recheck-recovered",
];
if (!capture) {
  const evidence = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(evidence.sourceHashes, sourceHashes);
  assert.deepEqual(
    evidence.screenshots.map((shot) => shot.file),
    [1440, 390].flatMap((width) => scenes.map((scene) => `${width}-${scene}.png`)),
  );
  for (const shot of evidence.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [],
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
      async function scene(value) {
        if (await page.locator("#nav-dialog").evaluate((node) => node.open))
          await page.locator("#close-menu").click();
        await page.locator("#scene").selectOption(value);
      }
      async function assertLayout() {
        const metrics = await checkPrototypeMetrics(page);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const violations = await page.evaluate(() => {
          const scope = document.querySelector("dialog[open]") || document.body;
          return [...scope.querySelectorAll("a,summary")]
            .filter((node) => node.getClientRects().length)
            .filter((node) => {
              const r = node.getBoundingClientRect();
              return (
                r.width < 43.9 ||
                r.height < 43.9 ||
                parseFloat(getComputedStyle(node).fontSize) < 16
              );
            })
            .map((node) => node.textContent);
        });
        assert.deepEqual(violations, []);
        return metrics;
      }
      for (const value of scenes) {
        await scene(value);
        const diagnostics = await page.evaluate(() => window.SHELL_DESIGN_DIAGNOSTICS());
        const profile = sourceData.profiles[diagnostics.profileKey];
        assert.deepEqual(
          await page
            .locator("#nav-groups [data-menu-route]")
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))),
          diagnostics.state === "ready"
            ? [...new Set(profile.items.map((item) => item.group))]
                .flatMap((group) => profile.items.filter((item) => item.group === group))
                .filter((item) =>
                  `${item.label} ${item.group}`
                    .toLocaleLowerCase()
                    .includes(diagnostics.query.toLocaleLowerCase()),
                )
                .map((item) => item.path)
            : [],
        );
        if (diagnostics.state !== "ready") {
          assert.equal(await page.locator("#ready-surface").isVisible(), false);
          assert.equal(await page.locator("#mobile-navigation").isVisible(), false);
          assert.equal(await page.locator("#shell-switches a").count(), 0);
        }
        if (profile.guard.shell !== "member") {
          assert.equal(await page.locator("#search-entry").isVisible(), false);
          assert.equal(await page.locator("#notifications-entry").isVisible(), false);
          assert.equal(await page.locator('[data-deferred="create"]').count(), 0);
        }
        if (value === "auditor") {
          assert.deepEqual(await page.locator("#nav-groups a").allTextContents(), ["组织审计"]);
          assert.equal(await page.locator("#quick-entry").textContent(), "");
        }
        if (value === "security") {
          assert.deepEqual(await page.locator("#nav-groups a").allTextContents(), ["安全与审计"]);
          assert.equal(await page.locator("#quick-entry").textContent(), "");
        }
        if (value === "organization") {
          assert.equal(
            await page.locator("#quick-entry a").getAttribute("href"),
            "/org-admin/members",
          );
          assert.equal(
            await page.locator("#shell-switches a").getAttribute("href"),
            "/trends?market=US&page=2",
          );
        }
        if (value === "platform") {
          assert.equal(
            await page.locator("#quick-entry a").getAttribute("href"),
            "/platform-admin/organizations/new",
          );
          const target = new URL(
            await page.locator("#shell-switches a").getAttribute("href"),
            "https://example.invalid",
          );
          assert.equal(target.pathname, "/select-context");
          assert.equal(target.searchParams.get("return_to"), "/opportunities?status=watching");
          assert.equal(target.searchParams.get("from"), "/platform-admin/status");
        }
        if (value === "member-platform")
          assert.equal(
            await page.locator("#shell-switches a").getAttribute("href"),
            "/platform-admin",
          );
        if (value === "menu-empty")
          assert.match(await page.locator("#menu-empty").textContent(), /没有匹配/);
        if (value === "menu-query")
          assert.deepEqual(await page.locator("#nav-groups a").allTextContents(), ["用户管理"]);
        if (value === "menu-group")
          assert.deepEqual(await page.locator("#nav-groups a").allTextContents(), ["系统运维"]);
        if (value === "context-open") {
          assert.equal(await page.locator("#scope-detail").evaluate((node) => node.open), true);
          assert.match(await page.locator("#scope-value").textContent(), /未命名组织 · 默认工作区/);
        }
        if (value === "operations-secondary") {
          assert.equal(await page.locator("#operations a").count(), 10);
          assert.equal(
            await page.locator('#operations [aria-current="page"]').getAttribute("href"),
            "/platform-admin/mysql",
          );
        }
        if (value === "task-detail") {
          assert.equal(await page.locator("#gate").isVisible(), false);
          assert.equal(await page.locator("#page-title").textContent(), "任务详情");
        }
        if (width === 390 && diagnostics.state === "ready") {
          assert.ok((await page.locator("#mobile-navigation > *").count()) <= 5);
          assert.equal(await page.locator("#mobile-navigation > button").count(), 1);
          if (["member", "task-detail", "operations-secondary", "platform"].includes(value)) {
            assert.equal(await page.locator("#more").getAttribute("aria-current"), "page");
            assert.equal(
              await page.locator('#mobile-navigation a[aria-current="page"]').count(),
              0,
            );
          }
        }
        const recovery = {
          expired: "/login",
          forbidden: "/home",
          context_required: "/select-context",
        };
        if (recovery[value])
          assert.equal(await page.locator("#gate-actions a").getAttribute("href"), recovery[value]);
        if (value === "forbidden-technical")
          assert.equal(await page.locator("#gate-technical").evaluate((node) => node.open), true);
        if (value === "route-forbidden") {
          assert.match(await page.locator("#gate-title").textContent(), /无权打开此页面/);
          assert.equal(
            await page.locator("#gate-actions a").last().getAttribute("href"),
            "/me?section=permissions",
          );
        }
        if (value === "surface-missing")
          assert.equal(await page.locator("#gate-title").textContent(), "页面不存在");
        const metrics = await assertLayout(),
          modal = await page.locator("#nav-dialog").evaluate((node) => node.open);
        if (capture) {
          const file = `${width}-${value}.png`;
          await page.screenshot({
            path: path.join(root, file),
            fullPage: !modal,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene: value,
            viewport,
            fullPage: !modal,
            surface: "shared-navigation-not-Pxx-business-page",
            approval: "pending",
            sha256: hash(await readFile(path.join(root, file))),
            metrics,
          });
        }
      }
      // Every authorized navigation item is reachable from a label/group search or disclosure.
      for (const [value, profileKey] of [
        ["member", "member"],
        ["organization", "organization_admin"],
        ["platform", "platform_admin"],
        ["security", "platform_security"],
        ["auditor", "organization_auditor"],
      ]) {
        for (const item of sourceData.profiles[profileKey].items) {
          await scene(value);
          if (width === 390) await page.locator("#more").click();
          await page.locator("#nav-groups details").evaluateAll((nodes) =>
            nodes.forEach((node) => {
              node.open = true;
            }),
          );
          await page.locator(`#nav-groups a[href="${item.path}"]`).click();
          assert.equal(
            (await page.evaluate(() => window.SHELL_DESIGN_DIAGNOSTICS())).fullPath,
            item.path,
          );
          assert.equal((await page.evaluate(() => window.SHELL_DESIGN_DIAGNOSTICS())).query, "");
          assert.equal(await page.locator("#nav-dialog").evaluate((node) => node.open), false);
        }
      }
      await scene("platform-menu");
      await page.locator("#nav-search").fill(" 用户 ");
      assert.equal(
        await page.locator("#nav-search").evaluate((node) => getComputedStyle(node).color),
        "rgb(32, 44, 61)",
      );
      assert.deepEqual(await page.locator("#nav-groups a").allTextContents(), ["用户管理"]);
      await page.locator("#nav-search").fill("");
      assert.equal(await page.locator("#nav-groups a").count(), 15);
      if (width === 390) {
        assert.equal(
          await page.locator("#close-menu").evaluate((node) => getComputedStyle(node).color),
          "rgb(32, 44, 61)",
        );
        await page.locator("#close-menu").focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page
            .locator("#shell-switches a")
            .evaluate((node) => node === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#close-menu").evaluate((node) => node === document.activeElement),
          true,
        );
        await page.keyboard.press("Escape");
        assert.equal(
          await page.locator("#open-menu").evaluate((node) => node === document.activeElement),
          true,
        );
        await page.locator("#more").click();
        await page.locator("#close-menu").click();
        assert.equal(
          await page.locator("#more").evaluate((node) => node === document.activeElement),
          true,
        );
        await page.locator("#more").click();
        await page.setViewportSize({ width: 1024, height: 1000 });
        assert.equal(await page.locator("#nav-dialog").evaluate((node) => node.open), false);
        assert.equal(await page.locator("#desktop-navigation #navigation-content").count(), 1);
        await page.setViewportSize(viewport);
      }
      await scene("blocked");
      await page.locator("#recheck").click();
      assert.equal(await page.locator("#nav-groups a").count(), 0);
      await page.waitForFunction(() => window.SHELL_DESIGN_DIAGNOSTICS().state === "ready");
      assert.equal(
        await page.locator("#nav-groups a").count(),
        sourceData.profiles.member.items.length,
      );
      await scene("blocked");
      await page.locator("#recheck").click();
      await scene("forbidden");
      await page.waitForTimeout(500);
      assert.equal(
        (await page.evaluate(() => window.SHELL_DESIGN_DIAGNOSTICS())).state,
        "forbidden",
      );
      await scene("member");
      if (width === 390) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        assert.equal(
          await page.evaluate(
            () =>
              document.querySelector("#review-note").getBoundingClientRect().bottom <=
              document.querySelector("#mobile-navigation").getBoundingClientRect().top,
          ),
          true,
          "Final content remains reachable above fixed navigation",
        );
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.locator("#search-entry").click();
      assert.match(await page.locator("#deferred-note").textContent(), /待独立C方向图稿/);
      await page.locator('[data-deferred="create"]').click();
      assert.match(await page.locator("#deferred-note").textContent(), /快捷创建/);
      await page.locator("#theme-entry").click();
      assert.match(await page.locator("#deferred-note").textContent(), /主题浮层/);
      await scene("member");
      await page.keyboard.press("Control+k");
      assert.equal(await page.locator("#deferred-note").isVisible(), true);
      await scene("platform");
      await page.keyboard.press("Control+k");
      assert.equal(await page.locator("#deferred-note").isVisible(), false);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(await page.evaluate(() => window.SCOUTOPS_SHELL_DESIGN), sourceData);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `shell_c width=${width} scenes=25 menus/guard/5profiles/return/keyboard/recheck passed HTTP=0 storage=0`,
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
    `${JSON.stringify({ version: "SHELL-C-nav-r1", kind: "formal-shared-navigation-proposal-not-vue-not-production", approval: "pending", capturedAt: new Date().toISOString(), boundary: "Navigation/guard batch only. Page slot is explanatory, not a Pxx screenshot. Theme and discovery are explicitly deferred. Fixture capability projection is not live RBAC. Local preview links do not navigate production or write storage.", sourceHashes, screenshots }, null, 2)}\n`,
  );
