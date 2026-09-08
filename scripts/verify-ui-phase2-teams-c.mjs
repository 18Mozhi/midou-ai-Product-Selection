import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildTeamsDesignData } from "./lib/ui-phase2-teams-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/teams-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildTeamsDesignData(repo),
  sources = [
    ...["index.html", "teams.css", "teams.js", "data.js"].map((f) => `${relative}/${f}`),
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/components/OrganizationTeamPanel.vue",
    "apps/web/src/components/AuditedReasonDialog.vue",
    "apps/web/src/use-audited-reason.ts",
    "apps/api/src/organization-admin-service.ts",
    "apps/api/src/organization-admin-routes.ts",
    "apps/api/src/mysql-organization-admin-repository.ts",
    "tests/e2e/m06-01-organization-admin.spec.ts",
    "scripts/lib/ui-phase2-teams-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-teams-c.mjs",
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
assert.deepEqual(JSON.parse(JSON.stringify(box.window.TEAMS_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^[a-z0-9_-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
  }
}
const expected = [],
  screenshots = [],
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
  assert.equal(await page.locator("button[role=listitem]").count(), 0);
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
      await page.waitForFunction(() => window.TEAMS_C?.state());
      const scene = (name) => page.evaluate((v) => window.TEAMS_C.scene(v), name),
        state = () => page.evaluate(() => window.TEAMS_C.state()),
        hold = () => page.evaluate(() => window.TEAMS_C.setMode("hold")),
        complete = (outcome) => page.evaluate((v) => window.TEAMS_C.complete(v), outcome),
        names = await page.evaluate(() => Object.keys(window.TEAMS_C.scenes));
      assert.equal(names.length, 48);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        if (name === "member_missing") {
          assert.equal(await page.locator("#member-feedback").isVisible(), true);
          assert.match(await page.locator("#member-feedback").innerText(), /请先选择/);
        }
        if (["hover", "pressed"].includes(name)) {
          await page.locator("#create-submit").hover();
          if (name === "pressed") await page.mouse.down();
        }
        if (name === "focus") await page.locator("#create-submit").focus();
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
      assert.equal(await page.locator("[data-select]").count(), 1);
      assert.equal(await page.locator("#team-member-select option").count(), 4);
      for (const name of ["归档团队", "删除团队", "编辑负责人"])
        assert.equal(await page.getByRole("button", { name, exact: true }).count(), 0);
      await page.locator("[data-member-action=assign]").click();
      assert.match(await page.locator("#member-feedback").innerText(), /请先选择/);
      assert.equal((await state()).intents.length, 0);
      await page.locator("#team-member-select").selectOption(data.members.items[2].id);
      assert.match(await page.locator(".member-identity").innerText(), /账号已锁定/);
      assert.equal(await page.locator("[data-member-action=assign]").isDisabled(), false);
      await scene("catalog");
      assert.equal(await page.locator("[data-select]").count(), 8);
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      assert.equal(await page.locator("[data-select]").count(), 2);
      if (width === 390) await page.locator("#filters summary").click();
      await page.locator("#query").fill("workflow-10");
      assert.equal((await state()).page, 1);
      assert.equal(await page.locator("[data-select]").count(), 1);
      assert.match(await page.locator("#relationship").innerText(), /当前选择不在筛选结果/);
      await page.locator("[data-reset]").first().click();
      await page.locator("#query").fill("buyer@example.test");
      assert.equal(await page.locator("[data-select]").count(), 5);
      await page.locator("[data-reset]").first().click();
      await page.locator("#sort").selectOption("updated_desc");
      assert.equal(
        await page.locator("[data-select]").first().getAttribute("data-select"),
        data.teamRows[9].id,
      );
      await page.locator("#sort").selectOption("members_desc");
      assert.match(await page.locator("[data-select]").first().innerText(), /3 人/);
      await scene("archived");
      await page.locator("#team-member-select").selectOption(data.members.items[1].id);
      assert.equal(await page.locator("[data-member-action=assign]").isDisabled(), false);
      await page.locator("[data-member-action=remove]").click();
      assert.equal(await page.locator("dialog[open]").count(), 1);
      await page.keyboard.press("Escape");
      for (const action of ["assign", "remove"]) {
        for (const dismiss of ["cancel", "close", "escape"]) {
          await scene("selected");
          await page.locator("#team-member-select").selectOption(data.members.items[1].id);
          await page.locator(`[data-member-action=${action}]`).click();
          assert.equal((await state()).memberBusy, true);
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
          assert.equal((await state()).memberBusy, false);
          assert.equal((await state()).intents.length, 0);
          assert.equal(
            await page
              .locator(`[data-member-action=${action}]`)
              .evaluate((n) => n === document.activeElement),
            true,
          );
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
        await page.locator("#reason-input").fill("核验团队成员关系");
        await hold();
        await page.locator("#reason-confirm").click();
        const { options, ...contract } = data.contracts[action];
        assert.deepEqual((await state()).intents, [contract]);
        assert.equal("expected_version" in (await state()).intents[0].body, false);
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal((await state()).memberBusy, true);
        await complete("error");
        assert.equal(
          await page.locator("#member-feedback").evaluate((n) => n === document.activeElement),
          true,
        );
        assert.deepEqual((await state()).items, data.teamRows);
        await page.locator(`[data-member-action=${action}]`).click();
        assert.notEqual(await page.locator("#reason-input").inputValue(), "核验团队成员关系");
        await page.keyboard.press("Escape");
      }
      for (const changedMember of [false, true]) {
        await scene("reason_assign");
        await hold();
        await page.locator("#reason-confirm").click();
        await page.locator(`[data-select="${data.teamRows[2].id}"]`).click();
        assert.equal((await state()).memberId, "");
        if (changedMember)
          await page.locator("#team-member-select").selectOption(data.members.items[0].id);
        await complete("success");
        assert.equal((await state()).memberFeedback, "");
        assert.match((await state()).notice, /团队治理样本 02/);
        assert.match((await state()).notice, /陈采购/);
        assert.doesNotMatch((await state()).notice, /林管理员/);
        assert.equal((await state()).selectedId, data.teamRows[2].id);
      }
      await scene("normal");
      await page.locator("[data-create]").click();
      assert.equal(
        await page.locator("#team-name").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#create-submit").click();
      assert.equal((await state()).intents.length, 0);
      assert.equal(await page.locator("#team-name").getAttribute("aria-invalid"), "true");
      await page.locator("#team-name").fill(data.contracts.create.body.name);
      await page.locator("#team-lead").selectOption(data.contracts.create.body.lead_membership_id);
      await page.locator("#team-workflow").fill(data.contracts.create.body.default_workflow_key);
      await page.locator("#team-reason").fill(data.contracts.create.body.reason);
      await hold();
      await page.locator("#create-submit").dblclick();
      assert.equal((await state()).intents.length, 1);
      const { options, ...contract } = data.contracts.create;
      assert.deepEqual((await state()).intents[0], contract);
      assert.equal(await page.locator("#cancel-create").isDisabled(), true);
      await complete("error");
      assert.deepEqual((await state()).form, data.contracts.create.body);
      assert.equal(
        await page.locator("#form-feedback").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#cancel-create").click();
      assert.equal((await state()).createOpen, false);
      assert.equal(
        await page.locator("[data-create]").evaluate((n) => n === document.activeElement),
        true,
      );
      await scene("create_optional_empty");
      await page.locator("#create-submit").click();
      assert.equal((await state()).intents[0].body.lead_membership_id, "");
      assert.equal((await state()).intents[0].body.default_workflow_key, "");
      await scene("create_draft");
      await page.evaluate(() => window.TEAMS_C.setMembers([]));
      await page.locator("#create-submit").click();
      assert.equal((await state()).intents.length, 0);
      assert.match(await page.locator("#lead-error").innerText(), /重新选择/);
      for (const outcome of ["success", "read_failed", "unknown", "forbidden"]) {
        await scene("create_draft");
        await hold();
        await page.locator("#create-submit").click();
        const token = (await state()).pending.token;
        await complete(outcome);
        assert.deepEqual((await state()).items, data.teams);
        if (outcome === "success") {
          assert.equal((await state()).createOpen, false);
          assert.equal((await state()).form.name, "");
        } else if (outcome === "forbidden") {
          assert.equal((await state()).pageState, "forbidden");
          assert.equal(await page.locator("#create-form").count(), 0);
        } else assert.equal(await page.locator("#create-submit").isDisabled(), true);
        assert.equal(
          await page.evaluate((t) => window.TEAMS_C.complete("success", t), token),
          false,
        );
      }
      await scene("reason_assign");
      await hold();
      await page.locator("#reason-confirm").click();
      const oldToken = (await state()).pending.token;
      await scene("normal");
      assert.equal(
        await page.evaluate((t) => window.TEAMS_C.complete("success", t), oldToken),
        false,
      );
      await scene("empty");
      assert.equal((await state()).createOpen, true);
      await page.locator("#cancel-create").click();
      assert.equal((await state()).createOpen, false);
      await page.getByRole("button", { name: "创建团队", exact: true }).click();
      assert.equal((await state()).createOpen, true);
      await scene("page_two");
      await page.evaluate((rows) => window.TEAMS_C.setRows(rows), data.teams);
      assert.equal((await state()).page, 1);
      assert.equal((await state()).selectedId, data.teams[0].id);
      await scene("create_draft");
      const draft = (await state()).form;
      await page.locator("#refresh").click();
      assert.deepEqual((await state()).form, draft);
      assert.deepEqual(
        (await state()).intents,
        ["summary", "teams", "members"].map((p) => ({ url: "/org/admin/" + p, method: "GET" })),
      );
      await page.reload();
      await page.waitForFunction(() => window.TEAMS_C?.state());
      assert.equal((await state()).createOpen, false);
      for (const href of ["/org-admin/members", "/org-admin/workspaces"]) {
        await scene("normal");
        await page.locator(`[data-route][href="${href}"]`).click();
        assert.deepEqual((await state()).intents, [{ url: href, method: "NAVIGATE" }]);
      }
      await scene("normal");
      await page.getByRole("link", { name: "协作关系", exact: true }).click();
      assert.equal(
        await page.locator("#relationship").evaluate((n) => n === document.activeElement),
        true,
      );
      if (width === 1440)
        for (const w of [768, 1024]) {
          await page.setViewportSize({ width: w, height: 1000 });
          for (const n of [
            "catalog",
            "long_content",
            "create_long",
            "reason_assign",
            "reason_long",
          ]) {
            await scene(n);
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
        dialogVariants: 2,
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
          "Independent proposal and actual source inert adapters; not mounted Vue, real API/MySQL/permissions/audit or production proof.",
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
    previous.screenshots.map((s) => s.file),
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
