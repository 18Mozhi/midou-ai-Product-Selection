import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildPlatformOrganizationsDesignData } from "./lib/ui-phase2-platform-organizations-design-data.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/platform-organizations-direction-c";
const root = path.join(repo, relative),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const data = await buildPlatformOrganizationsDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.ORGANIZATIONS_C_DATA)), data);
const sources = [
  ...data.sourcePaths,
  "scripts/lib/ui-phase2-platform-organizations-design-data.mjs",
  "scripts/verify-ui-phase2-platform-organizations-c.mjs",
  ...["index.html", "data.js", "organizations.css", "organizations.js"].map(
    (f) => relative + "/" + f,
  ),
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
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const browser = await chromium.launch({ headless: true });
const screenshots = [],
  expected = [],
  checks = [],
  errors = [],
  network = [];
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
      reducedMotion: "reduce",
    });
    try {
      await context.route(/^https?:/, (route) => {
        network.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      const scene = async (name) => page.evaluate((v) => window.ORGANIZATIONS_C.scene(v), name);
      const state = () => page.evaluate(() => window.ORGANIZATIONS_C.state());
      const scenes = await page.evaluate(() => Object.keys(window.ORGANIZATIONS_C.scenes));
      for (const name of scenes) {
        await scene(name);
        if (name === "hover") await page.locator("#new-org").hover();
        if (name === "pressed") {
          await page.locator("#new-org").hover();
          await page.mouse.down();
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          `${width}/${name} page overflow`,
        );
        assert.equal(
          await page
            .locator("dialog[open]")
            .evaluateAll((nodes) => nodes.every((d) => d.scrollWidth <= d.clientWidth + 1)),
          true,
          `${width}/${name} dialog overflow`,
        );
        const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
        assert.equal(new Set(ids).size, ids.length, `${width}/${name} duplicate ids`);
        assert.equal(
          await page
            .locator("input,select,textarea")
            .evaluateAll((ns) => ns.every((n) => !!document.querySelector(`label[for="${n.id}"]`))),
          true,
        );
        await shot(page, width, name);
        if (name === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
        const active = page.locator("dialog[open]").last();
        if (
          (await active.count()) &&
          (await active.evaluate((d) => d.scrollHeight > d.clientHeight + 2))
        ) {
          await active.evaluate((d) => {
            d.scrollTop = d.scrollHeight;
          });
          await shot(page, width, name, "-bottom");
        }
      }
      await scene("list");
      if (width === 390) {
        await page.getByRole("button", { name: "预览组织记录" }).click();
        assert.equal((await state()).modal, "preview");
        await page.getByRole("button", { name: "打开组织详情" }).click();
      } else await page.getByRole("button", { name: "查看详情", exact: true }).click();
      assert.equal(
        (await state()).route,
        "/platform-admin/organizations/" + data.overview.organizations[0].id,
      );
      await page.getByRole("button", { name: "返回组织列表", exact: true }).click();
      await page.locator("#new-org").click();
      await page.getByRole("button", { name: "下一步：选择管理员" }).click();
      assert.equal((await state()).step, 1);
      await page.locator("#name").fill("新审核团队");
      await page.locator("#slug").fill("-invalid");
      await page.getByRole("button", { name: "下一步：选择管理员" }).click();
      assert.equal((await state()).step, 1);
      assert.equal(await page.locator("#slug").evaluate((n) => n.validity.patternMismatch), true);
      await page.locator("#slug").fill("team-");
      await page.getByRole("button", { name: "下一步：选择管理员" }).click();
      assert.equal((await state()).step, 2);
      await page.getByRole("button", { name: "确认创建", exact: true }).click();
      let value = await state();
      assert.deepEqual(value.pending.body, { name: "新审核团队", slug: "team-" });
      assert.equal(value.pending.method, "POST");
      await page.evaluate(() => window.ORGANIZATIONS_C.complete("error"));
      assert.equal((await state()).step, 2);
      assert.equal((await state()).form.slug, "team-");
      await page.getByRole("button", { name: "确认创建", exact: true }).click();
      await page.evaluate(() => window.ORGANIZATIONS_C.complete());
      assert.equal((await state()).modal, "detail");
      assert.equal((await state()).selected.member_count, undefined);
      assert.ok((await page.locator("#modal").innerText()).includes("未返回"));
      checks.push(
        `${width}: mobile preview/desktop detail -> list -> two-step create; required validation, trailing hyphen, exact omitted-admin body, failure retains draft, minimal success unknown counts`,
      );
      for (const [name, expectedBody, method] of [
        [
          "save_reason",
          {
            name: data.overview.organizations[0].name,
            timezone: "Asia/Shanghai",
            data_retention_days: 365,
            reason: "核对修改",
          },
          "PATCH",
        ],
        ["disable_reason", { status: "archived", reason: "核对修改" }, "POST"],
        ["restore_reason", { status: "active", reason: "核对修改" }, "POST"],
      ]) {
        await scene(name);
        await page.locator("#reason").fill(" ");
        await page.getByRole("button", { name: "确认执行" }).click();
        assert.equal((await state()).pending, null);
        await page.locator("#reason").fill("  核对修改  ");
        await page.evaluate(() =>
          window.ORGANIZATIONS_C.mutateSelectionForTest("synthetic-other-id"),
        );
        await page.getByRole("button", { name: "确认执行" }).click();
        value = await state();
        assert.deepEqual(value.pending.body, expectedBody);
        assert.equal(value.pending.method, method);
        assert.ok(value.pending.path.includes(data.overview.organizations[0].id));
        assert.ok(!("expected_version" in value.pending.body));
      }
      checks.push(
        `${width}: three reason variants exact methods/bodies, trim/invalid, original target/form snapshot despite synthetic selection drift`,
      );
      await scene("create_confirm");
      await page.getByRole("button", { name: "确认创建", exact: true }).click();
      const oldId = (await state()).pending.id;
      await page.getByRole("button", { name: "取消", exact: true }).click();
      await page.locator("#new-org").click();
      await page.locator("#name").fill("新的草稿");
      await page.evaluate((id) => window.ORGANIZATIONS_C.complete("success", id), oldId);
      assert.equal((await state()).modal, "create");
      assert.equal((await state()).form.name, "新的草稿");
      await page.keyboard.press("Escape");
      assert.equal((await state()).modal, "");
      assert.equal(
        await page.locator("#new-org").evaluate((n) => n === document.activeElement),
        true,
      );
      await scene("user_org");
      await page.getByRole("button", { name: "确认创建", exact: true }).click();
      value = await state();
      assert.equal(value.pending.path, "/platform/accounts/users");
      assert.equal(value.pending.body.platform_role_code, null);
      assert.equal(Object.keys(value.pending.body).length, 5);
      await scene("create_inactive");
      assert.equal(
        await page
          .locator("#initial_admin_user_id option")
          .last()
          .evaluate((n) => n.disabled),
        true,
      );
      await scene("detail_invalid");
      await page.getByRole("button", { name: "保存组织资料", exact: true }).click();
      assert.equal((await state()).reason, null);
      await scene("save_reason");
      await page.keyboard.press("Escape");
      assert.equal((await state()).reason, null);
      assert.equal((await state()).modal, "detail");
      const focusables = page.locator("#modal button");
      await focusables.last().focus();
      await page.keyboard.press("Tab");
      assert.equal(await focusables.first().evaluate((n) => n === document.activeElement), true);
      checks.push(
        `${width}: late completion cannot close new draft; cancel retains draft, reopen step1, Escape focus; five-field user body, inactive admin disabled, invalid retention, nested reason Escape and Tab wrap`,
      );
      await scene("filter");
      await page.locator("#mobile-query").fill("nothing");
      await page.locator('#modal button[type="submit"], #modal button:not([type])').click();
      assert.equal((await state()).rows.length, 0);
      assert.equal(new URL(page.url()).searchParams.get("query"), "nothing");
      await page.getByRole("button", { name: "清空条件", exact: true }).last().click();
      assert.equal((await state()).rows.length, 1);
      assert.equal(new URL(page.url()).searchParams.get("query"), null);
      assert.equal((await context.cookies()).length, 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      for (const testWidth of [760, 768, 1024]) {
        await page.setViewportSize({ width: testWidth, height: 1000 });
        await scene("create_confirm");
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  if (capture)
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          proposal: "PLATFORM-ORGANIZATIONS-C-r1",
          sourceHashes,
          sourceChecks: data.checks,
          checks,
          errors,
          httpRequests: network.length,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
  else
    assert.deepEqual(
      previous.screenshots.map((s) => s.file),
      expected,
    );
  const files = (await readdir(root)).filter((f) => f.endsWith(".png")).sort();
  assert.deepEqual(files, [...expected].sort());
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      httpRequests: network.length,
      errors,
    }),
  );
} finally {
  await browser.close();
}
