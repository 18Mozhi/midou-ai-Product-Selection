import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildAccountOverviewDesignData } from "./lib/ui-phase2-account-overview-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/account-overview-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildAccountOverviewDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.ACCOUNT_OVERVIEW_C_DATA)), data);
const sources = [
  ...["index.html", "accounts.js", "accounts.css", "data.js"].map((f) => relative + "/" + f),
  "scripts/lib/ui-phase2-account-overview-design-data.mjs",
  "scripts/verify-ui-phase2-account-overview-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  ...[
    "PlatformAccountCenter.vue",
    "PlatformAccountDialogs.vue",
    "PlatformOrganizationRecords.vue",
    "ResponsiveDataView.vue",
    "ResponsiveFilterDrawer.vue",
    "TableViewControls.vue",
  ].map((f) => "apps/web/src/components/" + f),
  "apps/web/src/use-modal-dialog.ts",
  ...[
    "platform-account-service.ts",
    "platform-account-routes.ts",
    "mysql-platform-account-repository.ts",
  ].map((f) => "apps/api/src/" + f),
  "tests/e2e/m06-01-platform-accounts.spec.ts",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [
      f,
      hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  checks = [];
async function metrics(page) {
  await checkPrototypeMetrics(page);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "Page overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    await page
      .locator("input,select")
      .evaluateAll((ns) => ns.every((n) => document.querySelector('label[for="' + n.id + '"]'))),
    true,
  );
}
async function shot(page, width, name, selector) {
  const file = width + "-" + name + ".png";
  expected.push(file);
  if (capture) {
    const bytes = selector
      ? await page
          .locator(selector)
          .screenshot({ path: path.join(root, file), animations: "disabled" })
      : await page.screenshot({
          path: path.join(root, file),
          fullPage: !(await page.locator("dialog[open]").count()),
          animations: "disabled",
        });
    screenshots.push({ file, width, scene: name, sha256: hash(bytes) });
  }
}
try {
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
        http = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      page.on("request", (r) => {
        if (/^https?:/.test(r.url())) http.push(r.url());
      });
      await page.route(/^https?:/, (r) => r.abort());
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      const scene = (n) => page.evaluate((v) => window.ACCOUNT_OVERVIEW_C.scene(v), n),
        state = () => page.evaluate(() => window.ACCOUNT_OVERVIEW_C.state()),
        filter = async () => {
          if (width === 390) await page.locator("#filter-trigger").click();
        };
      const names = await page.evaluate(() => Object.keys(window.ACCOUNT_OVERVIEW_C.scenes));
      assert.equal(names.length, 40);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        if (name === "normal" && width === 390) {
          assert.equal(
            await page
              .locator(".record strong")
              .first()
              .evaluate((n) => n.getBoundingClientRect().bottom <= innerHeight),
            true,
            "First organization title remains in mobile viewport",
          );
        }
        if (["loading", "error", "timeout"].includes(name))
          assert.equal(await page.locator(".counts,#organizations,.record").count(), 0);
        if (["hover", "pressed"].includes(name)) {
          await page.locator("#refresh").hover();
          if (name === "pressed") await page.mouse.down();
        }
        if (name === "focus") await page.locator("#refresh").focus();
        await shot(page, width, name);
        if (name === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
      }
      for (const name of ["create_member", "create_error", "create_super"]) {
        await scene(name);
        await shot(page, width, name + "-detail", "dialog");
      }
      await scene("normal");
      assert.deepEqual(await page.locator(".counts").allTextContents(), [
        "2 / 3正常 / 全部",
        "16 / 18可登录 / 全部",
        "2拥有平台后台权限",
      ]);
      assert.equal((await state()).data.organizations.length, 1);
      for (const route of ["organizations", "users", "admins"]) {
        await page.locator('[data-nav="/platform-admin/' + route + '"]').click();
        assert.equal((await state()).navigation.at(-1), "/platform-admin/" + route);
      }
      await page.locator("#create-org").click();
      assert.equal((await state()).navigation.at(-1), data.sourcePaths.create);
      assert.equal((await state()).intents.length, 0);
      if (width === 390) {
        await page.locator(".record").first().click();
        await page.locator("#open-detail").click();
      } else await page.locator("[data-detail]").first().click();
      assert.equal((await state()).navigation.at(-1), data.sourcePaths.detail);
      await scene("many");
      await filter();
      await page.locator("#query").fill("合成组织 2");
      await page.locator("#search").click();
      assert.equal((await state()).data.organizations.length, 1);
      assert.equal((await state()).data.summary.organizations, 12);
      assert.match((await state()).intents.at(-1).path, /query=/);
      if (width === 390) assert.equal(await page.locator("dialog[open]").count(), 0);
      await filter();
      await page.locator("#reset").click();
      assert.equal((await state()).data.organizations.length, 12);
      if (width === 390) {
        assert.equal(await page.locator("dialog[open]").count(), 1);
        await page.locator("#close-modal").click();
      }
      for (const status of ["active", "archived", "disabled"]) {
        await filter();
        await page.locator("#status").selectOption(status);
        await page.locator("#search").click();
        assert.equal(
          (await state()).data.organizations.length,
          { active: 9, archived: 3, disabled: 0 }[status],
        );
        assert.equal((await state()).data.summary.organizations, 12);
      }
      await page.locator("#clear-filter").click();
      assert.equal((await state()).data.organizations.length, 12);
      await scene("normal");
      await filter();
      await page.locator("#query").fill("buyer@example.test");
      await page.locator("#search").click();
      assert.equal((await state()).data.organizations.length, 0);
      assert.equal((await state()).data.users.length, 1);
      await scene("normal");
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.setReadMode("hold"));
      await filter();
      await page.locator("#query").fill("new-filter");
      await page.locator("#search").click();
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.read());
      assert.equal((await state()).intents.length, 1);
      assert.equal(await page.locator("#refresh").isDisabled(), true);
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.completeRead("error"));
      assert.equal((await state()).facts.query, "");
      assert.equal((await state()).query, "new-filter");
      assert.equal((await state()).data.organizations.length, 1);
      assert.match(await page.locator(".notice").innerText(), /旧事实/);
      await page.locator("#retry").click();
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.completeRead("success"));
      assert.equal((await state()).facts.query, "new-filter");
      assert.equal((await state()).data.organizations.length, 0);
      await scene("normal");
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.setReadMode("hold"));
      await page.locator("#refresh").click();
      const oldRead = (await state()).pending.id;
      await page.evaluate(() => {
        window.ACCOUNT_OVERVIEW_C.leave();
        window.ACCOUNT_OVERVIEW_C.activate();
      });
      assert.equal(
        await page.evaluate((id) => window.ACCOUNT_OVERVIEW_C.completeRead("success", id), oldRead),
        false,
      );
      await scene("create_user");
      await page.locator("#confirm-create").click();
      assert.equal((await state()).intents.length, 0);
      await page.locator("#email").fill("synthetic@example.test");
      await page.locator("#temporary_password").fill("short");
      await page.locator("#confirm-create").click();
      assert.equal((await state()).intents.length, 0);
      await page.locator("#temporary_password").fill("SyntheticOnly-12");
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.setWriteMode("hold"));
      await page.locator("#confirm-create").click();
      assert.deepEqual((await state()).intents[0].body, data.createBody);
      assert.equal(await page.locator("#confirm-create").isDisabled(), true);
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.create());
      assert.equal((await state()).intents.length, 1);
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.completeWrite("error"));
      assert.equal(await page.locator("#email").inputValue(), "synthetic@example.test");
      assert.match(await page.locator("#create-error").innerText(), /失败/);
      await page.locator("#confirm-create").click();
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.completeWrite("refresh_error"));
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.match(await page.locator(".notice.error").innerText(), /创建已成功/);
      for (const [name, role] of [
        ["create_operations", "platform_operations_admin"],
        ["create_security", "platform_security_admin"],
        ["create_super", "platform_super_admin"],
        ["create_member", null],
      ]) {
        await scene(name);
        await page.locator("#confirm-create").click();
        const body = (await state()).intents[0].body;
        assert.equal(body.platform_role_code, role);
        if (name === "create_member") {
          assert.equal(body.organization_id, data.overview.organizations[0].id);
          assert.equal(body.organization_role_code, "organization_admin");
        }
        assert.equal(Object.hasOwn(body, "reason"), false);
      }
      await scene("many");
      await page.locator("#create-user").click();
      assert.equal(await page.locator("#organization_id option:disabled").count(), 3);
      await page.locator("#organization_id").selectOption("synthetic-org-2");
      assert.equal(await page.locator("#organization_role_code").count(), 1);
      await page.locator("#organization_id").selectOption("");
      assert.equal(await page.locator("#organization_role_code").count(), 0);
      await page.locator("#temporary_password").fill("SyntheticOnly-12");
      await page.locator("#cancel-create").click();
      assert.equal((await state()).form.temporary_password, "SyntheticOnly-12");
      await page.locator("#create-user").click();
      assert.equal(await page.locator("#temporary_password").inputValue(), "");
      for (const lateResult of ["success", "error"]) {
        await scene("create_member");
        await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.setWriteMode("hold"));
        await page.locator("#confirm-create").click();
        const oldWrite = (await state()).write.id;
        await page.locator("#cancel-create").click();
        await page.locator("#create-user").click();
        await page.locator("#email").fill("new@example.test");
        await page.evaluate(
          ({ id, result }) => window.ACCOUNT_OVERVIEW_C.completeWrite(result, id),
          { id: oldWrite, result: lateResult },
        );
        assert.equal(await page.locator("dialog[open]").count(), 1);
        assert.equal(await page.locator("#email").inputValue(), "new@example.test");
        assert.equal(await page.locator("#confirm-create").isDisabled(), false);
        assert.equal((await state()).createError, "");
      }
      await scene("normal");
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.setReadMode("hold"));
      await page.locator("#refresh").click();
      await page.locator("#create-user").click();
      await page.locator("#email").fill("during-read@example.test");
      await page.evaluate(() => window.ACCOUNT_OVERVIEW_C.completeRead("success"));
      assert.equal(await page.locator("dialog[open]").count(), 1);
      assert.equal(await page.locator("#email").inputValue(), "during-read@example.test");
      for (const name of width === 390
        ? ["create_user", "create_member", "filter_open", "preview", "preview_technical"]
        : ["create_user", "create_member"]) {
        await scene(name);
        const dialog = page.locator("dialog[open]");
        assert.equal(await dialog.count(), 1);
        assert.equal(
          await page.locator("#close-modal").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(await page.evaluate(() => !!document.activeElement.closest("dialog")), true);
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#close-modal").evaluate((n) => n === document.activeElement),
          true,
        );
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press("Tab");
          assert.equal(await page.evaluate(() => !!document.activeElement.closest("dialog")), true);
        }
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement !== document.body), true);
      }
      await scene("create_user");
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("dialog[open]").count(), 1);
      await page.locator("#close-modal").click();
      if (width === 1440) {
        await scene("normal");
        await page.locator("#columns summary").click();
        for (const i of [0, 1, 2, 3]) await page.locator("#column-" + i).uncheck();
        assert.equal(await page.locator("#column-4").isDisabled(), true);
        assert.equal(await page.locator("th.frozen").innerText(), "操作");
        await page.locator("#freeze").click();
        assert.equal(await page.locator(".frozen").count(), 0);
        await page.locator("#density").selectOption("compact");
        assert.equal((await state()).density, "compact");
        assert.equal((await state()).intents.length, 0);
      } else {
        for (const name of ["filter_open", "preview"]) {
          await scene(name);
          await page.mouse.click(1, 1);
          assert.equal(await page.locator("dialog[open]").count(), 0);
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(http, []);
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      checks.push({
        width,
        scenes: names.length,
        interactions: "passed",
        httpRequests: 0,
        browserErrors: 0,
        storageEntries: 0,
        writeTransport: "synthetic memory only",
      });
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    for (const width of [759, 760, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of ["normal", "long", "create_member", "filter_open"]) {
        await page.evaluate((n) => window.ACCOUNT_OVERVIEW_C.scene(n), name);
        await metrics(page);
      }
    }
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual((await readdir(root)).filter((f) => f.endsWith(".png")).sort(), expected.sort());
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        proposal: "ACCOUNT-OVERVIEW-C-r1",
        sourceHashes,
        screenshots,
        checks,
        sourceChecks: data.sourceChecks,
        scope:
          "Standalone synthetic prototype. Not mounted Vue/API/MySQL/authorization/transaction/password hashing/MFA or production. P41/P42 destination designs not included. All contexts closed.",
      },
      null,
      2,
    ) + "\n",
  );
else assert.deepEqual(previous.screenshots.map((s) => s.file).sort(), expected);
console.log(
  JSON.stringify(
    {
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      sourceChecks: data.sourceChecks,
      temporaryProcesses: "All browser contexts closed",
    },
    null,
    2,
  ),
);
