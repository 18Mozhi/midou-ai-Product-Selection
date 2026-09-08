import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildOrgAuditDesignData } from "./lib/ui-phase2-org-audit-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/org-audit-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildOrgAuditDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.ORG_AUDIT_C_DATA)), data);
const sources = [
    ...["index.html", "audit.css", "audit.js", "data.js"].map((f) => relative + "/" + f),
    "scripts/lib/ui-phase2-org-audit-design-data.mjs",
    "scripts/verify-ui-phase2-org-audit-c.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "apps/web/src/components/OrganizationAuditPanel.vue",
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/api/src/audit-routes.ts",
    "apps/api/src/mysql-audit-repository.ts",
    "packages/audit/src/index.ts",
    "tests/e2e/m06-01-organization-admin.spec.ts",
  ],
  sourceHashes = Object.fromEntries(
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
  assert.equal(await page.locator("dialog,[role=dialog]").count(), 0);
  const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    await page
      .locator("input,select")
      .evaluateAll((ns) => ns.every((n) => document.querySelector('label[for="' + n.id + '"]'))),
    true,
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
      const url = pathToFileURL(path.join(root, "index.html")).href;
      await page.goto(url);
      const scene = (n) => page.evaluate((v) => window.ORG_AUDIT_C.scene(v), n),
        state = () => page.evaluate(() => window.ORG_AUDIT_C.state()),
        hold = () => page.evaluate(() => window.ORG_AUDIT_C.setMode("hold")),
        complete = (r) => page.evaluate((v) => window.ORG_AUDIT_C.complete(v), r),
        filters = async () => {
          if (!(await state()).filtersOpen) await page.locator("#filters-toggle").click();
        };
      const names = await page.evaluate(() => Object.keys(window.ORG_AUDIT_C.scenes));
      assert.equal(names.length, 50);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        if (
          [
            "loading",
            "error",
            "offline",
            "timeout",
            "forbidden",
            "expired",
            "rate_limited",
          ].includes(name)
        ) {
          assert.equal(await page.locator("#server-form,#event-list,.detail").count(), 0);
          assert.equal(await page.locator(".counts").count(), 0);
        }
        if (name === "range_error")
          assert.equal(
            await page.locator("#range-error").evaluate((n) => getComputedStyle(n).color),
            "rgb(140, 60, 50)",
          );
        if (["hover", "pressed"].includes(name)) {
          await page.locator("#apply").hover();
          if (name === "pressed") await page.mouse.down();
        }
        if (name === "focus") await page.locator("#loaded-query").focus();
        const file = width + "-" + name + ".png";
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({ file, width, scene: name, sha256: hash(bytes) });
        }
        if (name === "pressed") {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
      }
      for (const [name, selector] of [
        ["normal", ".detail"],
        ["advanced", ".rail"],
      ]) {
        await scene(name);
        if (name === "advanced") await filters();
        const file = width + "-" + name + "-detail.png";
        expected.push(file);
        if (capture) {
          const bytes = await page
            .locator(selector)
            .screenshot({ path: path.join(root, file), animations: "disabled" });
          screenshots.push({ file, width, scene: name, detail: selector, sha256: hash(bytes) });
        }
      }
      await scene("normal");
      assert.equal(await page.getByRole("listitem").count(), 50);
      assert.equal(await page.locator("[data-event]").count(), 50);
      assert.equal(await page.getByRole("button", { name: /成员邀请已创建/ }).count(), 17);
      assert.deepEqual(await page.locator(".counts b").allTextContents(), ["50", "17", "17", "16"]);
      assert.match(await page.locator("#metadata").innerText(), /已脱敏/);
      assert.doesNotMatch(await page.locator(".detail").innerText(), /synthetic-redaction-probe/);
      for (const [q, ids] of Object.entries(data.oracle)) {
        await page.locator("#loaded-query").fill(q);
        assert.deepEqual(
          await page.evaluate(() => window.ORG_AUDIT_C.visible().map((e) => e.id)),
          ids,
        );
        assert.equal((await state()).intents.length, 0);
        assert.equal(await page.locator("#more").count(), 0);
      }
      await page.locator("#clear-query").click();
      assert.equal(await page.locator("#more").count(), 1);
      await hold();
      await page.locator("#more").click();
      assert.equal((await state()).intents.length, 1);
      assert.match((await state()).intents[0].path, new RegExp("cursor=" + data.events[49].id));
      assert.equal(await page.locator("#more").isDisabled(), true);
      // Selecting another record does not invalidate the read itself.
      await page.locator('[data-event="' + data.events[1].id + '"]').click();
      await complete("success");
      assert.equal((await state()).events.length, 55);
      assert.equal((await state()).selected, data.events[1].id);
      assert.equal(await page.locator("#more").count(), 0);
      await page.locator("#loaded-query").fill("失败");
      assert.equal(await page.locator("[data-event]").count(), 18);
      await scene("system_collapsed");
      assert.equal(await page.locator("[data-event]").count(), 10);
      assert.equal(await page.locator("#system").getAttribute("aria-controls"), "event-list");
      await page.locator("#system").click();
      assert.equal(await page.locator("[data-event]").count(), 50);
      await page.locator("#system").click();
      assert.equal(await page.locator("[data-event]").count(), 10);
      await page.locator("#loaded-query").fill("实时连接");
      assert.equal(await page.locator("[data-event]").count(), 40);
      assert.equal(await page.locator("#system").count(), 0);
      await scene("system_only");
      assert.equal(await page.locator("[data-event]").count(), 0);
      await page.locator("#system").click();
      assert.equal(await page.locator("[data-event]").count(), 40);
      await scene("system_exact");
      assert.equal(await page.locator("[data-event]").count(), 40);
      await scene("normal");
      await filters();
      await page.locator("#filter-action").fill(" organization.member.invited ");
      await page.locator("#filter-outcome").selectOption("succeeded");
      await page.locator("#filter-resource_type").fill(" membership ");
      assert.equal((await state()).events.length, 50);
      assert.equal((await state()).intents.length, 0);
      await hold();
      await page.locator("#apply").click();
      const request = new URL((await state()).intents[0].path, "https://fixture.invalid");
      assert.deepEqual(Object.fromEntries(request.searchParams), {
        limit: "50",
        action: "organization.member.invited",
        outcome: "succeeded",
        resource_type: "membership",
      });
      assert.equal(await page.locator("#apply").isDisabled(), true);
      await complete("success");
      assert.equal((await state()).events.length, 19);
      assert.match(page.url(), /org_audit_action=organization.member.invited/);
      await page.reload();
      assert.equal((await state()).draft.action, "organization.member.invited");
      assert.equal((await state()).events.length, 19);
      await filters();
      await hold();
      await page.locator("#reset").click();
      await complete("success");
      assert.equal((await state()).events.length, 50);
      assert.equal(new URL(page.url()).searchParams.has("org_audit_action"), false);
      await page.locator("#advanced summary").click();
      await page.locator("#filter-occurred_from").fill("2026-08-28T12:00");
      await page.locator("#filter-occurred_to").fill("2026-08-27T12:00");
      const before = (await state()).intents.length;
      await page.locator("#apply").click();
      assert.equal((await state()).intents.length, before);
      assert.match(await page.locator("#range-error").innerText(), /不能晚于/);
      assert.equal(
        await page.locator("#filter-occurred_from").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator("#filter-occurred_from").fill("2026-08-27T17:55");
      await page.locator("#filter-occurred_to").fill("2026-08-27T18:00");
      await page.locator("#apply").click();
      const dateRequest = new URL((await state()).intents.at(-1).path, "https://fixture.invalid");
      assert.equal(dateRequest.searchParams.get("occurred_from"), "2026-08-27T09:55:00.000Z");
      await complete("success");
      assert.equal((await state()).events.length, 6);
      await scene("filter_failure");
      assert.equal((await state()).events.length, 50);
      assert.equal(await page.locator("#more").isDisabled(), true);
      assert.equal((await state()).facts.action, "");
      assert.equal((await state()).draft.action, "organization.member.invited");
      await scene("normal");
      await page.locator('[data-event="' + data.events[1].id + '"]').focus();
      await page.keyboard.press("Enter");
      assert.equal((await state()).selected, data.events[1].id);
      assert.equal(
        await page.locator("#detail-title").evaluate((n) => n === document.activeElement),
        true,
      );
      await page.locator(".technical summary").focus();
      await page.keyboard.press("Enter");
      assert.match(await page.locator(".technical").innerText(), new RegExp(data.events[1].id));
      await scene("normal");
      await page.locator('[data-copy="request"]').click();
      assert.equal((await state()).copy.request, "copied");
      await page.locator('[data-copy="trace"]').click();
      assert.equal((await state()).copy.trace, "copied");
      await scene("copy_failed");
      await page.locator('[data-copy="request"]').click();
      assert.equal((await state()).copy.request, "failed");
      for (const change of ["selection", "leave"]) {
        await scene("normal");
        await page.evaluate(() => {
          window.ORG_AUDIT_C_CLIPBOARD = () =>
            new Promise((r) => {
              window.resolveAuditCopy = r;
            });
        });
        await page.locator('[data-copy="request"]').click();
        if (change === "selection")
          await page.locator('[data-event="' + data.events[1].id + '"]').click();
        else
          await page.evaluate(() => {
            window.ORG_AUDIT_C.leave();
            window.ORG_AUDIT_C.activate();
          });
        await page.evaluate(async () => {
          window.resolveAuditCopy();
          await Promise.resolve();
        });
        assert.deepEqual((await state()).copy, {});
      }
      await scene("more_busy");
      const old = (await state()).pending.id;
      await page.evaluate(() => window.ORG_AUDIT_C.replaceWithRefresh());
      const current = (await state()).pending.id;
      assert.notEqual(old, current);
      assert.equal(
        await page.evaluate((id) => window.ORG_AUDIT_C.complete("success", id), old),
        false,
      );
      assert.equal((await state()).pending.id, current);
      await complete("success");
      assert.equal((await state()).events.length, 50);
      await scene("more_busy");
      await page.evaluate(() => {
        window.ORG_AUDIT_C.leave();
        window.ORG_AUDIT_C.activate();
      });
      assert.equal(await complete("success"), false);
      assert.equal((await state()).events.length, 50);
      await scene("metadata_nested");
      assert.doesNotMatch(await page.locator("#metadata").innerText(), /SYNTHETIC/);
      await scene("metadata_deep");
      assert.match(await page.locator("#metadata").innerText(), /层级过深/);
      await scene("metadata_array");
      const meta = JSON.parse(await page.locator("#metadata").innerText());
      assert.equal(meta.items.length, 100);
      assert.equal(meta.items.at(-1).sequence, 100);
      assert.ok(meta.items.every((e) => e.token === "[已脱敏]"));
      await scene("metadata_limit");
      assert.match(
        await page.locator("#metadata").innerText(),
        /SYNTHETIC_VALUE_WITH_NO_SENSITIVE_KEY/,
      );
      await scene("missing_ids");
      assert.equal(await page.locator("[data-copy]:disabled").count(), 2);
      await scene("auditor");
      await page.locator("#refresh").click();
      assert.deepEqual((await state()).intents, [
        {
          method: "GET",
          path: "/organizations/" + data.events[0].organization_id + "/audit-events?limit=50",
        },
      ]);
      assert.equal(
        await page.locator("a[download],a[href*=export],dialog,[role=dialog]").count(),
        0,
      );
      assert.deepEqual(http, []);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.equal((await context.cookies()).length, 0);
      checks.push({
        width,
        scenes: names.length,
        dialogVariants: 0,
        interactions: "passed",
        sourceSearchOracles: Object.keys(data.oracle).length,
        httpRequests: 0,
        browserErrors: 0,
        storageEntries: 0,
        clipboard: "in-memory synthetic adapter only",
      });
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({
    reducedMotion: "reduce",
    timezoneId: "Asia/Shanghai",
  });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of ["normal", "advanced", "long_ids", "metadata_array", "range_error"]) {
        await page.evaluate((n) => window.ORG_AUDIT_C.scene(n), name);
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
        proposal: "ORG-AUDIT-C-r1",
        sourceHashes,
        screenshots,
        checks,
        sourceChecks: data.sourceChecks,
        scope:
          "Standalone synthetic read-only prototype. Inert source functions and query construction, not mounted Vue, SQL, authorization, real clipboard or production proof. All browser contexts closed.",
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
