import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildOrgTokenDesignData } from "./lib/ui-phase2-org-token-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/org-token-direction-c",
  root = path.join(repo, relative),
  capture = process.argv.includes("--capture"),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const data = await buildOrgTokenDesignData(repo),
  box = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "data.js"), "utf8"), box);
assert.deepEqual(JSON.parse(JSON.stringify(box.window.ORG_TOKEN_C_DATA)), data);
const sources = [
  ...["index.html", "tokens.css", "tokens.js", "data.js"].map((f) => relative + "/" + f),
  "scripts/lib/ui-phase2-org-token-design-data.mjs",
  "scripts/verify-ui-phase2-org-token-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
  "apps/web/src/components/OrganizationTokenPanel.vue",
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "apps/web/src/components/AuditedReasonDialog.vue",
  "apps/web/src/use-audited-reason.ts",
  "apps/api/src/organization-admin-routes.ts",
  "apps/api/src/organization-admin-service.ts",
  "apps/api/src/mysql-organization-admin-repository.ts",
  "tests/e2e/m06-01-organization-admin.spec.ts",
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
      .locator("input,select,textarea")
      .evaluateAll((ns) => ns.every((n) => document.querySelector('label[for="' + n.id + '"]'))),
    true,
  );
  assert.equal(
    await page
      .locator(".scope-options label")
      .evaluateAll((ns) =>
        ns.every(
          (n) => n.getBoundingClientRect().height >= 44 && n.getBoundingClientRect().width >= 44,
        ),
      ),
    true,
  );
  if (await page.locator("dialog[open]").count())
    assert.equal(
      await page.locator("dialog[open]").evaluate((n) => {
        const r = n.getBoundingClientRect();
        return (
          r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1
        );
      }),
      true,
      "Dialog viewport containment",
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
      const scene = (n) => page.evaluate((v) => window.ORG_TOKEN_C.scene(v), n),
        state = () => page.evaluate(() => window.ORG_TOKEN_C.state()),
        complete = (n) => page.evaluate((v) => window.ORG_TOKEN_C.complete(v), n),
        hold = () => page.evaluate(() => window.ORG_TOKEN_C.setMode("hold")),
        filters = async () => {
          if (!(await state()).filtersOpen) await page.locator("#filters-toggle").click();
        };
      const names = await page.evaluate(() => Object.keys(window.ORG_TOKEN_C.scenes));
      assert.equal(names.length, 54);
      for (const name of names) {
        await scene(name);
        await metrics(page);
        if (["hover", "pressed"].includes(name)) {
          await page.locator("#create-submit").hover();
          if (name === "pressed") await page.mouse.down();
        }
        if (name === "focus") await page.locator("#create-submit").focus();
        const file = width + "-" + name + ".png";
        expected.push(file);
        if (capture) {
          const bytes = await page.screenshot({
            path: path.join(root, file),
            fullPage: !name.startsWith("reason_"),
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
        ["create_draft", "#create"],
        ["secret", "#secret-panel"],
      ]) {
        await scene(name);
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
      assert.deepEqual(await page.locator(".summary b").allTextContents(), [
        "8",
        "6",
        "1",
        "1",
        "2",
      ]);
      assert.equal(await page.locator("[data-token]").count(), 6);
      await page.locator('[data-page="1"]').click();
      assert.equal(await page.locator("[data-token]").count(), 2);
      assert.equal(
        await page.locator("#catalog-title").evaluate((n) => n === document.activeElement),
        true,
      );
      assert.match(page.url(), /org_token_page=2/);
      await filters();
      await page.locator("#filter-query").fill("报表只读");
      assert.equal(await page.locator("[data-token]").count(), 4);
      assert.equal((await state()).filter.page, 1);
      await page.locator("#reset").click();
      for (const [sort, ids] of Object.entries(data.oracle)) {
        await page.locator("#filter-sort").selectOption(sort);
        assert.deepEqual(
          await page.evaluate(() => window.ORG_TOKEN_C.filtered().map((r) => r.id)),
          ids,
        );
      }
      for (const [status, n] of [
        ["active", 6],
        ["expiring", 1],
        ["never_used", 1],
        ["rotated", 1],
        ["revoked", 1],
        ["expired", 0],
      ]) {
        await page.locator("#filter-status").selectOption(status);
        assert.equal(await page.locator("[data-token]").count(), n);
      }
      await page.reload();
      assert.equal((await state()).filter.status, "expired");
      await filters();
      await page.locator("#clear-filter").click();
      assert.equal(new URL(page.url()).searchParams.size, 0);
      await page.locator("#filter-scope").selectOption("task:read");
      assert.equal(await page.locator("[data-token]").count(), 4);
      await scene("unknown");
      assert.match(await page.locator(".token-list").innerText(), /unrecognized:read/);
      assert.equal(await page.locator("[data-action]").count(), 0);
      await scene("past_expiry");
      assert.match(await page.locator(".expiry").innerText(), /已到期/);
      assert.equal((await state()).tokens[0].status, "active");
      await scene("normal");
      await page.locator("#new-token").click();
      assert.equal(
        await page.locator("#create-name").evaluate((n) => n === document.activeElement),
        true,
      );
      assert.equal(await page.locator("[data-scope]:checked").count(), 0);
      await page.locator("#create-submit").click();
      assert.deepEqual(Object.keys((await state()).errors).sort(), ["name", "reason", "scopes"]);
      assert.equal((await state()).intents.length, 0);
      await page.locator("#create-name").fill(" " + data.createBody.name + " ");
      await page.locator("#create-reason").fill(" " + data.createBody.reason + " ");
      await page.locator('[data-scope="task:read"]').check();
      assert.deepEqual((await state()).form.scopes, ["task:read"]);
      for (const ttl of ["0", "366", "1.5"]) {
        await page.locator("#create-ttl").fill(ttl);
        await page.locator("#create-submit").click();
        assert.ok((await state()).errors.ttl_days);
        assert.equal((await state()).intents.length, 0);
      }
      for (const ttl of ["1", "365"]) {
        await page.locator("#create-ttl").fill(ttl);
        assert.doesNotMatch(await page.locator("#preview-expiry").innerText(), /需为/);
      }
      await page.locator('[data-ttl="90"]').click();
      await hold();
      await page.locator("#create-submit").click();
      assert.deepEqual((await state()).intents, [
        { method: "POST", path: "/org/admin/tokens", body: data.createBody },
      ]);
      assert.equal(await page.locator("#create-submit").isDisabled(), true);
      await page.locator("#create-form").dispatchEvent("submit");
      assert.equal((await state()).intents.length, 1);
      await complete("failure");
      assert.equal((await state()).form.name.trim(), data.createBody.name);
      await page.locator("#create-submit").click();
      await complete("success");
      assert.deepEqual((await state()).form, { name: "", scopes: [], ttl_days: 90, reason: "" });
      assert.match((await state()).secret, /^SYNTHETIC_UI_REVIEW_ONLY_NOT_A_REAL_TOKEN$/);
      assert.deepEqual((await state()).tokens, data.tokens);
      assert.equal(await complete("success"), false);
      await page.locator("#dismiss").click();
      assert.equal(await page.locator("#secret-panel").count(), 0);
      await scene("create_unknown");
      assert.equal(await page.locator("#create-submit").isDisabled(), true);
      await page.locator("#create-form").dispatchEvent("submit");
      assert.equal((await state()).intents.length, 1);
      await scene("refreshing");
      assert.equal(await page.locator("#create-submit").isDisabled(), true);
      assert.equal(await page.locator("[data-action]:not(:disabled)").count(), 0);
      for (const action of ["rotate", "revoke"]) {
        await scene("search");
        const button = page.locator('[data-action="' + action + '"]');
        for (const cancel of ["#reason-close", "#reason-cancel", "Escape"]) {
          await button.click();
          assert.equal(await page.locator("#reason-input").inputValue(), "");
          assert.equal(await page.locator("#reason-submit").isDisabled(), true);
          if (cancel === "Escape") await page.keyboard.press("Escape");
          else await page.locator(cancel).click();
          assert.equal((await state()).intents.length, 0);
          assert.equal(await button.evaluate((n) => n === document.activeElement), true);
        }
        await button.click();
        await page.locator("#reason-input").fill("字");
        assert.equal(await page.locator("#reason-submit").isDisabled(), true);
        await page.locator("#reason-input").fill(" 隔离操作原因 ");
        assert.equal(await page.locator("#reason-input").getAttribute("maxlength"), "500");
        await page.locator("#reason-close").focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.locator("#reason-submit").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#reason-close").evaluate((n) => n === document.activeElement),
          true,
        );
        await hold();
        await page.locator("#reason-submit").click();
        assert.deepEqual((await state()).intents, [
          { method: "POST", ...data.actionBodies.find((b) => b.body.action === action) },
        ]);
        assert.equal(await page.locator("dialog").count(), 0);
        await complete("conflict");
        await button.click();
        assert.equal(await page.locator("#reason-input").inputValue(), "");
        await page.locator("#reason-input").fill("隔离操作原因");
        await page.locator("#reason-submit").click();
        await complete("success");
        assert.deepEqual((await state()).tokens, data.tokens);
        assert.equal(Boolean((await state()).secret), action === "rotate");
      }
      for (const kind of ["replacement", "dismiss", "leave"]) {
        await scene("secret");
        await page.evaluate(() => {
          window.ORG_TOKEN_C_CLIPBOARD = () =>
            new Promise((resolve) => {
              window.resolveSyntheticCopy = resolve;
            });
        });
        await page.locator("#copy").click();
        if (kind === "replacement")
          await page.evaluate(() => window.ORG_TOKEN_C.replaceSyntheticSecret());
        else if (kind === "dismiss") await page.locator("#dismiss").click();
        else
          await page.evaluate(() => {
            window.ORG_TOKEN_C.leave();
            window.ORG_TOKEN_C.activate();
          });
        await page.evaluate(async () => {
          window.resolveSyntheticCopy();
          await Promise.resolve();
        });
        assert.equal((await state()).copyState, "");
        assert.equal(Boolean((await state()).secret), kind === "replacement");
      }
      await scene("secret");
      await page.locator("#copy").click();
      assert.equal((await state()).copyState, "copied");
      await scene("copy_failure");
      await page.locator("#copy").click();
      assert.equal((await state()).copyState, "failed");
      await scene("create_busy");
      await page.evaluate(() => {
        window.ORG_TOKEN_C.leave();
        window.ORG_TOKEN_C.activate();
      });
      await complete("success");
      assert.equal((await state()).secret, "");
      assert.equal((await state()).noticeKind, "info");
      await scene("write_read_failed");
      assert.ok((await state()).secret);
      await page.locator("#dismiss").click();
      await page.locator("#refresh").click();
      assert.equal((await state()).secret, "");
      assert.deepEqual((await state()).intents.slice(-2), [
        { method: "GET", path: "/org/admin/summary" },
        { method: "GET", path: "/org/admin/tokens" },
      ]);
      await page.reload();
      assert.equal((await state()).secret, "");
      assert.deepEqual(http, []);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.equal((await context.cookies()).length, 0);
      checks.push({
        width,
        scenes: names.length,
        dialogVariants: 2,
        interactions: "passed",
        sortsComparedWithSource: 5,
        httpRequests: 0,
        browserErrors: 0,
        storageEntries: 0,
        clipboard: "synthetic in-memory adapter only",
      });
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of ["normal", "long_name", "create_long", "reason_long", "secret"]) {
        await page.evaluate((n) => window.ORG_TOKEN_C.scene(n), name);
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
        proposal: "ORG-TOKEN-C-r1",
        sourceHashes,
        screenshots,
        checks,
        sourceChecks: data.sourceChecks,
        scope:
          "Standalone synthetic prototype. No mounted Vue, SQL, API, actual clipboard, production credentials, deployment or approval proof. All browser contexts closed.",
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
