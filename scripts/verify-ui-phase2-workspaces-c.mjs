import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildWorkspacesDesignData } from "./lib/ui-phase2-workspaces-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/workspaces-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex"),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildWorkspacesDesignData(repo),
  sources = [
    ...["index.html", "workspaces.css", "workspaces.js", "data.js"].map((f) => `${relative}/${f}`),
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/components/OrganizationWorkspacePanel.vue",
    "apps/web/src/components/AuditedReasonDialog.vue",
    "apps/web/src/use-audited-reason.ts",
    "apps/api/src/organization-admin-service.ts",
    "apps/api/src/organization-admin-routes.ts",
    "apps/api/src/mysql-organization-admin-repository.ts",
    "tests/e2e/m06-01-organization-admin.spec.ts",
    "scripts/lib/ui-phase2-workspaces-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-workspaces-c.mjs",
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
assert.deepEqual(JSON.parse(JSON.stringify(box.window.WORKSPACES_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^[a-z0-9_-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
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
      await page.waitForFunction(() => window.WORKSPACES_C?.state());
      const scene = (name) => page.evaluate((v) => window.WORKSPACES_C.scene(v), name),
        state = () => page.evaluate(() => window.WORKSPACES_C.state()),
        hold = () => page.evaluate(() => window.WORKSPACES_C.setMode("hold")),
        complete = (outcome) => page.evaluate((v) => window.WORKSPACES_C.complete(v), outcome),
        names = await page.evaluate(() => Object.keys(window.WORKSPACES_C.scenes));
      assert.equal(names.length, 46);
      for (const name of names) {
        await scene(name);
        await metrics(page);
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
      assert.equal(await page.locator("#state-action").isDisabled(), true);
      assert.match(await page.locator("#detail").innerText(), /暂无记录/);
      assert.equal(await page.getByRole("button", { name: "删除工作区", exact: true }).count(), 0);
      await scene("catalog");
      assert.equal(await page.locator("[data-select]").count(), 8);
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      assert.equal(await page.locator("[data-select]").count(), 2);
      await page.locator("#query").fill("区域工作区 9");
      assert.equal((await state()).page, 1);
      assert.equal(await page.locator("[data-select]").count(), 1);
      assert.equal((await state()).selectedId, data.workspaceRows[0].id);
      assert.match(await page.locator("#detail").innerText(), /当前选择不在筛选结果/);
      await page.locator("[data-status=archived]").click();
      assert.equal(await page.locator("[data-select]").count(), 1);
      await page.locator("[data-reset]").first().click();
      await page.locator("#sort").selectOption("members_desc");
      assert.equal(
        await page.locator("[data-select]").first().getAttribute("data-select"),
        data.workspaceRows[0].id,
      );
      await page.locator("#sort").selectOption("updated_desc");
      assert.equal(
        await page.locator("[data-select]").first().getAttribute("data-select"),
        data.workspaceRows[9].id,
      );
      await page.locator("[data-reset]").first().click();
      await page.locator(`[data-select="${data.workspaceRows[1].id}"]`).click();
      assert.equal((await state()).selectedId, data.workspaceRows[1].id);
      assert.equal(
        await page.locator("#detail").evaluate((n) => n === document.activeElement),
        true,
      );
      assert.equal((await state()).intents.length, 0);
      for (const action of ["archive", "restore"]) {
        for (const dismiss of ["cancel", "close", "escape"]) {
          await scene(action === "archive" ? "selected" : "restore");
          await page.locator("#state-action").click();
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
          assert.equal(
            await page.locator("#state-action").evaluate((n) => n === document.activeElement),
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
        await page.locator("#reason-input").fill("核验工作区状态");
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
        await page.locator("#state-action").click();
        assert.notEqual(await page.locator("#reason-input").inputValue(), "核验工作区状态");
        await page.keyboard.press("Escape");
      }
      await scene("normal");
      await page.locator("[data-create]").click();
      assert.equal(
        await page.locator("#workspace-name").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#create-submit").click();
      assert.equal((await state()).intents.length, 0);
      assert.equal(await page.locator("#workspace-name").getAttribute("aria-invalid"), "true");
      await page.locator("#workspace-name").fill(data.contracts.create.body.name);
      await page.locator("#workspace-reason").fill(data.contracts.create.body.reason);
      for (const slug of ["Invalid Slug", "UPPER", "-abc", "abc-", " abc "]) {
        await page.locator("#workspace-slug").fill(slug);
        assert.equal(
          await page.locator("#workspace-slug").evaluate((n) => n.validity.patternMismatch),
          true,
        );
        await page.locator("#create-submit").click();
        assert.equal((await state()).intents.length, 0);
        assert.equal(await page.locator("#workspace-slug").getAttribute("aria-invalid"), "true");
      }
      await page.locator("#workspace-slug").fill(data.contracts.create.body.slug);
      await hold();
      await page.locator("#create-submit").dblclick();
      assert.equal((await state()).intents.length, 1);
      const { options, ...createContract } = data.contracts.create;
      assert.deepEqual((await state()).intents[0], createContract);
      assert.equal(await page.locator("#cancel-create").isDisabled(), true);
      await complete("error");
      assert.deepEqual((await state()).form, data.contracts.create.body);
      assert.equal(
        await page.locator("#form-feedback").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#cancel-create").click();
      assert.equal((await state()).createOpen, false);
      assert.deepEqual((await state()).form, { name: "", slug: "", reason: "" });
      assert.equal(
        await page.locator("[data-create]").evaluate((n) => n === document.activeElement),
        true,
      );
      for (const outcome of ["success", "read_failed", "unknown", "forbidden"]) {
        await scene("create_draft");
        await hold();
        await page.locator("#create-submit").click();
        const token = (await state()).pending.token;
        await complete(outcome);
        assert.deepEqual((await state()).items, data.workspaces);
        if (outcome === "success") {
          assert.equal((await state()).createOpen, false);
          assert.equal((await state()).form.name, "");
        } else if (outcome === "forbidden") {
          assert.equal((await state()).pageState, "forbidden");
          assert.equal(await page.locator("#create-form").count(), 0);
        } else {
          assert.equal((await state()).createOpen, true);
          assert.equal(await page.locator("#create-submit").isDisabled(), true);
        }
        assert.equal(
          await page.evaluate((t) => window.WORKSPACES_C.complete("success", t), token),
          false,
        );
      }
      await scene("create_draft");
      await hold();
      await page.locator("#create-submit").click();
      const oldToken = (await state()).pending.token;
      await scene("normal");
      assert.equal(
        await page.evaluate((t) => window.WORKSPACES_C.complete("success", t), oldToken),
        false,
      );
      await scene("empty");
      assert.equal((await state()).createOpen, true);
      await page.locator("#cancel-create").click();
      assert.equal((await state()).createOpen, false);
      await page.getByRole("button", { name: "创建工作区", exact: true }).click();
      assert.equal((await state()).createOpen, true);
      await scene("page_two");
      await page.evaluate((rows) => window.WORKSPACES_C.setRows(rows), data.workspaces);
      assert.equal((await state()).page, 1);
      assert.equal((await state()).selectedId, data.workspaces[0].id);
      await scene("create_draft");
      const draft = (await state()).form;
      await page.locator("#refresh").click();
      assert.deepEqual((await state()).form, draft);
      assert.deepEqual((await state()).intents, [
        { url: "/org/admin/summary", method: "GET" },
        { url: "/org/admin/workspaces", method: "GET" },
      ]);
      await page.reload();
      await page.waitForFunction(() => window.WORKSPACES_C?.state());
      assert.equal((await state()).createOpen, false);
      for (const href of ["/org-admin/teams", "/org-admin"]) {
        await scene("normal");
        await page.locator(`[data-route][href="${href}"]`).click();
        assert.deepEqual((await state()).intents, [{ url: href, method: "NAVIGATE" }]);
      }
      await scene("normal");
      await page.getByRole("link", { name: "治理详情", exact: true }).click();
      assert.equal(
        await page.locator("#detail").evaluate((n) => n === document.activeElement),
        true,
      );
      if (width === 1440)
        for (const w of [768, 1024]) {
          await page.setViewportSize({ width: w, height: 1000 });
          for (const name of [
            "catalog",
            "long_name",
            "create_long",
            "reason_archive",
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
          "Independent proposal and actual source inert adapters, not mounted Vue or real API/MySQL/audit/production verification.",
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
