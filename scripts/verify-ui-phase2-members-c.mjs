import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildMembersDesignData } from "./lib/ui-phase2-members-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/members-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildMembersDesignData(repo),
  sources = [
    ...["index.html", "members.css", "members.js", "data.js"].map((f) => `${relative}/${f}`),
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/components/OrganizationMemberPanel.vue",
    "apps/web/src/components/AuditedReasonDialog.vue",
    "apps/web/src/use-audited-reason.ts",
    "apps/web/src/use-modal-dialog.ts",
    "apps/api/src/organization-admin-service.ts",
    "apps/api/src/organization-admin-routes.ts",
    "apps/api/src/mysql-organization-admin-repository.ts",
    "tests/e2e/m06-01-organization-admin.spec.ts",
    "scripts/lib/ui-phase2-members-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-members-c.mjs",
  ],
  sourceHashes = Object.fromEntries(
    await Promise.all(
      sources.map(async (f) => [
        f,
        hash((await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n")),
      ]),
    ),
  );
const box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.MEMBERS_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const item of previous.screenshots) {
    assert.match(item.file, /^[a-z0-9_-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, item.file))), item.sha256);
  }
}
const screenshots = [],
  expected = [],
  checks = [],
  browser = await chromium.launch({ headless: true });
async function metrics(page) {
  await checkPrototypeMetrics(page);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "page overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(
    await page
      .locator("input,select,textarea")
      .evaluateAll((nodes) => nodes.every((n) => !!document.querySelector(`label[for="${n.id}"]`))),
    true,
  );
  if (await page.locator("dialog[open]").count())
    assert.equal(
      await page.locator("dialog").evaluate((n) => {
        const r = n.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight + 1 && n.scrollWidth <= n.clientWidth + 1;
      }),
      true,
      "modal bounds",
    );
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
      await page.waitForFunction(() => window.MEMBERS_C?.state());
      const scene = (name) => page.evaluate((v) => window.MEMBERS_C.scene(v), name),
        state = () => page.evaluate(() => window.MEMBERS_C.state()),
        complete = (outcome) => page.evaluate((v) => window.MEMBERS_C.complete(v), outcome),
        hold = () => page.evaluate(() => window.MEMBERS_C.setMode("hold")),
        names = await page.evaluate(() => Object.keys(window.MEMBERS_C.scenes));
      assert.equal(names.length, 47);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        if (["hover", "pressed"].includes(name)) {
          await page.locator("#invite-submit").hover();
          if (name === "pressed") await page.mouse.down();
        }
        if (name === "focus") await page.locator("#invite-submit").focus();
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: !(await page.locator("dialog[open]").count()),
            animations: "disabled",
          });
          screenshots.push({ file, width, scene: name, sha256: hash(bytes) });
        }
        if (name === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
      }
      await scene("normal");
      assert.equal(await page.locator(".member").count(), 3);
      assert.equal(
        (await page.locator("#filters-panel").getAttribute("open")) !== null,
        width > 650,
      );
      if (width === 390) await page.locator("#filters-panel summary").click();
      await page.locator("#filter-query").fill("陈");
      assert.equal(await page.locator(".member").count(), 1);
      assert.match(await page.locator(".member").innerText(), /陈采购/);
      await page.locator("[data-reset]").first().click();
      await page.locator("#filter-status").selectOption("locked");
      assert.equal(await page.locator(".member").count(), 1);
      assert.match(await page.locator(".member").innerText(), /钱锁定/);
      await page.locator("[data-reset]").first().click();
      await page.locator("#filter-role").selectOption("procurement_member");
      await page.locator("#filter-team").selectOption("采购协作组");
      await page.locator("#filter-sort").selectOption("joined_desc");
      assert.equal(await page.locator(".member").count(), 1);
      assert.equal((await state()).filters.sort, "joined_desc");
      await page.locator("#filters-panel summary").click();
      assert.match(await page.locator(".filter-summary").innerText(), /采购协作组/);
      await scene("multipage");
      assert.equal(await page.locator(".member").count(), 10);
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      assert.equal(await page.locator(".member").count(), 1);
      assert.equal((await state()).page, 2);
      if (width === 390) await page.locator("#filters-panel summary").click();
      await page.locator("#filter-query").fill("01");
      assert.equal((await state()).page, 1);
      assert.equal((await state()).intents.length, 0);
      for (const action of ["disable", "restore", "role", "revoke"]) {
        const id =
          action === "restore"
            ? data.members.items[2].id
            : action === "revoke"
              ? data.members.invitations[0].id
              : data.members.items[1].id;
        for (const dismiss of ["cancel", "escape", "close"]) {
          await scene(action === "restore" ? "disabled_locked" : "normal");
          if (action === "role")
            await page.locator(`#role-${id}`).selectOption("selection_manager");
          assert.equal((await state()).intents.length, 0);
          const trigger = page.locator(`[data-action="${action}"][data-id="${id}"]`);
          await trigger.click();
          assert.equal(
            await page.locator("#reason-input").evaluate((n) => n === document.activeElement),
            true,
          );
          await page.locator("#reason-close").focus();
          await page.keyboard.press("Shift+Tab");
          assert.equal(
            await page.locator("#reason-confirm").evaluate((n) => n === document.activeElement),
            true,
          );
          await page.keyboard.press("Tab");
          assert.equal(
            await page.locator("#reason-close").evaluate((n) => n === document.activeElement),
            true,
          );
          if (dismiss === "escape") await page.keyboard.press("Escape");
          else await page.locator(`#reason-${dismiss}`).click();
          assert.equal(await page.locator("dialog[open]").count(), 0);
          assert.equal((await state()).intents.length, 0);
          assert.equal(await trigger.evaluate((n) => n === document.activeElement), true);
        }
        await scene(`reason_${action}`);
        await page.locator("#reason-input").fill("短");
        assert.equal(await page.locator("#reason-confirm").isDisabled(), true);
        await page.locator("#reason-close").focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.locator("#reason-cancel").evaluate((n) => n === document.activeElement),
          true,
        );
        assert.equal(await page.locator("#reason-input").getAttribute("maxlength"), "500");
        await page.locator("#reason-input").fill("核验成员变更");
        await hold();
        await page.locator("#reason-confirm").click();
        const { options, ...contract } = data.contracts[action];
        assert.deepEqual((await state()).intents, [contract]);
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal((await state()).busy, "action");
        await complete("error");
        assert.equal(
          await page.locator("#feedback").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.locator(`[data-action="${action}"][data-id="${id}"]`).click();
        assert.notEqual(await page.locator("#reason-input").inputValue(), "核验成员变更");
        if (action === "restore")
          assert.match(await page.locator("#reason-target").innerText(), /不解除账号锁定/);
        await page.locator("#reason-cancel").click();
      }
      await scene("invite_boundary");
      assert.equal(await page.locator("[data-action=revoke]").count(), 0);
      assert.match(await page.locator(".invite-records").innerText(), /等待邮件服务/);
      await scene("invite_form");
      await page
        .locator("#invite-emails")
        .fill(" FIRST@example.test\nfirst@example.test;bad;second@example.test");
      await page.locator("#invite-reason").fill("合成邀请原因");
      await hold();
      await page.locator("#invite-submit").click();
      assert.equal((await state()).intents.length, 1);
      assert.equal(await page.locator("#invite-submit").isDisabled(), true);
      await complete("success");
      assert.equal((await state()).intents.length, 2);
      await complete("error");
      assert.deepEqual((await state()).intents, data.batch.calls);
      assert.deepEqual((await state()).form, data.batch.form);
      assert.match(await page.locator(".results").innerText(), /已创建待投递/);
      for (const outcome of ["forbidden", "success"]) {
        await scene("invite_form");
        await page.locator("#invite-emails").fill("a@example.test;b@example.test;c@example.test");
        await hold();
        await page.locator("#invite-submit").click();
        await complete(outcome);
        if (outcome === "forbidden") {
          assert.equal((await state()).intents.length, 1);
          assert.equal(
            (await state()).form.emails,
            "a@example.test\nb@example.test\nc@example.test",
          );
          assert.equal((await state()).results.filter((r) => r.status === "pending").length, 2);
        } else {
          await complete("success");
          await complete("success");
          assert.equal((await state()).intents.length, 3);
          assert.equal((await state()).form.emails, "");
          assert.equal((await state()).form.reason, "");
        }
        assert.equal(await complete("success"), false);
        assert.deepEqual((await state()).invitations, data.members.invitations);
      }
      await scene("normal");
      await page.getByRole("link", { name: "邀请成员", exact: true }).click();
      assert.equal(
        await page.locator("#invitation-section").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#refresh").click();
      assert.deepEqual((await state()).intents, [
        { url: "/org/admin/summary", method: "GET" },
        { url: "/org/admin/members", method: "GET" },
      ]);
      assert.deepEqual((await state()).items, data.members.items);
      await page.locator("#invite-emails").fill("unsaved@example.test");
      await page.reload();
      await page.waitForFunction(() => window.MEMBERS_C?.state());
      assert.equal((await state()).form.emails, "");
      if (width === 1440)
        for (const w of [768, 1024]) {
          await page.setViewportSize({ width: w, height: 1000 });
          for (const name of [
            "normal",
            "long_member",
            "multiple_roles",
            "reason_role",
            "reason_long",
          ]) {
            await scene(name);
            await metrics(page);
          }
        }
      assert.deepEqual(errors, []);
      assert.deepEqual(http, []);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push({
        width,
        scenes: names.length,
        dialogVariants: 4,
        interactions: "passed",
        httpRequests: 0,
        browserErrors: 0,
        storageEntries: 0,
      });
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
        boundary:
          "Independent proposal and source inert adapters; not mounted Vue, real API/SQL transaction, email delivery, audit or production verification.",
        sourceHashes,
        sourceChecks: data.sourceChecks,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
else
  assert.deepEqual(
    previous.screenshots.map((v) => v.file),
    expected,
  );
assert.deepEqual(
  (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
  [...expected].sort(),
);
console.log(
  JSON.stringify(
    {
      mode: capture ? "capture" : "verify",
      screenshots: expected.length,
      checks,
      sourceChecks: data.sourceChecks,
      temporaryProcesses: "all browser contexts closed",
    },
    null,
    2,
  ),
);
