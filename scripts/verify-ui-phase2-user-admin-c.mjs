import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildUserAdminDesignData } from "./lib/ui-phase2-user-admin-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/user-admin-direction-c",
  root = path.join(repo, relative);
const capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildUserAdminDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.USER_ADMIN_C_DATA)), data);
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-user-admin-design-data.mjs",
  "scripts/verify-ui-phase2-user-admin-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "design-plans/ui-phase-2-2026-09-07/design/platform-organizations-direction-c/organizations.css",
  ...["index.html", "accounts.css", "accounts.js", "data.js"].map((f) => relative + "/" + f),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [
      f,
      hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
let prior;
if (!capture) {
  prior = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(prior.sourceHashes, sourceHashes);
  for (const s of prior.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [],
  checks = [],
  errors = [],
  requests = [];
async function shot(page, width, scene, suffix = "") {
  const file = `${width}-${scene}${suffix}.png`;
  expected.push(file);
  if (capture) {
    const bytes = await page.screenshot({
      path: path.join(root, file),
      fullPage: !(await page.locator("dialog[open]").count()),
      animations: "disabled",
    });
    screenshots.push({ file, width, scene, sha256: hash(bytes) });
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
      await context.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      const scene = async (key) => {
        await page.evaluate((key) => {
          window.USER_ADMIN_C.scene(key);
          document.querySelectorAll("dialog").forEach((d) => {
            d.scrollTop = 0;
          });
          window.scrollTo(0, 0);
        }, key);
      };
      const state = () => page.evaluate(() => window.USER_ADMIN_C.state());
      const allScenes = await page.evaluate(() => Object.keys(window.USER_ADMIN_C.scenes));
      for (const key of allScenes) {
        await scene(key);
        if (key.endsWith("--hover") || key.endsWith("--pressed"))
          await page.locator("#create-trigger").hover();
        if (key.endsWith("--pressed")) await page.mouse.down();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          key + " page overflow",
        );
        assert.equal(
          await page
            .locator("dialog[open]")
            .evaluateAll((ns) => ns.every((n) => n.scrollWidth <= n.clientWidth + 1)),
          true,
          key + " dialog overflow",
        );
        const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
        assert.equal(new Set(ids).size, ids.length, key + " duplicate IDs");
        assert.equal(
          await page
            .locator("input,select,textarea")
            .evaluateAll((ns) => ns.every((n) => !!document.querySelector(`label[for="${n.id}"]`))),
          true,
          key + " field labels",
        );
        await checkPrototypeMetrics(page);
        await shot(page, width, key);
        if (key.endsWith("--pressed")) {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
        const modal = page.locator("dialog[open]").last();
        if (
          (await modal.count()) &&
          (await modal.evaluate((d) => d.scrollHeight > d.clientHeight + 2))
        ) {
          await modal.evaluate((d) => {
            d.scrollTop = d.scrollHeight;
          });
          await shot(page, width, key, "-bottom");
        }
      }
      for (const mode of ["users", "admins"]) {
        await scene(mode + "--list");
        if (width === 390) {
          await page.getByRole("button", { name: "预览账号记录" }).click();
          assert.equal((await state()).modal, "preview");
          await page.getByRole("button", { name: "打开账号详情" }).click();
        } else await page.getByRole("button", { name: "账号详情", exact: true }).click();
        assert.equal((await state()).selected.id, data.overview[mode][0].id);
        await page.getByRole("button", { name: "平台权限", exact: true }).click();
        assert.equal((await state()).section, "roles");
        await page.getByRole("button", { name: "登录安全", exact: true }).click();
        assert.equal((await state()).section, "security");
        await page.getByRole("button", { name: "返回账号列表" }).click();
        assert.equal((await state()).route, "/platform-admin/" + mode);
        await page.locator("#create-trigger").click();
        assert.equal(
          (await state()).user.platform_role_code,
          mode === "admins" ? data.platformRoles[0].code : "",
        );
        await page.getByRole("button", { name: "确认创建", exact: true }).click();
        assert.equal((await state()).pending, null);
        await page.locator("#email").fill("synthetic@example.test");
        await page.locator("#temporary_password").fill("SyntheticOnly-12");
        await page.getByRole("button", { name: "确认创建", exact: true }).click();
        const body = (await state()).pending.body;
        assert.deepEqual(body, {
          email: "synthetic@example.test",
          temporary_password: "SyntheticOnly-12",
          platform_role_code: mode === "admins" ? data.platformRoles[0].code : null,
          organization_id: null,
          organization_role_code: "member",
        });
        await page.evaluate(() => window.USER_ADMIN_C.complete("error"));
        assert.equal((await state()).user.email, "synthetic@example.test");
        await page.getByRole("button", { name: "取消", exact: true }).click();
        assert.equal((await state()).user.temporary_password, "");
        assert.equal(
          await page.locator("#create-trigger").evaluate((n) => n === document.activeElement),
          true,
        );
        const reasons = await page.evaluate(() => Object.keys(window.USER_ADMIN_C.reasons));
        for (const kind of reasons) {
          await scene(mode + "--reason_" + kind);
          const before = await state();
          if (kind.startsWith("grant_") || kind.startsWith("revoke_")) {
            const roles = before.selected.roles ?? before.selected.platform_roles;
            assert.equal(roles.includes(before.reason.body.role_code), kind.startsWith("revoke_"));
          }
          await page.locator("#reason").fill(" ");
          await page.getByRole("button", { name: "确认执行", exact: true }).click();
          assert.equal((await state()).pending, null);
          await page.locator("#reason").fill("  核对授权  ");
          await page.getByRole("button", { name: "确认执行", exact: true }).click();
          const p = (await state()).pending;
          assert.equal(p.method, "POST");
          assert.equal(p.userId, before.selected.id);
          assert.deepEqual(p.body, { ...before.reason.body, reason: "核对授权" });
          const suffix =
            kind === "reset_password"
              ? "/password"
              : ["disable", "restore"].includes(kind)
                ? "/status"
                : ["session", "sessions"].includes(kind)
                  ? "/sessions/revoke"
                  : "/platform-role";
          assert.equal(p.path, `/platform/accounts/users/${before.selected.id}${suffix}`);
          assert.ok(!("expected_version" in p.body));
        }
        await scene(mode + "--memberships");
        for (const code of data.organizationRoleCodes) {
          await page.locator("#member-role").selectOption(code);
          await page.locator("#member-reason").fill(" 加入团队 ");
          await page.getByRole("button", { name: "加入组织", exact: true }).click();
          const p = (await state()).pending;
          assert.equal(p.path, `/platform/accounts/users/${data.overview[mode][0].id}/memberships`);
          assert.deepEqual(p.body, {
            organization_id: "00000000-0000-4000-8000-000000000628",
            role_code: code,
            reason: " 加入团队 ",
          });
          await page.evaluate(() => window.USER_ADMIN_C.complete("error"));
        }
        await scene(mode + "--disabled_roles");
        assert.equal(
          await page.locator(".role-line button").evaluateAll((ns) => ns.every((n) => n.disabled)),
          true,
        );
        await scene(mode + "--expired_session");
        assert.equal(await page.getByRole("button", { name: "撤销", exact: true }).count(), 0);
        await scene(mode + "--password");
        await page.locator("#new-password").fill("short");
        await page.getByRole("button", { name: "下一步：填写原因" }).click();
        assert.equal((await state()).reason, null);
        await page.locator("#new-password").fill("SyntheticOnly-12");
        await page.getByRole("button", { name: "下一步：填写原因" }).click();
        const targetId = (await state()).selected.id;
        await page.evaluate(() => window.USER_ADMIN_C.changeTargetForTest());
        await page.getByRole("button", { name: "确认执行", exact: true }).click();
        assert.equal((await state()).pending.userId, targetId);
        assert.equal((await state()).pending.body.temporary_password, "SyntheticOnly-12");
        await scene(mode + "--reason_disable");
        await page.evaluate(() => window.USER_ADMIN_C.invalidate());
        await page.getByRole("button", { name: "确认执行", exact: true }).click();
        assert.equal((await state()).writes.length, 0);
        await scene(mode + "--create_org");
        await page.getByRole("button", { name: "确认创建", exact: true }).click();
        const pendingId = (await state()).pending.id;
        await page.getByRole("button", { name: "取消", exact: true }).click();
        await page.locator("#create-trigger").click();
        await page.locator("#email").fill("second@example.test");
        await page.evaluate((id) => window.USER_ADMIN_C.complete("success", id), pendingId);
        assert.equal((await state()).modal, "create");
        assert.equal((await state()).user.email, "second@example.test");
        await page.keyboard.press("Escape");
        assert.equal((await state()).modal, "");
        await scene(mode + "--reason_reset_password");
        await page.keyboard.press("Escape");
        assert.equal((await state()).reason, null);
        assert.equal((await state()).modal, "password");
        await page.keyboard.press("Escape");
        assert.equal((await state()).modal, "detail");
        assert.equal((await state()).password, "");
        const last = page.locator("#detail-modal button").last();
        await last.focus();
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator("#detail-modal button")
            .first()
            .evaluate((n) => n === document.activeElement),
          true,
        );
        await scene(mode + "--filter");
        await page.locator("#mobile-query").fill("no-match");
        await page.getByRole("button", { name: "搜索", exact: true }).last().click();
        assert.equal((await state()).rows.length, 0);
        assert.equal(new URL(page.url()).searchParams.get("query"), "no-match");
        await page.getByRole("button", { name: "清除筛选", exact: true }).click();
        assert.equal((await state()).rows.length, 1);
        checks.push(
          `${width}/${mode}: list-preview-detail sections; exact creation defaults and five fields; 11 reason bodies/paths; 5 membership roles; password validation/snapshot; disabled/ended controls; old action 0 writes; late creation ownership; password clearing; Escape/Tab; email URL filtering`,
        );
      }
      await scene("admins--comparison");
      assert.equal((await page.evaluate(() => window.USER_ADMIN_C.comparison())).length, 6);
      const url = page.url();
      await page.locator("#right").selectOption(data.platformRoles[0].code);
      assert.equal((await page.evaluate(() => window.USER_ADMIN_C.comparison())).length, 0);
      await page.locator("#differences").uncheck();
      assert.equal((await page.evaluate(() => window.USER_ADMIN_C.comparison())).length, 3);
      assert.equal(page.url(), url);
      await page.locator("#capabilityQuery").fill("report:read");
      assert.equal((await page.evaluate(() => window.USER_ADMIN_C.comparison())).length, 1);
      await page.getByRole("button", { name: "重置对比" }).click();
      assert.equal((await page.evaluate(() => window.USER_ADMIN_C.comparison())).length, 6);
      await page.locator("#group").selectOption("安全治理");
      assert.equal((await page.evaluate(() => window.USER_ADMIN_C.comparison())).length, 2);
      assert.equal(page.url(), url);
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      for (const w of [759, 760, 768, 1024]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await scene("admins--roles");
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
      }
      checks.push(
        `${width}: embedded role comparison 6/0/3, exact search and group, reset, no URL persistence; 759/760/768/1024 partial checks; no storage`,
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  if (capture)
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          proposal: "USER-ADMIN-C-r1",
          sourceHashes,
          sourceChecks: data.checks,
          checks,
          errors,
          httpRequests: 0,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
  else
    assert.deepEqual(
      prior.screenshots.map((s) => s.file),
      expected,
    );
  assert.deepEqual(
    (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
    [...expected].sort(),
  );
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      errors,
      httpRequests: requests.length,
    }),
  );
} finally {
  await browser.close();
}
